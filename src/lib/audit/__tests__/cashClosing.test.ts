import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "@/lib/prisma";
import { ensureAuditTriggers } from "@/lib/audit/triggers";
import { auditStorage, type AuditActor } from "@/lib/audit/context";
import { movementsOf, type CashScope } from "@/lib/audit/cashEffect";
import { computeClosing, createClosing, verifyClosing, ClosingError } from "@/lib/audit/cashClosing";
import { ClosedDayError } from "@/lib/audit/closedDay";

// Faza 2 — mbyllja ditore e arkës dhe bllokimi i ditëve të mbyllura.
// Kopje e përkohshme e prisma/test-copy.db (asnjëherë databaza reale).

const SRC = path.resolve(__dirname, "../../../../prisma/test-copy.db");
const TMP = path.join(os.tmpdir(), `cashclosing-test-${process.pid}-${Date.now()}.db`);
let db: PrismaClient;
let shk = 0, studentId = 0, departedId = 0;

// Ditët e testit: 6, 5, 4, 3 ditë më parë (ora e Kosovës, në mesditë)
const kosovoDay = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade" }).format(d);
const daysAgo = (n: number) => { const key = kosovoDay(new Date(Date.now() - n * 86400000)); return { key, at: new Date(`${key}T12:00:00+02:00`) }; };
const D0 = daysAgo(6), D1 = daysAgo(5), D2 = daysAgo(4), D3 = daysAgo(3);

const staff: AuditActor = { userId: 9001, userName: "Arkëtarja", ip: null, userAgent: null, reason: null, role: "FINANCE", override: false };
const boss: AuditActor = { userId: 9002, userName: "Super", ip: null, userAgent: null, reason: "Korrigjim i verifikuar", role: "SUPERADMIN", override: true };
const as = <T,>(actor: AuditActor, fn: () => Promise<T>) => auditStorage.run({ actor }, async () => await fn());

const pay = (sid: number, paid: number, at: Date, method: string | null = "CASH") =>
  db.payment.create({ data: { studentId: sid, categoryId: shk, amount: 500, finalAmount: 500, dueDate: at, paidDate: at, paidAmount: paid, balance: 500 - paid, method, status: "PARTIAL" } });

beforeAll(async () => {
  fs.copyFileSync(SRC, TMP);
  db = createPrismaClient(`file:${TMP.replace(/\\/g, "/")}`);
  await ensureAuditTriggers(db);
  await db.$executeRawUnsafe(`DELETE FROM "CashClosing"`);
  shk = (await db.paymentCategory.findFirstOrThrow({ where: { name: "Shkollimi" } })).id;
  const s = await db.student.findFirstOrThrow({ where: { status: "ACTIVE" } });
  studentId = s.id;
  departedId = (await db.student.create({ data: { firstName: "I", lastName: "Larguar", status: "INACTIVE", inactiveDate: D0.at } })).id;
});

afterAll(async () => {
  await db?.$disconnect();
  try { fs.unlinkSync(TMP); } catch { /* skedari i përkohshëm */ }
});

describe("movementsOf (rregullat e efektit në arkë)", () => {
  const scope: CashScope = { categoryIds: [4], includesShkollimi: true, foodKategoriIds: [7] };
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

describe("bllokimi i ditëve të mbyllura", () => {
  it("stafi s'mund të shtojë pagesë cash në ditë të mbyllur — asgjë s'ruhet", async () => {
    const before = await db.payment.count();
    await expect(as(staff, () => pay(studentId, 20, D1.at))).rejects.toBeInstanceOf(ClosedDayError);
    expect(await db.payment.count()).toBe(before);
  });

  it("brenda transaksionit: refuzimi kthen mbrapsht të gjithë transaksionin", async () => {
    const before = await db.hyra.count();
    await expect(as(staff, () => db.$transaction(async tx => {
      await tx.hyra.create({ data: { paguesit: "Brenda tx", shuma: 1, muaj: 1, vit: 2026, metoda: "BANK" } });
      await tx.payment.create({ data: { studentId, categoryId: shk, amount: 5, finalAmount: 5, dueDate: D1.at, paidDate: D1.at, paidAmount: 5, method: "CASH" } });
    }))).rejects.toBeInstanceOf(ClosedDayError);
    expect(await db.hyra.count()).toBe(before);
  });

  it("ndryshim pa efekt në arkë (shënim) lejohet edhe në ditë të mbyllur", async () => {
    const p = await db.payment.findFirstOrThrow({ where: { studentId, paidAmount: 100, method: "CASH" } });
    await as(staff, () => db.payment.update({ where: { id: p.id }, data: { note: "shënim pas mbylljes" } }));
    expect((await db.payment.findUniqueOrThrow({ where: { id: p.id } })).note).toBe("shënim pas mbylljes");
  });

  it("Super Admin pa konfirmim të posaçëm refuzohet; me arsye + konfirmim lejohet dhe krijon gjetje", async () => {
    await expect(as({ ...boss, override: false }, () => pay(studentId, 15, D1.at))).rejects.toBeInstanceOf(ClosedDayError);
    const p = await as(boss, () => pay(studentId, 15, D1.at));
    const f = await db.auditFinding.findFirstOrThrow({ where: { ruleCode: "ARKA_MBYLLUR", entityId: p.id } });
    expect(f).toMatchObject({ severity: "E_LARTE", amountCents: 1500, module: "ARKA" });
    expect(f.description).toContain("Korrigjim i verifikuar");
  });

  it("regjistrimi i vonuar për ditën 1 shfaqet te mbyllja e radhës si 'i vonuar'", async () => {
    const c = await computeClosing(db, 1, D2.key);
    expect(c.lateCents).toBe(1500);
    expect(c.late[0]).toMatchObject({ day: D1.key, cents: 1500, kind: "PAGESA" });
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
