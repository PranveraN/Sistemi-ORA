import { prisma } from "@/lib/prisma";
import { expensePeriodWhereByDate } from "@/lib/expensePeriod";
import type { YearType } from "@/lib/academicYear";

// Shpenzimet e Shkollimit — një libër i vetëm: tabela Shpenzim (Shkollimi →
// Shpenzime). Deri sa të bëhet migrimi, përfshihen edhe rreshtat e vjetër të
// skedës (Expense, type EXPENSE) që s'janë bartur ende. Ushqimi s'preket.
//
// Rregullat (të njëjta kudo — faqja e Shkollimit, dashboard-i, Bilanci):
//   • të fshirat (fshirje logjike) s'shfaqen e s'llogariten
//   • kategoritë me fushë "USHQIMI" s'zbriten nga arka e Shkollimit
//   • i paguar me Cash (ose pa metodë) → "Shpenzuar nga arka"
//   • i paguar me Bankë/Kartelë         → nga banka (s'prek arkën)
//   • i papaguar                        → borxh te furnitori, s'llogaritet

/** Filtri bazë i Shpenzim-it: vetëm rreshtat aktivë (jo të fshirë logjikisht). */
export const ACTIVE_SHPENZIM = { deletedAt: null } as const;

export interface ShkollimiExpenseRow {
  key: string;
  source: "SHPENZIM" | "EXPENSE";
  id: number;
  date: string;
  description: string | null;
  category: string | null;
  categoryId: number | null;
  scope: "SHKOLLIMI" | "USHQIMI";
  supplier: string | null;
  amount: number;
  method: string | null;
  paid: boolean;
  reference: string | null;
}

export interface ShkollimiExpenseTotals {
  paid: number;        // gjithsej të paguara (Shkollimi)
  cash: number;        // nga arka
  bank: number;        // nga banka
  unpaid: number;      // borxh te furnitorët
  count: number;
  ushqimi: number;     // kategoritë e Ushqimit (s'llogariten këtu)
  legacyPending: number; // rreshta të skedës së vjetër ende pa u migruar
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

export const isCashMethod = (m: string | null | undefined) => !m || m === "CASH";
const r2 = (v: number) => Math.round(v * 100) / 100;

export async function loadShkollimiExpenses(categoryId: number | null, month: number, year: number, yearType: YearType) {
  const range = shkollimiPeriodRange(month, year, yearType);
  const [shp, legacy] = await Promise.all([
    prisma.shpenzim.findMany({
      where: { ...ACTIVE_SHPENZIM, ...(range ? { data: range } : {}) },
      include: { kategori: { select: { id: true, emri: true, fusha: true } } },
      orderBy: { data: "desc" },
    }),
    categoryId
      ? prisma.expense.findMany({ where: { categoryId, type: "EXPENSE", migratedToShpenzimId: null, ...expensePeriodWhereByDate(month, year, yearType) }, orderBy: { date: "desc" } })
      : Promise.resolve([]),
  ]);

  const rows: ShkollimiExpenseRow[] = [
    ...shp.map(s => ({
      key: `S${s.id}`, source: "SHPENZIM" as const, id: s.id, date: s.data.toISOString(),
      description: s.pershkrim, category: s.kategori?.emri ?? null, categoryId: s.kategori?.id ?? null,
      scope: (s.kategori?.fusha === "USHQIMI" ? "USHQIMI" : "SHKOLLIMI") as "SHKOLLIMI" | "USHQIMI",
      supplier: s.emriBiznesit || s.marres || null,
      amount: s.shuma, method: s.metoda, paid: s.paguar, reference: s.nrFature || s.referenca || null,
    })),
    ...legacy.map(e => ({
      key: `E${e.id}`, source: "EXPENSE" as const, id: e.id, date: e.date.toISOString(),
      description: e.description, category: null, categoryId: null, scope: "SHKOLLIMI" as const,
      supplier: e.recipient, amount: e.amount, method: e.method, paid: true, reference: e.reference,
    })),
  ].sort((a, b) => b.date.localeCompare(a.date));

  const t = { paid: 0, cash: 0, bank: 0, unpaid: 0, ushqimi: 0 };
  for (const r of rows) {
    if (r.scope === "USHQIMI") { t.ushqimi += r.amount; continue; }
    if (!r.paid) { t.unpaid += r.amount; continue; }
    t.paid += r.amount;
    if (isCashMethod(r.method)) t.cash += r.amount; else t.bank += r.amount;
  }
  const totals: ShkollimiExpenseTotals = {
    paid: r2(t.paid), cash: r2(t.cash), bank: r2(t.bank), unpaid: r2(t.unpaid), ushqimi: r2(t.ushqimi),
    count: rows.filter(r => r.scope === "SHKOLLIMI").length, legacyPending: legacy.length,
  };
  return { rows, totals };
}

/** Investimet (moduli "Investimet") të paguara me Cash — dalin nga arka e Shkollimit; me Bankë jo. */
export async function loadCashInvestments(month: number, year: number, yearType: YearType): Promise<{ cash: number; bank: number }> {
  const range = shkollimiPeriodRange(month, year, yearType);
  const rows = await prisma.investim.groupBy({ by: ["metoda"], where: range ? { data: range } : {}, _sum: { vlera: true } });
  let cash = 0, bank = 0;
  for (const g of rows) { if (g.metoda === "CASH") cash += g._sum.vlera ?? 0; else bank += g._sum.vlera ?? 0; }
  return { cash: r2(cash), bank: r2(bank) };
}

/** Të hyrat tjera (moduli "Të Hyra Tjera") me kategorinë SHKOLLIMI dhe metodë Cash — hyjnë në arkë. */
export async function loadOtherCashIncome(month: number, year: number, yearType: YearType): Promise<{ cash: number; bank: number }> {
  const where: Record<string, unknown> = { kategoria: "SHKOLLIMI" };
  if (month > 0 && year > 0) { where.muaj = month; where.vit = year; }
  else if (year > 0) {
    if (yearType === "academic") where.OR = [{ muaj: { gte: 9 }, vit: year }, { muaj: { lte: 8 }, vit: year + 1 }];
    else where.vit = year;
  }
  const rows = await prisma.hyra.groupBy({ by: ["metoda"], where, _sum: { shuma: true } });
  let cash = 0, bank = 0;
  for (const g of rows) {
    if (g.metoda === "CASH") cash += g._sum.shuma ?? 0;
    else if (g.metoda) bank += g._sum.shuma ?? 0;
  }
  return { cash: r2(cash), bank: r2(bank) };
}
