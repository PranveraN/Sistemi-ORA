import { AsyncLocalStorage } from "node:async_hooks";

// Konteksti i auditimit për kërkesën aktuale: kush po e bën ndryshimin, nga
// cila IP/shfletues, dhe me çfarë arsyeje. Lexohet nga shtresa qendrore e
// Prisma-s (src/lib/prisma.ts) dhe shkruhet te FinAuditContext, prej nga e
// marrin triggers e SQLite (src/lib/audit/triggers.ts).

export interface AuditActor {
  userId: number | null;
  userName: string | null;
  ip: string | null;
  userAgent: string | null;
  reason: string | null;
  /** Roli i përdoruesit (p.sh. SUPERADMIN) — për lejen e posaçme te ditët e mbyllura. */
  role?: string | null;
  /** Konfirmimi i posaçëm për të ndryshuar një ditë të mbyllur (header X-Closed-Day-Override). */
  override?: boolean;
}

/** Klienti i transaksionit interaktiv (vetëm metodat që na duhen). */
export interface AuditTx {
  $executeRawUnsafe(query: string, ...values: unknown[]): Promise<number>;
}

export interface AuditStore {
  actor?: AuditActor;
  reason?: string | null;
  tx?: AuditTx;
  txState?: { ctxSet: boolean };
  batch?: boolean;
}

export const auditStorage = new AsyncLocalStorage<AuditStore>();

/** Header-i me të cilin UI dërgon arsyen e fshirjes (i koduar me encodeURIComponent). */
export const AUDIT_REASON_HEADER = "x-audit-reason";
export const CLOSED_DAY_OVERRIDE_HEADER = "x-closed-day-override";

export const SET_CONTEXT_SQL =
  `INSERT OR REPLACE INTO "FinAuditContext" ("id","userId","userName","ip","userAgent","reason") VALUES (1, ?, ?, ?, ?, ?)`;
export const CLEAR_CONTEXT_SQL = `DELETE FROM "FinAuditContext" WHERE "id" = 1`;

export const contextParams = (a: AuditActor) => [a.userId, a.userName, a.ip, a.userAgent, a.reason];

export function decodeReason(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let r = raw;
  try { r = decodeURIComponent(raw); } catch { /* lihet siç është */ }
  r = r.trim().slice(0, 500);
  return r || null;
}

/** Ekzekuton `fn` me një arsye të caktuar (p.sh. procese të brendshme). */
export function withAuditReason<T>(reason: string, fn: () => Promise<T>): Promise<T> {
  const parent = auditStorage.getStore();
  // `await` brenda run(): premtimet e Prisma-s nisin vetëm kur priten, ndaj
  // duhet të priten brenda kontekstit, jo jashtë tij.
  return auditStorage.run({ ...parent, reason }, async () => await fn());
}

/**
 * Kush po e bën ndryshimin. Brenda një kërkese HTTP: përdoruesi i kyçur (nga
 * JWT — pa lexim databaze), IP-ja, shfletuesi dhe arsyeja nga header-i.
 * Jashtë kërkesës (planifikues, skripte): të gjitha bosh.
 */
export async function resolveActor(): Promise<AuditActor> {
  const store = auditStorage.getStore();
  if (store?.actor) return { ...store.actor, reason: store.reason ?? store.actor.reason };

  const actor: AuditActor = { userId: null, userName: null, ip: null, userAgent: null, reason: null, role: null, override: false };
  let inRequest = false;
  try {
    const { headers } = await import("next/headers");
    const h = await headers();
    inRequest = true;
    actor.ip = h.get("cf-connecting-ip") || h.get("x-forwarded-for")?.split(",")[0].trim() || h.get("x-real-ip") || null;
    actor.userAgent = h.get("user-agent")?.slice(0, 300) ?? null;
    actor.reason = decodeReason(h.get(AUDIT_REASON_HEADER));
    actor.override = h.get(CLOSED_DAY_OVERRIDE_HEADER) === "1";
  } catch {
    // jashtë kërkesës HTTP
  }
  if (inRequest) {
    try {
      const { auth } = await import("@/lib/auth");
      const session = await auth();
      const u = session?.user as { id?: string; name?: string | null; role?: string } | undefined;
      actor.userId = parseInt(u?.id ?? "") || null;
      actor.userName = u?.name ?? null;
      actor.role = u?.role ?? null;
    } catch {
      // pa sesion
    }
  }
  if (store) store.actor = actor;
  return { ...actor, reason: store?.reason ?? actor.reason };
}
