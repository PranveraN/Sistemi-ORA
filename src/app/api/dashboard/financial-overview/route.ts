import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aggregatePaymentTotals } from "@/lib/paymentAggregate";
import { getDateRange, getAcademicMonths, DEFAULT_ACADEMIC_YEAR, type YearType } from "@/lib/academicYear";
import { MONTHS } from "@/lib/utils";

// E RE, e ndarë krejtësisht nga /api/dashboard — vetëm lexon, nuk prek asnjë
// rresht ekzistues. Ushqen seksionin "Pasqyrë Financiare" të shtuar në fund
// të Dashboard-it (shih src/components/dashboard/FinancialOverview.tsx).
// Periudha (yearType/year) i vjen nga faqja mëmë — e njëjta që përdor edhe
// pjesa tjetër e Dashboard-it (/api/dashboard), që numrat të përputhen.

type StudentRow = { id: number; name: string; className: string | null; finalAmount: number; paidAmount: number; balance: number; phone: string | null };
type PeriodMonth = { calMonth: number; calYear: number };

// Njësoj si /api/dashboard/route.ts — akruale (etiketa month/year) për vitin
// akademik, sipas datës reale të arkëtimit (paidDate) për vitin kalendarik.
function revenueWhere(orgId: number, yearType: YearType, months: PeriodMonth[], start: Date, end: Date) {
  return yearType === "academic"
    ? {
        organizationId: orgId, paidAmount: { gt: 0 }, status: { in: ["PAID", "PARTIAL"] },
        OR: months.map(m => ({ month: m.calMonth, year: m.calYear })),
      }
    : {
        organizationId: orgId, paidDate: { gte: start, lte: end },
        paidAmount: { gt: 0 }, status: { in: ["PAID", "PARTIAL"] },
      };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const { searchParams } = new URL(req.url);
  const year     = parseInt(searchParams.get("year") || String(DEFAULT_ACADEMIC_YEAR));
  const yearType = (searchParams.get("yearType") || "academic") as YearType;
  const { start, end, label } = getDateRange(year, yearType);
  const months = yearType === "academic"
    ? getAcademicMonths(year)
    : Array.from({ length: 12 }, (_, i) => ({ calMonth: i + 1, calYear: year }));

  const [
    categories,
    activeStudents,
    timiInvestLinks,
    shkollimiCategory,
  ] = await Promise.all([
    prisma.paymentCategory.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
    prisma.student.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      select: {
        id: true, firstName: true, lastName: true, class: { select: { name: true } },
        fatherPhone: true, motherPhone: true, parentPhone: true,
      },
    }),
    prisma.timiInvestStudent.findMany({
      where: { active: true, stage: "KRYER", studentId: { not: null } },
      select: { studentId: true },
    }),
    prisma.paymentCategory.findFirst({ where: { name: "Shkollimi", organizationId: orgId } }),
  ]);

  const timiInvestIds = new Set(timiInvestLinks.map(t => t.studentId as number));

  // ── Statusi i pagesave (Shkollimi, brenda periudhës) — Paguar / Pjesërisht / S'ka paguar / Me TIMI Invest ──
  const shkollimiPayments = shkollimiCategory
    ? await prisma.payment.findMany({
        where: yearType === "academic"
          ? { studentId: { in: activeStudents.map(s => s.id) }, categoryId: shkollimiCategory.id, OR: months.map(m => ({ month: m.calMonth, year: m.calYear })) }
          : { studentId: { in: activeStudents.map(s => s.id) }, categoryId: shkollimiCategory.id, dueDate: { gte: start, lte: end } },
        select: { studentId: true, paidAmount: true, finalAmount: true, description: true },
      })
    : [];
  const byStudent = new Map<number, { paidAmount: number; finalAmount: number; description: string | null }[]>();
  for (const p of shkollimiPayments) {
    const arr = byStudent.get(p.studentId) ?? [];
    arr.push(p);
    byStudent.set(p.studentId, arr);
  }

  const paid: StudentRow[] = [], partial: StudentRow[] = [], unpaid: StudentRow[] = [], timiInvest: StudentRow[] = [];
  for (const s of activeStudents) {
    const name = `${s.firstName} ${s.lastName}`;
    const className = s.class?.name ?? null;
    const phone = s.fatherPhone || s.motherPhone || s.parentPhone || null;
    if (timiInvestIds.has(s.id)) {
      timiInvest.push({ id: s.id, name, className, finalAmount: 0, paidAmount: 0, balance: 0, phone });
      continue;
    }
    const payments = byStudent.get(s.id) ?? [];
    const { finalAmount, paidAmount, balance } = aggregatePaymentTotals(payments);
    const row: StudentRow = { id: s.id, name, className, finalAmount, paidAmount, balance, phone };
    if (payments.length === 0 || paidAmount <= 0) unpaid.push(row);
    else if (balance <= 0) paid.push(row);
    else partial.push(row);
  }

  // ── Të hyrat sipas metodës (brenda periudhës) ──
  const [periodPayments, revenueList] = await Promise.all([
    prisma.payment.findMany({
      where: revenueWhere(orgId, yearType, months, start, end),
      select: { paidAmount: true, method: true },
    }),
    prisma.payment.findMany({
      where: revenueWhere(orgId, yearType, months, start, end),
      include: { student: { select: { firstName: true, lastName: true } }, category: { select: { name: true } } },
      orderBy: { paidDate: "desc" },
      take: 300,
    }),
  ]);
  const byMethod: Record<string, number> = { CASH: 0, BANK: 0, CARD: 0, ONLINE: 0 };
  let totalRevenuePeriod = 0;
  for (const p of periodPayments) {
    const m = p.method || "CASH";
    byMethod[m] = (byMethod[m] ?? 0) + p.paidAmount;
    totalRevenuePeriod += p.paidAmount;
  }

  // ── Të hyrat mujore sipas metodës — 12 muajt e periudhës së zgjedhur ──
  const periodPaymentsWithDate = await prisma.payment.findMany({
    where: revenueWhere(orgId, yearType, months, start, end),
    select: { paidDate: true, paidAmount: true, method: true, month: true, year: true },
  });
  const byMonthMethod = new Map<string, { CASH: number; BANK: number; OTHER: number }>();
  for (const p of periodPaymentsWithDate) {
    let key: string;
    if (yearType === "academic") {
      key = `${p.month}-${p.year}`;
    } else {
      if (!p.paidDate) continue;
      const d = new Date(p.paidDate);
      key = `${d.getMonth() + 1}-${d.getFullYear()}`;
    }
    const entry = byMonthMethod.get(key) ?? { CASH: 0, BANK: 0, OTHER: 0 };
    const m = p.method || "CASH";
    if (m === "CASH") entry.CASH += p.paidAmount;
    else if (m === "BANK") entry.BANK += p.paidAmount;
    else entry.OTHER += p.paidAmount;
    byMonthMethod.set(key, entry);
  }
  const monthlyByMethod = months.map(m => {
    const entry = byMonthMethod.get(`${m.calMonth}-${m.calYear}`) ?? { CASH: 0, BANK: 0, OTHER: 0 };
    return { month: MONTHS[m.calMonth - 1], ...entry };
  });

  // ── Dorëzimet (brenda periudhës) ──
  const [handoverGroups, handoverList] = await Promise.all([
    prisma.paymentHandover.groupBy({
      by: ["categoryId"],
      where: { organizationId: orgId, handoverAt: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.paymentHandover.findMany({
      where: { organizationId: orgId, handoverAt: { gte: start, lte: end } },
      include: { category: { select: { name: true } } },
      orderBy: { handoverAt: "desc" },
    }),
  ]);
  const categoryNameById = new Map(categories.map(c => [c.id, c.name]));
  const handoversByCategory = handoverGroups.map(g => ({
    categoryId: g.categoryId,
    categoryName: g.categoryId ? (categoryNameById.get(g.categoryId) ?? "—") : "Të përgjithshme",
    amount: g._sum.amount ?? 0,
  }));
  const totalHandedOverPeriod = handoversByCategory.reduce((s, h) => s + h.amount, 0);

  // ── Shpenzimet sipas llojit (brenda periudhës) — Shpenzim s'ka organizationId (global, si gjetkë në app) ──
  const [expenseGroups, expenseList] = await Promise.all([
    prisma.shpenzim.groupBy({
      by: ["lloji"],
      where: { data: { gte: start, lte: end } },
      _sum: { shuma: true },
    }),
    prisma.shpenzim.findMany({
      where: { data: { gte: start, lte: end } },
      include: { kategori: { select: { emri: true } } },
      orderBy: { data: "desc" },
      take: 300,
    }),
  ]);
  const expensesByType: Record<string, number> = { ZYRE: 0, BANKE: 0 };
  for (const g of expenseGroups) expensesByType[g.lloji] = g._sum.shuma ?? 0;
  const totalExpensesPeriod = expensesByType.ZYRE + expensesByType.BANKE;

  // ── Borxhi i papaguar — të gjitha kategoritë, afati brenda periudhës (si /api/dashboard) ──
  const debtPayments = await prisma.payment.findMany({
    where: { organizationId: orgId, balance: { gt: 0 }, dueDate: { gte: start, lte: end } },
    include: { student: { select: { firstName: true, lastName: true, class: { select: { name: true } } } }, category: { select: { name: true } } },
    orderBy: { balance: "desc" },
    take: 500,
  });
  const totalDebt = debtPayments.reduce((s, p) => s + p.balance, 0);

  return NextResponse.json({
    period: { year, yearType, label },
    studentStatus: {
      counts: { paid: paid.length, partial: partial.length, unpaid: unpaid.length, timiInvest: timiInvest.length, total: activeStudents.length },
      lists: { paid, partial, unpaid, timiInvest },
    },
    revenue: {
      totalThisMonth: totalRevenuePeriod,
      byMethod,
      list: revenueList.map(p => ({
        id: p.id, studentName: `${p.student.firstName} ${p.student.lastName}`, category: p.category.name,
        amount: p.paidAmount, method: p.method, paidDate: p.paidDate,
      })),
    },
    monthlyByMethod,
    handovers: {
      totalThisMonth: totalHandedOverPeriod,
      byCategory: handoversByCategory,
      list: handoverList.map(h => ({
        id: h.id, categoryName: h.category?.name ?? "Të përgjithshme", amount: h.amount,
        method: h.method, recipient: h.recipient, handoverAt: h.handoverAt,
      })),
    },
    expenses: {
      totalThisMonth: totalExpensesPeriod,
      byType: expensesByType,
      list: expenseList.map(e => ({
        id: e.id, kategoria: e.kategori.emri, shuma: e.shuma, lloji: e.lloji, data: e.data, marres: e.marres,
      })),
    },
    debt: {
      total: totalDebt,
      list: debtPayments.map(p => ({
        id: p.id, studentName: `${p.student.firstName} ${p.student.lastName}`, className: p.student.class?.name ?? null,
        category: p.category.name, balance: p.balance,
      })),
    },
  });
}
