import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bankCtx, bad, intId } from "@/lib/bank/api";
import { pdfPaths, startProcessing, isProcessing, reclassify, mergeEkstrakte } from "@/lib/bank/process";
import { importRows, unimportRows } from "@/lib/bank/years";

// POST { veprimi }:
//   IMPORTO        importon rreshtat e këtij ngarkimi (hyjnë në bilanc; dyfishet mbeten jashtë)
//   KTHE_NE_DRAFT  i nxjerr rreshtat e tij nga bilanci (asgjë s'fshihet)
//   RIKLASIFIKO    rizbaton rregullat te rreshtat jo të zgjedhur me dorë
//   RIFILLO        lexon PDF-në nga e para (pas një gabimi ose ndërprerjeje)
//   BASHKO { meId } bashkon dy ekstrakte draft të së njëjtës llogari në një (pa rilexim)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await bankCtx(); if (ctx instanceof NextResponse) return ctx;
  const id = intId((await params).id); if (!id) return bad("ID e pavlefshme");
  const ek = await prisma.bankEkstrakt.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!ek) return bad("Ekstrakti s'u gjet", 404);
  const { veprimi, meId } = await req.json().catch(() => ({}));

  if (veprimi === "BASHKO") {
    const other = parseInt(meId);
    if (!other) return bad("Zgjidh ekstraktin me të cilin bashkohet.");
    const err = await mergeEkstrakte(ctx.orgId, id, other);
    if (err) return bad(err);
    const mbetet = await prisma.bankEkstrakt.findFirst({ where: { id: { in: [id, other] } }, select: { id: true } });
    return NextResponse.json({ ok: true, id: mbetet?.id ?? id });
  }

  if (veprimi === "IMPORTO") {
    if (ek.statusi === "GABIM" || ek.statusi === "NE_PERPUNIM") return bad(ek.statusi === "GABIM" ? "Ekstrakti ka gabime leximi — s'mund të importohet." : "Ekstrakti po lexohet ende.");
    const ids = (await prisma.bankLevizje.findMany({ where: { ekstraktId: id }, select: { id: true } })).map(r => r.id);
    const r = await importRows(prisma, ctx.orgId, ids);
    await prisma.bankEkstrakt.update({ where: { id }, data: { importuarNga: ctx.userName } });
    return NextResponse.json({ ok: true, importuar: r.importuar, dyfishta: r.dyfisht });
  }

  if (veprimi === "KTHE_NE_DRAFT") {
    const ids = (await prisma.bankLevizje.findMany({ where: { ekstraktId: id, importuar: true }, select: { id: true } })).map(r => r.id);
    if (!ids.length) return bad("Ekstrakti s'ka rreshta të importuar.");
    await unimportRows(prisma, ctx.orgId, ids);
    return NextResponse.json({ ok: true });
  }

  if (veprimi === "RIKLASIFIKO") {
    return NextResponse.json({ ok: true, ndryshuar: await reclassify(id, ctx.orgId) });
  }

  if (veprimi === "RIFILLO") {
    if (await prisma.bankLevizje.count({ where: { ekstraktId: id, importuar: true } })) return bad("Ky ngarkim ka rreshta të importuar — fillimisht ktheji në draft.");
    if (isProcessing(id)) return bad("Ekstrakti po lexohet tashmë.");
    if (!pdfPaths(id).length) return bad("PDF-ja e këtij ekstrakti s'gjendet më — ngarkoje sërish.");
    startProcessing(id);
    return NextResponse.json({ ok: true });
  }

  return bad("Veprim i panjohur.");
}
