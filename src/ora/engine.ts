import fs from "fs/promises";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { ORA_LIMITS } from "./config";
import { ORA_TOOLS, toolByName } from "./tools";
import { FINAL_ANSWER_TOOL, assembleAnswer, type FinalAnswerInput } from "./answer";
import type { OraAnswer, OraContext, ToolResult } from "./types";

// Cikli i Orës: pyetja + udhëzimet + veglat → modeli zgjedh vegla → backend-i i
// ekzekuton me lejet e përdoruesit → rezultatet i kthehen modelit → modeli
// përfundon me final_answer. Maks. 5 vegla, 15 s gjithsej. Vetëm lexim.

type Msg = Anthropic.MessageParam;
type CreateFn = (params: Anthropic.MessageCreateParamsNonStreaming, opts: { signal: AbortSignal }) => Promise<Anthropic.Message>;

export interface OraEvent { type: "status" | "tool"; text: string }
export interface OraRunMeta {
  tools: { name: string; input: unknown; ok: boolean }[];
  model: string;
  inputTokens: number;
  outputTokens: number;
  durationMs: number;
  error?: string;
}

let promptCache: { text: string; at: number } | null = null;
async function systemPrompt(): Promise<string> {
  if (promptCache && Date.now() - promptCache.at < 30_000) return promptCache.text;
  const text = await fs.readFile(path.join(process.cwd(), "ora", "system-prompt.md"), "utf8")
    .then(t => t.replace(/<!--[\s\S]*?-->/g, "").trim())
    .catch(() => "Je Ora, asistenti i Akademisë Ora. Përgjigju në shqip vetëm me të dhëna nga veglat dhe përfundo gjithmonë me final_answer.");
  promptCache = { text, at: Date.now() };
  return text;
}

const API_TOOLS = [
  ...ORA_TOOLS.map(t => ({ name: t.name, description: t.description, input_schema: t.input_schema, strict: true })),
  FINAL_ANSWER_TOOL,
] as unknown as Anthropic.Tool[];

export function defaultCreateFn(): CreateFn {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 1, timeout: ORA_LIMITS.timeoutMs });
  return (params, opts) => client.messages.create(params, { signal: opts.signal });
}

function apiErrorMessage(e: unknown): string {
  if (e instanceof Anthropic.APIError) {
    if (e.status === 401 || e.status === 403) return "Çelësi API i Orës është i pavlefshëm ose s'ka leje.";
    if (e.status === 429) return "Ora po merr shumë pyetje njëherësh — provo pas pak.";
    if (e.status === 529 || e.status === 503) return "Shërbimi i AI-së është i mbingarkuar — provo pas pak.";
    return `Gabim nga shërbimi i AI-së (${e.status ?? "?"}).`;
  }
  if (e instanceof Error && (e.name === "AbortError" || /abort|timeout/i.test(e.message))) return "Ora vonoi më shumë se 15 sekonda — provo një pyetje më të thjeshtë.";
  return "Gabim i papritur te Ora.";
}

export async function runOra(question: string, ctx: OraContext, opts: {
  model: string;
  createFn?: CreateFn;
  onEvent?: (e: OraEvent) => void;
}): Promise<{ answer: OraAnswer; meta: OraRunMeta }> {
  const started = Date.now();
  const create = opts.createFn ?? defaultCreateFn();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ORA_LIMITS.timeoutMs);
  const meta: OraRunMeta = { tools: [], model: opts.model, inputTokens: 0, outputTokens: 0, durationMs: 0 };
  const results: { name: string; input: unknown; result: ToolResult }[] = [];

  const today = new Date();
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: await systemPrompt(), cache_control: { type: "ephemeral" } },
    {
      type: "text",
      text: `## Konteksti\nData e sotme: ${today.toISOString().slice(0, 10)}. Viti akademik aktual: ${ctx.year}–${ctx.year + 1} (year = ${ctx.year}). Roli i përdoruesit: ${ctx.role}.`,
    },
  ];
  const messages: Msg[] = [{ role: "user", content: question }];

  let final: FinalAnswerInput | null = null;
  let nudged = false;
  let toolCalls = 0;
  opts.onEvent?.({ type: "status", text: "Ora po kërkon…" });

  try {
    for (let round = 0; round < ORA_LIMITS.maxToolCalls + 2 && !final; round++) {
      const resp = await create({ model: opts.model, max_tokens: ORA_LIMITS.maxTokens, system, tools: API_TOOLS, messages }, { signal: controller.signal });
      meta.inputTokens += (resp.usage?.input_tokens ?? 0) + (resp.usage?.cache_read_input_tokens ?? 0) + (resp.usage?.cache_creation_input_tokens ?? 0);
      meta.outputTokens += resp.usage?.output_tokens ?? 0;

      const uses = resp.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      const fin = uses.find(u => u.name === FINAL_ANSWER_TOOL.name);
      if (fin) { final = fin.input as FinalAnswerInput; break; }

      if (!uses.length) {
        // Format i gabuar (tekst i lirë) — një përpjekje e dytë, pastaj gabim i qartë
        if (nudged) break;
        nudged = true;
        messages.push({ role: "assistant", content: resp.content });
        messages.push({ role: "user", content: "Mos shkruaj tekst të lirë. Përdor veglat për të dhënat dhe përfundo me veglën final_answer." });
        continue;
      }

      messages.push({ role: "assistant", content: resp.content });
      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(uses.map(async (u): Promise<Anthropic.ToolResultBlockParam> => {
        const tool = toolByName(u.name);
        let result: ToolResult;
        if (++toolCalls > ORA_LIMITS.maxToolCalls) {
          result = { ok: false, error: "U arrit kufiri i veglave për këtë pyetje — përgjigju me final_answer me të dhënat që ke.", forModel: null };
        } else if (!tool) {
          result = { ok: false, error: `Vegla "${u.name}" nuk ekziston.`, forModel: null };
        } else if (!ctx.hasModule(tool.module)) {
          result = { ok: false, error: "Përdoruesi s'ka qasje në këtë modul — thuaji që s'ka leje për këto të dhëna.", userMessage: "Nuk ke qasje në këto të dhëna sipas lejeve të tua.", forModel: null };
        } else {
          opts.onEvent?.({ type: "tool", text: tool.name });
          try { result = await tool.run((u.input ?? {}) as Record<string, unknown>, ctx); }
          catch (e) { console.error("[ora] vegla dështoi", tool.name, e); result = { ok: false, error: "Vegla dështoi për shkak të një gabimi të brendshëm.", forModel: null }; }
        }
        results.push({ name: u.name, input: u.input, result });
        meta.tools.push({ name: u.name, input: u.input, ok: result.ok });
        // Rezultati shkon si TË DHËNA (JSON), jo si udhëzime
        const payload = result.ok ? { data: result.forModel, ...(result.clarification ? { clarification_needed: result.clarification } : {}) } : { error: result.error };
        return { type: "tool_result", tool_use_id: u.id, content: JSON.stringify(payload), is_error: !result.ok };
      }));
      messages.push({ role: "user", content: toolResults });
    }
  } catch (e) {
    meta.error = apiErrorMessage(e);
    if (!(e instanceof Anthropic.APIError)) console.error("[ora] gabim", e);
  } finally {
    clearTimeout(timer);
  }

  meta.durationMs = Date.now() - started;
  if (meta.error) {
    return { answer: { answer: meta.error, big_number: null, breakdown: [], items: [], total_items: 0, actions: [], source: "", needs_clarification: null, status: "ERROR" }, meta };
  }
  return { answer: assembleAnswer(final, results, question), meta };
}
