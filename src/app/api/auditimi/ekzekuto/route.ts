import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { runAudit } from "@/lib/audit/engine";
import { requireAuditAccess } from "@/lib/audit/access";

// "Ekzekuto tani" — ekzekutimi manual i rregullave të auditimit. Auditori dhe Super Admin.
export async function POST() {
  const g = await requireAuditAccess();
  if ("error" in g) return g.error;
  const r = await runAudit(prisma, { trigger: "MANUAL", orgId: g.user.orgId, userName: g.user.name });
  if (r.skipped) return NextResponse.json({ error: "Një ekzekutim tjetër është në proces. Provoni pas pak." }, { status: 409 });
  await logAction(g.session, "CREATE", "AuditRun", r.runId ?? null, `Ekzekutoi auditimin: ${r.findingsNew} gjetje të reja, ${r.findingsSeen} gjithsej`);
  return NextResponse.json(r);
}
