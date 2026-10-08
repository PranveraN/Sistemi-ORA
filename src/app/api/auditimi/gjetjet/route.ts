import { NextRequest, NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireAuditAccess, SEVERITY_ORDER } from "@/lib/audit/access";

// Lista e gjetjeve me filtra: moduli, rëndësia, statusi (HAPUR = e re + në shqyrtim),
// rregulli, periudha (nga/deri), viti akademik (1 shtator – 31 gusht), kërkim në tekst.
// Renditja: rëndësia (kritike së pari), pastaj më të rejat. ?all=1 → deri 5000 (për eksport).
export async function GET(req: NextRequest) {
  const g = await requireAuditAccess();
  if ("error" in g) return g.error;
  const sp = req.nextUrl.searchParams;
  const where: Prisma.AuditFindingWhereInput = { organizationId: g.user.orgId };
  const module = sp.get("module"), severity = sp.get("severity"), status = sp.get("status"), rule = sp.get("rule"), q = sp.get("q")?.trim();
  if (module) where.module = module;
  if (severity) where.severity = severity;
  if (rule) where.ruleCode = rule;
  if (status === "HAPUR") where.status = { in: ["E_RE", "NE_SHQYRTIM"] };
  else if (status) where.status = status;
  if (q) where.OR = [{ title: { contains: q } }, { description: { contains: q } }];
  const created: Prisma.DateTimeFilter = {};
  const year = parseInt(sp.get("year") ?? "") || 0;
  if (year) { created.gte = new Date(year, 8, 1); created.lt = new Date(year + 1, 8, 1); }
  const from = sp.get("from"), to = sp.get("to");
  if (from) created.gte = new Date(`${from}T00:00:00`);
  if (to) created.lt = new Date(new Date(`${to}T00:00:00`).getTime() + 86400000);
  if (Object.keys(created).length) where.createdAt = created;

  const rows = await prisma.auditFinding.findMany({ where, orderBy: { createdAt: "desc" }, take: 5000 });
  rows.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 9) - (SEVERITY_ORDER[b.severity] ?? 9) || b.createdAt.getTime() - a.createdAt.getTime());
  const all = sp.get("all") === "1";
  const page = Math.max(1, parseInt(sp.get("page") ?? "1") || 1);
  const limit = all ? 5000 : Math.min(200, Math.max(10, parseInt(sp.get("limit") ?? "50") || 50));
  const rules = await prisma.auditRule.findMany({ select: { code: true, name: true } });
  return NextResponse.json({
    total: rows.length, page, limit,
    rows: rows.slice((page - 1) * limit, page * limit).map(f => ({ ...f, evidence: undefined })),
    rules,
  });
}
