// Shabllonet e mesazheve SMS — NJË vend i vetëm për t'i ndryshuar.
// Çelësi: "<LLOJI>:<STATUSI>" (ose "GENERAL" për njoftimin e përgjithshëm).
// Ngarkohen automatikisht kur zgjidhet një kombinim lloj + NJË status; pas
// ngarkimit teksti mund të editohet lirisht.
//
// Variablat: {emri} {klasa} {mbetja} {paguar} {afati} — zëvendësohen për
// secilin marrës para dërgimit (shih fillTemplate).

import type { MessageType, MessageStatus } from "@/lib/smsStatus";

const SIGN = "Akademia Ora";

export const SMS_TEMPLATES: Record<string, string> = {
  // ── Shkollimi ──
  "SHKOLLIMI:OVERDUE":
    `I nderuar prind, afati i shkollimit për {emri} ({klasa}) ka kaluar më {afati}. Mbetja: {mbetja} €. Ju lutem shlyeni pa vonesë. ${SIGN}`,
  "SHKOLLIMI:PARTIAL":
    `I nderuar prind, ju kujtojmë se për {emri} ({klasa}) ka mbetur për t'u paguar kësti i dytë prej {mbetja} €, me afat {afati}. Faleminderit! ${SIGN}`,
  "SHKOLLIMI:UNPAID":
    `I nderuar prind, ju kujtojmë pagesën e shkollimit për {emri} ({klasa}) prej {mbetja} €, me afat {afati}. Faleminderit! ${SIGN}`,
  "SHKOLLIMI:PAID":
    `I nderuar prind, ju falënderojmë! Pagesa e shkollimit për {emri} ({klasa}) është kryer plotësisht. ${SIGN}`,
  "SHKOLLIMI:TIMI_INVEST":
    `I nderuar prind, ju njoftojmë në lidhje me shkollimin e {emri} ({klasa}) përmes Timi Invest. Për çdo pyetje, kontaktoni shkollën. ${SIGN}`,

  // ── Ushqimi ──
  "USHQIMI:UNPAID":
    `I nderuar prind, ju kujtojmë pagesën e ushqimit për {emri} ({klasa}): {mbetja} €, me afat {afati}. Faleminderit! ${SIGN}`,
  "USHQIMI:PARTIAL":
    `I nderuar prind, për ushqimin e {emri} ({klasa}) keni paguar {paguar} €; ka mbetur {mbetja} €. Faleminderit! ${SIGN}`,
  "USHQIMI:PAID":
    `I nderuar prind, pagesa e ushqimit për {emri} ({klasa}) është kryer. Faleminderit! ${SIGN}`,

  // ── Uniforma ──
  "UNIFORMA:UNPAID":
    `I nderuar prind, ju kujtojmë pagesën e uniformës për {emri} ({klasa}): {mbetja} €. Faleminderit! ${SIGN}`,
  "UNIFORMA:PARTIAL":
    `I nderuar prind, për uniformën e {emri} ({klasa}) keni paguar {paguar} €; ka mbetur {mbetja} €. Faleminderit! ${SIGN}`,
  "UNIFORMA:PAID":
    `I nderuar prind, pagesa e uniformës për {emri} ({klasa}) është kryer. Faleminderit! ${SIGN}`,

  // ── eShkollori ──
  "ESHKOLLORI:UNPAID":
    `I nderuar prind, ju kujtojmë pagesën e platformës eShkollori për {emri} ({klasa}): {mbetja} €, me afat {afati}. Faleminderit! ${SIGN}`,
  "ESHKOLLORI:PARTIAL":
    `I nderuar prind, për eShkollorin e {emri} ({klasa}) ka mbetur {mbetja} €. Faleminderit! ${SIGN}`,
  "ESHKOLLORI:PAID":
    `I nderuar prind, pagesa e eShkollorit për {emri} ({klasa}) është kryer. Faleminderit! ${SIGN}`,

  // ── Librat e anglishtes ──
  "LIBRAT:UNPAID":
    `I nderuar prind, ju kujtojmë pagesën e librave të anglishtes për {emri} ({klasa}): {mbetja} €. Faleminderit! ${SIGN}`,
  "LIBRAT:PARTIAL":
    `I nderuar prind, për librat e anglishtes të {emri} ({klasa}) ka mbetur {mbetja} €. Faleminderit! ${SIGN}`,
  "LIBRAT:PAID":
    `I nderuar prind, pagesa e librave të anglishtes për {emri} ({klasa}) është kryer. Faleminderit! ${SIGN}`,

  // ── Njoftim i përgjithshëm ──
  "GENERAL": `Përshëndetje, i nderuar prind, `,
};

/** Shabllonet e shpejta ekzistuese (butona) — mbeten të disponueshme. */
export const QUICK_TEMPLATES: { label: string; text: string }[] = [
  { label: "Kujtesë borxhi", text: "Përshëndetje, I nderuar prind, Ju kujtojmë se {emri} ka ende borxh të papaguar. Ju lutem kontaktoni shkollën për rregullim. Faleminderit, Akademia Ora" },
  { label: "Fletëkalim", text: "Përshëndetje, I nderuar prind, Shpresoj se jeni mirë, Ju lutem që ta sillni fletëkalimin nga shkolla e mëparshme për {emri}, Faleminderit për bashkëpunimin, Akademia Ora" },
  { label: "Njoftim i përgjithshëm", text: "Përshëndetje, I nderuar prind, " },
];

export function templateFor(type: MessageType, statuses: MessageStatus[]): string | null {
  if (type === "GENERAL") return SMS_TEMPLATES.GENERAL;
  if (statuses.length !== 1) return null; // disa statuse → s'ngarkohet automatikisht
  return SMS_TEMPLATES[`${type}:${statuses[0]}`] ?? null;
}

export type SmsVariable = "{emri}" | "{klasa}" | "{mbetja}" | "{paguar}" | "{afati}";

/** Variablat që kanë kuptim për çdo lloj. */
export function variablesForType(type: MessageType): SmsVariable[] {
  if (type === "GENERAL") return ["{emri}", "{klasa}"];
  if (type === "UNIFORMA" || type === "LIBRAT") return ["{emri}", "{klasa}", "{mbetja}", "{paguar}"]; // shitje pa afat
  return ["{emri}", "{klasa}", "{mbetja}", "{paguar}", "{afati}"];
}

export interface TemplateValues {
  emri: string;
  klasa: string;
  mbetja: number;
  paguar: number;
  afati: string | null; // ISO
}

const fmtMoney = (n: number) => n.toLocaleString("de-DE", { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 });
const fmtDate = (iso: string | null) => {
  if (!iso) return "";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
};

export function fillTemplate(text: string, v: TemplateValues): string {
  return text
    .replaceAll("{emri}", v.emri)
    .replaceAll("{klasa}", v.klasa)
    .replaceAll("{mbetja}", fmtMoney(v.mbetja))
    .replaceAll("{paguar}", fmtMoney(v.paguar))
    .replaceAll("{afati}", fmtDate(v.afati))
    // "Arta (5A) dhe Blerim (3B) ()" → pa kllapa bosh kur {klasa} s'ka vlerë
    .replace(/\s*\(\s*\)/g, "")
    .replace(/ {2,}/g, " ")
    .trim();
}
