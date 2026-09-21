import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readDocument } from "@/lib/document-storage";
import { sendEmail } from "@/lib/email";
import { logAction } from "@/lib/audit";

interface RecipientInput { email: string; name?: string; studentId?: number | string }

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "SECRETARY") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }

  const userId = Number((session.user as { id?: string }).id);
  const { id } = await params;
  const doc = await prisma.schoolDocument.findUnique({ where: { id: parseInt(id) } });
  if (!doc) return NextResponse.json({ error: "Dokumenti nuk u gjet" }, { status: 404 });

  const buffer = await readDocument(doc.fileName);
  if (!buffer) return NextResponse.json({ error: "Skedari nuk u gjet në disk" }, { status: 404 });

  const body = await req.json();
  const message = String(body.message ?? "").trim();
  const rawRecipients: RecipientInput[] = Array.isArray(body.recipients) ? body.recipients : [];

  // Dedupe sipas email-it — dërgimi "në grup" (klasë/familje) mund të
  // përfshijë të njëjtin email dy herë (p.sh. dy fëmijë të një prindi).
  const seen = new Set<string>();
  const recipients = rawRecipients.filter(r => {
    const email = String(r.email ?? "").trim().toLowerCase();
    if (!email || seen.has(email)) return false;
    seen.add(email);
    return true;
  });

  if (!recipients.length) return NextResponse.json({ error: "Zgjidh të paktën një marrës" }, { status: 400 });

  const batchId = recipients.length > 1 ? randomUUID() : null;
  const html = `
    <div style="font-family:Arial,sans-serif;color:#0f172a;">
      ${message ? `<p>${message.replace(/\n/g, "<br/>")}</p>` : ""}
      <p style="color:#64748b;font-size:13px;margin-top:16px;">${doc.title}${doc.description ? ` — ${doc.description}` : ""}</p>
      <p style="color:#94a3b8;font-size:12px;">Akademia Ora</p>
    </div>`;

  let sent = 0, failed = 0;
  const errors: string[] = [];

  for (const r of recipients) {
    const email = String(r.email).trim();
    const result = await sendEmail(email, doc.title, html, [{ filename: doc.originalFileName, content: buffer }]);

    await prisma.documentEmailLog.create({
      data: {
        documentId: doc.id,
        batchId,
        recipientEmail: email,
        recipientName: r.name ? String(r.name).trim() : null,
        studentId: r.studentId ? parseInt(String(r.studentId)) : null,
        status: result.ok ? "SENT" : "FAILED",
        errorMessage: result.ok ? null : result.error,
        sentById: userId,
      },
    });

    if (result.ok) sent++;
    else { failed++; if (result.error && !errors.includes(result.error)) errors.push(result.error); }
  }

  await logAction(session, "CREATE", "SchoolDocument", doc.id,
    `Dërgoi dokumentin "${doc.title}" te ${recipients.length} marrës (${sent} me sukses, ${failed} dështuan)`);

  return NextResponse.json({ sent, failed, total: recipients.length, errors });
}
