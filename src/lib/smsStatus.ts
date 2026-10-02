// Statuset e pagesës VETËM për modulin e mesazheve (SMS). S'përdoret nga
// pagesat, Pasqyra Financiare apo Raportet — atje nxënësit me Timi Invest
// vazhdojnë të llogariten si borxh i plotë (shih /api/category-payments).
// Funksione të pastra (pa prisma) — përdoren si nga serveri (/api/sms/audience)
// ashtu edhe nga klienti.

import { aggregatePaymentTotals } from "@/lib/paymentAggregate";

export type MessageType = "SHKOLLIMI" | "USHQIMI" | "UNIFORMA" | "ESHKOLLORI" | "LIBRAT" | "GENERAL";
export type TuitionStatus = "TIMI_INVEST" | "PAID" | "OVERDUE" | "PARTIAL" | "UNPAID";
export type SimpleStatus = "PAID" | "PARTIAL" | "UNPAID";
export type MessageStatus = TuitionStatus | SimpleStatus;

export const MESSAGE_TYPES: { key: MessageType; label: string }[] = [
  { key: "SHKOLLIMI",  label: "Shkollimi" },
  { key: "USHQIMI",    label: "Ushqimi" },
  { key: "UNIFORMA",   label: "Uniforma" },
  { key: "ESHKOLLORI", label: "eShkollori" },
  { key: "LIBRAT",     label: "Librat e anglishtes" },
  { key: "GENERAL",    label: "Njoftim i përgjithshëm" },
];

/** Emri i PaymentCategory për llojet që ruhen te tabela Payment. */
export const PAYMENT_CATEGORY_FOR_TYPE: Partial<Record<MessageType, string>> = {
  SHKOLLIMI:  "Shkollimi",
  USHQIMI:    "Ushqimi",
  ESHKOLLORI: "Platforma Digjitale", // moduli eShkollori (shih /eshkollori/page.tsx)
};

// Rendi i shfaqjes = rendi i përparësisë te getTuitionMessageStatus
export const TUITION_STATUSES: { key: TuitionStatus; label: string }[] = [
  { key: "TIMI_INVEST", label: "Timi Invest" },
  { key: "PAID",        label: "Paguar plotësisht" },
  { key: "OVERDUE",     label: "Me vonesë" },
  { key: "PARTIAL",     label: "Pjesërisht – kësti i dytë" },
  { key: "UNPAID",      label: "Pa paguar fare" },
];
export const SIMPLE_STATUSES: { key: SimpleStatus; label: string }[] = [
  { key: "PAID",    label: "Paguar" },
  { key: "PARTIAL", label: "Pjesërisht" },
  { key: "UNPAID",  label: "Pa paguar" },
];

export function statusesForType(type: MessageType): { key: MessageStatus; label: string }[] {
  if (type === "GENERAL") return [];
  return type === "SHKOLLIMI" ? TUITION_STATUSES : SIMPLE_STATUSES;
}

export function statusLabel(type: MessageType, status: MessageStatus | null): string {
  if (!status) return "—";
  return statusesForType(type).find(s => s.key === status)?.label ?? status;
}

export interface InstallmentLike {
  finalAmount: number;
  paidAmount: number;
  description: string | null;
  dueDate: string | Date;
}

export interface StatusResult<S> {
  status: S;
  paid: number;
  balance: number;
  /** Afati për variablën {afati} — afati i këstit më të hershëm të papaguar. */
  dueDate: string | null;
}

const EPS = 0.005;
const toIso = (d: string | Date) => (typeof d === "string" ? d : d.toISOString());

/**
 * Statusi i Shkollimit për mesazhet — çdo nxënës bie në SAKTËSISHT një grup;
 * kontrollohet nga lart poshtë, i pari që përputhet fiton:
 *   1. Timi Invest        — financohet përmes Timi Invest
 *   2. Paguar plotësisht  — mbetja = 0
 *   3. Me vonesë          — mbetje > 0 DHE afati ka kaluar
 *   4. Pjesërisht         — paguar > 0, mbetje > 0, afati s'ka kaluar
 *   5. Pa paguar fare     — paguar 0, afati s'ka kaluar
 *
 * "Afati ka kaluar": të paktën një kësti i papaguar me afat < sot. Për planin
 * Fleksibël (pa orar këstesh) dhe për nxënësit pa asnjë kësti të krijuar,
 * përdoret afati i përgjithshëm i shkollimit (Cilësimet → tuitionDueDate).
 * Borxhi i vjetër i importuar (BORXH_VJETER) duhet përjashtuar nga thirrësi.
 */
export function getTuitionMessageStatus(input: {
  isTimiInvest: boolean;
  installments: InstallmentLike[];
  /** Shuma e pritur kur s'ka asnjë kësti (tarifa standarde − zbritja). */
  expectedAmount: number;
  tuitionDueDate: Date;
  today?: Date;
}): StatusResult<TuitionStatus> {
  const today = input.today ?? new Date();
  const inst = input.installments;
  const hasInstallments = inst.length > 0;
  const totals = hasInstallments
    ? aggregatePaymentTotals(inst)
    : { finalAmount: input.expectedAmount, paidAmount: 0, balance: input.expectedAmount };
  const paid = totals.paidAmount;
  const balance = totals.balance;

  const isFlex = inst.some(p => p.description === "FLEX_HEADER");
  const unpaid = isFlex ? [] : inst
    .filter(p => p.finalAmount - p.paidAmount > EPS)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  const generalDue = input.tuitionDueDate;
  const dueDate = unpaid.length ? toIso(unpaid[0].dueDate) : (balance > EPS ? generalDue.toISOString() : null);
  const overdue = (!hasInstallments || isFlex)
    ? generalDue < today
    : unpaid.some(p => new Date(p.dueDate) < today);

  let status: TuitionStatus;
  if (input.isTimiInvest) status = "TIMI_INVEST";
  else if (hasInstallments && balance <= EPS) status = "PAID";
  else if (balance > EPS && overdue) status = "OVERDUE";
  else if (paid > EPS) status = "PARTIAL";
  else status = "UNPAID";

  return { status, paid, balance, dueDate };
}

/** Ushqimi / eShkollori — nga këstet e kategorisë (null = s'e ka shërbimin). */
export function getCategoryMessageStatus(installments: InstallmentLike[]): StatusResult<SimpleStatus> | null {
  if (!installments.length) return null;
  const { finalAmount, paidAmount, balance } = aggregatePaymentTotals(installments);
  const unpaid = installments
    .filter(p => p.description !== "FLEX_HEADER" && p.finalAmount - p.paidAmount > EPS)
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
  return {
    status: simpleStatus(finalAmount, paidAmount),
    paid: paidAmount,
    balance,
    dueDate: unpaid.length ? toIso(unpaid[0].dueDate) : null,
  };
}

/** Uniforma / Librat — nga shitjet e nxënësit (null = s'ka blerë). */
export function getSalesMessageStatus(sales: { totalAmount: number; paidAmount: number }[]): StatusResult<SimpleStatus> | null {
  if (!sales.length) return null;
  const total = sales.reduce((s, x) => s + x.totalAmount, 0);
  const paid = sales.reduce((s, x) => s + x.paidAmount, 0);
  return { status: simpleStatus(total, paid), paid, balance: Math.max(0, total - paid), dueDate: null };
}

function simpleStatus(total: number, paid: number): SimpleStatus {
  if (total - paid <= EPS) return "PAID";
  if (paid > EPS) return "PARTIAL";
  return "UNPAID";
}

/** Afati i përgjithshëm i shkollimit për vitin akademik (cilësimi "MM-DD"). */
export function tuitionDueDateFor(academicYear: number, setting: string | null | undefined): Date {
  const m = /^(\d{1,2})-(\d{1,2})$/.exec((setting ?? "").trim());
  const month = m ? Math.min(12, Math.max(1, parseInt(m[1]))) : 9;
  const day = m ? Math.min(31, Math.max(1, parseInt(m[2]))) : 30;
  const year = month >= 9 ? academicYear : academicYear + 1;
  // Fundi i ditës — afati "kalon" vetëm të nesërmen
  return new Date(year, month - 1, day, 23, 59, 59);
}

/** Numër i përdorshëm për SMS (lokal 0XXXXXXXX ose ndërkombëtar). */
export function isValidPhone(raw: string | null | undefined): boolean {
  if (!raw) return false;
  let digits = raw.replace(/[^\d]/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  if (digits.startsWith("0")) digits = `383${digits.slice(1)}`;
  return digits.length >= 10 && digits.length <= 15;
}
