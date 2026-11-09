import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bankCtx } from "@/lib/bank/api";
import { listYears } from "@/lib/bank/years";
import { isProcessing, isReadingNow } from "@/lib/bank/process";

// GET → një rresht për çdo vit kalendarik dhe llogari ("viti i hapur"), plus ngarkimet që
// s'janë ende pjesë e vitit (po lexohen ose kanë gabim).
export async function GET() {
  const ctx = await bankCtx(); if (ctx instanceof NextResponse) return ctx;
  const vitet = await listYears(prisma, ctx.orgId);
  const pritje = await prisma.bankEkstrakt.findMany({
    where: { organizationId: ctx.orgId, statusi: { in: ["NE_PERPUNIM", "GABIM"] } }, orderBy: { id: "desc" },
    select: { id: true, emriSkedarit: true, statusi: true, faqetGati: true, faqetGjithsej: true, gabimi: true, pjeset: true, periudhaNga: true, periudhaDeri: true, totalKredi: true, totalDebi: true, createdAt: true },
  });
  return NextResponse.json({ vitet, pritje: pritje.map(p => ({ ...p, nePunim: isProcessing(p.id), aktiv: isReadingNow(p.id) })) });
}
