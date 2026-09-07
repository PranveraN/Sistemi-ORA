import { sendEmail } from "@/lib/email";
import { formatDate } from "@/lib/utils";

interface EmailItem {
  isCustom: boolean;
  customItemName: string | null;
  material: { name: string } | null;
  quantity: number;
  unit: string;
  color: string | null;
}

interface EmailRequest {
  id: number;
  reason: string;
  createdAt: Date | string;
  items: EmailItem[];
  teacher: { name: string; email: string };
}

function itemLine(it: EmailItem): string {
  const name = it.isCustom ? it.customItemName : it.material?.name;
  return `<tr>
    <td style="padding:6px 0;color:#64748b;">${name}${it.color ? ` (${it.color})` : ""}</td>
    <td style="padding:6px 0;font-weight:600;text-align:right;">${it.quantity} ${it.unit}</td>
  </tr>`;
}

function wrap(title: string, bodyHtml: string): string {
  return `
    <div style="font-family: system-ui, sans-serif; max-width: 480px;">
      <h2 style="margin-bottom: 4px;">${title}</h2>
      <p style="color: #64748b; margin-top: 0;">Akademia Ora</p>
      ${bodyHtml}
    </div>
  `;
}

// Njofton mësimdhënësen menjëherë pasi ka dërguar një kërkesë — konfirmim
// që kërkesa u regjistrua, jo domosdoshmërisht aprovim.
export async function sendSubmissionConfirmationEmail(request: EmailRequest) {
  if (!request.teacher.email) return;
  const html = wrap("Kërkesa u Regjistrua", `
    <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
      ${request.items.map(itemLine).join("")}
    </table>
    <table style="width: 100%; border-collapse: collapse; margin-top: 12px; border-top: 1px solid #e2e8f0; padding-top: 8px;">
      <tr><td style="padding: 6px 0; color: #64748b;">Arsyeja</td><td style="padding: 6px 0;">${request.reason}</td></tr>
      <tr><td style="padding: 6px 0; color: #64748b;">Data</td><td style="padding: 6px 0;">${formatDate(request.createdAt)}</td></tr>
    </table>
    <p style="color:#64748b; font-size: 13px; margin-top: 16px;">Do të njoftohesh me email sapo kërkesa të shqyrtohet.</p>
  `);
  await sendEmail(request.teacher.email, `Kërkesa jote për material u regjistrua`, html);
}

// Njofton mësimdhënësen për vendimin final (APPROVED/PARTIALLY_APPROVED/REJECTED)
// — përfshin arsyen kur refuzohet.
export async function sendDecisionEmail(request: EmailRequest, status: string, reviewNote: string | null) {
  if (!request.teacher.email) return;
  const statusLabel: Record<string, string> = {
    APPROVED: "Kërkesa u Aprovua",
    PARTIALLY_APPROVED: "Kërkesa u Aprovua Pjesërisht",
    REJECTED: "Kërkesa u Refuzua",
  };
  const title = statusLabel[status] ?? "Kërkesa u Përditësua";

  const noteBlock = reviewNote
    ? `<div style="margin-top: 14px; padding: 10px 14px; background: ${status === "REJECTED" ? "#fef2f2" : "#f0fdf4"}; border-radius: 8px;">
        <p style="margin: 0; font-size: 12px; color: #64748b; text-transform: uppercase; letter-spacing: .04em;">${status === "REJECTED" ? "Arsyeja e refuzimit" : "Shënim"}</p>
        <p style="margin: 4px 0 0; color: #334155;">${reviewNote}</p>
      </div>`
    : "";

  const html = wrap(title, `
    <table style="width: 100%; border-collapse: collapse; margin-top: 16px;">
      ${request.items.map(itemLine).join("")}
    </table>
    ${noteBlock}
  `);
  await sendEmail(request.teacher.email, title, html);
}
