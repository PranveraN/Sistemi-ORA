import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const body = await req.json();
  const saleId = parseInt(id);

  const payment = await prisma.uniPayment.create({
    data: {
      saleId,
      amount: parseFloat(body.amount),
      method: body.method || "CASH",
      notes:  body.notes  || null,
      paidAt: body.paidAt ? new Date(body.paidAt) : new Date(),
    },
  });

  // Recalculate sale totals
  const sale = await prisma.uniSale.findUnique({
    where: { id: saleId },
    include: { payments: true },
  });
  if (sale) {
    const totalPaid = sale.payments.reduce((s, p) => s + p.amount, 0);
    const balance   = Math.max(0, sale.totalAmount - totalPaid);
    const status    = totalPaid >= sale.totalAmount ? "PAID" : totalPaid > 0 ? "PARTIAL" : "PENDING";
    await prisma.uniSale.update({
      where: { id: saleId },
      data: { paidAmount: totalPaid, balance, status },
    });
  }

  return NextResponse.json(payment, { status: 201 });
}
