import { prisma } from "@/lib/prisma";
import { buildStock, lowStockList } from "@/lib/uniStockCalc";

/** Momenti kur nisi stoku i ri (nga zero). Krijohet herën e parë që lexohet. */
export async function getStockStart(): Promise<Date> {
  const cfg = await prisma.uniStockConfig.upsert({ where: { id: 1 }, update: {}, create: { id: 1 } });
  return cfg.startedAt;
}

/**
 * Gjendja e stokut për çdo produkt dhe numër. Shitjet vetëm LEXOHEN — llogariten
 * ato të regjistruara (createdAt) pas nisjes së stokut të ri; shitjet e vjetra
 * s'ndikojnë. Fusha e vjetër UniProduct.stock nuk përdoret.
 */
export async function getStock() {
  const startedAt = await getStockStart();
  const [products, productSizes, entries, sold, settings] = await Promise.all([
    prisma.uniProduct.findMany({ where: { active: true }, select: { id: true, name: true, buyPrice: true, sellPrice: true, photo: true }, orderBy: { name: "asc" } }),
    prisma.uniProductSize.findMany(),
    prisma.uniStockEntry.findMany({ select: { productId: true, size: true, quantity: true } }),
    prisma.uniSaleItem.findMany({
      where: { sale: { createdAt: { gte: startedAt } } },
      select: { productId: true, size: true, quantity: true },
    }),
    prisma.uniStockSetting.findMany(),
  ]);
  const rows = buildStock({ products, productSizes, entries, sold, settings });
  const low = lowStockList(rows);
  return {
    startedAt,
    rows,
    low,
    totalItems: rows.reduce((s, r) => s + r.stok, 0),
    stockValue: rows.reduce((s, r) => s + Math.max(0, r.stok) * r.buyPrice, 0),
  };
}
