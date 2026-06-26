import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const s = (v: string | null | undefined) =>
  v != null && v !== "" ? `'${String(v).replace(/'/g, "''")}'` : "NULL";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  const { name, description, buyPrice, sellPrice, stock, active } = await req.json();

  await prisma.$executeRawUnsafe(`
    UPDATE BookProduct SET
      name=${s(name)}, description=${s(description)},
      buyPrice=${parseFloat(buyPrice)}, sellPrice=${parseFloat(sellPrice)},
      stock=${parseInt(stock||"0")}, active=${active===false?0:1},
      updatedAt=datetime('now')
    WHERE id=${parseInt(id)}
  `);
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;
  await prisma.$executeRawUnsafe(`UPDATE BookProduct SET active=0, updatedAt=datetime('now') WHERE id=${parseInt(id)}`);
  return NextResponse.json({ ok: true });
}
