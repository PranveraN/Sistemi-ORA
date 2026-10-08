import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { loadAuditConfig, saveAuditConfig } from "@/lib/audit/config";

// Pragjet e rregullave të auditimit (X ditë, kufiri i zbritjes, …). Vetëm Super Admin.
async function superAdmin() {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if ((session.user as { role?: string }).role !== "SUPERADMIN") return { error: NextResponse.json({ error: "Vetëm Super Admin." }, { status: 403 }) };
  return { session };
}

export async function GET() {
  const g = await superAdmin();
  if (g.error) return g.error;
  return NextResponse.json(await loadAuditConfig(prisma));
}

export async function PUT(req: NextRequest) {
  const g = await superAdmin();
  if (g.error) return g.error;
  const body = await req.json().catch(() => ({}));
  try {
    const cfg = await saveAuditConfig(prisma, body);
    await logAction(g.session, "UPDATE", "AuditConfig", null, `Pragjet e auditimit: ${JSON.stringify(cfg)}`);
    return NextResponse.json(cfg);
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Gabim" }, { status: 400 });
  }
}
