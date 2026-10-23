import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { rikthejTimiPagese, TimiError } from "@/lib/timiPagesat";
import { reasonFrom } from "@/lib/timiAudit";

const ALLOWED_ROLES = ["ADMIN", "SUPERADMIN", "FINANCE"];

// RIKTHE një pagesë të stornuar — muajt, komisioni dhe fazat kthehen saktësisht si para stornos.
// POST { arsye } (e detyrueshme)
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { id?: string; name?: string | null; role?: string; organizationId?: number };
  if (!ALLOWED_ROLES.includes(u.role ?? "")) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const arsye = reasonFrom(null, typeof b.arsye === "string" ? b.arsye : "");
  if (!arsye || arsye.length < 3) return NextResponse.json({ error: "Shkruani arsyen e rikthimit (të paktën 3 shenja)." }, { status: 400 });
  const { id } = await params;
  try {
    const p = await rikthejTimiPagese(prisma, u.organizationId ?? 1, { id: parseInt(u.id ?? "") || null, name: u.name ?? null }, parseInt(id) || 0, arsye);
    await logAction(session, "UPDATE", "TimiPagese", p.id, `Riktheu pagesën nga TIMI ${(p.shumaCents / 100).toFixed(2)} € (${p.referenca ?? "pa ref."}) — arsyeja: ${arsye}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TimiError) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
