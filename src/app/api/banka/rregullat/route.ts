import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bankCtx, bad } from "@/lib/bank/api";
import { ensureBankDefaults } from "@/lib/bank/rules";

// GET → rregullat sipas prioritetit · POST { fjala, drejtimi?, zerId (null = Të paklasifikuara), prioriteti? }
export async function GET() {
  const ctx = await bankCtx(); if (ctx instanceof NextResponse) return ctx;
  await ensureBankDefaults(prisma, ctx.orgId);
  return NextResponse.json(await prisma.bankRregull.findMany({
    where: { organizationId: ctx.orgId }, orderBy: [{ prioriteti: "asc" }, { id: "asc" }],
  }));
}

export async function POST(req: NextRequest) {
  const ctx = await bankCtx(); if (ctx instanceof NextResponse) return ctx;
  const b = await req.json().catch(() => ({}));
  const fjala = String(b.fjala ?? "").trim().slice(0, 120);
  if (!fjala) return bad("Shkruaj fjalën që kërkohet në përshkrim.");
  const drejtimi = b.drejtimi === "HYRJE" || b.drejtimi === "DALJE" ? b.drejtimi : null;
  const zerId = b.zerId === null || b.zerId === undefined || b.zerId === "" ? null : parseInt(b.zerId);
  if (zerId !== null && !(await prisma.bankZer.findFirst({ where: { id: zerId, organizationId: ctx.orgId } }))) return bad("Zëri s'u gjet.");
  const prioriteti = Number.isFinite(parseInt(b.prioriteti)) ? parseInt(b.prioriteti) : 50;
  const r = await prisma.bankRregull.create({ data: { organizationId: ctx.orgId, fjala, drejtimi, zerId, prioriteti } });
  return NextResponse.json(r, { status: 201 });
}
