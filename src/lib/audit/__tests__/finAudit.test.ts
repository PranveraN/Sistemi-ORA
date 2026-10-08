import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { PrismaClient } from "@prisma/client";
import { createPrismaClient } from "@/lib/prisma";
import { ensureAuditTriggers } from "@/lib/audit/triggers";
import { auditStorage, withAuditReason } from "@/lib/audit/context";

// Faza 1 — gjurma e auditimit. Punon mbi një kopje të përkohshme të
// prisma/test-copy.db (asnjëherë mbi databazën reale).

const SRC = path.resolve(__dirname, "../../../../prisma/test-copy.db");
const TMP = path.join(os.tmpdir(), `finaudit-test-${process.pid}-${Date.now()}.db`);
let db: PrismaClient;

interface LogRow { id: number; tableName: string; recordId: number | null; action: string; oldValues: string | null; newValues: string | null; userId: number | null; reason: string | null; source: string }
const logsSince = (afterId: number) =>
  db.$queryRawUnsafe<LogRow[]>(`SELECT * FROM "FinAuditLog" WHERE id > ? ORDER BY id`, afterId);
const lastLogId = async () => Number((await db.$queryRawUnsafe<{ m: number | null }[]>(`SELECT MAX(id) AS m FROM "FinAuditLog"`))[0]?.m ?? 0);
const contextRows = async () => Number((await db.$queryRawUnsafe<{ n: number }[]>(`SELECT COUNT(*) AS n FROM "FinAuditContext"`))[0].n);

let studentId = 0, categoryId = 0;

beforeAll(async () => {
  fs.copyFileSync(SRC, TMP);
  db = createPrismaClient(`file:${TMP.replace(/\\/g, "/")}`);
  await ensureAuditTriggers(db);
  const p = await db.payment.findFirstOrThrow({ select: { studentId: true, categoryId: true } });
  studentId = p.studentId; categoryId = p.categoryId;
});

afterAll(async () => {
  await db?.$disconnect();
  try { fs.unlinkSync(TMP); } catch { /* skedari i përkohshëm */ }
});

describe("triggers", () => {
  it("janë idempotente — ekzekutimi i dytë s'krijon asgjë", async () => {
    const r = await ensureAuditTriggers(db);
    expect(r.created).toBe(0);
    expect(r.unchanged).toBeGreaterThan(40);
    expect(r.skipped).toEqual([]);
  });
});

describe("shkrim i vetëm", () => {
  it("krijimi regjistrohet me arsyen dhe source=APP; konteksti pastrohet", async () => {
    const before = await lastLogId();
    const h = await withAuditReason("test krijimi", () =>
      db.hyra.create({ data: { paguesit: "Test", shuma: 12.5, muaj: 10, vit: 2026, metoda: "CASH" } }));
    const logs = await logsSince(before);
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ tableName: "Hyra", recordId: h.id, action: "CREATE", reason: "test krijimi", source: "APP" });
    expect(JSON.parse(logs[0].newValues!)).toMatchObject({ shuma: 12.5, paguesit: "Test" });
    expect(await contextRows()).toBe(0);
  });

  it("ndryshimi ruan vlerat e vjetra dhe të reja", async () => {
    const h = await db.hyra.create({ data: { paguesit: "A", shuma: 10, muaj: 10, vit: 2026 } });
    const before = await lastLogId();
    await db.hyra.update({ where: { id: h.id }, data: { shuma: 99 } });
    const [log] = await logsSince(before);
    expect(log.action).toBe("UPDATE");
    expect(JSON.parse(log.oldValues!).shuma).toBe(10);
    expect(JSON.parse(log.newValues!).shuma).toBe(99);
  });

  it("ndryshim pa ndryshim real vlerash (vetëm updatedAt) s'regjistrohet", async () => {
    const h = await db.hyra.create({ data: { paguesit: "B", shuma: 5, muaj: 10, vit: 2026 } });
    const before = await lastLogId();
    await db.hyra.update({ where: { id: h.id }, data: { shuma: 5 } });
    expect(await logsSince(before)).toHaveLength(0);
  });

  it("fshirja ruan kopjen e plotë të rreshtit", async () => {
    const h = await db.hyra.create({ data: { paguesit: "C", shuma: 77, muaj: 10, vit: 2026 } });
    const before = await lastLogId();
    await withAuditReason("gabim regjistrimi", () => db.hyra.delete({ where: { id: h.id } }));
    const [log] = await logsSince(before);
    expect(log).toMatchObject({ action: "DELETE", recordId: h.id, reason: "gabim regjistrimi", newValues: null });
    expect(JSON.parse(log.oldValues!)).toMatchObject({ id: h.id, shuma: 77, paguesit: "C" });
  });

  it("SQL i papërpunuar (anashkalim i kodit) kapet gjithsesi, me source=DB", async () => {
    const h = await db.hyra.create({ data: { paguesit: "D", shuma: 1, muaj: 10, vit: 2026 } });
    const before = await lastLogId();
    await db.$executeRawUnsafe(`UPDATE "Hyra" SET shuma = 2 WHERE id = ?`, h.id);
    const [log] = await logsSince(before);
    expect(log).toMatchObject({ action: "UPDATE", source: "DB", userId: null });
  });
});

describe("transaksionet", () => {
  it("interaktiv: çdo shkrim merr arsyen; konteksti hiqet në fund", async () => {
    const before = await lastLogId();
    await withAuditReason("tx interaktiv", () => db.$transaction(async tx => {
      const a = await tx.hyra.create({ data: { paguesit: "T1", shuma: 3, muaj: 10, vit: 2026 } });
      await tx.hyra.update({ where: { id: a.id }, data: { shuma: 4 } });
    }));
    const logs = await logsSince(before);
    expect(logs.map(l => l.action)).toEqual(["CREATE", "UPDATE"]);
    expect(logs.every(l => l.reason === "tx interaktiv" && l.source === "APP")).toBe(true);
    expect(await contextRows()).toBe(0);
  });

  it("interaktiv që dështon: asgjë s'mbetet (as gjurma, as konteksti)", async () => {
    const before = await lastLogId();
    await expect(db.$transaction(async tx => {
      await tx.hyra.create({ data: { paguesit: "X", shuma: 1, muaj: 10, vit: 2026 } });
      throw new Error("ndal");
    })).rejects.toThrow("ndal");
    expect(await logsSince(before)).toHaveLength(0);
    expect(await contextRows()).toBe(0);
  });

  it("listë ([...]): të gjitha regjistrohen me arsyen dhe rezultatet kthehen si më parë", async () => {
    const before = await lastLogId();
    const res = await withAuditReason("tx listë", () => db.$transaction([
      db.hyra.create({ data: { paguesit: "L1", shuma: 1, muaj: 10, vit: 2026 } }),
      db.hyra.create({ data: { paguesit: "L2", shuma: 2, muaj: 10, vit: 2026 } }),
    ]));
    expect(res.map(r => r.paguesit)).toEqual(["L1", "L2"]);
    const logs = await logsSince(before);
    expect(logs).toHaveLength(2);
    expect(logs.every(l => l.reason === "tx listë" && l.source === "APP")).toBe(true);
    expect(await contextRows()).toBe(0);
  });
});

describe("vetëm shtim", () => {
  it("FinAuditLog s'mund të ndryshohet", async () => {
    await expect(db.$executeRawUnsafe(`UPDATE "FinAuditLog" SET reason = 'x'`)).rejects.toThrow();
  });
  it("FinAuditLog s'mund të fshihet", async () => {
    await expect(db.$executeRawUnsafe(`DELETE FROM "FinAuditLog"`)).rejects.toThrow();
  });
});

describe("tabela me kolona të kufizuara (Student)", () => {
  it("ndryshimi i emrit s'regjistrohet, ndryshimi i zbritjes po", async () => {
    const s = await db.student.findFirstOrThrow({ select: { id: true, firstName: true, discountPct: true } });
    const before = await lastLogId();
    await db.student.update({ where: { id: s.id }, data: { firstName: `${s.firstName}x` } });
    expect(await logsSince(before)).toHaveLength(0);
    await db.student.update({ where: { id: s.id }, data: { discountPct: (s.discountPct ?? 0) + 10 } });
    const logs = await logsSince(before);
    expect(logs).toHaveLength(1);
    const nv = JSON.parse(logs[0].newValues!);
    expect(nv.discountPct).toBe((s.discountPct ?? 0) + 10);
    expect(nv.firstName).toBeUndefined();
  });
});

describe("createdById", () => {
  it("pagesa e re merr id-në e përdoruesit të kyçur", async () => {
    const actor = { userId: 4242, userName: "Testues", ip: "1.2.3.4", userAgent: "vitest", reason: null };
    const before = await lastLogId();
    const p = await auditStorage.run({ actor }, async () => await db.payment.create({
      data: { studentId, categoryId, amount: 10, finalAmount: 10, dueDate: new Date(), balance: 10 },
    }));
    expect(p.createdById).toBe(4242);
    const [log] = await logsSince(before);
    expect(log).toMatchObject({ tableName: "Payment", userId: 4242, source: "APP" });
  });
});
