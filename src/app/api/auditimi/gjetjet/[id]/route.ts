import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { requireAuditAccess, FINDING_STATUSES } from "@/lib/audit/access";
import { entityHistory, entityLink } from "@/lib/audit/history";

// GET  → gjetja me dëshminë, komentet, lidhjen te rekordi dhe historikun e tij
// POST { status, comment } → ndryshon statusin (komenti i detyrueshëm); i njëjti
//      status + koment = vetëm koment.
async function load(id: number, orgId: number) {
  return prisma.auditFinding.findFirst({ where: { id, organizationId: orgId } });
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAuditAccess();
  if ("error" in g) return g.error;
  const f = await load(parseInt((await params).id) || 0, g.user.orgId);
  if (!f) return NextResponse.json({ error: "Gjetja s'u gjet." }, { status: 404 });
  let evidence: Record<string, unknown> | null = null;
  try { evidence = f.evidence ? JSON.parse(f.evidence) : null; } catch { evidence = null; }
  const [comments, rule, link, history] = await Promise.all([
    prisma.auditFindingComment.findMany({ where: { findingId: f.id }, orderBy: { createdAt: "asc" } }),
    prisma.auditRule.findUnique({ where: { code: f.ruleCode } }),
    entityLink(prisma, f.entityType, f.entityId, evidence),
    f.entityType && f.entityId ? entityHistory(prisma, f.entityType, f.entityId, 50) : Promise.resolve([]),
  ]);
  return NextResponse.json({ finding: { ...f, evidence }, comments, rule, link, history });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await requireAuditAccess();
  if ("error" in g) return g.error;
  const f = await load(parseInt((await params).id) || 0, g.user.orgId);
  if (!f) return NextResponse.json({ error: "Gjetja s'u gjet." }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const status = String(body.status ?? f.status);
  const comment = String(body.comment ?? "").trim().slice(0, 2000);
  if (!(FINDING_STATUSES as readonly string[]).includes(status)) return NextResponse.json({ error: "Status i pavlefshëm." }, { status: 400 });
  if (comment.length < 3) return NextResponse.json({ error: "Shkruani një koment (të paktën 3 shenja)." }, { status: 400 });
  const [c] = await prisma.$transaction([
    prisma.auditFindingComment.create({
      data: { findingId: f.id, userId: g.user.id, userName: g.user.name, text: comment, statusFrom: f.status, statusTo: status },
    }),
    prisma.auditFinding.update({ where: { id: f.id }, data: { status, ...(status !== f.status && g.user.id ? { assignedToId: g.user.id } : {}) } }),
  ]);
  await logAction(g.session, "UPDATE", "AuditFinding", f.id, `${f.ruleCode} "${f.title}": ${f.status} → ${status} — ${comment}`);
  return NextResponse.json({ ok: true, comment: c, status });
}
