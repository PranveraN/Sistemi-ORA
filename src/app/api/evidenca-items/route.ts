import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { EVIDENCA_ITEM_TYPES } from "@/lib/evidencaConfig";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";
  const section = req.nextUrl.searchParams.get("section");

  const items = await prisma.evidencaItem.findMany({
    where: {
      organizationId: orgId,
      ...(includeInactive ? {} : { active: true }),
      ...(section ? { section } : {}),
    },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(items.map(i => ({ ...i, options: i.options ? JSON.parse(i.options) : null })));
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const body = await req.json();

  if (!body.label?.trim()) return NextResponse.json({ message: "Etiketa është e domosdoshme." }, { status: 400 });
  if (!EVIDENCA_ITEM_TYPES.includes(body.type)) return NextResponse.json({ message: "Lloj i panjohur." }, { status: 400 });
  if (!["SKILLS", "GENERAL"].includes(body.section)) return NextResponse.json({ message: "Seksion i panjohur." }, { status: 400 });
  if (body.section === "SKILLS" && !body.categoryId) return NextResponse.json({ message: "Pikat e aftësive duhet t'i përkasin një kategorie." }, { status: 400 });

  const maxOrder = await prisma.evidencaItem.aggregate({ where: { organizationId: orgId, section: body.section }, _max: { order: true } });

  const item = await prisma.evidencaItem.create({
    data: {
      organizationId: orgId,
      section: body.section,
      categoryId: body.section === "SKILLS" ? Number(body.categoryId) : null,
      label: body.label.trim(),
      type: body.type,
      options: body.type === "CHOICE" && Array.isArray(body.options) ? JSON.stringify(body.options.filter(Boolean)) : null,
      hasSpecify: body.type === "YES_NO" ? !!body.hasSpecify : false,
      order: (maxOrder._max.order ?? 0) + 1,
    },
  });

  return NextResponse.json({ ...item, options: item.options ? JSON.parse(item.options) : null });
}
