// Konfigurimi i kërkesave për materiale — NJË vend i vetëm. Vlerat ruhen te
// Cilësimet (tabela Setting), që të ndryshohen pa ndryshuar kodin.

/** Çelësat te tabela Setting (dhe te /api/settings DEFAULTS). */
export const MATERIAL_SETTING_KEYS = {
  autoCreateItems: "materialAutoCreateItems", // "true" | "false"
  leadDays: "materialRequestLeadDays",        // p.sh. "3"
} as const;

/** AUTO_CREATE_ITEMS — i fikur si parazgjedhje. */
export const DEFAULT_AUTO_CREATE_ITEMS = false;
/** Sa ditë përpara duhet bërë kërkesa "Normale". */
export const DEFAULT_LEAD_DAYS = 3;

/** Kategoria ndihmëse për artikujt e rinj që presin rishikim (s'ka kategori ende). */
export const REVIEW_CATEGORY_NAME = "Pa kategori — për rishikim";

export function parseAutoCreate(v: string | null | undefined): boolean {
  return v == null ? DEFAULT_AUTO_CREATE_ITEMS : v === "true";
}

export function parseLeadDays(v: string | null | undefined): number {
  const n = parseInt(v ?? "");
  return Number.isFinite(n) && n >= 0 && n <= 30 ? n : DEFAULT_LEAD_DAYS;
}

/** A është data e nevojës më afër se rregulli i ditëve (për kërkesat "Normale")? */
export function isTooSoon(dateNeeded: string | Date | null | undefined, leadDays: number, today = new Date()): boolean {
  if (!dateNeeded) return false;
  const d = new Date(dateNeeded);
  if (isNaN(d.getTime())) return false;
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return (target.getTime() - start.getTime()) / 86400000 < leadDays;
}
