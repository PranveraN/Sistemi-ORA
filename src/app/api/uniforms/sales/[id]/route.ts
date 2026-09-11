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

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const saleId = parseInt(id);

  const existing = await prisma.uniSale.findUnique({ where: { id: saleId }, include: { items: true } });
  if (!existing) return NextResponse.json({ error: "Nuk u gjet" }, { status: 404 });

  const body = await req.json();
  const { customerName, customerPhone, studentId, notes, amount } = body;

  if (!customerName?.trim()) {
    return NextResponse.json({ error: "Emri mungon" }, { status: 400 });
  }

  const data: Record<string, unknown> = {
    customerName: customerName.trim(),
    customerPhone: customerPhone || null,
    studentId: studentId ? parseInt(studentId) : null,
    notes: notes || null,
  };

  // Shuma totale editohet vetëm për borxhet e regjistruara pa artikuj reale
  // (`items.length === 0`) — nëse shitja ka produkte/stok real, totali rrjedh
  // prej tyre dhe s'duhet të ndryshojë veçmas, përndryshe do të shkëputej nga
  // artikujt/stoku real të shitjes.
  if (existing.items.length === 0 && amount != null) {
    const totalAmount = parseFloat(amount);
    if (!totalAmount || totalAmount <= 0) {
      return NextResponse.json({ error: "Shuma duhet të jetë më e madhe se 0" }, { status: 400 });
    }
    const balance = Math.max(0, totalAmount - existing.paidAmount);
    const status = existing.paidAmount >= totalAmount ? "PAID" : existing.paidAmount > 0 ? "PARTIAL" : "PENDING";
    data.totalAmount = totalAmount;
    data.profit = totalAmount - existing.totalCost;
    data.balance = balance;
    data.status = status;
  }

  const sale = await prisma.uniSale.update({ where: { id: saleId }, data });
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
