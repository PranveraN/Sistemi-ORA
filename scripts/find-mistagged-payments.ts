// VETËM LEXIM — nuk ndryshon asgjë në databazë.
//
// Gjen pagesa (Payment) të krijuara kohët e fundit (parazgjedhje: që nga 1 gusht i
// vitit aktual) por të ruajtura me `year` që i takon vitit akademik të kaluar
// (p.sh. 2025 në vend të 2026) — pikërisht rreshtat që u prekën nga bug-u i
// "vitit akademik të paracaktuar" (fillonte kalimin në Shtator, jo në Gusht).
//
// Përdorim (në server, brenda kontejnerit):
//   docker compose exec app npx tsx scripts/find-mistagged-payments.ts
//
// Opsionale — ndrysho pragun e datës nëse regjistrimet e para për vitin e ri
// filluan më herët/më vonë se 1 gusht:
//   docker compose exec app npx tsx scripts/find-mistagged-payments.ts 2026-07-15

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const CATEGORY_NAMES = ["Shkollimi", "Librat & Shkollorja", "Ushqimi"];

async function main() {
  const sinceArg = process.argv[2];
  const since = sinceArg ? new Date(sinceArg) : (() => {
    const now = new Date();
    const augustFirstThisYear = new Date(now.getFullYear(), 7, 1); // 1 Gusht
    // Nëse jemi para 1 gushtit, supozo 1 gushtin e vitit të kaluar.
    return now < augustFirstThisYear
      ? new Date(now.getFullYear() - 1, 7, 1)
      : augustFirstThisYear;
  })();

  console.log(`Kërkoj pagesa të krijuara që nga: ${since.toISOString().slice(0, 10)}\n`);

  const categories = await prisma.paymentCategory.findMany({
    where: { name: { in: CATEGORY_NAMES } },
  });
  if (!categories.length) {
    console.log("Asnjë nga kategoritë e pritura nuk u gjet:", CATEGORY_NAMES.join(", "));
    return;
  }

  const suspicious = await prisma.payment.findMany({
    where: {
      categoryId: { in: categories.map(c => c.id) },
      createdAt: { gte: since },
      // "vit akademik i kaluar" = viti aktual kalendarik - 1 (p.sh. 2025 kur jemi 2026)
      // për muajt Shtator-Dhjetor, ose viti aktual kalendarik për muajt Janar-Korrik
      // (pjesa e dytë e vitit akademik të kaluar).
    },
    include: {
      student: { select: { firstName: true, lastName: true } },
      category: { select: { name: true } },
    },
    orderBy: { createdAt: "asc" },
  });

  const now = new Date();
  const expectedAcademicStart = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;

  const flagged = suspicious.filter(p => {
    if (p.year == null) return false;
    // Për muajt Shtator-Dhjetor (9-12), viti duhet = expectedAcademicStart.
    // Për muajt Janar-Korrik (1-7), viti duhet = expectedAcademicStart + 1.
    const expectedYearForRow = (p.month != null && p.month <= 7)
      ? expectedAcademicStart + 1
      : expectedAcademicStart;
    return p.year !== expectedYearForRow;
  });

  if (!flagged.length) {
    console.log("✓ Asnjë pagesë e dyshimtë nuk u gjet në periudhën e kontrolluar.");
    return;
  }

  console.log(`⚠ U gjetën ${flagged.length} pagesë(a) të dyshimta:\n`);
  console.log(
    "id".padEnd(6) + "nxënësi".padEnd(28) + "kategoria".padEnd(16) +
    "muaji".padEnd(7) + "viti".padEnd(6) + "shuma".padEnd(9) +
    "paguar".padEnd(9) + "krijuar"
  );
  for (const p of flagged) {
    const name = `${p.student.firstName} ${p.student.lastName}`;
    console.log(
      String(p.id).padEnd(6) +
      name.padEnd(28) +
      p.category.name.padEnd(16) +
      String(p.month ?? "—").padEnd(7) +
      String(p.year ?? "—").padEnd(6) +
      p.finalAmount.toFixed(2).padEnd(9) +
      p.paidAmount.toFixed(2).padEnd(9) +
      p.createdAt.toISOString().slice(0, 16).replace("T", " ")
    );
  }
  console.log(
    "\nKëto rreshta duket se u regjistruan gjatë periudhës së bug-ut, me `year` " +
    "që i takon vitit akademik të kaluar. Rishiko secilin manualisht (p.sh. në " +
    "Prisma Studio) para se ta korrigjosh — asnjë ndryshim s'u bë nga ky skript."
  );
}

main()
  .catch(e => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
