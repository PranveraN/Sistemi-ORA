import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

interface ProfatureItem {
  name: string;
  regularPrice: number;
  discountPct: number;
  manualDiscAmt?: number;
  finalAmount: number;
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (!["ADMIN", "SUPERADMIN", "FINANCE"].includes(role ?? "")) {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const { id } = await params;
  const profature = await prisma.timiInvestInvoice.findUnique({ where: { id: parseInt(id) } });
  if (!profature) return NextResponse.json({ error: "Profatura nuk u gjet" }, { status: 404 });

  // E konvertuar më parë — lejohet sërish vetëm nëse ajo faturë është anuluar
  // (p.sh. faturat e vjetra "një për fëmijë" të zëvendësuara me një faturë familjeje).
  const previous = profature.regularInvoiceId
    ? await prisma.invoice.findUnique({ where: { id: profature.regularInvoiceId }, select: { status: true } })
    : null;
  if (profature.regularInvoiceId && previous && previous.status !== "CANCELLED") {
    return NextResponse.json(
      { error: "Kjo profaturë është konvertuar tashmë", invoiceId: profature.regularInvoiceId },
      { status: 400 }
    );
  }

  let items: ProfatureItem[];
  try {
    items = JSON.parse(profature.items || "[]");
  } catch {
    return NextResponse.json({ error: "Artikujt e profaturës janë të pavlefshëm" }, { status: 400 });
  }
  if (!items.length) return NextResponse.json({ error: "Profatura s'ka asnjë artikull" }, { status: 400 });

  // Zgjidh çdo artikull me nxënësin real: preferohet lidhja e ruajtur (timiStudentIds),
  // përndryshe kthehu te përputhja sipas emrit+prindit (profatura të vjetra pa lidhje).
  let timiStudentIds: number[] = [];
  try {
    timiStudentIds = profature.timiStudentIds ? JSON.parse(profature.timiStudentIds) : [];
  } catch { /* ignore */ }

  const resolved: { name: string; studentId: number | null }[] = [];

  if (timiStudentIds.length === items.length) {
    const tiStudents = await prisma.timiInvestStudent.findMany({ where: { id: { in: timiStudentIds } } });
    for (let i = 0; i < items.length; i++) {
      const ti = tiStudents.find(s => s.id === timiStudentIds[i]);
      resolved.push({ name: items[i].name, studentId: ti?.studentId ?? null });
    }
  } else {
    for (const item of items) {
      const spaceIdx = item.name.lastIndexOf(" ");
      const firstName = spaceIdx === -1 ? item.name : item.name.slice(0, spaceIdx);
      const lastName = spaceIdx === -1 ? "" : item.name.slice(spaceIdx + 1);
      let ti = await prisma.timiInvestStudent.findFirst({
        where: {
          parentName: profature.parentName,
          firstName: { equals: firstName },
          lastName: { equals: lastName },
        },
      });
      // Profatura te vjetra mund te kene prindin e profatures ndryshe nga
      // prindi i ruajtur te vete femija (p.sh. nena vs babai) — nese s'gjendet
      // perputhje e sakte me te dy fushat, kthehu te perputhja vetem sipas emrit.
      if (!ti) {
        ti = await prisma.timiInvestStudent.findFirst({
          where: { firstName: { equals: firstName }, lastName: { equals: lastName } },
        });
      }
      resolved.push({ name: item.name, studentId: ti?.studentId ?? null });
    }
  }

  const unresolved = resolved.filter(r => !r.studentId).map(r => r.name);
  if (unresolved.length) {
    return NextResponse.json(
      { error: `Këta fëmijë nuk janë të lidhur me sistemin kryesor të nxënësve: ${unresolved.join(", ")}. Lidhi së pari te "TIMI INVEST → Nxënësit".` },
      { status: 400 }
    );
  }

  const primaryStudentId = resolved[0].studentId!;

  // Profatura mund të mbulojë disa fëmijë (motra/vëllezër): krijohet NJË faturë e
  // prindit, me çdo zë të lidhur me fëmijën e vet (InvoiceItem.studentId) — si
  // faturat e familjes te "Faturë e Re". (Më parë: një faturë për çdo fëmijë, dhe
  // "Fatura e Rregullt" çonte vetëm te e para — p.sh. Ramiz Kelmendi, 2026-10-12.)
  // Borxhi i nxënësve llogaritet nga pagesat, jo nga faturat.
  try {
    const invoice = await prisma.$transaction(async tx => {
      const prefix = "FAT";
      const year = new Date().getFullYear();
      const last = await tx.invoice.findFirst({
        where: { number: { startsWith: `${prefix}-${year}-` }, organizationId: orgId },
        orderBy: { number: "desc" },
      });
      const seq = (last ? parseInt(last.number.split("-").pop() || "0") : 0) + 1;
      const number = `${prefix}-${year}-${String(seq).padStart(4, "0")}`;
      const subtotal = items.reduce((s, it) => s + it.finalAmount, 0);
      const inv = await tx.invoice.create({
        data: {
          number,
          type: "INVOICE",
          studentId: primaryStudentId,
          organizationId: orgId,
          subtotal,
          vatRate: 0,
          vatAmount: 0,
          total: subtotal,
          status: "DRAFT",
          notes: `Konvertuar nga Profaturë Timi Invest ${profature.number}${profature.notes ? ` — ${profature.notes}` : ""}`,
          items: {
            create: items.map((it, i) => ({
              studentId: resolved[i].studentId,
              description: it.name,
              quantity: 1,
              regularPrice: it.regularPrice ?? it.finalAmount,
              discountPct: it.discountPct ?? 0,
              unitPrice: it.finalAmount,
              total: it.finalAmount,
            })),
          },
        },
        include: { items: true, student: true },
      });
      await tx.timiInvestInvoice.update({ where: { id: profature.id }, data: { regularInvoiceId: inv.id } });
      return inv;
    });

    const userId = parseInt((session.user as { id?: string })?.id ?? "0");
    if (userId > 0) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: "CREATE",
          entity: "Invoice",
          entityId: invoice.id,
          details: `Konvertoi profaturën Timi Invest ${profature.number} në faturën ${invoice.number} (${items.length} ${items.length === 1 ? "fëmijë" : "fëmijë bashkë"})`,
        },
      });
    }

    return NextResponse.json({ ...invoice, invoices: [invoice] }, { status: 201 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
