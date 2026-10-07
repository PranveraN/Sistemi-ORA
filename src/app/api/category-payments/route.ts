import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { aggregatePaymentTotals } from "@/lib/paymentAggregate";
import { computeTiExpectedPrice } from "@/lib/timiInvestPricing";
import { expensePeriodWhere, expensePeriodWhereByDate } from "@/lib/expensePeriod";
import type { YearType } from "@/lib/academicYear";
import { loadShkollimiExpenses, loadOtherCashIncome, loadCashInvestments } from "@/lib/shkollimiExpenses";
import { paymentChannel } from "@/lib/cashFlow";

type PrismaPayment = {
  id: number;
  amount: number;
  finalAmount: number;
  paidAmount: number;
  balance: number;
  status: string;
  method: string | null;
  dueDate: Date;
  paidDate: Date | null;
  discount: number;
  discountType: string | null;
  scholarship: number;
  description: string | null;
  note: string | null;
  month: number;
  year: number;
};

function aggregateStatus(payments: PrismaPayment[]): string {
  if (!payments.length) return "PENDING";
  const { finalAmount: totalFinal, paidAmount: totalPaid } = aggregatePaymentTotals(payments);
  if (totalFinal > 0 && totalPaid >= totalFinal) return "PAID";
  if (totalPaid > 0) return "PARTIAL";
  const now = new Date();
  if (payments.some(p => new Date(p.dueDate) < now && p.paidAmount === 0)) return "OVERDUE";
  return "PENDING";
}

// Investim (kapitale/të përkohshme) s'ka fare `categoryId` — janë gjithmonë
// shkollore, jo për një kategori pagese specifike — ndaj përfshihen kudo që
// shfaqet "Pasqyra e Arkës" (jo vetëm Shkollimi), por respektojnë të njëjtën
// periudhë (muaj/vit) si Shpenzimet/Dorëzimet, mbi fushën reale `data`.
function investimDateWhere(month: number, year: number, yearType: YearType): Record<string, unknown> {
  if (month > 0 && year > 0) {
    return { data: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) } };
  }
  if (year > 0) {
    if (yearType === "academic") {
      return { data: { gte: new Date(year, 8, 1), lt: new Date(year + 1, 8, 1) } };
    }
    return { data: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } };
  }
  return {};
}

function aggregatePayment(payments: PrismaPayment[]): PrismaPayment | null {
  if (!payments.length) return null;
  if (payments.length === 1) return payments[0];
  const { finalAmount: totalFinal, paidAmount: totalPaid, balance } = aggregatePaymentTotals(payments);
  return {
    ...payments[0],
    finalAmount: totalFinal,
    paidAmount:  totalPaid,
    balance,
    status: aggregateStatus(payments),
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const categoryName = searchParams.get("category") || "";
  const monthParam   = searchParams.get("month");
  const yearParam    = searchParams.get("year");
  const yearType     = (searchParams.get("yearType") || "calendar") as YearType; // "academic" = Shtator–Gusht (dy vite kalendarike)
  const month  = monthParam  ? parseInt(monthParam)  : null;  // null = all months
  const year   = yearParam   ? parseInt(yearParam)   : null;  // null = all years
  const search  = searchParams.get("search")  || "";
  const classId = searchParams.get("classId") || "";

  let category = await prisma.paymentCategory.findFirst({
    where: { name: { equals: categoryName } },
  });
  if (!category) {
    category = await prisma.paymentCategory.create({
      data: { name: categoryName, type: "one-time", defaultAmount: 0 },
    });
  }

  const where: Record<string, unknown> = { status: { in: ["ACTIVE", "INACTIVE"] } };
  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName:  { contains: search } },
    ];
  }
  if (classId) where.classId = parseInt(classId);

  // Build payment filter — skip month/year when null (= "Të gjitha")
  const paymentFilter: Record<string, unknown> = { categoryId: category.id };
  if (month && month > 0) {
    paymentFilter.month = month;
    if (year && year > 0) paymentFilter.year = year;
  } else if (year && year > 0) {
    // "Të gjitha" muajt + vit akademik → "year" është viti fillestar (Shtator), spanon dy vite kalendarike
    if (yearType === "academic") {
      paymentFilter.OR = [
        { month: { gte: 9 }, year },
        { month: { lte: 8 }, year: year + 1 },
      ];
    } else {
      // Kalendarik "Të gjitha" → grupohet sipas datës REALE të arkëtimit (paidDate),
      // jo sipas Afatit (fusha month/year, gjithmonë e rrjedhur nga dueDate) — që
      // pasqyron saktë sa para hynë brenda vitit kalendarik X, jo për cilin muaj
      // shkollimi ishin. Pagesat ende PA u paguar (paidDate=null) s'kanë ende
      // "datë arkëtimi", ndaj bien mbrapsht te Afati i tyre.
      const yStart = new Date(Date.UTC(year, 0, 1));
      const yEnd   = new Date(Date.UTC(year + 1, 0, 1));
      paymentFilter.OR = [
        { paidDate: { gte: yStart, lt: yEnd } },
        { paidDate: null, dueDate: { gte: yStart, lt: yEnd } },
      ];
    }
  }

  // When filtering broadly (all months or all years), fetch more records per student.
  // NUK e ulim dot te 2 për pamjen e ngushtë (muaj+vit specifik) — ai supozim
  // ("max 2 pagesa për student në (muaj,vit)") vlen VETËM për planin "Dy Këste";
  // plani "Fleksibël" mund të krijojë 1 FLEX_HEADER + N FLEX_PAY_k në të NJËJTIN
  // muaj (p.sh. familja paguan në 3 këste brenda po atij muaji) — me take:2,
  // këstet shtesë injoroheshin nga llogaritja e borxhit/statusit (defekt i
  // raportuar: borxh/status i gabuar edhe kur pagesa reale ishte e plotë).
  const isNarrow = (month && month > 0) && (year && year > 0);
  const takeLimit = isNarrow ? 20 : 60;

  const [students, allTiRows, inactiveDates, oldDebtRows, handoverAgg, expenseAgg, investimAgg] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        payments: {
          where: paymentFilter,
          orderBy: { createdAt: "asc" },
          take: takeLimit,
          select: {
            id: true, amount: true, finalAmount: true, paidAmount: true,
            balance: true, status: true, method: true, dueDate: true,
            paidDate: true, discount: true, discountType: true,
            scholarship: true, description: true, note: true, receiptNumber: true,
            month: true, year: true, confirmed: true,
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.$queryRawUnsafe<{ id: number; studentId: number | null; firstName: string; lastName: string; regularPrice: number; discountPct: number; manualDiscAmt: number; stage: string }[]>(
      `SELECT id, studentId, firstName, lastName, regularPrice, discountPct, manualDiscAmt, stage FROM TimiInvestStudent WHERE active = 1`
    ),
    prisma.$queryRawUnsafe<{ id: number; inactiveDate: string | null }[]>(
      `SELECT id, inactiveDate FROM Student WHERE status = 'INACTIVE'`
    ),
    // Borxhi i vjetër (i importuar) — pavarësisht filtrit të vitit të zgjedhur në faqe,
    // që të mbetet dukshëm derisa të shlyhet plotësisht. Ruhet `id`-ja e vetë pagesës
    // (jo vetëm shuma) që të mund të modifikohet/fshihet direkt nga badge-i.
    prisma.payment.findMany({
      where: { categoryId: category.id, description: "BORXH_VJETER", balance: { gt: 0 } },
      select: { id: true, studentId: true, finalAmount: true, paidAmount: true, balance: true, note: true },
    }),
    // Shuma e dorëzuar (Expense.type="HANDOVER") — përdor SAKTËSISHT të njëjtin filtër
    // (muaj/vit, me OR-in që kapërcen dy vite kalendarike për "Të gjitha + Vit
    // Akademik") si /api/expenses, që numri këtu të përputhet gjithmonë me "Total
    // Dorëzuar" të skedës "Dorezim Parash" të kësaj faqeje.
    prisma.expense.aggregate({
      where: {
        categoryId: category.id,
        type: "HANDOVER",
        ...(categoryName === "Shkollimi" ? expensePeriodWhereByDate : expensePeriodWhere)(month ?? 0, year ?? 0, yearType),
      },
      _sum: { amount: true },
    }),
    // Shpenzimet (Expense.type="EXPENSE") — i njëjti filtër, që të përputhet me
    // "Total Shpenzuar" të skedës "Shpenzime" (p.sh. Ushqimi).
    prisma.expense.aggregate({
      where: {
        categoryId: category.id,
        type: "EXPENSE",
        ...(categoryName === "Shkollimi" ? expensePeriodWhereByDate : expensePeriodWhere)(month ?? 0, year ?? 0, yearType),
      },
      _sum: { amount: true },
    }),
    // Investimet — shih komentin te `investimDateWhere` (s'ka categoryId, ndaj
    // përfshihen kudo, jo vetëm te Shkollimi).
    prisma.investim.aggregate({
      where: investimDateWhere(month ?? 0, year ?? 0, yearType),
      _sum: { vlera: true },
    }),
  ]);
  const oldDebtMap = new Map(oldDebtRows.map(r => [r.studentId, {
    id: r.id, finalAmount: r.finalAmount, paidAmount: r.paidAmount, balance: r.balance, note: r.note,
  }]));
  const handedOver = handoverAgg._sum.amount ?? 0;
  const totalExpenses = expenseAgg._sum.amount ?? 0;
  const totalInvestments = investimAgg._sum.vlera ?? 0;

  // Harta e TIMI Invest (sipas studentId dhe emrit, si rezervë) — përdoret për
  // badge-in informativ "TI" te rreshti i nxënësit, DHE (poshtë) për të
  // imputuar çmimin e TYRE specifik si borxh kur s'ka asnjë pagesë reale.
  // Rregull financiar: asnjë status TIMI Invest (as "E Kryer") s'e përjashton
  // më vetvetiu dikë nga borxhi — vetëm një pagesë REALE e konfirmuar e bën këtë.
  const tiByStudentId = new Map<number, { id: number; regularPrice: number; discountPct: number; manualDiscAmt: number }>();
  const tiByName      = new Map<string, { id: number; regularPrice: number; discountPct: number; manualDiscAmt: number }>();
  for (const ti of allTiRows) {
    const val = { id: Number(ti.id), regularPrice: Number(ti.regularPrice), discountPct: Number(ti.discountPct), manualDiscAmt: Number(ti.manualDiscAmt) };
    const nameKey = `${String(ti.firstName).trim().toLowerCase()}|${String(ti.lastName).trim().toLowerCase()}`;
    if (ti.studentId) tiByStudentId.set(Number(ti.studentId), val);
    else tiByName.set(nameKey, val);
  }

  // Ndaj ACTIVE nga INACTIVE
  const activeStudents   = students.filter(s => s.status === "ACTIVE");
  const inactiveStudents = students.filter(s => s.status === "INACTIVE");

  const statuses = activeStudents.map(s => aggregateStatus(s.payments as PrismaPayment[]));

  // Rregull financiar (vetëm Shkollimi): shumat "pa konfirmuar" (import ose
  // TIMI Invest — shih Payment.confirmed) s'llogariten si "Të Hyra" reale.
  // Kategoritë e tjera vazhdojnë të mbledhin çdo paidAmount, siç ishte gjithmonë.
  const totalRevenue = activeStudents.reduce(
    (sum, s) => sum + s.payments.reduce((ps, p) => ps + (categoryName === "Shkollimi" && !p.confirmed ? 0 : p.paidAmount), 0), 0
  );
  // Shkollimi: arka e saktë — të hyrat sipas metodës (Cash / Bankë / pa metodë) dhe
  // shpenzimet e modulit "Shpenzimet" (vetëm të paguarat; Cash → nga arka). E
  // njëjta formulë si dashboard-i ("Ku janë paratë e paguara").
  let cashRevenue = 0, bankRevenue = 0, noMethodRevenue = 0;
  let shk: Awaited<ReturnType<typeof loadShkollimiExpenses>>["totals"] | null = null;
  let otherCash = 0, investmentsCash = 0;
  if (categoryName === "Shkollimi") {
    for (const s of activeStudents) for (const p of s.payments) {
      if (!p.confirmed || p.paidAmount <= 0) continue;
      const ch = paymentChannel(p.method);
      if (ch === "cash") cashRevenue += p.paidAmount; else if (ch === "banke") bankRevenue += p.paidAmount; else noMethodRevenue += p.paidAmount;
    }
    shk = (await loadShkollimiExpenses(category.id, month ?? 0, year ?? 0, yearType)).totals;
    otherCash = (await loadOtherCashIncome(month ?? 0, year ?? 0, yearType)).cash;
    investmentsCash = (await loadCashInvestments(month ?? 0, year ?? 0, yearType)).cash;
  }

  const totalDebt = activeStudents.reduce((sum, s) => {
    const agg = aggregatePayment(s.payments as PrismaPayment[]);
    if (agg) return sum + (agg.balance || 0);
    // Pa asnjë pagesë të regjistruar fare — borxhi imputohet plotësisht.
    // Nxënës të TIMI Invest (çfarëdo statusi) marrin çmimin E TYRE specifik
    // (rënë dakord me TI), të tjerët çmimin standard të kategorisë.
    const ti = tiByStudentId.get(s.id) ?? tiByName.get(`${s.firstName.trim().toLowerCase()}|${s.lastName.trim().toLowerCase()}`);
    const expectedPrice = ti
      ? Math.round(computeTiExpectedPrice(ti))
      : Math.round(category.defaultAmount * (1 - (s.discountPct ?? 0) / 100));
    return sum + expectedPrice;
  }, 0);

  // Mapa e inactiveDate nga raw SQL
  const inactiveDateMap = new Map<number, string | null>();
  for (const row of inactiveDates) {
    inactiveDateMap.set(Number(row.id), row.inactiveDate ?? null);
  }

  const mapStudent = (s: typeof students[0]) => {
    const tiDirect = tiByStudentId.get(s.id);
    const tiName   = !tiDirect ? tiByName.get(`${s.firstName.trim().toLowerCase()}|${s.lastName.trim().toLowerCase()}`) : undefined;
    return {
      id:           s.id,
      firstName:    s.firstName,
      lastName:     s.lastName,
      parentName:   s.parentName,
      parentPhone:  s.parentPhone,
      fatherPhone:  s.fatherPhone,
      motherPhone:  s.motherPhone,
      address:      s.address,
      class:        s.class,
      discountPct:  s.discountPct,
      paymentPlan:  s.paymentPlan,
      status:       s.status,
      inactiveDate: inactiveDateMap.get(s.id) ?? null,
      payment:      aggregatePayment(s.payments as PrismaPayment[]),
      installments: s.payments,
      timiInvest:   tiDirect ?? tiName ?? null,
      oldDebt:      oldDebtMap.get(s.id) ?? null,
    };
  };

  return NextResponse.json({
    category,
    students: [
      ...activeStudents.map(mapStudent),
      ...inactiveStudents.map(mapStudent),
    ],
    stats: {
      total:    activeStudents.length,
      paid:     statuses.filter(st => st === "PAID").length,
      partial:  statuses.filter(st => st === "PARTIAL").length,
      overdue:  statuses.filter(st => st === "OVERDUE").length,
      pending:  statuses.filter(st => st === "PENDING").length,
      totalRevenue,
      totalDebt,
      handedOver,
      totalExpenses: shk ? shk.cash : totalExpenses,
      totalInvestments,
      ...(shk ? {
        cashBox: {
          cash: Math.round(cashRevenue * 100) / 100,
          bank: Math.round(bankRevenue * 100) / 100,
          noMethod: Math.round(noMethodRevenue * 100) / 100,
          expensesCash: shk.cash, expensesBank: shk.bank, expensesUnpaid: shk.unpaid,
          otherCash, investmentsCash, expensesUshqimi: shk.ushqimi, legacyPending: shk.legacyPending,
        },
      } : {}),
    },
  });
}
