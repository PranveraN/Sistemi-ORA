import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import { physicalBalance, reconcileYearView, academicYearOfDay, academicYearOf, type LedgerMovement } from "@/lib/cashLedger";

// Arka fizike sipas datës reale (src/lib/cashLedger.ts). Pjesa 1: rregullat (funksione të
// pastra). Pjesa 2: leximi nga databaza mbi një kopje të përkohshme të test-copy.db.

let seq = 0;
const T0 = Date.parse("2026-09-01T08:00:00Z");
const mv = (o: Partial<LedgerMovement> & { day: string }): LedgerMovement => ({
  key: `K${++seq}`, source: "PAGESE", id: seq, recordedAt: Date.parse(`${o.day}T10:00:00Z`), boxCents: 0, bankCents: 0,
  attributedAY: academicYearOfDay(o.day), inYearView: true, label: "", ...o,
});
const cashPay = (day: string, euro: number, ay = academicYearOfDay(day)) => mv({ day, boxCents: euro * 100, attributedAY: ay });
const bankPay = (day: string, euro: number) => mv({ day, bankCents: euro * 100 });
const handover = (day: string, euro: number, ay = academicYearOfDay(day)) => mv({ day, source: "DOREZIM", boxCents: -euro * 100, attributedAY: ay });
const cashExpense = (day: string, euro: number) => mv({ day, source: "SHPENZIM", boxCents: -euro * 100 });
const bankExpense = (day: string, euro: number) => mv({ day, source: "SHPENZIM", bankCents: -euro * 100 });
const deposit = (day: string, euro: number) => mv({ day, source: "TRANSFER", boxCents: -euro * 100, bankCents: euro * 100, attributedAY: null, inYearView: false });
const opening = (day: string, euro: number, recordedAt = Date.parse(`${day}T18:00:00Z`)) => ({ day, cents: euro * 100, recordedAt });

describe("viti shkollor ≠ data e lëvizjes", () => {
  it("viti shkollor i një dite dhe i një muaji detyrimi", () => {
    expect(academicYearOfDay("2026-09-01")).toBe(2026);
    expect(academicYearOfDay("2026-08-31")).toBe(2025);
    expect(academicYearOf(9, 2027)).toBe(2027);
    expect(academicYearOf(3, 2027)).toBe(2026);
    expect(academicYearOf(null, 2027)).toBeNull();
  });
});

describe("arka fizike — rregullat bazë", () => {
  const open = opening("2026-08-31", 100);
  it("pagesa cash rrit arkën; pagesa me bankë rrit vetëm bankën", () => {
    const b = physicalBalance([cashPay("2026-09-02", 500), bankPay("2026-09-02", 700)], open, "2026-09-30");
    expect(b.closingCents).toBe(60000);
    expect(b.bankDeltaCents).toBe(70000);
  });
  it("dorëzimi te një person zbret arkën, s'prek bankën", () => {
    const b = physicalBalance([cashPay("2026-09-02", 500), handover("2026-09-03", 450)], open, "2026-09-30");
    expect(b.closingCents).toBe(15000);
    expect(b.bankDeltaCents).toBe(0);
  });
  it("depozita arkë→bankë zbret arkën dhe rrit bankën (s'është shpenzim)", () => {
    const b = physicalBalance([cashPay("2026-09-02", 500), deposit("2026-09-04", 400)], open, "2026-09-30");
    expect(b.closingCents).toBe(20000);
    expect(b.bankDeltaCents).toBe(40000);
  });
  it("shpenzimi cash zbret arkën; shpenzimi me bankë zbret vetëm bankën", () => {
    const b = physicalBalance([cashExpense("2026-09-05", 30), bankExpense("2026-09-05", 200)], open, "2026-09-30");
    expect(b.closingCents).toBe(7000);
    expect(b.bankDeltaCents).toBe(-20000);
  });
  it("lëvizjet para numërimit fillestar janë pjesë e tij; ato pas datës së kufirit s'llogariten ende", () => {
    const b = physicalBalance([cashPay("2026-08-20", 999), cashPay("2026-10-15", 50)], open, "2026-09-30");
    expect(b.closingCents).toBe(10000);
    expect(b.futureCount).toBe(1);
  });
  it("gjendja ditore kumulative", () => {
    const b = physicalBalance([cashPay("2026-09-02", 500), handover("2026-09-02", 300), cashPay("2026-09-03", 200)], open, "2026-09-30");
    expect(b.byDay).toEqual([
      { day: "2026-09-02", inCents: 50000, outCents: 30000, balanceCents: 30000 },
      { day: "2026-09-03", inCents: 20000, outCents: 0, balanceCents: 50000 },
    ]);
  });
});

describe("regjistrimet retroaktive", () => {
  it("pagesë me datë para numërimit, por e regjistruar pas tij → del veç si 'e vonuar' dhe llogaritet një herë", () => {
    const open = opening("2026-09-10", 1000);
    const lateCash = mv({ day: "2026-09-08", boxCents: 20000, recordedAt: Date.parse("2026-09-12T09:00:00Z") });
    const onTime = mv({ day: "2026-09-08", boxCents: 5000, recordedAt: Date.parse("2026-09-08T09:00:00Z") });
    const b = physicalBalance([lateCash, onTime, cashPay("2026-09-11", 100)], open, "2026-09-30");
    expect(b.late.map(m => m.key)).toEqual([lateCash.key]);
    expect(b.lateCents).toBe(20000);
    expect(b.closingCents).toBe(100000 + 20000 + 10000); // onTime është tashmë brenda numërimit
  });
  it("dorëzim retroaktiv zbret arkën te numërimi i radhës (si te Koprani: 29.09, regjistruar 06.10)", () => {
    const open = opening("2026-10-01", 7000, Date.parse("2026-10-01T18:00:00Z"));
    const h = mv({ day: "2026-09-29", source: "DOREZIM", boxCents: -660000, recordedAt: Date.parse("2026-10-06T10:00:00Z") });
    const b = physicalBalance([h], open, "2026-10-08");
    expect(b.lateCents).toBe(-660000);
    expect(b.closingCents).toBe(700000 - 660000);
  });
});

describe("rakordimi: Pasqyra e vitit kundrejt arkës fizike", () => {
  it("pagesa për vitin e ardhshëm (Koprani 6.600 €): arka fizike neto 0, Pasqyra e vitit −6.600", () => {
    const movs = [cashPay("2026-09-29", 6600, 2027), handover("2026-09-29", 6600, 2026)];
    const r = reconcileYearView(movs, 2026);
    expect(r.yearViewCents).toBe(-660000);       // Pasqyra 2026–27: vetëm dalja
    expect(r.physicalWindowCents).toBe(0);       // arka fizike: hyri dhe doli
    expect(r.inWindowOtherYear.map(m => m.attributedAY)).toEqual([2027]);
    expect(r.identityHolds).toBe(true);
    expect(reconcileYearView(movs, 2027).yearViewCents).toBe(660000); // Pasqyra 2027–28: vetëm hyrja
  });
  it("pagesat e verës (gusht) për vitin e ri dhe dorëzimet e tyre të gushtit", () => {
    const movs = [cashPay("2026-08-25", 2000, 2026), handover("2026-08-25", 1800, 2026)];
    const r = reconcileYearView(movs, 2026);
    expect(r.yearViewCents).toBe(20000);
    expect(r.physicalWindowCents).toBe(0);
    expect(r.attributedOutsideWindow).toHaveLength(2);
    expect(r.identityHolds).toBe(true);
  });
  it("pagesë e pakonfirmuar ose e nxënësit të larguar: në arkën fizike po, në Pasqyrë jo", () => {
    const m = mv({ day: "2026-09-10", boxCents: 30000, attributedAY: 2026, inYearView: false });
    const r = reconcileYearView([m], 2026);
    expect(r.yearViewCents).toBe(0);
    expect(r.physicalWindowCents).toBe(30000);
    expect(r.inWindowOtherYear).toHaveLength(1);
  });
  it("skenari i hetimit (08.10.2026): 9.195,52 € Pasqyra → 14.545,52 € arka fizike nga 1 shtatori", () => {
    const movs = [
      cashPay("2026-08-01", 5250, 2026),                 // verë, për 2026–27
      cashPay("2026-09-15", 117926, 2026),               // shtator–tetor, për 2026–27
      cashPay("2026-09-29", 6600, 2027),                 // Koprani
      cashPay("2026-09-05", 4000, 2025),                 // 3 pagesa me "9/2025"
      mv({ day: "2026-09-28", source: "HYRA", boxCents: 95000, attributedAY: 2026 }),
      handover("2026-09-20", 110700, 2026),
      cashExpense("2026-09-20", 4230.48),
    ];
    const r = reconcileYearView(movs, 2026);
    expect(r.yearViewCents).toBe(919552);
    expect(r.physicalWindowCents).toBe(1454552);
    expect(r.identityHolds).toBe(true);
    expect(physicalBalance(movs, opening("2026-08-31", 0, Date.now()), "2026-10-08").closingCents).toBe(1454552);
  });
  it("transferi në bankë s'është e hyrë as shpenzim: s'hyn në Pasqyrën e vitit", () => {
    const r = reconcileYearView([cashPay("2026-09-02", 500), deposit("2026-09-03", 500)], 2026);
    expect(r.yearViewCents).toBe(50000);
    expect(r.physicalWindowCents).toBe(0);
    expect(r.identityHolds).toBe(true);
  });
});

// ── Pjesa 2: leximi nga databaza (kopje e përkohshme) ──
const SRC = path.resolve(__dirname, "../../../prisma/test-copy.db");
const TMP = path.join(os.tmpdir(), `cashledger-test-${process.pid}-${Date.now()}.db`);
let db: PrismaClient;
let load: typeof import("@/lib/cashLedger").loadShkollimiMovements;
let shk = 0, studentId = 0;

describe("leximi i lëvizjeve nga databaza", () => {
  beforeAll(async () => {
    fs.copyFileSync(SRC, TMP);
    const { createPrismaClient } = await import("@/lib/prisma");
    db = createPrismaClient(`file:${TMP.replace(/\\/g, "/")}`);
    ({ loadShkollimiMovements: load } = await import("@/lib/cashLedger"));
    shk = (await db.paymentCategory.findFirstOrThrow({ where: { name: "Shkollimi" } })).id;
    studentId = (await db.student.create({ data: { firstName: "Ledger", lastName: "Test", status: "ACTIVE" } })).id;
  });
  afterAll(async () => { await db?.$disconnect(); try { fs.unlinkSync(TMP); } catch { /* i përkohshëm */ } });

  it("çdo lloj rreshti jep lëvizjen e duhur në arkë/bankë dhe vitin e duhur shkollor", async () => {
    const pay = (method: string, euro: number, month: number, year: number, paid: string) => db.payment.create({
      data: { studentId, categoryId: shk, amount: euro, finalAmount: euro, paidAmount: euro, method, month, year, dueDate: new Date(paid), paidDate: new Date(`${paid}T10:00:00Z`) },
    });
    const pCash = await pay("CASH", 1100, 9, 2027, "2031-09-29");       // për vitin e ardhshëm, marrë sot
    const pBank = await pay("BANK", 2000, 9, 2031, "2031-09-02");
    const ho = await db.expense.create({ data: { categoryId: shk, type: "HANDOVER", amount: 1100, date: new Date("2031-09-29T12:00:00Z"), month: 9, year: 2031 } });
    const tr = await db.cashTransfer.create({ data: { box: `CAT:${shk}`, direction: "BOX_TO_BANK", amountCents: 50000, date: new Date("2031-09-30T12:00:00Z") } });
    const kat = await db.shpenzimKategori.create({ data: { emri: "Ledger test", fusha: "SHKOLLIMI" } });
    const sh = await db.shpenzim.create({ data: { kategoriId: kat.id, shuma: 25, data: new Date("2031-09-30T12:00:00Z"), metoda: "CASH", paguar: true } });
    const movs = await load(db);
    const by = (k: string) => movs.find(m => m.key === k)!;
    expect(by(`P${pCash.id}`)).toMatchObject({ day: "2031-09-29", boxCents: 110000, bankCents: 0, attributedAY: 2027 });
    expect(by(`P${pBank.id}`)).toMatchObject({ boxCents: 0, bankCents: 200000, attributedAY: 2031 });
    expect(by(`D${ho.id}`)).toMatchObject({ boxCents: -110000, attributedAY: 2031 });
    expect(by(`T${tr.id}`)).toMatchObject({ boxCents: -50000, bankCents: 50000, inYearView: false });
    expect(by(`S${sh.id}`)).toMatchObject({ boxCents: -2500, attributedAY: 2031 });
    // Arka fizike e shtatorit 2031: +1.100 −1.100 −500 −25 = −525 € (kopja s'ka gjendje fillestare për 2031)
    const r = reconcileYearView(movs, 2031);
    expect(r.identityHolds).toBe(true);
  });
});
