import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const { id } = await params;
  const existing = await prisma.paymentHandover.findUnique({ where: { id: parseInt(id) } });
  if (!existing || existing.organizationId !== orgId) {
    return NextResponse.json({ error: "Nuk u gjet" }, { status: 404 });
  }
  await prisma.paymentHandover.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}
