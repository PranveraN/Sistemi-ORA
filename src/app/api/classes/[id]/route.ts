import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const cls = await prisma.class.update({
    where: { id: parseInt(id) },
    data: {
      ...(body.name    !== undefined && { name:    body.name }),
      ...(body.level   !== undefined && { level:   body.level }),
      ...(body.teacher !== undefined && { teacher: body.teacher || null }),
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

  const { id } = await params;
  // Detach students first
  await prisma.student.updateMany({ where: { classId: parseInt(id) }, data: { classId: null } });
  await prisma.class.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}
