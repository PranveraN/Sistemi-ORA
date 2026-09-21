import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findApplicationByToken } from "@/lib/enrollmentApplication";
import { isDocRequired, docTypeLabel, type DocType } from "@/lib/enrollmentDocs";
import { sendEmail } from "@/lib/email";
import { EXISTING_FIELDS, resolveFieldConfig } from "@/lib/enrollmentFieldConfig";

// Rivalidon gjithçka SERVER-SIDE (asnjëherë s'i besohet vetëm klientit) —
// fushat e domosdoshme, dokumentet e domosdoshme sipas klasës, dhe pëlqimi —
// pastaj kalon statusin DRAFT -> PENDING ("Për Shqyrtim") dhe gjeneron
// numrin e referencës, njësoj si numrat e faturave (src/app/api/invoices/route.ts).
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const applicationId = parseInt(id);
  const body = await req.json();

  const app = await findApplicationByToken(applicationId, body.resumeToken);
  if (!app) return NextResponse.json({ message: "Aplikimi nuk u gjet." }, { status: 403 });
  if (app.status !== "DRAFT") return NextResponse.json({ message: "Aplikimi tashmë është dorëzuar." }, { status: 409 });

  const missing: string[] = [];
  if (!app.firstName) missing.push("Emri i nxënësit");
  if (!app.lastName) missing.push("Mbiemri i nxënësit");
  if (!app.birthDate) missing.push("Datëlindja e nxënësit");
  if (!app.gender) missing.push("Gjinia");
  if (!app.personalNumber) missing.push("Numri Personal");
  if (!app.desiredGrade) missing.push("Klasa për të cilën aplikohet");
  if (!app.schoolYear) missing.push("Viti shkollor");
  if (!app.motherName) missing.push("Emri i nënës");
  if (!app.motherPhone) missing.push("Telefoni i nënës");
  if (!app.fatherName) missing.push("Emri i babait");
  if (!app.fatherPhone) missing.push("Telefoni i babait");
  if (!app.primaryContact) missing.push("Kontakti kryesor");
  if (app.primaryContact === "OTHER") {
    if (!app.guardianOtherName) missing.push("Emri i kujdestarit");
    if (!app.guardianOtherPhone) missing.push("Telefoni i kujdestarit");
  }
  if (!app.consentDataAccurate) missing.push("Konfirmimi i saktësisë së të dhënave");

  // Fushat "e thjeshta" të shënuara të domosdoshme nga admini (Cilësimet).
  const fieldConfigSetting = await prisma.setting.findUnique({ where: { key: "enrollmentFieldConfig" } });
  const fieldConfig = resolveFieldConfig(fieldConfigSetting?.value);
  for (const f of EXISTING_FIELDS) {
    if (fieldConfig[f.key]?.required && !(app as unknown as Record<string, unknown>)[f.key]) {
      missing.push(f.label);
    }
  }

  // Pyetjet shtesë të domosdoshme (shih EnrollmentFormField).
  const customFields = await prisma.enrollmentFormField.findMany({ where: { organizationId: app.organizationId, active: true, required: true } });
  const customAnswers: Record<string, unknown> = app.customAnswers ? JSON.parse(app.customAnswers) : {};
  for (const cf of customFields) {
    const answer = customAnswers[String(cf.id)];
    if (answer === undefined || answer === null || answer === "") missing.push(cf.label);
  }

  const documents = await prisma.applicationDocument.findMany({ where: { applicationId } });
  const uploadedTypes = new Set(documents.map(d => d.docType));
  const requiredDocTypes: DocType[] = ["BIRTH_CERT", "PARENT_ID", "TRANSFER_DOC", "VACCINATION_BOOK", "MEDICAL_REPORT", "OTHER"];
  for (const docType of requiredDocTypes) {
    if (isDocRequired(docType, app.desiredGrade) && !uploadedTypes.has(docType)) {
      missing.push(docTypeLabel(docType));
    }
  }

  if (missing.length > 0) {
    return NextResponse.json({ message: "Disa të dhëna/dokumente të domosdoshme mungojnë.", missing }, { status: 400 });
  }

  const year = new Date().getFullYear();
  const last = await prisma.enrollmentApplication.findFirst({
    where: { referenceNumber: { startsWith: `APL-${year}-` } },
    orderBy: { referenceNumber: "desc" },
  });
  const lastSeq = last?.referenceNumber ? parseInt(last.referenceNumber.split("-").pop() || "0") : 0;
  const referenceNumber = `APL-${year}-${String(lastSeq + 1).padStart(4, "0")}`;

  const updated = await prisma.enrollmentApplication.update({
    where: { id: applicationId },
    data: { status: "PENDING", submittedAt: new Date(), referenceNumber },
  });

  const targetEmail = app.primaryContact === "FATHER" ? app.fatherEmail
    : app.primaryContact === "OTHER" ? app.guardianOtherEmail
    : app.motherEmail || app.fatherEmail || app.guardianOtherEmail;

  if (targetEmail) {
    await sendEmail(
      targetEmail,
      `Aplikimi juaj u prit — ${referenceNumber}`,
      `<p>I/E nderuar,</p>
       <p>Aplikimi për regjistrimin e <strong>${app.firstName} ${app.lastName}</strong> te Akademia Ora u prit me sukses.</p>
       <p>Numri i referencës: <strong>${referenceNumber}</strong></p>
       <p>Klasa e aplikuar: ${app.desiredGrade ?? "—"} · Viti shkollor: ${app.schoolYear}</p>
       <p>Administrata do t'ju kontaktojë sapo aplikimi të shqyrtohet.</p>`
    ).catch(() => { /* dështimi i emailit s'e bllokon dorëzimin */ });
  }

  return NextResponse.json({ referenceNumber: updated.referenceNumber });
}
