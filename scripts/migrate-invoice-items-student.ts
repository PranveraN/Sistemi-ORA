// Plotëson InvoiceItem.studentId = Invoice.studentId për çdo zë ekzistues pa
// nxënës të caktuar — që çdo faturë (e vjetër apo e re) të trajtohet njësoj
// pasi çdo zë tani mund t'i përkasë një fëmije specifik të prindit.
//
// I sigurt të riekzekutohet: prek vetëm rreshtat me studentId ende bosh.
//
// Përdorim:
//   npx tsx scripts/migrate-invoice-items-student.ts

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const items = await prisma.invoiceItem.findMany({
    where: { studentId: null },
    include: { invoice: { select: { studentId: true } } },
  });

  console.log(`Gjetur ${items.length} zëra pa nxënës të caktuar.`);
  if (!items.length) {
    console.log("Asgjë për të migruar — çdo zë ka tashmë studentId.");
    return;
  }

  let updated = 0;
  for (const item of items) {
    await prisma.invoiceItem.update({
      where: { id: item.id },
      data: { studentId: item.invoice.studentId },
    });
    updated++;
  }

  console.log(`✅ Përditësuar ${updated} zëra.`);

  const remaining = await prisma.invoiceItem.count({ where: { studentId: null } });
  if (remaining > 0) {
    throw new Error(`❌ VERIFIKIMI DËSHTOI: ${remaining} zëra ende pa studentId.`);
  }
  console.log("✅ Verifikimi kaloi: çdo InvoiceItem ka tani studentId.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
