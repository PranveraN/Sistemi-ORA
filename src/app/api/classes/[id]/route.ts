import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role === "PEDAGOGIA") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const cls = await prisma.class.update({
    where: { id: parseInt(id) },
    data: {
      ...(body.name     !== undefined && { name:     body.name }),
      ...(body.level    !== undefined && { level:    body.level }),
      ...(body.teacher  !== undefined && { teacher:  body.teacher || null }),
      ...(body.capacity !== undefined && { capacity: body.capacity === "" || body.capacity == null ? null : Number(body.capacity) }),
      ...(body.active   !== undefined && { active:   Boolean(body.active) }),
    },
  });

  return NextResponse.json(cls);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role === "PEDAGOGIA") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }

  const { id } = await params;
  const classId = parseInt(id);
  // S'lejohet fshirja e një klase që ka nxënës (më parë nxënësit mbeteshin
  // heshtazi pa klasë). Zhvendosi fillimisht ose çaktivizo klasën.
  const studentCount = await prisma.student.count({ where: { classId } });
  if (studentCount > 0) {
    return NextResponse.json(
      { error: `Klasa ka ${studentCount} nxënës — zhvendosi në klasë tjetër ose çaktivizo klasën në vend që ta fshish.` },
      { status: 409 },
    );
  }
  const cls = await prisma.class.delete({ where: { id: classId } });
  await logAction(session, "DELETE", "Class", classId, `Fshiu klasën ${cls.name}`);
  return NextResponse.json({ success: true });
}
