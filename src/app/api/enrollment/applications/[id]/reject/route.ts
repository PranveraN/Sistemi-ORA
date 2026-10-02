import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { REJECT_REASONS, recordApplicationStatus } from "@/lib/enrollmentRules";
import { ENROLLMENT_SMS } from "@/lib/smsTemplates";
import { sendLoggedSms } from "@/lib/smsServer";

// Refuzimi — kërkon arsye (kod nga lista + tekst i lirë), ruan historikun dhe
// opsionalisht njofton prindin me SMS.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "regjistrimet")) return NextResponse.json({ message: "Nuk ke leje për këtë veprim." }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const { id } = await params;
  const body = await req.json().catch(() => ({}));

  const app = await prisma.enrollmentApplication.findFirst({ where: { id: parseInt(id), organizationId: orgId } });
  if (!app) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (app.status !== "PENDING" && app.status !== "EVIDENCA") {
    return NextResponse.json({ message: "Vetëm aplikimet 'Për shqyrtim' ose në 'Evidencë' mund të refuzohen." }, { status: 409 });
  }

  const reasonCode = REJECT_REASONS.some(r => r.key === body.rejectReason) ? String(body.rejectReason) : null;
  const note = body.reviewNote ? String(body.reviewNote).trim().slice(0, 1000) : null;
  // Kërkesat e vjetra (pa kod) vazhdojnë të pranohen me vetëm tekst
  if (!reasonCode && !note) return NextResponse.json({ message: "Zgjidh ose shkruaj arsyen e refuzimit." }, { status: 400 });
  if (reasonCode === "OTHER" && !note) return NextResponse.json({ message: "Për \"Tjetër\" shkruaj arsyen." }, { status: 400 });

  const reasonLabel = REJECT_REASONS.find(r => r.key === reasonCode)?.label ?? null;
  const updated = await prisma.$transaction(async tx => {
    const u = await tx.enrollmentApplication.update({
      where: { id: app.id },
      data: { status: "REJECTED", rejectReason: reasonCode, reviewNote: note ?? reasonLabel, reviewedAt: new Date() },
    });
    await recordApplicationStatus(tx, session, app.id, app.status, "REJECTED", [reasonLabel, note].filter(Boolean).join(" — "));
    return u;
  });

  await logAction(session, "UPDATE", "EnrollmentApplication", app.id, `Refuzoi aplikimin e ${app.firstName} ${app.lastName}${reasonLabel ? ` (${reasonLabel})` : ""}`);

  let sms: { ok: boolean; error?: string } | null = null;
  const phone = app.primaryContact === "FATHER" ? app.fatherPhone : app.primaryContact === "OTHER" ? app.guardianOtherPhone : app.motherPhone;
  if (body.sendSms && phone) {
    const text = String(body.smsText || ENROLLMENT_SMS.REJECTED).replaceAll("{emri}", `${app.firstName} ${app.lastName}`).replaceAll("{klasa}", "");
    sms = await sendLoggedSms(session, { phone, message: text, recipientName: "prindi", messageType: "GENERAL", orgId });
  }

  return NextResponse.json({ ...updated, sms });
}
