import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bankCtx, bad, intId } from "@/lib/bank/api";
import { isZerLloji } from "@/lib/bank/rules";

type P = { params: Promise<{ id: string }> };

// PATCH { emri?, lloji?, aktiv? }
// DELETE ?zhvendosTe=<zerId|null> → fshin zërin. Nëse ka rreshta/rregulla, duhet treguar ku
// kalojnë: rreshtat te zëri tjetër (ose "Të paklasifikuara" me null), rregullat te zëri
// tjetër (me null fshihen, që të mos e lënë qëllimisht pa zë atë që më parë klasifikonin).
// Asnjë rresht banke s'fshihet.
export async function PATCH(req: NextRequest, { params }: P) {
  const ctx = await bankCtx(); if (ctx instanceof NextResponse) return ctx;
  const id = intId((await params).id); if (!id) return bad("ID e pavlefshme");
  const z = await prisma.bankZer.findFirst({ where: { id, organizationId: ctx.orgId } });
  if (!z) return bad("Zëri s'u gjet", 404);
  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (body.emri !== undefined) {
    const emri = String(body.emri).trim().slice(0, 100);
    if (!emri) return bad("Emri s'mund të jetë bosh.");
    if (await prisma.bankZer.findFirst({ where: { organizationId: ctx.orgId, emri, id: { not: id } } })) return bad(`Zëri "${emri}" ekziston.`, 409);
    data.emri = emri;
  }
  if (body.lloji !== undefined) { if (!isZerLloji(body.lloji)) return bad("Lloj i pavlefshëm."); data.lloji = body.lloji; }
  if (body.aktiv !== undefined) data.aktiv = !!body.aktiv;
  return NextResponse.json(await prisma.bankZer.update({ where: { id }, data }));
}

export async function DELETE(req: NextRequest, { params }: P) {
  const ctx = await bankCtx(); if (ctx instanceof NextResponse) return ctx;
  const id = intId((await params).id); if (!id) return bad("ID e pavlefshme");
  const z = await prisma.bankZer.findFirst({ where: { id, organizationId: ctx.orgId }, include: { _count: { select: { levizjet: true, rregullat: true } } } });
  if (!z) return bad("Zëri s'u gjet", 404);

  const raw = new URL(req.url).searchParams.get("zhvendosTe");
  const used = z._count.levizjet + z._count.rregullat > 0;
  if (used && raw === null) return bad(`Zëri ka ${z._count.levizjet} rreshta dhe ${z._count.rregullat} rregulla — zgjidh ku të kalojnë.`);
  let target: number | null = null;
  if (raw !== null && raw !== "null") {
    target = intId(raw);
    if (!target || target === id) return bad("Zgjidh një zë tjetër.");
    if (!(await prisma.bankZer.findFirst({ where: { id: target, organizationId: ctx.orgId, aktiv: true } }))) return bad("Zëri i ri s'u gjet ose është çaktivizuar.");
  }

  await prisma.$transaction([
    prisma.bankLevizje.updateMany({ where: { zerId: id }, data: { zerId: target, statusi: target ? "KONFIRMUAR" : "PA_KLASIFIKUAR" } }),
    target
      ? prisma.bankRregull.updateMany({ where: { zerId: id }, data: { zerId: target } })
      : prisma.bankRregull.deleteMany({ where: { zerId: id } }),
    prisma.bankZer.delete({ where: { id } }),
  ]);
  return NextResponse.json({ ok: true, rreshta: z._count.levizjet, rregulla: z._count.rregullat });
}
