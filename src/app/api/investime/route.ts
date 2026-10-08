import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// 2026-09-29: më parë s'kishte AS NJË kontroll identifikimi, dhe ndërtonte SQL
// me ngjitje teksti (rrezik injektimi). Rishkruar me auth() + query-t e
// sigurta të vetë Prisma-s.
async function requireAccess() {
  const session = await auth();
  if (!session) return null;
  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "SUPERADMIN", "FINANCE"].includes(role ?? "")) return null;
  return session;
}

export async function GET(req: NextRequest) {
  const session = await requireAccess();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const tipi   = searchParams.get("tipi")   || "";
  const metoda = searchParams.get("metoda") || "";
  const from   = searchParams.get("from")   || "";
  const to     = searchParams.get("to")     || "";
  const search = searchParams.get("search") || "";
  const page   = parseInt(searchParams.get("page")  || "1");
  const limit  = parseInt(searchParams.get("limit") || "30");

  const where: Record<string, unknown> = {};
  if (tipi)   where.tipi = tipi;
  if (metoda) where.metoda = metoda;
  if (search) where.pershkrim = { contains: search };
  if (from || to) {
    where.data = {
      ...(from ? { gte: new Date(from) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59.999`) } : {}),
    };
  }

  const [investime, total, kapAgg, perkAgg] = await Promise.all([
    prisma.investim.findMany({ where, orderBy: { data: "desc" }, skip: (page - 1) * limit, take: limit }),
    prisma.investim.count({ where }),
    prisma.investim.aggregate({ where: { tipi: "KAPITAL" }, _sum: { vlera: true } }),
    prisma.investim.aggregate({ where: { tipi: "PERKOHSHEM" }, _sum: { vlera: true } }),
  ]);

  return NextResponse.json({
    investime, total, page, limit,
    totalKapital: kapAgg._sum.vlera ?? 0,
    totalPerkohshem: perkAgg._sum.vlera ?? 0,
  });
}

export async function POST(req: NextRequest) {
  const session = await requireAccess();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { tipi, data, pershkrim, kategoria, vlera, metoda, dokumenti, regjistruarNga } = body;

  if (!tipi || !pershkrim || !vlera) {
    return NextResponse.json({ error: "tipi, pershkrim dhe vlera janë të detyrueshme" }, { status: 400 });
  }

  const row = await prisma.investim.create({
    data: {
      tipi,
      data: data ? new Date(data) : new Date(),
      pershkrim,
      kategoria: kategoria || null,
      vlera: parseFloat(String(vlera)),
      metoda: metoda || "CASH",
      dokumenti: dokumenti || null,
      regjistruarNga: regjistruarNga || null,
    },
    select: { id: true },
  });

  return NextResponse.json({ id: row.id }, { status: 201 });
}
