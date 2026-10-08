import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "@/lib/prisma";
import { ensureAuditTriggers } from "@/lib/audit/triggers";
import { auditStorage, type AuditActor } from "@/lib/audit/context";
import { DEFAULT_AUDIT_CONFIG, DAY_MS, type AuditRuleDef, type RuleContext } from "@/lib/audit/rules/types";
import { r01 } from "@/lib/audit/rules/r01CashCountDifference";
import { r02 } from "@/lib/audit/rules/r02PaymentChanged";
import { r03 } from "@/lib/audit/rules/r03Backdated";
import { r04 } from "@/lib/audit/rules/r04Discounts";
import { r05 } from "@/lib/audit/rules/r05Duplicates";
import { r06 } from "@/lib/audit/rules/r06Numbering";
import { r07 } from "@/lib/audit/rules/r07PaymentInvoice";
import { r08 } from "@/lib/audit/rules/r08Reconciliation";
import { r09 } from "@/lib/audit/rules/r09Departed";
import { r10 } from "@/lib/audit/rules/r10NoObligation";
import { r11 } from "@/lib/audit/rules/r11UndeliveredCash";
import { r12 } from "@/lib/audit/rules/r12BadValues";
import { computeTuitionFigures } from "@/lib/audit/tuitionFigures";
import { runAudit } from "@/lib/audit/engine";
import { isRunDue } from "@/lib/audit/scheduler";
import { getAcademicMonths } from "@/lib/academicYear";

// Faza 3 — motori i rregullave. Çdo rregull: një rast që DUHET kapur dhe një që
// S'DUHET kapur. Kopje e përkohshme e prisma/test-copy.db (asnjëherë databaza reale).

const SRC = path.resolve(__dirname, "../../../../prisma/test-copy.db");
const TMP = path.join(os.tmpdir(), `rules-test-${process.pid}-${Date.now()}.db`);
const YEAR = 2026;
let db: PrismaClient;
let shk = 0, studentId = 0;
const now = new Date();
const ago = (d: number) => new Date(now.getTime() - d * DAY_MS);
const staff: AuditActor = { userId: 7001, userName: "Arkëtarja", ip: null, userAgent: null, reason: null, role: "FINANCE" };
const as = <T,>(fn: () => Promise<T>) => auditStorage.run({ actor: staff }, async () => await fn());
const ctx = (): RuleContext => ({ db, orgId: 1, now: new Date(), config: { ...DEFAULT_AUDIT_CONFIG }, academicYear: YEAR });
const fps = async (rule: AuditRuleDef, c = ctx()) => new Set((await rule.run(c)).map(v => v.fingerprint));
const lastLog = async () => (await db.finAuditLog.findFirstOrThrow({ orderBy: { id: "desc" } })).id;
const pay = (data: Record<string, unknown>) => as(() => db.payment.create({
  data: { studentId, categoryId: shk, amount: 100, finalAmount: 100, dueDate: now, ...data } as never,
}));
const newStudent = (extra: Record<string, unknown> = {}) => db.student.create({ data: { firstName: "Test", lastName: `Rregulla${Math.random().toString(36).slice(2, 7)}`, ...extra } as never });

beforeAll(async () => {
  fs.copyFileSync(SRC, TMP);
  db = createPrismaClient(`file:${TMP.replace(/\\/g, "/")}`);
  await ensureAuditTriggers(db);
  shk = (await db.paymentCategory.findFirstOrThrow({ where: { name: "Shkollimi" } })).id;
  studentId = (await newStudent()).id;
});

afterAll(async () => {
  await db?.$disconnect();
  try { fs.unlinkSync(TMP); } catch { /* skedari i përkohshëm */ }
});

describe("R01 diferencë në numërim", () => {
  it("kap numërimin me diferencë, jo atë pa diferencë", async () => {
    const bad = await db.cashClosing.create({ data: { box: "TEST-A", date: "2026-01-01", scope: "{}", systemCents: 1000, countedCents: 500, diffCents: -500 } });
    const ok = await db.cashClosing.create({ data: { box: "TEST-B", date: "2026-01-01", scope: "{}", systemCents: 1000, countedCents: 1000, diffCents: 0 } });
    const f = await fps(r01);
    expect(f.has(`R01:closing:${bad.id}`)).toBe(true);
    expect(f.has(`R01:closing:${ok.id}`)).toBe(false);
  });
});

describe("R02 pagesa të fshira/ndryshuara", () => {
  it("kap fshirjen e pagesës së paguar dhe uljen e shumës; jo pagesën e re të pjesshme", async () => {
    const a = await pay({ paidAmount: 100, paidDate: ago(1), method: "CASH" });
    await as(() => db.payment.delete({ where: { id: a.id } }));
    const delLog = await lastLog();
    const b = await pay({ paidAmount: 100, paidDate: ago(1), method: "CASH" });
    await as(() => db.payment.update({ where: { id: b.id }, data: { paidAmount: 80 } }));
    const downLog = await lastLog();
    const c = await pay({ paidAmount: 40, paidDate: ago(3), method: "CASH" });
    await as(() => db.payment.update({ where: { id: c.id }, data: { paidAmount: 100, paidDate: ago(0) } }));
    const partialLog = await lastLog();
    const f = await fps(r02);
    expect(f.has(`R02:del:${delLog}`)).toBe(true);
    expect(f.has(`R02:ulje:${downLog}`)).toBe(true);
    expect([...f].some(x => x.endsWith(`:${partialLog}`))).toBe(false);
  });
});

describe("R03 pagesa me datë të prapambetur", () => {
  it("kap pagesën e futur 20 ditë pas datës, jo atë 2 ditë pas", async () => {
    const old = await pay({ paidAmount: 50, paidDate: ago(20), method: "CASH" });
    const fresh = await pay({ paidAmount: 50, paidDate: ago(2), method: "CASH" });
    const f = await fps(r03);
    expect(f.has(`R03:create:${old.id}`)).toBe(true);
    expect(f.has(`R03:create:${fresh.id}`)).toBe(false);
  });
});

describe("R04 zbritje", () => {
  it("kap zbritjen 50% (kufiri 30%) dhe zbritjen nga i njëjti përdorues; jo zbritjen 20% pa pagesë", async () => {
    const big = await pay({ amount: 100, finalAmount: 50, discount: 50 });
    const small = await pay({ amount: 100, finalAmount: 80, discount: 20 });
    const own = await pay({ amount: 100, finalAmount: 90, discount: 10, paidAmount: 90, paidDate: now, method: "CASH" });
    const ownLog = (await db.finAuditLog.findFirstOrThrow({ where: { tableName: "Payment", recordId: own.id, action: "CREATE" } })).id;
    const f = await fps(r04);
    expect(f.has(`R04:pagese:${big.id}`)).toBe(true);
    expect(f.has(`R04:pagese:${small.id}`)).toBe(false);
    expect(f.has(`R04:i-njejti:${ownLog}`)).toBe(true);
    const smallLog = (await db.finAuditLog.findFirstOrThrow({ where: { tableName: "Payment", recordId: small.id, action: "CREATE" } })).id;
    expect(f.has(`R04:i-njejti:${smallLog}`)).toBe(false); // s'ka para të paguara
  });
});

describe("R05 dyfishime", () => {
  it("kap dy pagesa të njëjta për të njëjtin muaj brenda 1 dite; jo për muaj të ndryshëm", async () => {
    const a = await pay({ paidAmount: 77, paidDate: ago(2), method: "CASH", month: 3, year: 2027 });
    const b = await pay({ paidAmount: 77, paidDate: ago(1), method: "CASH", month: 3, year: 2027 });
    const c = await pay({ paidAmount: 66, paidDate: ago(1), method: "CASH", month: 4, year: 2027 });
    const d = await pay({ paidAmount: 66, paidDate: ago(1), method: "CASH", month: 5, year: 2027 });
    const f = await fps(r05);
    expect(f.has(`R05:${a.id}:${b.id}`)).toBe(true);
    expect(f.has(`R05:${c.id}:${d.id}`)).toBe(false);
  });
});

describe("R06 numërimi i dokumenteve", () => {
  it("kap numrin që mungon (FAT-2031-0002); jo serinë e plotë", async () => {
    for (const n of ["FAT-2031-0001", "FAT-2031-0003", "FAT-2032-0001", "FAT-2032-0002"]) {
      await db.invoice.create({ data: { number: n, type: "INVOICE", studentId, subtotal: 10, total: 10 } });
    }
    const vs = await r06.run(ctx());
    const gap = vs.find(v => v.fingerprint === "R06:FAT-2031");
    expect(gap?.evidence?.missing).toEqual(["FAT-2031-0002"]);
    expect(vs.some(v => v.fingerprint === "R06:FAT-2032")).toBe(false);
  });
});

describe("R07 pagesë pa dokument / faturë pa pagesë", () => {
  it("kap faturën 'Paguar' pa pagesë; jo faturën me pagesë të lidhur", async () => {
    const bare = await db.invoice.create({ data: { number: "FAT-2033-0001", type: "INVOICE", studentId, subtotal: 10, total: 10, status: "PAID" } });
    const linked = await db.invoice.create({ data: { number: "FAT-2033-0002", type: "INVOICE", studentId, subtotal: 10, total: 10, status: "PAID" } });
    await pay({ paidAmount: 10, paidDate: now, method: "CASH", invoiceId: linked.id });
    const f = await fps(r07);
    expect(f.has(`R07:fature:${bare.id}`)).toBe(true);
    expect(f.has(`R07:fature:${linked.id}`)).toBe(false);
  });
});

describe("R08 barazimet dhe ndarja e borxhit", () => {
  it("ndan borxhin: aktivë (vetëm të konfirmuarat), të larguar, kredi", async () => {
    const before = (await computeTuitionFigures(db, 1, YEAR))!;
    const m = getAcademicMonths(YEAR)[1];
    const active = await newStudent({ status: "ACTIVE" });
    const departed = await newStudent({ status: "INACTIVE", inactiveDate: ago(5) });
    const over = await newStudent({ status: "ACTIVE" });
    const row = (sid: number, fin: number, paid: number, confirmed = true) => as(() => db.payment.create({
      data: { studentId: sid, categoryId: shk, amount: fin, finalAmount: fin, paidAmount: paid, balance: Math.max(0, fin - paid), dueDate: now, month: m.calMonth, year: m.calYear, method: "CASH", confirmed, paidDate: now },
    }));
    await row(active.id, 1000, 300);
    await row(active.id, 0, 200, false);           // e pakonfirmuar: s'llogaritet te përkufizimi i ri
    await row(departed.id, 500, 100);
    await row(over.id, 1000, 1200);
    const after = (await computeTuitionFigures(db, 1, YEAR))!;
    expect(after.target.debtActiveCents - before.target.debtActiveCents).toBe(70000);
    expect(after.target.debtDepartedCents - before.target.debtDepartedCents).toBe(40000);
    expect(after.target.creditCents - before.target.creditCents).toBe(20000);
    // "Borxhe Shkollimi" (karta lart) zbret edhe të pakonfirmuarat dhe përfshin të larguarin
    expect(after.dashboardDebtCents - before.dashboardDebtCents).toBe(50000 + 40000);
    const vs = await r08.run(ctx());
    const debt = vs.find(v => v.fingerprint === `R08:borxhi:${YEAR}`);
    if (debt) expect(debt.evidence).toHaveProperty("perkufizimiIRi.debtDepartedCents");
    expect(vs.some(v => v.fingerprint === `R08:kanale:${YEAR}`)).toBe(false); // Paguar = Cash + Bankë + Pa metodë
  });
});

describe("R09 nxënës të larguar", () => {
  it("kap borxhin e hapur dhe pagesën pas largimit; jo nxënësin aktiv", async () => {
    const left = await newStudent({ status: "INACTIVE", inactiveDate: ago(30) });
    const p = await as(() => db.payment.create({ data: { studentId: left.id, categoryId: shk, amount: 200, finalAmount: 200, balance: 150, paidAmount: 50, paidDate: ago(2), method: "CASH", dueDate: ago(40) } }));
    const f = await fps(r09);
    expect(f.has(`R09:borxh:${left.id}`)).toBe(true);
    expect(f.has(`R09:pagese:${p.id}`)).toBe(true);
    expect(f.has(`R09:borxh:${studentId}`)).toBe(false);
  });
});

describe("R10 aktivë pa detyrim", () => {
  it("kap nxënësin aktiv pa rresht Shkollimi; jo pasi i shtohet rreshti", async () => {
    const s = await newStudent({ status: "ACTIVE" });
    expect((await fps(r10)).has(`R10:${YEAR}:${s.id}`)).toBe(true);
    const m = getAcademicMonths(YEAR)[0];
    await as(() => db.payment.create({ data: { studentId: s.id, categoryId: shk, amount: 100, finalAmount: 100, dueDate: now, month: m.calMonth, year: m.calYear } }));
    expect((await fps(r10)).has(`R10:${YEAR}:${s.id}`)).toBe(false);
  });
});

describe("R11 cash i padorëzuar", () => {
  it("kap cash-in e vjetër; jo pasi dorëzohet", async () => {
    await pay({ paidAmount: 5000, paidDate: ago(20), method: "CASH" });
    const c = ctx();
    const v = (await r11.run(c)).find(x => x.fingerprint === `R11:CAT:${shk}`);
    expect(v?.amountCents).toBeGreaterThan(0);
    await as(() => db.expense.create({ data: { categoryId: shk, type: "HANDOVER", amount: v!.amountCents! / 100, date: now } }));
    expect((await fps(r11)).has(`R11:CAT:${shk}`)).toBe(false);
  });
});

describe("R12 shuma/data të pavlefshme", () => {
  it("kap të hyrën 0 € dhe shpenzimin me datë në të ardhmen; jo regjistrimet normale", async () => {
    const zero = await as(() => db.hyra.create({ data: { paguesit: "Zero", shuma: 0, muaj: 1, vit: 2026 } }));
    const normal = await as(() => db.hyra.create({ data: { paguesit: "Normal", shuma: 10, muaj: 1, vit: 2026 } }));
    const kat = await db.shpenzimKategori.findFirstOrThrow();
    const future = await as(() => db.shpenzim.create({ data: { kategoriId: kat.id, shuma: 10, data: new Date(now.getTime() + 10 * DAY_MS) } }));
    const today = await as(() => db.shpenzim.create({ data: { kategoriId: kat.id, shuma: 10, data: now } }));
    const f = await fps(r12);
    expect(f.has(`R12:hyra:${zero.id}`)).toBe(true);
    expect(f.has(`R12:hyra:${normal.id}`)).toBe(false);
    expect(f.has(`R12:shpenzim-ardhme:${future.id}`)).toBe(true);
    expect(f.has(`R12:shpenzim-ardhme:${today.id}`)).toBe(false);
  });
});

describe("motori", () => {
  it("ekzekutimi i dytë s'krijon dyfishime; statusi i shqyrtuar s'mbishkruhet", async () => {
    const r1 = await runAudit(db, { trigger: "MANUAL" });
    expect(r1.status).toBe("OK");
    expect(r1.findingsNew).toBeGreaterThan(0);
    const f = await db.auditFinding.findFirstOrThrow({ where: { ruleCode: "R12" } });
    await db.auditFinding.update({ where: { id: f.id }, data: { status: "NE_SHQYRTIM", title: "titull i shqyrtuar" } });
    const r2 = await runAudit(db, { trigger: "MANUAL" });
    expect(r2.findingsNew).toBe(0);
    expect(r2.findingsSeen).toBe(r1.findingsSeen);
    const again = await db.auditFinding.findUniqueOrThrow({ where: { id: f.id } });
    expect(again).toMatchObject({ status: "NE_SHQYRTIM", title: "titull i shqyrtuar" });
    expect(await db.auditFinding.count({ where: { fingerprint: f.fingerprint } })).toBe(1);
  });

  it("dy ekzekutime njëkohësisht: njëri shtyhet", async () => {
    const [a, b] = await Promise.all([runAudit(db, { trigger: "MANUAL" }), runAudit(db, { trigger: "MANUAL" })]);
    expect([a.skipped, b.skipped].filter(Boolean)).toHaveLength(1);
  });

  it("një rregull që dështon s'i ndal të tjerët", async () => {
    const broken: AuditRuleDef = { code: "TEST_PRISHUR", name: "x", description: "x", module: "X", severity: "E_ULET", run: async () => { throw new Error("prova"); } };
    const r = await runAudit(db, { trigger: "MANUAL", rules: [broken, r12] });
    expect(r.status).toBe("ME_GABIME");
    expect(r.ruleStats.TEST_PRISHUR.gabim).toBe("prova");
    expect(r.ruleStats.R12.gjetje).toBeGreaterThan(0);
  });

  it("rregulli i çaktivizuar s'ekzekutohet", async () => {
    await db.auditRule.update({ where: { code: "R12" }, data: { active: false } });
    const r = await runAudit(db, { trigger: "MANUAL", rules: [r12] });
    expect(r.ruleStats.R12).toBeUndefined();
    await db.auditRule.update({ where: { code: "R12" }, data: { active: true } });
  });
});

describe("planifikuesi i natës", () => {
  const at = (iso: string) => new Date(iso);
  it("ekzekutohet pas orës 02:00 nëse s'ka ekzekutim sot", () => {
    expect(isRunDue(at("2026-10-09T01:30:00Z"), at("2026-10-08T00:10:00Z"))).toBe(true);  // 03:30 Kosovë, i fundit dje 02:10
    expect(isRunDue(at("2026-10-09T01:30:00Z"), at("2026-10-09T00:05:00Z"))).toBe(false); // sot 02:05 — u bë
  });
  it("s'ekzekutohet para orës 02:00, përveç kur ka humbur një natë (> 26 orë)", () => {
    expect(isRunDue(at("2026-10-08T22:30:00Z"), at("2026-10-08T00:05:00Z"))).toBe(false); // 00:30 Kosovë
    expect(isRunDue(at("2026-10-08T22:30:00Z"), at("2026-10-07T00:05:00Z"))).toBe(true);  // natë e humbur
    expect(isRunDue(new Date(), null)).toBe(true);
  });
});
