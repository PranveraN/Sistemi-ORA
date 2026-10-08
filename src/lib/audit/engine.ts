import type { PrismaClient } from "@prisma/client";
import { DEFAULT_ACADEMIC_YEAR } from "@/lib/academicYear";
import { AUDIT_RULES } from "./rules";
import { loadAuditConfig } from "./config";
import type { AuditRuleDef, RuleContext, Violation } from "./rules/types";

// Motori i rregullave (Faza 3). Ekzekuton çdo rregull aktiv dhe i kthen shkeljet
// në gjetje (AuditFinding), pa dyfishime: fingerprint-i është unik.
//   • gjetje e re         → krijohet me statusin E_RE
//   • gjetje ekzistuese   → shënohet lastSeenAt; nëse është ende E_RE, përditësohen
//                           edhe titulli/përshkrimi/shuma/dëshmia (shifrat e fundit);
//                           nëse dikush e ka shqyrtuar (statusi tjetër), s'preket.
// Bllokimi: vetëm një ekzekutim në të njëjtën kohë — brenda procesit (flag) dhe në
// databazë (një AuditRun RUNNING më i ri se 2 orë e ndalon një tjetër).

export type RunTrigger = "NATA" | "MANUAL" | "NISJA";
const STALE_MS = 2 * 60 * 60 * 1000;
let runningInProcess = false;

/** Sinkronizon përkufizimet nga kodi te tabela AuditRule (emri/përshkrimi); "active" dhe "severity" i mban nga databaza. */
export async function syncRules(db: PrismaClient, rules: AuditRuleDef[] = AUDIT_RULES) {
  for (const r of rules) {
    await db.auditRule.upsert({
      where: { code: r.code },
      update: { name: r.name, description: r.description, module: r.module },
      create: { code: r.code, name: r.name, description: r.description, module: r.module, severity: r.severity },
    });
  }
  return db.auditRule.findMany();
}

export interface RunResult {
  skipped?: "NE_PROCES";
  runId?: number;
  status?: string;
  findingsNew: number;
  findingsSeen: number;
  ruleStats: Record<string, { gjetje: number; reja: number; ms: number; gabim?: string }>;
}

async function upsertFinding(db: PrismaClient, orgId: number, runId: number, rule: { code: string; severity: string }, v: Violation, now: Date): Promise<boolean> {
  const existing = await db.auditFinding.findUnique({ where: { fingerprint: v.fingerprint }, select: { id: true, status: true } });
  const evidence = v.evidence ? JSON.stringify(v.evidence) : null;
  if (!existing) {
    await db.auditFinding.create({
      data: {
        organizationId: orgId, ruleCode: rule.code, runId, severity: v.severity ?? rule.severity, module: v.module,
        entityType: v.entityType ?? null, entityId: v.entityId ?? null, amountCents: v.amountCents ?? null,
        title: v.title, description: v.description ?? null, evidence, fingerprint: v.fingerprint, lastSeenAt: now,
      },
    });
    return true;
  }
  await db.auditFinding.update({
    where: { id: existing.id },
    data: existing.status === "E_RE"
      ? { lastSeenAt: now, title: v.title, description: v.description ?? null, evidence, amountCents: v.amountCents ?? null, severity: v.severity ?? rule.severity }
      : { lastSeenAt: now },
  });
  return false;
}

/** Ekzekuton të gjitha rregullat aktive. Kthen `skipped` nëse një ekzekutim tjetër është në proces. */
export async function runAudit(db: PrismaClient, opts: { trigger: RunTrigger; orgId?: number; userName?: string | null; now?: Date; rules?: AuditRuleDef[] }): Promise<RunResult> {
  const empty: RunResult = { findingsNew: 0, findingsSeen: 0, ruleStats: {} };
  if (runningInProcess) return { ...empty, skipped: "NE_PROCES" };
  runningInProcess = true;
  const now = opts.now ?? new Date();
  const orgId = opts.orgId ?? 1;
  let runId: number | null = null;
  try {
    // Bllokimi në databazë — kontrolli dhe krijimi brenda një transaksioni
    runId = await db.$transaction(async tx => {
      const busy = await tx.auditRun.findFirst({ where: { status: "RUNNING", startedAt: { gt: new Date(Date.now() - STALE_MS) } } });
      if (busy) return null;
      await tx.auditRun.updateMany({ where: { status: "RUNNING" }, data: { status: "DESHTOI", finishedAt: new Date(), error: "U ndërpre (serveri u rinis gjatë ekzekutimit)" } });
      return (await tx.auditRun.create({ data: { trigger: opts.trigger, userName: opts.userName ?? null } })).id;
    });
    if (runId == null) return { ...empty, skipped: "NE_PROCES" };

    const rulesDef = opts.rules ?? AUDIT_RULES;
    const dbRules = new Map((await syncRules(db, rulesDef)).map(r => [r.code, r]));
    const ctx: RuleContext = { db, orgId, now, config: await loadAuditConfig(db), academicYear: DEFAULT_ACADEMIC_YEAR };
    const result: RunResult = { runId, findingsNew: 0, findingsSeen: 0, ruleStats: {} };
    let failures = 0;
    for (const def of rulesDef) {
      const row = dbRules.get(def.code);
      if (def.live || !row?.active) continue;
      const t0 = Date.now();
      try {
        const violations = await def.run(ctx);
        let reja = 0;
        for (const v of violations) if (await upsertFinding(db, orgId, runId, { code: def.code, severity: row.severity }, v, now)) reja++;
        result.findingsNew += reja;
        result.findingsSeen += violations.length;
        result.ruleStats[def.code] = { gjetje: violations.length, reja, ms: Date.now() - t0 };
      } catch (e) {
        failures++;
        result.ruleStats[def.code] = { gjetje: 0, reja: 0, ms: Date.now() - t0, gabim: e instanceof Error ? e.message : String(e) };
        console.error(`[auditimi] rregulli ${def.code} dështoi:`, e);
      }
    }
    result.status = failures === 0 ? "OK" : "ME_GABIME";
    await db.auditRun.update({
      where: { id: runId },
      data: { status: result.status, finishedAt: new Date(), findingsNew: result.findingsNew, findingsSeen: result.findingsSeen, ruleStats: JSON.stringify(result.ruleStats),
        error: failures ? `${failures} rregulla dështuan` : null },
    });
    return result;
  } catch (e) {
    if (runId != null) {
      await db.auditRun.update({ where: { id: runId }, data: { status: "DESHTOI", finishedAt: new Date(), error: e instanceof Error ? e.message : String(e) } }).catch(() => {});
    }
    throw e;
  } finally {
    runningInProcess = false;
  }
}
