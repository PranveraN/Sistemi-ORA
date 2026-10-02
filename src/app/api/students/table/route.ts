import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aggregatePaymentTotals } from "@/lib/paymentAggregate";
import { computeTiExpectedPrice } from "@/lib/timiInvestPricing";
import { DEFAULT_ACADEMIC_YEAR, getAcademicMonths, getDateRange, type YearType } from "@/lib/academicYear";
import { tuitionDueDateFor } from "@/lib/smsStatus";
import { getStudentPayStatus, type StudentPayStatus } from "@/lib/studentTableStatus";

// Lista e faqes "Nxënësit" — filtrimi, renditja dhe faqosja bëhen KËTU (në
// server), jo në shfletues: shfletuesi merr vetëm një faqe rreshtash.
//   1. Kufizimet bazë (Aktivë, klasa, kërkimi) → në databazë.
//   2. Pagesa/borxhi/statusi i shkollimit për vitin e zgjedhur → llogaritet
//      këtu për rreshtat bazë (statusi varet nga këstet + lidhja Timi Invest,
//      prandaj s'shprehet dot si SQL i thjeshtë).
//   3. Filtrat e tabelës, renditja (shqip: ë, ç) dhe faqosja → këtu.
// VETËM PAMJE — s'ndryshon asnjë të dhënë dhe s'prek pagesat/raportet.
// E veçantë nga /api/students (i përdorur nga 10+ faqe), që ato të mos preken.

const collator = new Intl.Collator("sq", { sensitivity: "base", numeric: true });

function toDate(v: unknown): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return v;
  if (typeof v === "number" || typeof v === "bigint") return new Date(Number(v));
  const s = String(v);
  const d = /^\d+$/.test(s) ? new Date(Number(s)) : new Date(s.includes("T") || s.includes("Z") ? s : s.replace(" ", "T") + "Z");
  return isNaN(d.getTime()) ? null : d;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const sp = req.nextUrl.searchParams;
  const year = parseInt(sp.get("year") || "") || DEFAULT_ACADEMIC_YEAR;
  const yearType = (sp.get("yearType") || "academic") as YearType;
  const status = sp.get("status") || "";
  const classId = sp.get("classId") || "";
  const search = (sp.get("search") || "").trim();
  const card = sp.get("card") || "all";               // all | paid | debt | ti
  const fStudent = (sp.get("fStudent") || "").trim().toLowerCase();
  const fParent = (sp.get("fParent") || "").trim().toLowerCase();
  const fPay = sp.get("fPay") || "";                  // none | partial | full | discount
  const fDebt = sp.get("fDebt") || "";                // UNPAID | PARTIAL | PAID | TIMI_INVEST
  const fContract = sp.get("fContract") || "";        // yes | no
  const fHist = sp.get("fHist") || "";                // lloji i ngjarjes së fundit
  const sort = sp.get("sort") || "name";              // name | parent | pay | debt | history
  const dir = sp.get("dir") === "desc" ? -1 : 1;
  const page = Math.max(1, parseInt(sp.get("page") || "1"));
  const limit = Math.min(500, Math.max(1, parseInt(sp.get("limit") || "20")));
  const exportAll = sp.get("export") === "1";
  const idsParam = sp.get("ids");

  /* ── 1. Kufizimet bazë në databazë (si /api/students) ── */
  const where: Record<string, unknown> = { organizationId: orgId };
  if (search) {
    const parts = search.split(/\s+/);
    const base = [
      { firstName: { contains: search } }, { lastName: { contains: search } },
      { personalNumber: { contains: search } }, { parentPhone: { contains: search } },
      { fatherPhone: { contains: search } }, { motherPhone: { contains: search } },
      { parentName: { contains: search } },
    ];
    where.OR = parts.length >= 2
      ? [...base,
          { AND: [{ firstName: { contains: parts[0] } }, { lastName: { contains: parts.slice(1).join(" ") } }] },
          { AND: [{ firstName: { contains: parts[parts.length - 1] } }, { lastName: { contains: parts.slice(0, -1).join(" ") } }] }]
      : base;
  }
  if (status) where.status = status;
  if (classId) where.classId = parseInt(classId);
  if (idsParam) where.id = { in: idsParam.split(",").map(Number).filter(n => n > 0) };

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
        NOT: { description: "BORXH_VJETER" },
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

  /* ── Kartat: numrat sipas kufizimeve bazë (viti/Aktivë/klasa/kërkimi) ── */
  const counts = {
    all: rows.length,
    paid: rows.filter(r => r.payStatus === "PAID").length,
    debt: rows.filter(r => r.payStatus === "UNPAID" || r.payStatus === "PARTIAL").length,
    ti: rows.filter(r => r.payStatus === "TIMI_INVEST").length,
  };

  /* ── 3. Filtrat e tabelës ── */
  let filtered = rows;
  if (card === "paid") filtered = filtered.filter(r => r.payStatus === "PAID");
  else if (card === "debt") filtered = filtered.filter(r => r.payStatus === "UNPAID" || r.payStatus === "PARTIAL");
  else if (card === "ti") filtered = filtered.filter(r => r.payStatus === "TIMI_INVEST");

  if (fStudent) filtered = filtered.filter(r =>
    `${r.firstName} ${r.lastName} ${r.lastName} ${r.firstName} ${r.className ?? ""} ${r.personalNumber ?? ""}`.toLowerCase().includes(fStudent));
  if (fParent) filtered = filtered.filter(r =>
    `${r.parentName ?? ""} ${r.phone ?? ""}`.toLowerCase().includes(fParent));
  if (fPay === "none") filtered = filtered.filter(r => r.paid <= 0.005);
  else if (fPay === "partial") filtered = filtered.filter(r => r.paid > 0.005 && r.balance > 0.005);
  else if (fPay === "full") filtered = filtered.filter(r => r.paid > 0.005 && r.balance <= 0.005);
  else if (fPay === "discount") filtered = filtered.filter(r => r.discountPct > 0);
  if (fDebt) filtered = filtered.filter(r => r.payStatus === fDebt);
  if (fContract === "yes") filtered = filtered.filter(r => r.hasContract);
  else if (fContract === "no") filtered = filtered.filter(r => !r.hasContract);
  if (fHist === "NONE") filtered = filtered.filter(r => !r.lastEvent);
  else if (fHist) filtered = filtered.filter(r => r.lastEvent?.type === fHist);

  /* ── Renditja (shqip) ── */
  const byName = (a: typeof rows[0], b: typeof rows[0]) =>
    collator.compare(a.firstName, b.firstName) || collator.compare(a.lastName, b.lastName);
  const cmp: Record<string, (a: typeof rows[0], b: typeof rows[0]) => number> = {
    name: byName,
    parent: (a, b) => collator.compare(a.parentName ?? "", b.parentName ?? ""),
    pay: (a, b) => (a.finalPrice ? a.paid / a.finalPrice : 0) - (b.finalPrice ? b.paid / b.finalPrice : 0),
    debt: (a, b) => a.balance - b.balance,
    history: (a, b) => (a.lastEvent?.at ?? "").localeCompare(b.lastEvent?.at ?? ""),
  };
  const f = cmp[sort] ?? byName;
  filtered = [...filtered].sort((a, b) => f(a, b) * dir || byName(a, b));

  const total = filtered.length;
  const pageRows = exportAll ? filtered : filtered.slice((page - 1) * limit, page * limit);
  const historyTypes = Array.from(new Set(rows.map(r => r.lastEvent?.type).filter((t): t is string => !!t))).sort();

  return NextResponse.json({
    rows: pageRows,
    total,
    page,
    limit,
    counts,
    defaultAmount,
    historyTypes,
  });
}
