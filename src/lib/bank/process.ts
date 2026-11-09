import fs from "fs";
import path from "path";
import { prisma } from "@/lib/prisma";
import { ocrPdf } from "@/lib/bank/ocr";
import { countPdfImages } from "@/lib/bank/pdfImages";
import { pdfTextPages } from "@/lib/bank/pdfText";
import { parseBktPages, type BktRow } from "@/lib/bank/parseBkt";
import { loadRules, matchRule } from "@/lib/bank/rules";

// Përpunimi i një ekstrakti në sfond: PDF → OCR → rreshtat → kontrolli i gjendjes →
// zërat e propozuar. Rezultati ruhet si DRAFT; asgjë s'hyn në bilanc pa konfirmim
// ("Importo"). PDF-të ruhen pranë databazës si dokument burimor: bank-pdf/<id>.pdf, dhe kur
// ekstrakti vjen në disa pjesë: <id>-p2.pdf, <id>-p3.pdf… (renditen sipas datave gjatë leximit).

function dataDir(): string {
  const raw = (process.env.DATABASE_URL || "").replace(/^file:/, "");
  const db = path.isAbsolute(raw) ? raw : path.join(process.cwd(), "prisma", raw);
  return path.join(path.dirname(db), "bank-pdf");
}
const partPath = (id: number, n: number) => path.join(dataDir(), n === 1 ? `${id}.pdf` : `${id}-p${n}.pdf`);

/** Skedarët PDF të një ekstrakti (1 ose më shumë pjesë), sipas radhës së ngarkimit. */
export function pdfPaths(id: number): string[] {
  const out: string[] = [];
  for (let n = 1; fs.existsSync(partPath(id, n)); n++) out.push(partPath(id, n));
  return out;
}

export function savePdfs(id: number, parts: Buffer[]) {
  fs.mkdirSync(dataDir(), { recursive: true });
  parts.forEach((data, i) => fs.writeFileSync(partPath(id, i + 1), data));
}

export function deletePdfs(id: number) {
  for (const p of pdfPaths(id)) fs.rmSync(p, { force: true });
}

// Data e parë që gjendet në tekstin e një pjese (periudha "FROM", ose rreshti i parë) — për renditjen
const MON: Record<string, string> = { JAN: "01", FEB: "02", MAR: "03", APR: "04", MAY: "05", JUN: "06", JUL: "07", AUG: "08", SEP: "09", OCT: "10", NOV: "11", DEC: "12" };
function firstDate(pages: string[]): string {
  const text = pages.join("\n").replace(/0CT/g, "OCT");
  const m = text.match(/FROM\s*\(NGA DATA\):\s*(\d{2})-([A-Z]{3})-(\d{2})/) ?? text.match(/^\s*(\d{2})-([A-Z]{3})-(\d{2})\s/m);
  return m && MON[m[2]] ? `20${m[3]}-${MON[m[2]]}-${m[1]}` : "9999";
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
    const files = pdfPaths(id).map(p => fs.readFileSync(p));
    if (!files.length) throw new Error("PDF-ja e këtij ekstrakti s'gjendet — ngarkoje sërish.");
    // PDF me tekst (e-banking) lexohet drejtpërdrejt; PDF e skanuar (foto) kalon nga OCR-ja
    const textOf = await Promise.all(files.map(f => pdfTextPages(f)));
    const total = files.reduce((s, f, i) => s + (textOf[i]?.length ?? countPdfImages(f)), 0);
    await prisma.bankEkstrakt.update({ where: { id }, data: { statusi: "NE_PERPUNIM", faqetGati: 0, faqetGjithsej: total, gabimi: null } });
    let last = 0, offset = 0;
    const parts: string[][] = [];
    for (const [fi, pdf] of files.entries()) {
      const direct = textOf[fi];
      if (!direct && !countPdfImages(pdf)) throw new Error("Një nga PDF-të s'ka as tekst ekstrakti, as faqe të skanuara — a është ekstrakt i BKT-së?");
      const texts = direct ?? await ocrPdf(pdf, async (done) => {
        const d = offset + done;
        if (d === total || Date.now() - last > 1000) {
          last = Date.now();
          await prisma.bankEkstrakt.update({ where: { id }, data: { faqetGati: d, faqetGjithsej: total } });
        }
      });
      offset += texts.length;
      if (direct) await prisma.bankEkstrakt.update({ where: { id }, data: { faqetGati: offset } });
      parts.push(texts);
    }
    // Pjesët renditen sipas datës së tyre të parë (pavarësisht radhës së zgjedhjes)
    const sorted = parts.map(p => ({ p, d: firstDate(p) })).sort((a, b) => a.d.localeCompare(b.d)).map(x => x.p);
    const partStarts = sorted.map((_, i) => sorted.slice(0, i).reduce((n, p) => n + p.length, 0));
    const pages = sorted.flat();
    const res = parseBktPages(pages, partStarts);
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
          perseritur: res.perseritur,
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

/**
 * Bashkon dy ekstrakte të paimportuara të së njëjtës llogari në NJË (p.sh. 2024 i ngarkuar në dy herë),
 * pa i rilexuar PDF-të. Kërkon që pjesët të lidhen: gjendja përfundimtare e të parit = gjendja
 * fillestare e të dytit (përndryshe mungon një periudhë). Rreshtat e njëjtë (mbivendosje) mbahen
 * një herë. I dyti zhduket; PDF-të e tij bëhen pjesë të të parit. Kthen mesazhin e gabimit ose null.
 */
export async function mergeEkstrakte(orgId: number, aId: number, bId: number): Promise<string | null> {
  if (aId === bId) return "Zgjidh një ekstrakt tjetër.";
  const both = await prisma.bankEkstrakt.findMany({ where: { organizationId: orgId, id: { in: [aId, bId] } } });
  if (both.length !== 2) return "Ekstrakti s'u gjet.";
  if (both.some(e => e.statusi === "IMPORTUAR")) return "Njëri është i importuar — fillimisht ktheje në draft.";
  if (both.some(e => e.statusi !== "DRAFT")) return "Bashkohen vetëm ekstrakte të lexuara pa gabime (Draft).";
  if (both.some(e => isProcessing(e.id))) return "Njëri po lexohet ende.";
  if (both[0].llogaria !== both[1].llogaria) return "Ekstraktet janë të llogarive të ndryshme.";
  const [first, second] = [...both].sort((x, y) => (x.periudhaNga?.getTime() ?? 0) - (y.periudhaNga?.getTime() ?? 0));
  const eur = (c: number | null) => ((c ?? 0) / 100).toLocaleString("de-DE", { minimumFractionDigits: 2 }) + " €";
  const dmy = (d: Date | null) => d ? d.toISOString().slice(0, 10).split("-").reverse().join(".") : "—";

  // Rreshtat e të dytit që janë edhe te i pari (mbivendosje datash) s'barten
  const firstKeys = new Set((await prisma.bankLevizje.findMany({ where: { ekstraktId: first.id }, select: { celesi: true } })).map(r => r.celesi));
  const secondRows = await prisma.bankLevizje.findMany({ where: { ekstraktId: second.id }, orderBy: { nr: "asc" } });
  const dupIds = secondRows.filter(r => firstKeys.has(r.celesi)).map(r => r.id);
  const overlap = dupIds.length > 0;
  // Pa mbivendosje: pjesa e dytë duhet të fillojë aty ku mbaron e para
  if (!overlap && first.gjendjaPerfundimtare !== second.gjendjaFillestare) {
    return `Pjesët s'lidhen: ekstrakti ${dmy(first.periudhaNga)} – ${dmy(first.periudhaDeri)} mbaron me ${eur(first.gjendjaPerfundimtare)}, `
      + `ndërsa ${dmy(second.periudhaNga)} – ${dmy(second.periudhaDeri)} fillon me ${eur(second.gjendjaFillestare)} `
      + `(diferenca ${eur((second.gjendjaFillestare ?? 0) - (first.gjendjaPerfundimtare ?? 0))}). `
      + `Mungon ekstrakti i periudhës mes tyre — ngarkoje edhe atë, pastaj bashkoji.`;
  }

  const firstCount = await prisma.bankLevizje.count({ where: { ekstraktId: first.id } });
  const moved = secondRows.filter(r => !firstKeys.has(r.celesi));
  const sumK = (await prisma.bankLevizje.aggregate({ where: { ekstraktId: first.id }, _sum: { kredi: true, debi: true } }))._sum;
  const addK = moved.reduce((s, r) => s + r.kredi, 0), addD = moved.reduce((s, r) => s + r.debi, 0);

  await prisma.$transaction(async tx => {
    for (const [i, r] of moved.entries()) await tx.bankLevizje.update({ where: { id: r.id }, data: { ekstraktId: first.id, nr: firstCount + i + 1 } });
    if (dupIds.length) await tx.bankLevizje.deleteMany({ where: { id: { in: dupIds } } });
    await tx.bankEkstrakt.update({
      where: { id: first.id },
      data: {
        periudhaDeri: second.periudhaDeri, gjendjaPerfundimtare: second.gjendjaPerfundimtare,
        totalKredi: (sumK.kredi ?? 0) + addK, totalDebi: (sumK.debi ?? 0) + addD,
        nrKredi: (first.nrKredi ?? 0) + moved.filter(r => r.kredi > 0).length, nrDebi: (first.nrDebi ?? 0) + moved.filter(r => r.debi > 0).length,
        faqetGati: first.faqetGati + second.faqetGati, faqetGjithsej: first.faqetGjithsej + second.faqetGjithsej,
        perseritur: first.perseritur + second.perseritur + dupIds.length,
        emriSkedarit: [first.emriSkedarit, second.emriSkedarit].filter(Boolean).join(" + ").slice(0, 200),
      },
    });
    await tx.bankEkstrakt.delete({ where: { id: second.id } });
  }, { timeout: 120_000 });

  // PDF-të e të dytit bëhen pjesë të të parit (dokumenti burimor ruhet)
  let n = pdfPaths(first.id).length;
  for (const p of pdfPaths(second.id)) fs.renameSync(p, partPath(first.id, ++n));
  return null;
}
