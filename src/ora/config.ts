import { prisma } from "@/lib/prisma";

// Konfigurimi i asistentit "Ora". Vlerat ruhen te Cilësimet (tabela Setting)
// që të ndryshohen nga faqja "Ora · Asistenti" pa ndryshuar kodin. Çelësi API
// lexohet VETËM nga mjedisi i serverit (ANTHROPIC_API_KEY) — kurrë nga klienti.

export const ORA_SETTING_KEYS = {
  enabled: "oraEnabled",
  roles: "oraRoles",
  model: "oraModel",
  modelComplex: "oraModelComplex",
  dailyLimit: "oraDailyLimit",
  retentionDays: "oraRetentionDays",
  aiFallback: "oraAiFallback",
} as const;

// Modelet sipas dokumentacionit zyrtar (platform.claude.com/docs, 2026-10):
// Sonnet 5.5 = "shpejtësi + inteligjencë"; Opus 5.5 për pyetje komplekse.
// Haiku 4.5 s'është parazgjedhje: mund të tërhiqet pas 15.10.2026.
export const ORA_DEFAULTS = {
  // Ora punon me RREGULLA (falas, pa API — vendim 2026-10-05). AI-ja është
  // vetëm opsion për më vonë: oraAiFallback = "true" + ANTHROPIC_API_KEY.
  enabled: true,
  aiFallback: false,
  roles: ["SUPERADMIN", "ADMIN", "SECRETARY"],
  model: "claude-sonnet-5-5",
  modelComplex: "claude-opus-5-5",
  dailyLimit: 50,
  retentionDays: 90,
};

/** Kufijtë e ciklit (pika 2 e specifikimit). */
export const ORA_LIMITS = {
  maxToolCalls: 5,
  timeoutMs: 15_000,
  maxQuestionLength: 500,
  maxTokens: 1024,
};

/** Çmimet për 1M token (USD), për koston e përafërt te faqja e administrimit. */
export const MODEL_PRICES: Record<string, { input: number; output: number }> = {
  "claude-sonnet-5-5": { input: 2, output: 10 },
  "claude-opus-5-5": { input: 4, output: 20 },
  "claude-haiku-4-5": { input: 1, output: 5 },
  "claude-haiku-4-5-20251001": { input: 1, output: 5 },
};

/** Roli TEACHER s'ka kurrë qasje (s'ka lidhje me klasat; vetëm portali i materialeve). */
export const NEVER_ALLOWED_ROLES = ["TEACHER"];

export interface OraConfig {
  enabled: boolean;
  roles: string[];
  model: string;
  modelComplex: string;
  dailyLimit: number;
  retentionDays: number;
  /** Pyetjet që rregullat s'i kuptojnë i shkojnë AI-së (vetëm me çelës API). */
  aiFallback: boolean;
  apiKeyConfigured: boolean;
}

export async function getOraConfig(): Promise<OraConfig> {
  const rows = await prisma.setting.findMany({ where: { key: { in: Object.values(ORA_SETTING_KEYS) } } });
  const v = (k: string) => rows.find(r => r.key === k)?.value;
  let roles = ORA_DEFAULTS.roles;
  try { const r = JSON.parse(v(ORA_SETTING_KEYS.roles) ?? "null"); if (Array.isArray(r)) roles = r.map(String); } catch { /* parazgjedhja */ }
  const int = (s: string | undefined, d: number, min: number, max: number) => {
    const n = parseInt(s ?? "");
    return Number.isFinite(n) && n >= min && n <= max ? n : d;
  };
  return {
    enabled: (v(ORA_SETTING_KEYS.enabled) ?? String(ORA_DEFAULTS.enabled)) === "true",
    roles: roles.filter(r => !NEVER_ALLOWED_ROLES.includes(r)),
    model: v(ORA_SETTING_KEYS.model)?.trim() || ORA_DEFAULTS.model,
    modelComplex: v(ORA_SETTING_KEYS.modelComplex)?.trim() || ORA_DEFAULTS.modelComplex,
    dailyLimit: int(v(ORA_SETTING_KEYS.dailyLimit), ORA_DEFAULTS.dailyLimit, 1, 10_000),
    retentionDays: int(v(ORA_SETTING_KEYS.retentionDays), ORA_DEFAULTS.retentionDays, 1, 3650),
    aiFallback: v(ORA_SETTING_KEYS.aiFallback) === "true",
    apiKeyConfigured: !!process.env.ANTHROPIC_API_KEY,
  };
}
