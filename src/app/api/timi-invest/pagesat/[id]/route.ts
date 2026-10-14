import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { fshiTimiPagese, TimiError } from "@/lib/timiPagesat";

const ALLOWED_ROLES = ["ADMIN", "SUPERADMIN", "FINANCE"];

// Kthen mbrapsht një pagesë nga TIMI (arsyeja kërkohet nga middleware-i, X-Audit-Reason)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { name?: string | null; role?: string; organizationId?: number };
  if (!ALLOWED_ROLES.includes(u.role ?? "")) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const { id } = await params;
  try {
    const p = await fshiTimiPagese(prisma, u.organizationId ?? 1, { name: u.name ?? null }, parseInt(id) || 0);
    await logAction(session, "DELETE", "TimiPagese", p.id, `Fshiu pagesën nga TIMI ${(p.shumaCents / 100).toFixed(2)} € (${p.referenca ?? "pa ref."}) — pagesat te fëmijët u kthyen mbrapsht`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TimiError) return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
