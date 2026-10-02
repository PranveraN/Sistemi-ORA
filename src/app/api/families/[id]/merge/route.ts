import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { recordStudentEvent } from "@/lib/studentHistory";
import { logAction } from "@/lib/audit";
import { familyLabel } from "@/lib/families";

// Bashkimi i familjeve — POST { targetId } bashkon KËTË familje (burimi) te
// targetId: kalojnë fëmijët (me prindërit/numrat e tyre), shënimet dhe
// dokumentet; familja burim fshihet. Në një transaksion; regjistrohet te
// historiku i çdo fëmije. Bëhet VETËM me konfirmim nga dialogu.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "families")) return NextResponse.json({ error: "Nuk ke leje." }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const { id } = await params;
  const sourceId = parseInt(id) || 0;
  const body = await req.json().catch(() => ({}));
  const targetId = parseInt(body.targetId);
  if (!targetId || targetId === sourceId) return NextResponse.json({ error: "Zgjidh familjen tjetër." }, { status: 400 });

  const [source, target] = await Promise.all([
    prisma.family.findFirst({ where: { id: sourceId, organizationId: orgId }, include: { students: { select: { id: true, lastName: true } } } }),
    prisma.family.findFirst({ where: { id: targetId, organizationId: orgId }, include: { students: { select: { id: true, lastName: true } } } }),
  ]);
  if (!source || !target) return NextResponse.json({ error: "Familja nuk u gjet" }, { status: 404 });

  const sourceLabel = familyLabel(source.displayName, source.students.map(s => s.lastName));
  const targetLabel = familyLabel(target.displayName, target.students.map(s => s.lastName));

  await prisma.$transaction(async tx => {
    await tx.student.updateMany({ where: { familyRefId: source.id }, data: { familyRefId: target.id } });
    await tx.familyNote.updateMany({ where: { familyId: source.id }, data: { familyId: target.id } });
    await tx.familyDocument.updateMany({ where: { familyId: source.id }, data: { familyId: target.id } });
    await tx.familyNote.create({
      data: {
        familyId: target.id,
        text: `Familja "${sourceLabel}" (${source.students.length} fëmijë) u bashkua me këtë familje.`,
        authorId: parseInt((session.user as { id?: string }).id ?? "0") || null,
        authorName: (session.user as { name?: string | null }).name ?? null,
      },
    });
    await tx.family.delete({ where: { id: source.id } });
  });

  await recordStudentEvent(session, source.students.map(s => ({
    studentId: s.id, type: "NDRYSHIM_TE_DHENASH" as const,
    title: `Familja u bashkua me "${targetLabel}"`,
    description: `Nga familja "${sourceLabel}"`,
  })));
  await logAction(session, "UPDATE", "Family", target.id, `Bashkoi familjen "${sourceLabel}" (#${source.id}) me "${targetLabel}" (#${target.id})`);
  return NextResponse.json({ ok: true, targetId: target.id });
}
