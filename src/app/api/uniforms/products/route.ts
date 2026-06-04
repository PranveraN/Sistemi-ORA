import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { searchParams } = new URL(req.url);
  const activeOnly = searchParams.get("active") === "true";
  const where = activeOnly ? { active: true } : {};
  const products = await prisma.uniProduct.findMany({
    where,
    orderBy: { name: "asc" },
    include: { _count: { select: { saleItems: true } } },
  });
  return NextResponse.json(products);
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
