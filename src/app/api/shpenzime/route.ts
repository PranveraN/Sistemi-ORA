import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const kategoriId = searchParams.get("kategoriId");
  const month = searchParams.get("month");
  const year = searchParams.get("year");
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "50");

  const where: Record<string, unknown> = {};

  if (kategoriId) where.kategoriId = parseInt(kategoriId);

  if (year && month) {
    const y = parseInt(year), m = parseInt(month);
    where.data = {
      gte: new Date(y, m - 1, 1),
      lte: new Date(y, m, 0, 23, 59, 59),
    };
  } else if (year) {
    where.data = {
      gte: new Date(parseInt(year), 0, 1),
      lte: new Date(parseInt(year), 11, 31, 23, 59, 59),
    };
  }

  const [shpenzime, total, sumResult] = await Promise.all([
    prisma.shpenzim.findMany({
      where,
      include: { kategori: true },
      orderBy: { data: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.shpenzim.count({ where }),
    prisma.shpenzim.aggregate({ where, _sum: { shuma: true } }),
  ]);

  return NextResponse.json({
    shpenzime,
    total,
    totalShuma: sumResult._sum.shuma ?? 0,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.kategoriId || !body.shuma) {
    return NextResponse.json({ error: "Kategoria dhe shuma janë të detyrueshme" }, { status: 400 });
  }

  const shpenzim = await prisma.shpenzim.create({
    data: {
      kategoriId: parseInt(body.kategoriId),
      shuma:      parseFloat(body.shuma),
      pershkrim:  body.pershkrim || null,
      marres:     body.marres    || null,
      data:       body.data ? new Date(body.data) : new Date(),
      metoda:     body.metoda    || "CASH",
      referenca:  body.referenca || null,
      docType:      body.docType      || "KUPON",
      lloji:        body.lloji        || "ZYRE",
      paguar:       body.paguar !== false,
      nrFature:     body.nrFature     || null,
      emriBiznesit: body.emriBiznesit || null,
      nrFiskal:     body.nrFiskal     || null,
    },
    include: { kategori: true },
  });

  return NextResponse.json(shpenzim, { status: 201 });
}
