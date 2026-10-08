// Etiketat dhe ngjyrat e përbashkëta të faqes "Auditimi".

export const SEV_LABEL: Record<string, string> = { KRITIKE: "Kritike", E_LARTE: "E lartë", MESATARE: "Mesatare", E_ULET: "E ulët" };
export const SEV_CLASS: Record<string, string> = {
  KRITIKE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  E_LARTE: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  MESATARE: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  E_ULET: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
};
export const SEVERITIES = ["KRITIKE", "E_LARTE", "MESATARE", "E_ULET"];

export const STATUS_LABEL: Record<string, string> = { E_RE: "E re", NE_SHQYRTIM: "Në shqyrtim", E_JUSTIFIKUAR: "E justifikuar", E_KORRIGJUAR: "E korrigjuar" };
export const STATUS_CLASS: Record<string, string> = {
  E_RE: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  NE_SHQYRTIM: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300",
  E_JUSTIFIKUAR: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200",
  E_KORRIGJUAR: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
};
export const STATUSES = ["E_RE", "NE_SHQYRTIM", "E_JUSTIFIKUAR", "E_KORRIGJUAR"];

export const MODULE_LABEL: Record<string, string> = {
  ARKA: "Arka", SHKOLLIMI: "Shkollimi", DOKUMENTET: "Dokumentet", SHPENZIME: "Shpenzimet", HYRAT: "Të hyrat", INVESTIME: "Investimet",
};

export const RUN_STATUS: Record<string, string> = { RUNNING: "Në proces", OK: "Në rregull", ME_GABIME: "Me gabime", DESHTOI: "Dështoi" };
export const RUN_TRIGGER: Record<string, string> = { NATA: "Natën", MANUAL: "Me dorë", NISJA: "Në nisje" };

export const ACTION_LABEL: Record<string, string> = { CREATE: "Krijim", UPDATE: "Ndryshim", DELETE: "Fshirje" };
export const TABLE_LABEL: Record<string, string> = {
  Payment: "Pagesë", Invoice: "Faturë", InvoiceItem: "Zë i faturës", FamilyReceipt: "Dëshmi familjeje", Expense: "Shpenzim/Dorëzim (skeda)",
  Shpenzim: "Shpenzim", Hyra: "Të hyra tjera", Investim: "Investim", UniSale: "Shitje uniforme", UniSaleItem: "Artikull uniforme",
  UniPayment: "Pagesë uniforme", UniHandover: "Dorëzim uniformash", BookSale: "Shitje librash", BookSaleItem: "Artikull librash",
  BookPayment: "Pagesë librash", BookHandover: "Dorëzim librash", CashCount: "Numërim arke (i vjetër)", FeeExemption: "Lirim",
  PaymentHandover: "Dorëzim (libri i vjetër)", TimiInvestInvoice: "Profaturë TIMI Invest", PaymentCategory: "Kategori pagese",
  PaymentCategoryPrice: "Çmim kategorie", Student: "Nxënës", CashClosing: "Numërim arke",
};

export const euro = (cents: number | null | undefined) =>
  cents == null ? "—" : new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(cents / 100);
export const fmtDateTime = (v: string | Date | null | undefined) =>
  v ? new Date(v).toLocaleString("sq-AL", { timeZone: "Europe/Belgrade", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

/** Vlerë e gjurmës për shfaqje: datat (milisekonda) si datë, booleans si Po/Jo. */
export function fmtValue(field: string, v: unknown): string {
  if (v == null || v === "") return "—";
  if (typeof v === "number" && v > 1e11 && /date|Date|data|At$|At\b|deletedAt|createdAt/.test(field)) return fmtDateTime(new Date(v));
  if (typeof v === "boolean") return v ? "Po" : "Jo";
  if ((field === "paguar" || field === "confirmed" || field === "active") && (v === 0 || v === 1)) return v ? "Po" : "Jo";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}
