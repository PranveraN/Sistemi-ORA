import type { PrismaClient } from "@prisma/client";
import { DAY_MS, type RuleContext } from "./types";

export type Row = Record<string, unknown>;

export interface ParsedLog {
  id: number;
  tableName: string;
  recordId: number | null;
  action: string;
  oldRow: Row | null;
  newRow: Row | null;
  userId: number | null;
  userName: string | null;
  reason: string | null;
  source: string;
  createdAt: Date;
}

const parse = (s: string | null): Row | null => { if (!s) return null; try { return JSON.parse(s) as Row; } catch { return null; } };

/** Rreshtat e gjurmës (FinAuditLog) për tabelat e dhëna, brenda dritares së kontrollit. */
export async function auditLogs(ctx: RuleContext, tables: string[]): Promise<ParsedLog[]> {
  const since = new Date(ctx.now.getTime() - ctx.config.lookbackDays * DAY_MS);
  const logs = await ctx.db.finAuditLog.findMany({
    where: { tableName: { in: tables }, createdAt: { gte: since } },
    orderBy: { id: "asc" },
  });
  return logs.map(l => ({
    id: l.id, tableName: l.tableName, recordId: l.recordId, action: l.action,
    oldRow: parse(l.oldValues), newRow: parse(l.newValues),
    userId: l.userId, userName: l.userName, reason: l.reason, source: l.source, createdAt: l.createdAt,
  }));
}

export const num = (v: unknown) => Number(v) || 0;
export const ms = (v: unknown): number | null => {
  if (v == null) return null;
  if (v instanceof Date) return v.getTime();
  if (typeof v === "number") return v;
  const n = /^\d+$/.test(String(v)) ? Number(v) : Date.parse(String(v));
  return Number.isFinite(n) ? n : null;
};
export const fmtDate = (v: unknown) => { const t = ms(v); return t == null ? "—" : new Date(t).toLocaleDateString("sq-AL", { timeZone: "Europe/Belgrade" }); };

/** Emrat e nxënësve për id-të e dhëna (për tekstet e gjetjeve). */
export async function studentNames(db: PrismaClient, ids: number[]): Promise<Map<number, string>> {
  if (ids.length === 0) return new Map();
  const rows = await db.student.findMany({ where: { id: { in: [...new Set(ids)] } }, select: { id: true, firstName: true, lastName: true } });
  return new Map(rows.map(s => [s.id, `${s.firstName} ${s.lastName}`]));
}

/** Emrat e kategorive të pagesave. */
export async function categoryNames(db: PrismaClient, orgId: number): Promise<Map<number, string>> {
  const rows = await db.paymentCategory.findMany({ where: { organizationId: orgId }, select: { id: true, name: true } });
  return new Map(rows.map(c => [c.id, c.name]));
}
