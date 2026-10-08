import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import os from "os";
import path from "path";
import type { PrismaClient } from "@prisma/client";

// Faza 4 — qasja (roli Auditor, moduli Auditimi) dhe historiku i ndryshimeve.
// Kopje e përkohshme e prisma/test-copy.db; DATABASE_URL vendoset para importeve,
// që edhe klienti global (src/lib/prisma.ts) të mos prekë kurrë databazën reale.

const SRC = path.resolve(__dirname, "../../../../prisma/test-copy.db");
const TMP = path.join(os.tmpdir(), `phase4-test-${process.pid}-${Date.now()}.db`);
fs.copyFileSync(SRC, TMP);
process.env.DATABASE_URL = `file:${TMP.replace(/\\/g, "/")}`;

let db: PrismaClient;
let getAllowedModules: (org: number, role: string) => Promise<string[]>;
let entityHistory: typeof import("@/lib/audit/history").entityHistory;

beforeAll(async () => {
  const { prisma } = await import("@/lib/prisma");
  db = prisma;
  const { ensureAuditTriggers } = await import("@/lib/audit/triggers");
  await ensureAuditTriggers(db);
  ({ getAllowedModules } = await import("@/lib/modulePermissions"));
  ({ entityHistory } = await import("@/lib/audit/history"));
});

afterAll(async () => {
  await db?.$disconnect();
  try { fs.unlinkSync(TMP); } catch { /* skedari i përkohshëm */ }
});

describe("roli Auditor dhe moduli Auditimi", () => {
  it("Auditori merr Auditimin dhe modulet financiare, jo Materialet/Kërkesat", async () => {
    const m = await getAllowedModules(1, "AUDITOR");
    expect(m).toContain("auditimi");
    expect(m).toEqual(expect.arrayContaining(["shkollimi", "ushqimi", "payments", "invoices", "bilanci", "arka", "historiku"]));
    expect(m).not.toContain("materiale");
    expect(m).not.toContain("kerkesat");
  });

  it("Admini/Financa/Sekretaria s'e marrin Auditimin — as kur i jepet me dorë te lejet", async () => {
    for (const role of ["ADMIN", "FINANCE", "SECRETARY", "PEDAGOGIA"]) expect(await getAllowedModules(1, role)).not.toContain("auditimi");
    await db.roleModulePermission.create({ data: { organizationId: 1, role: "FINANCE", moduleKey: "auditimi", allowed: true } });
    expect(await getAllowedModules(1, "FINANCE")).not.toContain("auditimi");
  });

  it("Super Admin i merr të gjitha", async () => {
    expect(await getAllowedModules(1, "SUPERADMIN")).toContain("auditimi");
  });
});

describe("historiku i ndryshimeve", () => {
  it("tregon krijimin, ndryshimin (vetëm fushat e ndryshuara) dhe fshirjen", async () => {
    const p = await db.payment.findFirstOrThrow({ select: { studentId: true, categoryId: true } });
    const x = await db.payment.create({ data: { studentId: p.studentId, categoryId: p.categoryId, amount: 50, finalAmount: 50, dueDate: new Date(), paidAmount: 10, method: "CASH" } });
    await db.payment.update({ where: { id: x.id }, data: { paidAmount: 30, note: "pjesa e dytë" } });
    await db.payment.delete({ where: { id: x.id } });
    const h = await entityHistory(db, "Payment", x.id);
    expect(h.map(e => e.action)).toEqual(["DELETE", "UPDATE", "CREATE"]);
    const upd = h[1].changes.map(c => c.field).sort();
    expect(upd).toEqual(["note", "paidAmount"]);
    expect(h[1].changes.find(c => c.field === "paidAmount")).toMatchObject({ label: "Paguar", from: 10, to: 30 });
  });

  it("fatura: përfshin edhe ndryshimet e zërave të saj", async () => {
    const s = await db.student.findFirstOrThrow({ select: { id: true } });
    const inv = await db.invoice.create({ data: { number: "FAT-2040-0001", type: "INVOICE", studentId: s.id, subtotal: 10, total: 10, items: { create: { description: "Libër", unitPrice: 10, total: 10 } } } });
    const h = await entityHistory(db, "Invoice", inv.id);
    expect(h.map(e => e.table).sort()).toEqual(["Invoice", "InvoiceItem"]);
  });

  it("tabelë e paaudituar → bosh", async () => {
    expect(await entityHistory(db, "Setting", 1)).toEqual([]);
  });
});
