import type { OraAnswer, OraDisplay, ToolResult } from "./types";

// Vegla përfundimtare: modeli shkruan VETËM fjalinë dhe tregon cilin rezultat
// të shfaqë. Numri i madh, lista dhe ndarja vijnë nga rezultati i veglës.
export const FINAL_ANSWER_TOOL = {
  name: "final_answer",
  description:
    "Përgjigjja përfundimtare për përdoruesin. Thirre GJITHMONË si hap të fundit, pasi ke marrë të dhënat nga veglat. " +
    "Numri i madh, lista dhe ndarja shfaqen automatikisht nga rezultati i veglës që tregon te use_result_of.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      answer: { type: "string", description: "1–2 fjali në shqip. Çdo numër duhet të jetë saktësisht nga rezultatet e veglave." },
      use_result_of: { type: "string", description: "Emri i veglës, rezultati i së cilës shfaqet (p.sh. 'count_students'), ose 'none'." },
      needs_clarification: { type: "string", description: "Pyetja sqaruese kur pyetja është e paqartë; përndryshe ''." },
      not_in_system: { type: "boolean", description: "true kur pyetja s'mund të përgjigjet me të dhënat/veglat e sistemit." },
    },
    required: ["answer", "use_result_of", "needs_clarification", "not_in_system"],
    additionalProperties: false,
  },
} as const;

export interface FinalAnswerInput { answer: string; use_result_of: string; needs_clarification: string; not_in_system: boolean }

export const NOT_IN_SYSTEM = "Këtë nuk mund ta gjej në sistem.";

/** Të gjithë numrat që shfaqen në një tekst/objekt (si vlera numerike). */
function numbersIn(value: unknown, out = new Set<number>()): Set<number> {
  if (value == null) return out;
  if (typeof value === "number") { out.add(Math.round(value * 100) / 100); return out; }
  if (typeof value === "string") { for (const n of parseNumbers(value)) out.add(n); return out; }
  if (Array.isArray(value)) { value.forEach(v => numbersIn(v, out)); return out; }
  if (typeof value === "object") { Object.values(value as Record<string, unknown>).forEach(v => numbersIn(v, out)); }
  return out;
}

/** "1.520,50 €", "1 520", "35", "2026–2027" → [1520.5, 1520, 35, 2026, 2027] */
export function parseNumbers(text: string): number[] {
  const out: number[] = [];
  const re = /\d{1,3}(?:[.\s ]\d{3})+(?:,\d+)?|\d+(?:[.,]\d+)?/g;
  for (const m of text.matchAll(re)) {
    let s = m[0];
    if (/[.\s ]\d{3}/.test(s) && /\d{1,3}([.\s ]\d{3})+/.test(s)) s = s.replace(/[.\s ](?=\d{3})/g, "");
    s = s.replace(",", ".");
    const n = parseFloat(s);
    if (Number.isFinite(n)) out.push(Math.round(n * 100) / 100);
  }
  return out;
}

/**
 * A janë të gjithë numrat e fjalisë së modelit të pranishëm te rezultatet e
 * veglave (ose te pyetja)? Nëse jo, fjalia zëvendësohet me atë të sistemit.
 */
export function numbersAreGrounded(answer: string, sources: unknown[]): boolean {
  const allowed = new Set<number>();
  for (const s of sources) numbersIn(s, allowed);
  return parseNumbers(answer).every(n => allowed.has(n) || [...allowed].some(a => Math.abs(a - n) < 0.011));
}

export function assembleAnswer(
  final: FinalAnswerInput | null,
  results: { name: string; input: unknown; result: ToolResult }[],
  question: string,
): OraAnswer {
  const empty = { big_number: null, breakdown: [], items: [], total_items: 0, actions: [], source: "" };
  if (!final) return { ...empty, answer: "Ora nuk arriti të formulojë përgjigjen. Provo ta riformulosh pyetjen.", needs_clarification: null, status: "ERROR" };

  // Sqarimi nga vegla (p.sh. disa nxënës me të njëjtin emër) ka përparësi
  const clarifying = [...results].reverse().find(r => r.result.clarification);
  if (final.needs_clarification.trim() || clarifying) {
    const disp = clarifying?.result.display;
    const q = final.needs_clarification.trim() || clarifying!.result.clarification!;
    return { ...empty, ...(disp ? pick(disp) : {}), big_number: null, answer: q, needs_clarification: q, status: "CLARIFICATION" };
  }
  if (final.not_in_system || !results.length) {
    return { ...empty, answer: NOT_IN_SYSTEM, needs_clarification: null, status: "UNANSWERED" };
  }

  const chosen = [...results].reverse().find(r => r.name === final.use_result_of && r.result.ok)
    ?? [...results].reverse().find(r => r.result.ok && r.result.display);
  const failed = [...results].reverse().find(r => !r.result.ok);
  if (!chosen?.result.display) {
    const msg = failed?.result.userMessage ?? failed?.result.error ?? NOT_IN_SYSTEM;
    return { ...empty, answer: msg, needs_clarification: null, status: failed ? "ANSWERED" : "UNANSWERED" };
  }

  const disp = chosen.result.display;
  const grounded = numbersAreGrounded(final.answer, [...results.map(r => r.result.forModel), question]);
  return {
    ...pick(disp),
    answer: grounded && final.answer.trim() ? final.answer.trim() : disp.fallbackAnswer,
    needs_clarification: null,
    status: "ANSWERED",
  };
}

function pick(d: OraDisplay) {
  return { big_number: d.big_number, breakdown: d.breakdown, items: d.items, total_items: d.total_items, actions: d.actions, source: d.source };
}
