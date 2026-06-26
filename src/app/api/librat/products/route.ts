import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function safe(n: unknown) { return Number(n) || 0; }
function num(r: Record<string, unknown>) {
  return { ...r, id: Number(r.id), buyPrice: safe(r.buyPrice), sellPrice: safe(r.sellPrice), stock: safe(r.stock) };
}

export async function GET(_req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM BookProduct WHERE active = 1 ORDER BY name ASC`
  );
  return NextResponse.json(rows.map(num));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { name, description, buyPrice, sellPrice, stock } = await req.json();
  const s = (v: string | null | undefined) =>
    v != null && v !== "" ? `'${String(v).replace(/'/g, "''")}'` : "NULL";

  const [row] = await prisma.$queryRawUnsafe<{ id: bigint }[]>(`
    INSERT INTO BookProduct (name, description, buyPrice, sellPrice, stock, active, createdAt, updatedAt)
    VALUES (${s(name)}, ${s(description)}, ${parseFloat(buyPrice)}, ${parseFloat(sellPrice)}, ${parseInt(stock||"0")}, 1, datetime('now'), datetime('now'))
    RETURNING id
  `);
  return NextResponse.json({ id: Number(row.id) }, { status: 201 });
}
