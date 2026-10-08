import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuditAccess } from "@/lib/audit/access";

// Përmbledhja e auditimit: gjetjet e hapura sipas rëndësisë dhe modulit, sipas
// statusit, ekzekutimi i fundit.
export async function GET() {
  const g = await requireAuditAccess();
  if ("error" in g) return g.error;
  const org = g.user.orgId;
  const open = { organizationId: org, status: { in: ["E_RE", "NE_SHQYRTIM"] } };
  const [bySeverity, byModule, byStatus, lastRun, lastOk, rules] = await Promise.all([
    prisma.auditFinding.groupBy({ by: ["severity"], where: open, _count: { _all: true }, _sum: { amountCents: true } }),
    prisma.auditFinding.groupBy({ by: ["module"], where: open, _count: { _all: true } }),
    prisma.auditFinding.groupBy({ by: ["status"], where: { organizationId: org }, _count: { _all: true } }),
    prisma.auditRun.findFirst({ orderBy: { startedAt: "desc" } }),
    prisma.auditRun.findFirst({ where: { status: { in: ["OK", "ME_GABIME"] } }, orderBy: { startedAt: "desc" } }),
    prisma.auditRule.count({ where: { active: true } }),
  ]);
  return NextResponse.json({
    bySeverity: Object.fromEntries(bySeverity.map(s => [s.severity, { count: s._count._all, amountCents: s._sum.amountCents ?? 0 }])),
    byModule: Object.fromEntries(byModule.map(m => [m.module, m._count._all])),
    byStatus: Object.fromEntries(byStatus.map(s => [s.status, s._count._all])),
    lastRun, lastOk, activeRules: rules, canManageRules: g.user.canManageRules,
  });
}
