import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bankCtx, bad, intId } from "@/lib/bank/api";

type P = { params: Promise<{ id: string }> };

// PATCH { fjala?, drejtimi?, zerId?, prioriteti?, aktiv? } · DELETE → heq rregullin (rreshtat e klasifikuar s'preken)
export async function PATCH(req: NextRequest, { params }: P) {
  const ctx = await bankCtx(); if (ctx instanceof NextResponse) return ctx;
  const id = intId((await params).id); if (!id) return bad("ID e pavlefshme");
  if (!(await prisma.bankRregull.findFirst({ where: { id, organizationId: ctx.orgId } }))) return bad("Rregulli s'u gjet", 404);
  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (b.fjala !== undefined) { const f = String(b.fjala).trim().slice(0, 120); if (!f) return bad("Fjala s'mund të jetë bosh."); data.fjala = f; }
  if (b.drejtimi !== undefined) data.drejtimi = b.drejtimi === "HYRJE" || b.drejtimi === "DALJE" ? b.drejtimi : null;
  if (b.zerId !== undefined) {
    const zerId = b.zerId === null || b.zerId === "" ? null : parseInt(b.zerId);
    if (zerId !== null && !(await prisma.bankZer.findFirst({ where: { id: zerId, organizationId: ctx.orgId } }))) return bad("Zëri s'u gjet.");
    data.zerId = zerId;
  }
  if (b.prioriteti !== undefined && Number.isFinite(parseInt(b.prioriteti))) data.prioriteti = parseInt(b.prioriteti);
  if (b.aktiv !== undefined) data.aktiv = !!b.aktiv;
  return NextResponse.json(await prisma.bankRregull.update({ where: { id }, data }));
}

export async function DELETE(_: NextRequest, { params }: P) {
  const ctx = await bankCtx(); if (ctx instanceof NextResponse) return ctx;
  const id = intId((await params).id); if (!id) return bad("ID e pavlefshme");
  if (!(await prisma.bankRregull.findFirst({ where: { id, organizationId: ctx.orgId } }))) return bad("Rregulli s'u gjet", 404);
  await prisma.bankRregull.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
