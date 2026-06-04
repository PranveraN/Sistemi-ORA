import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type ShpenzimRow = {
  id: number; shuma: number; pershkrim: string | null; marres: string | null;
  data: string; metoda: string | null; referenca: string | null; docType: string; createdAt: string;
  kategoriId: number; katEmri: string; katNgjyra: string | null; katIkona: string | null;
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kategoriId = searchParams.get("kategoriId");
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");
  const offset = (page - 1) * limit;

  let where = "WHERE 1=1";
  const args: unknown[] = [];

  if (kategoriId) { where += " AND s.kategoriId = ?"; args.push(parseInt(kategoriId)); }
  if (year && month) {
    const y = parseInt(year), m = parseInt(month);
    const start = `${y}-${String(m).padStart(2,"0")}-01`;
    const end   = `${y}-${String(m).padStart(2,"0")}-31`;
    where += " AND s.data >= ? AND s.data <= ?"; args.push(start, end);
  } else if (year) {
    where += " AND s.data >= ? AND s.data <= ?";
    args.push(`${year}-01-01`, `${year}-12-31`);
  }

  const rows = await prisma.$queryRawUnsafe<ShpenzimRow[]>(
    `SELECT s.*, k.emri as katEmri, k.ngjyra as katNgjyra, k.ikona as katIkona
     FROM Shpenzim s JOIN ShpenzimKategori k ON s.kategoriId = k.id
     ${where} ORDER BY s.data DESC LIMIT ? OFFSET ?`,
    ...args, limit, offset
  );

  const countRow = await prisma.$queryRawUnsafe<{ cnt: number }[]>(
    `SELECT COUNT(*) as cnt FROM Shpenzim s ${where}`, ...args
  );
  const sumRow = await prisma.$queryRawUnsafe<{ total: number }[]>(
    `SELECT COALESCE(SUM(s.shuma),0) as total FROM Shpenzim s ${where}`, ...args
  );

  const shpenzime = rows.map(r => ({
    id: r.id, shuma: r.shuma, pershkrim: r.pershkrim, marres: r.marres,
    data: r.data, metoda: r.metoda, referenca: r.referenca, docType: r.docType || "KUPON",
    kategori: { id: r.kategoriId, emri: r.katEmri, ngjyra: r.katNgjyra, ikona: r.katIkona },
  }));

  return NextResponse.json({
    shpenzime,
    total: Number(countRow[0]?.cnt ?? 0),
    totalShuma: Number(sumRow[0]?.total ?? 0),
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.kategoriId || !body.shuma) {
    return NextResponse.json({ error: "Kategoria dhe shuma janë të detyrueshme" }, { status: 400 });
  }

  const data = body.data ? new Date(body.data).toISOString() : new Date().toISOString();
  await prisma.$executeRawUnsafe(
    `INSERT INTO Shpenzim (kategoriId, shuma, pershkrim, marres, data, metoda, referenca, docType, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), datetime('now'))`,
    parseInt(body.kategoriId), parseFloat(body.shuma),
    body.pershkrim || null, body.marres || null, data,
    body.metoda || "CASH", body.referenca || null, body.docType || "KUPON"
  );

  const [sh] = await prisma.$queryRawUnsafe<ShpenzimRow[]>(
    `SELECT s.*, k.emri as katEmri, k.ngjyra as katNgjyra, k.ikona as katIkona
     FROM Shpenzim s JOIN ShpenzimKategori k ON s.kategoriId = k.id
     ORDER BY s.id DESC LIMIT 1`
  );
  return NextResponse.json({
    id: sh.id, shuma: sh.shuma, pershkrim: sh.pershkrim, marres: sh.marres,
    data: sh.data, metoda: sh.metoda, referenca: sh.referenca, docType: sh.docType || "KUPON",
    kategori: { id: sh.kategoriId, emri: sh.katEmri, ngjyra: sh.katNgjyra, ikona: sh.katIkona },
  }, { status: 201 });
}
