import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStock } from "@/lib/uniStock";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [sales, handovers, products, saleItems, stock, bankPaid] = await Promise.all([
    prisma.uniSale.findMany({ select: { totalAmount: true, totalCost: true, profit: true, paidAmount: true, balance: true, status: true, saleDate: true } }),
    prisma.uniHandover.findMany({ select: { amount: true, handoverAt: true } }),
    prisma.uniProduct.findMany({ select: { id: true, stock: true, buyPrice: true, sellPrice: true, stockAlert: true, active: true, name: true } }),
    prisma.uniSaleItem.findMany({ select: { productId: true, quantity: true, total: true, profit: true, buyPrice: true, sellPrice: true } }),
    getStock(),
    prisma.uniPayment.aggregate({ where: { method: "BANK" }, _sum: { amount: true } }),
  ]);

  const totalRevenue    = sales.reduce((s, x) => s + x.totalAmount, 0);
  const totalCost       = sales.reduce((s, x) => s + x.totalCost,   0);
  const totalProfit     = sales.reduce((s, x) => s + x.profit,      0);
  const totalCollected  = sales.reduce((s, x) => s + x.paidAmount,  0);
  const totalDebt       = sales.reduce((s, x) => s + x.balance,     0);
  // Dorëzimet para shitjes së parë të regjistruar në sistem i takojnë periudhave
  // të mëhershme (shitje që s'janë në sistem) — s'zbriten nga paratë e marra këtu,
  // përndryshe arka dilte me mungesë të rreme (p.sh. −14.793 €). Shfaqen veç.
  const firstSale = sales.reduce<Date | null>((min, x) => (!min || x.saleDate < min ? x.saleDate : min), null);
  const startOfFirstSaleDay = firstSale ? new Date(firstSale.getFullYear(), firstSale.getMonth(), firstSale.getDate()) : null;
  const isEarlier = (d: Date) => !!startOfFirstSaleDay && d < startOfFirstSaleDay;
  const earlierHandedOver = handovers.filter(h => isEarlier(h.handoverAt)).reduce((s, x) => s + x.amount, 0);
  const totalHandedOver = handovers.filter(h => !isEarlier(h.handoverAt)).reduce((s, x) => s + x.amount, 0);
  // Në arkë mbetet vetëm cash-i: pagesat me bankë s'kalojnë nëpër dorë.
  const collectedBank   = bankPaid._sum.amount ?? 0;
  const collectedCash   = totalCollected - collectedBank;
  const remainingProfit = collectedCash - totalHandedOver;

  // Stoku vjen nga sistemi i ri sipas numrit (hyrjet − shitjet pas nisjes) —
  // fusha e vjetër UniProduct.stock s'përdoret më.
  const stockValue   = stock.stockValue;
  const lowStock     = stock.low.map(l => ({ name: l.name, stock: l.stock }));
  const totalItems   = stock.totalItems;

  // Shitjet sipas produktit
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
        name:    productMap.get(item.productId) ?? `Produkt #${item.productId}`,
        qty:     item.quantity,
        revenue: item.total,
        cost,
        profit:  item.profit,
      });
    }
  }
  const productSales = Array.from(byProduct.values())
    .sort((a, b) => b.revenue - a.revenue);

  return NextResponse.json({
    totalRevenue,
    totalCost,
    totalProfit,
    totalCollected,
    totalDebt,
    totalHandedOver,
    remainingProfit,
    earlierHandedOver,
    collectedCash,
    collectedBank,
    firstSaleDate: firstSale,
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
