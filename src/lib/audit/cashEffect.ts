// Efekti i një rreshti në arkë (cash), sipas DATËS REALE të lëvizjes — baza e
// mbylljes ditore (cashClosing.ts) dhe e bllokimit të ditëve të mbyllura
// (closedDay.ts). Rregullat ndjekin saktësisht ato ekzistuese të arkës
// (shkollimiExpenses.ts / cashFlow.ts), por sipas datës, jo sipas muajit të
// detyrimit — dhe pa filtër statusi të nxënësit (edhe të larguarit).
//
//   Payment   metoda CASH, kategoria brenda arkës      → + paguar      (paidDate)
//   Hyra      kategoria SHKOLLIMI, metoda CASH          → + shuma       (data e regjistrimit — s'ka ditë)
//   Shpenzim  i paguar, cash/pa metodë, jo Ushqimi, jo i fshirë → − shuma (data)
//   Expense   EXPENSE cash/pa metodë (i pamigruar)      → − shuma       (date)
//             HANDOVER (dorëzim)                        → − shuma       (date)
//   Investim  metoda CASH                               → − vlera       (data)

export const CASH_TABLES = new Set(["Payment", "Hyra", "Shpenzim", "Expense", "Investim"]);

export type MovementKind = "PAGESA" | "HYRA" | "SHPENZIM" | "SHPENZIM_VJETER" | "DOREZIM" | "INVESTIM";

export interface CashScope {
  /** Kategoritë e pagesave (dhe të skedave të tyre) që hyjnë në këtë arkë. */
  categoryIds: number[];
  /** A përfshihen Shpenzimet / Të hyrat tjera / Investimet (të Shkollimit). */
  includesShkollimi: boolean;
  /** Kategoritë e Shpenzimeve me fushë USHQIMI — s'zbriten nga kjo arkë. */
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

/** Efekti i rreshtit në arkë (cent, + hyrje / − dalje) dhe dita e tij. */
export function cashOf(table: string, row: Row | null, scope: CashScope): { cents: number; day: string | null; kind: MovementKind } | null {
  if (!row) return null;
  const inCat = (id: unknown) => scope.categoryIds.includes(Number(id));
  switch (table) {
    case "Payment":
      return {
        kind: "PAGESA",
        day: dayKey(row.paidDate ?? row.updatedAt ?? row.createdAt),
        cents: inCat(row.categoryId) && row.method === "CASH" ? toCents(row.paidAmount) : 0,
      };
    case "Hyra":
      return {
        kind: "HYRA",
        day: dayKey(row.createdAt),
        cents: scope.includesShkollimi && row.kategoria === "SHKOLLIMI" && row.metoda === "CASH" ? toCents(row.shuma) : 0,
      };
    case "Shpenzim":
      return {
        kind: "SHPENZIM",
        day: dayKey(row.data),
        cents: scope.includesShkollimi && row.deletedAt == null && truthy(row.paguar) && isCash(row.metoda)
          && !scope.foodKategoriIds.includes(Number(row.kategoriId)) ? -toCents(row.shuma) : 0,
      };
    case "Expense": {
      const handover = row.type === "HANDOVER";
      const counts = inCat(row.categoryId) && (handover || (row.type === "EXPENSE" && row.migratedToShpenzimId == null && isCash(row.method)));
      return { kind: handover ? "DOREZIM" : "SHPENZIM_VJETER", day: dayKey(row.date), cents: counts ? -toCents(row.amount) : 0 };
    }
    case "Investim":
      return {
        kind: "INVESTIM",
        day: dayKey(row.data),
        cents: scope.includesShkollimi && row.metoda === "CASH" ? -toCents(row.vlera) : 0,
      };
    default:
      return null;
  }
}

/**
 * Lëvizjet në arkë që shkakton një ndryshim (rreshti para → pas).
 * Pagesa: një rresht merr disa pagesa të pjesshme me kalimin e kohës (paidAmount
 * rritet, paidDate bëhet data e pagesës së fundit) — ndaj lëvizja është diferenca,
 * në datën e re. Të tjerat: një rresht = një lëvizje — hiqet në datën e vjetër,
 * shtohet në datën e re (kështu edhe ndërrimi i datës lëviz paratë mes ditëve).
 */
export function movementsOf(table: string, oldRow: Row | null, newRow: Row | null, scope: CashScope): Movement[] {
  const o = cashOf(table, oldRow, scope);
  const n = cashOf(table, newRow, scope);
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
