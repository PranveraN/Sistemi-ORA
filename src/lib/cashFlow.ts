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
  otherCashCents?: number;    // të hyrat tjera cash (kategoria SHKOLLIMI) — hyjnë në arkë
  investmentsCashCents?: number; // investimet e paguara me cash — dalin nga arka
}

export interface CashFlow {
  paid: number;               // cash + banke + pa metodë (= "Paguar")
  otherCash: number;          // të hyrat tjera cash
  total: number;              // paguar + të hyrat tjera cash (= "Gjithsej")
  cash: number;
  bank: number;
  noMethod: { count: number; amount: number };
  expensesCash: number;
  investmentsCash: number;
  handedOver: number;
  inCashBox: number;          // cash + të hyrat tjera cash − shpenzimeArka − dorëzuar
  handedOverPct: number;      // dorëzuar ÷ (cash − shpenzimeArka), 0–100
  balanced: boolean;          // banke + dorëzuar + shpenzimeArka + neArke === paguar + të hyrat tjera cash
  difference: number;         // gjithsej − (shuma e katër pjesëve)
}

export function computeCashFlow(i: CashFlowInput): CashFlow {
  const otherC = i.otherCashCents ?? 0;
  const invC = i.investmentsCashCents ?? 0;
  const paidC = i.cashCents + i.bankCents + i.noMethodCents;
  const inBoxC = i.cashCents + otherC - i.expensesCashCents - invC - i.handedOverCents;
  const base = i.cashCents + otherC - i.expensesCashCents - invC;
  const partsC = i.bankCents + i.handedOverCents + i.expensesCashCents + invC + inBoxC;
  const diffC = paidC + otherC - partsC;
  return {
    paid: fromCents(paidC),
    otherCash: fromCents(otherC),
    total: fromCents(paidC + otherC),
    cash: fromCents(i.cashCents),
    bank: fromCents(i.bankCents),
    noMethod: { count: i.noMethodCount, amount: fromCents(i.noMethodCents) },
    expensesCash: fromCents(i.expensesCashCents),
    investmentsCash: fromCents(invC),
    handedOver: fromCents(i.handedOverCents),
    inCashBox: fromCents(inBoxC),
    handedOverPct: base > 0 ? Math.round((i.handedOverCents / base) * 100) : 0,
    balanced: diffC === 0,
    difference: fromCents(diffC),
  };
}
