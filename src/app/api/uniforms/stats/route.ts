import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [sales, handovers, products] = await Promise.all([
    prisma.uniSale.findMany({ select: { totalAmount: true, totalCost: true, profit: true, paidAmount: true, balance: true, status: true } }),
    prisma.uniHandover.findMany({ select: { amount: true } }),
    prisma.uniProduct.findMany({ select: { stock: true, buyPrice: true, sellPrice: true, stockAlert: true, active: true, name: true } }),
  ]);

  const totalRevenue    = sales.reduce((s, x) => s + x.totalAmount, 0);
  const totalCost       = sales.reduce((s, x) => s + x.totalCost,   0);
  const totalProfit     = sales.reduce((s, x) => s + x.profit,      0);
  const totalCollected  = sales.reduce((s, x) => s + x.paidAmount,  0);
  const totalDebt       = sales.reduce((s, x) => s + x.balance,     0);
  const totalHandedOver = handovers.reduce((s, x) => s + x.amount,  0);
  const remainingProfit = totalCollected - totalHandedOver;

  const stockValue   = products.filter(p => p.active).reduce((s, p) => s + p.stock * p.buyPrice, 0);
  const lowStock     = products.filter(p => p.active && p.stock <= p.stockAlert);
  const totalItems   = products.filter(p => p.active).reduce((s, p) => s + p.stock, 0);

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
    salesCount:  sales.length,
    paidCount:   sales.filter(s => s.status === "PAID").length,
    partialCount: sales.filter(s => s.status === "PARTIAL").length,
    pendingCount: sales.filter(s => s.status === "PENDING").length,
  });
}
