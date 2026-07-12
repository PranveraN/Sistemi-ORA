import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Vetëm adminët mund ta shohin këtë" }, { status: 403 });
  }

  const runs = await prisma.promotionRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 20,
    include: { toYear: { select: { label: true } }, user: { select: { name: true } } },
  });

  return NextResponse.json(
    runs.map(r => ({
      id: r.id,
      toYearLabel: r.toYear.label,
      userName: r.user.name,
      studentCount: r.studentCount,
      promotedCount: r.promotedCount,
      repeatedCount: r.repeatedCount,
      graduatedCount: r.graduatedCount,
      leftCount: r.leftCount,
      createdAt: r.createdAt,
    }))
  );
}
