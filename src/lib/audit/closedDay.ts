import type { PrismaClient } from "@prisma/client";
import { CASH_TABLES, movementsOf } from "./cashEffect";
import { loadCashScope } from "./cashClosing";
import type { AuditActor } from "./context";

// Ndryshimet në ditë të mbyllura të arkës (Faza 2). Vendim i Pranverës
// (2026-10-08): NUK bllokohet asgjë — çdo ndryshim lejohet, për çdo përdorues.
// Por çdo ndryshim që prek paratë e një dite të mbyllur (dita ≤ mbyllja e
// fundit) krijon automatikisht gjetje auditimi, dhe te mbyllja e radhës
// shfaqet si "regjistrim i vonuar" (cashClosing.ts). Kontrolli bëhet pas
// shkrimit, brenda të njëjtit transaksion, mbi rreshtat që sapo shkroi
// FinAuditLog — kështu dihet saktë vlera para/pas.

type TxDb = Pick<PrismaClient, "cashClosing" | "finAuditLog" | "auditFinding" | "setting" | "paymentCategory" | "shpenzimKategori" | "$queryRawUnsafe">;

export async function maxAuditLogId(tx: Pick<PrismaClient, "$queryRawUnsafe">): Promise<number> {
  const r = await tx.$queryRawUnsafe<{ m: number | bigint | null }[]>(`SELECT MAX("id") AS m FROM "FinAuditLog"`);
  return Number(r[0]?.m ?? 0);
}

/** Thirret pas shkrimit, brenda transaksionit: shënon gjetje për çdo lëvizje në ditë të mbyllur. */
export async function recordClosedDayChanges(tx: TxDb, beforeLogId: number, actor: AuditActor): Promise<void> {
  const last = await tx.cashClosing.findFirst({ orderBy: { date: "desc" }, select: { date: true, organizationId: true } });
  if (!last) return; // s'ka asnjë mbyllje
  const logs = await tx.finAuditLog.findMany({ where: { id: { gt: beforeLogId }, tableName: { in: [...CASH_TABLES] } }, orderBy: { id: "asc" } });
  if (logs.length === 0) return;

  const scope = await loadCashScope(tx as unknown as PrismaClient, last.organizationId);
  const parse = (s: string | null) => { if (!s) return null; try { return JSON.parse(s) as Record<string, unknown>; } catch { return null; } };
  for (const log of logs) {
    for (const m of movementsOf(log.tableName, parse(log.oldValues), parse(log.newValues), scope)) {
      if (m.day > last.date) continue;
      const fingerprint = `ARKA_MBYLLUR:${log.id}:${m.kind}:${m.day}`;
      await tx.auditFinding.upsert({
        where: { fingerprint },
        update: {},
        create: {
          organizationId: last.organizationId, ruleCode: "ARKA_MBYLLUR", severity: "E_LARTE", module: "ARKA",
          entityType: log.tableName, entityId: log.recordId, amountCents: m.cents,
          title: `Ndryshim në ditë të mbyllur (${m.day}): ${m.cents > 0 ? "+" : "−"}${(Math.abs(m.cents) / 100).toFixed(2)} €`,
          description: `${actor.userName ?? "Përdorues i panjohur"} ndryshoi ${log.tableName} #${log.recordId ?? "—"} pas mbylljes së arkës (mbyllja e fundit ${last.date}).${actor.reason ? ` Arsyeja: ${actor.reason}` : ""}`,
          evidence: JSON.stringify({ finAuditLogId: log.id, table: log.tableName, recordId: log.recordId, day: m.day, cents: m.cents, kind: m.kind, lockDay: last.date, userId: actor.userId, userName: actor.userName, ip: actor.ip, reason: actor.reason }),
          fingerprint,
        },
      });
    }
  }
}
