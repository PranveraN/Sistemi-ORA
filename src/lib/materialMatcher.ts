// Motori i përputhjes së tekstit të mësuesit me katalogun e materialeve.
// Funksione të pastra (pa databazë) — ekzekutohen si në shfletues (theksimi
// vjollcë ndërsa shkruan) ashtu edhe në server (vendimi përfundimtar në dërgim).
// Teste: src/lib/materialMatcher.test.ts (npx tsx src/lib/materialMatcher.test.ts)

/* ─────────────────────────── Normalizimi ─────────────────────────── */

/** Shkronja të vogla, ë→e, ç→c, pa shenja pikësimi, hapësira të njëfishta. */
export function normalizeText(s: string): string {
  return s
    .toLowerCase()
    .replace(/[ëË]/g, "e").replace(/[çÇ]/g, "c")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Mbaresat e zakonshme shqipe (shquarja/shumësi/rasat) — më e gjata e para.
const SUFFIXES = ["ave", "ash", "eve", "ive", "at", "et", "it", "in", "ve", "te", "a", "e", "i"];

/** Rrënja e një fjale (pas normalizimit): "markerat"/"markera"/"marker" → "marker". */
export function stem(word: string): string {
  if (/\d/.test(word) || word.length <= 4) return word.replace(/e$/, "") || word;
  for (const suf of SUFFIXES) {
    if (word.endsWith(suf) && word.length - suf.length >= 4) return word.slice(0, -suf.length);
  }
  return word;
}

// Fjalë lidhëse që s'ndihmojnë në përputhje
const STOPWORDS = new Set(["per", "me", "te", "e", "i", "dhe", "nga", "ne", "a", "se", "si", "pa", "nje", "disa", "cdo", "ca", "ose"]);

/** Fjalët kuptimplote të normalizuara + rrënjët (për krahasim). */
export function keyTokens(s: string): string[] {
  return normalizeText(s).split(" ").filter(t => t && !STOPWORDS.has(t)).map(stem);
}

/** Forma e normalizuar e një frazeje (për sinonimet, dyfishimet). */
export function normalizeKey(s: string): string {
  return keyTokens(s).join(" ");
}

/* ─────────────────────────── Sasia dhe njësia ─────────────────────────── */

const NUMBER_WORDS: Record<string, number> = {
  nje: 1, dy: 2, tre: 3, tri: 3, kater: 4, pese: 5, gjashte: 6, shtate: 7, tete: 8, nente: 9, dhjete: 10,
  njezet: 20, pesembedhjete: 15, dymbedhjete: 12,
};

// Njësitë (forma e normalizuar → vlera te UNITS, materialConstants.ts)
const UNIT_WORDS: Record<string, string> = {
  cope: "copë", cop: "copë", copa: "copë", copet: "copë", cp: "copë",
  pako: "paketë", pakot: "paketë", paket: "paketë", pakete: "paketë", paketa: "paketë", paketat: "paketë",
  kuti: "kuti", kutia: "kuti", kutite: "kuti", kutijat: "kuti",
  set: "grup", sete: "grup", setet: "grup", grup: "grup", grupe: "grup",
  pale: "palë", palet: "palë",
  top: "top", topa: "top", rrotull: "top", rrotulla: "top",
  meter: "metër", metra: "metër", metro: "metër", m: "metër",
  cm: "cm", kg: "kg", gram: "gram", gr: "gram", liter: "litër", litra: "litër", l: "litër", ml: "ml",
};

/* ─────────────────────────── Ndarja e tekstit ─────────────────────────── */

export interface Segment {
  /** Pjesa e plotë siç u shkrua */
  raw: string;
  start: number;
  end: number;
  quantity: number;
  unit: string | null;
  /** Emri i materialit (pa sasi/njësi/qëllim) dhe pozicioni i tij në tekstin origjinal */
  core: string;
  coreStart: number;
  coreEnd: number;
  /** Arsyeja kur pjesa injorohet (s'është material) */
  ignored: string | null;
}

// Ndarësit: presje, pikëpresje, pikë, rresht i ri, " dhe ", " edhe ", &, +
// (pikat mes numrave — 1.5, 12.10 — maskohen më parë, pa "lookbehind" që s'punon në iPhone të vjetër)
const SPLIT_RE = /(,|;|\n|\.|\s+dhe\s+|\s+edhe\s+|\s*&\s*|\s*\+\s*)/gi;
const DECIMAL_DOT = "․"; // i njëjti gjatësi (1 karakter) — pozicionet s'ndryshojnë

// Fillime fjalish që s'janë material
const LEADING_FILLERS = [
  "na duhen", "na duhet", "na nevojiten", "na nevojitet", "nevojiten", "nevojitet", "kemi nevoje per",
  "kam nevoje per", "ju lutem", "lutem", "dua", "duam", "kerkoj", "kerkojme", "me duhen", "me duhet",
];

// Fjalë qëllimi/kohe pas "për" → pjesa "për …" hiqet (s'është pjesë e emrit të materialit)
// ("fëmijë", "art", "tabelë" s'janë këtu — janë pjesë e emrave të produkteve: "Gërshërë për fëmijë")
const PURPOSE_AFTER_PER = /^(klas|nxenes|projekt|aktivitet|ore\b|oren|mesim|jav|muaj|dit|neser|sot|mua\b|ne\b|grup|feste|fest|shfaqj|ekskursion|garen|gara\b|panair|ekspozit|punetori|lend|kuiz|provim|test|vitin|semest|periudh|sallen|kabinet)/;

// Ditët e javës dhe fjalët e kohës, në të gjitha format e lakuara ("të hënën", "javën", "muajin")
const DAY_WORDS = /\b(hene\w*|mart[ei]\w*|merkur\w*|enjt\w*|premt\w*|shtun\w*|diel\w*|sot|neser|pasneser|jav\w*|muaj\w*|dit\w*|ore|oren|oret|mengjes\w*|pasdit\w*|mbremj\w*)\b/;
const CLASS_RE = /\b(klas\w*\s*)?\d{1,2}\s?[a-d]\b|\bklas\w*\b/;
const DATE_RE = /\b\d{1,2}[./-]\d{1,2}([./-]\d{2,4})?\b/;

function lettersCount(s: string): number {
  return (s.match(/[a-zA-ZëËçÇ]/g) || []).length;
}

/** Ndan tekstin e mësuesit në pjesë, me sasi/njësi dhe emrin e materialit. */
export function splitSegments(text: string): Segment[] {
  const out: Segment[] = [];
  let pos = 0;
  const parts: { raw: string; start: number }[] = [];
  const masked = text.replace(/(\d)\.(?=\d)/g, `$1${DECIMAL_DOT}`);
  SPLIT_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = SPLIT_RE.exec(masked))) {
    parts.push({ raw: text.slice(pos, m.index), start: pos });
    pos = m.index + m[0].length;
  }
  parts.push({ raw: text.slice(pos), start: pos });

  for (const p of parts) {
    if (!p.raw.trim()) continue;
    for (const sub of splitByQuantity(p.raw, p.start)) out.push(analyzeSegment(sub.raw, sub.start));
  }
  return out;
}

// Njësi MADHËSIE — "1 l ose 2 l", "500 ml", "30 cm" përshkruajnë artikullin, s'fillojnë artikull të ri
const SIZE_UNITS = new Set(["l", "ml", "cl", "dl", "liter", "litra", "litre", "kg", "g", "gr", "gram", "grame", "cm", "mm", "m", "meter", "metra", "metro"]);

function isNumberWord(n: string): boolean {
  return /^\d+$/.test(n) || NUMBER_WORDS[n] != null;
}

/**
 * Mësuesit shpesh s'vendosin presje: "4 shpuza të mëdha 2 shishe xhami 50 shkopinj".
 * Një numër i ri sasie fillon artikull të ri, PËRVEÇ kur:
 *  - pasohet nga njësi madhësie ("1 l ose 2 l", "500 ml") → përshkrim i artikullit;
 *  - paraprihet nga "ose"/"deri"/"x" ("1 l ose 2 l", "20 x 30");
 *  - pas tij s'ka emër materiali para numrit tjetër ("lapsa me ngjyra 12 copë") → mbetet me artikullin.
 */
function splitByQuantity(raw: string, start: number): { raw: string; start: number }[] {
  const words: { n: string; s: number }[] = [];
  const wre = /[^\s]+/g;
  let m: RegExpExecArray | null;
  while ((m = wre.exec(raw))) words.push({ n: normalizeText(m[0]), s: m.index });
  const isNameWord = (n: string) => !!n && !isNumberWord(n) && !UNIT_WORDS[n] && !SIZE_UNITS.has(n) && !STOPWORDS.has(n) && n !== "ose" && lettersCount(n) >= 2;

  const cuts: number[] = [];
  let hasNameSinceCut = false;
  for (let k = 0; k < words.length; k++) {
    const w = words[k].n;
    if (isNumberWord(w) && k > 0 && hasNameSinceCut) {
      const prev = words[k - 1].n;
      const next = words[k + 1]?.n ?? "";
      const isSpec = SIZE_UNITS.has(next) || ["ose", "deri", "x", "me", "nga"].includes(prev);
      // a ka emër materiali pas këtij numri (para numrit tjetër)?
      let nameAfter = false;
      for (let j = k + 1; j < words.length && !isNumberWord(words[j].n); j++) if (isNameWord(words[j].n)) { nameAfter = true; break; }
      if (!isSpec && nameAfter) { cuts.push(words[k].s); hasNameSinceCut = false; }
    }
    if (isNameWord(w)) hasNameSinceCut = true;
  }
  if (!cuts.length) return [{ raw, start }];
  const out: { raw: string; start: number }[] = [];
  let prev = 0;
  for (const c of cuts) { out.push({ raw: raw.slice(prev, c), start: start + prev }); prev = c; }
  out.push({ raw: raw.slice(prev), start: start + prev });
  return out;
}

function analyzeSegment(raw: string, start: number): Segment {
  // Punojmë mbi "fjalë" me pozicionet e tyre në tekstin origjinal
  const words: { w: string; n: string; s: number; e: number }[] = [];
  const wre = /[^\s]+/g;
  let m: RegExpExecArray | null;
  while ((m = wre.exec(raw))) {
    const clean = m[0].replace(/^[("'«“]+|[)"'»”:!?]+$/g, "");
    const lead = m[0].indexOf(clean);
    words.push({ w: clean, n: normalizeText(clean), s: start + m.index + lead, e: start + m.index + lead + clean.length });
  }
  const seg: Segment = { raw, start, end: start + raw.length, quantity: 1, unit: null, core: "", coreStart: start, coreEnd: start, ignored: null };
  if (!words.length) { seg.ignored = "bosh"; return seg; }

  // 1. Hiq fillimet "na duhen", "ju lutem" ...
  let i = 0;
  const joined = () => words.slice(i).map(x => x.n).join(" ");
  for (const f of LEADING_FILLERS) {
    if (joined().startsWith(f + " ") || joined() === f) { i += f.split(" ").length; break; }
  }

  // 2. Hiq fundin "për <klasë/qëllim/kohë> …"
  let end = words.length;
  for (let k = i; k < words.length - 1; k++) {
    if (words[k].n === "per" && PURPOSE_AFTER_PER.test(words.slice(k + 1).map(x => x.n).join(" "))) { end = k; break; }
  }
  // Edhe referencat e klasës/kohës pa "për" në fund ("... 3A", "... javën tjetër")
  while (end > i && (CLASS_RE.test(words[end - 1].n) || DAY_WORDS.test(words[end - 1].n) || words[end - 1].n === "tjeter" || DATE_RE.test(words[end - 1].w))) end--;
  // Ndonjë "per" i mbetur në fund
  while (end > i && ["per", "e", "i", "te", "me"].includes(words[end - 1].n)) end--;

  let body = words.slice(i, end);

  // 3. Sasia + njësia (kudo në pjesë: "10 markera", "markerat 5 cope", "nje kuti shkumesa")
  for (let k = 0; k < body.length; k++) {
    const n = body[k].n;
    const num = /^\d+$/.test(n) ? parseInt(n) : NUMBER_WORDS[n];
    if (num != null && num > 0 && num < 10000) {
      // numri i ndjekur nga njësi?
      const next = body[k + 1]?.n;
      const unit = next ? UNIT_WORDS[next] : undefined;
      // "A4", "80g" janë pjesë e emrit — s'janë sasi (kapen nga /^\d+$/)
      seg.quantity = num;
      if (unit) { seg.unit = unit; body = [...body.slice(0, k), ...body.slice(k + 2)]; }
      else body = [...body.slice(0, k), ...body.slice(k + 1)];
      break;
    }
  }
  // Njësi pa numër ("një kuti" u kap më lart; "kuti shkumesa" → njësi)
  if (!seg.unit && body.length > 1 && UNIT_WORDS[body[0].n]) {
    seg.unit = UNIT_WORDS[body[0].n];
    body = body.slice(1);
  }
  // "kuti" / "pako" mund të jetë mes fjalëve pas sasisë së lexuar
  if (!seg.unit) {
    const k = body.findIndex(x => UNIT_WORDS[x.n] && x.n.length > 1);
    if (k >= 0 && body.length > 1) { seg.unit = UNIT_WORDS[body[k].n]; body = [...body.slice(0, k), ...body.slice(k + 1)]; }
  }

  if (!body.length) { seg.ignored = "pa emër materiali"; return seg; }
  seg.coreStart = body[0].s;
  seg.coreEnd = body[body.length - 1].e;
  seg.core = body.map(x => x.w).join(" ");

  // 4. Rregullat e injorimit
  const coreN = normalizeText(seg.core);
  if (lettersCount(seg.core) < 3) seg.ignored = "më pak se 3 shkronja";
  else if (/^[\d\s]+$/.test(coreN)) seg.ignored = "vetëm numra";
  else if (coreN.split(" ").every(t => CLASS_RE.test(t) || DAY_WORDS.test(t) || DATE_RE.test(t) || t === "tjeter" || STOPWORDS.has(t))) seg.ignored = "klasë/datë/kohë";
  else if (/^per\b/.test(coreN)) seg.ignored = "qëllim/arsye";
  return seg;
}

/* ─────────────────────────── Katalogu dhe përputhja ─────────────────────────── */

export interface CatalogEntry {
  id: number;
  name: string;
  unit: string;
  categoryName?: string | null;
  reviewStatus?: string;
  aliases?: string[];
}

interface IndexedName { tokens: string[]; key: string; isAlias: boolean }
export interface CatalogIndex { entries: { entry: CatalogEntry; names: IndexedName[] }[] }

export function buildIndex(catalog: CatalogEntry[]): CatalogIndex {
  return {
    entries: catalog.map(entry => ({
      entry,
      names: [
        { tokens: keyTokens(entry.name), key: normalizeKey(entry.name), isAlias: false },
        ...(entry.aliases ?? []).map(a => ({ tokens: keyTokens(a), key: normalizeKey(a), isAlias: true })),
      ].filter(n => n.tokens.length),
    })),
  };
}

/** Ngjashmëria e dy fjalëve 0..1 (Levenshtein; prefiksi i përbashkët ndihmon "marker"/"markeri"). */
export function wordSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (!a || !b) return 0;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return 0.92;
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return 1 - dp[a.length][b.length] / Math.max(a.length, b.length);
}

/** Mbulimi i fjalëve të dy frazave: sa nga fjalët e mësuesit (query) dhe sa nga
 *  fjalët e emrit të katalogut gjenden te tjetra (0..1). */
export function phraseCoverage(q: string[], n: string[]): { query: number; name: number } {
  if (!q.length || !n.length) return { query: 0, name: 0 };
  const best = (t: string, list: string[]) => list.reduce((m, x) => Math.max(m, wordSimilarity(t, x)), 0);
  // Fjalët me ngjashmëri të ulët s'numërohen fare (shmang përputhjet e rastësishme)
  const cov = (arr: number[]) => arr.reduce((s, x) => s + (x >= 0.75 ? x : 0), 0) / arr.length;
  return { query: cov(q.map(t => best(t, n))), name: cov(n.map(t => best(t, q))) };
}

/** Ngjashmëria e dy frazave 0..1 — mbulimi i fjalëve në të dy drejtimet. */
export function phraseSimilarity(q: string[], n: string[]): number {
  const c = phraseCoverage(q, n);
  return 0.65 * c.query + 0.35 * c.name;
}

// Përputhja e përafërt pranohet vetëm kur (pothuaj) TË GJITHA fjalët kuptimplote
// të mësuesit gjenden në emër — "shirit dekorativ me shkëlqim" ≠ "Shirit dekorativ"
// (fjala shtesë e bën artikull tjetër → propozohet si alternativë, jo si zgjedhje).
const MIN_QUERY_COVERAGE = 0.8;

export type MatchType = "exact" | "alias" | "fuzzy";

export interface SegmentMatch {
  segment: Segment;
  item: CatalogEntry | null;
  matchType: MatchType | null;
  score: number;
  alternatives: { item: CatalogEntry; score: number }[];
}

export const FUZZY_THRESHOLD = 0.72;
const ALT_THRESHOLD = 0.45;

export function matchPhrase(phrase: string, index: CatalogIndex): Omit<SegmentMatch, "segment"> {
  const q = keyTokens(phrase);
  const key = q.join(" ");
  const scored: { item: CatalogEntry; score: number; type: MatchType; queryCov: number }[] = [];
  for (const { entry, names } of index.entries) {
    let bestScore = 0;
    let bestType: MatchType = "fuzzy";
    let bestQueryCov = 0;
    for (const n of names) {
      if (n.key === key) { bestScore = 1; bestType = n.isAlias ? "alias" : "exact"; bestQueryCov = 1; break; }
      const c = phraseCoverage(q, n.tokens);
      const s = 0.65 * c.query + 0.35 * c.name;
      if (s > bestScore) { bestScore = s; bestType = "fuzzy"; bestQueryCov = c.query; }
    }
    if (bestScore >= ALT_THRESHOLD) scored.push({ item: entry, score: bestScore, type: bestType, queryCov: bestQueryCov });
  }
  // Barazim: preferohen artikujt e aprovuar dhe emrat më të shkurtër (më të përgjithshëm)
  scored.sort((a, b) =>
    b.score - a.score ||
    Number(a.item.reviewStatus === "pending") - Number(b.item.reviewStatus === "pending") ||
    a.item.name.length - b.item.name.length);
  const top = scored[0];
  const hit = top && (top.type !== "fuzzy" || (top.score >= FUZZY_THRESHOLD && top.queryCov >= MIN_QUERY_COVERAGE)) ? top : null;
  // Alternativat pa emra të përsëritur (katalogu ka disa emra identikë)
  const seenNames = new Set<string>(hit ? [normalizeKey(hit.item.name)] : []);
  const alternatives: { item: CatalogEntry; score: number }[] = [];
  for (const s of scored) {
    if (alternatives.length >= 3) break;
    const k = normalizeKey(s.item.name);
    if (seenNames.has(k)) continue;
    seenNames.add(k);
    alternatives.push({ item: s.item, score: Math.round(s.score * 100) / 100 });
  }
  return {
    item: hit?.item ?? null,
    matchType: hit ? hit.type : null,
    score: top?.score ?? 0,
    alternatives,
  };
}

/** Analiza e plotë e tekstit: pjesët + përputhja e secilës. */
export function matchText(text: string, index: CatalogIndex): SegmentMatch[] {
  return splitSegments(text).map(segment =>
    segment.ignored
      ? { segment, item: null, matchType: null, score: 0, alternatives: [] }
      : { segment, ...matchPhrase(segment.core, index) });
}

/** Emri i pastruar për një artikull të ri: hapësira të njëfishta, shkronja e parë e madhe. */
export function cleanItemName(s: string): string {
  const t = s.replace(/\s+/g, " ").trim();
  return t ? t[0].toLocaleUpperCase("sq") + t.slice(1) : t;
}
