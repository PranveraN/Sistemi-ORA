import type { Prisma } from "@prisma/client";

// Historiku i modulit TIMI INVEST (Faza 2) — çdo ndryshim te TIMI shkruhet te TimiAuditLog
// (kush, kur, çka, vlera e vjetër → e re, arsyeja). Vetëm shtohen rreshta, s'ndryshohen kurrë.

export interface TimiAuditEntry {
  action: "CREATE" | "UPDATE" | "DELETE" | "STORNO" | "RIKTHE";
  entity: "TimiInvestStudent" | "TimiPagese";
  entityId: number;
  tiId?: number | null;
  studentId?: number | null;
  field?: string | null;
  oldValue?: unknown;
  newValue?: unknown;
  reason?: string | null;
}

export interface TimiActor { id: number | null; name: string | null }


type AuditDb = { timiAuditLog: { createMany(args: { data: Prisma.TimiAuditLogCreateManyInput[] }): Promise<unknown> } };

const str = (v: unknown) => (v === undefined || v === null ? null : typeof v === "string" ? v : JSON.stringify(v));

export async function logTimi(db: AuditDb, orgId: number, actor: TimiActor, entries: TimiAuditEntry[]) {
  if (!entries.length) return;
  await db.timiAuditLog.createMany({
    data: entries.map(e => ({
      organizationId: orgId, userId: actor.id, userName: actor.name,
      action: e.action, entity: e.entity, entityId: e.entityId, tiId: e.tiId ?? null, studentId: e.studentId ?? null,
      field: e.field ?? null, oldValue: str(e.oldValue), newValue: str(e.newValue), reason: e.reason?.trim() || null,
    })),
  });
}

/** Arsyeja nga header-i X-Audit-Reason (e koduar me encodeURIComponent) ose nga body. */
export function reasonFrom(header: string | null, body?: unknown): string | null {
  let r = typeof body === "string" ? body : header ?? "";
  try { r = decodeURIComponent(r); } catch { /* lihet siç është */ }
  r = r.trim();
  return r.length ? r.slice(0, 500) : null;
}
