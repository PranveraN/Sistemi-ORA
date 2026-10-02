import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { recordStudentEvent } from "@/lib/studentHistory";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import {
  getEnrollmentRules, effectiveEvidencaState, evidencaAllowsApproval, EVIDENCA_STATE_LABELS,
  getClassSeats, findFamilyMatch, recordApplicationStatus,
} from "@/lib/enrollmentRules";
import { ENROLLMENT_SMS } from "@/lib/smsTemplates";
import { sendLoggedSms } from "@/lib/smsServer";
import { ensureStudentFamily } from "@/lib/families";

// Pranimi i një aplikimi — krijon Student-in real duke rimarrë të dhënat e
// aplikimit (asnjë fushë s'rishkruhet manualisht nga administrata). Fushat pa
// ekuivalent te Student (shtetësia, vendlindja, arsyeja e aplikimit, kontakti
// emergjent, info shtesë) shtohen si tekst i formatuar te Student.notes, që
// asgjë të mos humbasë edhe pa kolona të dedikuara për to.
//
// Rregullat (kontrolli REAL — jo vetëm fshehja e butonit):
//  • vetëm rolet me modulin "Regjistrimet";
//  • evidenca: kur kërkohet, duhet "E plotësuar";
//  • kapaciteti: klasë plot → kërkohet konfirmim eksplicit (force);
//  • gjithçka në NJË transaksion (nxënësi, evidenca, aplikimi, historiku).

const OPEN_STATUSES = ["PENDING", "EVIDENCA"];

async function loadContext(applicationId: number, orgId: number) {
  const app = await prisma.enrollmentApplication.findFirst({ where: { id: applicationId, organizationId: orgId } });
  if (!app) return null;
  const [rules, seats, family] = await Promise.all([
    getEnrollmentRules(),
    getClassSeats(orgId),
    findFamilyMatch(orgId, app),
  ]);
  const evidencaState = effectiveEvidencaState(app, rules);
  return { app, rules, seats, family, evidencaState };
}

function primaryOf(app: { primaryContact: string | null; fatherName: string | null; fatherPhone: string | null; motherName: string | null; motherPhone: string | null; guardianOtherName: string | null; guardianOtherPhone: string | null }) {
  if (app.primaryContact === "FATHER") return { name: app.fatherName, phone: app.fatherPhone };
  if (app.primaryContact === "OTHER") return { name: app.guardianOtherName, phone: app.guardianOtherPhone };
  return { name: app.motherName, phone: app.motherPhone };
}

// GET — pamja paraprake për dialogun "Prano" (klasat me vende, familja, SMS)
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "regjistrimet")) return NextResponse.json({ error: "Nuk ke leje për këtë modul." }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const { id } = await params;
  const ctx = await loadContext(parseInt(id), orgId);
  if (!ctx) return NextResponse.json({ error: "Nuk u gjet" }, { status: 404 });
  const { app, seats, family, evidencaState } = ctx;
  const primary = primaryOf(app);
  return NextResponse.json({
    status: app.status,
    evidencaState,
    evidencaLabel: EVIDENCA_STATE_LABELS[evidencaState],
    canApprove: OPEN_STATUSES.includes(app.status) && evidencaAllowsApproval(evidencaState),
    desiredGrade: app.desiredGrade,
    classes: seats.filter(s => s.active).sort((a, b) => a.name.localeCompare(b.name, "sq", { numeric: true })),
    family,
    parentPhone: primary.phone,
    parentName: primary.name,
    smsTemplate: ENROLLMENT_SMS.APPROVED,
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "regjistrimet")) return NextResponse.json({ message: "Nuk ke leje për këtë veprim." }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const { id } = await params;
  const applicationId = parseInt(id);
  const body = await req.json().catch(() => ({}));
  const classId = Number(body.classId);

  const ctx = await loadContext(applicationId, orgId);
  if (!ctx) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const { app, seats, family, evidencaState } = ctx;

  if (!OPEN_STATUSES.includes(app.status)) {
    return NextResponse.json({ message: "Vetëm aplikimet 'Për shqyrtim' ose në 'Evidencë' mund të pranohen." }, { status: 409 });
  }
  if (!evidencaAllowsApproval(evidencaState)) {
    return NextResponse.json({
      message: "Evidenca është e detyrueshme për këtë klasë dhe s'është plotësuar ende — plotëso evidencën para pranimit.",
      code: "EVIDENCA_REQUIRED",
    }, { status: 409 });
  }
  if (!classId) return NextResponse.json({ message: "Duhet të caktohet paralelja për të cilën pranohet nxënësi." }, { status: 400 });
  const targetClass = await prisma.class.findFirst({ where: { id: classId, organizationId: app.organizationId } });
  if (!targetClass) return NextResponse.json({ message: "Paralelja e zgjedhur nuk u gjet." }, { status: 400 });

  const seat = seats.find(s => s.id === targetClass.id);
  if (seat && seat.free <= 0 && body.force !== true) {
    return NextResponse.json({
      message: `Klasa ${targetClass.name} është plot (${seat.students}/${seat.capacity}). Konfirmo "Prano gjithsesi" për ta pranuar mbi kapacitet.`,
      code: "CLASS_FULL", seat,
    }, { status: 409 });
  }

  const primary = primaryOf(app);
  const extraNotes = [
    `Nga aplikimi ${app.referenceNumber ?? `#${app.id}`} (${new Date().toLocaleDateString("sq")})`,
    app.citizenship && `Shtetësia: ${app.citizenship}`,
    app.birthCountry && `Vendi i Lindjes: ${app.birthCountry}`,
    app.lastCompletedGrade && `Klasa e fundit e përfunduar: ${app.lastCompletedGrade}`,
    app.applicationReason && `Arsyeja e aplikimit: ${app.applicationReason}`,
    (app.emergencyContactName || app.emergencyContactPhone) &&
      `Kontakti Emergjent: ${app.emergencyContactName ?? "—"} (${app.emergencyContactRelation ?? "—"}) · ${app.emergencyContactPhone ?? "—"}`,
    app.additionalInfo && `Info Shtesë: ${app.additionalInfo}`,
  ].filter(Boolean).join("\n");

  let student;
  try {
    student = await prisma.$transaction(async tx => {
      // Mbrojtje nga dy klikime njëkohësisht: statusi rikontrollohet brenda transaksionit
      const fresh = await tx.enrollmentApplication.findUnique({ where: { id: app.id }, select: { status: true } });
      if (!fresh || !OPEN_STATUSES.includes(fresh.status)) throw new Error("ALREADY_DECIDED");

      const s = await tx.student.create({
        data: {
          firstName: app.firstName,
          lastName: app.lastName,
          birthDate: app.birthDate,
          gender: app.gender,
          personalNumber: app.personalNumber,
          classId: targetClass.id,
          // "address" e përgjithshme s'kërkohet më te formulari (u hoq si e
          // përsëritur) — bie mbrapa te adresa e prindit kryesor, nëse ka.
          address: app.address || app.motherAddress || app.fatherAddress || null,
          originCountry: app.originType === "DIASPORA" ? app.originCountry : null,
          previousSchool: app.previousSchool,
          guardian: app.primaryContact === "OTHER" ? app.guardianOtherName : null,
          parentName: primary.name,
          parentPhone: primary.phone,
          motherName: app.motherName,
          motherBirth: app.motherBirth,
          motherProf: app.motherProf,
          motherPhone: app.motherPhone,
          motherEmail: app.motherEmail,
          fatherName: app.fatherName,
          fatherBirth: app.fatherBirth,
          fatherProf: app.fatherProf,
          fatherPhone: app.fatherPhone,
          fatherEmail: app.fatherEmail,
          // Familja ekzistuese (sipas telefonit + emrit) — familjet grupohen
          // automatikisht sipas telefonit; familyId merret nga vëllai/motra.
          familyId: family.familyId,
          status: "ACTIVE",
          enrollDate: app.desiredStartDate ?? new Date(),
          notes: extraNotes || null,
          organizationId: app.organizationId,
        },
      });

      await tx.enrollmentApplication.update({
        where: { id: app.id },
        // Gjendja e evidencës ngrihet në pranim (rregulli i ardhshëm s'e prek më)
        data: { status: "APPROVED", reviewedAt: new Date(), createdStudentId: s.id, classId: targetClass.id, evidencaState },
      });

      // Evidenca e plotësuar gjatë aplikimit — migrohet te StudentEvidenca e
      // nxënësit të sapokrijuar (shih ApplicationEvidencaModal.tsx).
      const appEvidenca = await tx.applicationEvidenca.findMany({ where: { applicationId: app.id } });
      for (const e of appEvidenca) {
        await tx.studentEvidenca.create({
          data: { studentId: s.id, answers: e.answers, authorId: e.authorId, organizationId: e.organizationId, createdAt: e.createdAt },
        });
      }
      if (appEvidenca.length) await tx.applicationEvidenca.deleteMany({ where: { applicationId: app.id } });

      await recordApplicationStatus(tx, session, app.id, app.status, "APPROVED",
        `Klasa ${targetClass.name}${seat && seat.free <= 0 ? " (mbi kapacitet)" : ""}`);
      return s;
    });
  } catch (e) {
    if (e instanceof Error && e.message === "ALREADY_DECIDED") {
      return NextResponse.json({ message: "Ky aplikim u vendos ndërkohë nga dikush tjetër." }, { status: 409 });
    }
    console.error("[enrollment/approve]", e);
    return NextResponse.json({ message: "Pranimi dështoi — asgjë s'u ndryshua." }, { status: 500 });
  }

  await ensureStudentFamily(student.id);
  await logAction(session, "CREATE", "Student", student.id, `Krijoi nxënësin ${student.firstName} ${student.lastName} nga aplikimi ${app.referenceNumber ?? `#${app.id}`}`);
  await recordStudentEvent(session, {
    studentId: student.id, type: "REGJISTRIM",
    title: app.source === "OFFICE" ? "Regjistruar nga aplikimi (zyra)" : "Regjistruar nga aplikimi online",
    description: `Aplikimi ${app.referenceNumber ?? `#${app.id}`} · Klasa ${targetClass.name}`,
  });

  // SMS konfirmimi (opsional) — përmes modulit të mesazheve
  let sms: { ok: boolean; error?: string } | null = null;
  if (body.sendSms && primary.phone) {
    const text = String(body.smsText || ENROLLMENT_SMS.APPROVED)
      .replaceAll("{emri}", `${student.firstName} ${student.lastName}`)
      .replaceAll("{klasa}", targetClass.name);
    sms = await sendLoggedSms(session, {
      phone: primary.phone, message: text, recipientName: `${primary.name ?? ""} (prindi)`.trim(),
      studentId: student.id, messageType: "GENERAL", orgId,
    });
  }

  return NextResponse.json({ studentId: student.id, className: targetClass.name, familyLinked: family.siblings.length > 0, sms });
}
