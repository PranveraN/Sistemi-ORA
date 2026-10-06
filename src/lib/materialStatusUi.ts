// Fjalori i vetëm i statuseve të moduleve "Materialet" — e njëjta fjalë dhe e
// njëjta ngjyrë kudo: Kërkesat, Porositë, Mësimdhënësit, Analitika, paneli i
// mësueses dhe njoftimet.
//   Në pritje (gri) · Në shqyrtim (blu) · Aprovuar (vjollcë) · Porositur (portokalli)
//   · Dorëzuar (e gjelbër) · Refuzuar (e kuqe)

export type StatusKey = "SUBMITTED" | "UNDER_REVIEW" | "APPROVED" | "ORDERED" | "DELIVERED" | "REJECTED" | "CANCELLED";

export interface StatusUi { key: StatusKey; label: string; dot: string; badge: string; hex: string }

export const STATUS_UI: Record<StatusKey, StatusUi> = {
  SUBMITTED:    { key: "SUBMITTED",    label: "Në pritje",   hex: "#8B8D99", dot: "bg-slate-400",  badge: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200" },
  UNDER_REVIEW: { key: "UNDER_REVIEW", label: "Në shqyrtim", hex: "#1D4ED8", dot: "bg-blue-700",   badge: "bg-blue-50 text-blue-800 dark:bg-blue-950/50 dark:text-blue-200" },
  APPROVED:     { key: "APPROVED",     label: "Aprovuar",    hex: "#7C3AED", dot: "bg-violet-600", badge: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200" },
  ORDERED:      { key: "ORDERED",      label: "Porositur",   hex: "#D97706", dot: "bg-amber-600",  badge: "bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-200" },
  DELIVERED:    { key: "DELIVERED",    label: "Dorëzuar",    hex: "#15803D", dot: "bg-green-700",  badge: "bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300" },
  REJECTED:     { key: "REJECTED",     label: "Refuzuar",    hex: "#DC2626", dot: "bg-red-600",    badge: "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300" },
  CANCELLED:    { key: "CANCELLED",    label: "Anuluar",     hex: "#8B8D99", dot: "bg-slate-400",  badge: "bg-slate-100 text-slate-500 line-through dark:bg-slate-700 dark:text-slate-400" },
};

/** Rruga e kërkesës (renditja e kartelave/vijës kohore), pa "Refuzuar". */
export const REQUEST_FLOW: StatusKey[] = ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "ORDERED", "DELIVERED"];

/** Statusi i kërkesës (siç ruhet në bazë) → çelësi i fjalorit. */
export function requestStatusKey(status: string): StatusKey {
  switch (status) {
    case "UNDER_REVIEW": return "UNDER_REVIEW";
    case "APPROVED": case "PARTIALLY_APPROVED": return "APPROVED";
    case "ORDERED": return "ORDERED";
    case "DELIVERED": return "DELIVERED";
    case "REJECTED": return "REJECTED";
    default: return "SUBMITTED"; // SUBMITTED, PENDING (i vjetër)
  }
}

/** Statusi i porosisë → i njëjti fjalor (draft = Në pritje; dërguar = Porositur; pranuar = Dorëzuar). */
export function orderStatusKey(status: string): StatusKey {
  switch (status) {
    case "ORDERED": case "PARTIALLY_RECEIVED": return "ORDERED";
    case "RECEIVED": return "DELIVERED";
    case "CANCELLED": return "CANCELLED";
    default: return "SUBMITTED"; // DRAFT, PENDING
  }
}

export const requestStatusUi = (status: string) => STATUS_UI[requestStatusKey(status)];
export const orderStatusUi = (status: string) => STATUS_UI[orderStatusKey(status)];

/** Afatet ("Afati kaloi", "Nevojitet për n ditë") vlejnë vetëm për kërkesat ende të hapura. */
export const hasLiveDeadline = (status: string) => !["DELIVERED", "REJECTED"].includes(status);

/** Kohëzgjatja në formë të lexueshme: nën 1 orë në minuta, nën 2 ditë në orë, përndryshe në ditë. */
export function formatDuration(ms: number | null | undefined): string | null {
  if (ms === null || ms === undefined || !Number.isFinite(ms) || ms < 0) return null;
  const min = ms / 60_000;
  if (min < 60) return `${Math.max(1, Math.round(min))} min`;
  const h = min / 60;
  if (h < 48) return `${Math.round(h)} orë`;
  return `${Math.round(h / 24)} ditë`;
}
