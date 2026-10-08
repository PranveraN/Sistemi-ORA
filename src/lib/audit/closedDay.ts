import type { PrismaClient } from "@prisma/client";
import { CASH_TABLES, movementsOf } from "./cashEffect";
import { loadCashScope } from "./cashClosing";
import type { AuditActor } from "./context";

// Bllokimi i ditëve të mbyllura (Faza 2). Pas mbylljes së arkës, çdo ndryshim që
// prek paratë e një dite të mbyllur (dita ≤ mbyllja e fundit) refuzohet — përveç
// Super Admin-it me arsye dhe konfirmim të posaçëm; ai ndryshim lejohet, por
// krijon automatikisht gjetje auditimi. Kontrolli bëhet pas shkrimit, brenda të
// njëjtit transaksion, mbi rreshtat që sapo shkroi FinAuditLog — kështu dihet
// saktë vlera para/pas; refuzimi e kthen gjithçka mbrapsht (rollback).

/** Shenja në mesazh — UI (ClosedDayGuard) e njeh dhe i ofron Super Admin-it konfirmimin. */
export const CLOSED_DAY_MARK = "[DITË E MBYLLUR]";

export class ClosedDayError extends Error {
  code = "CLOSED_DAY" as const;
  day: string;
  lockDay: string;
  constructor(day: string, lockDay: string, euros: string) {
    super(`${CLOSED_DAY_MARK} Arka e ditës ${day} është mbyllur (mbyllja e fundit: ${lockDay}). Ky ndryshim prek paratë e asaj dite (${euros} €). Vetëm Super Admin mund ta bëjë, me arsye.`);
    this.name = "ClosedDayError";
    this.day = day;
    this.lockDay = lockDay;
  }
}

export function asClosedDayError(e: unknown): ClosedDayError | null {
  if (e instanceof ClosedDayError) return e;
  if (e && typeof e === "object" && (e as { code?: unknown }).code === "CLOSED_DAY") return e as ClosedDayError;
  return null;
}

type TxDb = Pick<PrismaClient, "cashClosing" | "finAuditLog" | "auditFinding" | "setting" | "paymentCategory" | "shpenzimKategori" | "$queryRawUnsafe">;

export async function maxAuditLogId(tx: Pick<PrismaClient, "$queryRawUnsafe">): Promise<number> {
  const r = await tx.$queryRawUnsafe<{ m: number | bigint | null }[]>(`SELECT MAX("id") AS m FROM "FinAuditLog"`);
  return Number(r[0]?.m ?? 0);
}

/** Thirret pas shkrimit, brenda transaksionit. Hedh ClosedDayError nëse s'lejohet. */
export async function enforceClosedDays(tx: TxDb, beforeLogId: number, actor: AuditActor): Promise<void> {
  const last = await tx.cashClosing.findFirst({ orderBy: { date: "desc" }, select: { date: true, organizationId: true } });
  if (!last) return; // s'ka asnjë mbyllje — asgjë për të mbrojtur
  const logs = await tx.finAuditLog.findMany({ where: { id: { gt: beforeLogId }, tableName: { in: [...CASH_TABLES] } }, orderBy: { id: "asc" } });
  if (logs.length === 0) return;

  const scope = await loadCashScope(tx as unknown as PrismaClient, last.organizationId);
  const parse = (s: string | null) => { if (!s) return null; try { return JSON.parse(s) as Record<string, unknown>; } catch { return null; } };
  const hits: { logId: number; table: string; recordId: number | null; day: string; cents: number; kind: string }[] = [];
  for (const log of logs) {
    for (const m of movementsOf(log.tableName, parse(log.oldValues), parse(log.newValues), scope)) {
      if (m.day <= last.date) hits.push({ logId: log.id, table: log.tableName, recordId: log.recordId, day: m.day, cents: m.cents, kind: m.kind });
    }
  }
  if (hits.length === 0) return;

  const allowed = actor.role === "SUPERADMIN" && actor.override && !!actor.reason && actor.reason.trim().length >= 3;
  if (!allowed) {
    const h = hits[0];
    throw new ClosedDayError(h.day, last.date, (Math.abs(h.cents) / 100).toFixed(2));
  }
  for (const h of hits) {
    const fingerprint = `ARKA_MBYLLUR:${h.logId}:${h.kind}:${h.day}`;
    await tx.auditFinding.upsert({
      where: { fingerprint },
      update: {},
      create: {
        organizationId: last.organizationId, ruleCode: "ARKA_MBYLLUR", severity: "E_LARTE", module: "ARKA",
        entityType: h.table, entityId: h.recordId, amountCents: h.cents,
        title: `Ndryshim në ditë të mbyllur (${h.day}): ${h.cents > 0 ? "+" : "−"}${(Math.abs(h.cents) / 100).toFixed(2)} €`,
        description: `${actor.userName ?? "Super Admin"} ndryshoi ${h.table} #${h.recordId ?? "—"} pas mbylljes së arkës (mbyllja e fundit ${last.date}). Arsyeja: ${actor.reason}`,
        evidence: JSON.stringify({ finAuditLogId: h.logId, table: h.table, recordId: h.recordId, day: h.day, cents: h.cents, kind: h.kind, lockDay: last.date, userId: actor.userId, userName: actor.userName, ip: actor.ip, reason: actor.reason }),
        fingerprint,
      },
    });
  }
}
