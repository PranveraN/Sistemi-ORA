import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCycle } from "@/lib/school-cycles";
import { getDateRange, getAcademicMonths, DEFAULT_ACADEMIC_YEAR, type YearType } from "@/lib/academicYear";
import { aggregatePaymentTotals } from "@/lib/paymentAggregate";
import { computeTiExpectedPrice } from "@/lib/timiInvestPricing";

type PeriodMonth = { calMonth: number; calYear: number };

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const { searchParams } = new URL(req.url);
  const year     = parseInt(searchParams.get("year") || String(DEFAULT_ACADEMIC_YEAR));
  const yearType = (searchParams.get("yearType") || "academic") as YearType;

  const now = new Date();
  const { start, end, label } = getDateRange(year, yearType);
  // Periudha ekuivalente PARAARDHËSE (një vit mbrapa) — për krahasimin %.
  const { start: prevStart, end: prevEnd } = getDateRange(year - 1, yearType);

  const months = yearType === "academic"
    ? getAcademicMonths(year)
    : Array.from({ length: 12 }, (_, i) => ({ calMonth: i + 1, calYear: year }));
  const prevMonths = yearType === "academic"
    ? getAcademicMonths(year - 1)
    : Array.from({ length: 12 }, (_, i) => ({ calMonth: i + 1, calYear: year - 1 }));

  // "Vonuar" — kufizohet te vetëm afatet BRENDA periudhës që tashmë kanë kaluar
  // (min i fundit të periudhës dhe "tani", që një vit i ardhshëm/aktual mos
  // numërojë afate që ende s'kanë ardhur).
  const overdueUpperBound = end < now ? end : now;

  // ── Periudha PËR REGJISTRIM NXËNËSISH (jo për pagesa/financa!) — fillon më
  // 1 QERSHOR, jo 1 Shtator. Regjistrimet e verës (Qershor–Gusht) janë
  // GJITHMONË për vitin PASARDHËS (askush s'regjistrohet "vonë" në vitin që
  // sapo mbylli mësimin) — ndryshe nga pagesat, ku 1 Shtator mbetet kufiri i
  // saktë (bazuar te Afati i vetë pagesës, shih CategoryPaymentPage/Bilanci) —
  // atje zhvendosja do të krijonte numërim DYFISHTË (Qershor-Gusht do të
  // binte njëkohësisht te viti që mbyllet DHE te ai që fillon). Për nxënës
  // s'ka këtë rrezik: një regjistrim bie në një vit të vetëm, kurrë në dy.
  const studentPeriodStart = yearType === "academic" ? new Date(year, 5, 1) : start;
  const studentPeriodEnd   = yearType === "academic" ? new Date(year + 1, 4, 31, 23, 59, 59) : end;

  // ── Nxënës të Rinj (kartë Dashboard) — E NJËJTA periudhë si `newInPeriod`
  // më poshtë, që numrat e të dyja vendeve të përputhen gjithmonë. Kur mbaron
  // viti shkollor aktual dhe admin kalon te viti tjetër (ose default-i i
  // faqes përditësohet, shih DEFAULT_ACADEMIC_YEAR), lista rinovohet vetvetiu.
  const newStudentsList = await prisma.student.findMany({
    where: {
      organizationId: orgId, status: "ACTIVE", enrollDate: { gte: studentPeriodStart, lte: studentPeriodEnd },
      hideFromNewRegistrations: false, // hequr manualisht nga admin — shih NewStudentsCard.tsx
    },
    select: {
      id: true, firstName: true, lastName: true, originCountry: true, enrollDate: true,
      previousSchool: true, transferResult: true, admissionScore: true, studentRating: true,
      class: { select: { name: true } },
    },
    orderBy: { enrollDate: "desc" },
  });

  // ── Nxënës të Larguar (kartë Dashboard, krah "Nxënës të Rinj") — e njëjta
  // periudhë (inactiveDate brenda start/end), që të dyja kartat lëvizin
  // bashkë me zgjedhësin e vitit sipër.
  const departedStudentsList = await prisma.student.findMany({
    where: {
      organizationId: orgId, status: "INACTIVE", inactiveDate: { gte: start, lte: end },
      hideFromDeparted: false, // hequr manualisht nga admin — shih DepartedStudentsCard.tsx
    },
    select: {
      id: true, firstName: true, lastName: true, leaveReason: true,
      destinationSchool: true, inactiveDate: true, class: { select: { name: true } },
    },
    orderBy: { inactiveDate: "desc" },
  });

  // ── Pasqyrë Shkollimi (për "Pasqyrë Shkollimi" te Dashboard, dhe tani edhe
  // për kartat KPI "Të Hyra"/"Borxhe", të cilat u kufizuan VETËM te Shkollimi) ──
  const shkollimiCategory = await prisma.paymentCategory.findFirst({ where: { name: "Shkollimi", organizationId: orgId } });
  const tuitionAccrualWhere = shkollimiCategory ? (
    yearType === "academic"
      ? { organizationId: orgId, categoryId: shkollimiCategory.id, OR: months.map(m => ({ month: m.calMonth, year: m.calYear })) }
      : { organizationId: orgId, categoryId: shkollimiCategory.id, dueDate: { gte: start, lte: end } }
  ) : null;
  const prevTuitionAccrualWhere = shkollimiCategory ? (
    yearType === "academic"
      ? { organizationId: orgId, categoryId: shkollimiCategory.id, OR: prevMonths.map(m => ({ month: m.calMonth, year: m.calYear })) }
      : { organizationId: orgId, categoryId: shkollimiCategory.id, dueDate: { gte: prevStart, lte: prevEnd } }
  ) : null;

  const [
    totalStudents,
    activeInPeriod,
    recentPayments,
    overdueRows,
    newInPeriod,
    timiInvestLinks,
    tuitionRows,
    prevTuitionRows,
  ] = await Promise.all([
    prisma.student.count({ where: { organizationId: orgId } }),

    // Nxënës "aktivë gjatë periudhës" — regjistruar para mbarimit të periudhës
    // dhe (s'është bërë ende joaktiv OSE u bë joaktiv brenda/pas fillimit të
    // periudhës) — kështu për vitin AKTUAL përputhet me `status: "ACTIVE"" e
    // sotme, por për një vit të kaluar pasqyron realisht kush ishte aktiv
    // atëherë. E NJËJTA logjikë përdoret te faqja e Nxënësve ("Aktivë"), që
    // numrat e dy faqeve të përputhen për të njëjtin vit.
    prisma.student.findMany({
      where: {
        organizationId: orgId,
        enrollDate: { lte: end },
        OR: [{ inactiveDate: null }, { inactiveDate: { gte: start } }],
      },
      select: { id: true, discountPct: true, class: { select: { name: true } } },
    }),

    prisma.payment.findMany({
      where: { organizationId: orgId, paidDate: { gte: start, lte: end } },
      orderBy: { paidDate: "desc" },
      take: 8,
      include: {
        student: { select: { firstName: true, lastName: true } },
        category: { select: { name: true } },
      },
    }),

    // Rreshtat e pagesave të vonuara — për t'i ndarë sipas NXËNËSIT (jo
    // rresht-pagese) në kartën KPI: "vonuar pjesa e dytë" (ka paguar diçka
    // për atë këst, mbetet pjesa) kundrejt "vonuar pagesa e plotë" (s'ka
    // paguar asgjë fare për atë këst).
    prisma.payment.findMany({
      where: { organizationId: orgId, balance: { gt: 0 }, dueDate: { gte: start, lte: overdueUpperBound } },
      select: { studentId: true, paidAmount: true },
    }),

    prisma.student.count({ where: { organizationId: orgId, enrollDate: { gte: studentPeriodStart, lte: studentPeriodEnd }, hideFromNewRegistrations: false } }),

    // TË GJITHË klientët aktivë të TIMI Invest, çfarëdo statusi (jo vetëm "E
    // Kryer") — rregull financiar: asnjë status s'e përjashton më vetvetiu
    // dikë nga borxhi, vetëm një pagesë REALE e konfirmuar e bën këtë (shih
    // llogaritjen e tuitionDebt më poshtë).
    prisma.timiInvestStudent.findMany({
      where: { active: true, studentId: { not: null } },
      select: { studentId: true, regularPrice: true, discountPct: true, manualDiscAmt: true },
    }),

    tuitionAccrualWhere
      ? prisma.payment.findMany({
          where: tuitionAccrualWhere,
          select: { studentId: true, finalAmount: true, paidAmount: true, description: true, confirmed: true },
        })
      : Promise.resolve([]),

    // Për krahasimin e trendit (%) të kartës "Të Hyra" — e njëjta bazë
    // (Shkollimi, i konfirmuar), por për periudhën PARAARDHËSE.
    prevTuitionAccrualWhere
      ? prisma.payment.findMany({
          where: prevTuitionAccrualWhere,
          select: { studentId: true, paidAmount: true, confirmed: true },
        })
      : Promise.resolve([]),
  ]);

  const cycleCounts = { ulet: 0, larte: 0, paCaktuar: 0 };
  for (const s of activeInPeriod) {
    const cycle = getCycle(s.class?.name);
    if (cycle === "ulet") cycleCounts.ulet++;
    else if (cycle === "larte") cycleCounts.larte++;
    else cycleCounts.paCaktuar++;
  }

  // ── Pasqyrë Shkollimi (+ kartat KPI "Të Hyra"/"Borxhe", kufizuar këtu) ──
  const timiInvestById = new Map(timiInvestLinks.map(t => [t.studentId as number, t]));

  const tuitionByStudent = new Map<number, { finalAmount: number; paidAmount: number; description: string | null; confirmed: boolean }[]>();
  for (const p of tuitionRows) {
    const arr = tuitionByStudent.get(p.studentId) ?? [];
    arr.push(p);
    tuitionByStudent.set(p.studentId, arr);
  }
  let tuitionExpected = 0, tuitionPaid = 0, tuitionDebt = 0, tuitionDebtStudentCount = 0;
  for (const [studentId, rows] of tuitionByStudent) {
    const { finalAmount, balance } = aggregatePaymentTotals(rows);
    // Rregull financiar: vetëm shumat e KONFIRMUARA llogariten si "Të Hyra"
    // reale (shih Payment.confirmed) — "Pritur"/"Borxh" mbeten të pandryshuara.
    const confirmedPaid = rows.filter(r => r.confirmed).reduce((s, r) => s + r.paidAmount, 0);
    tuitionExpected += finalAmount;
    tuitionPaid += confirmedPaid;
    tuitionDebt += balance;
    if (balance > 0) tuitionDebtStudentCount++;
  }
  // Klientë TIMI Invest pa ASNJË pagesë reale të regjistruar këtë periudhë —
  // çmimi i TYRE specifik (jo standardi i kategorisë) imputohet plotësisht si
  // borxh, çfarëdo statusi (Profaturë/Në Proces/E Kryer). Vetëm një pagesë
  // reale e konfirmuar (rasti i mbuluar nga loop-i sipër) e heq dikë prej këtu.
  for (const [studentId, ti] of timiInvestById) {
    if (tuitionByStudent.has(studentId)) continue; // tashmë llogaritur sipër, nga pagesat reale
    const tiPrice = Math.round(computeTiExpectedPrice(ti));
    tuitionExpected += tiPrice;
    tuitionDebt += tiPrice;
    tuitionDebtStudentCount++;
  }
  // Nxënës aktivë (jo TI) pa ASNJË pagesë Shkollimi të regjistruar këtë
  // periudhë — çmimi standard i kategorisë imputohet plotësisht si borxh,
  // njësoj si te /api/dashboard/shkollimi-financiare (që "Borxhe Shkollimi"
  // të përputhet me pasqyrën e re, jo t'i injorojë këta nxënës në heshtje).
  if (shkollimiCategory) {
    for (const s of activeInPeriod) {
      if (tuitionByStudent.has(s.id) || timiInvestById.has(s.id)) continue;
      const price = Math.round(shkollimiCategory.defaultAmount * (1 - (s.discountPct ?? 0) / 100));
      tuitionExpected += price;
      tuitionDebt += price;
      tuitionDebtStudentCount++;
    }
  }

  // Karta KPI "Të Hyra" — vetëm Shkollimi, vetëm i konfirmuar (jo TI/import pa
  // konfirmim) — e njëjta bazë si tuitionPaid sipër.
  const periodRev = tuitionPaid;
  let prevTuitionPaid = 0;
  for (const p of prevTuitionRows) {
    if (!p.confirmed) continue;
    prevTuitionPaid += p.paidAmount;
  }
  const prevPeriodRev = prevTuitionPaid;
  // Krahasimi % kundrejt periudhës paraardhëse s'ka kuptim praktik kur periudha
  // e zgjedhur sapo ka filluar (p.sh. 1 muaj i vitit akademik kundrejt gjithë
  // vitit paraardhës del si "+3000%") — shfaqet vetëm pas ~45 ditësh.
  const daysSincePeriodStart = (now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24);
  const revenueChangePct = prevPeriodRev > 0 && daysSincePeriodStart >= 45
    ? Math.round(((periodRev - prevPeriodRev) / prevPeriodRev) * 100)
    : null;

  // Karta KPI "Pagesa të Vonuara" — numër NXËNËSISH (jo rreshtash-pagese), të
  // ndarë sipas: a ka paguar diçka për këstin e vonuar ("pjesa e dytë") apo
  // s'ka paguar fare asgjë për të ("pagesa e plotë"). Nëse një nxënës ka të
  // dyja llojet e kësteve të vonuara, numërohet te "pjesa e dytë" (ka paguar
  // diçka, i mbetet pjesë) — kategoria më "e favorshme" për të, meqë "s'ka
  // paguar fare" është shenja më e rëndë e vonesës.
  const overdueByStudent = new Map<number, boolean>(); // true = ka paguar diçka
  for (const p of overdueRows) {
    const hasPaid = p.paidAmount > 0;
    const prev = overdueByStudent.get(p.studentId);
    overdueByStudent.set(p.studentId, prev === true || hasPaid);
  }
  let overdueStudentsPartial = 0, overdueStudentsFull = 0;
  for (const hasPaid of overdueByStudent.values()) {
    if (hasPaid) overdueStudentsPartial++; else overdueStudentsFull++;
  }

  return NextResponse.json({
    period: { year, yearType, label },
    totalStudents,
    activeStudents: activeInPeriod.length,
    cycleCounts,
    periodRevenue: periodRev,
    prevPeriodRevenue: prevPeriodRev,
    revenueChangePct,
    overdueStudentsPartial,
    overdueStudentsFull,
    newInPeriod,
    newStudents: {
      count: newStudentsList.length,
      students: newStudentsList.map(s => ({
        id: s.id, firstName: s.firstName, lastName: s.lastName,
        className: s.class?.name ?? null, originCountry: s.originCountry, enrollDate: s.enrollDate,
        previousSchool: s.previousSchool, transferResult: s.transferResult, admissionScore: s.admissionScore, studentRating: s.studentRating,
      })),
    },
    departedStudents: {
      count: departedStudentsList.length,
      students: departedStudentsList.map(s => ({
        id: s.id, firstName: s.firstName, lastName: s.lastName,
        className: s.class?.name ?? null, leaveReason: s.leaveReason,
        destinationSchool: s.destinationSchool, inactiveDate: s.inactiveDate,
      })),
    },
    recentPayments,
    tuitionOverview: {
      expected: Math.round(tuitionExpected * 100) / 100,
      paid: Math.round(tuitionPaid * 100) / 100,
      debt: Math.round(tuitionDebt * 100) / 100,
      debtStudentCount: tuitionDebtStudentCount,
    },
  });
}
