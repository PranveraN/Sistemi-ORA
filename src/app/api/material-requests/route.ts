import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  const userId = Number((session.user as { id?: string }).id);
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const isManagement = role === "ADMIN" || role === "FINANCE";

  const teacherIdParam = req.nextUrl.searchParams.get("teacherId");
  const filterTeacherId = isManagement && teacherIdParam ? parseInt(teacherIdParam) : null;

  const requests = await prisma.materialRequest.findMany({
    where: {
      organizationId: orgId,
      ...(isManagement
        ? (filterTeacherId ? { teacherId: filterTeacherId } : {})
        : { teacherId: userId }),
    },
    include: {
      teacher: { select: { name: true, email: true } },
      reviewedBy: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(requests);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "TEACHER") {
    return NextResponse.json({ error: "Vetëm mësimdhënësit mund të dërgojnë kërkesa" }, { status: 403 });
  }

  const userId = Number((session.user as { id?: string }).id);
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const body = await req.json();
  const reason = String(body.reason ?? "").trim();
  const subjectOrClass = String(body.subjectOrClass ?? "").trim();

  const rawItems = Array.isArray(body.items) ? body.items : [];
  const items = rawItems
    .map((r: { item?: string; quantity?: string | number }) => ({
      item: String(r.item ?? "").trim(),
      quantity: Math.max(1, parseInt(String(r.quantity)) || 1),
    }))
    .filter((r: { item: string }) => r.item);

  if (!items.length || !reason) {
    return NextResponse.json({ error: "Të dhëna të mangëta" }, { status: 400 });
  }

  const created = await prisma.$transaction(
    items.map((it: { item: string; quantity: number }) =>
      prisma.materialRequest.create({
        data: {
          teacherId: userId,
          item: it.item,
          quantity: it.quantity,
          subjectOrClass: subjectOrClass || null,
          reason,
          status: "PENDING",
          organizationId: orgId,
        },
      })
    )
  );

  return NextResponse.json(created, { status: 201 });
}
