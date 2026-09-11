import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const { searchParams } = new URL(req.url);
  const categoryId = searchParams.get("categoryId");
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const handovers = await prisma.paymentHandover.findMany({
    where: {
      organizationId: orgId,
      ...(categoryId ? { categoryId: parseInt(categoryId) } : {}),
      ...(from || to ? {
        handoverAt: {
          ...(from ? { gte: new Date(from) } : {}),
          ...(to   ? { lte: new Date(to) }   : {}),
        },
      } : {}),
    },
    include: { category: { select: { id: true, name: true } } },
    orderBy: { handoverAt: "desc" },
  });
  return NextResponse.json(handovers);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const body = await req.json();
  const amount = parseFloat(body.amount);
  if (!amount || amount <= 0) {
    return NextResponse.json({ error: "Shuma duhet të jetë më e madhe se 0" }, { status: 400 });
  }

  const handover = await prisma.paymentHandover.create({
    data: {
      categoryId:  body.categoryId ? parseInt(body.categoryId) : null,
      amount,
      description: body.description || null,
      recipient:   body.recipient   || null,
      method:      body.method      || "CASH",
      reference:   body.reference   || null,
      handoverAt:  body.handoverAt ? new Date(body.handoverAt) : new Date(),
      organizationId: orgId,
    },
    include: { category: { select: { id: true, name: true } } },
  });
  return NextResponse.json(handover, { status: 201 });
}
