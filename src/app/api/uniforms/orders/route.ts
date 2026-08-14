import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orders = await prisma.uniOrder.findMany({
    include: { items: { include: { product: { select: { name: true } } } } },
    orderBy: { orderDate: "desc" },
  });
  return NextResponse.json(orders);
}

interface OrderItemInput { productId: number; quantity: number; buyPrice: number }

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const items: OrderItemInput[] = Array.isArray(body.items) ? body.items : [];
  if (items.length === 0) {
    return NextResponse.json({ error: "Porosia duhet të ketë të paktën një artikull." }, { status: 400 });
  }

  const year = new Date().getFullYear();
  const last = await prisma.uniOrder.findFirst({
    where: { orderNumber: { startsWith: `POR-${year}-` } },
    orderBy: { orderNumber: "desc" },
  });
  const lastSeq = last ? parseInt(last.orderNumber.split("-").pop() || "0") : 0;
  const orderNumber = `POR-${year}-${String(lastSeq + 1).padStart(4, "0")}`;

  const order = await prisma.uniOrder.create({
    data: {
      orderNumber,
      supplier: body.supplier || null,
      notes: body.notes || null,
      items: {
        create: items.map(it => ({
          productId: it.productId,
          quantity: it.quantity,
          buyPrice: it.buyPrice,
          total: Math.round(it.quantity * it.buyPrice * 100) / 100,
        })),
      },
    },
    include: { items: { include: { product: { select: { name: true } } } } },
  });

  const totalValue = order.items.reduce((s, it) => s + it.total, 0);
  await logAction(session, "CREATE", "UniOrder", order.id,
    `Krijoi porosinë ${order.orderNumber}${order.supplier ? ` te ${order.supplier}` : ""} — ${order.items.length} artikuj, ${totalValue}€`);

  return NextResponse.json(order, { status: 201 });
}
