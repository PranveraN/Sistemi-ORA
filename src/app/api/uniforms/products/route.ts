import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getStock } from "@/lib/uniStock";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("active") === "true";
  const where = activeOnly ? { active: true } : {};
  const [products, stock] = await Promise.all([
    prisma.uniProduct.findMany({
      where,
      orderBy: { name: "asc" },
      include: { _count: { select: { saleItems: true } } },
    }),
    getStock(),
  ]);
  // "stock" në përgjigje vjen nga stoku i ri sipas numrit; fusha e vjetër s'shfaqet më.
  const byId = new Map(stock.rows.map(r => [r.productId, r]));
  return NextResponse.json(products.map(p => ({
    ...p,
    stock: byId.get(p.id)?.stok ?? 0,
    lowStock: (byId.get(p.id)?.lowCount ?? 0) > 0,
  })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const product = await prisma.uniProduct.create({
    data: {
      name:        body.name,
      description: body.description || null,
      photo:       body.photo       || null,
      buyPrice:    parseFloat(body.buyPrice),
      sellPrice:   parseFloat(body.sellPrice),
      stock:       parseInt(body.stock || "0"),
      stockAlert:  parseInt(body.stockAlert || "5"),
    },
  });
  return NextResponse.json(product, { status: 201 });
}
