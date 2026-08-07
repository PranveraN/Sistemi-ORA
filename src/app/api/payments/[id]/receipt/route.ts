import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const paymentId = parseInt(id);

  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: {
      student: {
        select: {
          id: true, firstName: true, lastName: true,
          parentName: true, fatherName: true, motherName: true,
          class: { select: { name: true } },
        },
      },
      category: { select: { name: true } },
      invoice: { select: { number: true } },
    },
  });

  if (!payment) return NextResponse.json({ error: "Pagesa nuk u gjet" }, { status: 404 });

  // Shumat e paguara para kësaj pagese (pagesat e tjera për të njëjtin nxënës+kategori).
  // Ushqimi tani ka fatura të pavarura për çdo periudhë (jo total kumulativ nëpër muaj),
  // prandaj kufizohet vetëm te i njëjti muaj/vit — përndryshe "Paguar më parë" përmbledh
  // gabimisht pagesa periudhash krejt të tjera dhe shifrat s'kanë kuptim mes tyre.
  const otherPayments = await prisma.payment.findMany({
    where: {
      studentId: payment.studentId,
      categoryId: payment.categoryId,
      id: { not: paymentId },
      paidAmount: { gt: 0 },
      ...(payment.category.name === "Ushqimi" ? { month: payment.month, year: payment.year } : {}),
    },
    select: { paidAmount: true },
  });
  const previouslyPaid = otherPayments.reduce((s, p) => s + p.paidAmount, 0);

  // Punonjësi që e regjistroi (nga audit log)
  const auditLog = await prisma.auditLog.findFirst({
    where: { entity: "Payment", entityId: paymentId },
    orderBy: { createdAt: "asc" },
    include: { user: { select: { name: true } } },
  });

  return NextResponse.json({
    receiptNumber: payment.receiptNumber,
    paymentId:     payment.id,
    student: {
      name:       `${payment.student.firstName} ${payment.student.lastName}`,
      parentName: payment.student.fatherName || payment.student.motherName || payment.student.parentName || "",
      class:      payment.student.class?.name || "",
    },
    category:      payment.category.name,
    invoiceNumber: payment.invoice?.number || null,
    finalAmount:   payment.finalAmount,
    paidAmount:    payment.paidAmount,
    previouslyPaid,
    totalPaid:     previouslyPaid + payment.paidAmount,
    balance:       payment.balance,
    method:        payment.method,
    paidDate:      payment.paidDate,
    month:         payment.month,
    year:          payment.year,
    description:   payment.description,
    registeredBy:  auditLog?.user?.name || null,
    createdAt:     payment.createdAt,
  });
}
