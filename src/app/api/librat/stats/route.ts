import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LOW_STOCK_THRESHOLD = 5;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to   = searchParams.get("to");

  const dateFilter = from || to ? {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to   ? { lte: new Date(to) }   : {}),
  } : undefined;

  const [sales, handovers, products] = await Promise.all([
    prisma.bookSale.findMany({
      where: dateFilter ? { saleDate: dateFilter } : {},
      select: { id: true, totalAmount: true, totalCost: true, profit: true, paidAmount: true, balance: true, status: true },
    }),
    prisma.bookHandover.findMany({
      where: dateFilter ? { handoverAt: dateFilter } : {},
      select: { amount: true },
    }),
    prisma.bookProduct.findMany({
      select: { id: true, name: true, stock: true, buyPrice: true, sellPrice: true, active: true },
    }),
  ]);

  // BookSaleItem s'ka relacion Prisma drejt BookSale (vetëm saleId si kolonë e thjeshtë),
  // ndaj kufizohet me listën e ID-ve të shitjeve tashmë të filtruara sipas datës.
  const saleItems = await prisma.bookSaleItem.findMany({
    where: { saleId: { in: sales.map(s => s.id) } },
    select: { productId: true, quantity: true, total: true, profit: true, buyPrice: true, sellPrice: true },
  });

  const totalRevenue    = sales.reduce((s, x) => s + x.totalAmount, 0);
  const totalCost       = sales.reduce((s, x) => s + x.totalCost,   0);
  const totalProfit     = sales.reduce((s, x) => s + x.profit,      0);
  const totalCollected  = sales.reduce((s, x) => s + x.paidAmount,  0);
  const totalDebt       = sales.reduce((s, x) => s + x.balance,     0);
  const totalHandedOver = handovers.reduce((s, x) => s + x.amount,  0);
  const remainingProfit = totalCollected - totalHandedOver;

  const stockValue = products.filter(p => p.active).reduce((s, p) => s + p.stock * p.buyPrice, 0);
  const lowStock   = products.filter(p => p.active && p.stock <= LOW_STOCK_THRESHOLD);
  const totalItems = products.filter(p => p.active).reduce((s, p) => s + p.stock, 0);

  // Shitjet sipas librit
  const productMap = new Map(products.map(p => [p.id, p.name]));
  const byProduct = new Map<number, { name: string; qty: number; revenue: number; cost: number; profit: number }>();
  for (const item of saleItems) {
    const existing = byProduct.get(item.productId);
    const cost = item.buyPrice * item.quantity;
    if (existing) {
      existing.qty     += item.quantity;
      existing.revenue += item.total;
      existing.cost    += cost;
      existing.profit  += item.profit;
    } else {
      byProduct.set(item.productId, {
        name:    productMap.get(item.productId) ?? `Libri #${item.productId}`,
        qty:     item.quantity,
        revenue: item.total,
        cost,
        profit:  item.profit,
      });
    }
  }
  const productSales = Array.from(byProduct.values()).sort((a, b) => b.revenue - a.revenue);

  return NextResponse.json({
    totalRevenue,
    totalCost,
    totalProfit,
    totalCollected,
    totalDebt,
    totalHandedOver,
    remainingProfit,
    stockValue,
    totalItems,
    lowStock,
    salesCount:   sales.length,
    paidCount:    sales.filter(s => s.status === "PAID").length,
    partialCount: sales.filter(s => s.status === "PARTIAL").length,
    pendingCount: sales.filter(s => s.status === "PENDING").length,
    productSales,
  });
}
