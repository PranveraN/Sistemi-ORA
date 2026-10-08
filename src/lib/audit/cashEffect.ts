// Efekti i një rreshti në një arkë (cash), sipas DATËS REALE të lëvizjes — baza
// e numërimit të arkave (cashClosing.ts) dhe e gjetjeve për ndryshime pas një
// numërimi (closedDay.ts). Çdo burim ka arkën e vet, që numërohet më vete:
//
//   Arka e një kategorie pagese (Shkollimi, Ushqimi, Eshkollori, …)
//     Payment   e kësaj kategorie, metoda CASH          → + paguar    (paidDate)
//     Expense   e kësaj kategorie: EXPENSE cash/pa metodë (i pamigruar) → − shuma (date)
//                                  HANDOVER (dorëzim)    → − shuma     (date)
//   …vetëm arka e Shkollimit merr edhe (si "Ku janë paratë" te Dashboard-i):
//     Hyra      kategoria SHKOLLIMI, metoda CASH        → + shuma     (data e regjistrimit — s'ka ditë)
//     Shpenzim  i paguar, cash/pa metodë, jo Ushqimi, jo i fshirë → − shuma (data)
//     Investim  metoda CASH                             → − vlera     (data)
//   Arka e Uniformave:  UniPayment CASH + / UniHandover −   (paidAt / handoverAt)
//   Arka e Librave:     BookPayment CASH + / BookHandover − (paidAt / handoverAt)
//
// Rregullat ndjekin ato ekzistuese të arkës (shkollimiExpenses.ts / cashFlow.ts),
// por sipas datës, jo sipas muajit të detyrimit — dhe pa filtër statusi të
// nxënësit (përfshihen edhe të larguarit).

export const CASH_TABLES = new Set(["Payment", "Hyra", "Shpenzim", "Expense", "Investim", "UniPayment", "UniHandover", "BookPayment", "BookHandover"]);

export type MovementKind = "PAGESA" | "HYRA" | "SHPENZIM" | "SHPENZIM_VJETER" | "DOREZIM" | "INVESTIM" | "SHITJE";

export interface CashBox {
  /** "CAT:<id>" për një kategori pagese, "UNIFORMA", "LIBRAT". */
  key: string;
  label: string;
  categoryId?: number;
  /** Vetëm arka e Shkollimit: të hyrat tjera, Shpenzimet, Investimet. */
  withShkollimiExtras?: boolean;
  module?: "UNIFORMA" | "LIBRAT";
  /** Kategoritë e Shpenzimeve me fushë USHQIMI — s'zbriten nga arka e Shkollimit. */
  foodKategoriIds: number[];
}

export interface Movement {
  cents: number;
  day: string;
  kind: MovementKind;
}

type Row = Record<string, unknown>;
const TZ = "Europe/Belgrade"; // ora e Kosovës
const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

export function toMs(v: unknown): number | null {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = /^\d+$/.test(v) ? Number(v) : Date.parse(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Dita "YYYY-MM-DD" sipas orës së Kosovës. */
export function dayKey(v: unknown): string | null {
  const ms = toMs(v);
  return ms == null ? null : fmt.format(new Date(ms));
}

export const todayKey = () => fmt.format(new Date());
export const toCents = (v: unknown) => Math.round((Number(v) || 0) * 100);
const truthy = (v: unknown) => v === true || v === 1 || v === "1" || v === "true";
const isCash = (m: unknown) => m == null || m === "" || m === "CASH";

/** Efekti i rreshtit në arkën `box` (cent, + hyrje / − dalje) dhe dita e tij; null = s'i takon kësaj arke. */
export function cashOf(table: string, row: Row | null, box: CashBox): { cents: number; day: string | null; kind: MovementKind } | null {
  if (!row) return null;
  const mine = box.categoryId != null && Number(row.categoryId) === box.categoryId;
  const extras = !!box.withShkollimiExtras;
  switch (table) {
    case "Payment":
      if (!mine) return null;
      return { kind: "PAGESA", day: dayKey(row.paidDate ?? row.updatedAt ?? row.createdAt), cents: row.method === "CASH" ? toCents(row.paidAmount) : 0 };
    case "Expense": {
      if (!mine) return null;
      const handover = row.type === "HANDOVER";
      const counts = handover || (row.type === "EXPENSE" && row.migratedToShpenzimId == null && isCash(row.method));
      return { kind: handover ? "DOREZIM" : "SHPENZIM_VJETER", day: dayKey(row.date), cents: counts ? -toCents(row.amount) : 0 };
    }
    case "Hyra":
      if (!extras) return null;
      return { kind: "HYRA", day: dayKey(row.createdAt), cents: row.kategoria === "SHKOLLIMI" && row.metoda === "CASH" ? toCents(row.shuma) : 0 };
    case "Shpenzim":
      if (!extras) return null;
      return {
        kind: "SHPENZIM", day: dayKey(row.data),
        cents: row.deletedAt == null && truthy(row.paguar) && isCash(row.metoda) && !box.foodKategoriIds.includes(Number(row.kategoriId)) ? -toCents(row.shuma) : 0,
      };
    case "Investim":
      if (!extras) return null;
      return { kind: "INVESTIM", day: dayKey(row.data), cents: row.metoda === "CASH" ? -toCents(row.vlera) : 0 };
    case "UniPayment":
    case "BookPayment":
      if (box.module !== (table === "UniPayment" ? "UNIFORMA" : "LIBRAT")) return null;
      return { kind: "SHITJE", day: dayKey(row.paidAt ?? row.createdAt), cents: isCash(row.method) ? toCents(row.amount) : 0 };
    case "UniHandover":
    case "BookHandover":
      if (box.module !== (table === "UniHandover" ? "UNIFORMA" : "LIBRAT")) return null;
      return { kind: "DOREZIM", day: dayKey(row.handoverAt ?? row.createdAt), cents: -toCents(row.amount) };
    default:
      return null;
  }
}

/**
 * Lëvizjet në arkën `box` që shkakton një ndryshim (rreshti para → pas).
 * Pagesa: një rresht merr disa pagesa të pjesshme me kalimin e kohës (paidAmount
 * rritet, paidDate bëhet data e pagesës së fundit) — ndaj lëvizja është diferenca,
 * në datën e re. Të tjerat: një rresht = një lëvizje — hiqet në datën e vjetër,
 * shtohet në datën e re (kështu edhe ndërrimi i datës lëviz paratë mes ditëve).
 */
export function movementsOf(table: string, oldRow: Row | null, newRow: Row | null, box: CashBox): Movement[] {
  const o = cashOf(table, oldRow, box);
  const n = cashOf(table, newRow, box);
  if (!o && !n) return [];
  if (table === "Payment") {
    const delta = (n?.cents ?? 0) - (o?.cents ?? 0);
    const day = (n ?? o)!.day;
    return delta !== 0 && day ? [{ cents: delta, day, kind: "PAGESA" }] : [];
  }
  const out: Movement[] = [];
  if (o && o.cents !== 0 && o.day) out.push({ cents: -o.cents, day: o.day, kind: o.kind });
  if (n && n.cents !== 0 && n.day) {
    const same = out.find(m => m.day === n.day && m.kind === n.kind);
    if (same) same.cents += n.cents; else out.push({ cents: n.cents, day: n.day, kind: n.kind });
  }
  return out.filter(m => m.cents !== 0);
}
