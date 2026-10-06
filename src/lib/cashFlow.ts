// "Ku janë paratë e paguara" (Dashboard → Pasqyra financiare e shkollimit).
// Llogaritje e pastër, në CENT (integer), që shumat të mos humbasin nga
// rrumbullakimi — teste: cashFlow.test.ts

export const toCents = (euro: number) => Math.round((euro || 0) * 100);
export const fromCents = (c: number) => c / 100;

/** Mënyra e pagesës → "cash" | "banke" | null (pa metodë). Kartelë/Online hyjnë në llogari, pra "banke". */
export function paymentChannel(method: string | null | undefined): "cash" | "banke" | null {
  if (method === "CASH") return "cash";
  if (method === "BANK" || method === "CARD" || method === "ONLINE") return "banke";
  return null;
}

export interface CashFlowInput {
  cashCents: number;          // pagesat me Cash
  bankCents: number;          // pagesat me Bankë
  noMethodCents: number;      // pagesat pa metodë
  noMethodCount: number;
  expensesCashCents: number;  // shpenzimet e paguara nga arka
  handedOverCents: number;    // dorëzimet (vetëm nga cash)
}

export interface CashFlow {
  paid: number;               // cash + banke + pa metodë (= "Paguar")
  cash: number;
  bank: number;
  noMethod: { count: number; amount: number };
  expensesCash: number;
  handedOver: number;
  inCashBox: number;          // cash − shpenzimeArka − dorëzuar
  handedOverPct: number;      // dorëzuar ÷ (cash − shpenzimeArka), 0–100
  balanced: boolean;          // banke + dorëzuar + shpenzimeArka + neArke === paguar
  difference: number;         // paguar − (shuma e katër pjesëve)
}

export function computeCashFlow(i: CashFlowInput): CashFlow {
  const paidC = i.cashCents + i.bankCents + i.noMethodCents;
  const inBoxC = i.cashCents - i.expensesCashCents - i.handedOverCents;
  const base = i.cashCents - i.expensesCashCents;
  const partsC = i.bankCents + i.handedOverCents + i.expensesCashCents + inBoxC;
  const diffC = paidC - partsC;
  return {
    paid: fromCents(paidC),
    cash: fromCents(i.cashCents),
    bank: fromCents(i.bankCents),
    noMethod: { count: i.noMethodCount, amount: fromCents(i.noMethodCents) },
    expensesCash: fromCents(i.expensesCashCents),
    handedOver: fromCents(i.handedOverCents),
    inCashBox: fromCents(inBoxC),
    handedOverPct: base > 0 ? Math.round((i.handedOverCents / base) * 100) : 0,
    balanced: diffC === 0,
    difference: fromCents(diffC),
  };
}
