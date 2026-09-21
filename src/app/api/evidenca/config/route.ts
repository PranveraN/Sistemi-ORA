import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Kthen kategoritë+pikat aktive të dy seksioneve, gati për t'u renderuar te
// formulari i plotësimit të Evidencës (EvidencaForm.tsx).
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const [categories, items] = await Promise.all([
    prisma.evidencaCategory.findMany({ where: { organizationId: orgId, active: true }, orderBy: { order: "asc" } }),
    prisma.evidencaItem.findMany({ where: { organizationId: orgId, active: true }, orderBy: { order: "asc" } }),
  ]);

  const parsedItems = items.map(i => ({ ...i, options: i.options ? JSON.parse(i.options) : null }));

  const skills = categories
    .map(cat => ({ ...cat, items: parsedItems.filter(i => i.section === "SKILLS" && i.categoryId === cat.id) }))
    .filter(cat => cat.items.length > 0);

  const general = parsedItems.filter(i => i.section === "GENERAL");

  return NextResponse.json({ skills, general });
}
