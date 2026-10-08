import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { PrismaClient } from "@prisma/client";

// Pagesat pjesë-pjesë të faturave (p.sh. 2.200 € nga 17.600 €). Kopje e përkohshme e
// prisma/test-copy.db; DATABASE_URL vendoset para importeve (edhe klienti global).

const SRC = path.resolve(__dirname, "../../../../prisma/test-copy.db");
const TMP = path.join(os.tmpdir(), `pagesat-test-${process.pid}-${Date.now()}.db`);
fs.copyFileSync(SRC, TMP);
process.env.DATABASE_URL = `file:${TMP.replace(/\\/g, "/")}`;

let db: PrismaClient;
let lib: typeof import("@/lib/shpenzimPagesat");
let loadShkollimiExpenses: typeof import("@/lib/shkollimiExpenses").loadShkollimiExpenses;
let movementsOf: typeof import("@/lib/audit/cashEffect").movementsOf;
let kategoriId = 0, foodKategoriId = 0;
const OCT = new Date("2031-10-10T10:00:00Z"), NOV = new Date("2031-11-15T10:00:00Z");
// Periudha: muaji 10/2031 dhe 11/2031 (kalendarik)
const totals = async (month: number) => (await loadShkollimiExpenses(null, month, 2031, "calendar")).totals;

beforeAll(async () => {
  ({ prisma: db } = await import("@/lib/prisma"));
  lib = await import("@/lib/shpenzimPagesat");
  ({ loadShkollimiExpenses } = await import("@/lib/shkollimiExpenses"));
  ({ movementsOf } = await import("@/lib/audit/cashEffect"));
  kategoriId = (await db.shpenzimKategori.create({ data: { emri: "Test Teknologji", fusha: "SHKOLLIMI" } })).id;
  foodKategoriId = (await db.shpenzimKategori.create({ data: { emri: "Test Ushqim", fusha: "USHQIMI" } })).id;
});

afterAll(async () => {
  await db?.$disconnect();
  try { fs.unlinkSync(TMP); } catch { /* skedari i përkohshëm */ }
});

async function pay(shpenzimId: number, euro: number, data: Date, metoda: string) {
  const s = await db.shpenzim.findUniqueOrThrow({ where: { id: shpenzimId } });
  await db.shpenzimPagese.create({ data: { shpenzimId, kategoriId: s.kategoriId, shumaCents: Math.round(euro * 100), data, metoda } });
  const sum = (await db.shpenzimPagese.aggregate({ where: { shpenzimId }, _sum: { shumaCents: true } }))._sum.shumaCents ?? 0;
  await db.shpenzim.update({ where: { id: shpenzimId }, data: { mePagesa: true, paguar: sum >= Math.round(s.shuma * 100) } });
}

describe("fatura 17.600 € e paguar pjesë-pjesë", () => {
  let id = 0;
  it("pa pagesa: e gjithë shuma është borxh, asgjë e paguar", async () => {
    const before = await totals(10);
    id = (await db.shpenzim.create({ data: { kategoriId, shuma: 17600, data: OCT, paguar: false, docType: "FATURE", emriBiznesit: "Aritech shpk" } })).id;
    const after = await totals(10);
    expect(after.unpaid - before.unpaid).toBeCloseTo(17600, 2);
    expect(after.paid - before.paid).toBeCloseTo(0, 2);
  });

  it("pagesa 2.200 € me bankë: e paguar +2.200 (bankë), borxhi 15.400; arka s'preket", async () => {
    const before = await totals(10);
    await pay(id, 2200, OCT, "BANK");
    const after = await totals(10);
    expect(after.paid - before.paid).toBeCloseTo(2200, 2);
    expect(after.bank - before.bank).toBeCloseTo(2200, 2);
    expect(after.cash - before.cash).toBeCloseTo(0, 2);
    expect(after.unpaid - before.unpaid).toBeCloseTo(-2200, 2);
    const s = await db.shpenzim.findUniqueOrThrow({ where: { id } });
    const paid = (await lib.paidSumsByShpenzim(db, [id])).get(id)!;
    expect(lib.remainingOf(s, paid)).toBeCloseTo(15400, 2);
    expect(lib.paymentStatus(s, paid)).toBe("PJESERISHT");
  });

  it("pagesa cash në nëntor llogaritet në nëntor (data e pagesës), jo në tetor (data e faturës)", async () => {
    const oct = await totals(10), nov = await totals(11);
    await pay(id, 1000, NOV, "CASH");
    expect((await totals(11)).cash - nov.cash).toBeCloseTo(1000, 2);
    expect((await totals(10)).paid - oct.paid).toBeCloseTo(0, 2);
    // borxhi i faturës (e tetorit) zvogëlohet
    expect((await totals(10)).unpaid - oct.unpaid).toBeCloseTo(-1000, 2);
  });

  it("pagesa e fundit e mbyll: statusi E_PAGUAR, borxhi 0", async () => {
    await pay(id, 14400, NOV, "BANK");
    const s = await db.shpenzim.findUniqueOrThrow({ where: { id } });
    const paid = (await lib.paidSumsByShpenzim(db, [id])).get(id)!;
    expect(s.paguar).toBe(true);
    expect(lib.remainingOf(s, paid)).toBe(0);
    expect(lib.paymentStatus(s, paid)).toBe("E_PAGUAR");
    // e paguara e tëra NUK numërohet dy herë (fatura + pagesat)
    const portions = await lib.loadPaidPortions(db, null, { id });
    expect(portions.reduce((a, p) => a + p.shuma, 0)).toBeCloseTo(17600, 2);
    expect(portions.every(p => p.fromPayment)).toBe(true);
  });
});

describe("faturat e vjetra s'ndryshojnë", () => {
  it("fatura e paguar e tëra (pa pagesa pjesore) llogaritet si më parë", async () => {
    const before = await totals(10);
    await db.shpenzim.create({ data: { kategoriId, shuma: 300, data: OCT, paguar: true, metoda: "CASH" } });
    const after = await totals(10);
    expect(after.cash - before.cash).toBeCloseTo(300, 2);
    expect(after.unpaid - before.unpaid).toBeCloseTo(0, 2);
  });
});

describe("arka (gjurma e auditimit)", () => {
  const box = { key: "CAT:4", label: "Shkollimi", categoryId: 4, withShkollimiExtras: true, foodKategoriIds: [99] };
  it("fatura me pagesa s'prek arkën vetë; pagesa cash e prek në datën e vet", () => {
    expect(movementsOf("Shpenzim", null, { kategoriId: 1, paguar: 1, mePagesa: 1, metoda: "CASH", shuma: 500, data: Date.parse("2031-10-10T10:00:00Z"), deletedAt: null }, box)).toEqual([]);
    expect(movementsOf("ShpenzimPagese", null, { kategoriId: 1, shumaCents: 100000, metoda: "CASH", data: Date.parse("2031-11-15T10:00:00Z") }, box))
      .toEqual([{ cents: -100000, day: "2031-11-15", kind: "SHPENZIM" }]);
    expect(movementsOf("ShpenzimPagese", null, { kategoriId: 1, shumaCents: 100000, metoda: "BANK", data: 0 }, box)).toEqual([]);
    expect(movementsOf("ShpenzimPagese", null, { kategoriId: 99, shumaCents: 100000, metoda: "CASH", data: 0 }, box)).toEqual([]); // Ushqimi
  });

  it("pagesa e faturës së Ushqimit s'hyn te totalet e Shkollimit", async () => {
    const before = await totals(10);
    const f = await db.shpenzim.create({ data: { kategoriId: foodKategoriId, shuma: 100, data: OCT, paguar: false } });
    await pay(f.id, 40, OCT, "CASH");
    const after = await totals(10);
    expect(after.cash - before.cash).toBeCloseTo(0, 2);
    expect(after.ushqimi - before.ushqimi).toBeCloseTo(40, 2);
  });
});
