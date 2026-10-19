import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { getStock } from "@/lib/uniStock";

// Gjendja e stokut + hyrjet e fundit. Shitjet vetëm lexohen.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [stock, entries] = await Promise.all([
    getStock(),
    prisma.uniStockEntry.findMany({ orderBy: [{ date: "desc" }, { id: "desc" }], take: 200 }),
  ]);
  return NextResponse.json({ ...stock, entries });
}

// Hyrje e re: një produkt, disa numra njëherësh. Ruhen vetëm sasitë > 0.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const productId = parseInt(body.productId);
  const date = body.date ? new Date(body.date) : new Date();
  const note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;
  const lines = (Array.isArray(body.lines) ? body.lines : [])
    .map((l: { size?: string; quantity?: string | number }) => ({ size: String(l.size ?? "").trim(), quantity: parseInt(String(l.quantity ?? "")) }))
    .filter((l: { size: string; quantity: number }) => l.size && Number.isFinite(l.quantity) && l.quantity > 0);

  if (!productId) return NextResponse.json({ error: "Zgjidh produktin" }, { status: 400 });
  if (isNaN(date.getTime())) return NextResponse.json({ error: "Data s'është e vlefshme" }, { status: 400 });
  if (!lines.length) return NextResponse.json({ error: "Shkruaj sasinë të paktën për një numër" }, { status: 400 });
  const product = await prisma.uniProduct.findUnique({ where: { id: productId }, select: { name: true } });
  if (!product) return NextResponse.json({ error: "Produkti nuk u gjet" }, { status: 404 });

  await prisma.uniStockEntry.createMany({
    data: lines.map((l: { size: string; quantity: number }) => ({ productId, size: l.size, quantity: l.quantity, date, note, kind: "HYRJE" })),
  });
  const total = lines.reduce((s: number, l: { quantity: number }) => s + l.quantity, 0);
  await logAction(session, "CREATE", "UniStockEntry", productId,
    `Hyrje stoku: ${product.name} — ${lines.map((l: { size: string; quantity: number }) => `nr. ${l.size}: ${l.quantity}`).join(", ")} (gjithsej ${total} copë)`);
  return NextResponse.json({ success: true, count: lines.length, total }, { status: 201 });
}
