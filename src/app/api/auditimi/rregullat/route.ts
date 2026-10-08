import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { requireAuditAccess, SEVERITIES } from "@/lib/audit/access";
import { syncRules } from "@/lib/audit/engine";
import { loadAuditConfig } from "@/lib/audit/config";

// Rregullat e auditimit: GET (Auditori dhe Super Admin) — lista, pragjet, ekzekutimet e fundit.
// PUT { code, active?, severity? } — vetëm Super Admin.
export async function GET() {
  const g = await requireAuditAccess();
  if ("error" in g) return g.error;
  const [rules, config, runs, counts] = await Promise.all([
    syncRules(prisma),
    loadAuditConfig(prisma),
    prisma.auditRun.findMany({ orderBy: { startedAt: "desc" }, take: 30 }),
    prisma.auditFinding.groupBy({ by: ["ruleCode"], where: { organizationId: g.user.orgId, status: { in: ["E_RE", "NE_SHQYRTIM"] } }, _count: { _all: true } }),
  ]);
  const open = Object.fromEntries(counts.map(c => [c.ruleCode, c._count._all]));
  return NextResponse.json({
    rules: rules.sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true })).map(r => ({ ...r, open: open[r.code] ?? 0 })),
    config, runs, canManageRules: g.user.canManageRules,
  });
}

export async function PUT(req: NextRequest) {
  const g = await requireAuditAccess({ manageRules: true });
  if ("error" in g) return g.error;
  const body = await req.json().catch(() => ({}));
  const code = String(body.code ?? "");
  const rule = await prisma.auditRule.findUnique({ where: { code } });
  if (!rule) return NextResponse.json({ error: "Rregulli s'u gjet." }, { status: 404 });
  const data: { active?: boolean; severity?: string } = {};
  if (typeof body.active === "boolean") data.active = body.active;
  if (body.severity !== undefined) {
    if (!(SEVERITIES as readonly string[]).includes(body.severity)) return NextResponse.json({ error: "Rëndësi e pavlefshme." }, { status: 400 });
    data.severity = body.severity;
  }
  const r = await prisma.auditRule.update({ where: { code }, data });
  await logAction(g.session, "UPDATE", "AuditRule", r.id, `Rregulli ${code}: ${JSON.stringify(data)}`);
  return NextResponse.json(r);
}
