import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const categories = await prisma.paymentCategory.findMany({
    where: { organizationId: orgId },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(categories);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const body = await req.json();
  const cat = await prisma.paymentCategory.create({
    data: {
      name: body.name,
      description: body.description || null,
      type: body.type || "monthly",
      organizationId: orgId,
    },
  });

  return NextResponse.json(cat, { status: 201 });
}
