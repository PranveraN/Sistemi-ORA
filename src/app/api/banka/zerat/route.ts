import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bankCtx, bad } from "@/lib/bank/api";
import { ensureBankDefaults, isZerLloji } from "@/lib/bank/rules";

// GET → zërat (me numrin e rreshtave) · POST { emri, lloji } → zë i ri
export async function GET() {
  const ctx = await bankCtx(); if (ctx instanceof NextResponse) return ctx;
  await ensureBankDefaults(prisma, ctx.orgId);
  const zerat = await prisma.bankZer.findMany({
    where: { organizationId: ctx.orgId }, orderBy: [{ renditja: "asc" }, { id: "asc" }],
    include: { _count: { select: { levizjet: true, rregullat: true } } },
  });
  return NextResponse.json(zerat);
}

export async function POST(req: NextRequest) {
  const ctx = await bankCtx(); if (ctx instanceof NextResponse) return ctx;
  const body = await req.json().catch(() => ({}));
  const emri = String(body.emri ?? "").trim().slice(0, 100);
  if (!emri) return bad("Shkruaj emrin e zërit.");
  if (!isZerLloji(body.lloji)) return bad("Zgjidh llojin e zërit.");
  if (await prisma.bankZer.findFirst({ where: { organizationId: ctx.orgId, emri } })) return bad(`Zëri "${emri}" ekziston.`, 409);
  const max = await prisma.bankZer.aggregate({ where: { organizationId: ctx.orgId }, _max: { renditja: true } });
  const z = await prisma.bankZer.create({ data: { organizationId: ctx.orgId, emri, lloji: body.lloji, renditja: (max._max.renditja ?? 0) + 1 } });
  return NextResponse.json(z, { status: 201 });
}
