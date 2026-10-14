// Llogaritjet e pastra për pagesat nga TIMI Invest (pa databazë — përdoren edhe në shfletues).
// Shih src/lib/timiPagesat.ts.

export const TIMI_KOMISION_PCT = 4.66;
export const TI_PREFIX = "TI_MUAJI_";

/** Shuma bruto për fëmijët (cent) nga shuma që hyri në bankë. */
export function brutoNgaShuma(shumaCents: number, pct = TIMI_KOMISION_PCT): number {
  return Math.round(shumaCents / (1 - pct / 100));
}

/** Ndan `totalCents` sipas peshave (mbetjet e rrumbullakimit te pjesët më të mëdha). Pa pesha → njësoj. */
export function ndajProporcionalisht(totalCents: number, peshat: number[]): number[] {
  if (peshat.length === 0) return [];
  const w = peshat.every(p => p <= 0) ? peshat.map(() => 1) : peshat.map(p => Math.max(0, p));
  const sum = w.reduce((a, b) => a + b, 0);
  const raw = w.map(p => (totalCents * p) / sum);
  const out = raw.map(Math.floor);
  let rest = totalCents - out.reduce((a, b) => a + b, 0);
  const order = raw.map((r, i) => [r - Math.floor(r), i] as const).sort((a, b) => b[0] - a[0]);
  for (let k = 0; rest > 0; k = (k + 1) % order.length, rest--) out[order[k][1]]++;
  return out;
}

export interface RreshtKesti { id: number; finalCents: number; paidCents: number; method: string | null }

/**
 * Mbush këstet me radhë (shtator → gusht). Mbushen vetëm këstet pa pagesë ose të paguara me
 * Bankë (një këst i paguar cash nuk përzihet me paratë e TIMI-t). Kthen ndarjen dhe mbetjen.
 */
export function mbushKestet(rreshtat: RreshtKesti[], cents: number): { ndarja: { id: number; cents: number }[]; mbetja: number } {
  const ndarja: { id: number; cents: number }[] = [];
  let left = cents;
  for (const r of rreshtat) {
    if (left <= 0) break;
    if (r.paidCents > 0 && r.method && r.method !== "BANK") continue;
    const cap = r.finalCents - r.paidCents;
    if (cap <= 0) continue;
    const x = Math.min(cap, left);
    ndarja.push({ id: r.id, cents: x });
    left -= x;
  }
  return { ndarja, mbetja: left };
}

/** Viti shkollor (fillestar) i një date "YYYY-MM-DD": shtator–dhjetor → ai vit, janar–gusht → viti para. */
export function vitiNgaData(day: string): number {
  const y = parseInt(day.slice(0, 4)), m = parseInt(day.slice(5, 7));
  return m >= 9 ? y : y - 1;
}
