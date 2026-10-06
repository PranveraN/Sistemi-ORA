// Teste për rregullat e Eshkollorit — ekzekuto: npx tsx src/lib/feeLedger.test.ts
import assert from "node:assert/strict";
import { activeExemption, yearFee, feeStatus, summarize, type LedgerRow } from "./feeLedger";

// Shuma dhe lirimi
assert.deepEqual(yearFee(20, null), { expected: 20, exempted: 0 });
assert.deepEqual(yearFee(20, { type: "FULL", percent: null }), { expected: 0, exempted: 20 });
assert.deepEqual(yearFee(20, { type: "PARTIAL", percent: 50 }), { expected: 10, exempted: 10 });
assert.deepEqual(yearFee(15, { type: "PARTIAL", percent: 33 }), { expected: 10.05, exempted: 4.95 });

// Periudha e lirimit
const ex = [
  { type: "FULL", percent: null, fromYear: 2026, untilYear: 2026, cancelledAt: null },
];
assert.ok(activeExemption(ex, 2026));
assert.equal(activeExemption(ex, 2027), null, "Vetëm 2026–2027");
assert.ok(activeExemption([{ ...ex[0], untilYear: null }], 2030), "Deri sa ta ndryshoj");
assert.equal(activeExemption([{ ...ex[0], cancelledAt: new Date() }], 2026), null, "i anuluar");

// Statusi: pagesë e pjesshme mbetet "Pa paguar"
assert.equal(feeStatus(20, 10, false), "UNPAID");
assert.equal(feeStatus(20, 20, false), "PAID");
assert.equal(feeStatus(0, 0, true), "FREE");

// Kriteri: 0 € paguar + 40 € borxh i vjetër → te "Pa paguar" DHE "Me borxh të vjetër"; borxhet s'mblidhen
const rows: LedgerRow[] = [
  { expected: 20, paid: 20, exempted: 0, status: "PAID", oldDebt: 0 },
  { expected: 20, paid: 0, exempted: 0, status: "UNPAID", oldDebt: 40 },
  { expected: 20, paid: 5, exempted: 0, status: "UNPAID", oldDebt: 0 },
];
const s = summarize(rows);
assert.deepEqual(s.groups, { all: 3, paid: 1, unpaid: 2, old: 1, free: 0 });
assert.equal(s.yearDebt, 35);
assert.equal(s.oldDebt, 40);
assert.equal(s.income, 25);
assert.equal(s.paidCount, 2);

// Kriteri: "Falas plotësisht" e heq nga "Pa paguar", e shton te "Falas", ul borxhin e vitit me 20 €
const f = yearFee(20, { type: "FULL", percent: null });
const after = summarize([rows[0], { expected: f.expected, paid: 0, exempted: f.exempted, status: feeStatus(f.expected, 0, true), oldDebt: 40 }, rows[2]]);
assert.equal(after.groups.unpaid, 1);
assert.equal(after.groups.free, 1);
assert.equal(after.yearDebt, s.yearDebt - 20);
assert.equal(after.exempted, 20);
assert.equal(after.oldDebt, 40, "borxhi i vjetër mbetet");

console.log("✓ feeLedger: të gjitha testet kaluan");
