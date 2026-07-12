import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const LABEL_RE = /^\d{4}-\d{4}$/;

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Vetëm adminët mund të ndryshojnë vitet shkollore" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();

  const data: Record<string, unknown> = {};
  if (body.label !== undefined) {
    const label = String(body.label).trim();
    if (!LABEL_RE.test(label)) {
      return NextResponse.json({ error: 'Formati i vitit duhet të jetë "YYYY-YYYY"' }, { status: 400 });
    }
    data.label = label;
  }
  if (body.startDate !== undefined) data.startDate = body.startDate ? new Date(body.startDate) : null;
  if (body.endDate !== undefined) data.endDate = body.endDate ? new Date(body.endDate) : null;

  try {
    const year = await prisma.schoolYear.update({ where: { id: parseInt(id) }, data });
    return NextResponse.json(year);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("Unique constraint")) {
      return NextResponse.json({ error: `Viti "${body.label}" ekziston tashmë` }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Vetëm adminët mund të fshijnë vitet shkollore" }, { status: 403 });
  }

  const { id } = await params;
  const year = await prisma.schoolYear.findUnique({
    where: { id: parseInt(id) },
    include: { _count: { select: { studentHistory: true, promotions: true } } },
  });
  if (!year) return NextResponse.json({ error: "Viti nuk u gjet" }, { status: 404 });
  if (year.active) {
    return NextResponse.json({ error: "Nuk mund të fshihet viti aktiv" }, { status: 400 });
  }
  if (year._count.studentHistory > 0 || year._count.promotions > 0) {
    return NextResponse.json({ error: "Ky vit ka histori nxënësish të lidhur — nuk mund të fshihet" }, { status: 400 });
  }

  await prisma.paymentCategoryPrice.deleteMany({ where: { schoolYearId: year.id } });
  await prisma.schoolYear.delete({ where: { id: year.id } });
  return NextResponse.json({ success: true });
}
