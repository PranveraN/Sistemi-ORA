// Teste për fjalorin e statuseve dhe kohët — ekzekuto: npx tsx src/lib/materialStatusUi.test.ts
import assert from "node:assert/strict";
import { formatDuration, requestStatusUi, orderStatusUi, hasLiveDeadline } from "./materialStatusUi";

const MIN = 60_000, H = 60 * MIN, D = 24 * H;
assert.equal(formatDuration(6 * MIN), "6 min", "jo 0.1 orë");
assert.equal(formatDuration(20_000), "1 min");
assert.equal(formatDuration(5 * H), "5 orë");
assert.equal(formatDuration(47 * H), "47 orë", "nën 2 ditë në orë");
assert.equal(formatDuration(3 * D), "3 ditë");
assert.equal(formatDuration(null), null, "pa të dhëna → —");

// "Dorëzuar" njësoj për kërkesën dhe porosinë
assert.equal(requestStatusUi("DELIVERED").label, "Dorëzuar");
assert.equal(orderStatusUi("RECEIVED").label, "Dorëzuar");
assert.equal(orderStatusUi("RECEIVED").badge, requestStatusUi("DELIVERED").badge);
assert.equal(requestStatusUi("PARTIALLY_APPROVED").label, "Aprovuar");
assert.equal(orderStatusUi("PARTIALLY_RECEIVED").label, "Porositur");

// Afatet vetëm për të hapurat
assert.equal(hasLiveDeadline("DELIVERED"), false);
assert.equal(hasLiveDeadline("REJECTED"), false);
assert.equal(hasLiveDeadline("ORDERED"), true);

console.log("✓ materialStatusUi: të gjitha testet kaluan");
