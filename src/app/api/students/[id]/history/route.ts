import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { recordStudentEvent } from "@/lib/studentHistory";

// Grupet e filtrave te paneli i historikut
const HISTORY_GROUPS: Record<string, string[]> = {
  pagesat:     ["PAGESE"],
  kontrata:    ["KONTRATE"],
  sms:         ["SMS"],
  ndryshime:   ["NDRYSHIM_KLASE", "ZBRITJE", "NDRYSHIM_TE_DHENASH", "KUJDES_I_VECANTE"],
  regjistrimi: ["REGJISTRIM", "CREGJISTRIM"],
};

// GET — vija kohore e një nxënësi (më e reja e para), me faqosje me "kursor".
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const { id } = await params;
  const studentId = parseInt(id);
  const sp = req.nextUrl.searchParams;
  const group = sp.get("group") || "";
  const limit = Math.min(50, Math.max(1, parseInt(sp.get("limit") || "20")));
  const cursor = parseInt(sp.get("cursor") || "0");

  const student = await prisma.student.findFirst({
    where: { id: studentId, organizationId: orgId },
    select: {
      id: true, firstName: true, lastName: true, status: true,
      parentName: true, fatherName: true, motherName: true,
      parentPhone: true, fatherPhone: true, motherPhone: true,
      class: { select: { name: true } },
    },
  });
  if (!student) return NextResponse.json({ error: "Nxënësi nuk u gjet" }, { status: 404 });

  const types = HISTORY_GROUPS[group];
  const rows = await prisma.studentHistory.findMany({
    where: { studentId, ...(types ? { type: { in: types } } : {}) },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: limit + 1,
    ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    include: { user: { select: { name: true } } },
  });
  const hasMore = rows.length > limit;
  const events = rows.slice(0, limit).map(r => ({
    id: r.id,
    type: r.type,
    title: r.title,
    description: r.description,
    data: r.data ? safeJson(r.data) : null,
    occurredAt: r.occurredAt.toISOString(),
    userName: r.user?.name ?? null,
    source: r.source,
  }));

  return NextResponse.json({
    student: {
      id: student.id,
      name: `${student.firstName} ${student.lastName}`,
      className: student.class?.name ?? null,
      status: student.status,
      parentName: student.fatherName || student.motherName || student.parentName || null,
      parentPhone: student.fatherPhone || student.motherPhone || student.parentPhone || null,
    },
    events,
    nextCursor: hasMore ? events[events.length - 1].id : null,
  });
}

// POST — vetëm ngjarje që lindin në shfletues (gjenerimi i kontratës, i cili
// s'kalon nga asnjë API). Llojet e tjera regjistrohen vetëm nga serveri.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const { id } = await params;
  const studentId = parseInt(id);
  const body = await req.json().catch(() => ({}));
  if (body.type !== "KONTRATE") {
    return NextResponse.json({ error: "Lloj ngjarjeje i palejuar" }, { status: 400 });
  }
  const exists = await prisma.student.findFirst({ where: { id: studentId, organizationId: orgId }, select: { id: true } });
  if (!exists) return NextResponse.json({ error: "Nxënësi nuk u gjet" }, { status: 404 });
  await recordStudentEvent(session, {
    studentId, type: "KONTRATE",
    title: String(body.title || "Kontratë e gjeneruar").slice(0, 120),
  });
  return NextResponse.json({ ok: true });
}

function safeJson(s: string): unknown {
  try { return JSON.parse(s); } catch { return null; }
}
