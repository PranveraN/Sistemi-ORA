import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { formatDate } from "@/lib/utils";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "FINANCE") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }

  const { id } = await params;
  const requestId = parseInt(id);

  const body = await req.json();
  const email = String(body.email ?? "").trim();
  if (!email) {
    return NextResponse.json({ error: "Email-i i marrësit mungon" }, { status: 400 });
  }

  const materialRequest = await prisma.materialRequest.findUnique({
    where: { id: requestId },
    include: { teacher: { select: { name: true } } },
  });
  if (!materialRequest) {
    return NextResponse.json({ error: "Kërkesa nuk u gjet" }, { status: 404 });
  }
  if (materialRequest.status !== "APPROVED") {
    return NextResponse.json({ error: "Vetëm kërkesat e aprovuara mund të dërgohen" }, { status: 400 });
  }

  const subject = `Porosi: ${materialRequest.item} × ${materialRequest.quantity}`;
  const html = `
    <div style="font-family: system-ui, sans-serif; max-width: 480px;">
      <h2 style="margin-bottom: 4px;">Kërkesë e Aprovuar për Material</h2>
      <p style="color: #64748b; margin-top: 0;">Akademia Ora</p>
      <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
        <tr><td style="padding: 6px 0; color: #64748b;">Artikulli</td><td style="padding: 6px 0; font-weight: 600;">${materialRequest.item}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Sasia</td><td style="padding: 6px 0; font-weight: 600;">${materialRequest.quantity}</td></tr>
        ${materialRequest.subjectOrClass ? `<tr><td style="padding: 6px 0; color: #64748b;">Lënda/Klasa</td><td style="padding: 6px 0;">${materialRequest.subjectOrClass}</td></tr>` : ""}
        <tr><td style="padding: 6px 0; color: #64748b;">Arsyeja</td><td style="padding: 6px 0;">${materialRequest.reason}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Kërkuar nga</td><td style="padding: 6px 0;">${materialRequest.teacher.name}</td></tr>
        <tr><td style="padding: 6px 0; color: #64748b;">Data</td><td style="padding: 6px 0;">${formatDate(materialRequest.createdAt)}</td></tr>
      </table>
    </div>
  `;

  const result = await sendEmail(email, subject, html);
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Dërgimi dështoi" }, { status: 502 });
  }

  const updated = await prisma.materialRequest.update({
    where: { id: requestId },
    data: { sentAt: new Date(), sentToEmail: email },
  });

  return NextResponse.json(updated);
}
