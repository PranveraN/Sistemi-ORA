import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LABEL_RE = /^\d{4}-\d{4}$/;

function normalizeLabel(raw: string): string | null {
  const m = raw.trim().match(/^(\d{4})[/-](\d{4})$/);
  return m ? `${m[1]}-${m[2]}` : null;
}

async function bootstrapIfNeeded(orgId: number) {
  const count = await prisma.schoolYear.count({ where: { organizationId: orgId } });
  if (count > 0) return;

  const settingRow = await prisma.setting.findUnique({ where: { key: "schoolYear" } });
  let label = settingRow ? normalizeLabel(settingRow.value) : null;
  if (!label) {
    const now = new Date();
    const y = now.getFullYear();
    label = now.getMonth() + 1 >= 9 ? `${y}-${y + 1}` : `${y - 1}-${y}`;
  }

  const year = await prisma.schoolYear.create({
    data: { label, active: true, organizationId: orgId },
  });

  const categories = await prisma.paymentCategory.findMany({ where: { organizationId: orgId } });
  if (categories.length) {
    await prisma.paymentCategoryPrice.createMany({
      data: categories.map(c => ({ categoryId: c.id, schoolYearId: year.id, defaultAmount: c.defaultAmount })),
    });
  }
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  await bootstrapIfNeeded(orgId);

  const years = await prisma.schoolYear.findMany({
    where: { organizationId: orgId },
    orderBy: { label: "desc" },
  });
  return NextResponse.json(years);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Vetëm adminët mund të krijojnë vite shkollore" }, { status: 403 });
  }
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const body = await req.json();
  const label = String(body.label || "").trim();
  if (!LABEL_RE.test(label)) {
    return NextResponse.json({ error: 'Formati i vitit duhet të jetë "YYYY-YYYY", p.sh. "2027-2028"' }, { status: 400 });
  }

  try {
    const year = await prisma.schoolYear.create({
      data: {
        label,
        startDate: body.startDate ? new Date(body.startDate) : null,
        endDate: body.endDate ? new Date(body.endDate) : null,
        active: false,
        organizationId: orgId,
      },
    });

    // Fillo çmimet e vitit të ri me vlerat aktuale — admini i redakton më pas.
    const categories = await prisma.paymentCategory.findMany({ where: { organizationId: orgId } });
    if (categories.length) {
      await prisma.paymentCategoryPrice.createMany({
        data: categories.map(c => ({ categoryId: c.id, schoolYearId: year.id, defaultAmount: c.defaultAmount })),
      });
    }

    return NextResponse.json(year, { status: 201 });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: `Viti "${label}" ekziston tashmë` }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
