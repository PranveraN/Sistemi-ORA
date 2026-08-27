// Korrigjon pagesat e "vjetërsuara" nga bug-u i vitit akademik të parazgjedhur
// (shih scripts/find-mistagged-payments.ts për shpjegimin e plotë të bug-ut).
//
// Pa --apply: VETËM LEXIM, tregon çfarë do të ndryshohej (dry-run, i sigurt).
// Me --apply: aplikon ndryshimet realisht — ndryshon VETËM fushën `year`,
// asgjë tjetër (shuma, statusi, muaji, etj. mbeten identike).
//
// Përdorim (në server, brenda kontejnerit):
//   docker compose exec app npx tsx scripts/fix-mistagged-payments.ts               # dry-run
//   docker compose exec app npx tsx scripts/fix-mistagged-payments.ts --apply        # aplikon
//   docker compose exec app npx tsx scripts/fix-mistagged-payments.ts --apply 2026-06-01  # prag tjetër i datës

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const CATEGORY_NAMES = ["Shkollimi", "Platforma Digjitale", "Ushqimi"];

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const sinceArg = args.find(a => a !== "--apply");

  const since = sinceArg ? new Date(sinceArg) : (() => {
    const now = new Date();
    const augustFirstThisYear = new Date(now.getFullYear(), 7, 1); // 1 Gusht
    return now < augustFirstThisYear
      ? new Date(now.getFullYear() - 1, 7, 1)
      : augustFirstThisYear;
  })();

  console.log(`Mode: ${apply ? "APLIKO (do të ndryshojë të dhëna)" : "DRY-RUN (vetëm lexim)"}`);
  console.log(`Kërkoj pagesa të krijuara që nga: ${since.toISOString().slice(0, 10)}\n`);

  const categories = await prisma.paymentCategory.findMany({
    where: { name: { in: CATEGORY_NAMES } },
  });
  if (!categories.length) {
    console.log("Asnjë nga kategoritë e pritura nuk u gjet:", CATEGORY_NAMES.join(", "));
    return;
  }

  const suspicious = await prisma.payment.findMany({
    where: { categoryId: { in: categories.map(c => c.id) }, createdAt: { gte: since } },
    include: {
      student: { select: { firstName: true, lastName: true } },
      category: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();
  const expectedAcademicStart = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;

  const flagged = suspicious
    .filter(p => p.year != null)
    .map(p => {
      // Muajt 1-7 (Janar-Korrik) i takojnë gjysmës së dytë të vitit akademik
      // (viti kalendarik = fillimi i vitit akademik + 1); muajt 8-12 (ose pa muaj,
      // p.sh. Eshkollori) i takojnë gjysmës së parë (viti kalendarik = fillimi).
      const expectedYear = (p.month != null && p.month <= 7)
        ? expectedAcademicStart + 1
        : expectedAcademicStart;
      return { p, expectedYear };
    })
    .filter(({ p, expectedYear }) => p.year !== expectedYear);

  if (!flagged.length) {
    console.log("✓ Asnjë pagesë e dyshimtë nuk u gjet — asgjë për t'u korrigjuar.");
    return;
  }

  console.log(`⚠ U gjetën ${flagged.length} pagesë(a) për korrigjim:\n`);
  console.log(
    "id".padEnd(6) + "nxënësi".padEnd(28) + "kategoria".padEnd(20) +
    "muaji".padEnd(7) + "vit i vjetër → i ri".padEnd(22) + "shuma"
  );
  for (const { p, expectedYear } of flagged) {
    const name = `${p.student.firstName} ${p.student.lastName}`;
    console.log(
      String(p.id).padEnd(6) +
      name.padEnd(28) +
      p.category.name.padEnd(20) +
      String(p.month ?? "—").padEnd(7) +
      `${p.year} → ${expectedYear}`.padEnd(22) +
      p.finalAmount.toFixed(2)
    );
  }

  if (!apply) {
    console.log(
      "\nAsnjë ndryshim s'u bë (dry-run). Rishikoji rreshtat më sipër, pastaj " +
      "rifute komandën me flamurin --apply për t'i korrigjuar realisht."
    );
    return;
  }

  console.log("\nDuke aplikuar ndryshimet...");
  let updated = 0;
  for (const { p, expectedYear } of flagged) {
    await prisma.payment.update({ where: { id: p.id }, data: { year: expectedYear } });
    updated++;
  }
  console.log(`✅ U korrigjuan ${updated} pagesë(a). Asnjë fushë tjetër (shuma, statusi, muaji) nuk u prek.`);
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
