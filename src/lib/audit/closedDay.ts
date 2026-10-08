import type { PrismaClient } from "@prisma/client";
import { CASH_TABLES, movementsOf } from "./cashEffect";
import { loadCashBoxes, lastCountedDays } from "./cashClosing";
import type { AuditActor } from "./context";

// Ndryshimet pas numërimit të një arke (Faza 2). Vendim i Pranverës
// (2026-10-08): NUK bllokohet asgjë — çdo ndryshim lejohet, për çdo përdorues.
// Por çdo ndryshim që prek paratë e një arke në një ditë tashmë të numëruar
// (dita ≤ numërimi i fundit i asaj arke) krijon automatikisht gjetje auditimi,
// dhe te numërimi i radhës shfaqet si "regjistrim i vonuar" (cashClosing.ts).
// Kontrolli bëhet pas shkrimit, brenda të njëjtit transaksion, mbi rreshtat që
// sapo shkroi FinAuditLog — kështu dihet saktë vlera para/pas.

type TxDb = Pick<PrismaClient, "cashClosing" | "finAuditLog" | "auditFinding" | "paymentCategory" | "shpenzimKategori" | "$queryRawUnsafe">;

export async function maxAuditLogId(tx: Pick<PrismaClient, "$queryRawUnsafe">): Promise<number> {
  const r = await tx.$queryRawUnsafe<{ m: number | bigint | null }[]>(`SELECT MAX("id") AS m FROM "FinAuditLog"`);
  return Number(r[0]?.m ?? 0);
}

/** Thirret pas shkrimit, brenda transaksionit: shënon gjetje për çdo lëvizje në një ditë të numëruar. */
export async function recordClosedDayChanges(tx: TxDb, beforeLogId: number, actor: AuditActor): Promise<void> {
  const counted = await lastCountedDays(tx);
  if (counted.size === 0) return; // s'është numëruar asnjë arkë
  const logs = await tx.finAuditLog.findMany({ where: { id: { gt: beforeLogId }, tableName: { in: [...CASH_TABLES] } }, orderBy: { id: "asc" } });
  if (logs.length === 0) return;

  const orgId = [...counted.values()][0].organizationId;
  const boxes = (await loadCashBoxes(tx, orgId)).filter(b => counted.has(b.key));
  const parse = (s: string | null) => { if (!s) return null; try { return JSON.parse(s) as Record<string, unknown>; } catch { return null; } };
  for (const log of logs) {
    const oldRow = parse(log.oldValues), newRow = parse(log.newValues);
    for (const box of boxes) {
      const last = counted.get(box.key)!;
      for (const m of movementsOf(log.tableName, oldRow, newRow, box)) {
        if (m.day > last.date) continue;
        const fingerprint = `ARKA_MBYLLUR:${log.id}:${box.key}:${m.kind}:${m.day}`;
        await tx.auditFinding.upsert({
          where: { fingerprint },
          update: {},
          create: {
            organizationId: last.organizationId, ruleCode: "ARKA_MBYLLUR", severity: "E_LARTE", module: "ARKA",
            entityType: log.tableName, entityId: log.recordId, amountCents: m.cents,
            title: `Ndryshim pas numërimit të arkës "${box.label}" (${m.day}): ${m.cents > 0 ? "+" : "−"}${(Math.abs(m.cents) / 100).toFixed(2)} €`,
            description: `${actor.userName ?? "Përdorues i panjohur"} ndryshoi ${log.tableName} #${log.recordId ?? "—"} pasi arka "${box.label}" ishte numëruar (numërimi i fundit ${last.date}).${actor.reason ? ` Arsyeja: ${actor.reason}` : ""}`,
            evidence: JSON.stringify({ finAuditLogId: log.id, box: box.key, table: log.tableName, recordId: log.recordId, day: m.day, cents: m.cents, kind: m.kind, lastCounted: last.date, userId: actor.userId, userName: actor.userName, ip: actor.ip, reason: actor.reason }),
            fingerprint,
          },
        });
      }
    }
  }
}
