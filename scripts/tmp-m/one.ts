import { prisma } from "../../src/lib/prisma";
import { buildIndex, matchText } from "../../src/lib/materialMatcher";
(async () => {
  const mats = await prisma.material.findMany({ where: { active: true }, select: { id: true, name: true, defaultUnit: true } });
  const idx = buildIndex(mats.map(m => ({ id: m.id, name: m.name, unit: m.defaultUnit })));
  const t = process.argv[2];
  console.log("» " + t);
  for (const m of matchText(t, idx)) {
    const s = m.segment;
    if (s.ignored) { console.log(`   [injoruar: ${s.ignored}] "${s.raw.trim()}"`); continue; }
    console.log(`   "${s.core}" ×${s.quantity}${s.unit ? " " + s.unit : ""} → ${m.item ? `${m.item.name} (${m.matchType} ${m.score.toFixed(2)})` : "PA PËRPUTHJE"}${m.alternatives.length ? " | alt: " + m.alternatives.map(a => `${a.item.name} ${a.score}`).join("; ") : ""}`);
  }
  for (const k of ["shpuz", "sfung", "shish", "xham", "kavanoz", "shkop", "gota", "got", "pllast", "plastik"]) {
    const hits = mats.filter(x => x.name.toLowerCase().includes(k)).slice(0, 5).map(x => x.name);
    if (hits.length) console.log(`   katalogu "${k}": ${hits.join(" | ")}`);
  }
  await prisma.$disconnect();
})();
