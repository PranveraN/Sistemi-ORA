import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { getOraConfig, ORA_SETTING_KEYS, MODEL_PRICES, NEVER_ALLOWED_ROLES } from "@/ora/config";

// Faqja "Ora · Asistenti" — vetëm administratorët (Super Admin; Admini vetëm
// shikim, middleware bllokon ndryshimet). GET: konfigurimi + statistikat +
// historiku me filtra. PATCH: ndryshon konfigurimin (Cilësimet).

async function adminSession() {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;
  return session && (role === "SUPERADMIN" || role === "ADMIN") ? session : null;
}

const CONFIGURABLE_ROLES = ["ADMIN", "SECRETARY", "FINANCE", "PEDAGOGIA"];

export async function GET(req: NextRequest) {
  const session = await adminSession();
  if (!session) return NextResponse.json({ error: "Vetëm administratorët." }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const sp = req.nextUrl.searchParams;
  const config = await getOraConfig();

  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
  const [month, byStatus, unanswered, thumbsDown] = await Promise.all([
    prisma.oraQuery.findMany({ where: { organizationId: orgId, createdAt: { gte: monthStart } }, select: { model: true, inputTokens: true, outputTokens: true, durationMs: true, rating: true } }),
    prisma.oraQuery.groupBy({ by: ["status"], where: { organizationId: orgId, createdAt: { gte: monthStart } }, _count: true }),
    prisma.oraQuery.findMany({ where: { organizationId: orgId, status: "UNANSWERED" }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, question: true, createdAt: true, role: true } }),
    prisma.oraQuery.findMany({ where: { organizationId: orgId, rating: -1 }, orderBy: { createdAt: "desc" }, take: 20, select: { id: true, question: true, summary: true, createdAt: true } }),
  ]);
  const cost = month.reduce((a, q) => {
    const p = q.model ? MODEL_PRICES[q.model] : undefined;
    return p ? a + ((q.inputTokens ?? 0) * p.input + (q.outputTokens ?? 0) * p.output) / 1_000_000 : a;
  }, 0);
  const durations = month.map(q => q.durationMs ?? 0).sort((a, b) => a - b);

  // Historiku me filtra
  const status = sp.get("status") || "";
  const rating = sp.get("rating") || "";
  const q = (sp.get("q") || "").trim();
  const page = Math.max(1, parseInt(sp.get("page") || "1") || 1);
  const where: Record<string, unknown> = { organizationId: orgId };
  if (status) where.status = status;
  if (rating === "up") where.rating = 1; else if (rating === "down") where.rating = -1;
  if (q) where.question = { contains: q };
  const [total, rows] = await Promise.all([
    prisma.oraQuery.count({ where }),
    prisma.oraQuery.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * 30, take: 30 }),
  ]);
  const users = await prisma.user.findMany({ where: { id: { in: [...new Set(rows.map(r => r.userId).filter((x): x is number => !!x))] } }, select: { id: true, name: true } });
  const nameOf = new Map(users.map(u => [u.id, u.name]));

  return NextResponse.json({
    config: { ...config, configurableRoles: CONFIGURABLE_ROLES },
    stats: {
      month: month.length,
      byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count])),
      thumbsUp: month.filter(x => x.rating === 1).length,
      thumbsDown: month.filter(x => x.rating === -1).length,
      medianMs: durations.length ? durations[Math.floor(durations.length / 2)] : 0,
      costUsd: Math.round(cost * 100) / 100,
    },
    unanswered, thumbsDown,
    history: { total, page, rows: rows.map(r => ({ ...r, userName: r.userId ? nameOf.get(r.userId) ?? "—" : "—" })) },
  });
}

export async function PATCH(req: NextRequest) {
  const session = await adminSession();
  if (!session || (session.user as { role?: string }).role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Vetëm Super Admini mund ta ndryshojë konfigurimin." }, { status: 403 });
  }
  const body = await req.json().catch(() => ({}));
  const updates: [string, string][] = [];
  if (typeof body.enabled === "boolean") updates.push([ORA_SETTING_KEYS.enabled, String(body.enabled)]);
  if (Array.isArray(body.roles)) {
    const roles = body.roles.map(String).filter((r: string) => CONFIGURABLE_ROLES.includes(r) && !NEVER_ALLOWED_ROLES.includes(r));
    updates.push([ORA_SETTING_KEYS.roles, JSON.stringify(["SUPERADMIN", ...roles])]);
  }
  const int = (v: unknown, min: number, max: number) => { const n = parseInt(String(v)); return Number.isFinite(n) && n >= min && n <= max ? n : null; };
  const limit = int(body.dailyLimit, 1, 10_000);
  if (limit !== null) updates.push([ORA_SETTING_KEYS.dailyLimit, String(limit)]);
  const ret = int(body.retentionDays, 1, 3650);
  if (ret !== null) updates.push([ORA_SETTING_KEYS.retentionDays, String(ret)]);
  if (!updates.length) return NextResponse.json({ error: "Asgjë për të ndryshuar." }, { status: 400 });

  await prisma.$transaction(updates.map(([key, value]) => prisma.setting.upsert({ where: { key }, update: { value }, create: { key, value } })));
  await logAction(session, "UPDATE", "Ora", null, `Ndryshoi konfigurimin e Orës: ${updates.map(([k, v]) => `${k}=${v}`).join(", ")}`);
  return NextResponse.json({ ok: true, config: await getOraConfig() });
}
