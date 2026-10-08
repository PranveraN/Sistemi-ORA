import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { runAudit } from "@/lib/audit/engine";

// "Ekzekuto tani" — ekzekutimi manual i rregullave të auditimit (Faza 3).
// Vetëm Super Admin (Faza 4 shton rolin Auditor).
export async function POST() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { role?: string; name?: string | null; organizationId?: number };
  if (u.role !== "SUPERADMIN") return NextResponse.json({ error: "Vetëm Super Admin." }, { status: 403 });
  const r = await runAudit(prisma, { trigger: "MANUAL", orgId: u.organizationId ?? 1, userName: u.name ?? null });
  if (r.skipped) return NextResponse.json({ error: "Një ekzekutim tjetër është në proces. Provoni pas pak." }, { status: 409 });
  await logAction(session, "CREATE", "AuditRun", r.runId ?? null, `Ekzekutoi auditimin: ${r.findingsNew} gjetje të reja, ${r.findingsSeen} gjithsej`);
  return NextResponse.json(r);
}
