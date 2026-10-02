import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordStudentEvent } from "@/lib/studentHistory";
import { canEditSpecialCare } from "@/lib/specialCarePermissions";

function roleOf(session: unknown): string {
  return ((session as { user?: { role?: string } })?.user?.role) ?? "";
}
function parseDate(v: unknown): Date | null {
  if (!v) return null;
  const d = new Date(String(v));
  return isNaN(d.getTime()) ? null : d;
}

async function load(id: number, orgId: number) {
  return prisma.studentSpecialCare.findFirst({ where: { id, organizationId: orgId } });
}

// PATCH — përditëso (llojin, shënimin, PEI, datat, asistentin)
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditSpecialCare(roleOf(session))) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const { id } = await params;
  const existing = await load(parseInt(id), orgId);
  if (!existing) return NextResponse.json({ error: "Nuk u gjet" }, { status: 404 });

  const body = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if ("hasAssistant" in body) data.hasAssistant = !!body.hasAssistant;
  if ("specialNeeds" in body) data.specialNeeds = !!body.specialNeeds;
  if ("note" in body) data.note = body.note ? String(body.note).slice(0, 500) : null;
  if ("iep" in body) data.iep = !!body.iep;
  if ("iepReviewDate" in body) data.iepReviewDate = parseDate(body.iepReviewDate);
  if ("startDate" in body) data.startDate = parseDate(body.startDate);
  if ("endDate" in body) data.endDate = parseDate(body.endDate);
  if ("assistantStaffId" in body) data.assistantStaffId = body.assistantStaffId ? parseInt(body.assistantStaffId) : null;

  const hasA = "hasAssistant" in data ? data.hasAssistant : existing.hasAssistant;
  const needs = "specialNeeds" in data ? data.specialNeeds : existing.specialNeeds;
  if (!hasA && !needs) return NextResponse.json({ error: "Zgjidh të paktën një lloj" }, { status: 400 });

  await prisma.studentSpecialCare.update({ where: { id: existing.id }, data });
  const assistantChanged = "assistantStaffId" in data && data.assistantStaffId !== existing.assistantStaffId;
  await recordStudentEvent(session, {
    studentId: existing.studentId, type: "KUJDES_I_VECANTE",
    title: assistantChanged ? "Kujdes i veçantë: u ndryshua asistenti" : "Kujdes i veçantë: u përditësua",
  });
  return NextResponse.json({ ok: true });
}

// DELETE — hiq nga lista
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditSpecialCare(roleOf(session))) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const { id } = await params;
  const existing = await load(parseInt(id), orgId);
  if (!existing) return NextResponse.json({ error: "Nuk u gjet" }, { status: 404 });
  await prisma.studentSpecialCare.delete({ where: { id: existing.id } });
  await recordStudentEvent(session, { studentId: existing.studentId, type: "KUJDES_I_VECANTE", title: "Kujdes i veçantë: u hoq" });
  return NextResponse.json({ ok: true });
}
