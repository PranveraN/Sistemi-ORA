import { prisma } from "../../src/lib/prisma";
(async () => {
  const m = await prisma.material.findMany({ where: { active: true }, select: { name: true, defaultUnit: true, category: { select: { name: true } } } });
  const q = ["tabel", "whiteboard", "uji", "akuarel", "bojë", "boj", "temper", "a4 ", "fotokop", "printer", "kopj"];
  for (const k of q) console.log(k.padEnd(7), "→", m.filter(x => x.name.toLowerCase().includes(k)).slice(0, 6).map(x => `${x.name} [${x.defaultUnit}]`).join(" | "));
  console.log("njësitë:", [...new Set(m.map(x => x.defaultUnit))].join(", "));
  await prisma.$disconnect();
})();
