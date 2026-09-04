import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Artikuj të aprovuar (plotësisht ose pjesërisht) që ende s'janë të lidhur
// (plotësisht) me asnjë porosi aktive — "gati për t'u porositur". Përdoret nga
// ndërtuesi i porosive (Faza 6) për të grupuar kërkesa nga mësimdhënës të
// ndryshëm në një porosi të vetme te furnitori.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "FINANCE") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const items = await prisma.materialRequestItem.findMany({
    where: {
      status: "APPROVED",
      approvedQuantity: { gt: 0 },
      request: { organizationId: orgId },
    },
    include: {
      material: { select: { id: true, name: true, defaultUnit: true, supplierId: true } },
      request: { select: { id: true, priority: true, teacher: { select: { name: true } } } },
      orderLinks: {
        where: { orderItem: { order: { status: { not: "CANCELLED" } } } },
        select: { quantityContributed: true },
      },
    },
    orderBy: { id: "asc" },
  });

  const pending = items
    .map(it => {
      const alreadyOrdered = it.orderLinks.reduce((s, l) => s + l.quantityContributed, 0);
      const remaining = (it.approvedQuantity ?? 0) - alreadyOrdered;
      return {
        requestItemId: it.id,
        requestId: it.request.id,
        teacherName: it.request.teacher.name,
        priority: it.request.priority,
        isCustom: it.isCustom,
        materialId: it.materialId,
        materialName: it.isCustom ? it.customItemName : it.material?.name,
        supplierId: it.material?.supplierId ?? null,
        unit: it.unit,
        color: it.color,
        approvedQuantity: it.approvedQuantity ?? 0,
        alreadyOrdered,
        remaining,
      };
    })
    .filter(it => it.remaining > 0);

  return NextResponse.json(pending);
}
