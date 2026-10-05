// Tipet e përbashkëta të asistentit "Ora".

export interface OraContext {
  orgId: number;
  userId: number | null;
  role: string;
  /** Modulet e lejuara të përdoruesit (si te middleware); SUPERADMIN = të gjitha. */
  hasModule: (key: string) => boolean;
  /** Viti akademik aktual (p.sh. 2026 për 2026–2027). */
  year: number;
}

export interface OraItem {
  type: "student" | "family" | "staff" | "class" | "request" | "application";
  id: number;
  title: string;
  subtitle?: string;
  badge?: string;
}

export interface OraAction {
  type: "open_list" | "send_sms" | "export" | "open_profile";
  label: string;
  /** params.href = faqja/eksporti që hapet (modulet ekzistuese; konfirmimi bëhet atje). */
  params: Record<string, string | number>;
  /** Moduli që kërkohet — butoni s'shfaqet pa të (hiqet para se t'i kthehet klientit). */
  module?: string;
}

/** Vetëm veprimet që përdoruesi ka leje t'i bëjë; `module` s'i dërgohet klientit. */
export function permittedActions(actions: OraAction[], hasModule: (k: string) => boolean): OraAction[] {
  return actions.filter(a => !a.module || hasModule(a.module)).map(({ module: _m, ...a }) => { void _m; return a; });
}

/** Ajo që backend-i shfaq — plotësohet NGA VEGLA, jo nga modeli. */
export interface OraDisplay {
  big_number: { value: string; label: string } | null;
  breakdown: { label: string; value: string }[];
  items: OraItem[];
  total_items: number;
  actions: OraAction[];
  source: string;
  /** Fjali rezervë e ndërtuar nga sistemi (përdoret nëse fjalia e modelit përmban numra të paverifikuar). */
  fallbackAnswer: string;
}

export interface ToolResult {
  ok: boolean;
  /** Mesazh gabimi për modelin (p.sh. "s'ke qasje", "klasa s'u gjet"). */
  error?: string;
  /** Mesazhi që sheh përdoruesi kur ndryshon nga ai për modelin. */
  userMessage?: string;
  /** Të dhëna kompakte për modelin — pa telefona, nr. personal apo të dhëna të ndjeshme. */
  forModel: unknown;
  display?: OraDisplay;
  /** Kur duhet sqarim (p.sh. disa nxënës me të njëjtin emër). */
  clarification?: string;
}

export interface OraTool {
  name: string;
  description: string;
  /** Moduli që kërkohet (njësoj si faqja përkatëse). */
  module: string;
  input_schema: Record<string, unknown>;
  run: (input: Record<string, unknown>, ctx: OraContext) => Promise<ToolResult>;
}

export interface OraAnswer {
  answer: string;
  big_number: { value: string; label: string } | null;
  breakdown: { label: string; value: string }[];
  items: OraItem[];
  total_items: number;
  actions: OraAction[];
  source: string;
  needs_clarification: string | null;
  status: "ANSWERED" | "UNANSWERED" | "CLARIFICATION" | "ERROR";
  /** Pyetje shembull kur Ora s'e kupton pyetjen. */
  suggestions?: string[];
}
