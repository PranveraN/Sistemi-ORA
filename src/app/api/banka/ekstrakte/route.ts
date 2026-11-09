import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bankCtx, bad } from "@/lib/bank/api";
import { ensureBankDefaults } from "@/lib/bank/rules";
import { savePdf, startProcessing, isProcessing } from "@/lib/bank/process";
import { countPdfImages } from "@/lib/bank/pdfImages";

const MAX_BYTES = 80 * 1024 * 1024;

// GET → lista e ekstrakteve · POST (multipart "file") → ngarkon PDF-në dhe nis leximin në sfond
export async function GET() {
  const ctx = await bankCtx(); if (ctx instanceof NextResponse) return ctx;
  const rows = await prisma.bankEkstrakt.findMany({
    where: { organizationId: ctx.orgId }, orderBy: [{ periudhaNga: "desc" }, { id: "desc" }],
    include: { _count: { select: { levizjet: true } } },
  });
  const pa = await prisma.bankLevizje.groupBy({ by: ["ekstraktId"], where: { organizationId: ctx.orgId, statusi: "PA_KLASIFIKUAR" }, _count: true });
  const paMap = new Map(pa.map(p => [p.ekstraktId, p._count]));
  return NextResponse.json(rows.map(r => ({ ...r, rreshta: r._count.levizjet, paKlasifikuara: paMap.get(r.id) ?? 0, nePunim: isProcessing(r.id) })));
}

export async function POST(req: NextRequest) {
  const ctx = await bankCtx(); if (ctx instanceof NextResponse) return ctx;
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return bad(form ? "Zgjidh skedarin PDF të ekstraktit." : "Skedari s'mbërriti i plotë te serveri (mund të jetë shumë i madh) — provo sërish.");
  if (!/\.pdf$/i.test(file.name)) return bad("Pranohet vetëm PDF (ekstrakti i bankës).");
  if (file.size > MAX_BYTES) return bad("Skedari është shumë i madh (maks. 80 MB).");
  const data = Buffer.from(await file.arrayBuffer());
  if (data.subarray(0, 5).toString("latin1") !== "%PDF-") return bad("Skedari s'është PDF i vlefshëm.");
  const pages = countPdfImages(data);
  if (!pages) return bad("PDF-ja s'ka faqe të skanuara — s'mund të lexohet si ekstrakt BKT.");

  await ensureBankDefaults(prisma, ctx.orgId);
  const ek = await prisma.bankEkstrakt.create({
    data: { organizationId: ctx.orgId, emriSkedarit: file.name.slice(0, 200), statusi: "NE_PERPUNIM", faqetGjithsej: pages, ngarkuarNga: ctx.userName },
  });
  savePdf(ek.id, data);
  startProcessing(ek.id);
  return NextResponse.json(ek, { status: 201 });
}
