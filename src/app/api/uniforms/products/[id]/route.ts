import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const data: Record<string, unknown> = {};
  if (body.name        !== undefined) data.name        = body.name;
  if (body.description !== undefined) data.description = body.description || null;
  if (body.photo       !== undefined) data.photo       = body.photo || null;
  if (body.buyPrice    !== undefined) data.buyPrice    = parseFloat(body.buyPrice);
  if (body.sellPrice   !== undefined) data.sellPrice   = parseFloat(body.sellPrice);
  if (body.stock       !== undefined) data.stock       = parseInt(body.stock);
  if (body.stockAlert  !== undefined) data.stockAlert  = parseInt(body.stockAlert);
  if (body.active      !== undefined) data.active      = body.active;
  const product = await prisma.uniProduct.update({ where: { id: parseInt(id) }, data });
  return NextResponse.json(product);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.uniProduct.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}
