import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

// Konverton nje Profature (type=PROFORMA) ne Fature reale (type=INVOICE) — njesoj
// si logjika e Timi Invest: krijon nje rekord te ri Invoice (numer i ri "FAT-..."),
// klonon artikujt, dhe lidh profaturen origjinale me faturen e krijuar permes
// convertedInvoiceId. Profatura origjinale mbetet e paprekur si histori.
export async function POST(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const { id } = await params;
  const profature = await prisma.invoice.findUnique({
    where: { id: parseInt(id) },
    include: { items: true },
  });
  if (!profature) return NextResponse.json({ error: "Profatura nuk u gjet" }, { status: 404 });

  if (profature.type !== "PROFORMA") {
    return NextResponse.json({ error: "Vetëm profaturat mund të konvertohen" }, { status: 400 });
  }
  if (profature.convertedInvoiceId) {
    return NextResponse.json(
      { error: "Kjo profaturë është konvertuar tashmë", invoiceId: profature.convertedInvoiceId },
      { status: 400 }
    );
  }

  try {
    const invoice = await prisma.$transaction(async tx => {
      const year = new Date().getFullYear();
      const last = await tx.invoice.findFirst({
        where: { number: { startsWith: `FAT-${year}-` }, organizationId: orgId },
        orderBy: { number: "desc" },
      });
      const lastSeq = last ? parseInt(last.number.split("-").pop() || "0") : 0;
      const number = `FAT-${year}-${String(lastSeq + 1).padStart(4, "0")}`;

      const created = await tx.invoice.create({
        data: {
          number,
          type: "INVOICE",
          studentId: profature.studentId,
          organizationId: orgId,
          subtotal: profature.subtotal,
          vatRate: profature.vatRate,
          vatAmount: profature.vatAmount,
          total: profature.total,
          status: "DRAFT",
          dueDate: profature.dueDate,
          notes: `Konvertuar nga Profatura ${profature.number}${profature.notes ? ` — ${profature.notes}` : ""}`,
          items: {
            create: profature.items.map(it => ({
              description: it.description,
              quantity: it.quantity,
              regularPrice: it.regularPrice,
              discountPct: it.discountPct,
              unitPrice: it.unitPrice,
              total: it.total,
            })),
          },
        },
        include: { items: true, student: true },
      });

      await tx.invoice.update({
        where: { id: profature.id },
        data: { convertedInvoiceId: created.id },
      });

      return created;
    });

    await logAction(session, "CREATE", "Invoice", invoice.id,
      `Konvertoi profaturën ${profature.number} në faturën ${invoice.number}`);

    return NextResponse.json(invoice, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
