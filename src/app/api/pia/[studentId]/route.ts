import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ACADEMIC_YEAR } from "@/lib/academicYear";
import { recordStudentEvent } from "@/lib/studentHistory";
import { canEditSpecialCare, canViewSpecialCare } from "@/lib/specialCarePermissions";
import { normalizePia, normalizeReview, parseJson } from "@/lib/pia";

// Plani Individual i Arsimit — TË DHËNA TË NDJESHME, me lejet e "Kujdesit të veçantë".
// GET ?year=2026 → nxënësi + plani (ose null) + vlerësimet
// PUT ?year=2026 { data } → ruan planin (e krijon nëse s'ekziston)

const roleOf = (s: unknown) => ((s as { user?: { role?: string } })?.user?.role) ?? "";
const nameOf = (s: unknown) => ((s as { user?: { name?: string | null } })?.user?.name) ?? null;
const yearOf = (req: NextRequest) => parseInt(req.nextUrl.searchParams.get("year") || "") || DEFAULT_ACADEMIC_YEAR;

export async function GET(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewSpecialCare(roleOf(session))) return NextResponse.json({ error: "Nuk ke leje për këto të dhëna" }, { status: 403 });
  const studentId = parseInt((await params).studentId);
  const year = yearOf(req);

  const student = await prisma.student.findUnique({
    where: { id: studentId },
    select: {
      id: true, firstName: true, lastName: true, birthDate: true, parentName: true, parentPhone: true,
      fatherName: true, fatherPhone: true, motherName: true, motherPhone: true,
      class: { select: { name: true } },
    },
  });
  if (!student) return NextResponse.json({ error: "Nxënësi nuk u gjet" }, { status: 404 });

  const [pia, care, years] = await Promise.all([
    prisma.studentPia.findUnique({ where: { studentId_academicYear: { studentId, academicYear: year } }, include: { reviews: { orderBy: { date: "asc" } } } }),
    prisma.studentSpecialCare.findFirst({ where: { studentId }, orderBy: { updatedAt: "desc" }, include: { assistant: { select: { emri: true } } } }),
    prisma.studentPia.findMany({ where: { studentId }, select: { academicYear: true }, orderBy: { academicYear: "desc" } }),
  ]);

  return NextResponse.json({
    canEdit: canEditSpecialCare(roleOf(session)),
    year,
    years: years.map(y => y.academicYear),
    student: {
      ...student,
      className: student.class?.name ?? null,
      assistantName: care?.assistant?.emri ?? null,
      hasAssistant: care?.hasAssistant ?? false,
    },
    pia: pia ? {
      id: pia.id, updatedAt: pia.updatedAt, updatedByName: pia.updatedByName,
      data: parseJson(pia.data, normalizePia),
      reviews: pia.reviews.map(r => ({ id: r.id, date: r.date, updatedByName: r.updatedByName, data: parseJson(r.data, normalizeReview) })),
    } : null,
  });
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ studentId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditSpecialCare(roleOf(session))) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const studentId = parseInt((await params).studentId);
  const year = yearOf(req);
  const exists = await prisma.student.findUnique({ where: { id: studentId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Nxënësi nuk u gjet" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data = JSON.stringify(normalizePia(body.data));
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const before = await prisma.studentPia.findUnique({ where: { studentId_academicYear: { studentId, academicYear: year } }, select: { id: true } });
  const pia = await prisma.studentPia.upsert({
    where: { studentId_academicYear: { studentId, academicYear: year } },
    create: { studentId, academicYear: year, organizationId: orgId, data, updatedByName: nameOf(session) },
    update: { data, updatedByName: nameOf(session) },
  });
  // Historiku regjistron vetëm faktin, KURRË përmbajtjen.
  if (!before) await recordStudentEvent(session, { studentId, type: "KUJDES_I_VECANTE", title: `PIA ${year}/${year + 1}: u krijua` });
  return NextResponse.json({ id: pia.id });
}
