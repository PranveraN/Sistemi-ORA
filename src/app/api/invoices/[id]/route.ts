import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

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
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const { id } = await params;
  const invoiceId = parseInt(id);
  const body = await req.json();

  const updateData: { status: string; paidDate?: Date } = { status: body.status };
  if (body.status === "PAID") updateData.paidDate = new Date();

  const invoice = await prisma.invoice.update({
    where: { id: invoiceId },
    data: updateData,
    include: { payments: true, student: { select: { firstName: true, lastName: true } } },
  });

  await logAction(session, "UPDATE", "Invoice", invoice.id,
    `Ndryshoi statusin e faturës ${invoice.number} (${invoice.student.firstName} ${invoice.student.lastName}) në ${body.status}`);

  // Kur shenohet Paguar, sigurohemi qe ekziston nje pagese reale e lidhur —
  // perndryshe fatura mbetet e shkeputur nga Te Hyrat/Raportet (ato lexojne
  // vetem nga tabela Payment, jo nga statusi i fatures).
  if (body.status === "PAID") {
    if (invoice.payments.length > 0) {
      await Promise.all(invoice.payments.map(p =>
        prisma.payment.update({
          where: { id: p.id },
          data: { paidAmount: p.finalAmount, balance: 0, status: "PAID", paidDate: p.paidDate ?? new Date() },
        })
      ));
    } else {
      let category = await prisma.paymentCategory.findFirst({ where: { name: "Faturat", organizationId: orgId } });
      if (!category) {
        category = await prisma.paymentCategory.create({
          data: { name: "Faturat", type: "one-time", defaultAmount: 0, organizationId: orgId },
        });
      }
      const payDueDate = invoice.dueDate ?? new Date();
      await prisma.payment.create({
        data: {
          studentId:   invoice.studentId,
          categoryId:  category.id,
          amount:      invoice.subtotal,
          finalAmount: invoice.total,
          paidAmount:  invoice.total,
          balance:     0,
          dueDate:     payDueDate,
          paidDate:    new Date(),
          status:      "PAID",
          method:      "CASH",
          description: `Fatura ${invoice.number}`,
          invoiceId:   invoice.id,
          organizationId: orgId,
          // Pa muaj/vit, kjo pagesë s'gjendet nga filtrat/raportet që kërkojnë muaj
          // real (p.sh. Vit Akademik te Shkollimi) — mbetet "e padukshme" edhe pse
          // ekziston, saktësisht defekti i gjetur këtë sesion te pagesat e këstizuara.
          month: payDueDate.getMonth() + 1,
          year:  payDueDate.getFullYear(),
        },
      });
    }
  }

  return NextResponse.json(invoice);
}

interface EditItemInput {
  id: number;
  description: string;
  quantity: number;
  regularPrice: number;
  discountPct: number;
}

// Modifikim i një fature EKZISTUESE (çmimi/zbritja e zërave + emri i prindit)
// — p.sh. kur duhet aplikuar një zbritje pas krijimit. Vetëm faturat ende PA
// paguar/anuluar mund të ndryshohen: një faturë "Paguar" ka tashmë një
// Payment real të lidhur me shumën origjinale (shih PUT sipër) — ndryshimi i
// totalit pas kësaj do ta linte atë pagesë "të vjetruar", të pa-përputhur më
// me faturën.
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoiceId = parseInt(id);
  const body = await req.json();

  const existing = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: true, student: { select: { id: true, firstName: true, lastName: true, parentName: true } } },
  });
  if (!existing) return NextResponse.json({ error: "Fatura nuk u gjet" }, { status: 404 });
  if (existing.status === "PAID" || existing.status === "CANCELLED") {
    return NextResponse.json({ error: "Një faturë e paguar ose e anuluar s'mund të modifikohet" }, { status: 400 });
  }

  const existingItemIds = new Set(existing.items.map(it => it.id));
  const itemsInput: EditItemInput[] = Array.isArray(body.items) ? body.items : [];
  const validItems = itemsInput.filter(it => existingItemIds.has(it.id));

  const computedItems = validItems.map(it => {
    const quantity = Math.max(0, Number(it.quantity) || 0);
    const regularPrice = Math.max(0, Number(it.regularPrice) || 0);
    const discountPct = Math.min(100, Math.max(0, Number(it.discountPct) || 0));
    const unitPrice = Math.round(regularPrice * (1 - discountPct / 100) * 100) / 100;
    const total = Math.round(unitPrice * quantity * 100) / 100;
    return { id: it.id, description: String(it.description ?? "").trim(), quantity, regularPrice, discountPct, unitPrice, total };
  });
  const subtotal = Math.round(computedItems.reduce((s, it) => s + it.total, 0) * 100) / 100;
  const vatAmount = Math.round(subtotal * (existing.vatRate / 100) * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;

  const parentName = typeof body.parentName === "string" ? body.parentName.trim() : undefined;
  const parentNameChanged = parentName !== undefined && parentName !== "" && parentName !== existing.student.parentName;

  await prisma.$transaction([
    ...computedItems.map(it => prisma.invoiceItem.update({
      where: { id: it.id },
      data: { description: it.description, quantity: it.quantity, regularPrice: it.regularPrice, discountPct: it.discountPct, unitPrice: it.unitPrice, total: it.total },
    })),
    prisma.invoice.update({ where: { id: invoiceId }, data: { subtotal, vatAmount, total } }),
    ...(parentNameChanged ? [prisma.student.update({ where: { id: existing.student.id }, data: { parentName } })] : []),
  ]);

  await logAction(session, "UPDATE", "Invoice", invoiceId,
    `Modifikoi faturën ${existing.number} (${existing.student.firstName} ${existing.student.lastName})${parentNameChanged ? " — ndryshoi edhe emrin e prindit" : ""}`);

  const updated = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: true, student: { include: { class: true } } },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const invoiceId = parseInt(id);

  const existing = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { student: { select: { firstName: true, lastName: true } } },
  });

  // Largo lidhjen me pagesat para fshirjes (invoiceId është opsional në Payment)
  await prisma.payment.updateMany({
    where: { invoiceId },
    data:  { invoiceId: null },
  });
  // InvoiceItem fshihet automatikisht (onDelete: Cascade në schema)
  await prisma.invoice.delete({ where: { id: invoiceId } });

  if (existing) {
    await logAction(session, "DELETE", "Invoice", invoiceId,
      `Fshiu faturën ${existing.number} (${existing.student.firstName} ${existing.student.lastName}) — ${existing.total}€`);
  }

  return NextResponse.json({ ok: true });
}
