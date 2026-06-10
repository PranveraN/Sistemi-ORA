import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoice = await prisma.invoice.findUnique({
    where: { id: parseInt(id) },
    include: {
      student: { include: { class: true } },
      items: true,
    },
  });

  if (!invoice) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(invoice);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();

  const invoice = await prisma.invoice.update({
    where: { id: parseInt(id) },
    data: { status: body.status },
  });

  return NextResponse.json(invoice);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoiceId = parseInt(id);

  // Largo lidhjen me pagesat para fshirjes (invoiceId është opsional në Payment)
  await prisma.payment.updateMany({
    where: { invoiceId },
    data:  { invoiceId: null },
  });
  // InvoiceItem fshihet automatikisht (onDelete: Cascade në schema)
  await prisma.invoice.delete({ where: { id: invoiceId } });

  return NextResponse.json({ ok: true });
}
