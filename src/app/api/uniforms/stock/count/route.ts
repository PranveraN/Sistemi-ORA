import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { getStock } from "@/lib/uniStock";

// "Numërim stoku": sa copë ka realisht sot për çdo numër. Për çdo ndryshim nga
// stoku i llogaritur krijohet një hyrje korrigjuese (kind NUMERIM). Nuk prek
// shitjet, koston, fitimin, borxhet, dorëzimet apo arkën.
// body: { productId, date?, counts: { [size]: number } } — numrat bosh anashkalohen
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const productId = parseInt(body.productId);
  const date = body.date ? new Date(body.date) : new Date();
  if (!productId) return NextResponse.json({ error: "Zgjidh produktin" }, { status: 400 });
  if (isNaN(date.getTime())) return NextResponse.json({ error: "Data s'është e vlefshme" }, { status: 400 });

  const { rows } = await getStock();
  const row = rows.find(r => r.productId === productId);
  if (!row) return NextResponse.json({ error: "Produkti nuk u gjet" }, { status: 404 });

  const counts: Record<string, unknown> = body.counts && typeof body.counts === "object" ? body.counts : {};
  const fixes: { size: string; quantity: number; from: number; to: number }[] = [];
  for (const [size, raw] of Object.entries(counts)) {
    if (raw === "" || raw === null || raw === undefined) continue;
    const real = parseInt(String(raw));
    if (!Number.isFinite(real) || real < 0) return NextResponse.json({ error: `Sasia për nr. ${size} s'është e vlefshme` }, { status: 400 });
    const current = row.sizes.find(s => s.size === size)?.stok ?? 0;
    if (real !== current) fixes.push({ size, quantity: real - current, from: current, to: real });
  }
  if (!fixes.length) return NextResponse.json({ success: true, count: 0 });

  await prisma.uniStockEntry.createMany({
    data: fixes.map(f => ({ productId, size: f.size, quantity: f.quantity, date, kind: "NUMERIM", note: `Numërim stoku: ${f.from} → ${f.to}` })),
  });
  await logAction(session, "CREATE", "UniStockEntry", productId,
    `Numërim stoku: ${row.name} — ${fixes.map(f => `nr. ${f.size}: ${f.from} → ${f.to}`).join(", ")}`);
  return NextResponse.json({ success: true, count: fixes.length });
}
