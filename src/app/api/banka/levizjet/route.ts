import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bankCtx, bad } from "@/lib/bank/api";

// GET ?paKlasifikuara=1&vitiShkollor=2020 → lëvizjet e importuara (p.sh. "Të paklasifikuara" në të gjitha ekstraktet)
// PATCH { ids, zerId?, vitiShkollor?, shenim? } → bart rreshtat te një zë (null = Të paklasifikuara),
//        ndryshon vitin shkollor ose shënimin. Rreshtat "DYFISHT" s'preken.
export async function GET(req: NextRequest) {
  const ctx = await bankCtx(); if (ctx instanceof NextResponse) return ctx;
  const sp = new URL(req.url).searchParams;
  const where: Record<string, unknown> = { organizationId: ctx.orgId, importuar: true, statusi: { not: "DYFISHT" } };
  if (sp.get("paKlasifikuara") === "1") where.zerId = null;
  else if (sp.get("zerId")) where.zerId = parseInt(sp.get("zerId")!);
  if (sp.get("vitiShkollor")) where.vitiShkollor = parseInt(sp.get("vitiShkollor")!);
  if (sp.get("viti")) { const y = parseInt(sp.get("viti")!); where.data = { gte: new Date(Date.UTC(y, 0, 1)), lt: new Date(Date.UTC(y + 1, 0, 1)) }; }
  const rows = await prisma.bankLevizje.findMany({
    where, orderBy: [{ data: "asc" }, { nr: "asc" }], take: 3000,
    select: { id: true, ekstraktId: true, nr: true, data: true, lloji: true, debi: true, kredi: true, pala: true, pershkrimi: true, zerId: true, vitiShkollor: true, statusi: true, shenim: true },
  });
  return NextResponse.json(rows);
}

export async function PATCH(req: NextRequest) {
  const ctx = await bankCtx(); if (ctx instanceof NextResponse) return ctx;
  const body = await req.json().catch(() => ({}));
  const ids: number[] = Array.isArray(body.ids) ? body.ids.map((x: unknown) => parseInt(String(x))).filter(Number.isFinite) : [];
  if (!ids.length) return bad("Zgjidh të paktën një rresht.");

  const data: Record<string, unknown> = {};
  if (body.zerId !== undefined) {
    const zerId = body.zerId === null ? null : parseInt(body.zerId);
    if (zerId !== null) {
      const z = await prisma.bankZer.findFirst({ where: { id: zerId, organizationId: ctx.orgId, aktiv: true } });
      if (!z) return bad("Zëri s'u gjet ose është çaktivizuar.");
    }
    data.zerId = zerId;
    data.statusi = zerId ? "KONFIRMUAR" : "PA_KLASIFIKUAR";
  }
  if (body.vitiShkollor !== undefined) {
    const v = parseInt(body.vitiShkollor);
    if (!(v >= 2000 && v <= 2100)) return bad("Viti shkollor i pavlefshëm.");
    data.vitiShkollor = v;
  }
  if (body.shenim !== undefined) data.shenim = body.shenim ? String(body.shenim).slice(0, 500) : null;
  if (!Object.keys(data).length) return bad("S'ka asgjë për të ndryshuar.");

  const r = await prisma.bankLevizje.updateMany({ where: { id: { in: ids }, organizationId: ctx.orgId, statusi: { not: "DYFISHT" } }, data });
  return NextResponse.json({ ok: true, ndryshuar: r.count });
}
