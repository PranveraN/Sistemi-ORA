import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireManagement() {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "FINANCE") {
    return { error: NextResponse.json({ error: "Vetëm adminët ose financat mund të menaxhojnë kategoritë" }, { status: 403 }) };
  }
  return { session };
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth_ = await requireManagement();
  if (auth_.error) return auth_.error;
  const orgId: number = (auth_.session!.user as { organizationId?: number }).organizationId ?? 1;

  const { id } = await params;
  const categoryId = parseInt(id);
  const body = await req.json();

  const existing = await prisma.materialCategory.findFirst({ where: { id: categoryId, organizationId: orgId } });
  if (!existing) return NextResponse.json({ error: "Kategoria nuk u gjet" }, { status: 404 });

  const category = await prisma.materialCategory.update({
    where: { id: categoryId },
    data: {
      ...(body.name !== undefined && { name: String(body.name).trim() }),
      ...(body.active !== undefined && { active: Boolean(body.active) }),
    },
  });

  return NextResponse.json(category);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth_ = await requireManagement();
  if (auth_.error) return auth_.error;
  const orgId: number = (auth_.session!.user as { organizationId?: number }).organizationId ?? 1;

  const { id } = await params;
  const categoryId = parseInt(id);

  const existing = await prisma.materialCategory.findFirst({ where: { id: categoryId, organizationId: orgId } });
  if (!existing) return NextResponse.json({ error: "Kategoria nuk u gjet" }, { status: 404 });

  const materialsCount = await prisma.material.count({ where: { categoryId } });
  if (materialsCount > 0) {
    return NextResponse.json(
      { error: `Kjo kategori përdoret nga ${materialsCount} materiale — çaktivizoje në vend të fshirjes` },
      { status: 409 }
    );
  }

  await prisma.materialCategory.delete({ where: { id: categoryId } });
  return NextResponse.json({ success: true });
}
