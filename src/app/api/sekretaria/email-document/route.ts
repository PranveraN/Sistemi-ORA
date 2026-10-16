import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { sendEmail } from "@/lib/email";
import { logAction } from "@/lib/audit";

// Dërgon një dokument të Sekretarisë (vërtetim…) si PDF me email.
// POST { to: "a@b.com, c@d.com", subject, message, filename, pdfBase64, label }
// PDF-ja krijohet në shfletues nga e njëjta faqe si "Printo" (src/lib/htmlToPdf.ts).

const EMAIL_RE = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "sekretaria")) return NextResponse.json({ error: "Nuk ke leje për këtë modul." }, { status: 403 });

  const b = await req.json().catch(() => ({}));
  const to = String(b.to ?? "").split(/[,;\s]+/).map(s => s.trim()).filter(Boolean);
  if (!to.length) return NextResponse.json({ error: "Shkruani email-in e marrësit." }, { status: 400 });
  if (to.length > 5) return NextResponse.json({ error: "Deri në 5 adresa njëherësh." }, { status: 400 });
  const bad = to.find(e => !EMAIL_RE.test(e));
  if (bad) return NextResponse.json({ error: `Email i pavlefshëm: ${bad}` }, { status: 400 });

  const pdfBase64 = String(b.pdfBase64 ?? "");
  if (!pdfBase64 || pdfBase64.length > 14_000_000) return NextResponse.json({ error: "PDF-ja mungon ose është shumë e madhe." }, { status: 400 });
  const content = Buffer.from(pdfBase64, "base64");
  if (content.subarray(0, 4).toString() !== "%PDF") return NextResponse.json({ error: "Skedari s'është PDF." }, { status: 400 });

  const subject = String(b.subject ?? "").trim().slice(0, 200) || "Dokument nga Akademia Ora";
  const message = String(b.message ?? "").trim().slice(0, 3000);
  const filename = (String(b.filename ?? "Dokument").replace(/[^\p{L}\p{N} ._-]+/gu, "").trim().slice(0, 100) || "Dokument").replace(/\.pdf$/i, "") + ".pdf";
  const html = `<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;line-height:1.6">${esc(message).replace(/\n/g, "<br>")}<br><br><span style="color:#666;font-size:12px">Dokumenti është bashkëngjitur si PDF.</span></div>`;

  const results = await Promise.all(to.map(addr => sendEmail(addr, subject, html, [{ filename, content }])));
  const sent = results.filter(r => r.ok).length;
  const errors = results.map((r, i) => (r.ok ? null : `${to[i]}: ${r.error}`)).filter(Boolean);
  await logAction(session, "CREATE", "SekretariaEmail", null, `Dërgoi me email "${String(b.label ?? filename).slice(0, 120)}" te ${to.join(", ")} — ${sent}/${to.length} u dërguan`);
  if (!sent) return NextResponse.json({ error: errors.join("; ") || "Dërgimi dështoi." }, { status: 502 });
  return NextResponse.json({ sent, failed: to.length - sent, errors });
}
