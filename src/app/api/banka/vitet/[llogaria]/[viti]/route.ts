import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bankCtx, bad } from "@/lib/bank/api";
import { yearDetail, importRows, unimportRows } from "@/lib/bank/years";
import { reclassifyIds } from "@/lib/bank/process";

type P = { params: Promise<{ llogaria: string; viti: string }> };
const args = async (p: P["params"]) => { const { llogaria, viti } = await p; const v = parseInt(viti); return /^\d{6,}$/.test(llogaria) && v > 1990 ? { llogaria, viti: v } : null; };

// GET → viti: përmbledhja (muajt, gjendjet, "Mungon"), ngarkimet dhe rreshtat e vitit
export async function GET(_: NextRequest, { params }: P) {
  const ctx = await bankCtx(); if (ctx instanceof NextResponse) return ctx;
  const a = await args(params); if (!a) return bad("Llogari ose vit i pavlefshëm.");
  const d = await yearDetail(prisma, ctx.orgId, a.llogaria, a.viti);
  const levizjet = await prisma.bankLevizje.findMany({
    where: { id: { in: d.ids } }, orderBy: [{ data: "asc" }, { ekstraktId: "asc" }, { nr: "asc" }],
    select: { id: true, ekstraktId: true, nr: true, data: true, lloji: true, debi: true, kredi: true, gjendja: true, pala: true, pershkrimi: true, zerId: true, vitiShkollor: true, statusi: true, shenim: true, importuar: true },
  });
  return NextResponse.json({ ...d.summary, ngarkimet: d.ngarkimet, levizjet });
}

// POST { veprimi }: IMPORTO (rreshtat e rinj të vitit) · KTHE_NE_DRAFT (i gjithë viti jashtë bilancit) · RIKLASIFIKO
export async function POST(req: NextRequest, { params }: P) {
  const ctx = await bankCtx(); if (ctx instanceof NextResponse) return ctx;
  const a = await args(params); if (!a) return bad("Llogari ose vit i pavlefshëm.");
  const { veprimi } = await req.json().catch(() => ({}));
  const { ids } = await yearDetail(prisma, ctx.orgId, a.llogaria, a.viti);
  if (!ids.length) return bad("Ky vit s'ka rreshta.");
  if (veprimi === "IMPORTO") { const r = await importRows(prisma, ctx.orgId, ids); return NextResponse.json({ ok: true, ...r }); }
  if (veprimi === "KTHE_NE_DRAFT") return NextResponse.json({ ok: true, kthyer: await unimportRows(prisma, ctx.orgId, ids) });
  if (veprimi === "RIKLASIFIKO") return NextResponse.json({ ok: true, ndryshuar: await reclassifyIds(ids, ctx.orgId) });
  return bad("Veprim i panjohur.");
}
