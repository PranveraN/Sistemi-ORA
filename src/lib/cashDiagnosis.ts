import { prisma } from "@/lib/prisma";
import { getAcademicMonths } from "@/lib/academicYear";
import { paymentChannel } from "@/lib/cashFlow";
import { computeShkollimiOverview } from "@/lib/shkollimiOverview";
import { ACTIVE_SHPENZIM, isCashMethod } from "@/lib/shkollimiExpenses";
import { dayKey } from "@/lib/expenseAudit";

// Diagnostikimi i arkës së Shkollimit (vetëm lexim): pse "Në arkë" del negative.
// Arka numëron vetëm pagesat CASH të nxënësve AKTIVË, të KONFIRMUARA, për muajt
// e vitit. Çdo para cash që hyri ndryshe (e shënuar si bankë / pa metodë, nga
// nxënës të larguar, e pakonfirmuar, borxh i vjetër, mbetje e vitit të kaluar)
// s'është te "hyrjet" — por nëse u dorëzua, është te "daljet".

const r2 = (v: number) => Math.round(v * 100) / 100;
type Split = { cash: number; bank: number; none: number; count: number };
const empty = (): Split => ({ cash: 0, bank: 0, none: 0, count: 0 });
function add(s: Split, amount: number, method: string | null) {
  const ch = paymentChannel(method);
  if (ch === "cash") s.cash += amount; else if (ch === "banke") s.bank += amount; else s.none += amount;
  s.count++;
}
const fix = (s: Split): Split => ({ cash: r2(s.cash), bank: r2(s.bank), none: r2(s.none), count: s.count });

export async function runCashDiagnosis(orgId: number, year: number) {
  const cat = await prisma.paymentCategory.findFirst({ where: { name: "Shkollimi", organizationId: orgId } });
  if (!cat) return null;
  const months = getAcademicMonths(year);
  const from = new Date(year, 8, 1), to = new Date(year + 1, 8, 1);

  const [overview, prevOverview, yearRows, paidInPeriod, handovers, expenses, investments, hyrat, legacy] = await Promise.all([
    computeShkollimiOverview(orgId, year, "academic"),
    computeShkollimiOverview(orgId, year - 1, "academic"),
    // Pagesat e muajve të këtij viti (si te arka)
    prisma.payment.findMany({
      where: { organizationId: orgId, categoryId: cat.id, OR: months.map(m => ({ month: m.calMonth, year: m.calYear })), paidAmount: { gt: 0 } },
      select: { paidAmount: true, method: true, confirmed: true, paidDate: true, description: true, student: { select: { status: true } } },
    }),
    // Pagesat e arkëtuara brenda vitit (sipas datës së pagesës) që i përkasin borxhit të vjetër ose muajve të tjerë
    prisma.payment.findMany({
      where: { organizationId: orgId, categoryId: cat.id, paidAmount: { gt: 0 }, paidDate: { gte: from, lt: to },
        NOT: { OR: months.map(m => ({ month: m.calMonth, year: m.calYear })) } },
      select: { paidAmount: true, method: true, description: true, year: true },
    }),
    prisma.expense.findMany({ where: { categoryId: cat.id, type: "HANDOVER", date: { gte: from, lt: to } }, orderBy: { date: "asc" } }),
    prisma.shpenzim.findMany({ where: { ...ACTIVE_SHPENZIM, paguar: true, data: { gte: from, lt: to } }, select: { data: true, shuma: true, metoda: true, kategori: { select: { fusha: true } } } }),
    prisma.investim.findMany({ where: { metoda: "CASH", data: { gte: from, lt: to } }, select: { data: true, vlera: true } }),
    prisma.hyra.findMany({ where: { kategoria: "SHKOLLIMI", metoda: "CASH", OR: months.map(m => ({ muaj: m.calMonth, vit: m.calYear })) }, select: { muaj: true, vit: true, shuma: true } }),
    prisma.expense.findMany({ where: { categoryId: cat.id, type: "EXPENSE", migratedToShpenzimId: null, date: { gte: from, lt: to } }, select: { date: true, amount: true, method: true } }),
  ]);
  if (!overview) return null;

  const counted = empty(), wrongMethod = empty(), inactive = empty(), unconfirmed = empty();
  for (const p of yearRows) {
    const active = p.student.status === "ACTIVE";
    if (!active) { add(inactive, p.paidAmount, p.method); continue; }
    if (!p.confirmed) { add(unconfirmed, p.paidAmount, p.method); continue; }
    if (paymentChannel(p.method) === "cash") add(counted, p.paidAmount, p.method);
    else add(wrongMethod, p.paidAmount, p.method);
  }
  const oldDebt = empty(), otherYears = empty();
  for (const p of paidInPeriod) {
    if (p.description === "BORXH_VJETER") add(oldDebt, p.paidAmount, p.method); else add(otherYears, p.paidAmount, p.method);
  }

  // Rrjedha mujore: hyrje cash vs dalje cash, dhe gjendja kumulative
  const key = (d: Date) => dayKey(d).slice(0, 7);
  const monthKeys = months.map(m => `${m.calYear}-${String(m.calMonth).padStart(2, "0")}`);
  const flow = new Map(monthKeys.map(k => [k, { month: k, cashIn: 0, handed: 0, expenses: 0, investments: 0 }]));
  const cashRows = await prisma.payment.findMany({
    where: { organizationId: orgId, categoryId: cat.id, OR: months.map(m => ({ month: m.calMonth, year: m.calYear })), paidAmount: { gt: 0 }, confirmed: true, method: "CASH", student: { status: "ACTIVE" } },
    select: { paidAmount: true, paidDate: true, month: true, year: true },
  });
  for (const p of cashRows) {
    const k = p.paidDate ? key(p.paidDate) : `${p.year}-${String(p.month).padStart(2, "0")}`;
    const b = flow.get(k) ?? flow.get(monthKeys[0])!;
    b.cashIn += p.paidAmount;
  }
  for (const h of hyrat) { const b = flow.get(`${h.vit}-${String(h.muaj).padStart(2, "0")}`); if (b) b.cashIn += h.shuma; }
  for (const h of handovers) { const b = flow.get(key(h.date)); if (b) b.handed += h.amount; }
  for (const e of expenses) { if (e.kategori?.fusha === "USHQIMI" || !isCashMethod(e.metoda)) continue; const b = flow.get(key(e.data)); if (b) b.expenses += e.shuma; }
  for (const e of legacy) { if (!isCashMethod(e.method)) continue; const b = flow.get(key(e.date)); if (b) b.expenses += e.amount; }
  for (const i of investments) { const b = flow.get(key(i.data)); if (b) b.investments += i.vlera; }
  let running = 0;
  const monthly = [...flow.values()].map(m => {
    running += m.cashIn - m.handed - m.expenses - m.investments;
    return { month: m.month, cashIn: r2(m.cashIn), handed: r2(m.handed), expenses: r2(m.expenses), investments: r2(m.investments), balance: r2(running) };
  });
  const firstNegative = monthly.find(m => m.balance < 0)?.month ?? null;

  const cf = overview.cashFlow;
  const deficit = r2(Math.max(0, -cf.inCashBox));
  const prevClosing = prevOverview?.cashFlow.inCashBox ?? null;
  const causes = [
    { key: "method", title: "Pagesa të shënuara si Bankë ose pa metodë", note: "Nëse disa prej tyre u paguan në fakt cash, korrigjojeni metodën te pagesa.", amount: r2(wrongMethod.bank + wrongMethod.none), split: fix(wrongMethod) },
    { key: "inactive", title: "Pagesa nga nxënës që s'janë më aktivë", note: "Paratë hynë, por \"Paguar\" numëron vetëm nxënësit aktivë.", amount: r2(inactive.cash + inactive.bank + inactive.none), split: fix(inactive) },
    { key: "unconfirmed", title: "Pagesa të pakonfirmuara (import / TIMI Invest)", note: "S'llogariten derisa të konfirmohen te Shkollimi → Verifikim.", amount: r2(unconfirmed.cash + unconfirmed.bank + unconfirmed.none), split: fix(unconfirmed) },
    { key: "olddebt", title: "Pagesa të borxhit të vjetër të arkëtuara këtë vit", note: "I përkasin viteve të kaluara, ndaj s'hyjnë te pagesat e këtij viti.", amount: r2(oldDebt.cash + oldDebt.bank + oldDebt.none), split: fix(oldDebt) },
    { key: "otheryears", title: "Pagesa për muaj të viteve të tjera, të arkëtuara këtë vit", note: "P.sh. parapagime ose vonesa — hyjnë te viti i muajit, jo te viti i arkëtimit.", amount: r2(otherYears.cash + otherYears.bank + otherYears.none), split: fix(otherYears) },
    { key: "previous", title: `Mbetja në arkë nga viti ${year - 1}–${year}`, note: "Arka e çdo viti nis nga 0; nëse paratë e vitit të kaluar u dorëzuan këtë vit, ato janë te \"Dorëzuar\" por jo te hyrjet.", amount: prevClosing !== null ? r2(Math.max(0, prevClosing)) : 0, split: null },
  ];

  return {
    year: `${year}–${year + 1}`,
    arka: { cashIn: r2(cf.cash + cf.otherCash), handed: cf.handedOver, expenses: cf.expensesCash, investments: cf.investmentsCash, inCashBox: cf.inCashBox, deficit },
    causes,
    explainable: r2(causes.reduce((s, c) => s + (c.split ? c.split.cash + c.split.none : c.amount), 0)),
    prevClosing,
    monthly,
    firstNegative,
    handovers: handovers.map(h => ({ id: h.id, day: dayKey(h.date), amount: h.amount, recipient: h.recipient, description: h.description, method: h.method })),
  };
}

export type CashDiagnosis = NonNullable<Awaited<ReturnType<typeof runCashDiagnosis>>>;
