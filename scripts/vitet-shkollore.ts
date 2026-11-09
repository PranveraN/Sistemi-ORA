// Regjistron vitet shkollore të KALUARA që mungojnë (2017-2018 … viti aktual) te
// Cilësimet → Vitet Shkollore, me datat 01.09 – 31.08, dhe plotëson datat bosh të viteve
// ekzistuese. Vitet e ardhshme (2027-2028 e tutje) i regjistron administrata me dorë.
// - Asgjë s'fshihet, asgjë s'ndryshohet përveç datave BOSH; viti aktiv s'preket.
// - Vitet e kaluara krijohen PA çmime (çmimi i sotëm s'vlen për vitet e vjetra).
// Përdorimi (DRY-RUN si parazgjedhje):
//   DATABASE_URL="file:./test-banka.db" npx tsx scripts/vitet-shkollore.ts
//   DATABASE_URL="file:./test-banka.db" npx tsx scripts/vitet-shkollore.ts --apply
import { PrismaClient } from "@prisma/client";
import { currentSchoolYearStart } from "../src/lib/academicYear";
import { defaultSchoolYearDates } from "../src/lib/schoolYears";

const FIRST_YEAR = 2017;

async function main() {
  const apply = process.argv.includes("--apply");
  const orgId = parseInt(process.env.ORG_ID ?? "1");
  const db = new PrismaClient();
  const existing = await db.schoolYear.findMany({ where: { organizationId: orgId } });
  const byLabel = new Map(existing.map(y => [y.label, y]));
  const last = currentSchoolYearStart();
  const fmt = (d: Date) => d.toISOString().slice(0, 10).split("-").reverse().join(".");

  console.log(`${apply ? "APPLY" : "DRY-RUN"} — org ${orgId}, ${existing.length} vite ekzistuese\n`);
  let created = 0, dated = 0;
  for (let y = FIRST_YEAR; y <= last; y++) {
    const label = `${y}-${y + 1}`;
    const { startDate, endDate } = defaultSchoolYearDates(y);
    if (byLabel.has(label)) continue;
    console.log(`+ krijohet  ${label}  ${fmt(startDate)} – ${fmt(endDate)}  (pa çmime)`);
    if (apply) await db.schoolYear.create({ data: { label, startDate, endDate, active: false, organizationId: orgId } });
    created++;
  }
  for (const y of existing) {
    if (y.startDate && y.endDate) continue;
    const start = parseInt(y.label);
    if (!Number.isFinite(start)) continue;
    const d = defaultSchoolYearDates(start);
    const data = { startDate: y.startDate ?? d.startDate, endDate: y.endDate ?? d.endDate };
    console.log(`~ datat     ${y.label}  ${fmt(data.startDate)} – ${fmt(data.endDate)}${y.active ? "  (aktiv)" : ""}`);
    if (apply) await db.schoolYear.update({ where: { id: y.id }, data });
    dated++;
  }
  console.log(`\n${created} vite për t'u krijuar, ${dated} vite me data për t'u plotësuar.${apply ? " ✔ U ruajt." : " (DRY-RUN — asgjë s'u ruajt; shto --apply)"}`);
  await db.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
