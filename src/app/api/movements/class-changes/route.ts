import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ACADEMIC_YEAR, getDateRange, type YearType } from "@/lib/academicYear";

// Ndërrimet e klasës brenda periudhës — nga historiku i nxënësit (NDRYSHIM_KLASE):
// zhvendosjet nga faqja e klasës, editimet e klasës dhe kalimi i vitit.
// Vetëm lexim; për kartën "Ndërrime klase" te "Lëvizjet".
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const sp = req.nextUrl.searchParams;
  const year = parseInt(sp.get("year") || "") || DEFAULT_ACADEMIC_YEAR;
  const yearType = (sp.get("yearType") || "academic") as YearType;
  const { start, end } = getDateRange(year, yearType);

  const events = await prisma.studentHistory.findMany({
    where: { type: "NDRYSHIM_KLASE", occurredAt: { gte: start, lte: end }, student: { organizationId: orgId } },
    include: {
      student: { select: { id: true, firstName: true, lastName: true } },
      user: { select: { name: true } },
    },
    orderBy: { occurredAt: "desc" },
    take: 500,
  });

  return NextResponse.json({
    count: events.length,
    entries: events.map(e => ({
      id: e.id,
      studentId: e.student.id,
      studentName: `${e.student.firstName} ${e.student.lastName}`,
      title: e.title,
      description: e.description,
      occurredAt: e.occurredAt.toISOString(),
      userName: e.user?.name ?? null,
    })),
  });
}
