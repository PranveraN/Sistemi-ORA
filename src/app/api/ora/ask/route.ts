import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { oraAccess, questionsToday, purgeOldQueries } from "@/ora/access";
import { ORA_LIMITS } from "@/ora/config";
import { runOra } from "@/ora/engine";
import { runOraRules } from "@/ora/rules";
import { permittedActions } from "@/ora/types";

// POST /api/ora/ask { question } → përgjigje e strukturuar e Orës.
// Ora punon me rregulla (falas, pa API); vetëm lexim, me lejet e përdoruesit.
export async function POST(req: NextRequest) {
  const session = await auth();
  const access = await oraAccess(session);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });
  const { ctx, config } = access;

  const body = await req.json().catch(() => ({}));
  const question = String(body.question ?? "").trim().slice(0, ORA_LIMITS.maxQuestionLength);
  if (question.length < 2) return NextResponse.json({ error: "Shkruaj pyetjen." }, { status: 400 });

  if ((await questionsToday(ctx.userId)) >= config.dailyLimit) {
    return NextResponse.json({ error: `U arrit kufiri ditor prej ${config.dailyLimit} pyetjesh. Provo nesër.` }, { status: 429 });
  }

  // Rregullat (falas, pa API). AI-ja vetëm si rezervë për pyetjet e pakuptuara,
  // dhe vetëm kur administrata e aktivizon dhe ka çelës API në server.
  let { answer, meta } = await runOraRules(question, ctx);
  if (answer.status === "UNANSWERED" && config.aiFallback && config.apiKeyConfigured) {
    ({ answer, meta } = await runOra(question, ctx, { model: config.model }));
  }

  // Butonat vetëm për modulet ku përdoruesi ka leje
  answer.actions = permittedActions(answer.actions, ctx.hasModule);

  // Regjistri: pyetja, veglat me parametrat, statusi, koha, token-ët — JO përgjigjja e plotë
  const log = await prisma.oraQuery.create({
    data: {
      organizationId: ctx.orgId, userId: ctx.userId, role: ctx.role, question,
      toolsJson: JSON.stringify(meta.tools),
      status: answer.status,
      summary: meta.error ?? [meta.tools.map(t => t.name).join(", "), answer.big_number ? `→ ${answer.big_number.value}` : "", answer.total_items ? `(${answer.total_items})` : ""].filter(Boolean).join(" "),
      durationMs: meta.durationMs, model: meta.model, inputTokens: meta.inputTokens, outputTokens: meta.outputTokens,
    },
    select: { id: true },
  }).catch(() => null);
  if (Math.random() < 0.05) purgeOldQueries(config.retentionDays);

  return NextResponse.json({ ...answer, queryId: log?.id ?? null, durationMs: meta.durationMs });
}
