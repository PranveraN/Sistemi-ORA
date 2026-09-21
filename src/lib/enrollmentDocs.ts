// Llojet e dokumenteve për aplikimin e regjistrimit + rregulli i domosdoshmërisë.
// Modul izomorfik — importohet edhe nga API-ja publike (server) edhe nga
// wizard-i i aplikimit (browser), pa asnjë varësi server-only.
// Rregullat janë fiksuar këtu në kod (jo ekran Cilësimesh) — shih planin;
// shtohet ekran admin për t'i konfiguruar kur të ndërtohet shqyrtimi i aplikimeve.

export type DocType = "BIRTH_CERT" | "PARENT_ID" | "TRANSFER_DOC" | "VACCINATION_BOOK" | "MEDICAL_REPORT" | "OTHER";
type Rule = "always" | "grade6plus" | "optional";

export const DOC_TYPES: { type: DocType; label: string; rule: Rule; multiple?: boolean }[] = [
  { type: "BIRTH_CERT",       label: "Certifikata e Lindjes",                          rule: "always" },
  { type: "PARENT_ID",        label: "Dokument Identifikimi i Prindit/Kujdestarit",     rule: "always" },
  { type: "TRANSFER_DOC",     label: "Dëftesa / Fletëkalimi nga shkolla paraardhëse",   rule: "grade6plus" },
  { type: "VACCINATION_BOOK", label: "Libreza e Vaksinimit",                           rule: "optional" },
  { type: "MEDICAL_REPORT",   label: "Raport Mjekësor (logopedi/psikologu)",            rule: "optional" },
  { type: "OTHER",            label: "Dokumente të Tjera",                             rule: "optional", multiple: true },
];

export function isDocRequired(docType: DocType, gradeNumber: number | null): boolean {
  const t = DOC_TYPES.find(d => d.type === docType);
  if (!t) return false;
  if (t.rule === "always") return true;
  if (t.rule === "grade6plus") return gradeNumber != null && gradeNumber >= 6;
  return false;
}

export function docTypeLabel(docType: string): string {
  return DOC_TYPES.find(d => d.type === docType)?.label ?? docType;
}
