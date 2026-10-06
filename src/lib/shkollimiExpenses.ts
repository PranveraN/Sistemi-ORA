import { prisma } from "@/lib/prisma";
import { expensePeriodWhere } from "@/lib/expensePeriod";
import type { YearType } from "@/lib/academicYear";

// Shpenzimet e Shkollimit = shpenzimet e modulit "Shpenzimet" (tabela Shpenzim)
// + ato të regjistruara më parë direkt te skeda "Shpenzime" e Shkollimit
// (Expense, type EXPENSE) — që asgjë të mos humbasë. Ushqimi s'preket.
//
// Rregulli i arkës (i njëjtë kudo — faqja e Shkollimit dhe dashboard-i):
//   • i paguar me Cash (ose pa metodë)  → "Shpenzuar nga arka" (zbritet nga arka)
//   • i paguar me Bankë/Kartelë         → nga banka (s'prek arkën)
//   • i papaguar (borxh te furnitori)   → s'llogaritet si i shpenzuar

export interface ShkollimiExpenseRow {
  key: string;
  source: "SHPENZIM" | "EXPENSE";
  id: number;
  date: string;
  description: string | null;
  category: string | null;
  supplier: string | null;
  amount: number;
  method: string | null;
  paid: boolean;
  reference: string | null;
}

export interface ShkollimiExpenseTotals {
  paid: number;        // gjithsej të paguara
  cash: number;        // nga arka
  bank: number;        // nga banka
  unpaid: number;      // borxh (pa paguar)
  count: number;
}

/** Periudha si te faqja: muaj (kalendarik i vitit të dhënë), vit akademik (Sht–Gus), vit kalendarik, ose të gjitha. */
export function shkollimiPeriodRange(month: number, year: number, yearType: YearType): { gte: Date; lt: Date } | null {
  if (month > 0 && year > 0) return { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) };
  if (year > 0) {
    return yearType === "academic"
      ? { gte: new Date(year, 8, 1), lt: new Date(year + 1, 8, 1) }
      : { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) };
  }
  return null;
}

const isCash = (m: string | null | undefined) => !m || m === "CASH";
const r2 = (v: number) => Math.round(v * 100) / 100;

export async function loadShkollimiExpenses(categoryId: number | null, month: number, year: number, yearType: YearType) {
  const range = shkollimiPeriodRange(month, year, yearType);
  const [shp, legacy] = await Promise.all([
    prisma.shpenzim.findMany({
      where: range ? { data: range } : {},
      include: { kategori: { select: { emri: true } } },
      orderBy: { data: "desc" },
    }),
    categoryId
      ? prisma.expense.findMany({ where: { categoryId, type: "EXPENSE", ...expensePeriodWhere(month, year, yearType) }, orderBy: { date: "desc" } })
      : Promise.resolve([]),
  ]);

  const rows: ShkollimiExpenseRow[] = [
    ...shp.map(s => ({
      key: `S${s.id}`, source: "SHPENZIM" as const, id: s.id, date: s.data.toISOString(),
      description: s.pershkrim, category: s.kategori?.emri ?? null, supplier: s.emriBiznesit || s.marres || null,
      amount: s.shuma, method: s.metoda, paid: s.paguar, reference: s.nrFature || s.referenca || null,
    })),
    ...legacy.map(e => ({
      key: `E${e.id}`, source: "EXPENSE" as const, id: e.id, date: e.date.toISOString(),
      description: e.description, category: null, supplier: e.recipient, amount: e.amount, method: e.method, paid: true, reference: e.reference,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const totals: ShkollimiExpenseTotals = { paid: 0, cash: 0, bank: 0, unpaid: 0, count: rows.length };
  for (const r of rows) {
    if (!r.paid) { totals.unpaid += r.amount; continue; }
    totals.paid += r.amount;
    if (isCash(r.method)) totals.cash += r.amount; else totals.bank += r.amount;
  }
  return { rows, totals: { paid: r2(totals.paid), cash: r2(totals.cash), bank: r2(totals.bank), unpaid: r2(totals.unpaid), count: totals.count } };
}
