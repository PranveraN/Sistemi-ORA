import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireManagement() {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "FINANCE") {
    return { error: NextResponse.json({ error: "Vetëm adminët ose financat mund të menaxhojnë materialet" }, { status: 403 }) };
  }
  return { session };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth_ = await requireManagement();
  if (auth_.error) return auth_.error;
  const orgId: number = (auth_.session!.user as { organizationId?: number }).organizationId ?? 1;

  const { id } = await params;
  const materialId = parseInt(id);
  const body = await req.json();

  const existing = await prisma.material.findFirst({ where: { id: materialId, organizationId: orgId } });
  if (!existing) return NextResponse.json({ error: "Materiali nuk u gjet" }, { status: 404 });

  if (body.categoryId !== undefined) {
    const category = await prisma.materialCategory.findFirst({ where: { id: parseInt(String(body.categoryId)), organizationId: orgId } });
    if (!category) return NextResponse.json({ error: "Kategoria e zgjedhur nuk ekziston" }, { status: 400 });
  }
  if (body.supplierId) {
    const supplier = await prisma.sipartner.findUnique({ where: { id: parseInt(String(body.supplierId)) } });
    if (!supplier) return NextResponse.json({ error: "Furnitori i zgjedhur nuk ekziston" }, { status: 400 });
  }

  const material = await prisma.material.update({
    where: { id: materialId },
    data: {
      ...(body.name !== undefined && { name: String(body.name).trim() }),
      ...(body.description !== undefined && { description: body.description ? String(body.description).trim() : null }),
      ...(body.categoryId !== undefined && { categoryId: parseInt(String(body.categoryId)) }),
      ...(body.defaultUnit !== undefined && { defaultUnit: String(body.defaultUnit) }),
      ...(body.needsColor !== undefined && { needsColor: Boolean(body.needsColor) }),
      ...(body.sku !== undefined && { sku: body.sku ? String(body.sku).trim() : null }),
      ...(body.supplierId !== undefined && { supplierId: body.supplierId ? parseInt(String(body.supplierId)) : null }),
      ...(body.defaultPrice !== undefined && { defaultPrice: body.defaultPrice !== "" && body.defaultPrice !== null ? parseFloat(body.defaultPrice) : null }),
      ...(body.minStock !== undefined && { minStock: parseInt(String(body.minStock)) || 0 }),
      ...(body.maxStock !== undefined && { maxStock: body.maxStock !== "" && body.maxStock !== null ? parseInt(String(body.maxStock)) : null }),
      ...(body.active !== undefined && { active: Boolean(body.active) }),
    },
    include: {
      category: { select: { id: true, name: true } },
      supplier: { select: { id: true, emri: true } },
    },
  });

  return NextResponse.json(material);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth_ = await requireManagement();
  if (auth_.error) return auth_.error;
  const orgId: number = (auth_.session!.user as { organizationId?: number }).organizationId ?? 1;

  const { id } = await params;
  const materialId = parseInt(id);

  const existing = await prisma.material.findFirst({ where: { id: materialId, organizationId: orgId } });
  if (!existing) return NextResponse.json({ error: "Materiali nuk u gjet" }, { status: 404 });

  const [requestItems, orderItems, transactions] = await Promise.all([
    prisma.materialRequestItem.count({ where: { materialId } }),
    prisma.materialOrderItem.count({ where: { materialId } }),
    prisma.materialInventoryTransaction.count({ where: { materialId } }),
  ]);
  const usedCount = requestItems + orderItems + transactions;
  if (usedCount > 0) {
    return NextResponse.json(
      { error: "Ky material është përdorur tashmë në kërkesa/porosi/stok — çaktivizoje në vend të fshirjes" },
      { status: 409 }
    );
  }

  await prisma.material.delete({ where: { id: materialId } });
  return NextResponse.json({ success: true });
}
