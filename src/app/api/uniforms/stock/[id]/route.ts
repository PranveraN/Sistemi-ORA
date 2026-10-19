import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

// Korrigjimi i një hyrjeje stoku (numri, sasia, data, shënimi).
export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseInt((await params).id);
  const existing = await prisma.uniStockEntry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Hyrja nuk u gjet" }, { status: 404 });

  const body = await req.json();
  const data: { size?: string; quantity?: number; date?: Date; note?: string | null } = {};
  if (body.size !== undefined) {
    const size = String(body.size).trim();
    if (!size) return NextResponse.json({ error: "Numri mungon" }, { status: 400 });
    data.size = size;
  }
  if (body.quantity !== undefined) {
    const q = parseInt(String(body.quantity));
    // Hyrjet e zakonshme janë pozitive; korrigjimi nga numërimi mund të jetë negativ.
    if (!Number.isFinite(q) || q === 0 || (existing.kind === "HYRJE" && q < 0)) {
      return NextResponse.json({ error: "Sasia s'është e vlefshme" }, { status: 400 });
    }
    data.quantity = q;
  }
  if (body.date !== undefined) {
    const d = new Date(body.date);
    if (isNaN(d.getTime())) return NextResponse.json({ error: "Data s'është e vlefshme" }, { status: 400 });
    data.date = d;
  }
  if (body.note !== undefined) data.note = typeof body.note === "string" && body.note.trim() ? body.note.trim() : null;

  const entry = await prisma.uniStockEntry.update({ where: { id }, data });
  await logAction(session, "UPDATE", "UniStockEntry", id,
    `Ndryshoi hyrjen e stokut #${id}: nr. ${existing.size} ${existing.quantity} copë → nr. ${entry.size} ${entry.quantity} copë`);
  return NextResponse.json(entry);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = parseInt((await params).id);
  const existing = await prisma.uniStockEntry.findUnique({ where: { id } });
  if (!existing) return NextResponse.json({ error: "Hyrja nuk u gjet" }, { status: 404 });
  await prisma.uniStockEntry.delete({ where: { id } });
  await logAction(session, "DELETE", "UniStockEntry", id,
    `Fshiu hyrjen e stokut #${id} (produkti ${existing.productId}, nr. ${existing.size}, ${existing.quantity} copë)`);
  return NextResponse.json({ success: true });
}
