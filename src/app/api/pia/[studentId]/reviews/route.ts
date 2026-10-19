import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ACADEMIC_YEAR } from "@/lib/academicYear";
import { canEditSpecialCare } from "@/lib/specialCarePermissions";
import { normalizeReview } from "@/lib/pia";

// Vlerësim i ri i PIA-s — kurdo, me datë (pa periudha të caktuara).
// POST ?year=2026 { date, data }
export async function POST(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const role = ((session as { user?: { role?: string } }).user?.role) ?? "";
  if (!canEditSpecialCare(role)) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const studentId = parseInt((await params).studentId);
  const year = parseInt(req.nextUrl.searchParams.get("year") || "") || DEFAULT_ACADEMIC_YEAR;

  const pia = await prisma.studentPia.findUnique({ where: { studentId_academicYear: { studentId, academicYear: year } }, select: { id: true } });
  if (!pia) return NextResponse.json({ error: "Ruaje fillimisht planin (PIA), pastaj shto vlerësimin." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const date = body.date ? new Date(body.date) : new Date();
  if (isNaN(date.getTime())) return NextResponse.json({ error: "Data s'është e vlefshme" }, { status: 400 });
  const r = await prisma.piaReview.create({
    data: { piaId: pia.id, date, data: JSON.stringify(normalizeReview(body.data)), updatedByName: (session.user as { name?: string | null }).name ?? null },
  });
  return NextResponse.json({ id: r.id }, { status: 201 });
}
