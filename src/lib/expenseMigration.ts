import { prisma } from "@/lib/prisma";
import { createNamedBackup } from "@/lib/backup";
import { dayKey, norm, FOOD_WORDS } from "@/lib/expenseAudit";
import { loadShkollimiExpenses } from "@/lib/shkollimiExpenses";
import { computeShkollimiOverview } from "@/lib/shkollimiOverview";
import { DEFAULT_ACADEMIC_YEAR } from "@/lib/academicYear";

/** Arka e vitit aktual (si te dashboard-i dhe Pasqyra e Arkës). */
async function arka() {
  const cf = (await computeShkollimiOverview(1, DEFAULT_ACADEMIC_YEAR, "academic"))?.cashFlow;
  return cf ? { viti: `${DEFAULT_ACADEMIC_YEAR}–${DEFAULT_ACADEMIC_YEAR + 1}`, paguar: cf.paid, teHyraTjeraCash: cf.otherCash, shpenzuarNgaArka: cf.expensesCash, dorezuar: cf.handedOver, neArke: cf.inCashBox } : null;
}

// Faza 2 — migrimi i shpenzimeve të Shkollimit në një libër të vetëm (Shpenzim).
//   • Rreshtat e skedës së vjetër (Expense, type EXPENSE, Shkollimi) kopjohen te
//     Shpenzim; rreshti i vjetër NUK fshihet — shënohet "i migruar" (migratedToShpenzimId).
//   • Dyfishimet që zgjidhni ju lidhen me shpenzimin ekzistues (s'kopjohen sërish).
//   • Kategoritë që zgjidhni si "Ushqimi" shënohen USHQIMI (s'zbriten nga arka e Shkollimit).
//   • Idempotent: rreshtat e migruar më parë anashkalohen; ekzekutimi i dytë s'krijon asgjë.
//   • Para çdo shkrimi bëhet backup i plotë i databazës (s'fshihet automatikisht).

export const MIGRATED_CATEGORY = "Shpenzime të Shkollimit (nga skeda)";

async function shkollimiIds() {
  return (await prisma.paymentCategory.findMany({ where: { name: "Shkollimi" }, select: { id: true } })).map(c => c.id);
}

/** Totalet për verifikim: TË GJITHA shpenzimet aktive (edhe kategoritë e Ushqimit) + rreshtat e skedës
 * ende pa u migruar, sipas muajve dhe metodës. Para/pas duhet të përputhen, përveç dyfishimeve të lidhura. */
async function verificationTotals() {
  const ids = await shkollimiIds();
  const { rows } = await loadShkollimiExpenses(ids[0] ?? null, 0, 0, "academic");
  const r2 = (v: number) => Math.round(v * 100) / 100;
  const byMonth = new Map<string, { month: string; count: number; total: number; cash: number; bank: number; unpaid: number }>();
  const t = { count: 0, total: 0, cash: 0, bank: 0, unpaid: 0, ushqimi: 0 };
  for (const r of rows) {
    const m = dayKey(new Date(r.date)).slice(0, 7);
    const b = byMonth.get(m) ?? { month: m, count: 0, total: 0, cash: 0, bank: 0, unpaid: 0 };
    for (const x of [b, t]) {
      x.count++; x.total += r.amount;
      if (!r.paid) x.unpaid += r.amount; else if (!r.method || r.method === "CASH") x.cash += r.amount; else x.bank += r.amount;
    }
    if (r.scope === "USHQIMI") t.ushqimi += r.amount;
    byMonth.set(m, b);
  }
  return {
    totals: { count: t.count, total: r2(t.total), cash: r2(t.cash), bank: r2(t.bank), unpaid: r2(t.unpaid), ushqimi: r2(t.ushqimi) },
    months: [...byMonth.values()].map(b => ({ ...b, total: r2(b.total), cash: r2(b.cash), bank: r2(b.bank), unpaid: r2(b.unpaid) })).sort((a, b) => b.month.localeCompare(a.month)),
  };
}

export async function migrationPreview() {
  const ids = await shkollimiIds();
  const [legacy, categories, shp] = await Promise.all([
    prisma.expense.findMany({ where: { categoryId: { in: ids }, type: "EXPENSE", migratedToShpenzimId: null }, orderBy: { date: "asc" } }),
    prisma.shpenzimKategori.findMany({ orderBy: { emri: "asc" }, include: { _count: { select: { shpenzime: { where: { deletedAt: null } } } } } }),
    prisma.shpenzim.findMany({ where: { deletedAt: null }, select: { id: true, data: true, shuma: true, pershkrim: true, kategori: { select: { emri: true } } } }),
  ]);
  const already = await prisma.expense.count({ where: { categoryId: { in: ids }, type: "EXPENSE", migratedToShpenzimId: { not: null } } });

  const byKey = new Map<string, typeof shp>();
  for (const s of shp) { const k = `${dayKey(s.data)}|${Math.round(s.shuma * 100)}`; (byKey.get(k) ?? byKey.set(k, []).get(k)!).push(s); }

  const rows = legacy.map(e => {
    const matches = (byKey.get(`${dayKey(e.date)}|${Math.round(e.amount * 100)}`) ?? []).map(s => {
      const a = norm(s.pershkrim), b = norm(e.description);
      return { id: s.id, description: s.pershkrim, category: s.kategori?.emri ?? null, certain: !!a && !!b && (a === b || a.includes(b) || b.includes(a)) };
    });
    return { id: e.id, day: dayKey(e.date), amount: e.amount, description: e.description, recipient: e.recipient, method: e.method, reference: e.reference, matches };
  });

  return {
    legacy: rows,
    alreadyMigrated: already,
    categories: categories.map(c => ({
      id: c.id, name: c.emri, fusha: c.fusha, count: c._count.shpenzime,
      suggestedFood: FOOD_WORDS.some(w => ` ${norm(c.emri)} `.includes(w)),
    })),
    targetCategory: MIGRATED_CATEGORY,
    before: await verificationTotals(),
    arka: await arka(),
  };
}

export interface MigrationInput {
  /** Rreshtat e skedës që janë dyfishime: expenseId → id e shpenzimit ekzistues me të cilin lidhen (s'kopjohen). */
  linkDuplicates: Record<number, number>;
  /** Kategoritë që janë "Ushqimi" (të tjerat mbeten/kthehen "Shkollimi"). */
  foodCategoryIds: number[];
  user: { id: number; name: string | null };
}

export async function runMigration(input: MigrationInput) {
  const before = await verificationTotals();
  const arkaBefore = await arka();
  const backup = await createNamedBackup("para-migrimit-shpenzimeve");
  const ids = await shkollimiIds();

  const result = await prisma.$transaction(async tx => {
    // 1) Fusha e kategorive
    const food = new Set(input.foodCategoryIds);
    const cats = await tx.shpenzimKategori.findMany({ select: { id: true, fusha: true } });
    let fushaChanged = 0;
    for (const c of cats) {
      const want = food.has(c.id) ? "USHQIMI" : "SHKOLLIMI";
      if (c.fusha !== want) { await tx.shpenzimKategori.update({ where: { id: c.id }, data: { fusha: want } }); fushaChanged++; }
    }

    // 2) Rreshtat e skedës së vjetër
    const legacy = await tx.expense.findMany({ where: { categoryId: { in: ids }, type: "EXPENSE", migratedToShpenzimId: null } });
    let target = await tx.shpenzimKategori.findFirst({ where: { emri: MIGRATED_CATEGORY } });
    let created = 0, linked = 0, relinked = 0;
    for (const e of legacy) {
      // Idempotencë: nëse ekziston tashmë një kopje e këtij rreshti, vetëm lidhet
      const existingCopy = await tx.shpenzim.findFirst({ where: { migratedFromExpenseId: e.id }, select: { id: true } });
      if (existingCopy) { await tx.expense.update({ where: { id: e.id }, data: { migratedToShpenzimId: existingCopy.id } }); relinked++; continue; }
      const dup = input.linkDuplicates[e.id];
      if (dup) {
        const ok = await tx.shpenzim.findFirst({ where: { id: dup, deletedAt: null }, select: { id: true } });
        if (ok) { await tx.expense.update({ where: { id: e.id }, data: { migratedToShpenzimId: ok.id } }); linked++; continue; }
      }
      if (!target) target = await tx.shpenzimKategori.create({ data: { emri: MIGRATED_CATEGORY, ngjyra: "#64748b" } });
      const s = await tx.shpenzim.create({
        data: {
          kategoriId: target.id, shuma: e.amount, pershkrim: e.description, marres: e.recipient, data: e.date,
          metoda: e.method || "CASH", referenca: e.reference, docType: "KUPON", lloji: "ZYRE", paguar: true,
          migratedFromExpenseId: e.id,
        },
      });
      await tx.expense.update({ where: { id: e.id }, data: { migratedToShpenzimId: s.id } });
      created++;
    }
    await tx.auditLog.create({
      data: {
        userId: input.user.id, action: "UPDATE", entity: "ShpenzimMigrimi", entityId: null,
        details: `Migrimi i shpenzimeve të Shkollimit: ${created} të kopjuara, ${linked} dyfishime të lidhura, ${relinked} të rilidhura, ${fushaChanged} kategori me fushë të re · backup ${backup.filename}`,
      },
    });
    return { created, linked, relinked, fushaChanged, legacyCount: legacy.length };
  }, { timeout: 120_000 });

  const after = await verificationTotals();
  return { ...result, backup, before, after, arkaBefore, arkaAfter: await arka() };
}
