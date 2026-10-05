// Teste për rrjedhën e statuseve të kërkesave — ekzekuto: npx tsx src/lib/materialRequestStatus.test.ts
import assert from "node:assert/strict";
import { deriveRequestStatus, type DeriveItem } from "./materialRequestStatus";
import { isPartialRequest, stageOf } from "./materialConstants";

const it = (p: Partial<DeriveItem>): DeriveItem => ({ status: "APPROVED", quantity: 10, approvedQuantity: 10, orderedQuantity: 0, deliveredQuantity: 0, ...p });

// Pa vendim
assert.equal(deriveRequestStatus("SUBMITTED", [it({ status: "PENDING", approvedQuantity: null })]), "SUBMITTED");
assert.equal(deriveRequestStatus("UNDER_REVIEW", [it({ status: "PENDING", approvedQuantity: null })]), "UNDER_REVIEW");
assert.equal(deriveRequestStatus("SUBMITTED", [it({}), it({ status: "PENDING", approvedQuantity: null })]), "UNDER_REVIEW");

// Vendimi
assert.equal(deriveRequestStatus("UNDER_REVIEW", [it({}), it({})]), "APPROVED");
assert.equal(deriveRequestStatus("UNDER_REVIEW", [it({}), it({ status: "REJECTED", approvedQuantity: null })]), "PARTIALLY_APPROVED");
assert.equal(deriveRequestStatus("UNDER_REVIEW", [it({ approvedQuantity: 6 })]), "PARTIALLY_APPROVED");
assert.equal(deriveRequestStatus("UNDER_REVIEW", [it({ status: "REJECTED", approvedQuantity: null })]), "REJECTED");

// Porosia dhe dorëzimi
assert.equal(deriveRequestStatus("APPROVED", [it({ orderedQuantity: 10 })]), "ORDERED");
assert.equal(deriveRequestStatus("APPROVED", [it({ orderedQuantity: 4 }), it({})]), "ORDERED");
assert.equal(deriveRequestStatus("ORDERED", [it({ orderedQuantity: 10, deliveredQuantity: 3 })]), "DELIVERED");
// Porosia u anulua → kthehet te aprovimi
assert.equal(deriveRequestStatus("ORDERED", [it({ approvedQuantity: 6 })]), "PARTIALLY_APPROVED");

// Etiketa "Pjesërisht"
assert.equal(isPartialRequest("PARTIALLY_APPROVED", []), true);
assert.equal(isPartialRequest("APPROVED", [it({})]), false);
assert.equal(isPartialRequest("ORDERED", [it({}), it({ status: "REJECTED", approvedQuantity: null })]), true);
assert.equal(isPartialRequest("DELIVERED", [it({ deliveredQuantity: 10 })]), false);
assert.equal(isPartialRequest("DELIVERED", [it({ deliveredQuantity: 3 })]), true);
assert.equal(isPartialRequest("REJECTED", [it({ status: "REJECTED" })]), false);

// Kartat
assert.equal(stageOf("PARTIALLY_APPROVED"), "APPROVED");
assert.equal(stageOf("ORDERED"), "ORDERED");

console.log("✓ materialRequestStatus: të gjitha testet kaluan");
