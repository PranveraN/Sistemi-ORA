import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { recordStudentEvent } from "@/lib/studentHistory";

// Zhvendos një nxënës në klasë tjetër (nga faqja e klasës). Ndryshon VETËM
// classId; regjistrohet te historiku i nxënësit (→ edhe te "Lëvizjet",
// karta "Ndërrime klase") dhe te regjistri i aktivitetit.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role === "PEDAGOGIA") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const { id } = await params;
  const studentId = parseInt(id);
  const body = await req.json().catch(() => ({}));
  const targetId = parseInt(body.classId);

  const [student, target] = await Promise.all([
    prisma.student.findFirst({ where: { id: studentId, organizationId: orgId }, include: { class: { select: { id: true, name: true } } } }),
    targetId ? prisma.class.findFirst({ where: { id: targetId, organizationId: orgId } }) : Promise.resolve(null),
  ]);
  if (!student) return NextResponse.json({ error: "Nxënësi nuk u gjet" }, { status: 404 });
  if (!target) return NextResponse.json({ error: "Zgjidh klasën e re" }, { status: 400 });
  if (student.classId === target.id) return NextResponse.json({ error: "Nxënësi është tashmë në këtë klasë" }, { status: 400 });

  await prisma.student.update({ where: { id: studentId }, data: { classId: target.id } });
  const from = student.class?.name ?? "—";
  await recordStudentEvent(session, {
    studentId, type: "NDRYSHIM_KLASE", title: `Klasa: ${from} → ${target.name}`,
    description: body.reason ? String(body.reason).slice(0, 200) : null,
    data: { from, to: target.name, fromClassId: student.classId, toClassId: target.id },
  });
  await logAction(session, "UPDATE", "Student", studentId, `Zhvendosi ${student.firstName} ${student.lastName} nga ${from} në ${target.name}`);
  return NextResponse.json({ ok: true });
}
