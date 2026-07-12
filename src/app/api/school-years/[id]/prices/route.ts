import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const { id } = await params;
  const schoolYearId = parseInt(id);

  const [categories, prices] = await Promise.all([
    prisma.paymentCategory.findMany({ where: { organizationId: orgId }, orderBy: { name: "asc" } }),
    prisma.paymentCategoryPrice.findMany({ where: { schoolYearId } }),
  ]);
  const priceMap = new Map(prices.map(p => [p.categoryId, p.defaultAmount]));

  return NextResponse.json(
    categories.map(c => ({
      categoryId: c.id,
      name: c.name,
      type: c.type,
      defaultAmount: priceMap.has(c.id) ? priceMap.get(c.id)! : c.defaultAmount,
    }))
  );
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Vetëm adminët mund të ndryshojnë çmimet" }, { status: 403 });
  }

  const { id } = await params;
  const schoolYearId = parseInt(id);
  const body = await req.json();
  const items: { categoryId: number; defaultAmount: number }[] = Array.isArray(body.prices) ? body.prices : [];
  if (!items.length) return NextResponse.json({ error: "Asnjë çmim i dërguar" }, { status: 400 });

  const year = await prisma.schoolYear.findUnique({ where: { id: schoolYearId } });
  if (!year) return NextResponse.json({ error: "Viti nuk u gjet" }, { status: 404 });

  try {
    await prisma.$transaction(async tx => {
      for (const item of items) {
        const amount = parseFloat(String(item.defaultAmount)) || 0;
        await tx.paymentCategoryPrice.upsert({
          where: { categoryId_schoolYearId: { categoryId: item.categoryId, schoolYearId } },
          update: { defaultAmount: amount },
          create: { categoryId: item.categoryId, schoolYearId, defaultAmount: amount },
        });
        // Pasqyro te PaymentCategory.defaultAmount VETËM nëse ky është viti aktiv —
        // kështu çdo vend ekzistues që lexon defaultAmount vazhdon të punojë pa u prekur.
        if (year.active) {
          await tx.paymentCategory.update({
            where: { id: item.categoryId },
            data: { defaultAmount: amount },
          });
        }
      }
    });

    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : String(e) }, { status: 500 });
  }
}
