import type { PrismaClient } from "@prisma/client";

// Kontrata e një rregulli auditimi (Faza 3). Çdo rregull është një funksion i
// veçantë, i testueshëm: merr kontekstin dhe kthen listën e shkeljeve. Motori
// (src/lib/audit/engine.ts) i kthen në gjetje, pa dyfishime (fingerprint).

export type Severity = "KRITIKE" | "E_LARTE" | "MESATARE" | "E_ULET";

/** Pragjet e konfigurueshme (Setting "audit.config"). */
export interface AuditConfig {
  /** R03: pagesë e regjistruar me datë më shumë se kaq ditë në të kaluarën. */
  backdateDays: number;
  /** R04: zbritja (%) mbi këtë kufi është gjetje. */
  maxDiscountPct: number;
  /** R05: dy pagesa të njëjta brenda kaq ditëve = dyfishim i mundshëm. */
  duplicateWindowDays: number;
  /** R11: cash i padorëzuar pas kaq ditësh. */
  undeliveredCashDays: number;
  /** R11: shuma minimale (€) e cash-it të padorëzuar që raportohet. */
  undeliveredMinEuro: number;
  /** R12: tolerancë (ditë) për data në të ardhmen. */
  futureToleranceDays: number;
  /** Sa larg pas kontrollohen regjistrimet (ditë) — për rregullat mbi historinë. */
  lookbackDays: number;
}

export const DEFAULT_AUDIT_CONFIG: AuditConfig = {
  backdateDays: 7,
  maxDiscountPct: 30,
  duplicateWindowDays: 3,
  undeliveredCashDays: 7,
  undeliveredMinEuro: 0,
  futureToleranceDays: 1,
  lookbackDays: 400,
};

export interface RuleContext {
  db: PrismaClient;
  orgId: number;
  now: Date;
  config: AuditConfig;
  /** Viti akademik aktual (p.sh. 2026 për 2026–2027). */
  academicYear: number;
}

export interface Violation {
  /** Unik dhe i qëndrueshëm: e njëjta shkelje → i njëjti fingerprint. */
  fingerprint: string;
  severity?: Severity; // parazgjedhje: rëndësia e rregullit
  module: string;
  entityType?: string;
  entityId?: number;
  amountCents?: number;
  title: string;
  description?: string;
  evidence?: Record<string, unknown>;
}

export interface AuditRuleDef {
  code: string;
  name: string;
  description: string;
  module: string;
  severity: Severity;
  /** Gjetjet e këtij rregulli krijohen drejtpërdrejt (p.sh. gjatë numërimit) — motori s'e ekzekuton. */
  live?: boolean;
  run(ctx: RuleContext): Promise<Violation[]>;
}

export const euro = (cents: number) => `${(cents / 100).toFixed(2).replace(".", ",")} €`;
export const cents = (v: unknown) => Math.round((Number(v) || 0) * 100);
export const DAY_MS = 86400000;
