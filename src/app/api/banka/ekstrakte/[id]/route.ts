import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bankCtx, bad, intId } from "@/lib/bank/api";
import { deletePdfs, isProcessing } from "@/lib/bank/process";

type P = { params: Promise<{ id: string }> };

// GET → ekstrakti me të gjitha lëvizjet · DELETE → hedh poshtë një ekstrakt JO të importuar
export async function GET(_: NextRequest, { params }: P) {
  const ctx = await bankCtx(); if (ctx instanceof NextResponse) return ctx;
  const id = intId((await params).id); if (!id) return bad("ID e pavlefshme");
  const ek = await prisma.bankEkstrakt.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!ek) return bad("Ekstrakti s'u gjet", 404);
  const levizjet = await prisma.bankLevizje.findMany({
    where: { ekstraktId: id }, orderBy: { nr: "asc" },
    select: { id: true, nr: true, faqja: true, data: true, referenca: true, lloji: true, debi: true, kredi: true, gjendja: true, pala: true, pershkrimi: true, zerId: true, vitiShkollor: true, statusi: true, shenim: true },
  });
  // Ekstraktet e tjera të së njëjtës llogari, periudha e të cilëve mbivendoset me këtë (sipas datave),
  // dhe sa rreshta të përbashkët kanë (të njëjtat data, referenca, shuma, gjendje)
  let mbivendosjet: { id: number; periudhaNga: Date | null; periudhaDeri: Date | null; statusi: string; emriSkedarit: string | null; teNjejte: number }[] = [];
  if (ek.llogaria && ek.periudhaNga && ek.periudhaDeri) {
    const others = await prisma.bankEkstrakt.findMany({
      where: { organizationId: ctx.orgId, id: { not: id }, llogaria: ek.llogaria, periudhaNga: { lte: ek.periudhaDeri }, periudhaDeri: { gte: ek.periudhaNga } },
      select: { id: true, periudhaNga: true, periudhaDeri: true, statusi: true, emriSkedarit: true }, orderBy: { periudhaNga: "asc" },
    });
    const keys = levizjet.length ? (await prisma.bankLevizje.findMany({ where: { ekstraktId: id }, select: { celesi: true } })).map(r => r.celesi) : [];
    mbivendosjet = await Promise.all(others.map(async o => ({
      ...o, teNjejte: keys.length ? await prisma.bankLevizje.count({ where: { ekstraktId: o.id, celesi: { in: keys } } }) : 0,
    })));
  }
  return NextResponse.json({ ...ek, nePunim: isProcessing(id), levizjet, mbivendosjet });
}

export async function DELETE(_: NextRequest, { params }: P) {
  const ctx = await bankCtx(); if (ctx instanceof NextResponse) return ctx;
  const id = intId((await params).id); if (!id) return bad("ID e pavlefshme");
  const ek = await prisma.bankEkstrakt.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!ek) return bad("Ekstrakti s'u gjet", 404);
  if (ek.statusi === "IMPORTUAR") return bad("Ekstrakti është i importuar — fillimisht ktheje në draft.");
  if (isProcessing(id)) return bad("Ekstrakti po lexohet — prit sa të mbarojë.");
  await prisma.$transaction([
    prisma.bankLevizje.deleteMany({ where: { ekstraktId: id } }),
    prisma.bankEkstrakt.delete({ where: { id } }),
  ]);
  deletePdfs(id);
  return NextResponse.json({ ok: true });
}
