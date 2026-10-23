import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logTimi, reasonFrom, type TimiAuditEntry } from "@/lib/timiAudit";

const TIMI_STAGES = ["PROFATURE", "NE_PROCES", "KRYER", "PEZULLUAR", "ANULUAR"];
// Fushat e marrëveshjes që kërkojnë arsye kur ndryshojnë (moduli TIMI, Faza 2)
const PRICE_FIELDS = ["regularPrice", "discountPct", "manualDiscAmt"] as const;
const AUDITED = ["firstName", "lastName", "parentName", "parentPhone", "regularPrice", "discountPct", "manualDiscAmt", "notes", "active", "stage", "studentId"] as const;

function actorOf(session: unknown) {
  const u = (session as { user?: { id?: string; name?: string | null; organizationId?: number } }).user;
  return { orgId: u?.organizationId ?? 1, actor: { id: parseInt(u?.id ?? "") || null, name: u?.name ?? null } };
}

const ALLOWED_ROLES = ["ADMIN", "SUPERADMIN", "FINANCE"];

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (!ALLOWED_ROLES.includes(role ?? "")) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const now = new Date().toISOString();
  const sid = parseInt(id);
  const before = await prisma.timiInvestStudent.findUnique({ where: { id: sid } });
  if (!before) return NextResponse.json({ error: "S'u gjet." }, { status: 404 });
  // Vlerat e reja të normalizuara (si ruhen më poshtë) — për krahasim dhe historik
  const next: Record<string, unknown> = {};
  for (const k of AUDITED) {
    if (!(k in body) || body[k] === undefined) continue;
    next[k] = k === "regularPrice" ? parseFloat(body[k]) : (k === "discountPct" || k === "manualDiscAmt") ? (parseFloat(body[k]) || 0)
      : k === "active" ? !!body[k] : k === "studentId" ? (body[k] ? parseInt(body[k]) : null) : body[k];
  }
  if (next.stage !== undefined && !TIMI_STAGES.includes(String(next.stage))) delete next.stage;
  const changed = Object.keys(next).filter(k => String(next[k] ?? "") !== String((before as Record<string, unknown>)[k] ?? ""));
  const arsye = reasonFrom(req.headers.get("x-audit-reason"), typeof body.reason === "string" ? body.reason : undefined);
  if (changed.some(k => (PRICE_FIELDS as readonly string[]).includes(k)) && (!arsye || arsye.length < 3)) {
    return NextResponse.json({ error: "Ndryshimi i çmimit ose i zbritjes kërkon arsye (të paktën 3 shenja)." }, { status: 400 });
  }

  // `studentId` mund të lidhet me çdo numër pa asnjë verifikim ekzistence —
  // nëse jepet dhe s'ekziston, refuzohet me gabim të qartë (jo lidhje "e heshtur"
  // me nxënës të gabuar/joekzistues).
  if (body.studentId) {
    const targetId = parseInt(body.studentId);
    const exists = await prisma.student.findUnique({ where: { id: targetId }, select: { id: true } });
    if (!exists) return NextResponse.json({ error: `Nxënësi #${targetId} nuk ekziston` }, { status: 400 });
  }
  if (body.firstName    !== undefined) await prisma.$executeRawUnsafe(`UPDATE TimiInvestStudent SET firstName=?, updatedAt=? WHERE id=?`,    body.firstName, now, sid);
  if (body.lastName     !== undefined) await prisma.$executeRawUnsafe(`UPDATE TimiInvestStudent SET lastName=?, updatedAt=? WHERE id=?`,     body.lastName,  now, sid);
  if (body.parentName   !== undefined) await prisma.$executeRawUnsafe(`UPDATE TimiInvestStudent SET parentName=?, updatedAt=? WHERE id=?`,   body.parentName, now, sid);
  if (body.parentPhone  !== undefined) await prisma.$executeRawUnsafe(`UPDATE TimiInvestStudent SET parentPhone=?, updatedAt=? WHERE id=?`,  body.parentPhone, now, sid);
  if (body.regularPrice !== undefined) await prisma.$executeRawUnsafe(`UPDATE TimiInvestStudent SET regularPrice=?, updatedAt=? WHERE id=?`, parseFloat(body.regularPrice), now, sid);
  if (body.discountPct  !== undefined) await prisma.$executeRawUnsafe(`UPDATE TimiInvestStudent SET discountPct=?, updatedAt=? WHERE id=?`,  parseFloat(body.discountPct) || 0, now, sid);
  if (body.manualDiscAmt !== undefined) await prisma.$executeRawUnsafe(`UPDATE TimiInvestStudent SET manualDiscAmt=?, updatedAt=? WHERE id=?`, parseFloat(body.manualDiscAmt) || 0, now, sid);
  if (body.notes        !== undefined) await prisma.$executeRawUnsafe(`UPDATE TimiInvestStudent SET notes=?, updatedAt=? WHERE id=?`,        body.notes, now, sid);
  if (body.active       !== undefined) await prisma.$executeRawUnsafe(`UPDATE TimiInvestStudent SET active=?, updatedAt=? WHERE id=?`,       body.active ? 1 : 0, now, sid);
  if (body.stage        !== undefined && TIMI_STAGES.includes(body.stage))
                                        await prisma.$executeRawUnsafe(`UPDATE TimiInvestStudent SET stage=?, updatedAt=? WHERE id=?`,        body.stage, now, sid);
  if ("studentId"       in body)       await prisma.$executeRawUnsafe(`UPDATE TimiInvestStudent SET studentId=?, updatedAt=? WHERE id=?`,    body.studentId ? parseInt(body.studentId) : null, now, sid);

  const { orgId, actor } = actorOf(session);
  const entries: TimiAuditEntry[] = changed.map(k => ({
    action: "UPDATE", entity: "TimiInvestStudent", entityId: sid, tiId: sid, studentId: (next.studentId as number | null | undefined) ?? before.studentId,
    field: k, oldValue: (before as Record<string, unknown>)[k], newValue: next[k], reason: arsye,
  }));
  await logTimi(prisma, orgId, actor, entries);

  const [student] = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(`SELECT * FROM TimiInvestStudent WHERE id=?`, sid);
  return NextResponse.json(student);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string }).role;
  if (!ALLOWED_ROLES.includes(role ?? "")) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });

  const { id } = await params;
  const before = await prisma.timiInvestStudent.findUnique({ where: { id: parseInt(id) } });
  if (before) {
    const { orgId, actor } = actorOf(session);
    await logTimi(prisma, orgId, actor, [{ action: "DELETE", entity: "TimiInvestStudent", entityId: before.id, tiId: before.id, studentId: before.studentId, field: "lidhja", oldValue: before, newValue: null, reason: reasonFrom(req.headers.get("x-audit-reason")) }]);
  }
  await prisma.timiInvestStudent.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
