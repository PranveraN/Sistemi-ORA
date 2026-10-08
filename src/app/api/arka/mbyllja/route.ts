import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { todayKey } from "@/lib/audit/cashEffect";
import { computeClosing, createClosing, lastCountedDays, loadCashBoxes, ClosingError } from "@/lib/audit/cashClosing";

// Numërimi i arkave (Faza 2 e auditimit) — çdo burim ka arkën e vet.
// GET ?box=CAT:4&date=YYYY-MM-DD → arkat, pamja paraprake e arkës së zgjedhur, numërimet e saj
// POST { box, date, counted, note } → ruan numërimin (gjendja e sistemit llogaritet këtu, në server)

function who(session: unknown) {
  const u = (session as { user?: { id?: string; name?: string | null; organizationId?: number } }).user;
  return { orgId: u?.organizationId ?? 1, actor: { id: parseInt(u?.id ?? "") || null, name: u?.name ?? null } };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "arka")) return NextResponse.json({ error: "Nuk ke leje" }, { status: 403 });
  const { orgId } = who(session);
  const sp = req.nextUrl.searchParams;
  const date = sp.get("date") || todayKey();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return NextResponse.json({ error: "Data e pavlefshme." }, { status: 400 });

  const [allBoxes, counted, usedCats] = await Promise.all([
    loadCashBoxes(prisma, orgId),
    lastCountedDays(prisma, orgId),
    prisma.payment.groupBy({ by: ["categoryId"], where: { organizationId: orgId, paidAmount: { gt: 0 } } }),
  ]);
  // Arkat e kategorive pa asnjë pagesë (kategori të papërdorura) s'shfaqen
  const used = new Set(usedCats.map(c => c.categoryId));
  const boxes = allBoxes.filter(b => b.categoryId == null || used.has(b.categoryId) || counted.has(b.key));
  const box = boxes.find(b => b.key === sp.get("box")) ?? boxes[0];
  const [preview, closings] = await Promise.all([
    computeClosing(prisma, orgId, box, date),
    prisma.cashClosing.findMany({ where: { organizationId: orgId, box: box.key }, orderBy: { date: "desc" }, take: 120 }),
  ]);
  return NextResponse.json({
    today: todayKey(), date, box: { key: box.key, label: box.label },
    boxes: boxes.map(b => ({ key: b.key, label: b.label, lastCounted: counted.get(b.key)?.date ?? null })),
    preview, closings, lastCounted: counted.get(box.key)?.date ?? null,
  });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "arka")) return NextResponse.json({ error: "Nuk ke leje" }, { status: 403 });
  const { orgId, actor } = who(session);
  const body = await req.json().catch(() => ({}));
  const box = (await loadCashBoxes(prisma, orgId)).find(b => b.key === body.box);
  if (!box) return NextResponse.json({ error: "Zgjidhni arkën." }, { status: 400 });
  const counted = typeof body.counted === "number" ? body.counted : parseFloat(String(body.counted ?? "").replace(",", "."));
  if (!Number.isFinite(counted) || counted < 0) return NextResponse.json({ error: "Shkruani shumën e numëruar (€)." }, { status: 400 });
  try {
    const c = await createClosing(prisma, orgId, actor, box, {
      date: String(body.date ?? todayKey()),
      countedCents: Math.round(counted * 100),
      note: typeof body.note === "string" ? body.note.slice(0, 1000) : null,
    });
    await logAction(session, "CREATE", "CashClosing", c.id,
      `Numërimi i arkës "${box.label}" ${c.date}${c.kind === "OPENING" ? " (i pari)" : ""}: sistemi ${(c.systemCents / 100).toFixed(2)} €, numëruar ${(c.countedCents / 100).toFixed(2)} €, diferenca ${(c.diffCents / 100).toFixed(2)} €`);
    return NextResponse.json(c, { status: 201 });
  } catch (e) {
    if (e instanceof ClosingError) return NextResponse.json({ error: e.message }, { status: e.status });
    if (e && typeof e === "object" && (e as { code?: string }).code === "P2002") {
      return NextResponse.json({ error: "Kjo arkë është numëruar tashmë në këtë datë." }, { status: 409 });
    }
    throw e;
  }
}
