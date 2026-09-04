import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const isManagement = role === "ADMIN" || role === "FINANCE";

  const categoryIdParam = req.nextUrl.searchParams.get("categoryId");

  const materials = await prisma.material.findMany({
    where: {
      organizationId: orgId,
      ...(isManagement ? {} : { active: true }),
      ...(categoryIdParam ? { categoryId: parseInt(categoryIdParam) } : {}),
    },
    include: {
      category: { select: { id: true, name: true } },
      supplier: { select: { id: true, emri: true } },
    },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(materials);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "FINANCE") {
    return NextResponse.json({ error: "Vetëm adminët ose financat mund të menaxhojnë materialet" }, { status: 403 });
  }

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const body = await req.json();

  const name = String(body.name ?? "").trim();
  const categoryId = parseInt(String(body.categoryId ?? ""));
  if (!name) return NextResponse.json({ error: "Emri mungon" }, { status: 400 });
  if (!categoryId) return NextResponse.json({ error: "Kategoria mungon" }, { status: 400 });

  const category = await prisma.materialCategory.findFirst({ where: { id: categoryId, organizationId: orgId } });
  if (!category) return NextResponse.json({ error: "Kategoria e zgjedhur nuk ekziston" }, { status: 400 });

  if (body.supplierId) {
    const supplier = await prisma.sipartner.findUnique({ where: { id: parseInt(String(body.supplierId)) } });
    if (!supplier) return NextResponse.json({ error: "Furnitori i zgjedhur nuk ekziston" }, { status: 400 });
  }

  const existing = await prisma.material.findFirst({
    where: { organizationId: orgId, name: { equals: name } },
  });
  if (existing) return NextResponse.json({ error: "Ky material ekziston tashmë" }, { status: 409 });

  const material = await prisma.material.create({
    data: {
      organizationId: orgId,
      categoryId,
      name,
      description: body.description ? String(body.description).trim() : null,
      defaultUnit: body.defaultUnit ? String(body.defaultUnit) : "copë",
      needsColor: Boolean(body.needsColor),
      sku: body.sku ? String(body.sku).trim() : null,
      supplierId: body.supplierId ? parseInt(String(body.supplierId)) : null,
      defaultPrice: body.defaultPrice !== undefined && body.defaultPrice !== "" ? parseFloat(body.defaultPrice) : null,
      minStock: body.minStock !== undefined && body.minStock !== "" ? parseInt(String(body.minStock)) : 0,
      maxStock: body.maxStock !== undefined && body.maxStock !== "" ? parseInt(String(body.maxStock)) : null,
    },
    include: {
      category: { select: { id: true, name: true } },
      supplier: { select: { id: true, emri: true } },
    },
  });

  return NextResponse.json(material, { status: 201 });
}
