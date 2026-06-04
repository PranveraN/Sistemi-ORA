import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const amount = parseFloat(body.amount);
  const discount = parseFloat(body.discount || 0);
  const scholarship = parseFloat(body.scholarship || 0);

  let discountAmount = discount;
  if (body.discountType === "percentage") {
    discountAmount = (amount * discount) / 100;
  }

  const finalAmount = Math.max(0, amount - discountAmount - scholarship);
  const paidAmount = parseFloat(body.paidAmount || 0);
  const balance = Math.max(0, finalAmount - paidAmount);

  let status = "PENDING";
  if (paidAmount >= finalAmount) status = "PAID";
  else if (paidAmount > 0) status = "PARTIAL";
  else if (new Date(body.dueDate) < new Date()) status = "OVERDUE";

  const payment = await prisma.payment.update({
    where: { id: parseInt(id) },
    data: {
      amount,
      discount,
      discountType: body.discountType || null,
      scholarship,
      finalAmount,
      dueDate: new Date(body.dueDate),
      paidDate: paidAmount > 0 ? (body.paidDate ? new Date(body.paidDate) : new Date()) : null,
      paidAmount,
      balance,
      method: body.method || null,
      status,
      description: body.description || null,
    },
  });

  return NextResponse.json(payment);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.payment.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ success: true });
}
