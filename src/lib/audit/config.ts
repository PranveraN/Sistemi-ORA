import type { PrismaClient } from "@prisma/client";
import { DEFAULT_AUDIT_CONFIG, type AuditConfig } from "./rules/types";

// Pragjet e rregullave të auditimit — ruhen te Setting "audit.config" (JSON).
// Vlerat që mungojnë marrin parazgjedhjen; vlerat e pavlefshme refuzohen.

export const AUDIT_CONFIG_KEY = "audit.config";

const LIMITS: Record<keyof AuditConfig, [number, number]> = {
  backdateDays: [0, 365],
  maxDiscountPct: [0, 100],
  duplicateWindowDays: [0, 60],
  undeliveredCashDays: [0, 365],
  undeliveredMinEuro: [0, 1_000_000],
  futureToleranceDays: [0, 30],
  lookbackDays: [7, 3650],
};

export async function loadAuditConfig(db: Pick<PrismaClient, "setting">): Promise<AuditConfig> {
  const row = await db.setting.findUnique({ where: { key: AUDIT_CONFIG_KEY } });
  let saved: Partial<AuditConfig> = {};
  try { saved = row ? JSON.parse(row.value) : {}; } catch { saved = {}; }
  const cfg = { ...DEFAULT_AUDIT_CONFIG };
  for (const k of Object.keys(LIMITS) as (keyof AuditConfig)[]) {
    const v = Number(saved[k]);
    if (Number.isFinite(v) && v >= LIMITS[k][0] && v <= LIMITS[k][1]) cfg[k] = v;
  }
  return cfg;
}

/** Ruan pragjet; kthen gabim në shqip për vlerat jashtë kufijve. */
export async function saveAuditConfig(db: Pick<PrismaClient, "setting">, input: Record<string, unknown>): Promise<AuditConfig> {
  const current = await loadAuditConfig(db);
  for (const k of Object.keys(LIMITS) as (keyof AuditConfig)[]) {
    if (input[k] === undefined) continue;
    const v = Number(input[k]);
    const [min, max] = LIMITS[k];
    if (!Number.isFinite(v) || v < min || v > max) throw new Error(`Vlera për "${k}" duhet të jetë mes ${min} dhe ${max}.`);
    current[k] = v;
  }
  const value = JSON.stringify(current);
  await db.setting.upsert({ where: { key: AUDIT_CONFIG_KEY }, update: { value }, create: { key: AUDIT_CONFIG_KEY, value } });
  return current;
}
