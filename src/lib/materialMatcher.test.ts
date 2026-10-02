// Teste për motorin e përputhjes — ekzekuto: npx tsx src/lib/materialMatcher.test.ts
import assert from "node:assert/strict";
import { buildIndex, matchText, splitSegments, normalizeText, stem, normalizeKey, cleanItemName, type CatalogEntry } from "./materialMatcher";

const CATALOG: CatalogEntry[] = [
  { id: 1, name: "Marker whiteboard", unit: "copë", aliases: ["markera për tabelë", "marker tabele"] },
  { id: 2, name: "Marker permanent i zi", unit: "copë" },
  { id: 3, name: "Letër A4 80g", unit: "copë", aliases: ["letër A4"] },
  { id: 4, name: "Ngjyra uji", unit: "copë" },
  { id: 5, name: "Shkumës i bardhë", unit: "copë" },
  { id: 6, name: "Shirit dekorativ", unit: "copë" },
  { id: 7, name: "Bojë për gishta", unit: "copë" },
  { id: 8, name: "Gërshërë për fëmijë", unit: "copë" },
  { id: 9, name: "Ngjitës stick", unit: "copë" },
  { id: 10, name: "Karton me ngjyra", unit: "copë" },
];
const idx = buildIndex(CATALOG);

let passed = 0;
function test(name: string, fn: () => void) {
  try { fn(); passed++; console.log("  ✓", name); }
  catch (e) { console.log("  ✗", name); throw e; }
}
const found = (text: string) => matchText(text, idx).filter(m => !m.segment.ignored);

console.log("Normalizimi");
test("ë/ç dhe shkronja të vogla", () => assert.equal(normalizeText("Shkumës Çantë"), "shkumes cante"));
test("mbaresat: markera/markerat/marker → e njëjta rrënjë", () => {
  assert.equal(stem("markera"), stem("marker"));
  assert.equal(stem("markerat"), stem("marker"));
});
test("normalizeKey heq fjalët lidhëse", () => assert.equal(normalizeKey("Markera për tabelë"), normalizeKey("marker tabele")));

console.log("Ndarja, sasia, njësia");
test("shembulli 1: 3 materiale, klasa injorohet", () => {
  const r = found("10 markera për tabelë, 2 pako letër A4 dhe ngjyra uji për klasën 3A");
  assert.equal(r.length, 3);
  assert.deepEqual(r.map(x => x.item?.id), [1, 3, 4]);
  assert.equal(r[0].segment.quantity, 10);
  assert.equal(r[1].segment.quantity, 2);
  assert.equal(r[1].segment.unit, "paketë");
  assert.equal(r[2].segment.quantity, 1);
});
test("shembulli 2: sasia pas emrit + 'një kuti'", () => {
  const r = found("markerat e tabeles 5 cope dhe nje kuti shkumësa");
  assert.equal(r.length, 2);
  assert.equal(r[0].item?.id, 1);
  assert.equal(r[0].segment.quantity, 5);
  assert.equal(r[0].segment.unit, "copë");
  assert.equal(r[1].item?.id, 5);
  assert.equal(r[1].segment.quantity, 1);
  assert.equal(r[1].segment.unit, "kuti");
});
test("shembulli 3: artikull i ri — s'përputhet, por s'injorohet", () => {
  const r = found("shirit dekorativ me shkelqim");
  assert.equal(r.length, 1);
  // ngjashëm me "Shirit dekorativ" por me fjalë shtesë → s'zgjidhet automatikisht, del si alternativë
  assert.equal(r[0].item, null);
  assert.ok(r[0].alternatives.some(a => a.item.id === 6));
});
test("tekst real pa presje: numri i ri fillon artikull të ri; '1 l ose 2 l' është përshkrim", () => {
  const segs = splitSegments("4 shpuza te medha 2 shishe xhami me te medha 1 l ose 2 l 50 shkopinj te gjate dhe gota pllastike").filter(s => !s.ignored);
  assert.deepEqual(segs.map(s => [s.core, s.quantity]), [
    ["shpuza te medha", 4],
    ["shishe xhami me te medha 1 l ose 2 l", 2],
    ["shkopinj te gjate", 50],
    ["gota pllastike", 1],
  ]);
});
test("numri me njësi numërimi pa emër mbetet me artikullin", () => {
  const segs = splitSegments("2 pako lapsa me ngjyra 12 copë").filter(s => !s.ignored);
  assert.equal(segs.length, 1);
  assert.equal(segs[0].quantity, 2);
});
test("fjali qëllimi/kohe injorohen", () => {
  const all = matchText("10 markera. Na duhen për projektin e artit javën tjetër.", idx);
  assert.equal(all.filter(x => !x.segment.ignored).length, 1);
});
test("'për' brenda emrit të produktit s'hiqet", () => {
  const r = found("3 bojë për gishta");
  assert.equal(r[0].item?.id, 7);
  assert.equal(r[0].segment.quantity, 3);
});
test("vetëm klasë/datë/ditë → injorohet", () => {
  for (const t of ["për klasën 3A", "3A", "12.10.2026", "të hënën", "nesër"]) {
    assert.equal(found(t).length, 0, t);
  }
});
test("më pak se 3 shkronja → injorohet", () => assert.equal(found("ab").length, 0));
test("pikat në numra s'ndajnë tekstin", () => assert.equal(splitSegments("2.5 metra shirit dekorativ").filter(s => !s.ignored).length, 1));

console.log("Përputhja");
test("gabim shkrimi (fuzzy)", () => assert.equal(found("gersheret per femije")[0].item?.id, 8));
test("sinonimi (alias)", () => assert.equal(found("marker tabele")[0].matchType, "alias"));
test("emri i saktë (exact)", () => assert.equal(found("Ngjitës stick")[0].matchType, "exact"));
test("pozicioni i theksimit mbulon vetëm emrin", () => {
  const t = "10 markera për tabelë";
  const s = found(t)[0].segment;
  assert.equal(t.slice(s.coreStart, s.coreEnd), "markera për tabelë");
});
test("emri i pastruar i artikullit të ri", () => assert.equal(cleanItemName("  shirit   dekorativ me shkelqim "), "Shirit dekorativ me shkelqim"));

console.log(`\n${passed} teste kaluan.`);
