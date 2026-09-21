import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { formatDate } from "@/lib/utils";
import { getGradeNumber } from "@/lib/school-cycles";
import { classHasRoom } from "@/lib/classCapacity";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const isManagement = role === "ADMIN" || role === "FINANCE";

  const now = new Date();
  const in7days = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  // Kërkesat për material urgjente/reja dhe stoku i ulët — vetëm për
  // ADMIN/FINANCE, sepse janë të vetmit që kanë qasje te `/kerkesat` dhe
  // `/materiale` (njësoj si te Sidebar), përndryshe njoftimi do të çonte
  // drejt një faqeje që përdoruesi s'mund ta përdorë.
  const [urgentRequests, newRequestsCount, materials] = isManagement
    ? await Promise.all([
        prisma.materialRequest.findMany({
          where: { organizationId: orgId, status: "SUBMITTED", priority: "URGENT" },
          include: { teacher: { select: { name: true } } },
          orderBy: { createdAt: "desc" },
          take: 5,
        }),
        prisma.materialRequest.count({ where: { organizationId: orgId, status: "SUBMITTED" } }),
        prisma.material.findMany({
          where: { organizationId: orgId, active: true },
          select: { id: true, name: true, currentStock: true, minStock: true },
        }),
      ])
    : [[], 0, []];
  const lowStockMaterials = materials.filter(m => m.currentStock <= m.minStock).slice(0, 10);

  // Vende të liruara për aplikimet në listë pritjeje (/apliko -> Regjistrimet)
  // — vetëm rolet me qasje te "Regjistrimet" (shih Sidebar.tsx); TEACHER/
  // PEDAGOGIA s'e shohin fare këtë faqe, ndaj njoftimi do të çonte në gjëkundi.
  const canSeeRegjistrimet = role === "ADMIN" || role === "FINANCE" || role === "SECRETARY";
  const waitlistOpenings = canSeeRegjistrimet ? await (async () => {
    const [activeClasses, waitlistGroups] = await Promise.all([
      prisma.class.findMany({
        where: { organizationId: orgId, active: true },
        select: { name: true, capacity: true, _count: { select: { students: { where: { status: "ACTIVE" } } } } },
      }),
      prisma.enrollmentApplication.groupBy({
        by: ["desiredGrade"],
        where: { organizationId: orgId, status: "PENDING", waitlisted: true, desiredGrade: { not: null } },
        _count: true,
      }),
    ]);
    const gradeHasRoom = new Map<number, boolean>();
    for (const c of activeClasses) {
      const grade = getGradeNumber(c.name);
      if (grade == null) continue;
      const hasRoom = classHasRoom(c.capacity, c._count.students);
      gradeHasRoom.set(grade, (gradeHasRoom.get(grade) ?? false) || hasRoom);
    }
    return waitlistGroups
      .filter(g => g.desiredGrade != null && gradeHasRoom.get(g.desiredGrade))
      .map(g => ({ grade: g.desiredGrade as number, count: g._count }));
  })() : [];

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
    ...urgentRequests.map((r) => ({
      id: `matreq-${r.id}`,
      type: "material-request" as const,
      title: "Kërkesë urgjente për material",
      body: `${r.teacher.name} — ${r.reason}`,
      dueDate: r.createdAt.toISOString(),
      urgent: true,
      category: "MATERIAL",
      link: "/kerkesat",
    })),
    ...lowStockMaterials.map((m) => ({
      id: `stock-${m.id}`,
      type: "low-stock" as const,
      title: `Stok i ulët — ${m.name}`,
      body: `${m.currentStock} mbetur (minimumi ${m.minStock})`,
      dueDate: null,
      urgent: m.currentStock <= 0,
      category: "STOCK",
      link: "/materiale",
    })),
    ...waitlistOpenings.map((w) => ({
      id: `waitlist-${w.grade}`,
      type: "waitlist-opening" as const,
      title: `U lirua vend — Klasa ${w.grade}`,
      body: `${w.count} aplikim${w.count > 1 ? "e" : ""} në listë pritjeje për këtë klasë`,
      dueDate: null,
      urgent: false,
      category: "ENROLLMENT",
      link: `/regjistrimet?grade=${w.grade}`,
    })),
  ];

  return NextResponse.json({
    notifications,
    counts: {
      reminders: reminders.length,
      overdue: overdue.length,
      urgentTasks: urgentTasks.length,
      newRequests: newRequestsCount,
      urgentRequests: urgentRequests.length,
      lowStock: lowStockMaterials.length,
      recentPayments: recentPayments.length,
      waitlistOpenings: waitlistOpenings.length,
      total: reminders.length + urgentTasks.length + overdue.length + urgentRequests.length + lowStockMaterials.length + waitlistOpenings.length,
    },
  });
}
