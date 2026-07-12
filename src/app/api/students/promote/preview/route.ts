import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { proposeNextClass } from "@/lib/promotion";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") {
    return NextResponse.json({ error: "Vetëm adminët mund ta shohin këtë" }, { status: 403 });
  }
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const { searchParams } = new URL(req.url);
  const toYearId = parseInt(searchParams.get("toYearId") || "");
  if (!toYearId) return NextResponse.json({ error: "Mungon toYearId" }, { status: 400 });

  const [toYear, fromYear, alreadyRun, classes, students] = await Promise.all([
    prisma.schoolYear.findUnique({ where: { id: toYearId } }),
    prisma.schoolYear.findFirst({ where: { organizationId: orgId, active: true } }),
    prisma.promotionRun.findFirst({ where: { toYearId } }),
    prisma.class.findMany({ where: { organizationId: orgId } }),
    prisma.student.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      include: { class: true },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
  ]);

  if (!toYear) return NextResponse.json({ error: "Viti destinacion nuk u gjet" }, { status: 404 });

  const studentRows = students.map(s => {
    const proposal = proposeNextClass(s.class, classes);
    return {
      studentId: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      currentClassId: s.class?.id ?? null,
      currentClassName: s.class?.name ?? null,
      currentClassLevel: s.class?.level ?? null,
      discountPct: s.discountPct,
      proposedOutcome: proposal.outcome,
      proposedClassId: proposal.targetClassId,
      proposedClassName: proposal.targetClassName,
    };
  });

  const mappingKey = (r: (typeof studentRows)[number]) => `${r.currentClassId ?? "none"}→${r.proposedClassId ?? "none"}`;
  const mappingGroups = new Map<string, { fromClassId: number | null; fromClassName: string | null; toClassId: number | null; toClassName: string | null; studentCount: number }>();
  for (const r of studentRows) {
    const key = mappingKey(r);
    const existing = mappingGroups.get(key);
    if (existing) existing.studentCount++;
    else mappingGroups.set(key, {
      fromClassId: r.currentClassId, fromClassName: r.currentClassName,
      toClassId: r.proposedClassId, toClassName: r.proposedClassName,
      studentCount: 1,
    });
  }

  const summary = {
    total: studentRows.length,
    promoted: studentRows.filter(r => r.proposedOutcome === "PROMOTED").length,
    graduated: studentRows.filter(r => r.proposedOutcome === "GRADUATED").length,
    manual: studentRows.filter(r => r.proposedOutcome === "MANUAL").length,
  };

  return NextResponse.json({
    fromYear: fromYear ? { id: fromYear.id, label: fromYear.label } : null,
    toYear: { id: toYear.id, label: toYear.label },
    alreadyPromoted: !!alreadyRun,
    summary,
    classMapping: [...mappingGroups.values()],
    students: studentRows,
  });
}
