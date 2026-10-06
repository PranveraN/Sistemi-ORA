// Teste për tekstet e porosisë — ekzekuto: npx tsx src/lib/supplierOrderText.test.ts
import assert from "node:assert/strict";
import { buildSmsText, buildEmailHtml, countSms, toSmsSafe, emailSubject, EMAIL_INTRO, emailClosing, qtyLabel } from "./supplierOrderText";

const ctx = { school: "Akademia Ora", schoolPhone: "+383 44 000 000", date: new Date(2026, 9, 6), adminName: "Pranvera" };
const lines = [
  { name: "Llastik", quantity: 3, unit: "copë" },
  { name: "Bojë akrilike", quantity: 1, unit: "copë" },
  { name: "Markera ngjyrë të zezë", quantity: 1, unit: "pako" },
  { name: "Çantë", quantity: 2, unit: null },
];

const sms = buildSmsText(lines, ctx);
assert.ok(!/[ëËçÇ]/.test(sms), "SMS pa ë/ç");
assert.equal(sms.split("\n")[0], "Porosi nga Akademia Ora - 06.10.2026");
assert.equal(sms.split("\n")[1], "1. Llastik - 3");
assert.equal(sms.split("\n")[3], "3. Markera ngjyre te zeze - 1 pako");
assert.equal(sms.split("\n")[4], "4. Cante - 2");
assert.ok(sms.endsWith("Ju lutem konfirmoni. Tel: +383 44 000 000"));
assert.equal(countSms(sms).unicode, false);

const html = buildEmailHtml(lines, EMAIL_INTRO, emailClosing(ctx));
assert.ok(html.includes("Bojë akrilike") && html.includes("Përshëndetje"), "email me ë/ç normale");
assert.ok(html.includes("1 pako"));
assert.equal(emailSubject(ctx), "Porosi materialesh – Akademia Ora – 06.10.2026");
assert.ok(buildEmailHtml([{ name: "<b>x</b>", quantity: 1, unit: null }], "a", "b").includes("&lt;b&gt;"), "escape");

// Numërimi i SMS-ve
assert.deepEqual(countSms("a".repeat(160)), { chars: 160, segments: 1, unicode: false, perSegment: 160 });
assert.equal(countSms("a".repeat(161)).segments, 2);
assert.equal(countSms("ë").unicode, true);
assert.equal(countSms(toSmsSafe("ë – „x”")).unicode, false);
assert.equal(countSms("€").chars, 2);
assert.equal(qtyLabel({ name: "x", quantity: 4, unit: "kuti" }), "4 kuti");

console.log("✓ supplierOrderText: të gjitha testet kaluan");
