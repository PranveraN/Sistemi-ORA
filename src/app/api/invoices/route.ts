import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const { searchParams } = new URL(req.url);
  const studentId = searchParams.get("studentId") || "";
  const type = searchParams.get("type") || "";
  const status = searchParams.get("status") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const where: Record<string, unknown> = { organizationId: orgId };
  if (studentId) where.studentId = parseInt(studentId);
  if (type) where.type = type;
  if (status) where.status = status;

  const [invoices, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        items: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.invoice.count({ where }),
  ]);

  return NextResponse.json({ invoices, total });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  try {
    const body = await req.json();

    const vatRate = parseFloat(body.vatRate) || 0;
    const subtotal = body.items.reduce((sum: number, item: { regularPrice: number; discountPct: number; unitPrice: number; quantity: number; total: number }) => {
      const reg  = parseFloat(String(item.regularPrice)) || 0;
      const disc = parseFloat(String(item.discountPct))  || 0;
      const unit = reg > 0 ? Math.round(reg * (1 - disc / 100) * 100) / 100 : (parseFloat(String(item.unitPrice)) || 0);
      return sum + Math.round(item.quantity * unit * 100) / 100;
    }, 0);
    const vatAmount = (subtotal * vatRate) / 100;
    const total = subtotal + vatAmount;

    const prefix = body.type === "INVOICE" ? "FAT" : body.type === "PROFORMA" ? "PRO" : "OFR";
    const year = new Date().getFullYear();
    const lastInvoice = await prisma.invoice.findFirst({
      where: { number: { startsWith: `${prefix}-${year}-` }, organizationId: orgId },
      orderBy: { number: "desc" },
    });
    const lastSeq = lastInvoice
      ? parseInt(lastInvoice.number.split("-").pop() || "0")
      : 0;
    const number = `${prefix}-${year}-${String(lastSeq + 1).padStart(4, "0")}`;

    const invoice = await prisma.invoice.create({
      data: {
        number,
        type: body.type,
        studentId: parseInt(body.studentId),
        organizationId: orgId,
        subtotal,
        vatRate,
        vatAmount,
        total,
        status: "DRAFT",
        dueDate: body.dueDate ? new Date(body.dueDate) : null,
        notes: body.notes || null,
        items: {
          create: body.items.map((item: { description: string; quantity: number; regularPrice: number; discountPct: number; unitPrice: number; total: number }) => {
            const reg  = parseFloat(String(item.regularPrice)) || 0;
            const disc = parseFloat(String(item.discountPct))  || 0;
            const unit = reg > 0 ? Math.round(reg * (1 - disc / 100) * 100) / 100 : (parseFloat(String(item.unitPrice)) || 0);
            return {
              description:  item.description,
              quantity:     item.quantity,
              regularPrice: reg,
              discountPct:  disc,
              unitPrice:    unit,
              total:        Math.round(item.quantity * unit * 100) / 100,
            };
          }),
        },
      },
      include: { items: true, student: true },
    });

    const userId = parseInt((session?.user as { id?: string } | undefined)?.id ?? "0");
    if (userId > 0) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: "CREATE",
          entity: "Invoice",
          entityId: invoice.id,
          details: `Krijoi ${invoice.number} për nxënësin ${invoice.studentId}`,
        },
      });
    }

    return NextResponse.json(invoice, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gabim i brendshëm";
    return NextResponse.json({ message: msg }, { status: 500 });
  }
}
