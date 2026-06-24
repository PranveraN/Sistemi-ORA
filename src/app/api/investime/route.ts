import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tipi    = searchParams.get("tipi")   || "";
  const metoda  = searchParams.get("metoda") || "";
  const from    = searchParams.get("from")   || "";
  const to      = searchParams.get("to")     || "";
  const search  = searchParams.get("search") || "";
  const page    = parseInt(searchParams.get("page")  || "1");
  const limit   = parseInt(searchParams.get("limit") || "30");
  const offset  = (page - 1) * limit;

  const s = (v: string) => v.replace(/'/g, "''");

  const filters: string[] = [];
  if (tipi)   filters.push(`tipi = '${s(tipi)}'`);
  if (metoda) filters.push(`metoda = '${s(metoda)}'`);
  if (from)   filters.push(`date(data) >= '${s(from)}'`);
  if (to)     filters.push(`date(data) <= '${s(to)}'`);
  if (search) filters.push(`pershkrim LIKE '%${s(search)}%'`);

  const where = filters.length ? `WHERE ${filters.join(" AND ")}` : "";

  const [investime, countRow, kapRow, perkRow] = await Promise.all([
    prisma.$queryRawUnsafe<{
      id: number; tipi: string; data: string; pershkrim: string;
      kategoria: string|null; vlera: number; metoda: string;
      dokumenti: string|null; regjistruarNga: string|null; createdAt: string;
    }[]>(`SELECT * FROM Investim ${where} ORDER BY data DESC LIMIT ${limit} OFFSET ${offset}`),

    prisma.$queryRawUnsafe<{ total: bigint }[]>(
      `SELECT COUNT(*) as total FROM Investim ${where}`),

    prisma.$queryRawUnsafe<{ s: number|null }[]>(
      `SELECT SUM(vlera) as s FROM Investim WHERE tipi='KAPITAL'`),

    prisma.$queryRawUnsafe<{ s: number|null }[]>(
      `SELECT SUM(vlera) as s FROM Investim WHERE tipi='PERKOHSHEM'`),
  ]);

  return NextResponse.json({
    investime: investime.map(r => ({ ...r, id: Number(r.id) })),
    total:           Number(countRow[0].total),
    page, limit,
    totalKapital:    kapRow[0].s  ?? 0,
    totalPerkohshem: perkRow[0].s ?? 0,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { tipi, data, pershkrim, kategoria, vlera, metoda, dokumenti, regjistruarNga } = body;

  if (!tipi || !pershkrim || !vlera) {
    return NextResponse.json({ error: "tipi, pershkrim dhe vlera janë të detyrueshme" }, { status: 400 });
  }

  const s = (v: string | null | undefined) =>
    v ? `'${String(v).replace(/'/g, "''")}'` : "NULL";

  const dateVal = data ? `'${new Date(data).toISOString()}'` : `datetime('now')`;
  const vleraVal = parseFloat(String(vlera));

  const [row] = await prisma.$queryRawUnsafe<{ id: bigint }[]>(`
    INSERT INTO Investim (tipi, data, pershkrim, kategoria, vlera, metoda, dokumenti, regjistruarNga, createdAt, updatedAt)
    VALUES (${s(tipi)}, ${dateVal}, ${s(pershkrim)}, ${s(kategoria)}, ${vleraVal}, ${s(metoda || "CASH")}, ${s(dokumenti)}, ${s(regjistruarNga)}, datetime('now'), datetime('now'))
    RETURNING id
  `);

  return NextResponse.json({ id: Number(row.id) }, { status: 201 });
}
