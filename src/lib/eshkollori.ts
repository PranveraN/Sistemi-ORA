import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { activeExemption, yearFee, feeStatus, summarize, type FeeStatus } from "@/lib/feeLedger";

// Eshkollori → "Të hyra": detyrimi vjetor (Payment i vitit), lirimet
// (FeeExemption), borxhi i vjetër (Payment "BORXH_VJETER") dhe historiku
// (FeeChangeLog). Vetëm administrata — kontrolli bëhet këtu, në server.

export const ESHKOLLORI_CATEGORY = "Platforma Digjitale";
export const DEFAULT_FEE = 20;
export const OLD_DEBT = "BORXH_VJETER";
/** Statuset e borxhit të vjetër që s'llogariten më (mbeten në databazë dhe në histori). */
export const OLD_DEBT_CLOSED = ["FORGIVEN", "VOID"];

type Tx = Prisma.TransactionClient;

export interface Actor { orgId: number; userId: number; userName: string | null }

/** Administrata me qasje te moduli Eshkollori (Super Admin gjithmonë); mësuesit kurrë. */
export function requireEshkollori(session: unknown, write = false): Actor | NextResponse {
  const u = (session as { user?: { id?: string; role?: string; name?: string | null; organizationId?: number } } | null)?.user;
  if (!u) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (u.role === "TEACHER" || !sessionHasModule(session, "eshkollori")) {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }
  void write; // edhe Admini mund të shkruajë (që nga 2026-10-09)
  return { orgId: u.organizationId ?? 1, userId: Number(u.id), userName: u.name ?? null };
}

export async function getCategory(orgId: number) {
  return (await prisma.paymentCategory.findFirst({ where: { name: ESHKOLLORI_CATEGORY, organizationId: orgId } }))
    ?? prisma.paymentCategory.findFirst({ where: { name: ESHKOLLORI_CATEGORY } });
}

/** Shuma standarde e vitit: Cilësimet → Vitet shkollore (çmimi i kategorisë), përndryshe 20 €. */
export async function defaultFee(categoryId: number, categoryDefault: number, year: number): Promise<number> {
  const sy = await prisma.schoolYear.findFirst({
    where: { OR: [{ label: `${year}-${year + 1}` }, { label: `${year}–${year + 1}` }, { label: `${year}/${year + 1}` }] },
    select: { prices: { where: { categoryId }, select: { defaultAmount: true } } },
  });
  const p = sy?.prices[0]?.defaultAmount;
  if (p && p > 0) return p;
  return categoryDefault > 0 ? categoryDefault : DEFAULT_FEE;
}

export const yearLabel = (y: number) => `${y}–${y + 1}`;

/** Rreshtat e detyrimit të vitit (jo borxh i vjetër): afati brenda vitit akademik, ose viti i shënuar pa muaj. */
export function yearRowWhere(categoryId: number, year: number, studentId?: number): Prisma.PaymentWhereInput {
  return {
    categoryId,
    ...(studentId ? { studentId } : {}),
    AND: [
      { OR: [{ description: null }, { description: { not: OLD_DEBT } }] },
      { OR: [{ dueDate: { gte: new Date(year, 8, 1), lt: new Date(year + 1, 8, 1) } }, { year, month: null }] },
    ],
  };
}

type RowLike = { amount: number; discount: number; discountType: string | null; scholarship: number; finalAmount: number; paidAmount: number };

/** Shuma bazë e nxënësit (para lirimit). Zbritja e lirimit shënohet me discountType "EXEMPTION". */
export function baseOf(row: RowLike): number {
  return row.discountType === "EXEMPTION" ? Math.max(0, row.amount - row.scholarship) : row.finalAmount;
}

export function paymentStatus(final: number, paid: number): string {
  return paid >= final - 0.004 ? "PAID" : paid > 0 ? "PARTIAL" : "PENDING";
}

/** Përditëson rreshtin e vitit sipas bazës dhe lirimit aktiv. */
export async function syncYearRow(tx: Tx, rowId: number, base: number, ex: { type: string; percent: number | null } | null) {
  const row = await tx.payment.findUniqueOrThrow({ where: { id: rowId } });
  const { expected, exempted } = yearFee(base, ex);
  const data = ex || row.discountType === "EXEMPTION"
    ? { amount: base, discount: exempted, discountType: ex ? "EXEMPTION" : "fixed", scholarship: 0, finalAmount: expected }
    : { amount: base, discount: 0, discountType: "fixed", scholarship: 0, finalAmount: base };
  return tx.payment.update({
    where: { id: rowId },
    data: { ...data, balance: Math.max(0, Math.round((data.finalAmount - row.paidAmount) * 100) / 100), status: paymentStatus(data.finalAmount, row.paidAmount) },
  });
}

export interface LedgerStudent {
  id: number;
  name: string;
  parent: string | null;
  className: string | null;
  base: number;
  expected: number;
  paid: number;
  debt: number;
  exempted: number;
  status: FeeStatus;
  amountChanged: boolean;
  rowId: number | null;
  exemption: { id: number; type: string; percent: number | null; reason: string; reasonText: string | null; untilYear: number | null; createdByName: string | null; createdAt: Date } | null;
  oldDebts: { id: number; year: number | null; amount: number; total: number; paid: number; note: string | null }[];
  oldDebt: number;
}

export async function loadLedger(orgId: number, year: number) {
  const cat = await getCategory(orgId);
  if (!cat) return null;
  const def = await defaultFee(cat.id, cat.defaultAmount, year);
  const [students, rows, olds, exemptions] = await Promise.all([
    prisma.student.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, parentName: true, fatherName: true, motherName: true, class: { select: { name: true } } },
      orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
    }),
    prisma.payment.findMany({ where: yearRowWhere(cat.id, year), orderBy: { id: "asc" } }),
    prisma.payment.findMany({
      where: { categoryId: cat.id, description: OLD_DEBT, balance: { gt: 0 }, status: { notIn: OLD_DEBT_CLOSED } },
      orderBy: [{ year: "asc" }, { id: "asc" }],
    }),
    prisma.feeExemption.findMany({ where: { categoryId: cat.id, cancelledAt: null }, orderBy: { createdAt: "asc" } }),
  ]);
  const rowsBy = group(rows, r => r.studentId);
  const oldBy = group(olds, r => r.studentId);
  const exBy = group(exemptions, r => r.studentId);

  const list: LedgerStudent[] = students.map(s => {
    const rs = rowsBy.get(s.id) ?? [];
    const ex = activeExemption(exBy.get(s.id) ?? [], year);
    const base = rs.length ? round(rs.reduce((t, r) => t + baseOf(r), 0)) : def;
    const { expected, exempted } = yearFee(base, ex);
    const paid = round(rs.reduce((t, r) => t + r.paidAmount, 0));
    const od = (oldBy.get(s.id) ?? []).map(o => ({ id: o.id, year: o.year, amount: o.balance, total: o.finalAmount, paid: o.paidAmount, note: o.note }));
    return {
      id: s.id,
      name: `${s.firstName} ${s.lastName}`,
      parent: s.parentName || s.fatherName || s.motherName || null,
      className: s.class?.name ?? null,
      base, expected, paid, exempted,
      debt: round(Math.max(0, expected - paid)),
      status: feeStatus(expected, paid, ex?.type === "FULL"),
      amountChanged: Math.abs(base - def) > 0.004,
      rowId: rs[0]?.id ?? null,
      exemption: ex && { id: ex.id, type: ex.type, percent: ex.percent, reason: ex.reason, reasonText: ex.reasonText, untilYear: ex.untilYear, createdByName: ex.createdByName, createdAt: ex.createdAt },
      oldDebts: od,
      oldDebt: round(od.reduce((t, o) => t + o.amount, 0)),
    };
  });
  return { category: { id: cat.id, name: cat.name }, year, label: yearLabel(year), defaultAmount: def, students: list, summary: summarize(list) };
}

export async function logChange(tx: Tx | typeof prisma, a: Actor, d: {
  studentId: number; categoryId: number; year?: number | null; action: string;
  oldValue?: number | null; newValue?: number | null; reason?: string | null; detail?: string | null; refId?: number | null;
}) {
  await tx.feeChangeLog.create({ data: { organizationId: a.orgId, userId: a.userId, userName: a.userName, ...d } });
}

export const round = (v: number) => Math.round(v * 100) / 100;

function group<T>(arr: T[], key: (t: T) => number): Map<number, T[]> {
  const m = new Map<number, T[]>();
  for (const x of arr) { const k = key(x); const a = m.get(k); if (a) a.push(x); else m.set(k, [x]); }
  return m;
}

/** Krijon rreshtin e vitit kur s'ekziston (me shumën bazë), që të mbajë pagesat/ndryshimet. */
export async function ensureYearRow(tx: Tx, orgId: number, categoryId: number, studentId: number, year: number, base: number) {
  const existing = await tx.payment.findFirst({ where: yearRowWhere(categoryId, year, studentId), orderBy: { id: "asc" } });
  if (existing) return existing;
  return tx.payment.create({
    data: {
      organizationId: orgId, studentId, categoryId,
      amount: base, discount: 0, discountType: "fixed", scholarship: 0, finalAmount: base,
      paidAmount: 0, balance: base, status: "PENDING",
      dueDate: new Date(year, 8, 15), year, month: null,
    },
  });
}
