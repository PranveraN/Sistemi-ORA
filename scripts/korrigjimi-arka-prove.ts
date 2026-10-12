// PROVË e korrigjimeve të propozuara — VETËM mbi një KOPJE TË PËRKOHSHME të databazës
// së dhënë (origjinali s'preket kurrë). Aplikon skenarët, rillogarit rakordimin dhe
// arkën fizike, pastaj e fshin kopjen.
//   DATABASE_URL="file:./prod-copy.db" npx tsx scripts/korrigjimi-arka-prove.ts
import fs from "fs";
import os from "os";
import path from "path";
import { PrismaClient } from "@prisma/client";
import { loadShkollimiMovements, physicalBalance, reconcileYearView } from "../src/lib/cashLedger";

const eur = (c: number) => (c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const src = (process.env.DATABASE_URL ?? "").replace(/^file:/, "");
const srcPath = path.isAbsolute(src) ? src : path.join(process.cwd(), "prisma", src);

async function measure(db: PrismaClient, label: string) {
  const movs = await loadShkollimiMovements(db);
  const r26 = reconcileYearView(movs, 2026), r25 = reconcileYearView(movs, 2025), r27 = reconcileYearView(movs, 2027);
  const pb = physicalBalance(movs, { day: "2026-08-31", cents: 0, recordedAt: Date.now() }, "2026-10-08");
  console.log(`${label.padEnd(52)} | Pasqyra 25–26 ${eur(r25.yearViewCents).padStart(12)} | 26–27 ${eur(r26.yearViewCents).padStart(11)} | 27–28 ${eur(r27.yearViewCents).padStart(10)} | arka fizike 01.09–08.10 ${eur(pb.closingCents).padStart(11)}`);
}

async function scenario(name: string, apply: (db: PrismaClient) => Promise<void>) {
  const tmp = path.join(os.tmpdir(), `korrigjim-${process.pid}-${Date.now()}.db`);
  fs.copyFileSync(srcPath, tmp);
  const db = new PrismaClient({ datasources: { db: { url: `file:${tmp.replace(/\\/g, "/")}` } } });
  try { await apply(db); await measure(db, name); } finally { await db.$disconnect(); fs.unlinkSync(tmp); }
}

const fixYear = async (db: PrismaClient): Promise<void> => { await Promise.all([
  db.payment.update({ where: { id: 386 }, data: { year: 2026 } }),
  db.payment.update({ where: { id: 370 }, data: { year: 2026 } }),
  db.payment.update({ where: { id: 1456 }, data: { year: 2026 } }),
  db.payment.update({ where: { id: 1457 }, data: { year: 2026 } }),
]); };
const fixHandovers = async (db: PrismaClient) => {
  // një rresht për çdo dorëzim real: data reale + viti shkollor si atribuim; dyfishimet e 25.08 hiqen
  await db.expense.update({ where: { id: 229 }, data: { date: new Date("2026-08-25T12:00:00Z"), month: 9, year: 2026 } });
  await db.expense.update({ where: { id: 230 }, data: { date: new Date("2026-08-25T12:00:00Z"), month: 9, year: 2026 } });
  await db.expense.update({ where: { id: 231 }, data: { date: new Date("2026-08-31T12:00:00Z"), month: 9, year: 2026 } });
  await db.expense.deleteMany({ where: { id: { in: [184, 185] } } });
};

(async () => {
  console.log(`Burimi (s'preket): ${srcPath}\n`);
  await scenario("0. Gjendja aktuale (pa korrigjime)", async () => {});
  await scenario("1. Viti i saktë te #386 #370 #1456 #1457", fixYear);
  await scenario("2. + dorëzimet e gushtit: një herë, me datën reale", async db => { await fixYear(db); await fixHandovers(db); });
  await scenario("3. + dorëzimi Koprani (#270) te viti 2027–28", async db => { await fixYear(db); await fixHandovers(db); await db.expense.update({ where: { id: 270 }, data: { month: 9, year: 2027 } }); });
  await scenario("4a. + nëse #1624 (Anis) është dyfishim", async db => { await fixYear(db); await fixHandovers(db); await db.expense.update({ where: { id: 270 }, data: { month: 9, year: 2027 } }); await db.payment.update({ where: { id: 1624 }, data: { paidAmount: 0, balance: 2000, status: "PENDING" } }); });
  await scenario("4b. + nëse edhe #1628 (Kanita) është dyfishim", async db => { await fixYear(db); await fixHandovers(db); await db.expense.update({ where: { id: 270 }, data: { month: 9, year: 2027 } }); await db.payment.update({ where: { id: 1624 }, data: { paidAmount: 0, balance: 2000, status: "PENDING" } }); await db.payment.update({ where: { id: 1628 }, data: { paidAmount: 0, balance: 1000, status: "PENDING" } }); });
})();
