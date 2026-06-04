import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const page   = parseInt(searchParams.get("page") || "1");
  const limit  = parseInt(searchParams.get("limit") || "50");

  const where: Record<string, unknown> = {};
  if (status) where.status = status;
  if (search) where.customerName = { contains: search };

  const [sales, total] = await Promise.all([
    prisma.uniSale.findMany({
      where,
      include: { _count: { select: { items: true } } },
      orderBy: { saleDate: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.uniSale.count({ where }),
  ]);

  return NextResponse.json({ sales, total });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { customerName, customerPhone, items, paidAmount, method, notes, saleDate } = body;

  if (!items?.length) return NextResponse.json({ error: "Asnjë artikull" }, { status: 400 });

  // Load products to get current prices & validate stock
  const productIds = items.map((i: { productId: number }) => i.productId);
  const products = await prisma.uniProduct.findMany({ where: { id: { in: productIds } } });

  let totalAmount = 0, totalCost = 0;
  const saleItems: {
    productId: number; size: string | null; quantity: number;
    buyPrice: number; sellPrice: number; total: number; profit: number;
  }[] = [];

  for (const item of items) {
    const product = products.find(p => p.id === item.productId);
    if (!product) continue;
    const qty = parseInt(item.quantity);

    if (product.stock < qty) {
      return NextResponse.json(
        { error: `Stoku i pamjaftueshëm për "${product.name}". Disponibël: ${product.stock}, kërkuar: ${qty}.` },
        { status: 400 }
      );
    }

    const buy        = product.buyPrice;
    const sell       = item.sellPrice ? parseFloat(item.sellPrice) : product.sellPrice;
    const itemTotal  = sell * qty;
    const itemProfit = (sell - buy) * qty;
    totalAmount += itemTotal;
    totalCost   += buy * qty;
    saleItems.push({ productId: product.id, size: item.size || null, quantity: qty, buyPrice: buy, sellPrice: sell, total: itemTotal, profit: itemProfit });
  }

  const profit    = totalAmount - totalCost;
  const paid      = parseFloat(paidAmount || "0");
  const balance   = Math.max(0, totalAmount - paid);
  const status    = paid >= totalAmount ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING";

  let sale;
  try {
  sale = await prisma.uniSale.create({
    data: {
      customerName,
      customerPhone: customerPhone || null,
      totalAmount,
      totalCost,
      profit,
      paidAmount: paid,
      balance,
      status,
      notes:    notes    || null,
      saleDate: saleDate ? new Date(saleDate) : new Date(),
      items: { create: saleItems },
      ...(paid > 0 ? {
        payments: { create: { amount: paid, method: method || "CASH" } },
      } : {}),
    },
    include: { items: true, payments: true },
  });
  } catch(e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error("Sale create error:", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  // Decrease stock for each product
  for (const item of saleItems) {
    await prisma.uniProduct.update({
      where: { id: item.productId },
      data: { stock: { decrement: item.quantity } },
    });
  }

  return NextResponse.json(sale, { status: 201 });
}
