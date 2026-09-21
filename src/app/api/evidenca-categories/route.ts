import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";

  const categories = await prisma.evidencaCategory.findMany({
    where: { organizationId: orgId, ...(includeInactive ? {} : { active: true }) },
    orderBy: { order: "asc" },
  });

  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const body = await req.json();

  if (!body.label?.trim()) return NextResponse.json({ message: "Etiketa është e domosdoshme." }, { status: 400 });

  const maxOrder = await prisma.evidencaCategory.aggregate({ where: { organizationId: orgId }, _max: { order: true } });

  const category = await prisma.evidencaCategory.create({
    data: { organizationId: orgId, label: body.label.trim(), order: (maxOrder._max.order ?? 0) + 1 },
  });

  return NextResponse.json(category);
}
