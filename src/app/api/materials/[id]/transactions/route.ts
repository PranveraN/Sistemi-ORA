import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "FINANCE") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const { id } = await params;
  const materialId = parseInt(id);

  const material = await prisma.material.findFirst({ where: { id: materialId, organizationId: orgId } });
  if (!material) return NextResponse.json({ error: "Materiali nuk u gjet" }, { status: 404 });

  const transactions = await prisma.materialInventoryTransaction.findMany({
    where: { materialId },
    include: {
      createdBy: { select: { name: true } },
      orderItem: { select: { order: { select: { orderNumber: true } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json(transactions);
}
