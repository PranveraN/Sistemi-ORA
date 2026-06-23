import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const month = searchParams.get("month") ? parseInt(searchParams.get("month")!) : 0;
  const year  = searchParams.get("year")  ? parseInt(searchParams.get("year")!)  : 0;

  async function getCategoryStats(categoryName: string, isMonthly = true) {
    const category = await prisma.paymentCategory.findFirst({
      where: { name: { equals: categoryName } },
    });
    if (!category) return { totalRevenue: 0, totalDebt: 0, count: 0 };

    const where: Record<string, unknown> = { categoryId: category.id };
    if (isMonthly && month > 0) where.month = month;
    if (year > 0) where.year = year;

    const agg = await prisma.payment.aggregate({
      where,
      _sum: { paidAmount: true, balance: true },
      _count: { id: true },
    });

    return {
      totalRevenue: agg._sum.paidAmount ?? 0,
      totalDebt:    agg._sum.balance    ?? 0,
      count:        agg._count.id,
    };
  }

  // Uniforma: filter by saleDate month/year
  const uniformWhere: Record<string, unknown> = {};
  if (month > 0 && year > 0) {
    uniformWhere.saleDate = {
      gte: new Date(year, month - 1, 1),
      lt:  new Date(year, month, 1),
    };
  } else if (year > 0) {
    uniformWhere.saleDate = {
      gte: new Date(year, 0, 1),
      lt:  new Date(year + 1, 0, 1),
    };
  }

  // Hyra (Të Tjera): filter by muaj/vit
  const hyraWhere: Record<string, unknown> = {};
  if (month > 0) hyraWhere.muaj = month;
  if (year  > 0) hyraWhere.vit  = year;

  const [shkollimi, ushqimi, eshkollori, uniformAgg, hyraAgg] = await Promise.all([
    getCategoryStats("Shkollimi", true),
    getCategoryStats("Ushqimi", true),
    getCategoryStats("Librat & Shkollorja", false),
    prisma.uniSale.aggregate({
      where: uniformWhere,
      _sum:   { paidAmount: true, totalAmount: true, balance: true },
      _count: { id: true },
    }),
    prisma.hyra.aggregate({
      where: hyraWhere,
      _sum:   { shuma: true },
      _count: { id: true },
    }),
  ]);

  const uniforma = {
    totalRevenue: uniformAgg._sum.totalAmount ?? 0,
    totalCollected: uniformAgg._sum.paidAmount ?? 0,
    totalDebt:  uniformAgg._sum.balance    ?? 0,
    count:      uniformAgg._count.id,
  };

  const tjera = {
    totalShuma: hyraAgg._sum.shuma ?? 0,
    count:      hyraAgg._count.id,
  };

  const grandTotal =
    shkollimi.totalRevenue +
    ushqimi.totalRevenue +
    eshkollori.totalRevenue +
    uniforma.totalCollected +
    tjera.totalShuma;

  return NextResponse.json({ shkollimi, ushqimi, eshkollori, uniforma, tjera, grandTotal });
}
