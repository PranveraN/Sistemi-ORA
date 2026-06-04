import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const sale = await prisma.uniSale.findUnique({
    where: { id: parseInt(id) },
    include: {
      items:    { include: { product: true } },
      payments: { orderBy: { paidAt: "asc" } },
    },
  });
  if (!sale) return NextResponse.json({ error: "Nuk u gjet" }, { status: 404 });
  return NextResponse.json(sale);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  // Restore stock before deleting
  const sale = await prisma.uniSale.findUnique({
    where: { id: parseInt(id) },
    include: { items: true },
  });
  if (sale) {
    for (const item of sale.items) {
      await prisma.uniProduct.update({
        where: { id: item.productId },
        data: { stock: { increment: item.quantity } },
      });
    }
  }
  await prisma.uniSale.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}
