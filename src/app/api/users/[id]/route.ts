import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionUser = session.user as { role?: string };
  if (sessionUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Vetëm adminët mund të modifikojnë përdorues" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.name   !== undefined) data.name   = body.name;
  if (body.email  !== undefined) data.email  = body.email;
  if (body.role   !== undefined) data.role   = body.role;
  if (body.active !== undefined) data.active = body.active;
  if (body.password) {
    data.password = await bcrypt.hash(body.password, 10);
  }

  const user = await prisma.user.update({
    where: { id: parseInt(id) },
    data,
    select: { id: true, email: true, name: true, role: true, active: true, createdAt: true },
  });

  return NextResponse.json(user);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionUser = session.user as { role?: string };
  if (sessionUser?.role !== "ADMIN") {
    return NextResponse.json({ error: "Vetëm adminët mund të fshijnë përdorues" }, { status: 403 });
  }

  const { id } = await params;

  const adminCount = await prisma.user.count({ where: { role: "ADMIN", active: true } });
  const user = await prisma.user.findUnique({ where: { id: parseInt(id) } });
  if (user?.role === "ADMIN" && adminCount <= 1) {
    return NextResponse.json({ error: "Nuk mund të fshish administratorin e fundit" }, { status: 400 });
  }

  await prisma.user.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}
