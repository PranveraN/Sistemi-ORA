export interface TiPricingInput {
  regularPrice: number;
  discountPct: number;
  manualDiscAmt: number;
}

// Çmimi real i rënë dakord me TIMI Invest për një nxënës — përdoret KUDO që
// duhet llogaritur sa pritet nga një nxënës i financuar përmes TIMI Invest
// (ndryshe nga çmimi standard i kategorisë Shkollimi).
export function computeTiExpectedPrice(t: TiPricingInput): number {
  const discAmt = t.regularPrice * (t.discountPct / 100);
  return Math.max(0, t.regularPrice - discAmt - (t.manualDiscAmt || 0));
}
