import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { MATERIAL_CATALOG_SEED } from "@/lib/materialCatalogSeed";

// Rifreskon krejt katalogun e materialeve: fshin-butë (active:false) çdo
// kategori/material ekzistues (ruan historikun e kërkesave/porosive të vjetra
// të lidhura me to), pastaj krijon kategoritë dhe materialet e reja nga
// MATERIAL_CATALOG_SEED. Asnjë kërkesë/porosi ekzistuese s'preket.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "FINANCE") {
    return NextResponse.json({ error: "Vetëm adminët ose financat mund ta rifreskojnë katalogun" }, { status: 403 });
  }

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const body = await req.json().catch(() => ({}));
  if (body.confirm !== true) {
    return NextResponse.json({ error: "Konfirmimi mungon" }, { status: 400 });
  }

  await prisma.materialCategory.updateMany({ where: { organizationId: orgId, active: true }, data: { active: false } });
  await prisma.material.updateMany({ where: { organizationId: orgId, active: true }, data: { active: false } });

  let categoriesCreated = 0;
  let materialsCreated = 0;

  for (const group of MATERIAL_CATALOG_SEED) {
    const category = await prisma.materialCategory.create({
      data: { name: group.category, organizationId: orgId },
    });
    categoriesCreated++;

    await prisma.material.createMany({
      data: group.items.map(name => ({
        name, categoryId: category.id, organizationId: orgId,
      })),
    });
    materialsCreated += group.items.length;
  }

  await logAction(session, "CREATE", "Material", null,
    `Rifreskoi katalogun e materialeve — ${categoriesCreated} kategori, ${materialsCreated} materiale`);

  return NextResponse.json({ categoriesCreated, materialsCreated });
}
