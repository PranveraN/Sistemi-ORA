// Statusi i pagesës së shkollimit për faqen "Nxënësit" — 4 statuse
// (Timi Invest → Paguar → Pjesërisht → Pa paguar). RIPËRDOR
// getTuitionMessageStatus() të modulit të mesazheve (asnjë logjikë e dytë):
// "Me vonesë" ndahet thjesht sipas shumës së paguar (Pjesërisht / Pa paguar).
// VETËM për pamjen — pagesat/raportet s'preken.

import { getTuitionMessageStatus, type InstallmentLike } from "@/lib/smsStatus";

export type StudentPayStatus = "TIMI_INVEST" | "PAID" | "PARTIAL" | "UNPAID";

export const STUDENT_PAY_STATUSES: { key: StudentPayStatus; label: string }[] = [
  { key: "UNPAID",      label: "Pa paguar" },
  { key: "PARTIAL",     label: "Pjesërisht" },
  { key: "PAID",        label: "Paguar" },
  { key: "TIMI_INVEST", label: "Timi Invest" },
];

export function getStudentPayStatus(input: {
  isTimiInvest: boolean;
  installments: InstallmentLike[];
  expectedAmount: number;
  tuitionDueDate: Date;
}): { status: StudentPayStatus; paid: number; balance: number } {
  const r = getTuitionMessageStatus(input);
  let status: StudentPayStatus;
  if (r.status === "OVERDUE") status = r.paid > 0.005 ? "PARTIAL" : "UNPAID";
  else status = r.status;
  return { status, paid: r.paid, balance: r.balance };
}
