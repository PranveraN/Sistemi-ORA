import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/email";
import { logAction } from "@/lib/audit";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const email = String(body.email || "").trim();
  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Email i pavlefshëm" }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: parseInt(id) },
    include: {
      student: true,
      items: { include: { student: { select: { firstName: true, lastName: true } } } },
    },
  });
  if (!invoice) return NextResponse.json({ error: "Fatura s'u gjet" }, { status: 404 });

  const typeLabel = invoice.type === "INVOICE" ? "Faturë" : invoice.type === "PROFORMA" ? "Profaturë" : "Ofertë";
  const parentName = invoice.student.fatherName || invoice.student.motherName || invoice.student.parentName || "Prind i nderuar";
  const eur = (v: number) => `${v.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

  const itemsHtml = invoice.items.map(it => `
    <tr>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;">${it.description}${it.student ? ` — ${it.student.firstName} ${it.student.lastName}` : ""}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:center;">${it.quantity}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right;">${eur(it.unitPrice)}</td>
      <td style="padding:6px 10px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">${eur(it.total)}</td>
    </tr>`).join("");

  const html = `
    <div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;color:#0f172a;">
      <h2 style="color:#1d4ed8;margin:0 0 4px;">${typeLabel} #${invoice.number}</h2>
      <p>Përshëndetje ${parentName},</p>
      <p>Ju përcjellim ${typeLabel.toLowerCase()}n për <strong>${invoice.student.firstName} ${invoice.student.lastName}</strong>:</p>
      <table style="width:100%;border-collapse:collapse;margin:14px 0;font-size:13px;">
        <thead>
          <tr style="background:#1d4ed8;color:#fff;">
            <th style="padding:7px 10px;text-align:left;">Përshkrimi</th>
            <th style="padding:7px 10px;">Sasi</th>
            <th style="padding:7px 10px;text-align:right;">Çmimi</th>
            <th style="padding:7px 10px;text-align:right;">Totali</th>
          </tr>
        </thead>
        <tbody>${itemsHtml}</tbody>
      </table>
      <p style="text-align:right;font-size:17px;font-weight:800;color:#1d4ed8;">TOTALI: ${eur(invoice.total)}</p>
      ${invoice.dueDate ? `<p style="font-size:13px;color:#475569;">Afati i pagesës: ${new Date(invoice.dueDate).toLocaleDateString("sq-AL")}</p>` : ""}
      ${invoice.notes ? `<p style="font-size:13px;color:#475569;"><em>${invoice.notes}</em></p>` : ""}
      <p style="margin-top:20px;">Faleminderit,<br/>Akademia Ora</p>
    </div>`;

  const result = await sendEmail(email, `${typeLabel} #${invoice.number} — Akademia Ora`, html);
  if (!result.ok) {
    return NextResponse.json({ error: result.error || "Dërgimi dështoi" }, { status: 500 });
  }

  if (invoice.status === "DRAFT") {
    await prisma.invoice.update({ where: { id: invoice.id }, data: { status: "SENT" } });
  }

  await logAction(session, "UPDATE", "Invoice", invoice.id,
    `Dërgoi ${typeLabel.toLowerCase()}n ${invoice.number} (${invoice.student.firstName} ${invoice.student.lastName}) me email te ${email}`);

  return NextResponse.json({ ok: true });
}
