import { prisma } from "../../src/lib/prisma";
(async () => {
  console.log("kërkesa", await prisma.materialRequest.count(), "artikuj", await prisma.materialRequestItem.count(), "custom", await prisma.materialRequestItem.count({ where: { isCustom: true } }), "materiale aktive", await prisma.material.count({ where: { active: true } }), "kategori aktive", await prisma.materialCategory.count({ where: { active: true } }), "porosi", await prisma.materialOrder.count());
  console.log(await prisma.materialRequestItem.findMany({ where: { isCustom: true }, select: { customItemName: true, quantity: true, unit: true }, take: 20 }));
  console.log((await prisma.materialRequest.findMany({ select: { reason: true, comment: true }, take: 10 })));
  await prisma.$disconnect();
})();
