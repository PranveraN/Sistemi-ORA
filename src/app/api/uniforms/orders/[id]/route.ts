import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const orderId = parseInt(id);
  const body = await req.json();
  const status = body.status as string;

  const existing = await prisma.uniOrder.findUnique({
    where: { id: orderId },
    include: { items: true },
  });
  if (!existing) return NextResponse.json({ error: "Porosia nuk u gjet" }, { status: 404 });

  if (status === "RECEIVED" && existing.status !== "RECEIVED") {
    // Rrit stokun e çdo produkti sipas sasisë së porositur (transaksion — ose të gjitha, ose asnjë)
    await prisma.$transaction([
      ...existing.items.map(it =>
        prisma.uniProduct.update({
          where: { id: it.productId },
          data: { stock: { increment: it.quantity } },
        })
      ),
      prisma.uniOrder.update({
        where: { id: orderId },
        data: { status: "RECEIVED", receivedDate: new Date() },
      }),
    ]);
    await logAction(session, "UPDATE", "UniOrder", orderId,
      `Shënoi porosinë ${existing.orderNumber} si "Mbërriti" — stoku u rrit për ${existing.items.length} produkte`);
  } else {
    await prisma.uniOrder.update({ where: { id: orderId }, data: { status } });
    await logAction(session, "UPDATE", "UniOrder", orderId,
      `Ndryshoi statusin e porosisë ${existing.orderNumber} në ${status}`);
  }

  const updated = await prisma.uniOrder.findUnique({
    where: { id: orderId },
    include: { items: { include: { product: { select: { name: true } } } } },
  });
  return NextResponse.json(updated);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const orderId = parseInt(id);

  const existing = await prisma.uniOrder.findUnique({ where: { id: orderId } });
  if (!existing) return NextResponse.json({ error: "Porosia nuk u gjet" }, { status: 404 });
  if (existing.status === "RECEIVED") {
    return NextResponse.json({ error: "Kjo porosi tashmë ka mbërritur — s'mund të fshihet (do të prishte stokun)." }, { status: 400 });
  }

  await prisma.uniOrder.delete({ where: { id: orderId } });
  await logAction(session, "DELETE", "UniOrder", orderId, `Fshiu porosinë ${existing.orderNumber}`);

  return NextResponse.json({ success: true });
}
