import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type KategoriRow = { id: number; emri: string; ngjyra: string | null; ikona: string | null; createdAt: string };

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await prisma.$queryRawUnsafe<KategoriRow[]>(
    `SELECT k.id, k.emri, k.ngjyra, k.ikona, k.createdAt,
            (SELECT COUNT(*) FROM Shpenzim s WHERE s.kategoriId = k.id) as _count
     FROM ShpenzimKategori k ORDER BY k.emri ASC`
  );
  const result = rows.map((r: KategoriRow & { _count?: number }) => ({
    ...r,
    _count: { shpenzime: Number((r as { _count?: unknown })._count ?? 0) },
  }));
  return NextResponse.json(result);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.emri) return NextResponse.json({ error: "Emri është i detyrueshëm" }, { status: 400 });

  await prisma.$executeRawUnsafe(
    `INSERT INTO ShpenzimKategori (emri, ngjyra, ikona, createdAt) VALUES (?, ?, ?, datetime('now'))`,
    body.emri, body.ngjyra || null, body.ikona || null
  );
  const [k] = await prisma.$queryRawUnsafe<KategoriRow[]>(
    `SELECT * FROM ShpenzimKategori WHERE emri=? ORDER BY id DESC LIMIT 1`, body.emri
  );
  return NextResponse.json(k, { status: 201 });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") || "0");
  if (!id) return NextResponse.json({ error: "ID mungon" }, { status: 400 });

  const body = await req.json();
  await prisma.$executeRawUnsafe(
    `UPDATE ShpenzimKategori SET emri=?, ngjyra=?, ikona=? WHERE id=?`,
    body.emri, body.ngjyra || null, body.ikona || null, id
  );
  const [k] = await prisma.$queryRawUnsafe<KategoriRow[]>(
    `SELECT * FROM ShpenzimKategori WHERE id=?`, id
  );
  return NextResponse.json(k);
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") || "0");
  if (!id) return NextResponse.json({ error: "ID mungon" }, { status: 400 });

  await prisma.$executeRawUnsafe(`DELETE FROM Shpenzim WHERE kategoriId = ?`, id);
  await prisma.$executeRawUnsafe(`DELETE FROM ShpenzimKategori WHERE id = ?`, id);
  return NextResponse.json({ success: true });
}
