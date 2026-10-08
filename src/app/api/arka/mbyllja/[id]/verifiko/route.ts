import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { verifyClosing, ClosingError } from "@/lib/audit/cashClosing";

// Verifikimi i numërimit nga personi i dytë (jo ai që numëroi). POST { note }
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "arka")) return NextResponse.json({ error: "Nuk ke leje" }, { status: 403 });
  const u = session.user as { id?: string; name?: string | null; organizationId?: number };
  const id = parseInt((await params).id) || 0;
  const body = await req.json().catch(() => ({}));
  try {
    const c = await verifyClosing(prisma, u.organizationId ?? 1, { id: parseInt(u.id ?? "") || null, name: u.name ?? null }, id,
      typeof body.note === "string" ? body.note.slice(0, 1000) : null);
    await logAction(session, "UPDATE", "CashClosing", c.id, `Verifikoi numërimin e arkës ${c.date} (numëroi: ${c.countedByName ?? "—"})`);
    return NextResponse.json(c);
  } catch (e) {
    if (e instanceof ClosingError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
}
