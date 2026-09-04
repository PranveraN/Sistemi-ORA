// Mbjell kategoritë dhe lëndët parazgjedhje për Modulin e Materialeve Didaktike.
// I sigurt të ekzekutohet disa herë (kontrollon çka ekziston para se të krijojë).
//
// Përdorim:
//   npx tsx scripts/seed-material-categories.ts

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

const CATEGORIES = [
  "Materiale shkrimi",
  "Letër dhe printim",
  "Art dhe kreativitet",
  "Matematikë",
  "Shkencë",
  "Materiale didaktike",
  "Materiale për klasë",
  "Teknologji",
  "Edukatë fizike",
  "Materiale për aktivitete",
  "Të tjera",
];

// Kuruar nga Staff.lenda — vetëm lëndët reale mësimore, jo rolet e stafit
// (Drejtor, Sekretare, Asistente, Kuzhinjiere, Mirëmbajtëse, Koordinatore,
// Pedagoge, Psikologji janë role, jo lëndë, ndaj s'përfshihen këtu).
// Administrata mund ta plotësojë/ndryshojë listën më vonë (Faza 2 — Katalogu).
const SUBJECTS = [
  "Artit Figurativ",
  "Biologji/Kimi",
  "Ed. Qytetare",
  "Edukatë Fizike",
  "Fizikë",
  "Gjeografi",
  "Gjermanisht",
  "Gjuhë Angleze",
  "Gjuhë Shqipe",
  "IT",
  "Informatikë",
  "M Klasore I-V",
  "Matematikë",
  "Muzikë",
  "Spiking",
];

async function main() {
  const orgId = 1;

  let catCreated = 0;
  for (const name of CATEGORIES) {
    const existing = await prisma.materialCategory.findFirst({ where: { organizationId: orgId, name } });
    if (!existing) {
      await prisma.materialCategory.create({ data: { name, organizationId: orgId } });
      catCreated++;
    }
  }
  console.log(`✅ Kategori: ${catCreated} të reja, ${CATEGORIES.length - catCreated} ekzistonin tashmë.`);

  let subCreated = 0;
  for (const name of SUBJECTS) {
    const existing = await prisma.subject.findFirst({ where: { organizationId: orgId, name } });
    if (!existing) {
      await prisma.subject.create({ data: { name, organizationId: orgId } });
      subCreated++;
    }
  }
  console.log(`✅ Lëndë: ${subCreated} të reja, ${SUBJECTS.length - subCreated} ekzistonin tashmë.`);
}

main().finally(() => prisma.$disconnect());
