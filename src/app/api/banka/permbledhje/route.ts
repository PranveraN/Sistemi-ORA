import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bankCtx } from "@/lib/bank/api";
import { ZER_LLOJET, type ZerLloji } from "@/lib/bank/rules";

// Bilanci nga banka: vetëm ekstraktet e IMPORTUARA, pa rreshtat e dyfishtë.
// GET ?yearType=academic|calendar&viti=2020 (pa viti = të gjitha vitet)
// Për çdo zë: neto = kreditë − debitë (e hyrë > 0, shpenzim < 0).
// Rezultati = E_HYRE + KTHIM + SHPENZIM; FINANCIM dhe JASHTE tregohen veçmas.
export async function GET(req: NextRequest) {
  const ctx = await bankCtx(); if (ctx instanceof NextResponse) return ctx;
  const sp = new URL(req.url).searchParams;
  const yearType = sp.get("yearType") === "calendar" ? "calendar" : "academic";
  const viti = sp.get("viti") ? parseInt(sp.get("viti")!) : null;

  const base = { organizationId: ctx.orgId, ekstrakt: { statusi: "IMPORTUAR" }, statusi: { not: "DYFISHT" } };
  const where: Record<string, unknown> = { ...base };
  if (viti !== null) {
    if (yearType === "academic") where.vitiShkollor = viti;
    else where.data = { gte: new Date(Date.UTC(viti, 0, 1)), lt: new Date(Date.UTC(viti + 1, 0, 1)) };
  }

  const [groups, zerat, all] = await Promise.all([
    prisma.bankLevizje.groupBy({ by: ["zerId"], where, _sum: { debi: true, kredi: true }, _count: true }),
    prisma.bankZer.findMany({ where: { organizationId: ctx.orgId }, orderBy: [{ renditja: "asc" }, { id: "asc" }] }),
    prisma.bankLevizje.findMany({ where: base, select: { data: true, vitiShkollor: true } }),
  ]);

  const byZer = new Map(groups.map(g => [g.zerId, g]));
  const rreshtat = zerat.map(z => {
    const g = byZer.get(z.id);
    const kredi = g?._sum.kredi ?? 0, debi = g?._sum.debi ?? 0;
    return { zerId: z.id, emri: z.emri, lloji: z.lloji as ZerLloji, aktiv: z.aktiv, nr: g?._count ?? 0, kredi, debi, neto: kredi - debi };
  }).filter(r => r.nr > 0 || r.aktiv);
  const pa = byZer.get(null);
  const paKlasifikuara = { nr: pa?._count ?? 0, kredi: pa?._sum.kredi ?? 0, debi: pa?._sum.debi ?? 0 };

  const tot = (l: ZerLloji) => rreshtat.filter(r => r.lloji === l).reduce((s, r) => s + r.neto, 0);
  const bilanci = {
    teHyrat: tot("E_HYRE"), kthimet: tot("KTHIM"), shpenzimet: tot("SHPENZIM"),
    rezultati: tot("E_HYRE") + tot("KTHIM") + tot("SHPENZIM"),
    financim: tot("FINANCIM"), jashte: tot("JASHTE"),
  };

  const vitetShkollore = [...new Set(all.map(r => r.vitiShkollor).filter((v): v is number => v !== null))].sort();
  const vitetKalendarike = [...new Set(all.map(r => r.data.getUTCFullYear()))].sort();
  return NextResponse.json({ yearType, viti, rreshtat, paKlasifikuara, bilanci, llojet: ZER_LLOJET, vitetShkollore, vitetKalendarike });
}
