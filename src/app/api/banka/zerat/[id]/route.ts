import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bankCtx, bad, intId } from "@/lib/bank/api";
import { isZerLloji } from "@/lib/bank/rules";

type P = { params: Promise<{ id: string }> };

// PATCH { emri?, lloji?, aktiv? } · DELETE → vetëm nëse zëri s'ka asnjë rresht/rregull (përndryshe çaktivizohet)
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

export async function DELETE(_: NextRequest, { params }: P) {
  const ctx = await bankCtx(); if (ctx instanceof NextResponse) return ctx;
  const id = intId((await params).id); if (!id) return bad("ID e pavlefshme");
  const z = await prisma.bankZer.findFirst({ where: { id, organizationId: ctx.orgId }, include: { _count: { select: { levizjet: true, rregullat: true } } } });
  if (!z) return bad("Zëri s'u gjet", 404);
  if (z._count.levizjet || z._count.rregullat) return bad("Zëri përdoret nga rreshta ose rregulla — çaktivizoje në vend që ta fshish.");
  await prisma.bankZer.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
