import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";

  const where = q
    ? { OR: [{ emri: { contains: q } }, { nrFiskal: { contains: q } }] }
    : {};

  const partners = await prisma.sipartner.findMany({
    where,
    orderBy: { emri: "asc" },
    take: 30,
  });

  // Bashko me ata nga shpenzime që nuk janë akoma në tabelë
  if (q.length >= 2) {
    const fromShpenzime = await prisma.shpenzim.findMany({
      where: {
        OR: [{ emriBiznesit: { contains: q } }, { nrFiskal: { contains: q } }],
        NOT: { emriBiznesit: null },
      },
      select: { emriBiznesit: true, nrFiskal: true },
      take: 50,
    });

    const existing = new Set(partners.map(p => p.emri.toLowerCase()));
    const extra = new Map<string, { emri: string; nrFiskal: string | null }>();
    for (const r of fromShpenzime) {
      if (!r.emriBiznesit) continue;
      const key = r.emriBiznesit.toLowerCase();
      if (!existing.has(key) && !extra.has(key)) {
        extra.set(key, { emri: r.emriBiznesit, nrFiskal: r.nrFiskal });
      }
    }

    return NextResponse.json([
      ...partners.map(p => ({ id: p.id, emri: p.emri, nrFiskal: p.nrFiskal })),
      ...[...extra.values()],
    ].slice(0, 20));
  }

  return NextResponse.json(partners);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  if (!body.emri) return NextResponse.json({ error: "Emri është i detyrueshëm" }, { status: 400 });

  const partner = await prisma.sipartner.upsert({
    where: { id: body.id ?? 0 },
    update: { emri: body.emri, nrFiskal: body.nrFiskal || null, adresa: body.adresa || null, telefoni: body.telefoni || null, email: body.email || null },
    create: { emri: body.emri, nrFiskal: body.nrFiskal || null, adresa: body.adresa || null, telefoni: body.telefoni || null, email: body.email || null },
  });

  return NextResponse.json(partner, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = parseInt(searchParams.get("id") || "0");
  if (!id) return NextResponse.json({ error: "ID mungon" }, { status: 400 });

  await prisma.sipartner.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
