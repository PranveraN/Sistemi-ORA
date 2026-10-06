import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sendSms } from "@/lib/sms";
import { sendEmail } from "@/lib/email";
import { ORDER_ADMIN_ROLES } from "@/lib/supplierOrder";

// "Provo përsëri SMS-in / email-in" — ridërgon të njëjtin tekst të ruajtur te
// regjistri, për një kanal që dështoi. Vetëm administrata.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const user = session.user as { role?: string; organizationId?: number };
  if (!ORDER_ADMIN_ROLES.has(user.role ?? "")) {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }
  const { id } = await params;
  const d = await prisma.materialOrderDispatch.findFirst({ where: { id: parseInt(id) || 0, organizationId: user.organizationId ?? 1 } });
  if (!d) return NextResponse.json({ error: "Dërgimi nuk u gjet." }, { status: 404 });
  // Pa porosi = asnjë kanal s'pati sukses; dërgohet sërish nga paneli (që porosia të krijohet)
  if (!d.orderId) return NextResponse.json({ error: "Kjo porosi s'u dërgua fare — dërgojeni përsëri nga paneli \"Për t'u porositur\"." }, { status: 400 });

  const body = await req.json().catch(() => ({}));
  const channel = body.channel === "email" ? "email" : "sms";
  let res: { ok: boolean; error?: string };
  if (channel === "sms") {
    if (!d.smsText || !d.toPhone) return NextResponse.json({ error: "Ky dërgim s'ka SMS." }, { status: 400 });
    res = await sendSms(d.toPhone, d.smsText);
  } else {
    if (!d.emailHtml || !d.toEmail || !d.emailSubject) return NextResponse.json({ error: "Ky dërgim s'ka email." }, { status: 400 });
    res = await sendEmail(d.toEmail, d.emailSubject, d.emailHtml, undefined, { replyTo: d.replyTo || undefined });
  }

  const updated = await prisma.materialOrderDispatch.update({
    where: { id: d.id },
    data: channel === "sms"
      ? { smsStatus: res.ok ? "SENT" : "FAILED", smsError: res.ok ? null : res.error ?? "Dërgimi dështoi" }
      : { emailStatus: res.ok ? "SENT" : "FAILED", emailError: res.ok ? null : res.error ?? "Dërgimi dështoi" },
  });
  await logAction(session, "UPDATE", "MaterialOrderDispatch", d.id, `Riprovoi ${channel === "sms" ? "SMS-in" : "email-in"} te ${d.supplierName}: ${res.ok ? "u dërgua" : `dështoi (${res.error})`}`);
  return NextResponse.json({ ok: res.ok, error: res.error ?? null, dispatch: updated }, { status: res.ok ? 200 : 502 });
}
