import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDateRange, getAcademicMonths, DEFAULT_ACADEMIC_YEAR, type YearType } from "@/lib/academicYear";
import { aggregatePaymentTotals } from "@/lib/paymentAggregate";
import { computeTiExpectedPrice } from "@/lib/timiInvestPricing";

interface Row { studentId: number; name: string; className: string | null; phone: string; amount: number }

// Pasqyra e plotë financiare e Shkollimit (Dashboard → "Përmbledhje") — E RE,
// e ndarë krejtësisht nga /api/dashboard/tuition-groups dhe /api/category-payments,
// por ndjek TË NJËJTIN rregull financiar bazë të rifreskuar (2026-09-25):
// asnjë status TIMI Invest s'e përjashton vetvetiu dikë nga borxhi — vetëm
// pagesë REALE e konfirmuar manualisht e bën këtë. Klientë TI pa asnjë pagesë
// (ose pa konfirmim) marrin çmimin e TYRE specifik si borxh, jo standardin
// e kategorisë.
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

  const shkollimiCategory = await prisma.paymentCategory.findFirst({ where: { name: "Shkollimi", organizationId: orgId } });
  if (!shkollimiCategory) {
    return NextResponse.json({ error: "Kategoria 'Shkollimi' s'ekziston ende." }, { status: 404 });
  }

  const tuitionWhere = yearType === "academic"
    ? { organizationId: orgId, categoryId: shkollimiCategory.id, OR: months.map(m => ({ month: m.calMonth, year: m.calYear })) }
    : { organizationId: orgId, categoryId: shkollimiCategory.id, dueDate: { gte: start, lte: end } };
  const hyraWhere: Record<string, unknown> = {};
  if (yearType === "academic") hyraWhere.OR = months.map(m => ({ muaj: m.calMonth, vit: m.calYear }));
  else { hyraWhere.vit = year; }

  const [activeStudents, tuitionRows, timiInvestLinks, handoverAgg, expenseRows, hyraAgg] = await Promise.all([
    prisma.student.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      select: {
        id: true, firstName: true, lastName: true, discountPct: true, paymentPlan: true,
        class: { select: { name: true } },
        parentPhone: true, fatherPhone: true, motherPhone: true,
      },
    }),
    prisma.payment.findMany({
      where: tuitionWhere,
      select: { studentId: true, finalAmount: true, paidAmount: true, confirmed: true, description: true },
    }),
    prisma.timiInvestStudent.findMany({
      where: { active: true, studentId: { not: null } },
      select: { studentId: true, regularPrice: true, discountPct: true, manualDiscAmt: true },
    }),
    prisma.paymentHandover.aggregate({
      where: { organizationId: orgId, categoryId: shkollimiCategory.id, handoverAt: { gte: start, lte: end } },
      _sum: { amount: true },
    }),
    prisma.shpenzim.findMany({
      where: { data: { gte: start, lte: end }, paguar: true },
      include: { kategori: { select: { emri: true } } },
    }),
    prisma.hyra.aggregate({ where: hyraWhere, _sum: { shuma: true } }),
  ]);

  const tiById = new Map(timiInvestLinks.map(t => [t.studentId as number, t]));
  const rowsByStudent = new Map<number, { finalAmount: number; paidAmount: number; confirmed: boolean; description: string | null }[]>();
  for (const p of tuitionRows) {
    const arr = rowsByStudent.get(p.studentId) ?? [];
    arr.push(p);
    rowsByStudent.set(p.studentId, arr);
  }

  const toRow = (s: typeof activeStudents[number], amount: number): Row => ({
    studentId: s.id,
    name: `${s.firstName} ${s.lastName}`,
    className: s.class?.name ?? null,
    phone: s.parentPhone || s.fatherPhone || s.motherPhone || "",
    amount: Math.round(amount * 100) / 100,
  });

  let kpiExpected = 0, kpiPaid = 0, kpiDebt = 0;
  const full: Row[] = [], partial: Row[] = [], tiUnpaid: Row[] = [], tiPartial: Row[] = [], zero: Row[] = [];
  const priceGroupMap = new Map<number, { count: number; total: number }>();
  const missingPlan: Row[] = [], overpaid: Row[] = [], noPaymentNoTi: Row[] = [];

  for (const s of activeStudents) {
    const rows = rowsByStudent.get(s.id) ?? [];
    const ti = tiById.get(s.id);
    const hasAnyPayment = rows.length > 0;
    const rawPaid = rows.reduce((sum, r) => sum + r.paidAmount, 0);
    const confirmedPaid = rows.filter(r => r.confirmed).reduce((sum, r) => sum + r.paidAmount, 0);

    let expected: number, paidForKpi: number, debt: number, isFull: boolean;

    if (ti) {
      // TIMI Invest (çfarëdo statusi): vetëm pagesa REALE e KONFIRMUARA e
      // ul borxhin — çmimi i tyre specifik, jo standardi i kategorisë.
      const { finalAmount } = hasAnyPayment ? aggregatePaymentTotals(rows) : { finalAmount: 0 };
      expected = hasAnyPayment ? finalAmount : computeTiExpectedPrice(ti);
      paidForKpi = confirmedPaid;
      debt = Math.max(0, expected - confirmedPaid);
      isFull = confirmedPaid > 0 && debt <= 0;
      if (isFull) full.push(toRow(s, confirmedPaid));
      else if (confirmedPaid > 0) tiPartial.push(toRow(s, debt));
      else tiUnpaid.push(toRow(s, debt));
    } else {
      const { finalAmount, balance } = hasAnyPayment ? aggregatePaymentTotals(rows) : { finalAmount: Math.round(shkollimiCategory.defaultAmount * (1 - (s.discountPct ?? 0) / 100)), balance: 0 };
      expected = finalAmount;
      debt = hasAnyPayment ? balance : expected;
      paidForKpi = confirmedPaid;
      isFull = hasAnyPayment && balance <= 0;
      if (!hasAnyPayment) { zero.push(toRow(s, debt)); noPaymentNoTi.push(toRow(s, debt)); }
      else if (isFull) full.push(toRow(s, confirmedPaid));
      else if (rawPaid > 0) partial.push(toRow(s, debt));
      else zero.push(toRow(s, debt));
    }

    kpiExpected += expected;
    kpiPaid += paidForKpi;
    kpiDebt += debt;

    const priceKey = Math.round(expected);
    const g = priceGroupMap.get(priceKey) ?? { count: 0, total: 0 };
    g.count += 1;
    g.total += expected;
    priceGroupMap.set(priceKey, g);

    if (hasAnyPayment && !s.paymentPlan) missingPlan.push(toRow(s, expected));
    if (rawPaid > expected + 0.5) overpaid.push(toRow(s, rawPaid - expected));
  }

  const handedOver = handoverAgg._sum.amount ?? 0;

  const expenseLinesMap = new Map<string, number>();
  for (const e of expenseRows) {
    const key = e.kategori.emri;
    expenseLinesMap.set(key, (expenseLinesMap.get(key) ?? 0) + e.shuma);
  }
  const expenseLines = Array.from(expenseLinesMap.entries())
    .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);
  const totalExpenses = expenseLines.reduce((s, e) => s + e.amount, 0);

  const otherIncome = hyraAgg._sum.shuma ?? 0;
  const totalIncome = kpiPaid + otherIncome;
  const profit = Math.round((totalIncome - totalExpenses) * 100) / 100;

  const byAmountDesc = (a: Row, b: Row) => b.amount - a.amount;
  const bucket = (rows: Row[]) => ({ count: rows.length, amount: Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100, students: rows.sort(byAmountDesc) });

  const handoverGap = Math.round((kpiPaid - handedOver) * 100) / 100;

  return NextResponse.json({
    period: { year, yearType, label },
    kpi: {
      expected: Math.round(kpiExpected * 100) / 100,
      paid: Math.round(kpiPaid * 100) / 100,
      expenses: totalExpenses,
      handedOver: Math.round(handedOver * 100) / 100,
      debt: Math.round(kpiDebt * 100) / 100,
      totalStudents: activeStudents.length,
    },
    statusBuckets: {
      full: bucket(full),
      partial: bucket(partial),
      tiUnpaid: bucket(tiUnpaid),
      tiPartial: bucket(tiPartial),
      zero: bucket(zero),
    },
    priceGroups: Array.from(priceGroupMap.entries())
      .map(([price, g]) => ({ price, count: g.count, total: Math.round(g.total * 100) / 100 }))
      .sort((a, b) => b.price - a.price),
    incomeStatement: {
      tuitionIncome: Math.round(kpiPaid * 100) / 100,
      otherIncome: Math.round(otherIncome * 100) / 100,
      totalIncome: Math.round(totalIncome * 100) / 100,
      expenseLines,
      totalExpenses,
      profit,
    },
    anomalies: {
      noPaymentNoTi: bucket(noPaymentNoTi),
      missingPlan: bucket(missingPlan),
      overpaid: bucket(overpaid),
      handoverGap,
    },
  });
}
