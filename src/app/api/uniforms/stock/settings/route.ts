import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

// Numrat e një produkti + pragu minimal për çdo numër. Tabela e produkteve s'preket.
// body: { productId, sizes: string[], thresholds: { [size]: number } }
export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const productId = parseInt(body.productId);
  if (!productId) return NextResponse.json({ error: "Zgjidh produktin" }, { status: 400 });
  const product = await prisma.uniProduct.findUnique({ where: { id: productId }, select: { name: true } });
  if (!product) return NextResponse.json({ error: "Produkti nuk u gjet" }, { status: 404 });

  const sizes: string[] = [...new Set<string>((Array.isArray(body.sizes) ? body.sizes : []).map((s: unknown) => String(s).trim()).filter(Boolean))];
  if (!sizes.length) return NextResponse.json({ error: "Produkti duhet të ketë të paktën një numër" }, { status: 400 });
  const thresholds: Record<string, unknown> = body.thresholds && typeof body.thresholds === "object" ? body.thresholds : {};

  await prisma.$transaction([
    prisma.uniProductSize.deleteMany({ where: { productId } }),
    prisma.uniProductSize.createMany({ data: sizes.map((size, i) => ({ productId, size, sortOrder: i })) }),
    prisma.uniStockSetting.deleteMany({ where: { productId } }),
    prisma.uniStockSetting.createMany({
      data: sizes
        .map(size => ({ productId, size, minThreshold: Math.max(0, parseInt(String(thresholds[size] ?? "0")) || 0) }))
        .filter(s => s.minThreshold > 0),
    }),
  ]);
  await logAction(session, "UPDATE", "UniStockSetting", productId,
    `Numrat/pragjet e stokut për ${product.name}: ${sizes.map(s => `${s}${thresholds[s] ? ` (prag ${thresholds[s]})` : ""}`).join(", ")}`);
  return NextResponse.json({ success: true });
}
