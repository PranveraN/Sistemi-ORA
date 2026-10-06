// Rregullat e detyrimit vjetor (Eshkollori): shuma, lirimi, statusi dhe
// kartelat përmbledhëse. Funksione të pastra, në cent — teste: feeLedger.test.ts

export type FeeStatus = "PAID" | "UNPAID" | "FREE";
export type ExemptionType = "FULL" | "PARTIAL";

export interface ExemptionLike {
  type: string;
  percent: number | null;
  fromYear: number;
  untilYear: number | null;
  cancelledAt: Date | string | null;
}

export const EXEMPTION_REASONS: { value: string; label: string }[] = [
  { value: "SOCIAL", label: "Rast social" },
  { value: "STAFF_CHILD", label: "Fëmijë i stafit" },
  { value: "SIBLINGS", label: "Vëllezër/motra" },
  { value: "SCHOLARSHIP", label: "Bursë" },
  { value: "OTHER", label: "Tjetër" },
];

const c = (v: number) => Math.round((v || 0) * 100);
const e = (v: number) => v / 100;

/** Lirimi që vlen për vitin (viti fillestar akademik), ose null. I fundit fiton. */
export function activeExemption<T extends ExemptionLike>(list: T[], year: number): T | null {
  const ok = list.filter(x => !x.cancelledAt && x.fromYear <= year && (x.untilYear === null || x.untilYear >= year));
  return ok.length ? ok[ok.length - 1] : null;
}

/** Shuma që pritet pas lirimit dhe pjesa e liruar. */
export function yearFee(base: number, ex: Pick<ExemptionLike, "type" | "percent"> | null): { expected: number; exempted: number } {
  const b = Math.max(0, c(base));
  if (!ex) return { expected: e(b), exempted: 0 };
  if (ex.type === "FULL") return { expected: 0, exempted: e(b) };
  const pct = Math.min(100, Math.max(0, ex.percent ?? 0));
  const exp = Math.round(b * (1 - pct / 100));
  return { expected: e(exp), exempted: e(b - exp) };
}

export function feeStatus(expected: number, paid: number, fullExempt: boolean): FeeStatus {
  if (fullExempt) return "FREE";
  return c(paid) >= c(expected) ? "PAID" : "UNPAID";
}

export interface LedgerRow {
  expected: number;
  paid: number;
  exempted: number;
  status: FeeStatus;
  oldDebt: number;
}

export interface LedgerSummary {
  income: number; paidCount: number;
  yearDebt: number; yearDebtCount: number;
  oldDebt: number; oldDebtCount: number;
  exempted: number; exemptedCount: number;
  groups: { all: number; paid: number; unpaid: number; old: number; free: number };
}

/** Kartelat dhe grupet. Borxhi i vitit dhe ai i vjetër mbahen gjithmonë veç. */
export function summarize(rows: LedgerRow[]): LedgerSummary {
  let income = 0, yearDebt = 0, old = 0, ex = 0;
  let paidCount = 0, yearDebtCount = 0, oldCount = 0, exCount = 0;
  const groups = { all: rows.length, paid: 0, unpaid: 0, old: 0, free: 0 };
  for (const r of rows) {
    income += c(r.paid);
    if (r.paid > 0) paidCount++;
    const debt = Math.max(0, c(r.expected) - c(r.paid));
    if (r.status === "UNPAID") { yearDebt += debt; if (debt > 0) yearDebtCount++; groups.unpaid++; }
    if (r.status === "PAID") groups.paid++;
    if (r.status === "FREE") groups.free++;
    if (r.exempted > 0) { ex += c(r.exempted); exCount++; }
    if (r.oldDebt > 0) { old += c(r.oldDebt); oldCount++; groups.old++; }
  }
  return {
    income: e(income), paidCount,
    yearDebt: e(yearDebt), yearDebtCount,
    oldDebt: e(old), oldDebtCount: oldCount,
    exempted: e(ex), exemptedCount: exCount,
    groups,
  };
}
