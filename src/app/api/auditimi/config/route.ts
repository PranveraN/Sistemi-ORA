import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { loadAuditConfig, saveAuditConfig } from "@/lib/audit/config";
import { requireAuditAccess } from "@/lib/audit/access";

// Pragjet e rregullave të auditimit (X ditë, kufiri i zbritjes, …).
// GET: Auditori dhe Super Admin · PUT: vetëm Super Admin.
export async function GET() {
  const g = await requireAuditAccess();
  if ("error" in g) return g.error;
  return NextResponse.json(await loadAuditConfig(prisma));
}

export async function PUT(req: NextRequest) {
  const g = await requireAuditAccess({ manageRules: true });
  if ("error" in g) return g.error;
  const body = await req.json().catch(() => ({}));
  try {
    const cfg = await saveAuditConfig(prisma, body);
    await logAction(g.session, "UPDATE", "AuditConfig", null, `Pragjet e auditimit: ${JSON.stringify(cfg)}`);
    return NextResponse.json(cfg);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gabim" }, { status: 400 });
  }
}
