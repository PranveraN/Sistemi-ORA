import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { planOrderedRequestsBackfill, recomputeRequestStatuses } from "@/lib/materialRequestStatus";

// Migrimi i kërkesave të materialeve te statuset e reja (vetëm Super Admin).
//   GET  → VETËM LEXIM: kërkesat sipas statusit + cilat kalojnë në Porositur/Dorëzuar
//   POST → zbaton të njëjtin plan (idempotent — mund të përsëritet)
// "Aprovuar pjesërisht" s'rishkruhet: shfaqet nën "Aprovuara" me etiketën "Pjesërisht".

async function superAdmin() {
  const session = await auth();
  return session && (session.user as { role?: string }).role === "SUPERADMIN" ? session : null;
}

export async function GET() {
  const session = await superAdmin();
  if (!session) return NextResponse.json({ error: "Vetëm Super Admin" }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const [byStatus, plan] = await Promise.all([
    prisma.materialRequest.groupBy({ by: ["status"], where: { organizationId: orgId }, _count: true }),
    planOrderedRequestsBackfill(orgId),
  ]);
  const changes = plan.filter(p => p.to !== p.from);
  const names = await prisma.materialRequest.findMany({
    where: { id: { in: changes.map(c => c.requestId) } },
    select: { id: true, createdAt: true, teacher: { select: { name: true } } },
  });
  const nameById = new Map(names.map(n => [n.id, n]));
  return NextResponse.json({
    byStatus: byStatus.map(s => ({ status: s.status, count: s._count })),
    changes: changes.map(c => ({ ...c, teacher: nameById.get(c.requestId)?.teacher.name ?? "—", createdAt: nameById.get(c.requestId)?.createdAt })),
    deliveryUpdates: plan.reduce((s, p) => s + p.deliveries.length, 0),
  });
}

export async function POST() {
  const session = await superAdmin();
  if (!session) return NextResponse.json({ error: "Vetëm Super Admin" }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const userId = Number((session.user as { id?: string }).id);

  const plan = await planOrderedRequestsBackfill(orgId);
  // Pa email te mësuesit — janë ndryshime historike, jo veprime të reja
  const changes = await prisma.$transaction(tx => recomputeRequestStatuses(tx, plan.map(p => p.requestId), userId, "Migrim te statuset e reja"));
  await logAction(session, "UPDATE", "MaterialRequest", null, `Migrimi i statuseve të kërkesave: ${changes.length} kërkesa kaluan në Porositur/Dorëzuar`);
  return NextResponse.json({ updated: changes.length });
}
