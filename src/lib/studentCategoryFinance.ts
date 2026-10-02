import { prisma } from "./prisma";
import { getCategoryMessageStatus, getSalesMessageStatus, PAYMENT_CATEGORY_FOR_TYPE, type SimpleStatus } from "./smsStatus";
import { computeStudentFinanceRows, type StudentFinanceRow } from "./studentFinanceRows";

// Financat e nxënësve për TË GJITHA kategoritë, për një vit akademik — VETËM
// LEXIM, pa logjikë të re llogaritjeje:
//   • Shkollimi → computeStudentFinanceRows (i njëjti burim si faqja Nxënësit)
//   • Ushqimi, eShkollori → getCategoryMessageStatus (si moduli i mesazheve)
//   • Uniforma, Librat → getSalesMessageStatus (si moduli i mesazheve)
// Të njëjtat rregulla të dhënash si /api/sms/audience: viti akademik
// (Shtator–Gusht), pa "BORXH_VJETER"; shitjet e vitit + çdo shitje e vjetër me borxh.

export type FinanceCategory = "SHKOLLIMI" | "USHQIMI" | "ESHKOLLORI" | "UNIFORMA" | "LIBRAT";

export const FINANCE_CATEGORY_LABELS: Record<FinanceCategory, string> = {
  SHKOLLIMI: "Shkollimi", USHQIMI: "Ushqimi", UNIFORMA: "Uniforma", ESHKOLLORI: "eShkollori", LIBRAT: "Librat e anglishtes",
};

export interface CategoryAmount { final: number; paid: number; balance: number; status: string }

export interface StudentAllFinance {
  tuition: StudentFinanceRow | null;
  categories: Partial<Record<FinanceCategory, CategoryAmount>>;
}

const round = (n: number) => Math.round(n * 100) / 100;

export async function computeStudentAllFinance(orgId: number, studentIds: number[], year: number): Promise<Map<number, StudentAllFinance>> {
  const out = new Map<number, StudentAllFinance>();
  if (!studentIds.length) return out;
  studentIds.forEach(id => out.set(id, { tuition: null, categories: {} }));

  const academicWhere = { OR: [{ month: { gte: 9 }, year }, { month: { lte: 8 }, year: year + 1 }] };
  const from = new Date(year, 8, 1);
  const to = new Date(year + 1, 8, 1);
  const saleWhere = { OR: [{ saleDate: { gte: from, lt: to } }, { saleDate: { lt: from }, balance: { gt: 0 } }] };

  const catNames = { USHQIMI: PAYMENT_CATEGORY_FOR_TYPE.USHQIMI!, ESHKOLLORI: PAYMENT_CATEGORY_FOR_TYPE.ESHKOLLORI! };
  const [tuition, cats, uni, books] = await Promise.all([
    computeStudentFinanceRows({ organizationId: orgId, id: { in: studentIds } }, { year, yearType: "academic" }),
    prisma.paymentCategory.findMany({ where: { name: { in: Object.values(catNames) } }, select: { id: true, name: true } }),
    prisma.uniSale.findMany({ where: { ...saleWhere, studentId: { in: studentIds }, status: { not: "CANCELLED" } }, select: { studentId: true, totalAmount: true, paidAmount: true } }),
    prisma.bookSale.findMany({ where: { ...saleWhere, studentId: { in: studentIds }, status: { not: "CANCELLED" } }, select: { studentId: true, totalAmount: true, paidAmount: true } }),
  ]);
  for (const r of tuition.rows) {
    const f = out.get(r.id);
    if (!f) continue;
    f.tuition = r;
    f.categories.SHKOLLIMI = { final: r.finalPrice, paid: r.paid, balance: r.balance, status: r.payStatus };
  }

  const payments = cats.length ? await prisma.payment.findMany({
    where: { categoryId: { in: cats.map(c => c.id) }, studentId: { in: studentIds }, AND: [{ OR: [{ description: null }, { description: { not: "BORXH_VJETER" } }] }], ...academicWhere },
    select: { studentId: true, categoryId: true, finalAmount: true, paidAmount: true, description: true, dueDate: true },
  }) : [];
  for (const [key, name] of Object.entries(catNames) as [FinanceCategory, string][]) {
    const cat = cats.find(c => c.name === name);
    if (!cat) continue;
    const by = new Map<number, typeof payments>();
    for (const p of payments) if (p.categoryId === cat.id) { if (!by.has(p.studentId)) by.set(p.studentId, []); by.get(p.studentId)!.push(p); }
    for (const [sid, list] of by) {
      const r = getCategoryMessageStatus(list);
      if (r) out.get(sid)!.categories[key] = { final: round(r.paid + r.balance), paid: round(r.paid), balance: round(r.balance), status: r.status as SimpleStatus };
    }
  }

  for (const [key, sales] of [["UNIFORMA", uni], ["LIBRAT", books]] as [FinanceCategory, { studentId: number | null; totalAmount: number; paidAmount: number }[]][]) {
    const by = new Map<number, { totalAmount: number; paidAmount: number }[]>();
    for (const s of sales) if (s.studentId) { if (!by.has(s.studentId)) by.set(s.studentId, []); by.get(s.studentId)!.push(s); }
    for (const [sid, list] of by) {
      const r = getSalesMessageStatus(list);
      if (r && out.has(sid)) out.get(sid)!.categories[key] = { final: round(r.paid + r.balance), paid: round(r.paid), balance: round(r.balance), status: r.status };
    }
  }
  return out;
}

/** Totalet e një grupi nxënësish (p.sh. familja), sipas kategorive. */
export function sumFinance(list: StudentAllFinance[]) {
  const byCategory: Partial<Record<FinanceCategory, { final: number; paid: number; balance: number }>> = {};
  let final = 0, paid = 0, balance = 0;
  for (const f of list) {
    for (const [k, v] of Object.entries(f.categories) as [FinanceCategory, CategoryAmount][]) {
      const t = byCategory[k] ?? (byCategory[k] = { final: 0, paid: 0, balance: 0 });
      t.final += v.final; t.paid += v.paid; t.balance += v.balance;
      final += v.final; paid += v.paid; balance += v.balance;
    }
  }
  for (const v of Object.values(byCategory)) { v!.final = round(v!.final); v!.paid = round(v!.paid); v!.balance = round(v!.balance); }
  return { final: round(final), paid: round(paid), balance: round(balance), byCategory };
}
