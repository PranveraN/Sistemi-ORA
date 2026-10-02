import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ACADEMIC_YEAR } from "@/lib/academicYear";
import { recordStudentEvent } from "@/lib/studentHistory";
import { activeInAcademicYear, canEditSpecialCare, canViewSpecialCare } from "@/lib/specialCarePermissions";

// Kujdes i veçantë — TË DHËNA TË NDJESHME. Leja kontrollohet KËTU (backend):
// rolet pa leje marrin 403 dhe asnjë të dhënë (as numrat).

function roleOf(session: unknown): string {
  return ((session as { user?: { role?: string } })?.user?.role) ?? "";
}

function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

// GET ?year=2026&classId=&filter=all|assistant|needs
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewSpecialCare(roleOf(session))) return NextResponse.json({ error: "Nuk ke leje për këto të dhëna" }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const sp = req.nextUrl.searchParams;
  const year = parseInt(sp.get("year") || "") || DEFAULT_ACADEMIC_YEAR;
  const classId = parseInt(sp.get("classId") || "0");
  const filter = sp.get("filter") || "all";

  const rows = await prisma.studentSpecialCare.findMany({
    where: {
      organizationId: orgId,
      student: { status: "ACTIVE", ...(classId ? { classId } : {}) },
    },
    include: {
      student: { select: { id: true, firstName: true, lastName: true, class: { select: { id: true, name: true } } } },
      assistant: { select: { id: true, emri: true, telefoni: true, email: true } },
    },
    orderBy: { updatedAt: "desc" },
  });
  const inYear = rows.filter(r => activeInAcademicYear(r, year));

  const now = Date.now();
  const items = inYear
    .filter(r => filter === "assistant" ? r.hasAssistant : filter === "needs" ? r.specialNeeds : true)
    .map(r => {
      const review = r.iepReviewDate ? r.iepReviewDate.getTime() : null;
      const iepWarning = r.iep && review != null
        ? (review < now ? "overdue" : review - now <= 7 * 86400000 ? "soon" : null)
        : null;
      return {
        id: r.id,
        studentId: r.student.id,
        studentName: `${r.student.firstName} ${r.student.lastName}`,
        classId: r.student.class?.id ?? null,
        className: r.student.class?.name ?? null,
        hasAssistant: r.hasAssistant,
        specialNeeds: r.specialNeeds,
        note: r.note,
        iep: r.iep,
        iepReviewDate: r.iepReviewDate?.toISOString() ?? null,
        iepWarning,
        startDate: r.startDate?.toISOString() ?? null,
        endDate: r.endDate?.toISOString() ?? null,
        assistant: r.assistant ? { id: r.assistant.id, name: r.assistant.emri, phone: r.assistant.telefoni, email: r.assistant.email } : null,
      };
    });

  // Asistentët — me klasat ku punojnë dhe numrin e nxënësve
  const byAssistant = new Map<number, { id: number; name: string; phone: string | null; classes: Set<string>; students: number }>();
  for (const r of inYear) {
    if (!r.assistant) continue;
    const a = byAssistant.get(r.assistant.id) ?? { id: r.assistant.id, name: r.assistant.emri, phone: r.assistant.telefoni, classes: new Set<string>(), students: 0 };
    a.students++;
    if (r.student.class?.name) a.classes.add(r.student.class.name);
    byAssistant.set(r.assistant.id, a);
  }

  return NextResponse.json({
    canEdit: canEditSpecialCare(roleOf(session)),
    counts: {
      assistant: inYear.filter(r => r.hasAssistant).length,
      needs: inYear.filter(r => r.specialNeeds).length,
    },
    items,
    assistants: Array.from(byAssistant.values())
      .map(a => ({ ...a, classes: Array.from(a.classes).sort((x, y) => x.localeCompare(y, "sq", { numeric: true })) }))
      .sort((x, y) => x.name.localeCompare(y.name, "sq")),
  });
}

// POST — shto nxënës te kujdesi i veçantë
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditSpecialCare(roleOf(session))) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const body = await req.json().catch(() => ({}));
  const studentId = parseInt(body.studentId);
  const student = studentId ? await prisma.student.findFirst({ where: { id: studentId, organizationId: orgId }, select: { id: true } }) : null;
  if (!student) return NextResponse.json({ error: "Zgjidh nxënësin" }, { status: 400 });
  if (!body.hasAssistant && !body.specialNeeds) {
    return NextResponse.json({ error: "Zgjidh të paktën një lloj: Me asistent ose Nevoja të veçanta" }, { status: 400 });
  }

  const rec = await prisma.studentSpecialCare.create({
    data: {
      studentId,
      organizationId: orgId,
      hasAssistant: !!body.hasAssistant,
      specialNeeds: !!body.specialNeeds,
      note: body.note ? String(body.note).slice(0, 500) : null,
      iep: !!body.iep,
      iepReviewDate: body.iep ? parseDate(body.iepReviewDate) : null,
      startDate: parseDate(body.startDate) ?? new Date(),
      endDate: parseDate(body.endDate),
      assistantStaffId: body.assistantStaffId ? parseInt(body.assistantStaffId) : null,
    },
  });
  // Historiku — PA përmbajtjen e shënimit/llojit të nevojës
  await recordStudentEvent(session, { studentId, type: "KUJDES_I_VECANTE", title: "Kujdes i veçantë: u shtua" });
  return NextResponse.json({ id: rec.id }, { status: 201 });
}
