import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

const ALLOWED_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["ORDERED", "CANCELLED"],
  ORDERED: ["CANCELLED"], // "RECEIVED"/"PARTIALLY_RECEIVED" vijnë te Faza 7 (Pranimi)
};

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "FINANCE") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const { id } = await params;
  const orderId = parseInt(id);

  const existing = await prisma.materialOrder.findFirst({ where: { id: orderId, organizationId: orgId } });
  if (!existing) return NextResponse.json({ error: "Porosia nuk u gjet" }, { status: 404 });

  const body = await req.json();

  if (body.status !== undefined) {
    const status = String(body.status);
    if (!ALLOWED_TRANSITIONS[existing.status]?.includes(status)) {
      return NextResponse.json({ error: `S'mund të kalosh nga "${existing.status}" në "${status}"` }, { status: 400 });
    }
    await prisma.materialOrder.update({ where: { id: orderId }, data: { status } });
    await logAction(session, "UPDATE", "MaterialOrder", orderId, `Ndryshoi statusin e porosisë ${existing.orderNumber} në ${status}`);
  } else {
    await prisma.materialOrder.update({
      where: { id: orderId },
      data: {
        ...(body.notes !== undefined && { notes: body.notes || null }),
        ...(body.expectedDeliveryDate !== undefined && { expectedDeliveryDate: body.expectedDeliveryDate ? new Date(body.expectedDeliveryDate) : null }),
      },
    });
  }

  const updated = await prisma.materialOrder.findUnique({
    where: { id: orderId },
    include: {
      supplier: { select: { id: true, emri: true } },
      createdBy: { select: { name: true } },
      items: {
        include: {
          material: { select: { id: true, name: true } },
          requestLinks: {
            include: { requestItem: { select: { id: true, color: true, request: { select: { id: true, teacher: { select: { name: true } } } } } } },
          },
        },
      },
    },
  });

  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "FINANCE") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const { id } = await params;
  const orderId = parseInt(id);

  const existing = await prisma.materialOrder.findFirst({ where: { id: orderId, organizationId: orgId } });
  if (!existing) return NextResponse.json({ error: "Porosia nuk u gjet" }, { status: 404 });
  if (existing.status !== "PENDING") {
    return NextResponse.json({ error: "Vetëm porositë ende të pakonfirmuara (PENDING) mund të fshihen — anuloje në vend të kësaj." }, { status: 400 });
  }

  await prisma.materialOrder.delete({ where: { id: orderId } });
  await logAction(session, "DELETE", "MaterialOrder", orderId, `Fshiu porosinë ${existing.orderNumber}`);

  return NextResponse.json({ success: true });
}
