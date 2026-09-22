import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { logAction } from "@/lib/audit";

interface RecipientInput { email: string; name?: string; studentId?: number | string }

// Email i lirë (subjekt+tekst) te prindërit e një familjeje — nga karta e
// Familjes (buton "Email"). Mirror i /api/sms/send, pa personalizim
// {emri}/{klasa} (s'kërkohet për këtë rast fillestar).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "SECRETARY") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }

  const userId = Number((session.user as { id?: string }).id);
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const body = await req.json();
  const subject = String(body.subject ?? "").trim();
  const message = String(body.message ?? "").trim();
  const rawRecipients: RecipientInput[] = Array.isArray(body.recipients) ? body.recipients : [];

  if (!subject) return NextResponse.json({ error: "Subjekti mungon" }, { status: 400 });
  if (!message) return NextResponse.json({ error: "Mesazhi mungon" }, { status: 400 });
  if (!rawRecipients.length) return NextResponse.json({ error: "Zgjidh të paktën një marrës" }, { status: 400 });

  const seen = new Set<string>();
  const recipients = rawRecipients.filter(r => {
    const email = String(r.email ?? "").trim().toLowerCase();
    if (!email || seen.has(email)) return false;
    seen.add(email);
    return true;
  });

  if (!recipients.length) return NextResponse.json({ error: "Asnjë email i vlefshëm" }, { status: 400 });

  const batchId = recipients.length > 1 ? randomUUID() : null;
  const html = `<div style="font-family: system-ui, sans-serif; max-width: 480px;">
    <p>${message.replace(/\n/g, "<br/>")}</p>
    <p style="color: #94a3b8; font-size: 12px; margin-top: 16px;">Akademia Ora</p>
  </div>`;

  let sent = 0, failed = 0;
  const errors: string[] = [];

  for (const r of recipients) {
    const email = String(r.email).trim();
    const result = await sendEmail(email, subject, html);

    await prisma.familyEmailLog.create({
      data: {
        organizationId: orgId,
        batchId,
        recipientEmail: email,
        recipientName: r.name ? String(r.name).trim() : null,
        studentId: r.studentId ? parseInt(String(r.studentId)) : null,
        subject,
        message,
        status: result.ok ? "SENT" : "FAILED",
        errorMessage: result.ok ? null : result.error,
        sentById: userId,
      },
    });

    if (result.ok) sent++;
    else { failed++; if (result.error && !errors.includes(result.error)) errors.push(result.error); }
  }

  await logAction(session, "CREATE", "FamilyEmailLog", null,
    `Dërgoi email te ${recipients.length} marrës (${sent} me sukses, ${failed} dështuan)`);

  return NextResponse.json({ sent, failed, total: recipients.length, errors });
}
