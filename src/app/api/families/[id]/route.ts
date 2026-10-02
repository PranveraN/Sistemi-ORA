import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { currentAcademicYear } from "@/lib/classYears";
import { computeStudentAllFinance, sumFinance } from "@/lib/studentCategoryFinance";
import { familyLabel, phoneKey, normName } from "@/lib/families";
import { recordStudentChanges } from "@/lib/studentHistory";
import { logAction } from "@/lib/audit";

// Profili i plotë i një familjeje — VETËM LEXIM për financat (përmbledh të
// dhënat ekzistuese; s'ndryshon pagesat). PATCH: emri i familjes dhe kontakti
// kryesor (ai që merr SMS-të — përditëson "Prindi/Telefoni" te fëmijët).

async function guard() {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!sessionHasModule(session, "families")) return { error: NextResponse.json({ error: "Nuk ke leje për këtë modul." }, { status: 403 }) };
  return { session, orgId: ((session.user as { organizationId?: number }).organizationId ?? 1) as number };
}

const STUDENT_SELECT = {
  id: true, firstName: true, lastName: true, status: true, kontrata: true, discountPct: true,
  parentName: true, parentPhone: true, fatherName: true, fatherPhone: true, fatherEmail: true,
  motherName: true, motherPhone: true, motherEmail: true, guardian: true, address: true,
  class: { select: { id: true, name: true } },
} as const;

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { session, orgId } = g;
  const showFinance = sessionHasModule(session, "students");
  const { id } = await params;
  const familyId = parseInt(id) || 0;
  const year = parseInt(req.nextUrl.searchParams.get("year") || "") || await currentAcademicYear(orgId);

  const family = await prisma.family.findFirst({
    where: { id: familyId, organizationId: orgId },
    include: {
      students: { select: STUDENT_SELECT, orderBy: [{ status: "asc" }, { firstName: "asc" }] },
      notes: { orderBy: { createdAt: "desc" } },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });
  if (!family) return NextResponse.json({ error: "Familja nuk u gjet" }, { status: 404 });

  const active = family.students.filter(s => s.status === "ACTIVE");
  const ids = family.students.map(s => s.id);
  const [finance, activity, contracts] = await Promise.all([
    showFinance ? computeStudentAllFinance(orgId, active.map(s => s.id), year) : Promise.resolve(new Map()),
    prisma.studentHistory.findMany({
      where: { studentId: { in: ids } },
      orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
      take: 10,
      include: { student: { select: { firstName: true } }, user: { select: { name: true } } },
    }),
    prisma.studentHistory.findMany({
      where: { studentId: { in: ids }, type: "KONTRATE" },
      orderBy: { occurredAt: "desc" },
      select: { id: true, studentId: true, title: true, occurredAt: true },
    }),
  ]);

  // Prindërit — nga fushat e fëmijëve, pa dyfishime (sipas emrit/telefonit)
  type Parent = { role: "FATHER" | "MOTHER" | "GUARDIAN"; name: string; phones: string[]; emails: string[] };
  const parents: Parent[] = [];
  const addParent = (role: Parent["role"], name: string | null, phone: string | null, email?: string | null) => {
    if (!name && !phone) return;
    const existing = parents.find(p => p.role === role && (normName(p.name) === normName(name) || (phone && p.phones.some(x => phoneKey(x) === phoneKey(phone)))));
    const target = existing ?? (parents.push({ role, name: name ?? "—", phones: [], emails: [] }), parents[parents.length - 1]);
    if (phone && !target.phones.some(x => phoneKey(x) === phoneKey(phone))) target.phones.push(phone);
    if (email && !target.emails.includes(email)) target.emails.push(email);
    if (target.name === "—" && name) target.name = name;
  };
  for (const s of family.students) {
    addParent("FATHER", s.fatherName, s.fatherPhone, s.fatherEmail);
    addParent("MOTHER", s.motherName, s.motherPhone, s.motherEmail);
    const pk = phoneKey(s.parentPhone);
    if (s.parentPhone && pk !== phoneKey(s.fatherPhone) && pk !== phoneKey(s.motherPhone)) addParent("GUARDIAN", s.guardian || s.parentName, s.parentPhone);
  }

  const totals = showFinance ? sumFinance(active.map(s => finance.get(s.id)!).filter(Boolean)) : null;
  const primaryPhone = active[0]?.parentPhone ?? family.students[0]?.parentPhone ?? null;

  return NextResponse.json({
    id: family.id,
    label: familyLabel(family.displayName, family.students.map(s => s.lastName)),
    displayName: family.displayName,
    primaryContact: family.primaryContact,
    primaryPhone,
    year,
    showFinance,
    totals,
    children: family.students.map(s => {
      const f = finance.get(s.id);
      const t = f?.tuition;
      return {
        id: s.id, firstName: s.firstName, lastName: s.lastName, status: s.status,
        classId: s.class?.id ?? null, className: s.class?.name ?? null,
        kontrata: s.kontrata, discountPct: s.discountPct ?? 0,
        tuition: t ? { paid: t.paid, finalPrice: t.finalPrice, originalPrice: t.originalPrice, balance: t.balance, payStatus: t.payStatus, timiInvest: !!t.timiInvest } : null,
        categories: f?.categories ?? {},
      };
    }),
    parents,
    activity: activity.map(a => ({
      id: a.id, studentId: a.studentId, studentName: a.student.firstName, type: a.type, title: a.title,
      occurredAt: a.occurredAt.toISOString(), userName: a.user?.name ?? null,
    })),
    documents: family.documents.map(d => ({
      id: d.id, title: d.title, originalName: d.originalName, contentType: d.contentType, size: d.size,
      studentId: d.studentId, createdAt: d.createdAt.toISOString(),
    })),
    contracts: contracts.map(c => ({
      id: c.id, studentId: c.studentId, title: c.title, occurredAt: c.occurredAt.toISOString(),
      studentName: family.students.find(s => s.id === c.studentId)?.firstName ?? "",
    })),
    notes: family.notes.map(n => ({ id: n.id, text: n.text, authorName: n.authorName, createdAt: n.createdAt.toISOString() })),
  });
}

// PATCH { displayName?, primaryContact? }
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const g = await guard();
  if ("error" in g) return g.error;
  const { session, orgId } = g;
  const { id } = await params;
  const family = await prisma.family.findFirst({ where: { id: parseInt(id) || 0, organizationId: orgId }, include: { students: true } });
  if (!family) return NextResponse.json({ error: "Familja nuk u gjet" }, { status: 404 });
  const body = await req.json().catch(() => ({}));

  const data: Record<string, unknown> = {};
  if ("displayName" in body) data.displayName = body.displayName ? String(body.displayName).trim().slice(0, 80) : null;

  if ("primaryContact" in body) {
    const pc = String(body.primaryContact);
    if (!["FATHER", "MOTHER", "GUARDIAN"].includes(pc)) return NextResponse.json({ error: "Kontakt i pavlefshëm" }, { status: 400 });
    data.primaryContact = pc;
    // Përditëso "Prindi/Telefoni" (fusha që përdor moduli i SMS-ve) te çdo fëmijë që e ka këtë prind
    let updated = 0;
    for (const s of family.students) {
      const name = pc === "FATHER" ? s.fatherName : pc === "MOTHER" ? s.motherName : null;
      const phone = pc === "FATHER" ? s.fatherPhone : pc === "MOTHER" ? s.motherPhone : null;
      if (pc === "GUARDIAN" || !phone) continue;
      if (s.parentPhone === phone && s.parentName === name) continue;
      const after = await prisma.student.update({ where: { id: s.id }, data: { parentPhone: phone, parentName: name } });
      await recordStudentChanges(session, s, after);
      updated++;
    }
    await logAction(session, "UPDATE", "Family", family.id, `Ndryshoi kontaktin kryesor të familjes në ${pc === "FATHER" ? "babai" : pc === "MOTHER" ? "nëna" : "kujdestari"} (${updated} fëmijë u përditësuan)`);
  }

  const f = await prisma.family.update({ where: { id: family.id }, data });
  return NextResponse.json({ ok: true, family: f });
}
