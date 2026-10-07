// Teste për "Ku janë paratë e paguara" — ekzekuto: npx tsx src/lib/cashFlow.test.ts
import assert from "node:assert/strict";
import { computeCashFlow, toCents, paymentChannel, type CashFlowInput } from "./cashFlow";

const base: CashFlowInput = {
  cashCents: toCents(127851), bankCents: toCents(90000), noMethodCents: 0, noMethodCount: 0,
  expensesCashCents: toCents(4097.48), handedOverCents: toCents(110240),
};
const f0 = computeCashFlow(base);
// Shembulli i imazhit
assert.equal(f0.paid, 217851);
assert.equal(f0.inCashBox, 13513.52);
assert.equal(f0.handedOverPct, 89);
assert.ok(f0.balanced);

// Pagesë 50 € me Bankë: rritet Paguar dhe Në bankë, Në arkë s'ndryshon
const f1 = computeCashFlow({ ...base, bankCents: base.bankCents + 5000 });
assert.equal(f1.paid, f0.paid + 50);
assert.equal(f1.bank, f0.bank + 50);
assert.equal(f1.inCashBox, f0.inCashBox);

// Pagesë 50 € Cash: Në arkë +50
assert.equal(computeCashFlow({ ...base, cashCents: base.cashCents + 5000 }).inCashBox, f0.inCashBox + 50);

// Dorëzim 1.000 €: Në arkë −1.000, Dorëzuar +1.000
const f3 = computeCashFlow({ ...base, handedOverCents: base.handedOverCents + 100000 });
assert.equal(f3.inCashBox, Math.round((f0.inCashBox - 1000) * 100) / 100);
assert.equal(f3.handedOver, f0.handedOver + 1000);

// Shpenzim 20 € nga arka: Në arkë −20 (nga banka: s'futet fare këtu)
assert.equal(computeCashFlow({ ...base, expensesCashCents: base.expensesCashCents + 2000 }).inCashBox, Math.round((f0.inCashBox - 20) * 100) / 100);

// Pagesa pa metodë → bilanci s'përputhet, diferenca = shuma e tyre
const f5 = computeCashFlow({ ...base, noMethodCents: 12345, noMethodCount: 2 });
assert.ok(!f5.balanced);
assert.equal(f5.difference, 123.45);

// Të hyrat tjera cash: rrisin arkën dhe totalin, bilanci përputhet
const f6 = computeCashFlow({ ...base, otherCashCents: 25000 });
assert.equal(f6.inCashBox, Math.round((f0.inCashBox + 250) * 100) / 100);
assert.equal(f6.total, f0.paid + 250);
assert.equal(f6.paid, f0.paid, "Paguar = vetëm pagesat e nxënësve");
assert.ok(f6.balanced);

// Investim 300 € me cash: Në arkë −300, bilanci përputhet (me bankë s'futet këtu)
const f7 = computeCashFlow({ ...base, investmentsCashCents: 30000 });
assert.equal(f7.inCashBox, Math.round((f0.inCashBox - 300) * 100) / 100);
assert.equal(f7.investmentsCash, 300);
assert.ok(f7.balanced);

// Rrumbullakimi: 0,1 + 0,2 në cent
assert.ok(computeCashFlow({ cashCents: toCents(0.1) + toCents(0.2), bankCents: 0, noMethodCents: 0, noMethodCount: 0, expensesCashCents: 0, handedOverCents: toCents(0.3) }).inCashBox === 0);

assert.equal(paymentChannel("CASH"), "cash");
assert.equal(paymentChannel("CARD"), "banke");
assert.equal(paymentChannel(null), null);

console.log("✓ cashFlow: të gjitha testet kaluan");
