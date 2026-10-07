import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sessionHasModule } from "@/lib/specialCarePermissions";

// Shënimi "Zbritje e paparashikueshme" (ose tekst tjetër) për nxënës të zgjedhur
// me dorë, për një vit shkollor. GET ?year · POST { year, studentIds, label } · DELETE { year, studentIds }
const MODULE = "USHQIMI";

async function guard() {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!sessionHasModule(session, "ushqimi")) return { error: NextResponse.json({ error: "Nuk ke leje" }, { status: 403 }) };
  const u = session.user as { id?: string; name?: string | null; organizationId?: number };
  return { session, user: { id: parseInt(u.id ?? "") || null, name: u.name ?? null, orgId: u.organizationId ?? 1 } };
}

export async function GET(req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  const year = parseInt(req.nextUrl.searchParams.get("year") || "") || 0;
  const tags = await prisma.studentTag.findMany({
    where: { module: MODULE, schoolYear: year, organizationId: g.user!.orgId },
    select: { studentId: true, label: true, createdByName: true, createdAt: true },
  });
  return NextResponse.json(tags);
}

export async function POST(req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  const body = await req.json().catch(() => ({}));
  const year = parseInt(String(body.year)) || 0;
  const label = String(body.label ?? "").trim().slice(0, 60);
  const ids: number[] = Array.isArray(body.studentIds) ? body.studentIds.map((x: unknown) => parseInt(String(x))).filter(Boolean) : [];
  if (!year || !ids.length) return NextResponse.json({ error: "Zgjidhni nxënësit." }, { status: 400 });
  if (!label) return NextResponse.json({ error: "Shkruani tekstin e shënimit." }, { status: 400 });
  const u = g.user!;
  for (const studentId of ids) {
    await prisma.studentTag.upsert({
      where: { studentId_module_schoolYear: { studentId, module: MODULE, schoolYear: year } },
      update: { label, createdById: u.id, createdByName: u.name },
      create: { organizationId: u.orgId, studentId, module: MODULE, schoolYear: year, label, createdById: u.id, createdByName: u.name },
    });
  }
  await logAction(g.session, "UPDATE", "StudentTag", null, `Ushqimi ${year}–${year + 1}: "${label}" për ${ids.length} nxënës (${ids.join(", ")})`);
  return NextResponse.json({ ok: true, count: ids.length });
}

export async function DELETE(req: NextRequest) {
  const g = await guard();
  if (g.error) return g.error;
  const body = await req.json().catch(() => ({}));
  const year = parseInt(String(body.year)) || 0;
  const ids: number[] = Array.isArray(body.studentIds) ? body.studentIds.map((x: unknown) => parseInt(String(x))).filter(Boolean) : [];
  if (!year || !ids.length) return NextResponse.json({ error: "Zgjidhni nxënësit." }, { status: 400 });
  const r = await prisma.studentTag.deleteMany({ where: { module: MODULE, schoolYear: year, studentId: { in: ids }, organizationId: g.user!.orgId } });
  await logAction(g.session, "DELETE", "StudentTag", null, `Ushqimi ${year}–${year + 1}: hoqi shënimin për ${r.count} nxënës`);
  return NextResponse.json({ ok: true, count: r.count });
}
