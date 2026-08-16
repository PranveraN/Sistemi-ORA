import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const [reminders, overdue, urgentTasks, recentPayments] = await Promise.all([
    // Reminders due within 7 days (not done)
    prisma.adminReminder.findMany({
      where: { done: false, dueDate: { lte: in7days } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    // Overdue payments
    prisma.payment.findMany({
      where: { status: "OVERDUE" },
      include: { student: { select: { firstName: true, lastName: true } } },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    // Urgent tasks not done
    prisma.adminTask.findMany({
      where: { priority: "URGENT", status: { in: ["TODO", "IN_PROGRESS"] } },
      orderBy: { dueDate: "asc" },
      take: 5,
    }),
    // Payments received today
    prisma.payment.findMany({
      where: {
        status: "PAID",
        paidDate: { gte: new Date(now.getFullYear(), now.getMonth(), now.getDate()) },
      },
      include: { student: { select: { firstName: true, lastName: true } } },
      orderBy: { paidDate: "desc" },
      take: 5,
    }),
  ]);

  const notifications = [
    ...reminders.map((r) => ({
      id: `rem-${r.id}`,
      type: "reminder" as const,
      title: r.title,
      body: r.description || "",
      dueDate: r.dueDate.toISOString(),
      urgent: r.dueDate <= now,
      category: r.type,
    })),
    ...urgentTasks.map((t) => ({
      id: `task-${t.id}`,
      type: "task" as const,
      title: t.title,
      body: t.description || "",
      dueDate: t.dueDate?.toISOString() || null,
      urgent: true,
      category: t.priority,
    })),
    ...overdue.map((p) => ({
      id: `pay-${p.id}`,
      type: "overdue" as const,
      title: `Pagesë e vonuar — ${p.student.firstName} ${p.student.lastName}`,
      body: `€${p.finalAmount.toFixed(0)} — skadon ${formatDate(p.dueDate)}`,
      dueDate: p.dueDate.toISOString(),
      urgent: true,
      category: "PAYMENT",
    })),
    ...recentPayments.map((p) => ({
      id: `paid-${p.id}`,
      type: "paid" as const,
      title: `Pagesë e pranuar`,
      body: `${p.student.firstName} ${p.student.lastName} — €${p.paidAmount.toFixed(0)}`,
      dueDate: p.paidDate?.toISOString() || null,
      urgent: false,
      category: "PAYMENT",
    })),
  ];

  return NextResponse.json({
    notifications,
    counts: {
      reminders: reminders.length,
      overdue: overdue.length,
      urgentTasks: urgentTasks.length,
      recentPayments: recentPayments.length,
      total: reminders.length + urgentTasks.length + overdue.length,
    },
  });
}
