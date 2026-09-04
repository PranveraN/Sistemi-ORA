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

// Statuset e kërkesës (prind) të aktivizuara deri më tani — ORDER_PENDING/
// ORDERED/RECEIVED/COMPLETED/DRAFT/CANCELLED rezervohen për fazat e Porosive/
// Pranimit (6-7), s'përdoren ende.
export const REQUEST_STATUSES = [
  { value: "SUBMITTED",         label: "Në pritje",       color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  { value: "UNDER_REVIEW",      label: "Në shqyrtim",     color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { value: "APPROVED",          label: "Aprovuar",        color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  { value: "PARTIALLY_APPROVED",label: "Aprovuar Pjesërisht", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  { value: "REJECTED",          label: "Refuzuar",        color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
] as const;

export const REQUEST_STATUS_MAP: Record<string, { label: string; color: string }> =
  Object.fromEntries(REQUEST_STATUSES.map(s => [s.value, { label: s.label, color: s.color }]));

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
