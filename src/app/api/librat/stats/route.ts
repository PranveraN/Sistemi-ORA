import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LOW_STOCK_THRESHOLD = 5;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from") || "";
  const to   = searchParams.get("to") || "";

  // SQL i papërpunuar për filtrin e datës (jo `saleDate: {gte,lte}` i Prisma-s) —
  // sepse BookSale.saleDate/BookHandover.handoverAt shkruhen gjithmonë nëpërmjet
  // SQL-it të papërpunuar (`datetime('now')`, shih /api/librat/sales/route.ts),
  // jo `.create()` i Prisma-s. Formati i ruajtur në SQLite s'përputhet me atë që
  // pret motori i pyetjeve TIPIZUARA të Prisma-s për `lte`/`lt` — krahasimi i
  // tillë kthen 0 rezultate edhe kur data është qartazi brenda intervalit
  // (konfirmuar me teste direkte: `gte` funksiononte, `lte` jo, as për "lte 2030").
  // Krahasimi tekstual i thjeshtë (siç bën /api/librat/sales) funksionon saktë.
  let saleWhere = "WHERE 1=1";
  if (from) saleWhere += ` AND saleDate >= '${from}'`;
  if (to)   saleWhere += ` AND saleDate <= '${to}'`;
  let handoverWhere = "WHERE 1=1";
  if (from) handoverWhere += ` AND handoverAt >= '${from}'`;
  if (to)   handoverWhere += ` AND handoverAt <= '${to}'`;

  const [salesRaw, handoversRaw, products] = await Promise.all([
    prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT id, totalAmount, totalCost, profit, paidAmount, balance, status FROM BookSale ${saleWhere}`
    ),
    prisma.$queryRawUnsafe<Record<string, unknown>[]>(
      `SELECT amount FROM BookHandover ${handoverWhere}`
    ),
    prisma.bookProduct.findMany({
      select: { id: true, name: true, stock: true, buyPrice: true, sellPrice: true, active: true },
    }),
  ]);

  const sales = salesRaw.map(s => ({
    id: Number(s.id), totalAmount: Number(s.totalAmount), totalCost: Number(s.totalCost),
    profit: Number(s.profit), paidAmount: Number(s.paidAmount), balance: Number(s.balance),
    status: String(s.status),
  }));
  const handovers = handoversRaw.map(h => ({ amount: Number(h.amount) }));

  // BookSaleItem s'ka relacion Prisma drejt BookSale (vetëm saleId si kolonë e thjeshtë),
  // ndaj kufizohet me listën e ID-ve të shitjeve tashmë të filtruara sipas datës.
  const saleItems = sales.length
    ? await prisma.bookSaleItem.findMany({
        where: { saleId: { in: sales.map(s => s.id) } },
        select: { productId: true, quantity: true, total: true, profit: true, buyPrice: true, sellPrice: true },
      })
    : [];

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
