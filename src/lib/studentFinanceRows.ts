import { prisma } from "./prisma";
import { aggregatePaymentTotals } from "./paymentAggregate";
import { computeTiExpectedPrice } from "./timiInvestPricing";
import { getAcademicMonths, getDateRange, type YearType } from "./academicYear";
import { tuitionDueDateFor } from "./smsStatus";
import { getStudentPayStatus, type StudentPayStatus } from "./studentTableStatus";

// Rreshtat financiarë të nxënësve (pagesa/borxhi/statusi i shkollimit për një
// vit) — BURIMI I VETËM për faqen e Nxënësve, Klasat dhe faqen e klasës, që
// numrat (p.sh. "me borxh") të përputhen kudo. Vetëm lexim; s'prek pagesat.

function toDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number" || typeof v === "bigint") return new Date(Number(v));
  const s = String(v);
  const d = /^\d+$/.test(s) ? new Date(Number(s)) : new Date(s.includes("T") || s.includes("Z") ? s : s.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? null : d;
}

export async function computeStudentFinanceRows(
  where: Record<string, unknown>,
  opts: { year: number; yearType: YearType; exportAll?: boolean },
) {
  const { year, yearType } = opts;
  const exportAll = !!opts.exportAll;
  const students = await prisma.student.findMany({
    where,
    include: { class: { select: { id: true, name: true } } },
  });
  const ids = students.map(s => s.id);

  /* ── 2. Pagesat e shkollimit për vitin e zgjedhur ── */
  const { start: periodStart, end: periodEnd } = getDateRange(year, yearType);
  const periodWhere = yearType === "academic"
    ? { OR: getAcademicMonths(year).map(m => ({ month: m.calMonth, year: m.calYear })) }
    : { dueDate: { gte: periodStart, lte: periodEnd } };

  const [category, setting, tiRows, payments, lastEvents] = await Promise.all([
    prisma.paymentCategory.findFirst({ where: { name: "Shkollimi" } }),
    prisma.setting.findUnique({ where: { key: "tuitionDueDate" } }),
    prisma.timiInvestStudent.findMany({
      where: { active: true },
      select: { id: true, studentId: true, firstName: true, lastName: true, regularPrice: true, discountPct: true, manualDiscAmt: true },
    }),
    prisma.payment.findMany({
      where: {
        studentId: { in: ids },
        category: { name: "Shkollimi" },
        AND: [{ OR: [{ description: null }, { description: { not: "BORXH_VJETER" } }] }],
        ...periodWhere,
      },
      select: { studentId: true, amount: true, finalAmount: true, paidAmount: true, description: true, dueDate: true },
    }),
    ids.length
      ? prisma.$queryRawUnsafe<{ studentId: number; type: string; title: string; occurredAt: unknown }[]>(
          `SELECT studentId, type, title, occurredAt FROM (
             SELECT studentId, type, title, occurredAt,
                    ROW_NUMBER() OVER (PARTITION BY studentId ORDER BY occurredAt DESC, id DESC) AS rn
             FROM StudentHistory
           ) WHERE rn = 1`)
      : Promise.resolve([]),
  ]);

  const defaultAmount = category?.defaultAmount ?? 0;
  const tuitionDueDate = tuitionDueDateFor(year, setting?.value);
  const tiById = new Map<number, typeof tiRows[0]>();
  const tiByName = new Map<string, typeof tiRows[0]>();
  for (const t of tiRows) {
    if (t.studentId) tiById.set(t.studentId, t);
    else tiByName.set(`${t.firstName.trim().toLowerCase()}|${t.lastName.trim().toLowerCase()}`, t);
  }
  const payByStudent = new Map<number, typeof payments>();
  for (const p of payments) {
    if (!payByStudent.has(p.studentId)) payByStudent.set(p.studentId, []);
    payByStudent.get(p.studentId)!.push(p);
  }
  const lastByStudent = new Map<number, { type: string; title: string; at: string | null }>();
  for (const e of lastEvents) {
    lastByStudent.set(Number(e.studentId), { type: e.type, title: e.title, at: toDate(e.occurredAt)?.toISOString() ?? null });
  }

  const rows = students.map(s => {
    const inst = payByStudent.get(s.id) ?? [];
    const ti = tiById.get(s.id) ?? tiByName.get(`${s.firstName.trim().toLowerCase()}|${s.lastName.trim().toLowerCase()}`);
    // Pa këste: TI → çmimi i tyre specifik; të tjerët → çmimi standard − zbritja
    // (njësoj si /api/category-payments).
    const expected = ti
      ? Math.round(computeTiExpectedPrice(ti))
      : Math.round(defaultAmount * (1 - (s.discountPct ?? 0) / 100));
    const r = getStudentPayStatus({ isTimiInvest: !!ti, installments: inst, expectedAmount: expected, tuitionDueDate });
    const finalPrice = inst.length ? aggregatePaymentTotals(inst).finalAmount : expected;
    const header = inst.find(p => p.description === "FLEX_HEADER");
    const originalPrice = inst.length
      ? (header ? header.amount : inst.reduce((sum, p) => sum + p.amount, 0))
      : (ti ? ti.regularPrice : defaultAmount);
    const parentName = s.fatherName || s.motherName || s.parentName || null;
    const phone = s.fatherPhone || s.motherPhone || s.parentPhone || null;
    return {
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      personalNumber: s.personalNumber,
      status: s.status,
      classId: s.class?.id ?? null,
      className: s.class?.name ?? null,
      parentName,
      phone,
      discountPct: s.discountPct ?? 0,
      kontrata: s.kontrata,
      hasContract: (s.kontrata ?? "").trim().toLowerCase() === "po",
      hasPlan: inst.length > 0,
      paid: Math.round(r.paid * 100) / 100,
      finalPrice: Math.round(finalPrice * 100) / 100,
      originalPrice: Math.round(originalPrice * 100) / 100,
      balance: Math.round(r.balance * 100) / 100,
      payStatus: r.status as StudentPayStatus,
      timiInvest: ti ? { id: ti.id, regularPrice: ti.regularPrice } : null,
      lastEvent: lastByStudent.get(s.id) ?? null,
      // vetëm për eksportin në Excel
      _export: exportAll ? {
        fatherName: s.fatherName, fatherPhone: s.fatherPhone, fatherEmail: s.fatherEmail,
        motherName: s.motherName, motherPhone: s.motherPhone, motherEmail: s.motherEmail,
        parentName: s.parentName, parentPhone: s.parentPhone, address: s.address,
      } : undefined,
    };
  });
  return { rows, defaultAmount };
}

export type StudentFinanceRow = Awaited<ReturnType<typeof computeStudentFinanceRows>>["rows"][number];
export type { StudentPayStatus };
