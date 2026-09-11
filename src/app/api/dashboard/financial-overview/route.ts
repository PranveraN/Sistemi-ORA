import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aggregatePaymentTotals } from "@/lib/paymentAggregate";

// E RE, e ndarë krejtësisht nga /api/dashboard — vetëm lexon, nuk prek asnjë
// rresht ekzistues. Ushqen seksionin "Pasqyrë Financiare" të shtuar në fund
// të Dashboard-it (shih src/components/dashboard/FinancialOverview.tsx).

type StudentRow = { id: number; name: string; className: string | null; finalAmount: number; paidAmount: number; balance: number };

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth();
  const firstDayThisMonth = new Date(thisYear, thisMonth, 1);
  const lastDayThisMonth  = new Date(thisYear, thisMonth + 1, 0, 23, 59, 59);

  const [
    categories,
    activeStudents,
    timiInvestLinks,
    shkollimiCategory,
  ] = await Promise.all([
    prisma.paymentCategory.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } }),
    prisma.student.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, class: { select: { name: true } } },
    }),
    prisma.timiInvestStudent.findMany({
      where: { active: true, studentId: { not: null } },
      select: { studentId: true },
    }),
    prisma.paymentCategory.findFirst({ where: { name: "Shkollimi", organizationId: orgId } }),
  ]);

  const timiInvestIds = new Set(timiInvestLinks.map(t => t.studentId as number));

  // ── Statusi i pagesave (Shkollimi) — Paguar / Pjesërisht / S'ka paguar / Me TIMI Invest ──
  const shkollimiPayments = shkollimiCategory
    ? await prisma.payment.findMany({
        where: { studentId: { in: activeStudents.map(s => s.id) }, categoryId: shkollimiCategory.id },
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
    if (timiInvestIds.has(s.id)) {
      timiInvest.push({ id: s.id, name, className, finalAmount: 0, paidAmount: 0, balance: 0 });
      continue;
    }
    const payments = byStudent.get(s.id) ?? [];
    const { finalAmount, paidAmount, balance } = aggregatePaymentTotals(payments);
    const row: StudentRow = { id: s.id, name, className, finalAmount, paidAmount, balance };
    if (payments.length === 0 || paidAmount <= 0) unpaid.push(row);
    else if (balance <= 0) paid.push(row);
    else partial.push(row);
  }

  // ── Të hyrat sipas metodës (muaji aktual) ──
  const [monthlyPayments, revenueList] = await Promise.all([
    prisma.payment.findMany({
      where: { organizationId: orgId, paidDate: { gte: firstDayThisMonth, lte: lastDayThisMonth }, status: { in: ["PAID", "PARTIAL"] } },
      select: { paidAmount: true, method: true },
    }),
    prisma.payment.findMany({
      where: { organizationId: orgId, paidDate: { gte: firstDayThisMonth, lte: lastDayThisMonth }, status: { in: ["PAID", "PARTIAL"] } },
      include: { student: { select: { firstName: true, lastName: true } }, category: { select: { name: true } } },
      orderBy: { paidDate: "desc" },
      take: 300,
    }),
  ]);
  const byMethod: Record<string, number> = { CASH: 0, BANK: 0, CARD: 0, ONLINE: 0 };
  let totalRevenueThisMonth = 0;
  for (const p of monthlyPayments) {
    const m = p.method || "CASH";
    byMethod[m] = (byMethod[m] ?? 0) + p.paidAmount;
    totalRevenueThisMonth += p.paidAmount;
  }

  // ── Të hyrat mujore sipas metodës — 6 muajt e fundit ──
  const sixMonthsAgo = new Date(thisYear, thisMonth - 5, 1);
  const last6MonthsPayments = await prisma.payment.findMany({
    where: { organizationId: orgId, paidDate: { gte: sixMonthsAgo }, status: { in: ["PAID", "PARTIAL"] } },
    select: { paidDate: true, paidAmount: true, method: true },
  });
  const monthKeys = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(thisYear, thisMonth - (5 - i), 1);
    return { date: d, key: `${d.getFullYear()}-${d.getMonth()}` };
  });
  const byMonthMethod = new Map<string, { CASH: number; BANK: number; OTHER: number }>();
  for (const p of last6MonthsPayments) {
    if (!p.paidDate) continue;
    const key = `${p.paidDate.getFullYear()}-${p.paidDate.getMonth()}`;
    const entry = byMonthMethod.get(key) ?? { CASH: 0, BANK: 0, OTHER: 0 };
    const m = p.method || "CASH";
    if (m === "CASH") entry.CASH += p.paidAmount;
    else if (m === "BANK") entry.BANK += p.paidAmount;
    else entry.OTHER += p.paidAmount;
    byMonthMethod.set(key, entry);
  }
  const monthlyByMethod = monthKeys.map(({ date, key }) => {
    const entry = byMonthMethod.get(key) ?? { CASH: 0, BANK: 0, OTHER: 0 };
    return { month: new Intl.DateTimeFormat("sq-AL", { month: "short" }).format(date), ...entry };
  });

  // ── Dorëzimet (muaji aktual) ──
  const [handoverGroups, handoverList] = await Promise.all([
    prisma.paymentHandover.groupBy({
      by: ["categoryId"],
      where: { organizationId: orgId, handoverAt: { gte: firstDayThisMonth, lte: lastDayThisMonth } },
      _sum: { amount: true },
    }),
    prisma.paymentHandover.findMany({
      where: { organizationId: orgId, handoverAt: { gte: firstDayThisMonth, lte: lastDayThisMonth } },
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
  const totalHandedOverThisMonth = handoversByCategory.reduce((s, h) => s + h.amount, 0);

  // ── Shpenzimet sipas llojit (muaji aktual) — Shpenzim s'ka organizationId (global, si gjetkë në app) ──
  const [expenseGroups, expenseList] = await Promise.all([
    prisma.shpenzim.groupBy({
      by: ["lloji"],
      where: { data: { gte: firstDayThisMonth, lte: lastDayThisMonth } },
      _sum: { shuma: true },
    }),
    prisma.shpenzim.findMany({
      where: { data: { gte: firstDayThisMonth, lte: lastDayThisMonth } },
      include: { kategori: { select: { emri: true } } },
      orderBy: { data: "desc" },
      take: 300,
    }),
  ]);
  const expensesByType: Record<string, number> = { ZYRE: 0, BANKE: 0 };
  for (const g of expenseGroups) expensesByType[g.lloji] = g._sum.shuma ?? 0;
  const totalExpensesThisMonth = expensesByType.ZYRE + expensesByType.BANKE;

  // ── Borxhi i papaguar — të gjitha kategoritë, gjendja aktuale ──
  const debtPayments = await prisma.payment.findMany({
    where: { organizationId: orgId, balance: { gt: 0 } },
    include: { student: { select: { firstName: true, lastName: true, class: { select: { name: true } } } }, category: { select: { name: true } } },
    orderBy: { balance: "desc" },
    take: 500,
  });
  const totalDebt = debtPayments.reduce((s, p) => s + p.balance, 0);

  return NextResponse.json({
    period: { month: thisMonth + 1, year: thisYear },
    studentStatus: {
      counts: { paid: paid.length, partial: partial.length, unpaid: unpaid.length, timiInvest: timiInvest.length, total: activeStudents.length },
      lists: { paid, partial, unpaid, timiInvest },
    },
    revenue: {
      totalThisMonth: totalRevenueThisMonth,
      byMethod,
      list: revenueList.map(p => ({
        id: p.id, studentName: `${p.student.firstName} ${p.student.lastName}`, category: p.category.name,
        amount: p.paidAmount, method: p.method, paidDate: p.paidDate,
      })),
    },
    monthlyByMethod,
    handovers: {
      totalThisMonth: totalHandedOverThisMonth,
      byCategory: handoversByCategory,
      list: handoverList.map(h => ({
        id: h.id, categoryName: h.category?.name ?? "Të përgjithshme", amount: h.amount,
        method: h.method, recipient: h.recipient, handoverAt: h.handoverAt,
      })),
    },
    expenses: {
      totalThisMonth: totalExpensesThisMonth,
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
