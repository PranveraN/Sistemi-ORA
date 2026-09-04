import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

interface ReceiveInput { orderItemId: number; quantity: number; note?: string }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "FINANCE") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }

  const userId = Number((session.user as { id?: string }).id);
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const { id } = await params;
  const orderId = parseInt(id);

  const order = await prisma.materialOrder.findFirst({ where: { id: orderId, organizationId: orgId }, include: { items: true } });
  if (!order) return NextResponse.json({ error: "Porosia nuk u gjet" }, { status: 404 });
  if (order.status !== "ORDERED" && order.status !== "PARTIALLY_RECEIVED") {
    return NextResponse.json({ error: `Porosia duhet të jetë "Porositur" para se të pranohet (aktualisht: ${order.status})` }, { status: 400 });
  }

  const body = await req.json();
  const rawItems: ReceiveInput[] = Array.isArray(body.items) ? body.items : [];
  const byId = new Map(order.items.map(it => [it.id, it]));

  const toReceive: { orderItem: (typeof order.items)[number]; quantity: number; note: string | null }[] = [];
  for (const raw of rawItems) {
    const orderItem = byId.get(Number(raw.orderItemId));
    if (!orderItem) return NextResponse.json({ error: `Rreshti #${raw.orderItemId} nuk i përket kësaj porosie` }, { status: 400 });
    const remaining = orderItem.quantity - orderItem.receivedQuantity;
    const qty = parseInt(String(raw.quantity)) || 0;
    if (qty <= 0) continue;
    if (qty > remaining) {
      return NextResponse.json({ error: `Sasia e pranuar (${qty}) kalon sasinë e mbetur (${remaining}) për këtë rresht` }, { status: 400 });
    }
    toReceive.push({ orderItem, quantity: qty, note: raw.note ? String(raw.note).trim() || null : null });
  }

  if (!toReceive.length) {
    return NextResponse.json({ error: "Asnjë sasi e vlefshme për t'u pranuar" }, { status: 400 });
  }

  await prisma.$transaction(async (tx) => {
    for (const r of toReceive) {
      await tx.materialOrderItem.update({
        where: { id: r.orderItem.id },
        data: { receivedQuantity: { increment: r.quantity }, receivedAt: new Date(), receiveNotes: r.note ?? r.orderItem.receiveNotes },
      });

      if (r.orderItem.materialId) {
        const material = await tx.material.update({
          where: { id: r.orderItem.materialId },
          data: { currentStock: { increment: r.quantity } },
        });
        await tx.materialInventoryTransaction.create({
          data: {
            organizationId: order.organizationId,
            materialId: r.orderItem.materialId,
            type: "RECEIVED",
            quantity: r.quantity,
            balanceAfter: material.currentStock,
            orderItemId: r.orderItem.id,
            note: r.note,
            createdById: userId,
          },
        });
      }
    }

    const allItems = await tx.materialOrderItem.findMany({ where: { orderId } });
    const allReceived = allItems.every(it => it.receivedQuantity >= it.quantity);
    const anyReceived = allItems.some(it => it.receivedQuantity > 0);
    const actualCost = allItems.reduce((s, it) => s + (it.unitPrice ?? 0) * it.receivedQuantity, 0);

    await tx.materialOrder.update({
      where: { id: orderId },
      data: {
        status: allReceived ? "RECEIVED" : anyReceived ? "PARTIALLY_RECEIVED" : order.status,
        receivedDate: allReceived ? new Date() : order.receivedDate,
        actualCost: Math.round(actualCost * 100) / 100,
      },
    });
  });

  await logAction(session, "UPDATE", "MaterialOrder", orderId,
    `Pranoi ${toReceive.length} rreshta të porosisë ${order.orderNumber} — ${toReceive.reduce((s, r) => s + r.quantity, 0)} copë, stoku u rrit`);

  const updated = await prisma.materialOrder.findUnique({
    where: { id: orderId },
    include: {
      supplier: { select: { id: true, emri: true } },
      createdBy: { select: { name: true } },
      items: {
        include: {
          material: { select: { id: true, name: true } },
          requestLinks: { include: { requestItem: { select: { id: true, color: true, request: { select: { id: true, teacher: { select: { name: true } } } } } } } },
        },
      },
    },
  });

  return NextResponse.json(updated);
}
