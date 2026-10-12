// Rakordimi i arkës fizike të Shkollimit me Pasqyrën e vitit — VETËM LEXIM.
// Përdorimi:
//   DATABASE_URL="file:./prod-copy.db" npx tsx scripts/arka-rakordim.ts 2026 [YYYY-MM-DD:numëruar€]
// p.sh. ... 2026 2026-10-09:1090  → gjendja fizike nga 1 shtatori (gjendja fillestare 0,
// ose shuma e dhënë si numërim) dhe krahasimi me numërimin.
import { PrismaClient } from "@prisma/client";
import { loadShkollimiMovements, physicalBalance, reconcileYearView, ayWindow, type LedgerMovement } from "../src/lib/cashLedger";

const eur = (c: number) => (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const dmy = (d: string) => d.split("-").reverse().join(".");

async function main() {
  const ay = parseInt(process.argv[2] ?? "2026");
  const count = process.argv[3]?.split(":");
  const db = new PrismaClient();
  const movs = await loadShkollimiMovements(db);
  const r = reconcileYearView(movs, ay);
  const sum = (a: LedgerMovement[]) => a.reduce((s, m) => s + m.boxCents, 0);

  console.log(`\n═══ Rakordimi ${ay}–${ay + 1} ═══`);
  console.log(`"Në arkë" sipas Pasqyrës së vitit:            ${eur(r.yearViewCents)}`);
  console.log(`− i caktohen vitit, por lëvizën jashtë tij:     ${eur(sum(r.attributedOutsideWindow))}`);
  for (const m of r.attributedOutsideWindow) console.log(`     ${dmy(m.day)} ${m.source} #${m.id} ${m.label} ${eur(m.boxCents)}`);
  console.log(`+ lëvizën brenda vitit, por për vit tjetër:     ${eur(sum(r.inWindowOtherYear))}`);
  for (const m of r.inWindowOtherYear) console.log(`     ${dmy(m.day)} ${m.source} #${m.id} ${m.label} ${eur(m.boxCents)} (viti ${m.attributedAY ?? "—"}${m.inYearView ? "" : ", jashtë Pasqyrës"})`);
  console.log(`= Ndryshimi i arkës fizike brenda vitit:        ${eur(r.physicalWindowCents)}  (identiteti ${r.identityHolds ? "✔" : "✘"})`);

  const w = ayWindow(ay);
  const upTo = count?.[0] ?? w.to;
  const opening = { day: (() => { const d = new Date(`${w.from}T12:00:00Z`); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })(), cents: 0, recordedAt: Date.now() }; // rindërtim: gjithçka para 1 shtatorit = pjesë e gjendjes fillestare
  const pb = physicalBalance(movs, opening, upTo);
  console.log(`\nArka fizike nga ${dmy(w.from)} (gjendja fillestare 0) deri ${dmy(upTo)}: hyrje ${eur(pb.inCents)} · dalje ${eur(pb.outCents)} · gjendja ${eur(pb.closingCents)} · banka ${eur(pb.bankDeltaCents)}`);
  if (count) {
    const counted = Math.round(parseFloat(count[1].replace(",", ".")) * 100);
    console.log(`Numëruar ${dmy(count[0])}: ${eur(counted)} → diferenca ${eur(counted - pb.closingCents)} (pa gjendjen e 31 gushtit)`);
  }
  const flagged = movs.filter(m => m.flags?.length && m.day >= w.from && m.day <= w.to);
  if (flagged.length) console.log(`\nLëvizje me shënime (${flagged.length}): ${[...new Set(flagged.flatMap(m => m.flags ?? []))].join(", ")}`);
  await db.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
