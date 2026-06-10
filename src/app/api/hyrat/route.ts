import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const muaj  = searchParams.get("muaj")  ? parseInt(searchParams.get("muaj")!)  : null;
  const vit   = searchParams.get("vit")   ? parseInt(searchParams.get("vit")!)   : null;
  const page  = parseInt(searchParams.get("page")  || "1");
  const limit = parseInt(searchParams.get("limit") || "200");

  const where: Record<string, unknown> = {};
  if (muaj) where.muaj = muaj;
  if (vit)  where.vit  = vit;

  const [hyrat, total, sum] = await Promise.all([
    prisma.hyra.findMany({
      where,
      orderBy: [{ vit: "desc" }, { muaj: "desc" }, { paguesit: "asc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.hyra.count({ where }),
    prisma.hyra.aggregate({ where, _sum: { shuma: true } }),
  ]);

  return NextResponse.json({ hyrat, total, totalShuma: sum._sum.shuma ?? 0 });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.paguesit || !body.shuma || !body.muaj || !body.vit) {
    return NextResponse.json({ error: "Paguesi, shuma, muaji dhe viti janë të detyrueshme." }, { status: 400 });
  }

  const hyra = await prisma.hyra.create({
    data: {
      paguesit:  body.paguesit,
      shuma:     parseFloat(body.shuma),
      kategoria: body.kategoria || "SHKOLLIMI",
      muaj:      parseInt(body.muaj),
      vit:       parseInt(body.vit),
      metoda:    body.metoda    || null,
      referenca: body.referenca || null,
      shenime:   body.shenime   || null,
    },
  });

  return NextResponse.json(hyra, { status: 201 });
}
