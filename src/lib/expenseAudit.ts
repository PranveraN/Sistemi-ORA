import { prisma } from "@/lib/prisma";
import { DEFAULT_ALLOWED, CONFIGURABLE_ROLES } from "@/lib/modules";

// Auditimi i shpenzimeve të Shkollimit (Faza 1) — VETËM LEXIM, asnjë shkrim.
// Libri A = moduli "Shpenzimet" (Shpenzim); Libri B = skeda "Shpenzime" te
// Shkollimi (Expense, type EXPENSE). Plus dorëzimet (dy libra), investimet,
// të hyrat tjera dhe lejet e roleve — gjithçka që duhet për vendimet e migrimit.

const r2 = (v: number) => Math.round(v * 100) / 100;
/** Data si ditë kalendarike, e qëndrueshme ndaj orës së ruajtur (23:00Z / 00:00Z). */
export const dayKey = (d: Date) => new Date(d.getTime() + 12 * 3600_000).toISOString().slice(0, 10);
const academicYear = (day: string) => { const y = +day.slice(0, 4), m = +day.slice(5, 7); return m >= 9 ? `${y}–${y + 1}` : `${y - 1}–${y}`; };
export const norm = (s: string | null | undefined) => (s ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, " ").trim();
const isCash = (m: string | null | undefined) => !m || m === "CASH";

interface Row { book: "A" | "B"; id: number; day: string; amount: number; method: string | null; paid: boolean; description: string | null; category: string | null; supplier: string | null }

interface MonthBucket { month: string; count: number; total: number; cash: number; bank: number; unpaid: number }
function byMonth(rows: Row[]): { months: MonthBucket[]; years: (MonthBucket & { year: string })[]; total: MonthBucket } {
  const m = new Map<string, MonthBucket>();
  const y = new Map<string, MonthBucket & { year: string }>();
  const t: MonthBucket = { month: "Gjithsej", count: 0, total: 0, cash: 0, bank: 0, unpaid: 0 };
  for (const r of rows) {
    const key = r.day.slice(0, 7), ay = academicYear(r.day);
    const mb = m.get(key) ?? { month: key, count: 0, total: 0, cash: 0, bank: 0, unpaid: 0 };
    const yb = y.get(ay) ?? { year: ay, month: ay, count: 0, total: 0, cash: 0, bank: 0, unpaid: 0 };
    for (const b of [mb, yb, t]) {
      b.count++; b.total += r.amount;
      if (!r.paid) b.unpaid += r.amount; else if (isCash(r.method)) b.cash += r.amount; else b.bank += r.amount;
    }
    m.set(key, mb); y.set(ay, yb);
  }
  const fix = <T extends MonthBucket>(b: T): T => ({ ...b, total: r2(b.total), cash: r2(b.cash), bank: r2(b.bank), unpaid: r2(b.unpaid) });
  return {
    months: [...m.values()].sort((a, b) => b.month.localeCompare(a.month)).map(fix),
    years: [...y.values()].sort((a, b) => b.year.localeCompare(a.year)).map(fix),
    total: fix(t),
  };
}

/** Fjalë që mund të tregojnë shpenzim ushqimi (vetëm për kontroll me sy, jo vendim automatik). */
export const FOOD_WORDS = ["ushqim", "drek", "mengjes", "kuzhin", "mish", "buke", "qumesht", "fruta", "perime", "pule", "djath", "vez", "oriz", "makarona", "vaj ", "sheqer", "kafe", "pije", "leng", "uje ", "market ", "supermarket", "restorant", "pica", "pizza", "catering", "kuzhinier"];

export async function runExpenseAudit() {
  const shkollimi = await prisma.paymentCategory.findMany({ where: { name: "Shkollimi" }, select: { id: true } });
  const shkIds = shkollimi.map(c => c.id);

  const [shp, legacy, handoverExp, paymentHandovers, investime, hyrat, perms, usersByRole, categories, otherCatExpenses] = await Promise.all([
    prisma.shpenzim.findMany({ where: { deletedAt: null }, include: { kategori: { select: { emri: true } } } }),
    prisma.expense.findMany({ where: { categoryId: { in: shkIds }, type: "EXPENSE", migratedToShpenzimId: null } }),
    prisma.expense.findMany({ where: { type: "HANDOVER" }, include: { category: { select: { name: true } } } }),
    prisma.paymentHandover.findMany({ include: { category: { select: { name: true } } } }),
    prisma.investim.findMany(),
    prisma.hyra.findMany(),
    prisma.roleModulePermission.findMany({ where: { moduleKey: { in: ["shpenzime", "shkollimi"] } } }),
    prisma.user.groupBy({ by: ["role"], where: { active: true }, _count: true }),
    prisma.shpenzimKategori.findMany({ include: { _count: { select: { shpenzime: true } } } }),
    prisma.expense.groupBy({ by: ["categoryId", "type"], where: { categoryId: { notIn: shkIds } }, _sum: { amount: true }, _count: true }),
  ]);

  const A: Row[] = shp.map(s => ({
    book: "A", id: s.id, day: dayKey(s.data), amount: s.shuma, method: s.metoda, paid: s.paguar,
    description: s.pershkrim, category: s.kategori?.emri ?? null, supplier: s.emriBiznesit || s.marres || null,
  }));
  const B: Row[] = legacy.map(e => ({
    book: "B", id: e.id, day: dayKey(e.date), amount: e.amount, method: e.method, paid: true,
    description: e.description, category: null, supplier: e.recipient,
  }));

  // ── Dyfishimet mes dy librave: e njëjta ditë + shumë (përshkrimi i njëjtë = "i sigurt") ──
  const aByKey = new Map<string, Row[]>();
  for (const r of A) { const k = `${r.day}|${Math.round(r.amount * 100)}`; (aByKey.get(k) ?? aByKey.set(k, []).get(k)!).push(r); }
  const crossDuplicates = B.flatMap(b => (aByKey.get(`${b.day}|${Math.round(b.amount * 100)}`) ?? []).map(a => {
    const da = norm(a.description), db = norm(b.description);
    const same = !!da && !!db && (da === db || da.includes(db) || db.includes(da));
    return { level: same ? "i sigurt" : "i mundshëm", day: b.day, amount: b.amount, A: { id: a.id, description: a.description, category: a.category, method: a.method }, B: { id: b.id, description: b.description, method: b.method } };
  }));

  // ── Dyfishime brenda librit A (p.sh. import i bërë dy herë) ──
  const aFull = new Map<string, Row[]>();
  for (const r of A) { const k = `${r.day}|${Math.round(r.amount * 100)}|${norm(r.description)}|${r.category}`; (aFull.get(k) ?? aFull.set(k, []).get(k)!).push(r); }
  const insideDuplicates = [...aFull.values()].filter(g => g.length > 1)
    .map(g => ({ day: g[0].day, amount: g[0].amount, description: g[0].description, category: g[0].category, ids: g.map(x => x.id) }))
    .sort((a, b) => b.day.localeCompare(a.day));

  // ── Shpenzime që mund të mos i përkasin shkollimit (ushqim) ──
  const foodCandidates = A.filter(r => { const t = ` ${norm(r.description)} ${norm(r.category)} ${norm(r.supplier)} `; return FOOD_WORDS.some(w => t.includes(w)); })
    .map(r => ({ id: r.id, day: r.day, amount: r.amount, description: r.description, category: r.category, supplier: r.supplier }))
    .sort((a, b) => b.day.localeCompare(a.day));

  // ── Dorëzimet: skeda "Dorëzim parash" (Expense HANDOVER) dhe faqja "Dorëzimet" (PaymentHandover) ──
  const hoA = handoverExp.map(h => ({ id: h.id, day: dayKey(h.date), amount: h.amount, category: h.category?.name ?? `#${h.categoryId}`, recipient: h.recipient, method: h.method }));
  const hoB = paymentHandovers.map(h => ({ id: h.id, day: dayKey(h.handoverAt), amount: h.amount, category: h.category?.name ?? "(pa kategori)", recipient: h.recipient, method: h.method }));
  const sumBy = <T extends { category: string; amount: number; day: string }>(rows: T[]) => {
    const m = new Map<string, { category: string; count: number; total: number; first: string; last: string }>();
    for (const r of rows) {
      const c = m.get(r.category) ?? { category: r.category, count: 0, total: 0, first: r.day, last: r.day };
      c.count++; c.total = r2(c.total + r.amount); if (r.day < c.first) c.first = r.day; if (r.day > c.last) c.last = r.day;
      m.set(r.category, c);
    }
    return [...m.values()];
  };
  const hoKeys = new Map(hoA.map(h => [`${h.day}|${Math.round(h.amount * 100)}`, h]));
  const handoverOverlap = hoB.filter(h => hoKeys.has(`${h.day}|${Math.round(h.amount * 100)}`)).map(h => ({ day: h.day, amount: h.amount, tab: hoKeys.get(`${h.day}|${Math.round(h.amount * 100)}`), page: h }));

  // ── Investimet dhe të hyrat tjera ──
  const invBy = new Map<string, { year: string; tipi: string; metoda: string; count: number; total: number }>();
  for (const i of investime) {
    const k = `${academicYear(dayKey(i.data))}|${i.tipi}|${i.metoda}`;
    const c = invBy.get(k) ?? { year: academicYear(dayKey(i.data)), tipi: i.tipi, metoda: i.metoda, count: 0, total: 0 };
    c.count++; c.total = r2(c.total + i.vlera); invBy.set(k, c);
  }
  const hyBy = new Map<string, { year: string; kategoria: string; metoda: string; count: number; total: number }>();
  for (const h of hyrat) {
    const y = h.muaj >= 9 ? `${h.vit}–${h.vit + 1}` : `${h.vit - 1}–${h.vit}`;
    const k = `${y}|${h.kategoria}|${h.metoda ?? "pa metodë"}`;
    const c = hyBy.get(k) ?? { year: y, kategoria: h.kategoria, metoda: h.metoda ?? "pa metodë", count: 0, total: 0 };
    c.count++; c.total = r2(c.total + h.shuma); hyBy.set(k, c);
  }

  // ── Lejet: kush ka "Shpenzimet" dhe/ose "Shkollimi" ──
  const roleAccess = CONFIGURABLE_ROLES.map(role => {
    const has = (key: string) => { const p = perms.find(x => x.role === role && x.moduleKey === key); return p ? p.allowed : DEFAULT_ALLOWED[role].includes(key); };
    return { role, shpenzime: has("shpenzime"), shkollimi: has("shkollimi"), users: usersByRole.find(u => u.role === role)?._count ?? 0 };
  });

  const catNames = new Map((await prisma.paymentCategory.findMany({ select: { id: true, name: true } })).map(c => [c.id, c.name]));

  return {
    generatedAt: new Date().toISOString(),
    bookA: { label: "Moduli \"Shpenzimet\" (Shpenzim)", ...byMonth(A) },
    bookB: { label: "Skeda \"Shpenzime\" te Shkollimi (Expense)", ...byMonth(B), rows: B.sort((a, b) => b.day.localeCompare(a.day)) },
    crossDuplicates,
    insideDuplicates,
    foodCandidates,
    categories: categories.map(c => ({ id: c.id, name: c.emri, count: c._count.shpenzime, total: r2(A.filter(r => r.category === c.emri).reduce((s, r) => s + r.amount, 0)) })).sort((a, b) => b.total - a.total),
    handovers: { tab: sumBy(hoA), page: sumBy(hoB), overlap: handoverOverlap },
    investime: [...invBy.values()].sort((a, b) => b.year.localeCompare(a.year)),
    hyrat: [...hyBy.values()].sort((a, b) => b.year.localeCompare(a.year)),
    otherCategoryExpenses: otherCatExpenses.map(g => ({ category: catNames.get(g.categoryId) ?? `#${g.categoryId}`, type: g.type, count: g._count, total: r2(g._sum.amount ?? 0) })),
    roleAccess,
    shkollimiCategoryIds: shkIds,
  };
}

export type ExpenseAudit = Awaited<ReturnType<typeof runExpenseAudit>>;
