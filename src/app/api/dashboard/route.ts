import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCycle } from "@/lib/school-cycles";
import { getDateRange, getAcademicMonths, DEFAULT_ACADEMIC_YEAR, type YearType } from "@/lib/academicYear";
import { MONTHS } from "@/lib/utils";

type PeriodMonth = { calMonth: number; calYear: number };

// "Të Hyra" — akruale (etiketa month/year, si Bilanci/Shkollimi) për vitin
// akademik, që numrat të përputhen gjithmonë me Shkollimin edhe kur dikush
// paguan më herët/më vonë se afati; sipas datës reale të arkëtimit (paidDate)
// për vitin kalendarik — arsyeja pse ekziston pamja "Kalendarik" fare.
// Mbulon TË GJITHA kategoritë (jo vetëm Shkollimin, ndryshe nga Bilanci).
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

  const [
    totalStudents,
    activeInPeriod,
    debtGroups,
    periodRevenueAgg,
    prevPeriodRevenueAgg,
    totalRevenueAgg,
    recentPayments,
    debtAgg,
    overdueAgg,
    newInPeriod,
    monthlyRevenueRows,
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
      select: { id: true, class: { select: { name: true } } },
    }),

    // Nxënësit me borxh — nga `balance` (jo fusha `status`, shpesh e ngrirë/e
    // vjetruar), kufizuar te afatet BRENDA periudhës së zgjedhur.
    prisma.payment.groupBy({
      by: ["studentId"],
      where: { organizationId: orgId, balance: { gt: 0 }, dueDate: { gte: start, lte: end } },
      _count: true,
    }),

    prisma.payment.aggregate({ where: revenueWhere(orgId, yearType, months, start, end), _sum: { paidAmount: true } }),
    prisma.payment.aggregate({ where: revenueWhere(orgId, yearType, prevMonths, prevStart, prevEnd), _sum: { paidAmount: true } }),
    // Për kartën "Statusi i Pagesave → Të Paguara" — e njëjta shumë si "Të Hyra".
    prisma.payment.aggregate({ where: revenueWhere(orgId, yearType, months, start, end), _sum: { paidAmount: true } }),

    prisma.payment.findMany({
      where: { organizationId: orgId, paidDate: { gte: start, lte: end } },
      orderBy: { paidDate: "desc" },
      take: 8,
      include: {
        student: { select: { firstName: true, lastName: true } },
        category: { select: { name: true } },
      },
    }),

    // Borxhi TOTAL i periudhës (afati brenda periudhës, pavarësisht kur u
    // paguan pjesërisht) — mbulon TË GJITHA kategoritë, si te grupimi sipër.
    prisma.payment.aggregate({
      where: { organizationId: orgId, balance: { gt: 0 }, dueDate: { gte: start, lte: end } },
      _sum: { balance: true },
    }),

    // "Vonuar" — afati ka kaluar (deri te "tani" ose fundi i periudhës, cilido
    // vjen më parë) DHE ka ende borxh, e llogaritur dinamikisht nga `balance`.
    prisma.payment.aggregate({
      where: { organizationId: orgId, balance: { gt: 0 }, dueDate: { gte: start, lte: overdueUpperBound } },
      _sum: { balance: true },
      _count: true,
    }),

    prisma.student.count({ where: { organizationId: orgId, enrollDate: { gte: start, lte: end } } }),

    prisma.payment.findMany({
      where: revenueWhere(orgId, yearType, months, start, end),
      select: { paidAmount: true, paidDate: true, month: true, year: true },
    }),
  ]);

  const cycleCounts = { ulet: 0, larte: 0, paCaktuar: 0 };
  for (const s of activeInPeriod) {
    const cycle = getCycle(s.class?.name);
    if (cycle === "ulet") cycleCounts.ulet++;
    else if (cycle === "larte") cycleCounts.larte++;
    else cycleCounts.paCaktuar++;
  }

  // Grafiku — 12 muajt e periudhës së zgjedhur (jo më 6 muaj rrotullues nga sot).
  const revByMonthKey = new Map<string, number>();
  for (const p of monthlyRevenueRows) {
    let key: string;
    if (yearType === "academic") {
      key = `${p.month}-${p.year}`;
    } else {
      if (!p.paidDate) continue;
      const d = new Date(p.paidDate);
      key = `${d.getMonth() + 1}-${d.getFullYear()}`;
    }
    revByMonthKey.set(key, (revByMonthKey.get(key) ?? 0) + p.paidAmount);
  }
  const monthlyChartData = months.map(m => ({
    month: MONTHS[m.calMonth - 1],
    total: Math.round((revByMonthKey.get(`${m.calMonth}-${m.calYear}`) ?? 0) * 100) / 100,
  }));

  const periodRev     = periodRevenueAgg._sum.paidAmount || 0;
  const prevPeriodRev  = prevPeriodRevenueAgg._sum.paidAmount || 0;
  const revenueChangePct = prevPeriodRev > 0
    ? Math.round(((periodRev - prevPeriodRev) / prevPeriodRev) * 100)
    : null;

  return NextResponse.json({
    period: { year, yearType, label },
    totalStudents,
    activeStudents: activeInPeriod.length,
    cycleCounts,
    studentsWithDebt: debtGroups.length,
    periodRevenue: periodRev,
    prevPeriodRevenue: prevPeriodRev,
    revenueChangePct,
    totalRevenue: totalRevenueAgg._sum.paidAmount || 0,
    totalDebtAmount: debtAgg._sum.balance || 0,
    overdueAmount: overdueAgg._sum.balance || 0,
    overdueCount: overdueAgg._count,
    newInPeriod,
    recentPayments,
    monthlyChartData,
  });
}
