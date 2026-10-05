// Konstante të përbashkëta të Sekretarisë (server + klient) — llojet e
// dokumenteve të arkivit, rolet e stafit, fushat e Librit Amë, hapat e
// Mbylljes së Vitit. Një vend i vetëm, që paneli dhe modulet të numërojnë njësoj.

/** Llojet e dokumenteve në arkiv (DocArchive.type) → etiketa + moduli që i lëshon. */
export const DOC_TYPES: Record<string, { label: string; module: "fletkalimet" | "vertetime" | "kontratat-nxenesve" | "kontratat-mesimdhnesve" }> = {
  FLETEKALIM_CL:        { label: "Fletëkalim CL",            module: "fletkalimet" },
  FLETEKALIM_CU:        { label: "Fletëkalim CU",            module: "fletkalimet" },
  PASQYRE_CU:           { label: "Pasqyrë notash CU",        module: "fletkalimet" },
  VERTETIM_CL:          { label: "Vërtetim CL",              module: "fletkalimet" },
  VERTETIM_NXENES:      { label: "Vërtetim nxënësi",         module: "vertetime" },
  VERTETIM_MESIMDHENES: { label: "Vërtetim mësimdhënësi",    module: "vertetime" },
  VERTETIM_ASISTENTE:   { label: "Vërtetim asistenteje",     module: "vertetime" },
  KONTRATE_NXENES:      { label: "Kontratë nxënësi",         module: "kontratat-nxenesve" },
  KONTRATE_MESIMDHENES: { label: "Kontratë mësimdhënësi",    module: "kontratat-mesimdhnesve" },
};

export const FLETEKALIM_TYPES = Object.keys(DOC_TYPES).filter(t => DOC_TYPES[t].module === "fletkalimet");
export const VERTETIM_TYPES = Object.keys(DOC_TYPES).filter(t => DOC_TYPES[t].module === "vertetime");

/** Ku hapet një dokument i arkivit për ta riprintuar. */
export function reprintHref(doc: { id: number; type: string; studentId: number | null; staffId: number | null }): string {
  const mod = DOC_TYPES[doc.type]?.module;
  if (mod === "fletkalimet" || mod === "vertetime" || mod === "kontratat-mesimdhnesve") return `/sekretaria/${mod}?archiveId=${doc.id}`;
  if (mod === "kontratat-nxenesve" && doc.studentId) return `/sekretaria/kontratat-nxenesve?studentId=${doc.studentId}`;
  return "/arkiva";
}

/** Rolet e stafit — i njëjti rregull që përdor moduli Vërtetime (fusha "lenda"/"tipi"). */
export const NON_TEACHING_LENDA = ["Asistente", "Mirembajtëse", "Kuzhinjiere", "Sekretare"];
export function isAssistant(s: { lenda: string | null }): boolean {
  return s.lenda === "Asistente";
}
export function isTeacher(s: { lenda: string | null; tipi: string | null }): boolean {
  return s.tipi !== "Menaxhment" && !NON_TEACHING_LENDA.includes(s.lenda ?? "");
}

/** Kontrata e stafit e nënshkruar (vlerat e fushës "Kontrata" te Stafi). */
export function isStaffContractSigned(kontrata: string | null): boolean {
  const k = (kontrata ?? "").trim().toLowerCase();
  return k === "po" || k.startsWith("po/");
}

/** Statusi i kontratës së nxënësit (fusha Student.kontrata). */
export const STUDENT_CONTRACT_SIGNED = "Po";
export const STUDENT_CONTRACT_PENDING = "Nuk e ka kthy";
export const STUDENT_CONTRACT_NONE = "Nuk ka";
export const STUDENT_CONTRACT_OPTIONS = [
  { value: STUDENT_CONTRACT_PENDING, label: "Pa nënshkruar (pret prindin)" },
  { value: STUDENT_CONTRACT_SIGNED,  label: "Nënshkruar" },
  { value: STUDENT_CONTRACT_NONE,    label: "Nuk ka kontratë" },
];

/** Libri Amë — fushat e detyrueshme (koka e regjistrit), nga të dhënat e nxënësit. */
export const LIBRI_AME_REQUIRED = [
  { key: "birthDate",      label: "Datëlindja" },
  { key: "personalNumber", label: "Nr. personal" },
  { key: "fatherName",     label: "Emri i babait" },
  { key: "motherName",     label: "Emri i nënës" },
  { key: "address",        label: "Adresa" },
] as const;

export function missingLibriAmeFields(s: Record<string, unknown>): string[] {
  return LIBRI_AME_REQUIRED.filter(f => {
    const v = s[f.key];
    return v === null || v === undefined || (typeof v === "string" && !v.trim());
  }).map(f => f.label);
}

/** Mbyllja e Vitit — hapat (MANUAL = shënohen me dorë, AUTO = nga të dhënat). */
export const YEAR_CLOSING_STEPS = [
  { key: "GRADES",   label: "Notat përfundimtare të futura",          mode: "MANUAL" },
  { key: "DEBTS",    label: "Kontratat e mbyllura / borxhet e sqaruara", mode: "MANUAL" },
  { key: "NEW_YEAR", label: "Viti i ri shkollor i krijuar",            mode: "AUTO" },
  { key: "PROMOTE",  label: "Kalimi i nxënësve (1A → 2A …)",          mode: "AUTO" },
  { key: "OPEN",     label: "Hapja e vitit të ri",                     mode: "AUTO" },
] as const;
export type YearStepKey = (typeof YEAR_CLOSING_STEPS)[number]["key"];
export const MANUAL_YEAR_STEPS: YearStepKey[] = ["GRADES", "DEBTS"];
