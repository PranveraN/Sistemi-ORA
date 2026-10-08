import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { todayKey } from "@/lib/audit/cashEffect";
import { computeClosing, createClosing, lastClosedDay, loadCashScope, ClosingError } from "@/lib/audit/cashClosing";

// Mbyllja ditore e arkës (Faza 2 e auditimit).
// GET ?date=YYYY-MM-DD → pamja paraprake e ditës + mbylljet e fundit
// POST { date, counted, note } → mbyll ditën (gjendja e sistemit llogaritet këtu, në server)

function who(session: unknown) {
  const u = (session as { user?: { id?: string; name?: string | null; organizationId?: number } }).user;
  return { orgId: u?.organizationId ?? 1, actor: { id: parseInt(u?.id ?? "") || null, name: u?.name ?? null } };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "arka")) return NextResponse.json({ error: "Nuk ke leje" }, { status: 403 });
  const { orgId } = who(session);
  const date = req.nextUrl.searchParams.get("date") || todayKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Data e pavlefshme." }, { status: 400 });
  const [preview, closings, last, scope] = await Promise.all([
    computeClosing(prisma, orgId, date),
    prisma.cashClosing.findMany({ where: { organizationId: orgId }, orderBy: { date: "desc" }, take: 90 }),
    lastClosedDay(prisma, orgId),
    loadCashScope(prisma, orgId),
  ]);
  return NextResponse.json({ today: todayKey(), date, preview, closings, lastClosedDay: last, scope: { categoryIds: scope.categoryIds, categoryNames: scope.categoryNames } });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "arka")) return NextResponse.json({ error: "Nuk ke leje" }, { status: 403 });
  const { orgId, actor } = who(session);
  const body = await req.json().catch(() => ({}));
  const counted = typeof body.counted === "number" ? body.counted : parseFloat(String(body.counted ?? "").replace(",", "."));
  if (!Number.isFinite(counted) || counted < 0) return NextResponse.json({ error: "Shkruani shumën e numëruar (€)." }, { status: 400 });
  try {
    const c = await createClosing(prisma, orgId, actor, {
      date: String(body.date ?? todayKey()),
      countedCents: Math.round(counted * 100),
      note: typeof body.note === "string" ? body.note.slice(0, 1000) : null,
    });
    await logAction(session, "CREATE", "CashClosing", c.id,
      `${c.kind === "OPENING" ? "Hapja e arkës" : "Mbyllja e arkës"} ${c.date}: sistemi ${(c.systemCents / 100).toFixed(2)} €, numëruar ${(c.countedCents / 100).toFixed(2)} €, diferenca ${(c.diffCents / 100).toFixed(2)} €`);
    return NextResponse.json(c, { status: 201 });
  } catch (e) {
    if (e instanceof ClosingError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e && typeof e === "object" && (e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Kjo ditë është mbyllur tashmë." }, { status: 409 });
    }
    throw e;
  }
}
