import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

// Rregullim manual i stokut (jo nga pranimi i një porosie) — p.sh. dhurime,
// dëmtim, humbje, ose korrigjim numërimi. `delta` mund të jetë negativ.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "FINANCE") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }

  const userId = Number((session.user as { id?: string }).id);
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const { id } = await params;
  const materialId = parseInt(id);

  const body = await req.json();
  const delta = parseInt(String(body.delta));
  const note = body.note ? String(body.note).trim() : null;
  if (!delta) return NextResponse.json({ error: "Ndryshimi (delta) mungon ose është 0" }, { status: 400 });

  const material = await prisma.material.findFirst({ where: { id: materialId, organizationId: orgId } });
  if (!material) return NextResponse.json({ error: "Materiali nuk u gjet" }, { status: 404 });

  const newStock = material.currentStock + delta;
  if (newStock < 0) {
    return NextResponse.json({ error: `Stoku s'mund të bëhet negativ (aktual: ${material.currentStock}, ndryshimi: ${delta})` }, { status: 400 });
  }

  const [updated] = await prisma.$transaction([
    prisma.material.update({ where: { id: materialId }, data: { currentStock: newStock } }),
    prisma.materialInventoryTransaction.create({
      data: {
        organizationId: material.organizationId,
        materialId,
        type: "ADJUSTMENT",
        quantity: delta,
        balanceAfter: newStock,
        note,
        createdById: userId,
      },
    }),
  ]);

  await logAction(session, "UPDATE", "Material", materialId,
    `Rregulloi stokun e "${material.name}" me ${delta > 0 ? "+" : ""}${delta} (${material.currentStock} → ${newStock})${note ? ` — ${note}` : ""}`);

  return NextResponse.json(updated);
}
