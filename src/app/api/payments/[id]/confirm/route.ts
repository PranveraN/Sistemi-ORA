import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

// Konfirmon manualisht një pagesë "pa konfirmuar" (import ose TIMI Invest) —
// pas kësaj, shuma e saj llogaritet si "Të Hyra" reale. Shih fushën
// Payment.confirmed në schema.prisma.
export async function PATCH(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const payment = await prisma.payment.update({
    where: { id: parseInt(id) },
    data: { confirmed: true },
    include: { student: { select: { firstName: true, lastName: true } }, category: { select: { name: true } } },
  });

  await logAction(session, "UPDATE", "Payment", payment.id,
    `Konfirmoi si e hyrë reale pagesën e ${payment.student.firstName} ${payment.student.lastName} (${payment.category.name}) — ${payment.finalAmount}€`);

  return NextResponse.json(payment);
}
