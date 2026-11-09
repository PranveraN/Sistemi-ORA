import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { bankCtx, bad } from "@/lib/bank/api";
import { ensureBankDefaults } from "@/lib/bank/rules";
import { savePdfs, startProcessing, isProcessing } from "@/lib/bank/process";
import { countPdfPages } from "@/lib/bank/pdfText";

const MAX_BYTES = 150 * 1024 * 1024; // gjithsej, për të gjitha pjesët

// GET → lista e ekstrakteve · POST (multipart "file", një ose më shumë) → NJË ekstrakt nga të gjitha
// skedarët (p.sh. viti 2024 në 2 PDF) dhe nis leximin në sfond
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
  const files = (form?.getAll("file") ?? []).filter((f): f is File => f instanceof File);
  if (!files.length) return bad(form ? "Zgjidh skedarin PDF të ekstraktit." : "Skedarët s'mbërritën të plotë te serveri (mund të jenë shumë të mëdhenj) — provo sërish.");
  if (files.length > 12) return bad("Maksimumi 12 pjesë për një ekstrakt.");
  if (files.reduce((s, f) => s + f.size, 0) > MAX_BYTES) return bad("Skedarët janë shumë të mëdhenj (gjithsej maks. 150 MB).");
  const datas: Buffer[] = [];
  let pages = 0;
  for (const file of files) {
    if (!/\.pdf$/i.test(file.name)) return bad(`"${file.name}" s'është PDF — pranohen vetëm ekstraktet PDF.`);
    const data = Buffer.from(await file.arrayBuffer());
    if (data.subarray(0, 5).toString("latin1") !== "%PDF-") return bad(`"${file.name}" s'është PDF i vlefshëm.`);
    const n = countPdfPages(data);
    if (!n) return bad(`"${file.name}" s'ka faqe — a është PDF e plotë?`);
    pages += n;
    datas.push(data);
  }
  const emri = files.map(f => f.name).join(" + ").slice(0, 200);

  await ensureBankDefaults(prisma, ctx.orgId);
  const ek = await prisma.bankEkstrakt.create({
    data: { organizationId: ctx.orgId, emriSkedarit: emri, statusi: "NE_PERPUNIM", faqetGjithsej: pages, ngarkuarNga: ctx.userName },
  });
  savePdfs(ek.id, datas);
  startProcessing(ek.id);
  return NextResponse.json(ek, { status: 201 });
}
