import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

// Modifikon ose fshin një rresht "Borxh i Vjetër" (Payment me description =
// "BORXH_VJETER") direkt nga badge-i pranë emrit të nxënësit — pa prekur
// asnjë fushë tjetër (dueDate/month/year mbeten siç u importuan).
async function loadOldDebt(id: number) {
  const payment = await prisma.payment.findUnique({
    where: { id },
    include: { student: { select: { firstName: true, lastName: true } }, category: { select: { name: true } } },
  });
  if (!payment || payment.description !== "BORXH_VJETER") return null;
  return payment;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await loadOldDebt(parseInt(id));
  if (!existing) return NextResponse.json({ error: "Borxhi i vjetër s'u gjet" }, { status: 404 });

  const body = await req.json();
  const amount = parseFloat(body.amount);
  if (!amount || isNaN(amount) || amount <= 0) {
    return NextResponse.json({ error: "Shuma e pavlefshme" }, { status: 400 });
  }

  const finalAmount = amount;
  const balance = Math.max(0, finalAmount - existing.paidAmount);
  const status = existing.paidAmount >= finalAmount ? "PAID" : existing.paidAmount > 0 ? "PARTIAL" : "OVERDUE";

  const payment = await prisma.payment.update({
    where: { id: existing.id },
    data: {
      amount,
      finalAmount,
      balance,
      status,
      note: body.note !== undefined ? (body.note || null) : existing.note,
    },
  });

  await logAction(session, "UPDATE", "Payment", payment.id,
    `Ndryshoi borxhin e vjetër të ${existing.student.firstName} ${existing.student.lastName} (${existing.category.name}) — ${finalAmount}€`);

  revalidatePath(`/students/${existing.studentId}`);

  return NextResponse.json(payment);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await loadOldDebt(parseInt(id));
  if (!existing) return NextResponse.json({ error: "Borxhi i vjetër s'u gjet" }, { status: 404 });

  await prisma.payment.delete({ where: { id: existing.id } });

  await logAction(session, "DELETE", "Payment", existing.id,
    `Fshiu borxhin e vjetër të ${existing.student.firstName} ${existing.student.lastName} (${existing.category.name}) — ${existing.finalAmount}€`);

  revalidatePath(`/students/${existing.studentId}`);

  return NextResponse.json({ success: true });
}
