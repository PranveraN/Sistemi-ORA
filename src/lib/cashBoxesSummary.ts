import type { PrismaClient } from "@prisma/client";
import { cashOf, dayKey, todayKey } from "@/lib/audit/cashEffect";
import { loadCashBoxes } from "@/lib/audit/cashClosing";
import { academicYearOfDay, computePhysicalCash } from "@/lib/cashLedger";

// Gjendja e të gjitha arkave (vetëm lexim) — "sa duhet të jenë cash sot" për secilën.
// Shkollimi: njësoj si "Arka fizike" (respekton pikënisjen e vendosur).
// Arkat e tjera: lëvizjet cash nga 1 shtatori i vitit shkollor deri sot.

type Db = PrismaClient;

export interface BoxBalance {
  key: string;
  label: string;
  fromDay: string;          // lëvizjet merren pas kësaj dite (pikënisja / 31 gusht)
  openingCents: number;     // gjendja në pikënisje (0 kur s'ka)
  inCents: number;
  outCents: number;
  expectedCents: number;
}

/** `withShkollimi`: arka e Shkollimit (= arka fizike) — vetëm për Super Admin. */
export async function computeAllBoxes(db: Db, orgId: number, withShkollimi = true): Promise<{ today: string; boxes: BoxBalance[]; totalCents: number }> {
  const today = todayKey();
  const ay = academicYearOfDay(today);
  const fromDay = `${ay}-08-31`;
  const boxes = await loadCashBoxes(db, orgId);
  const food = new Set(boxes[0]?.foodKategoriIds ?? []);
  const after = (d: Date) => ({ gte: new Date(`${fromDay}T00:00:00Z`), lte: d });
  const end = new Date(Date.now() + 86_400_000);
  const tables: [string, Record<string, unknown>[]][] = [
    ["Payment", await db.payment.findMany({ where: { organizationId: orgId, paidAmount: { gt: 0 } } }) as never],
    ["Expense", await db.expense.findMany({ where: { date: after(end) } }) as never],
    ["Shpenzim", await db.shpenzim.findMany({ where: { data: after(end) } }) as never],
    ["UniPayment", await db.uniPayment.findMany() as never],
    ["UniHandover", await db.uniHandover.findMany() as never],
    ["BookPayment", await db.bookPayment.findMany() as never],
    ["BookHandover", await db.bookHandover.findMany() as never],
  ];
  const physical = withShkollimi ? await computePhysicalCash(db, orgId, null) : null;

  const out: BoxBalance[] = [];
  for (const box of boxes) {
    if (box.withShkollimiExtras) {
      if (!physical) continue;
      out.push({
        key: box.key, label: box.label, fromDay: physical.opening.day, openingCents: physical.opening.cents ?? 0,
        inCents: physical.inCents, outCents: physical.outCents, expectedCents: physical.expectedCents,
      });
      continue;
    }
    let inCents = 0, outCents = 0, seen = false;
    const add = (cents: number) => { seen = true; if (cents > 0) inCents += cents; else outCents -= cents; };
    for (const [t, rows] of tables) for (const r of rows) {
      const x = cashOf(t, r, box);
      if (x && x.cents && x.day && x.day > fromDay && x.day <= today) add(x.cents);
    }
    // Shpenzimet e ushqimit të paguara cash dalin nga arka e Ushqimit (jo e Shkollimit)
    if (box.label === "Ushqimi") for (const s of tables[2][1] as { deletedAt: Date | null; paguar: boolean; mePagesa: boolean; metoda: string | null; kategoriId: number; shuma: number; data: Date }[]) {
      const d = dayKey(s.data);
      if (s.deletedAt == null && s.paguar && !s.mePagesa && (!s.metoda || s.metoda === "CASH") && food.has(s.kategoriId) && d && d > fromDay && d <= today) add(-Math.round(s.shuma * 100));
    }
    if (!seen) continue;
    out.push({ key: box.key, label: box.label, fromDay, openingCents: 0, inCents, outCents, expectedCents: inCents - outCents });
  }
  return { today, boxes: out, totalCents: out.reduce((s, b) => s + b.expectedCents, 0) };
}
