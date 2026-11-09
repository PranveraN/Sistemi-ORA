import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bankCtx } from "@/lib/bank/api";

// Të dhënat e grafikonëve të Bankës për një vit kalendarik (shumat në cent).
// GET ?viti=2024&gjitha=1
//   gjitha=0 (parazgjedhje): vetëm rreshtat e importuar · gjitha=1: edhe të paimportuarat (paraprake)
// - muajt: hyrje/dalje në bankë, të hyrat/shpenzimet sipas zërave, rezultati, gjendja në fund të muajit
//   (gjendja merret nga TË GJITHË rreshtat e lexuar — është fakt i bankës, s'varet nga klasifikimi)
// - zerat: shpenzimet sipas zërit · vitet: krahasimi i viteve (të hyrat, shpenzimet, rezultati)
export async function GET(req: NextRequest) {
  const ctx = await bankCtx(); if (ctx instanceof NextResponse) return ctx;
  const sp = new URL(req.url).searchParams;
  const gjitha = sp.get("gjitha") === "1";

  const base = { organizationId: ctx.orgId, statusi: { not: "DYFISHT" }, ekstrakt: { statusi: { in: ["DRAFT", "IMPORTUAR"] } } };
  const all = await prisma.bankLevizje.findMany({
    where: base, orderBy: [{ data: "asc" }, { ekstraktId: "asc" }, { nr: "asc" }],
    select: { data: true, debi: true, kredi: true, gjendja: true, importuar: true, zerId: true },
  });
  const zerat = await prisma.bankZer.findMany({ where: { organizationId: ctx.orgId }, select: { id: true, emri: true, lloji: true } });
  const zerById = new Map(zerat.map(z => [z.id, z]));
  const vitet = [...new Set(all.map(r => r.data.getUTCFullYear()))].sort((a, b) => a - b);
  const viti = parseInt(sp.get("viti") ?? "") || vitet[vitet.length - 1] || new Date().getFullYear();
  const counted = all.filter(r => gjitha || r.importuar);

  const lloj = (zerId: number | null) => (zerId ? zerById.get(zerId)?.lloji : null) ?? null;
  const neto = (r: { kredi: number; debi: number }) => r.kredi - r.debi;

  // Muajt e vitit
  const muajt = Array.from({ length: 12 }, (_, m) => ({ muaji: m + 1, kredi: 0, debi: 0, teHyrat: 0, shpenzimet: 0, rezultati: 0, gjendja: null as number | null }));
  for (const r of counted) {
    if (r.data.getUTCFullYear() !== viti) continue;
    const m = muajt[r.data.getUTCMonth()];
    m.kredi += r.kredi; m.debi += r.debi;
    const l = lloj(r.zerId);
    if (l === "E_HYRE" || l === "KTHIM") m.teHyrat += neto(r);
    if (l === "SHPENZIM") m.shpenzimet += -neto(r);
  }
  for (const m of muajt) m.rezultati = m.teHyrat - m.shpenzimet;
  // Gjendja në fund të çdo muaji (nga të gjitha rreshtat; bartet kur një muaj s'ka lëvizje)
  let last: number | null = null;
  const prevYear = all.filter(r => r.data.getUTCFullYear() < viti);
  if (prevYear.length) last = prevYear[prevYear.length - 1].gjendja;
  const today = new Date();
  for (const m of muajt) {
    const inM = all.filter(r => r.data.getUTCFullYear() === viti && r.data.getUTCMonth() + 1 === m.muaji);
    if (inM.length) last = inM[inM.length - 1].gjendja;
    const future = viti > today.getUTCFullYear() || (viti === today.getUTCFullYear() && m.muaji > today.getUTCMonth() + 1);
    const anyAfter = all.some(r => r.data.getUTCFullYear() > viti || (r.data.getUTCFullYear() === viti && r.data.getUTCMonth() + 1 >= m.muaji));
    m.gjendja = future || !anyAfter && !inM.length ? null : last;
  }

  // Shpenzimet sipas zërit (viti i zgjedhur)
  const byZer = new Map<number, number>();
  for (const r of counted) {
    if (r.data.getUTCFullYear() !== viti || lloj(r.zerId) !== "SHPENZIM") continue;
    byZer.set(r.zerId!, (byZer.get(r.zerId!) ?? 0) - neto(r));
  }
  const shpenzimeZerat = [...byZer.entries()].map(([id, shuma]) => ({ emri: zerById.get(id)?.emri ?? "?", shuma })).sort((a, b) => b.shuma - a.shuma);

  // Krahasimi i viteve
  const vitetData = vitet.map(y => {
    const rs = counted.filter(r => r.data.getUTCFullYear() === y);
    const teHyrat = rs.filter(r => ["E_HYRE", "KTHIM"].includes(lloj(r.zerId) ?? "")).reduce((s, r) => s + neto(r), 0);
    const shpenzimet = -rs.filter(r => lloj(r.zerId) === "SHPENZIM").reduce((s, r) => s + neto(r), 0);
    return { viti: y, kredi: rs.reduce((s, r) => s + r.kredi, 0), debi: rs.reduce((s, r) => s + r.debi, 0), teHyrat, shpenzimet, rezultati: teHyrat - shpenzimet };
  });

  const paKlasifikuara = counted.filter(r => r.data.getUTCFullYear() === viti && r.zerId === null).length;
  return NextResponse.json({
    viti, vitet, gjitha, muajt, shpenzimeZerat, vitetData, paKlasifikuara,
    importuarGjithsej: all.filter(r => r.importuar).length, rreshtaGjithsej: all.length,
  });
}
