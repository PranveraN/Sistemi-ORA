import { keyTokens, normalizeKey, phraseCoverage, normalizeText, type CatalogEntry } from "@/lib/materialMatcher";

// Fusha "Shto artikull…" e faqes së mësuesit: leximi i sasisë/njësisë dhe
// sugjerimet nga katalogu. Funksione të pastra — teste: teacherItemInput.test.ts

/** Njësitë e sasisë që njihen (forma e normalizuar → njësia që shfaqet). "gr", "ml", "cm" NUK janë këtu. */
const QTY_UNITS: Record<string, string> = {
  kuti: "kuti", cuti: "kuti", kutia: "kuti", kutite: "kuti",
  pako: "pako", paketa: "pako", pakete: "pako", pak: "pako", pakot: "pako",
  cope: "copë", cop: "copë", copa: "copë", cp: "copë",
  rrotull: "rrotull", rrotulla: "rrotull",
  set: "set", seti: "set", sete: "set",
};

export interface ParsedItem { name: string; qty: number; unit: string | null }

/**
 * "Markera te zi 3 cuti" → { name: "Markera te zi", qty: 3, unit: "kuti" }
 * "Leter A4 300 gr"      → { name: "Leter A4 300 gr", qty: 1 } (300 gr është pjesë e emrit)
 * "A4" s'është sasi (numri duhet të ketë hapësirë para tij); "3 markera" → qty 3.
 */
export function parseItemInput(text: string): ParsedItem {
  const t = text.trim().replace(/\s+/g, " ");
  const unitOf = (u?: string) => (u ? QTY_UNITS[normalizeText(u)] : undefined);
  // Numri (+ njësia) në fund
  let m = t.match(/^(.*?)\s+(?:x\s*)?(\d+)\s*([a-zA-ZçëÇË]+)?\.?$/);
  if (m && m[1] && (!m[3] || unitOf(m[3]))) return { name: m[1].trim(), qty: Math.max(1, parseInt(m[2], 10)), unit: unitOf(m[3]) ?? null };
  // Numri (+ njësia) në fillim
  m = t.match(/^(\d+)\s*(?:x\s*)?([a-zA-ZçëÇË]+)?\s+(.+)$/);
  if (m && (!m[2] || unitOf(m[2]))) return { name: m[3].trim(), qty: Math.max(1, parseInt(m[1], 10)), unit: unitOf(m[2]) ?? null };
  return { name: t, qty: 1, unit: null };
}

export interface RankedEntry { entry: CatalogEntry; score: number; exact: boolean }

/**
 * Sugjerimet nga katalogu (emri + sinonimet), pa ndjeshmëri ndaj shkronjave të
 * mëdha dhe ë/ç, me rrënjë fjalësh ("markera" = "marker"). Vetëm përputhje të
 * arsyeshme: të gjitha fjalët e mësuesit duhet të gjenden te emri.
 */
export function rankCatalog(query: string, catalog: CatalogEntry[], limit = 5): RankedEntry[] {
  const qKey = normalizeKey(query);
  const qTokens = keyTokens(query);
  if (!qTokens.length) return [];
  const qNorm = normalizeText(query);
  const out: RankedEntry[] = [];
  for (const entry of catalog) {
    let best = 0;
    let exact = false;
    for (const [i, n] of [entry.name, ...(entry.aliases ?? [])].entries()) {
      if (normalizeKey(n) === qKey) { best = 1; exact = true; break; }
      const nNorm = normalizeText(n);
      if (i === 0 && nNorm.startsWith(qNorm) && qNorm.length >= 2) { best = Math.max(best, 0.9); continue; }
      const c = phraseCoverage(qTokens, keyTokens(n));
      if (c.query < 0.99) continue; // jo "Kuti arkivi" për "markera"
      best = Math.max(best, 0.6 + 0.35 * c.name);
    }
    if (best > 0) out.push({ entry, score: best, exact });
  }
  return out
    .sort((a, b) => b.score - a.score || Number(a.entry.reviewStatus === "pending") - Number(b.entry.reviewStatus === "pending") || a.entry.name.length - b.entry.name.length)
    .slice(0, limit);
}

/** Përputhje mjaft e fortë që Enter ta zgjedhë vetë (pa e shtuar si "jo në katalog"). */
export const isStrongMatch = (r: RankedEntry | undefined) => !!r && (r.exact || r.score >= 0.8);
