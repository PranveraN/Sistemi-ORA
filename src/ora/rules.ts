import { prisma } from "@/lib/prisma";
import { parseIntent, EXAMPLE_QUESTIONS, type NameIndexEntry } from "./intent";
import { toolByName } from "./tools";
import { permittedActions, type OraAnswer, type OraContext, type ToolResult } from "./types";
import type { OraRunMeta } from "./engine";

// Ora ME RREGULLA (falas, pa API): pyetja → rregullat zgjedhin veglën → vegla
// ekzekutohet me lejet e përdoruesit → përgjigjja ndërtohet nga sistemi.
// Asnjë e dhënë s'del nga serveri.

const nameCache = new Map<number, { at: number; list: NameIndexEntry[] }>();
async function nameIndex(orgId: number): Promise<NameIndexEntry[]> {
  const hit = nameCache.get(orgId);
  if (hit && Date.now() - hit.at < 60_000) return hit.list;
  const list = await prisma.student.findMany({ where: { organizationId: orgId }, select: { id: true, firstName: true, lastName: true, status: true } });
  nameCache.set(orgId, { at: Date.now(), list });
  return list;
}

const EMPTY = { big_number: null, breakdown: [], items: [], total_items: 0, actions: [], source: "" };

/** Modulet që ndikojnë rezultatet/butonat e veglave (pjesë e çelësit të cache-it). */
const MODULE_KEYS = ["students", "families", "classes", "sekretaria", "kerkesat", "regjistrimet", "payments", "sms"];
const resultCache = new Map<string, { at: number; result: ToolResult }>();

export async function runOraRules(question: string, ctx: OraContext): Promise<{ answer: OraAnswer; meta: OraRunMeta }> {
  const started = Date.now();
  const meta: OraRunMeta = { tools: [], model: "rregulla", inputTokens: 0, outputTokens: 0, durationMs: 0 };
  const done = (answer: OraAnswer) => { meta.durationMs = Date.now() - started; return { answer, meta }; };

  const intent = parseIntent(question, await nameIndex(ctx.orgId));

  if (intent.kind === "clarify") {
    return done({ ...EMPTY, answer: intent.question, needs_clarification: intent.question, status: "CLARIFICATION" });
  }
  if (intent.kind === "unknown") {
    return done({
      ...EMPTY,
      answer: "Nuk e kuptova pyetjen ose këtë nuk mund ta gjej në sistem. Provo p.sh.: " + EXAMPLE_QUESTIONS.slice(0, 3).map(q => `"${q}"`).join(", "),
      suggestions: EXAMPLE_QUESTIONS, needs_clarification: null, status: "UNANSWERED",
    });
  }

  const tool = toolByName(intent.tool);
  let result: ToolResult;
  if (!tool) {
    result = { ok: false, error: "Vegla s'ekziston.", forModel: null };
  } else if (!ctx.hasModule(tool.module)) {
    result = { ok: false, error: "s'ka qasje", userMessage: "Nuk ke qasje në këto të dhëna sipas lejeve të tua.", forModel: null };
  } else {
    // Cache 30 s — e ndarë sipas organizatës, rolit dhe moduleve të lejuara
    const key = `${ctx.orgId}|${ctx.role}|${MODULE_KEYS.filter(m => ctx.hasModule(m)).join(",")}|${ctx.year}|${intent.tool}|${JSON.stringify(intent.input)}`;
    const hit = resultCache.get(key);
    if (hit && Date.now() - hit.at < 30_000) result = hit.result;
    else {
      try {
        result = await tool.run(intent.input, ctx);
        if (result.ok) {
          resultCache.set(key, { at: Date.now(), result });
          if (resultCache.size > 500) resultCache.delete(resultCache.keys().next().value!);
        }
      } catch (e) { console.error("[ora] vegla dështoi", intent.tool, e); result = { ok: false, error: "gabim", userMessage: "Ndodhi një gabim gjatë leximit të të dhënave.", forModel: null }; }
    }
  }
  meta.tools.push({ name: intent.tool, input: intent.input, ok: result.ok });

  if (!result.ok) {
    return done({ ...EMPTY, answer: result.userMessage ?? result.error ?? "Nuk u gjet.", needs_clarification: null, status: result.userMessage ? "ERROR" : "ANSWERED" });
  }
  const d = result.display!;
  if (result.clarification) {
    return done({ ...EMPTY, items: d.items, total_items: d.total_items, source: d.source, answer: result.clarification, needs_clarification: result.clarification, status: "CLARIFICATION" });
  }
  return done({
    answer: d.fallbackAnswer, big_number: d.big_number, breakdown: d.breakdown, items: d.items,
    total_items: d.total_items, actions: permittedActions(d.actions, ctx.hasModule), source: d.source, needs_clarification: null, status: "ANSWERED",
  });
}
