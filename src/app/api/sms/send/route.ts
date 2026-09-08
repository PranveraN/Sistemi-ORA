import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendSms } from "@/lib/sms";
import { logAction } from "@/lib/audit";

interface RecipientInput { phone: string; name?: string; studentId?: number | string }

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
  const message = String(body.message ?? "").trim();
  const rawRecipients: RecipientInput[] = Array.isArray(body.recipients) ? body.recipients : [];

  if (!message) return NextResponse.json({ error: "Mesazhi mungon" }, { status: 400 });
  if (!rawRecipients.length) return NextResponse.json({ error: "Zgjidh të paktën një marrës" }, { status: 400 });

  // Deduplikim sipas telefonit — dërgimi "në grup" (klasë/familje) mund të
  // përfshijë të njëjtin numër dy herë (p.sh. dy fëmijë të një prindi).
  const seen = new Set<string>();
  const recipients = rawRecipients.filter(r => {
    const phone = String(r.phone ?? "").trim();
    if (!phone || seen.has(phone)) return false;
    seen.add(phone);
    return true;
  });

  if (!recipients.length) {
    return NextResponse.json({ error: "Asnjë numër telefoni i vlefshëm" }, { status: 400 });
  }

  const batchId = recipients.length > 1 ? randomUUID() : null;

  let sent = 0;
  let failed = 0;
  const errors: string[] = [];

  for (const r of recipients) {
    const phone = String(r.phone).trim();
    const result = await sendSms(phone, message);

    await prisma.smsMessage.create({
      data: {
        organizationId: orgId,
        batchId,
        recipientPhone: phone,
        recipientName: r.name ? String(r.name).trim() : null,
        studentId: r.studentId ? parseInt(String(r.studentId)) : null,
        message,
        status: result.ok ? "SENT" : "FAILED",
        errorMessage: result.ok ? null : result.error,
        sentById: userId,
      },
    });

    if (result.ok) sent++;
    else { failed++; if (result.error && !errors.includes(result.error)) errors.push(result.error); }
  }

  await logAction(session, "CREATE", "SmsMessage", null,
    `Dërgoi SMS te ${recipients.length} marrës (${sent} me sukses, ${failed} dështuan)`);

  return NextResponse.json({ sent, failed, total: recipients.length, errors });
}
