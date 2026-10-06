// Teste për fushën "Shto artikull" — ekzekuto: npx tsx src/lib/teacherItemInput.test.ts
import assert from "node:assert/strict";
import { parseItemInput, rankCatalog, isStrongMatch } from "./teacherItemInput";
import type { CatalogEntry } from "./materialMatcher";

// Leximi i sasisë/njësisë (kriteret e pranimit)
assert.deepEqual(parseItemInput("Markera te zi 3 cuti"), { name: "Markera te zi", qty: 3, unit: "kuti" });
assert.deepEqual(parseItemInput("Leter A4 300 gr"), { name: "Leter A4 300 gr", qty: 1, unit: null });
assert.deepEqual(parseItemInput("Letër A4"), { name: "Letër A4", qty: 1, unit: null });
assert.deepEqual(parseItemInput("Kartonë 5 pako"), { name: "Kartonë", qty: 5, unit: "pako" });
assert.deepEqual(parseItemInput("Shirit ngjitës 2 rrotulla"), { name: "Shirit ngjitës", qty: 2, unit: "rrotull" });
assert.deepEqual(parseItemInput("Gërshërë 10"), { name: "Gërshërë", qty: 10, unit: null });
assert.deepEqual(parseItemInput("3 markera"), { name: "markera", qty: 3, unit: null });
assert.deepEqual(parseItemInput("Ngjyra uji 250 ml"), { name: "Ngjyra uji 250 ml", qty: 1, unit: null });
assert.deepEqual(parseItemInput("Fije 20 cm"), { name: "Fije 20 cm", qty: 1, unit: null });

// Sugjerimet — katalogu si ai real (emra me ë/ç, njëjës/shumës, sinonime)
const CAT: CatalogEntry[] = [
  { id: 1, name: "Marker permanent i zi", unit: "copë" },
  { id: 2, name: "Markera me ngjyra", unit: "copë" },
  { id: 3, name: "Marker whiteboard", unit: "copë", aliases: ["marker për tabelë"] },
  { id: 4, name: "Kuti arkivi", unit: "copë" },
  { id: 5, name: "Letër A4 80g", unit: "paketë" },
  { id: 6, name: "Gërshërë për fëmijë", unit: "copë" },
  { id: 7, name: "Ngjitës stick", unit: "copë" },
];
const names = (q: string) => rankCatalog(q, CAT).map(r => r.entry.name);

const zi = rankCatalog(parseItemInput("Markera te zi 3 cuti").name, CAT);
assert.equal(zi[0].entry.name, "Marker permanent i zi");
assert.ok(isStrongMatch(zi[0]), "Enter e zgjedh vetë");
assert.ok(!names("markera").includes("Kuti arkivi"), "s'sugjerohet 'Kuti arkivi' për 'markera'");
assert.ok(names("markera").includes("Markera me ngjyra"));
assert.equal(names("marker per tabele")[0], "Marker whiteboard", "sinonimi shqip");
assert.equal(names("gershere")[0], "Gërshërë për fëmijë", "pa ë");
assert.equal(names("GËRSH")[0], "Gërshërë për fëmijë", "fillimi i emrit, shkronja të mëdha");
assert.equal(rankCatalog("Plastifikues per laminator", CAT).length, 0, "jo në katalog");
assert.ok(!isStrongMatch(rankCatalog("Leter A4 300 gr", CAT)[0]), "300 gr s'përputhet fort me 80g");

console.log("✓ teacherItemInput: të gjitha testet kaluan");
