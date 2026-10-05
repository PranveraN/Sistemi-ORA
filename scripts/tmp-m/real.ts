import { prisma } from "../../src/lib/prisma";
import { buildIndex, matchText } from "../../src/lib/materialMatcher";
(async () => {
  const mats = await prisma.material.findMany({ where: { active: true }, select: { id: true, name: true, defaultUnit: true } });
  const idx = buildIndex(mats.map(m => ({ id: m.id, name: m.name, unit: m.defaultUnit })));
  const texts = [
    "10 markera për tabelë, 2 pako letër A4 dhe ngjyra uji për klasën 3A. Na duhen për projektin e artit javën tjetër.",
    "markerat e tabeles 5 cope dhe nje kuti shkumësa",
    "shirit dekorativ me shkelqim",
    "20 gersheret per femije, ngjites stick 10 cope",
  ];
  const t0 = Date.now();
  for (const t of texts) {
    console.log("\n» " + t);
    for (const m of matchText(t, idx)) {
      const s = m.segment;
      if (s.ignored) { console.log(`   [injoruar: ${s.ignored}] "${s.raw.trim()}"`); continue; }
      console.log(`   "${s.core}" ×${s.quantity}${s.unit ? " " + s.unit : ""} → ${m.item ? `${m.item.name} (${m.matchType} ${m.score.toFixed(2)})` : "PA PËRPUTHJE"}${m.alternatives.length ? " | alt: " + m.alternatives.map(a => `${a.item.name} ${a.score}`).join("; ") : ""}`);
    }
  }
  console.log(`\nkoha për ${texts.length} tekste mbi ${mats.length} artikuj: ${Date.now() - t0} ms`);
  await prisma.$disconnect();
})();
