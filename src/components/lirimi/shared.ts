// Etiketat e modulit të lirimit për ndërfaqen (klient).
export const ARSYET: Record<string, string> = { MJEKU: "Vizitë te mjeku", FAMILJARE: "Arsye familjare", SEMUNDJE: "Sëmundje", TJETER: "Tjetër" };
export const LIDHJET: Record<string, string> = { NENA: "Nëna", BABAI: "Babai", TJETER: "Tjetër" };
export const STATUSET: Record<string, { label: string; cls: string }> = {
  NE_PRITJE: { label: "Në pritje", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300" },
  APROVUAR: { label: "Aprovuar", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-300" },
  REFUZUAR: { label: "Refuzuar", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  ANULUAR: { label: "Anuluar", cls: "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300" },
};
export const fmtDay = (d: string) => d.split("-").reverse().join(".");
export const sotDay = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Belgrade" });
export const fmtTime = (iso: string) => new Date(iso).toLocaleString("sq-AL", { timeZone: "Europe/Belgrade", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

export interface KerkeseRow {
  id: number; studentId: number; classId: number | null; emri: string; klasa?: string;
  data: string; ora: string; arsyeja: string; shpjegim: string | null;
  marresEmri: string; marresLidhja: string; telefoni: string;
  statusi: string; arsyeRefuzimi: string | null; vendosiEmri: string | null; vendosurAt: string | null; createdAt: string;
}
