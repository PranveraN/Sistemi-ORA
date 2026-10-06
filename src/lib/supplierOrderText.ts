// Tekstet e porosisë te furnitori (SMS + email) — funksione të pastra, të
// përdorura nga pamja paraprake dhe nga serveri. Teste: supplierOrderText.test.ts

export interface OrderLineText { name: string; quantity: number; unit: string | null }

/** "copë" nënkuptohet — s'shkruhet ("Llastik - 3"); njësitë e tjera po ("1 pako"). */
export function qtyLabel(l: OrderLineText): string {
  const u = (l.unit ?? "").trim();
  return !u || u === "copë" ? String(l.quantity) : `${l.quantity} ${u}`;
}

export function fmtDateDots(d: Date): string {
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
}

/** Vetëm për SMS: ë/ç dhe shenjat tipografike → GSM-7, që mesazhi të mos kalojë në Unicode (70 karaktere). */
export function toSmsSafe(text: string): string {
  return text
    .replace(/ë/g, "e").replace(/Ë/g, "E").replace(/ç/g, "c").replace(/Ç/g, "C")
    .replace(/[–—]/g, "-").replace(/[„“”«»]/g, '"').replace(/[‘’]/g, "'").replace(/…/g, "...")
    .replace(/ /g, " ");
}

// Alfabeti GSM 03.38 (bazë + zgjerim, ku çdo karakter i zgjerimit zë 2 vende)
const GSM_BASIC = "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€\f";

export interface SmsCount { chars: number; segments: number; unicode: boolean; perSegment: number }

export function countSms(text: string): SmsCount {
  let gsmLen = 0;
  let unicode = false;
  for (const ch of text) {
    if (GSM_BASIC.includes(ch)) gsmLen += 1;
    else if (GSM_EXT.includes(ch)) gsmLen += 2;
    else { unicode = true; break; }
  }
  if (unicode) {
    const len = [...text].length;
    return { chars: len, unicode, perSegment: len <= 70 ? 70 : 67, segments: len === 0 ? 0 : len <= 70 ? 1 : Math.ceil(len / 67) };
  }
  return { chars: gsmLen, unicode, perSegment: gsmLen <= 160 ? 160 : 153, segments: gsmLen === 0 ? 0 : gsmLen <= 160 ? 1 : Math.ceil(gsmLen / 153) };
}

export interface OrderTextContext { school: string; schoolPhone: string; date: Date; adminName: string }

export function buildSmsText(lines: OrderLineText[], ctx: OrderTextContext): string {
  return toSmsSafe([
    `Porosi nga ${ctx.school} - ${fmtDateDots(ctx.date)}`,
    ...lines.map((l, i) => `${i + 1}. ${l.name} - ${qtyLabel(l)}`),
    `Ju lutem konfirmoni. Tel: ${ctx.schoolPhone}`,
  ].join("\n"));
}

export function emailSubject(ctx: OrderTextContext): string {
  return `Porosi materialesh – ${ctx.school} – ${fmtDateDots(ctx.date)}`;
}

export const EMAIL_INTRO = "Përshëndetje,\n\nJu lutem na dërgoni artikujt e mëposhtëm:";
export function emailClosing(ctx: OrderTextContext): string {
  return `Ju lutem konfirmoni porosinë dhe afatin e dorëzimit.\n\nFaleminderit,\n${ctx.adminName} – ${ctx.school} · ${ctx.schoolPhone}`;
}

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const paragraphs = (s: string) => esc(s.trim()).split(/\n{2,}/).map(p => `<p style="margin:0 0 12px">${p.replace(/\n/g, "<br>")}</p>`).join("");

/** Trupi HTML i email-it: hyrja, tabela (Nr. | Artikulli | Sasia), mbyllja — me ë/ç normale. */
export function buildEmailHtml(lines: OrderLineText[], intro: string, closing: string): string {
  const cell = "padding:6px 10px;border-bottom:1px solid #e2e8f0";
  const rows = lines.map((l, i) =>
    `<tr><td style="${cell};color:#64748b">${i + 1}</td><td style="${cell}">${esc(l.name)}</td><td style="${cell};text-align:right;font-weight:bold">${esc(qtyLabel(l))}</td></tr>`).join("");
  return `<div style="font-family:Arial,sans-serif;font-size:14px;color:#0f172a;line-height:1.5">
${paragraphs(intro)}
<table style="border-collapse:collapse;margin:4px 0 16px;min-width:320px">
<thead><tr style="background:#f1f5f9"><th style="${cell};text-align:left">Nr.</th><th style="${cell};text-align:left">Artikulli</th><th style="${cell};text-align:right">Sasia</th></tr></thead>
<tbody>${rows}</tbody></table>
${paragraphs(closing)}
</div>`;
}
