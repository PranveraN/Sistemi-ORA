import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

async function generateReceiptNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const last = await prisma.payment.findFirst({
    where: { receiptNumber: { startsWith: `DEP-${year}-` } },
    orderBy: { receiptNumber: "desc" },
  });
  const lastSeq = last ? parseInt(last.receiptNumber!.split("-").pop() || "0") : 0;
  return `DEP-${year}-${String(lastSeq + 1).padStart(4, "0")}`;
}

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
  const dueDate = new Date(body.dueDate);

  let status = "PENDING";
  if (paidAmount >= finalAmount) status = "PAID";
  else if (paidAmount > 0) status = "PARTIAL";
  else if (dueDate < new Date()) status = "OVERDUE";

  // Muaji/viti duhet të ndjekin Afatin e ri kur ndryshon — përndryshe pagesa mbetet
  // e "arkivuar" nën muajin e vjetër (stale) dhe bëhet e padukshme për filtrat/
  // raportet që kërkojnë muaj real (p.sh. Vit Akademik). Nëse frontend-i dërgon
  // month/year të llogaritur (siç bën tani CategoryPaymentPage), respektohen ato;
  // përndryshe llogariten direkt nga Afati, kurrë nuk lihen jashtë përditësimit.
  const month = body.month != null ? parseInt(body.month) : dueDate.getMonth() + 1;
  const year  = body.year  != null ? parseInt(body.year)  : dueDate.getFullYear();

  // Gjej rekordin ekzistues për të ruajtur receiptNumber nëse ka
  const existing = await prisma.payment.findUnique({ where: { id: parseInt(id) }, select: { receiptNumber: true } });
  const needsReceipt = paidAmount > 0 && !existing?.receiptNumber;
  const receiptNumber = needsReceipt ? await generateReceiptNumber() : undefined;

  const payment = await prisma.payment.update({
    where: { id: parseInt(id) },
    data: {
      amount,
      discount,
      discountType: body.discountType || null,
      scholarship,
      finalAmount,
      dueDate,
      paidDate: paidAmount > 0 ? (body.paidDate ? new Date(body.paidDate) : new Date()) : null,
      paidAmount,
      balance,
      method: body.method || null,
      status,
      description: body.description || null,
      month,
      year,
      ...(receiptNumber ? { receiptNumber } : {}),
    },
    include: { student: { select: { firstName: true, lastName: true } }, category: { select: { name: true } } },
  });

  await logAction(session, "UPDATE", "Payment", payment.id,
    `Ndryshoi pagesën e ${payment.student.firstName} ${payment.student.lastName} (${payment.category.name}) — ${finalAmount}€`);

  return NextResponse.json(payment);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const paymentId = parseInt(id);
  const existing = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { student: { select: { firstName: true, lastName: true } }, category: { select: { name: true } } },
  });

  await prisma.payment.delete({ where: { id: paymentId } });

  if (existing) {
    await logAction(session, "DELETE", "Payment", paymentId,
      `Fshiu pagesën e ${existing.student.firstName} ${existing.student.lastName} (${existing.category.name}) — ${existing.finalAmount}€`);
  }

  return NextResponse.json({ success: true });
}
