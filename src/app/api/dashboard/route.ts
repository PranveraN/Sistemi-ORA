import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCycle } from "@/lib/school-cycles";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const now = new Date();
  const thisYear  = now.getFullYear();
  const thisMonth = now.getMonth();

  const firstDayThisMonth = new Date(thisYear, thisMonth, 1);
  const lastDayThisMonth  = new Date(thisYear, thisMonth + 1, 0, 23, 59, 59);
  const firstDayPrevMonth = new Date(thisYear, thisMonth - 1, 1);
  const lastDayPrevMonth  = new Date(thisYear, thisMonth, 0, 23, 59, 59);
  const weekEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [
    totalStudents,
    activeStudents,
    studentsWithDebt,
    monthlyPaid,
    prevMonthPaid,
    totalRevenue,
    recentPayments,
    overduePayments,
    newStudentsThisMonth,
    expiringThisWeek,
    allMonthlyPayments,
    allEnrollments,
    activeStudentsByClass,
  ] = await Promise.all([
    prisma.student.count({ where: { organizationId: orgId } }),
    prisma.student.count({ where: { organizationId: orgId, status: "ACTIVE" } }),

    prisma.payment.groupBy({
      by: ["studentId"],
      where: { organizationId: orgId, balance: { gt: 0 }, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
      _count: true,
    }),

    prisma.payment.aggregate({
      where: {
        organizationId: orgId,
        paidDate: { gte: firstDayThisMonth, lte: lastDayThisMonth },
        status: { in: ["PAID", "PARTIAL"] },
      },
      _sum: { paidAmount: true },
    }),

    prisma.payment.aggregate({
      where: {
        organizationId: orgId,
        paidDate: { gte: firstDayPrevMonth, lte: lastDayPrevMonth },
        status: { in: ["PAID", "PARTIAL"] },
      },
      _sum: { paidAmount: true },
    }),

    prisma.payment.aggregate({
      where: { organizationId: orgId, status: "PAID" },
      _sum: { paidAmount: true },
    }),

    prisma.payment.findMany({
      where: { organizationId: orgId, paidDate: { not: null } },
      orderBy: { paidDate: "desc" },
      take: 8,
      include: {
        student: { select: { firstName: true, lastName: true } },
        category: { select: { name: true } },
      },
    }),

    prisma.payment.aggregate({
      where: { organizationId: orgId, status: "OVERDUE" },
      _sum: { balance: true },
      _count: true,
    }),

    prisma.student.count({
      where: { organizationId: orgId, enrollDate: { gte: firstDayThisMonth, lte: lastDayThisMonth } },
    }),

    prisma.payment.count({
      where: {
        organizationId: orgId,
        dueDate: { gte: now, lte: weekEnd },
        status: { in: ["PENDING", "PARTIAL"] },
        balance: { gt: 0 },
      },
    }),

    prisma.payment.findMany({
      where: {
        organizationId: orgId,
        paidDate: { gte: new Date(thisYear, thisMonth - 5, 1) },
        status: { in: ["PAID", "PARTIAL"] },
      },
      select: { paidDate: true, paidAmount: true },
    }),

    prisma.student.findMany({
      where: { organizationId: orgId, enrollDate: { gte: new Date(thisYear, thisMonth - 5, 1) } },
      select: { enrollDate: true },
    }),

    prisma.student.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      select: { class: { select: { name: true } } },
    }),
  ]);

  const cycleCounts = { ulet: 0, larte: 0, paCaktuar: 0 };
  for (const s of activeStudentsByClass) {
    const cycle = getCycle(s.class?.name);
    if (cycle === "ulet") cycleCounts.ulet++;
    else if (cycle === "larte") cycleCounts.larte++;
    else cycleCounts.paCaktuar++;
  }

  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(thisYear, thisMonth - (5 - i), 1);
    return { date: d, key: `${d.getFullYear()}-${d.getMonth()}` };
  });

  const revenueByMonth = new Map<string, number>();
  for (const p of allMonthlyPayments) {
    if (!p.paidDate) continue;
    const key = `${p.paidDate.getFullYear()}-${p.paidDate.getMonth()}`;
    revenueByMonth.set(key, (revenueByMonth.get(key) ?? 0) + p.paidAmount);
  }

  const enrollByMonth = new Map<string, number>();
  for (const s of allEnrollments) {
    const key = `${s.enrollDate.getFullYear()}-${s.enrollDate.getMonth()}`;
    enrollByMonth.set(key, (enrollByMonth.get(key) ?? 0) + 1);
  }

  const monthlyChartData = months.map(({ date, key }) => ({
    month:    new Intl.DateTimeFormat("sq-AL", { month: "short" }).format(date),
    total:    revenueByMonth.get(key) ?? 0,
    enrolled: enrollByMonth.get(key)  ?? 0,
  }));

  const thisMonthRev = monthlyPaid._sum.paidAmount || 0;
  const prevMonthRev = prevMonthPaid._sum.paidAmount || 0;
  const revenueChangePct = prevMonthRev > 0
    ? Math.round(((thisMonthRev - prevMonthRev) / prevMonthRev) * 100)
    : null;

  return NextResponse.json({
    totalStudents,
    activeStudents,
    cycleCounts,
    studentsWithDebt: studentsWithDebt.length,
    monthlyRevenue: thisMonthRev,
    prevMonthRevenue: prevMonthRev,
    revenueChangePct,
    totalRevenue: totalRevenue._sum.paidAmount || 0,
    overdueAmount: overduePayments._sum.balance || 0,
    overdueCount: overduePayments._count,
    newStudentsThisMonth,
    expiringThisWeek,
    recentPayments,
    monthlyChartData,
  });
}
