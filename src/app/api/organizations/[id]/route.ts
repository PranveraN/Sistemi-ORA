import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || (session.user as { role?: string }).role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const org = await prisma.organization.findUnique({
    where: { id: parseInt(id) },
    include: { users: { select: { id: true, name: true, email: true, role: true, active: true } } },
  });

  if (!org) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(org);
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || (session.user as { role?: string }).role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const body = await req.json();

  const data: { plan?: string; active?: boolean } = {};
  if (body.plan !== undefined) data.plan = body.plan;
  if (body.active !== undefined) data.active = body.active;

  const org = await prisma.organization.update({
    where: { id: parseInt(id) },
    data,
    include: { users: { select: { id: true, name: true, email: true, role: true, active: true } } },
  });

  return NextResponse.json(org);
}
