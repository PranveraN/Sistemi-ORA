import { prisma } from "@/lib/prisma";
import { getDateRange, getAcademicMonths, type YearType } from "@/lib/academicYear";
import { aggregatePaymentTotals } from "@/lib/paymentAggregate";
import { computeTiExpectedPrice } from "@/lib/timiInvestPricing";
import { expensePeriodWhere } from "@/lib/expensePeriod";
import { computeCashFlow, paymentChannel, toCents } from "@/lib/cashFlow";
import { loadShkollimiExpenses } from "@/lib/shkollimiExpenses";

interface Row { studentId: number; name: string; className: string | null; phone: string; amount: number }

// Pasqyra e plotë financiare e Shkollimit (Dashboard → "Përmbledhje") — E RE,
// e ndarë krejtësisht nga /api/dashboard/tuition-groups dhe /api/category-payments,
// por ndjek TË NJËJTIN rregull financiar bazë të rifreskuar (2026-09-25):
// asnjë status TIMI Invest s'e përjashton vetvetiu dikë nga borxhi — vetëm
// pagesë REALE e konfirmuar manualisht e bën këtë. Klientë TI pa asnjë pagesë
// (ose pa konfirmim) marrin çmimin e TYRE specifik si borxh, jo standardin
// e kategorisë.
export type ShkollimiOverview = NonNullable<Awaited<ReturnType<typeof computeShkollimiOverview>>>;

/** null = kategoria "Shkollimi" s'ekziston. Përdoret nga GET i pasqyrës dhe nga "Numëro arkën". */
export async function computeShkollimiOverview(orgId: number, year: number, yearType: YearType) {
  const { start, end, label } = getDateRange(year, yearType);
  const months = yearType === "academic"
    ? getAcademicMonths(year)
    : Array.from({ length: 12 }, (_, i) => ({ calMonth: i + 1, calYear: year }));

  const shkollimiCategory = await prisma.paymentCategory.findFirst({ where: { name: "Shkollimi", organizationId: orgId } });
  if (!shkollimiCategory) {
    return null;
  }

  const tuitionWhere = yearType === "academic"
    ? { organizationId: orgId, categoryId: shkollimiCategory.id, OR: months.map(m => ({ month: m.calMonth, year: m.calYear })) }
    : { organizationId: orgId, categoryId: shkollimiCategory.id, dueDate: { gte: start, lte: end } };
  const hyraWhere: Record<string, unknown> = {};
  if (yearType === "academic") hyraWhere.OR = months.map(m => ({ muaj: m.calMonth, vit: m.calYear }));
  else { hyraWhere.vit = year; }

  const [activeStudents, tuitionRows, timiInvestLinks, handoverAgg, expenseRows, hyraAgg, shkExpenses, lastCount] = await Promise.all([
    // Vetëm nxënësit REALISHT aktivë TANI (status="ACTIVE") — jo "aktivë
    // gjatë periudhës" (që përfshinte edhe dikë të larguar tashmë këtë vit).
    // I njëjti rregull si "Nxënës Aktivë"/"Nxënës Aktualë" te /api/dashboard
    // (2026-09-28: kërkuar shprehimisht — "Total i Pritur" s'duhet të presë
    // pagesë nga dikush që tashmë e ka lëshuar shkollën).
    prisma.student.findMany({
      where: {
        organizationId: orgId,
        status: "ACTIVE",
      },
      select: {
        id: true, firstName: true, lastName: true, discountPct: true, paymentPlan: true,
        class: { select: { name: true } },
        parentPhone: true, fatherPhone: true, motherPhone: true,
      },
    }),
    prisma.payment.findMany({
      where: tuitionWhere,
      select: { studentId: true, finalAmount: true, paidAmount: true, confirmed: true, description: true, method: true },
    }),
    prisma.timiInvestStudent.findMany({
      where: { active: true, studentId: { not: null } },
      select: { studentId: true, regularPrice: true, discountPct: true, manualDiscAmt: true },
    }),
    // Shuma e dorëzuar — burimi është TANI Expense.type="HANDOVER" (jo
    // PaymentHandover), pikërisht e njëjta tabelë që lexon skeda "Dorëzim
    // Parash" brenda faqes së Shkollimit dhe "Pasqyra e Arkës" e saj — që
    // kjo kartë të përputhet GJITHMONË me atë që shihet vetë te faqja e
    // Shkollimit (2026-09-28: më parë lexonte PaymentHandover, një tabelë
    // krejt tjetër, e mbushur vetëm nga faqja e veçantë "/dorëzimet", ndaj
    // dilte gjithmonë 0,00 € këtu edhe kur dorëzimet ishin regjistruar
    // rregullisht te faqja e Shkollimit). Filtri (muaj/vit, me OR-in që
    // kapërcen dy vite kalendarike për vit akademik) është i njëjti që
    // përdor /api/expenses dhe /api/category-payments.
    prisma.expense.aggregate({
      where: {
        categoryId: shkollimiCategory.id,
        type: "HANDOVER",
        ...expensePeriodWhere(0, year, yearType),
      },
      _sum: { amount: true },
    }),
    prisma.shpenzim.findMany({
      where: { data: { gte: start, lte: end }, paguar: true },
      include: { kategori: { select: { emri: true } } },
    }),
    prisma.hyra.aggregate({ where: hyraWhere, _sum: { shuma: true } }),
    // "Shpenzuar nga arka" — shpenzimet e modulit "Shpenzimet" (+ ato të vjetra
    // të skedës së Shkollimit), vetëm të paguarat me Cash. E njëjta llogaritje
    // si "Pasqyra e Arkës" te faqja e Shkollimit (src/lib/shkollimiExpenses.ts).
    loadShkollimiExpenses(shkollimiCategory.id, 0, year, yearType),
    prisma.cashCount.findFirst({ where: { organizationId: orgId, yearLabel: label }, orderBy: { createdAt: "desc" } }),
  ]);

  const tiById = new Map(timiInvestLinks.map(t => [t.studentId as number, t]));
  const rowsByStudent = new Map<number, { finalAmount: number; paidAmount: number; confirmed: boolean; description: string | null; method: string | null }[]>();
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
  // E njëjta popullsi si "Paguar" (nxënës aktivë, pagesa të konfirmuara), e ndarë sipas metodës — në cent
  let cashC = 0, bankC = 0, noMethodC = 0, noMethodCount = 0;
  const full: Row[] = [], partial: Row[] = [], tiUnpaid: Row[] = [], tiPartial: Row[] = [], zero: Row[] = [];
  // Shuma e KONFIRMUAR e paguar për secilin grup — e ndarë nga `amount` te
  // vetë rreshtat (aty mban BORXHIN e mbetur, jo çka është paguar) — që
  // "Pagesat dhe Statusi" (paguara) dhe "Detajet e Borxheve" (borxhi) të mos
  // përzihen, siç ndodhte më parë (shih diskutimin: 7.130€ vs 7.030€).
  let fullPaid = 0, partialPaid = 0, tiPartialPaid = 0;
  const priceGroupMap = new Map<number, { count: number; total: number }>();
  const missingPlan: Row[] = [], overpaid: Row[] = [], noPaymentNoTi: Row[] = [];

  for (const s of activeStudents) {
    const rows = rowsByStudent.get(s.id) ?? [];
    const ti = tiById.get(s.id);
    const hasAnyPayment = rows.length > 0;
    const rawPaid = rows.reduce((sum, r) => sum + r.paidAmount, 0);
    const confirmedPaid = rows.filter(r => r.confirmed).reduce((sum, r) => sum + r.paidAmount, 0);
    for (const r of rows) {
      if (!r.confirmed || r.paidAmount <= 0) continue;
      const ch = paymentChannel(r.method);
      if (ch === "cash") cashC += toCents(r.paidAmount);
      else if (ch === "banke") bankC += toCents(r.paidAmount);
      else { noMethodC += toCents(r.paidAmount); noMethodCount++; }
    }

    let expected: number, paidForKpi: number, debt: number, isFull: boolean;

    if (ti) {
      // TIMI Invest (çfarëdo statusi): vetëm pagesa REALE e KONFIRMUARA e
      // ul borxhin — çmimi i tyre specifik, jo standardi i kategorisë.
      const { finalAmount } = hasAnyPayment ? aggregatePaymentTotals(rows) : { finalAmount: 0 };
      expected = hasAnyPayment ? finalAmount : computeTiExpectedPrice(ti);
      paidForKpi = confirmedPaid;
      debt = Math.max(0, expected - confirmedPaid);
      isFull = confirmedPaid > 0 && debt <= 0;
      if (isFull) { full.push(toRow(s, debt)); fullPaid += confirmedPaid; }
      else if (confirmedPaid > 0) { tiPartial.push(toRow(s, debt)); tiPartialPaid += confirmedPaid; }
      else tiUnpaid.push(toRow(s, debt));
    } else {
      const { finalAmount, balance } = hasAnyPayment ? aggregatePaymentTotals(rows) : { finalAmount: Math.round(shkollimiCategory.defaultAmount * (1 - (s.discountPct ?? 0) / 100)), balance: 0 };
      expected = finalAmount;
      debt = hasAnyPayment ? balance : expected;
      paidForKpi = confirmedPaid;
      isFull = hasAnyPayment && balance <= 0;
      if (!hasAnyPayment) { zero.push(toRow(s, debt)); noPaymentNoTi.push(toRow(s, debt)); }
      else if (isFull) { full.push(toRow(s, debt)); fullPaid += confirmedPaid; }
      else if (rawPaid > 0) { partial.push(toRow(s, debt)); partialPaid += confirmedPaid; }
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
  // E njëjta listë si skeda "Shpenzime" e Shkollimit: vetëm të paguarat (cash + bankë)
  for (const e of shkExpenses.rows) {
    if (!e.paid) continue;
    const key = e.category ?? "Shpenzime të tjera";
    expenseLinesMap.set(key, (expenseLinesMap.get(key) ?? 0) + e.amount);
  }
  const expenseLines = Array.from(expenseLinesMap.entries())
    .map(([name, amount]) => ({ name, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => b.amount - a.amount);
  const totalExpenses = expenseLines.reduce((s, e) => s + e.amount, 0);

  const otherIncome = hyraAgg._sum.shuma ?? 0;
  const totalIncome = kpiPaid + otherIncome;
  const profit = Math.round((totalIncome - totalExpenses) * 100) / 100;

  const byAmountDesc = (a: Row, b: Row) => b.amount - a.amount;
  // `amount` (te rreshtat/students) mban BORXHIN e mbetur — përdoret nga
  // "Detajet e Borxheve". `paidAmount` (parametër i veçantë këtu) mban shumën
  // e KONFIRMUAR të paguar nga i gjithë grupi — përdoret nga "Pagesat dhe
  // Statusi", që totali i asaj tabele të përputhet me kartën KPI "Total i Paguar".
  const bucket = (rows: Row[], paidAmount = 0) => ({
    count: rows.length,
    amount: Math.round(rows.reduce((s, r) => s + r.amount, 0) * 100) / 100,
    paidAmount: Math.round(paidAmount * 100) / 100,
    students: rows.sort(byAmountDesc),
  });

  const handoverGap = Math.round((kpiPaid - handedOver) * 100) / 100;

  const expensesCashC = toCents(shkExpenses.totals.cash);
  const cashFlow = computeCashFlow({
    cashCents: cashC, bankCents: bankC, noMethodCents: noMethodC, noMethodCount,
    expensesCashCents: expensesCashC, handedOverCents: toCents(handedOver),
  });

  return {
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
      full: bucket(full, fullPaid),
      partial: bucket(partial, partialPaid),
      tiUnpaid: bucket(tiUnpaid),
      tiPartial: bucket(tiPartial, tiPartialPaid),
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
    cashFlow,
    lastCashCount: lastCount && {
      at: lastCount.createdAt, counted: lastCount.countedAmount, system: lastCount.systemAmount,
      difference: lastCount.difference, userName: lastCount.userName,
    },
    anomalies: {
      noPaymentNoTi: bucket(noPaymentNoTi),
      missingPlan: bucket(missingPlan),
      overpaid: bucket(overpaid),
      handoverGap,
    },
  };
}

