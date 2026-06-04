import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const staffData = [
  // MENAXHMENT
  { emri: "Valon Hoxha", lenda: "Drejtor", telefoni: null, nrPersonal: null, nrLlogarise: null, banka: "BKT", totalBruto: 1700, kontrata: "Po", kodi: "EM00000422", tipi: "Menaxhment" },
  { emri: "Ardita Kahrimani", lenda: "Drejtoreshe", telefoni: null, nrPersonal: null, nrLlogarise: null, banka: "RAIFFEISEN", totalBruto: 900, kontrata: "Po", kodi: "EM00000406", tipi: "Menaxhment" },
  { emri: "Ardita Prekazi Bashota", lenda: "Pedagoge", telefoni: null, nrPersonal: null, nrLlogarise: null, banka: "Pro Credit Bank", totalBruto: 950, kontrata: "Po", kodi: "EM00000405", tipi: "Menaxhment" },
  { emri: "Mrika Dema", lenda: "Koordinatore", telefoni: null, nrPersonal: null, nrLlogarise: null, banka: "BKT", totalBruto: 920, kontrata: "Po", kodi: "EM00000415", tipi: "Menaxhment" },

  // STAFI MËSIMDHËNËS
  { emri: "Alban Hoxha", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Albesa Drushtini", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Albona Kabashi", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Albulena Ajeti", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Albulena Mustafa", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Altin Etemi", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Artesa Gashi", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Bardha Ajeti", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Beyza Kera", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Bleranda Mustafa", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Brahim Mustafa", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Dua Rekathati", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Erisa Maloku", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Fahri Avdija", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Hamide Kahrimani", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Kelly Mujku", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Kushtrim Ajeti", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Lina Azemi", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Luljeta Gashi", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Merisa Berisha", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Nazlije Maliçi Xhelili", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Përparim Blakaj", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Përparim Ramadani", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Pranvera Nevzadi", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Samire Shoshka", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Saranda Lahu Karaqa", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Shkendije Gerguri", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Shkurte Maxhuni", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Shqipe Gashi", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Shukrije Shala", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Teuta Hoxha", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Valentina Hoxhaxhiku", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
  { emri: "Yllka Hajrizi", lenda: null, telefoni: null, nrPersonal: null, nrLlogarise: null, banka: null, totalBruto: null, kontrata: null, kodi: null, tipi: "Primar" },
];

async function main() {
  console.log("Seeding staff...");

  // Skip if already seeded
  const count = await prisma.staff.count();
  if (count > 0) {
    console.log(`Staff already seeded (${count} records). Skipping.`);
    return;
  }

  for (const s of staffData) {
    await prisma.staff.create({ data: s });
    console.log(`  + ${s.emri}`);
  }

  console.log(`Done. ${staffData.length} staff members added.`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
