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

  // Numri i pagesave për kategori — vetëm lexim, ndihmon admin-in të dallojë
  // kategoritë "reale" (me histori) nga ato bosh/të vjetruara/dublikatë, pa
  // pasur nevojë të hapë çdo faqe kategorie veç e veç (shih dyshja Eshkollori/
  // Platforma Digjitale — të njëjtin emërtim, kategori TË NDARA në bazë).
  const counts = await prisma.payment.groupBy({
    by: ["categoryId"],
    where: { organizationId: orgId },
    _count: { id: true },
    _sum: { paidAmount: true },
  });
  const countMap = new Map(counts.map(c => [c.categoryId, { count: c._count.id, paidTotal: c._sum.paidAmount ?? 0 }]));

  return NextResponse.json(categories.map(c => ({
    ...c,
    paymentCount: countMap.get(c.id)?.count ?? 0,
    paymentTotal: countMap.get(c.id)?.paidTotal ?? 0,
  })));
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
