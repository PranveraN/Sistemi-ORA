import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { ocrPdf } from "@/lib/bank/ocr";
import { parseBktPages, type BktRow } from "@/lib/bank/parseBkt";
import { loadRules, matchRule } from "@/lib/bank/rules";

// Përpunimi i një ekstrakti në sfond: PDF → OCR → rreshtat → kontrolli i gjendjes →
// zërat e propozuar. Rezultati ruhet si DRAFT; asgjë s'hyn në bilanc pa konfirmim
// ("Importo"). PDF-ja ruhet pranë databazës (bank-pdf/<id>.pdf) si dokument burimor.

function dataDir(): string {
  const raw = (process.env.DATABASE_URL || "").replace(/^file:/, "");
  const db = path.isAbsolute(raw) ? raw : path.join(process.cwd(), "prisma", raw);
  return path.join(path.dirname(db), "bank-pdf");
}
export const pdfPath = (id: number) => path.join(dataDir(), `${id}.pdf`);

export function savePdf(id: number, data: Buffer) {
  fs.mkdirSync(dataDir(), { recursive: true });
  fs.writeFileSync(pdfPath(id), data);
}

/** Viti shkollor (viti fillestar) i një date — sipas viteve të regjistruara; ndryshe 01.09–31.08. */
export async function schoolYearResolver(orgId: number): Promise<(d: Date) => number> {
  const years = await prisma.schoolYear.findMany({ where: { organizationId: orgId, startDate: { not: null }, endDate: { not: null } }, select: { label: true, startDate: true, endDate: true } });
  return (d: Date) => {
    const y = years.find(y => y.startDate! <= d && d <= y.endDate!);
    if (y) return parseInt(y.label);
    return d.getUTCMonth() + 1 >= 9 ? d.getUTCFullYear() : d.getUTCFullYear() - 1;
  };
}

const celesi = (llogaria: string | null, r: BktRow) =>
  [llogaria ?? "", r.data, r.referenca, r.lloji, r.drejtimi === "DALJE" ? r.shuma : 0, r.drejtimi === "HYRJE" ? r.shuma : 0, r.gjendja].join("|");

// Një ekstrakt në një kohë (OCR-ja është e rëndë)
let queue: Promise<void> = Promise.resolve();
const running = new Set<number>();

export function startProcessing(id: number): void {
  if (running.has(id)) return;
  running.add(id);
  queue = queue.then(() => processEkstrakt(id)).catch(e => console.error("[banka] përpunimi dështoi", id, e)).finally(() => running.delete(id));
}
export const isProcessing = (id: number) => running.has(id);

async function processEkstrakt(id: number): Promise<void> {
  const ek = await prisma.bankEkstrakt.findUnique({ where: { id } });
  if (!ek) return;
  try {
    const pdf = fs.readFileSync(pdfPath(id));
    await prisma.bankEkstrakt.update({ where: { id }, data: { statusi: "NE_PERPUNIM", faqetGati: 0, gabimi: null } });
    let last = 0;
    const pages = await ocrPdf(pdf, async (done, total) => {
      if (done === total || Date.now() - last > 1500) {
        last = Date.now();
        await prisma.bankEkstrakt.update({ where: { id }, data: { faqetGati: done, faqetGjithsej: total } });
      }
    });
    const res = parseBktPages(pages);
    const rules = await loadRules(prisma, ek.organizationId);
    const syOf = await schoolYearResolver(ek.organizationId);

    // Kontrolli i dyfishimit me ekstraktet e IMPORTUARA
    const keys = res.rows.map(r => celesi(res.llogaria, r));
    const existing = new Set((await prisma.bankLevizje.findMany({
      where: { organizationId: ek.organizationId, celesi: { in: keys }, ekstrakt: { statusi: "IMPORTUAR" } }, select: { celesi: true },
    })).map(x => x.celesi));

    const rows = res.rows.map((r, i) => {
      const drejtimi = r.drejtimi ?? "DALJE";
      const rule = r.drejtimi ? matchRule({ lloji: r.lloji, pala: r.pala, pershkrimi: r.pershkrimi, drejtimi }, rules) : null;
      const data = new Date(`${r.data}T00:00:00Z`);
      const statusi = existing.has(keys[i]) ? "DYFISHT" : rule?.zerId ? "PROPOZUAR" : "PA_KLASIFIKUAR";
      return {
        organizationId: ek.organizationId, ekstraktId: id, nr: r.nr, faqja: r.faqja, llogaria: res.llogaria,
        data, dataValuta: r.dataValuta ? new Date(`${r.dataValuta}T00:00:00Z`) : null,
        referenca: r.referenca, lloji: r.lloji,
        debi: r.drejtimi === "DALJE" ? r.shuma : 0, kredi: r.drejtimi === "HYRJE" ? r.shuma : 0,
        gjendja: r.gjendja, pala: r.pala || null, pershkrimi: r.pershkrimi || null,
        zerId: statusi === "DYFISHT" ? null : rule?.zerId ?? null, vitiShkollor: syOf(data), statusi, celesi: keys[i],
      };
    });

    const sum = (k: "debi" | "kredi") => rows.reduce((s, r) => s + r[k], 0);
    await prisma.$transaction(async tx => {
      await tx.bankLevizje.deleteMany({ where: { ekstraktId: id } });
      for (let i = 0; i < rows.length; i += 200) await tx.bankLevizje.createMany({ data: rows.slice(i, i + 200) });
      await tx.bankEkstrakt.update({
        where: { id },
        data: {
          llogaria: res.llogaria,
          periudhaNga: res.periudhaNga ? new Date(`${res.periudhaNga}T00:00:00Z`) : null,
          periudhaDeri: res.periudhaDeri ? new Date(`${res.periudhaDeri}T00:00:00Z`) : null,
          gjendjaFillestare: res.gjendjaFillestare, gjendjaPerfundimtare: res.gjendjaPerfundimtare,
          totalDebi: sum("debi"), totalKredi: sum("kredi"),
          nrDebi: rows.filter(r => r.debi > 0).length, nrKredi: rows.filter(r => r.kredi > 0).length,
          faqetGati: pages.length, faqetGjithsej: pages.length,
          statusi: res.gabimet.length ? "GABIM" : "DRAFT",
          gabimi: res.gabimet.length ? res.gabimet.slice(0, 30).join("\n") : null,
        },
      });
    }, { timeout: 120_000 });
  } catch (e) {
    await prisma.bankEkstrakt.update({ where: { id }, data: { statusi: "GABIM", gabimi: e instanceof Error ? e.message : String(e) } });
  }
}

/** Rizbaton rregullat te rreshtat që s'janë zgjedhur me dorë (PROPOZUAR / PA_KLASIFIKUAR). */
export async function reclassify(ekstraktId: number, orgId: number): Promise<number> {
  const rules = await loadRules(prisma, orgId);
  const rows = await prisma.bankLevizje.findMany({ where: { ekstraktId, statusi: { in: ["PROPOZUAR", "PA_KLASIFIKUAR"] } } });
  let changed = 0;
  for (const r of rows) {
    const rule = matchRule({ lloji: r.lloji, pala: r.pala, pershkrimi: r.pershkrimi, drejtimi: r.kredi > 0 ? "HYRJE" : "DALJE" }, rules);
    const zerId = rule?.zerId ?? null;
    const statusi = zerId ? "PROPOZUAR" : "PA_KLASIFIKUAR";
    if (zerId !== r.zerId || statusi !== r.statusi) {
      await prisma.bankLevizje.update({ where: { id: r.id }, data: { zerId, statusi } });
      changed++;
    }
  }
  return changed;
}
