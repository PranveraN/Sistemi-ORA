import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

// Pranimi i një aplikimi — krijon Student-in real duke rimarrë të dhënat e
// aplikimit (asnjë fushë s'rishkruhet manualisht nga administrata). Fushat pa
// ekuivalent te Student (shtetësia, vendlindja, arsyeja e aplikimit, kontakti
// emergjent, info shtesë) shtohen si tekst i formatuar te Student.notes, që
// asgjë të mos humbasë edhe pa kolona të dedikuara për to.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const applicationId = parseInt(id);
  const body = await req.json().catch(() => ({}));
  const classId = Number(body.classId);

  const app = await prisma.enrollmentApplication.findUnique({ where: { id: applicationId } });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (app.status !== "PENDING") return NextResponse.json({ message: "Vetëm aplikimet 'Për Shqyrtim' mund të pranohen." }, { status: 409 });

  if (!classId) return NextResponse.json({ message: "Duhet të caktohet paralelja për të cilën pranohet nxënësi." }, { status: 400 });
  const targetClass = await prisma.class.findFirst({ where: { id: classId, organizationId: app.organizationId } });
  if (!targetClass) return NextResponse.json({ message: "Paralelja e zgjedhur nuk u gjet." }, { status: 400 });

  const primaryName = app.primaryContact === "FATHER" ? app.fatherName
    : app.primaryContact === "OTHER" ? app.guardianOtherName
    : app.motherName;
  const primaryPhone = app.primaryContact === "FATHER" ? app.fatherPhone
    : app.primaryContact === "OTHER" ? app.guardianOtherPhone
    : app.motherPhone;

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

  const student = await prisma.student.create({
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
      parentName: primaryName,
      parentPhone: primaryPhone,
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
      status: "ACTIVE",
      enrollDate: app.desiredStartDate ?? new Date(),
      notes: extraNotes || null,
      organizationId: app.organizationId,
    },
  });

  await prisma.enrollmentApplication.update({
    where: { id: app.id },
    data: { status: "APPROVED", reviewedAt: new Date(), createdStudentId: student.id, classId: targetClass.id },
  });

  await logAction(session, "CREATE", "Student", student.id, `Krijoi nxënësin ${student.firstName} ${student.lastName} nga aplikimi ${app.referenceNumber ?? `#${app.id}`}`);

  return NextResponse.json({ studentId: student.id });
}
