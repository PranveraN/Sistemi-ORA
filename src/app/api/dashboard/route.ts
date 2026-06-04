import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
    monthlyStats,
    newStudentsThisMonth,
    expiringThisWeek,
    enrollmentTrend,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.student.count({ where: { status: "ACTIVE" } }),

    prisma.payment.groupBy({
      by: ["studentId"],
      where: { balance: { gt: 0 }, status: { in: ["PENDING", "PARTIAL", "OVERDUE"] } },
      _count: true,
    }),

    // Revenue this month
    prisma.payment.aggregate({
      where: {
        paidDate: { gte: firstDayThisMonth, lte: lastDayThisMonth },
        status: { in: ["PAID", "PARTIAL"] },
      },
      _sum: { paidAmount: true },
    }),

    // Revenue previous month
    prisma.payment.aggregate({
      where: {
        paidDate: { gte: firstDayPrevMonth, lte: lastDayPrevMonth },
        status: { in: ["PAID", "PARTIAL"] },
      },
      _sum: { paidAmount: true },
    }),

    prisma.payment.aggregate({
      where: { status: "PAID" },
      _sum: { paidAmount: true },
    }),

    prisma.payment.findMany({
      where: { paidDate: { not: null } },
      orderBy: { paidDate: "desc" },
      take: 8,
      include: {
        student: { select: { firstName: true, lastName: true } },
        category: { select: { name: true } },
      },
    }),

    prisma.payment.aggregate({
      where: { status: "OVERDUE" },
      _sum: { balance: true },
      _count: true,
    }),

    // Last 6 months payments for chart — per month aggregate
    Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const d = new Date(thisYear, thisMonth - (5 - i), 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
        return prisma.payment.aggregate({
          where: { paidDate: { gte: start, lte: end }, status: { in: ["PAID", "PARTIAL"] } },
          _sum: { paidAmount: true },
        }).then(r => ({ month: d, total: r._sum.paidAmount || 0 }));
      })
    ),

    // New students enrolled this month
    prisma.student.count({
      where: { enrollDate: { gte: firstDayThisMonth, lte: lastDayThisMonth } },
    }),

    // Payments expiring in next 7 days
    prisma.payment.count({
      where: {
        dueDate: { gte: now, lte: weekEnd },
        status: { in: ["PENDING", "PARTIAL"] },
        balance: { gt: 0 },
      },
    }),

    // Enrollment per month last 6 months
    Promise.all(
      Array.from({ length: 6 }, (_, i) => {
        const d = new Date(thisYear, thisMonth - (5 - i), 1);
        const start = new Date(d.getFullYear(), d.getMonth(), 1);
        const end   = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
        return prisma.student.count({
          where: { enrollDate: { gte: start, lte: end } },
        }).then(count => ({ month: d, count }));
      })
    ),
  ]);

  // Build monthly chart data — monthlyStats dhe enrollmentTrend janë tashmë të agreguar
  const monthlyChartData = monthlyStats.map((stat, i) => ({
    month: new Intl.DateTimeFormat("sq-AL", { month: "short" }).format(stat.month),
    total: stat.total,
    enrolled: enrollmentTrend[i]?.count ?? 0,
  }));

  // Revenue change percentage
  const thisMonthRev = monthlyPaid._sum.paidAmount || 0;
  const prevMonthRev = prevMonthPaid._sum.paidAmount || 0;
  const revenueChangePct = prevMonthRev > 0
    ? Math.round(((thisMonthRev - prevMonthRev) / prevMonthRev) * 100)
    : null;

  return NextResponse.json({
    totalStudents,
    activeStudents,
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
