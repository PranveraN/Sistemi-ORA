import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayEnd   = new Date(todayStart.getTime() + 86400000);
  const weekEnd    = new Date(todayStart.getTime() + 7 * 86400000);

  const [
    activeTasks,
    todayReminders,
    upcomingReminders,
    overdueReminders,
    activeStudents,
    studentsWithDebt,
    recentPayments,
    upcomingEvents,
    todayEvents,
    recentNotes,
    upcomingTasks,
    auditLogs,
  ] = await Promise.all([
    prisma.adminTask.count({ where: { status: { notIn: ["DONE", "CANCELLED"] } } }),
    prisma.adminReminder.count({ where: { dueDate: { gte: todayStart, lt: todayEnd }, done: false } }),
    prisma.adminReminder.findMany({
      where: { dueDate: { gte: todayStart, lt: weekEnd }, done: false },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    prisma.adminReminder.count({ where: { dueDate: { lt: todayStart }, done: false } }),
    prisma.student.count({ where: { status: "ACTIVE" } }),
    prisma.student.findMany({
      where: {
        status: "ACTIVE",
        payments: { some: { balance: { gt: 0 } } },
      },
      include: {
        class: { select: { name: true } },
        payments: {
          where: { balance: { gt: 0 } },
          select: { balance: true, finalAmount: true, status: true },
        },
      },
      take: 6,
    }),
    prisma.payment.findMany({
      where: { paidAmount: { gt: 0 } },
      include: {
        student: { select: { firstName: true, lastName: true } },
        category: { select: { name: true } },
      },
      orderBy: { paidDate: "desc" },
      take: 6,
    }),
    prisma.adminEvent.findMany({
      where: { date: { gte: todayStart, lt: weekEnd } },
      orderBy: { date: "asc" },
      take: 5,
    }),
    prisma.adminEvent.findMany({
      where: { date: { gte: todayStart, lt: todayEnd } },
      orderBy: { date: "asc" },
    }),
    prisma.adminNote.findMany({
      where: { archived: false },
      orderBy: [{ pinned: "desc" }, { updatedAt: "desc" }],
      take: 4,
    }),
    prisma.adminTask.findMany({
      where: { status: { notIn: ["DONE", "CANCELLED"] }, dueDate: { gte: todayStart, lt: weekEnd } },
      orderBy: [{ priority: "desc" }, { dueDate: "asc" }],
      take: 5,
    }),
    prisma.auditLog.findMany({
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const totalDebt = studentsWithDebt.reduce(
    (s, st) => s + st.payments.reduce((ps, p) => ps + p.balance, 0), 0
  );

  return NextResponse.json({
    stats: { activeTasks, todayReminders, overdueReminders, activeStudents, totalDebt },
    studentsWithDebt: studentsWithDebt.map(s => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      parentPhone: s.parentPhone,
      class: s.class,
      totalDebt: s.payments.reduce((ps, p) => ps + p.balance, 0),
    })),
    recentPayments,
    upcomingEvents,
    todayEvents,
    upcomingReminders,
    recentNotes,
    upcomingTasks,
    auditLogs,
  });
}
