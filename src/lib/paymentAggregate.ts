export interface AggregatableInstallment {
  finalAmount: number;
  paidAmount: number;
  description: string | null;
}

// Mbledh një grup rekordesh Payment (të së njëjtit student+kategori) në një
// total të saktë final/paguar/borxh. E VETMJA logjikë që di të trajtojë
// saktë modelin "Këste Fleksibël" (FLEX_HEADER + FLEX_PAY_N): FLEX_HEADER
// mban VETËM totalin e vërtetë të planit (finalAmount), ndërsa çdo FLEX_PAY_N
// tjetër ka finalAmount = paidAmount i vet (asnjë borxh individual) — nëse
// mblidhen krahas njëri-tjetrit si rekorde "të barabarta" (siç bëhej për
// KESTI_1/KESTI_2, MUAJI_1..10), totali del i fryrë (header + çdo pagesë =
// shumëfishim). Përdoret KUDO që llogaritet një total nga disa rekorde
// pagesash (tabela Shkollimi, Lista e Nxënësve, Profili, Raportet, Familjet)
// që asnjë vend të mos "harrojë" ta trajtojë ndryshe dhe të rikrijojë defektin.
export function aggregatePaymentTotals(payments: AggregatableInstallment[]): {
  finalAmount: number;
  paidAmount: number;
  balance: number;
} {
  if (payments.length === 0) return { finalAmount: 0, paidAmount: 0, balance: 0 };

  const header = payments.find(p => p.description === "FLEX_HEADER");
  const finalAmount = header
    ? header.finalAmount
    : payments.reduce((s, p) => s + p.finalAmount, 0);
  const paidAmount = payments.reduce((s, p) => s + p.paidAmount, 0);
  const balance = Math.max(0, finalAmount - paidAmount);
  return { finalAmount, paidAmount, balance };
}
