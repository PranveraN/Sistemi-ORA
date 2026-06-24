import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await prisma.$queryRawUnsafe<{
    id: number; tipi: string; data: string; pershkrim: string;
    kategoria: string|null; vlera: number; metoda: string;
    dokumenti: string|null; regjistruarNga: string|null; createdAt: string;
  }[]>(`SELECT * FROM Investim WHERE id = ${parseInt(id)}`);

  if (!row) return NextResponse.json({ error: "Nuk u gjet" }, { status: 404 });
  return NextResponse.json({ ...row, id: Number(row.id) });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const { tipi, data, pershkrim, kategoria, vlera, metoda, dokumenti, regjistruarNga } = body;

  const s = (v: string | null | undefined) =>
    v != null && v !== "" ? `'${String(v).replace(/'/g, "''")}'` : "NULL";

  const dateVal  = data ? `'${new Date(data).toISOString()}'` : `datetime('now')`;
  const vleraVal = parseFloat(String(vlera));

  await prisma.$executeRawUnsafe(`
    UPDATE Investim SET
      tipi = ${s(tipi)}, data = ${dateVal}, pershkrim = ${s(pershkrim)},
      kategoria = ${s(kategoria)}, vlera = ${vleraVal}, metoda = ${s(metoda || "CASH")},
      dokumenti = ${s(dokumenti)}, regjistruarNga = ${s(regjistruarNga)},
      updatedAt = datetime('now')
    WHERE id = ${parseInt(id)}
  `);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.$executeRawUnsafe(`DELETE FROM Investim WHERE id = ${parseInt(id)}`);
  return NextResponse.json({ ok: true });
}
