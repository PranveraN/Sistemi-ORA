import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Lista e thjeshtë manuale e nxënësve të Klasës 9 që u diplomuan/u larguan —
// s'janë të lidhur me asnjë Student real (shih GradeNineLeaver në schema).

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") || "0");
  const yearType = searchParams.get("yearType") || "academic";

  const entries = await prisma.gradeNineLeaver.findMany({
    where: { organizationId: orgId, year, yearType },
    orderBy: { fullName: "asc" },
  });

  return NextResponse.json({ count: entries.length, entries });
}

interface BulkEntry { fullName: string; className?: string }

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const body = await req.json();
  const year = parseInt(body.year);
  const yearType = body.yearType === "calendar" ? "calendar" : "academic";
  const entries: BulkEntry[] = Array.isArray(body.entries) ? body.entries : [];
  const valid = entries.filter(e => e.fullName?.trim());

  if (!year || valid.length === 0) {
    return NextResponse.json({ error: "Të dhëna të mangëta" }, { status: 400 });
  }

  const result = await prisma.gradeNineLeaver.createMany({
    data: valid.map(e => ({
      organizationId: orgId,
      fullName: e.fullName.trim(),
      className: e.className?.trim() || null,
      year,
      yearType,
    })),
  });

  return NextResponse.json({ count: result.count }, { status: 201 });
}
