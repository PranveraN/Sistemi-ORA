import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "@/lib/prisma";
import { ensureAuditTriggers } from "@/lib/audit/triggers";
import { auditStorage, type AuditActor } from "@/lib/audit/context";
import { movementsOf, type CashBox } from "@/lib/audit/cashEffect";
import { computeClosing as computeBox, createClosing as createBox, verifyClosing, loadCashBoxes, ClosingError } from "@/lib/audit/cashClosing";

// Faza 2 — numërimi i arkave (çdo burim arka e vet) dhe gjetjet pas numërimit.
// Kopje e përkohshme e prisma/test-copy.db (asnjëherë databaza reale).

const SRC = path.resolve(__dirname, "../../../../prisma/test-copy.db");
const TMP = path.join(os.tmpdir(), `cashclosing-test-${process.pid}-${Date.now()}.db`);
let db: PrismaClient;
let shk = 0, ush = 0, studentId = 0, departedId = 0;
let SHK: CashBox, USH: CashBox, UNI: CashBox;
// Arka e Shkollimit si parazgjedhje në testet e zinxhirit
const computeClosing = (d: PrismaClient, org: number, date: string) => computeBox(d, org, SHK, date);
const createClosing = (d: PrismaClient, org: number, a: { id: number; name: string }, input: { date: string; countedCents: number }) => createBox(d, org, a, SHK, input);

// Ditët e testit: 6, 5, 4, 3 ditë më parë (ora e Kosovës, në mesditë)
const kosovoDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade" }).format(d);
const daysAgo = (n: number) => { const key = kosovoDay(new Date(Date.now() - n * 86400000)); return { key, at: new Date(`${key}T12:00:00+02:00`) }; };
const D0 = daysAgo(6), D1 = daysAgo(5), D2 = daysAgo(4), D3 = daysAgo(3);

const staff: AuditActor = { userId: 9001, userName: "Arkëtarja", ip: null, userAgent: null, reason: null, role: "FINANCE" };
const as = <T,>(actor: AuditActor, fn: () => Promise<T>) => auditStorage.run({ actor }, async () => await fn());

const pay = (sid: number, paid: number, at: Date, method: string | null = "CASH") =>
  db.payment.create({ data: { studentId: sid, categoryId: shk, amount: 500, finalAmount: 500, dueDate: at, paidDate: at, paidAmount: paid, balance: 500 - paid, method, status: "PARTIAL" } });

beforeAll(async () => {
  fs.copyFileSync(SRC, TMP);
  db = createPrismaClient(`file:${TMP.replace(/\\/g, "/")}`);
  await ensureAuditTriggers(db);
  await db.$executeRawUnsafe(`DELETE FROM "CashClosing"`);
  shk = (await db.paymentCategory.findFirstOrThrow({ where: { name: "Shkollimi" } })).id;
  ush = (await db.paymentCategory.findFirstOrThrow({ where: { name: "Ushqimi" } })).id;
  const boxes = await loadCashBoxes(db, 1);
  SHK = boxes.find(b => b.key === `CAT:${shk}`)!;
  USH = boxes.find(b => b.key === `CAT:${ush}`)!;
  UNI = boxes.find(b => b.key === "UNIFORMA")!;
  const s = await db.student.findFirstOrThrow({ where: { status: "ACTIVE" } });
  studentId = s.id;
  departedId = (await db.student.create({ data: { firstName: "I", lastName: "Larguar", status: "INACTIVE", inactiveDate: D0.at } })).id;
});

afterAll(async () => {
  await db?.$disconnect();
  try { fs.unlinkSync(TMP); } catch { /* skedari i përkohshëm */ }
});

describe("movementsOf (rregullat e efektit në arkë)", () => {
  const scope: CashBox = { key: "CAT:4", label: "Shkollimi", categoryId: 4, withShkollimiExtras: true, foodKategoriIds: [7] };
  it("pagesa e pjesshme: vetëm diferenca, në datën e re", () => {
    const m = movementsOf("Payment",
      { categoryId: 4, method: "CASH", paidAmount: 100, paidDate: Date.parse("2026-10-01T10:00:00Z") },
      { categoryId: 4, method: "CASH", paidAmount: 300, paidDate: Date.parse("2026-10-05T10:00:00Z") }, scope);
    expect(m).toEqual([{ cents: 20000, day: "2026-10-05", kind: "PAGESA" }]);
  });
  it("pagesa me bankë s'prek arkën; kalimi Cash → Bankë e heq", () => {
    expect(movementsOf("Payment", null, { categoryId: 4, method: "BANK", paidAmount: 50, paidDate: 0 }, scope)).toEqual([]);
    const m = movementsOf("Payment", { categoryId: 4, method: "CASH", paidAmount: 50, paidDate: Date.parse("2026-10-02T10:00:00Z") },
      { categoryId: 4, method: "BANK", paidAmount: 50, paidDate: Date.parse("2026-10-02T10:00:00Z") }, scope);
    expect(m).toEqual([{ cents: -5000, day: "2026-10-02", kind: "PAGESA" }]);
  });
  it("shpenzimi: ndërrimi i datës i lëviz paratë mes ditëve; i fshiri dhe Ushqimi s'llogariten", () => {
    const a = { kategoriId: 1, paguar: 1, metoda: "CASH", shuma: 20, data: Date.parse("2026-10-01T10:00:00Z"), deletedAt: null };
    expect(movementsOf("Shpenzim", a, { ...a, data: Date.parse("2026-10-03T10:00:00Z") }, scope))
      .toEqual([{ cents: 2000, day: "2026-10-01", kind: "SHPENZIM" }, { cents: -2000, day: "2026-10-03", kind: "SHPENZIM" }]);
    expect(movementsOf("Shpenzim", null, { ...a, deletedAt: 123 }, scope)).toEqual([]);
    expect(movementsOf("Shpenzim", null, { ...a, kategoriId: 7 }, scope)).toEqual([]);
  });
  it("kategori jashtë arkës (p.sh. Ushqimi) s'llogaritet", () => {
    expect(movementsOf("Payment", null, { categoryId: 5, method: "CASH", paidAmount: 10, paidDate: 0 }, scope)).toEqual([]);
  });
  it("arka e Ushqimit: vetëm pagesat dhe dorëzimet e veta — jo shpenzimet/të hyrat e Shkollimit", () => {
    const food: CashBox = { key: "CAT:5", label: "Ushqimi", categoryId: 5, foodKategoriIds: [] };
    expect(movementsOf("Payment", null, { categoryId: 5, method: "CASH", paidAmount: 10, paidDate: Date.parse("2026-10-01T10:00:00Z") }, food)).toEqual([{ cents: 1000, day: "2026-10-01", kind: "PAGESA" }]);
    expect(movementsOf("Hyra", null, { kategoria: "SHKOLLIMI", metoda: "CASH", shuma: 5, createdAt: 0 }, food)).toEqual([]);
    expect(movementsOf("Shpenzim", null, { kategoriId: 1, paguar: 1, metoda: "CASH", shuma: 5, data: 0, deletedAt: null }, food)).toEqual([]);
  });
  it("arka e Uniformave: pagesat cash të shitjeve hyjnë, dorëzimet dalin", () => {
    const uni: CashBox = { key: "UNIFORMA", label: "Uniformat", module: "UNIFORMA", foodKategoriIds: [] };
    expect(movementsOf("UniPayment", null, { amount: 25, method: "CASH", paidAt: Date.parse("2026-10-01T10:00:00Z") }, uni)).toEqual([{ cents: 2500, day: "2026-10-01", kind: "SHITJE" }]);
    expect(movementsOf("UniPayment", null, { amount: 25, method: "BANK", paidAt: 0 }, uni)).toEqual([]);
    expect(movementsOf("UniHandover", null, { amount: 10, handoverAt: Date.parse("2026-10-01T10:00:00Z") }, uni)).toEqual([{ cents: -1000, day: "2026-10-01", kind: "DOREZIM" }]);
    expect(movementsOf("BookPayment", null, { amount: 25, method: "CASH", paidAt: 0 }, uni)).toEqual([]);
  });
});

describe("zinxhiri i mbylljeve", () => {
  it("hapja: gjendja fillestare, pa diferencë", async () => {
    const c = await createClosing(db, 1, { id: 9001, name: "Arkëtarja" }, { date: D0.key, countedCents: 10000 });
    expect(c).toMatchObject({ kind: "OPENING", systemCents: 10000, countedCents: 10000, diffCents: 0 });
  });

  it("dita 1: pagesat cash (edhe nga nxënës i larguar) hyjnë; bankë jo; shpenzimi dhe dorëzimi dalin", async () => {
    await as(staff, () => pay(studentId, 100, D1.at));
    await as(staff, () => pay(departedId, 40, D1.at));
    await as(staff, () => pay(studentId, 999, D1.at, "BANK"));
    await as(staff, () => db.expense.create({ data: { categoryId: shk, type: "HANDOVER", amount: 30, date: D1.at } }));
    const c = await computeClosing(db, 1, D1.key);
    expect(c).toMatchObject({ kind: "DAILY", openingCents: 10000, inCents: 14000, outCents: 3000, systemCents: 21000 });
    expect(c.byKind.PAGESA.inCents).toBe(14000);
    expect(c.byKind.DOREZIM.outCents).toBe(3000);
  });

  it("pagesa e pjesshme e paguar më vonë bie te dita e saj, jo te dita e parë", async () => {
    const p = await as(staff, () => pay(studentId, 50, D1.at));
    await as(staff, () => db.payment.update({ where: { id: p.id }, data: { paidAmount: 80, paidDate: D2.at } }));
    const c1 = await computeClosing(db, 1, D1.key);
    expect(c1.inCents).toBe(14000 + 5000);
  });

  it("mbyllja me diferencë krijon gjetje KRITIKE", async () => {
    const c = await createClosing(db, 1, { id: 9001, name: "Arkëtarja" }, { date: D1.key, countedCents: 25000 });
    expect(c.systemCents).toBe(26000);
    expect(c.diffCents).toBe(-1000);
    const f = await db.auditFinding.findUniqueOrThrow({ where: { fingerprint: `R01:closing:${c.id}` } });
    expect(f).toMatchObject({ severity: "KRITIKE", amountCents: -1000, status: "E_RE" });
  });

  it("dita 2 nis nga shuma e NUMËRUAR e ditës 1 dhe merr pjesën e dytë të pagesës", async () => {
    const c = await computeClosing(db, 1, D2.key);
    expect(c.openingCents).toBe(25000);
    expect(c.inCents).toBe(3000);
    expect(c.late).toHaveLength(0);
  });

  it("s'lejohet mbyllja e një dite të mbyllur ose të ardhshme", async () => {
    await expect(createClosing(db, 1, { id: 1, name: "x" }, { date: D1.key, countedCents: 0 })).rejects.toBeInstanceOf(ClosingError);
    await expect(createClosing(db, 1, { id: 1, name: "x" }, { date: "2999-01-01", countedCents: 0 })).rejects.toBeInstanceOf(ClosingError);
  });
});

describe("ndryshimet në ditë të mbyllura (pa bllokim — vetëm gjetje)", () => {
  it("pagesa cash në ditë të mbyllur lejohet dhe krijon gjetje me emrin e përdoruesit", async () => {
    const p = await as(staff, () => pay(studentId, 15, D1.at));
    expect(p.id).toBeGreaterThan(0);
    const f = await db.auditFinding.findFirstOrThrow({ where: { ruleCode: "ARKA_MBYLLUR", entityId: p.id } });
    expect(f).toMatchObject({ severity: "E_LARTE", amountCents: 1500, module: "ARKA", status: "E_RE" });
    expect(f.description).toContain("Arkëtarja");
  });

  it("brenda transaksionit: ruhet gjithçka dhe gjetja krijohet", async () => {
    const before = await db.auditFinding.count({ where: { ruleCode: "ARKA_MBYLLUR" } });
    await as(staff, () => db.$transaction(async tx => {
      await tx.hyra.create({ data: { paguesit: "Brenda tx", shuma: 1, muaj: 1, vit: 2026, metoda: "BANK" } });
      const x = await tx.payment.create({ data: { studentId, categoryId: shk, amount: 5, finalAmount: 5, dueDate: D1.at, paidDate: D1.at, paidAmount: 5, method: "CASH" } });
      await tx.payment.delete({ where: { id: x.id } });
    }));
    expect(await db.auditFinding.count({ where: { ruleCode: "ARKA_MBYLLUR" } })).toBe(before + 2);
  });

  it("ndryshim pa efekt në arkë (shënim) s'krijon gjetje", async () => {
    const p = await db.payment.findFirstOrThrow({ where: { studentId, paidAmount: 100, method: "CASH" } });
    const before = await db.auditFinding.count();
    await as(staff, () => db.payment.update({ where: { id: p.id }, data: { note: "shënim pas mbylljes" } }));
    expect((await db.payment.findUniqueOrThrow({ where: { id: p.id } })).note).toBe("shënim pas mbylljes");
    expect(await db.auditFinding.count()).toBe(before);
  });

  it("ndryshim në ditë të hapur s'krijon gjetje", async () => {
    const before = await db.auditFinding.count();
    await as(staff, () => pay(studentId, 7, D3.at));
    expect(await db.auditFinding.count()).toBe(before);
  });

  it("regjistrimet e vonuara për ditën 1 shfaqen te mbyllja e radhës si 'të vonuara'", async () => {
    const c = await computeClosing(db, 1, D2.key);
    expect(c.lateCents).toBe(1500); // 15 € + (5 € e shtuar dhe e fshirë = 0)
    expect(c.late.filter(l => l.cents === 1500)[0]).toMatchObject({ day: D1.key, kind: "PAGESA" });
    expect(c.systemCents).toBe(25000 + 3000 + 1500);
  });
});

describe("verifikimi", () => {
  it("personi që numëroi s'mund ta verifikojë; një tjetër po", async () => {
    const c = await db.cashClosing.findFirstOrThrow({ where: { date: D1.key } });
    await expect(verifyClosing(db, 1, { id: 9001, name: "Arkëtarja" }, c.id)).rejects.toBeInstanceOf(ClosingError);
    const v = await verifyClosing(db, 1, { id: 9003, name: "Drejtoresha" }, c.id, "ok");
    expect(v.verifiedByName).toBe("Drejtoresha");
    await expect(verifyClosing(db, 1, { id: 9004, name: "Tjetër" }, c.id)).rejects.toBeInstanceOf(ClosingError);
  });
});

describe("arkat e ndara — secila numërohet më vete", () => {
  it("pagesa e Ushqimit hyn vetëm te arka e Ushqimit, jo te e Shkollimit", async () => {
    await createBox(db, 1, { id: 9001, name: "Arkëtarja" }, USH, { date: D0.key, countedCents: 0 });
    const shkBefore = await computeBox(db, 1, SHK, D3.key);
    await as(staff, () => db.payment.create({ data: { studentId, categoryId: ush, amount: 12, finalAmount: 12, dueDate: D3.at, paidDate: D3.at, paidAmount: 12, method: "CASH" } }));
    expect((await computeBox(db, 1, USH, D3.key)).inCents).toBe(1200);
    expect((await computeBox(db, 1, SHK, D3.key)).systemCents).toBe(shkBefore.systemCents);
  });

  it("ndryshimi pas numërimit shënohet vetëm për arkën që preket", async () => {
    const p = await as(staff, () => db.payment.create({ data: { studentId, categoryId: ush, amount: 8, finalAmount: 8, dueDate: D0.at, paidDate: D0.at, paidAmount: 8, method: "CASH" } }));
    const fs_ = await db.auditFinding.findMany({ where: { ruleCode: "ARKA_MBYLLUR", entityType: "Payment", entityId: p.id } });
    expect(fs_).toHaveLength(1);
    expect(fs_[0].fingerprint).toContain(USH.key);
    expect(fs_[0].title).toContain("Ushqimi");
  });

  it("arka e Uniformave: shitja me pagesë cash (pagesa krijohet brenda shitjes) hyn te Uniformat dhe shënohet pas numërimit", async () => {
    await createBox(db, 1, { id: 9001, name: "Arkëtarja" }, UNI, { date: D2.key, countedCents: 5000 });
    const sale = await as(staff, () => db.uniSale.create({ data: {
      customerName: "Prind", totalAmount: 30, totalCost: 20, profit: 10, paidAmount: 30, saleDate: D1.at,
      payments: { create: { amount: 30, method: "CASH", paidAt: D1.at } },
    } }));
    const f = await db.auditFinding.findFirst({ where: { ruleCode: "ARKA_MBYLLUR", fingerprint: { contains: "UNIFORMA" } } });
    expect(f?.amountCents).toBe(3000);
    const c = await computeBox(db, 1, UNI, D3.key);
    expect(c).toMatchObject({ openingCents: 5000, lateCents: 3000, systemCents: 8000 });
    expect(sale.id).toBeGreaterThan(0);
  });

  it("çdo arkë ka zinxhirin e vet: e njëjta datë mund të numërohet në arka të ndryshme", async () => {
    const a = await createBox(db, 1, { id: 9001, name: "Arkëtarja" }, USH, { date: D3.key, countedCents: 2000 });
    // 12 € (D3) + 8 € e regjistruar pas numërimit të parë (D0) = 20 €
    expect(a).toMatchObject({ box: USH.key, systemCents: 2000, diffCents: 0 });
    const b = await createBox(db, 1, { id: 9001, name: "Arkëtarja" }, UNI, { date: D3.key, countedCents: 8000 });
    expect(b.diffCents).toBe(0);
  });
});
