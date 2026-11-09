import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bankCtx, bad, intId } from "@/lib/bank/api";
import { pdfPaths, startProcessing, isProcessing, reclassify, mergeEkstrakte } from "@/lib/bank/process";

// POST { veprimi }:
//   IMPORTO        DRAFT → IMPORTUAR (lëvizjet hyjnë në bilanc; dyfishet mbeten jashtë)
//   KTHE_NE_DRAFT  IMPORTUAR → DRAFT (dalin nga bilanci; asgjë s'fshihet)
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
    if (ek.statusi !== "DRAFT") return bad(ek.statusi === "GABIM" ? "Ekstrakti ka gabime leximi — s'mund të importohet." : "Vetëm një ekstrakt në draft mund të importohet.");
    // Kontrolli i dyfishimit në momentin e importit (mund të jetë importuar diçka ndërkohë)
    const rows = await prisma.bankLevizje.findMany({ where: { ekstraktId: id }, select: { id: true, celesi: true } });
    const dup = new Set((await prisma.bankLevizje.findMany({
      where: { organizationId: ctx.orgId, celesi: { in: rows.map(r => r.celesi) }, ekstrakt: { statusi: "IMPORTUAR" }, ekstraktId: { not: id } }, select: { celesi: true },
    })).map(r => r.celesi));
    const dupIds = rows.filter(r => dup.has(r.celesi)).map(r => r.id);
    await prisma.$transaction([
      ...(dupIds.length ? [prisma.bankLevizje.updateMany({ where: { id: { in: dupIds } }, data: { statusi: "DYFISHT", zerId: null } })] : []),
      prisma.bankEkstrakt.update({ where: { id }, data: { statusi: "IMPORTUAR", importuarAt: new Date(), importuarNga: ctx.userName } }),
    ]);
    return NextResponse.json({ ok: true, dyfishta: dupIds.length });
  }

  if (veprimi === "KTHE_NE_DRAFT") {
    if (ek.statusi !== "IMPORTUAR") return bad("Ekstrakti s'është i importuar.");
    await prisma.bankEkstrakt.update({ where: { id }, data: { statusi: "DRAFT", importuarAt: null, importuarNga: null } });
    return NextResponse.json({ ok: true });
  }

  if (veprimi === "RIKLASIFIKO") {
    return NextResponse.json({ ok: true, ndryshuar: await reclassify(id, ctx.orgId) });
  }

  if (veprimi === "RIFILLO") {
    if (ek.statusi === "IMPORTUAR") return bad("Ekstrakti është i importuar — fillimisht ktheje në draft.");
    if (isProcessing(id)) return bad("Ekstrakti po lexohet tashmë.");
    if (!pdfPaths(id).length) return bad("PDF-ja e këtij ekstrakti s'gjendet më — ngarkoje sërish.");
    startProcessing(id);
    return NextResponse.json({ ok: true });
  }

  return bad("Veprim i panjohur.");
}
