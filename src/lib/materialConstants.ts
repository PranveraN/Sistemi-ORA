// Listë fikse në kod (jo tabelë CRUD) — vendim i konfirmuar në planin e Modulit
// të Materialeve: më e shpejtë, mjafton për lista që s'ndryshojnë shpesh.

export const UNITS = [
  { value: "copë",   label: "Copë" },
  { value: "palë",   label: "Palë" },
  { value: "grup",   label: "Grup" },
  { value: "kuti",   label: "Kuti" },
  { value: "top",    label: "Top" },
  { value: "paketë", label: "Paketë" },
  { value: "metër",  label: "Metër" },
  { value: "cm",     label: "Cm" },
  { value: "kg",     label: "Kg" },
  { value: "gram",   label: "Gram" },
  { value: "litër",  label: "Litër" },
  { value: "ml",     label: "Ml" },
] as const;

export const UNIT_VALUES = UNITS.map(u => u.value) as string[];

export const COLORS = [
  "Zi", "Bardhë", "Kuq", "Blu", "Jeshil", "Verdhë", "Portokalli", "Vjollcë", "Kafe", "Gri",
] as const;

export const PRIORITIES = [
  { value: "NORMAL",    label: "Normale",  color: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
  { value: "IMPORTANT", label: "E rëndësishme", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "URGENT",    label: "Urgjente", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
] as const;

export const PRIORITY_MAP: Record<string, { label: string; color: string }> =
  Object.fromEntries(PRIORITIES.map(p => [p.value, { label: p.label, color: p.color }]));

// Statuset e kërkesës (prind). PARTIALLY_APPROVED ruhet në bazë si më parë
// (analitika/eksporti/email-et), por në faqen e administratës shfaqet nën
// "Aprovuara" me etiketën "Pjesërisht". ORDERED/DELIVERED vendosen vetëm nga
// src/lib/materialRequestStatus.ts (porosia e krijuar / e pranuar).
export const REQUEST_STATUSES = [
  { value: "SUBMITTED",         label: "Në pritje",       color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  { value: "UNDER_REVIEW",      label: "Në shqyrtim",     color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "APPROVED",          label: "Aprovuar",        color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  { value: "PARTIALLY_APPROVED",label: "Aprovuar Pjesërisht", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  { value: "ORDERED",           label: "Porositur",       color: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  { value: "DELIVERED",         label: "Dorëzuar",        color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  { value: "REJECTED",          label: "Refuzuar",        color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
] as const;

export const REQUEST_STATUS_MAP: Record<string, { label: string; color: string }> =
  Object.fromEntries(REQUEST_STATUSES.map(s => [s.value, { label: s.label, color: s.color }]));

/** Kartat-taba të faqes së administratës, sipas rrjedhës së kërkesës. */
export const REQUEST_STAGES = [
  { key: "SUBMITTED",    label: "Në pritje",   statuses: ["SUBMITTED"] },
  { key: "UNDER_REVIEW", label: "Në shqyrtim", statuses: ["UNDER_REVIEW"] },
  { key: "APPROVED",     label: "Aprovuara",   statuses: ["APPROVED", "PARTIALLY_APPROVED"] },
  { key: "ORDERED",      label: "Porositur",   statuses: ["ORDERED"] },
  { key: "DELIVERED",    label: "Dorëzuar",    statuses: ["DELIVERED"] },
  { key: "REJECTED",     label: "Refuzuara",   statuses: ["REJECTED"] },
] as const;

export function stageOf(status: string): string {
  return REQUEST_STAGES.find(s => (s.statuses as readonly string[]).includes(status))?.key ?? status;
}

export interface PartialCheckItem {
  status: string;
  quantity: number;
  approvedQuantity: number | null;
  deliveredQuantity?: number;
}

/**
 * Etiketa "Pjesërisht": aprovim i pjesshëm (artikuj të refuzuar ose sasi më e
 * vogël), ose — te "Dorëzuar" — kur ka ardhur vetëm një pjesë e sasisë.
 */
export function isPartialRequest(status: string, items: PartialCheckItem[]): boolean {
  if (status === "PARTIALLY_APPROVED") return true;
  if (!["APPROVED", "ORDERED", "DELIVERED"].includes(status)) return false;
  const partialApproval = items.some(it => it.status === "REJECTED" || (it.status === "APPROVED" && (it.approvedQuantity ?? 0) < it.quantity));
  if (status === "DELIVERED") {
    return partialApproval || items.some(it => it.status === "APPROVED" && (it.deliveredQuantity ?? 0) < (it.approvedQuantity ?? 0));
  }
  return partialApproval;
}

// Statusi i stokut — RED nën minimum (ose 0 kur s'ka minimum), YELLOW brenda
// një "zone paralajmërimi" (1.5x minimumi), GREEN përndryshe.
export function getStockStatus(currentStock: number, minStock: number): "RED" | "YELLOW" | "GREEN" {
  if (currentStock <= minStock) return "RED";
  if (currentStock <= minStock * 1.5) return "YELLOW";
  return "GREEN";
}

export const STOCK_STATUS_STYLE: Record<"RED" | "YELLOW" | "GREEN", { label: string; color: string; dot: string }> = {
  RED:    { label: "Kritik", color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", dot: "bg-red-500" },
  YELLOW: { label: "Ulët",   color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", dot: "bg-amber-500" },
  GREEN:  { label: "Mirë",  color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", dot: "bg-green-500" },
};

// Statuset e artikullit (brenda një kërkese) — thjeshtë, si më parë.
export const ITEM_STATUS_MAP: Record<string, { label: string; color: string }> = {
  PENDING:  { label: "Në pritje", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  APPROVED: { label: "Aprovuar",  color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  REJECTED: { label: "Refuzuar",  color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};
