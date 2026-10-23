import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { fshiTimiPagese, TimiError } from "@/lib/timiPagesat";
import { reasonFrom } from "@/lib/timiAudit";
import { muajMbyllur } from "@/lib/timiRakordim";

const ALLOWED_ROLES = ["ADMIN", "SUPERADMIN", "FINANCE"];

// STORNO e një pagese nga TIMI (arsyeja e detyrueshme: X-Audit-Reason, kontrollohet edhe nga
// middleware-i). Pagesa s'fshihet — shënohet e stornuar dhe mund të rikthehet (…/rikthe).
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { id?: string; name?: string | null; role?: string; organizationId?: number };
  if (!ALLOWED_ROLES.includes(u.role ?? "")) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const arsye = reasonFrom(req.headers.get("x-audit-reason"));
  if (!arsye || arsye.length < 3) return NextResponse.json({ error: "Shkruani arsyen e stornos (të paktën 3 shenja)." }, { status: 400 });
  const { id } = await params;
  const ekz = await prisma.timiPagese.findFirst({ where: { id: parseInt(id) || 0, organizationId: u.organizationId ?? 1 }, select: { data: true, statusi: true } });
  const mbyllur = ekz && ekz.statusi === "RUAJTUR" ? await muajMbyllur(prisma, u.organizationId ?? 1, ekz.data) : null;
  try {
    const p = await fshiTimiPagese(prisma, u.organizationId ?? 1, { id: parseInt(u.id ?? "") || null, name: u.name ?? null }, parseInt(id) || 0, mbyllur ? `[muaj i mbyllur ${String(mbyllur.muaji).padStart(2, "0")}/${mbyllur.viti}] ${arsye}` : arsye);
    await logAction(session, "DELETE", "TimiPagese", p.id, `Stornoi pagesën nga TIMI ${(p.shumaCents / 100).toFixed(2)} € (${p.referenca ?? "pa ref."}) — arsyeja: ${arsye}`);
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof TimiError) return NextResponse.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
