// Fushat "e thjeshta" (pa logjikë biznesi) të formularit "/apliko" që
// administrata mund t'i fikë/ndezë ose t'i shënojë të domosdoshme nga
// Cilësimet ("Formulari i Aplikimit") — shih planin. Modul izomorfik,
// importohet edhe nga API-ja publike edhe nga wizard-i në browser.
//
// S'përfshihen këtu (mbeten gjithmonë fikse — kanë logjikë biznesi ose janë
// thelbësore): emri/mbiemri/datëlindja/gjinia/numri personal, klasa/viti,
// prindërit kryesorë (emri+telefoni), adresa, kontakti kryesor, pëlqimi,
// dokumentet.

export interface FieldDef {
  key: string;
  label: string;
  section: "Nxënësi" | "Shkolla" | "Prindërit" | "Kontakti";
  defaultRequired: boolean;
}

export const EXISTING_FIELDS: FieldDef[] = [
  { key: "citizenship",              label: "Shtetësia",                          section: "Nxënësi",  defaultRequired: false },
  { key: "birthCountry",              label: "Vendi i Lindjes",                    section: "Nxënësi",  defaultRequired: false },
  { key: "previousSchool",            label: "Shkolla Paraardhëse / Çerdhja",      section: "Shkolla",  defaultRequired: false },
  { key: "lastCompletedGrade",        label: "Klasa e Fundit e Përfunduar",        section: "Shkolla",  defaultRequired: false },
  { key: "desiredStartDate",          label: "Data e Dëshiruar e Fillimit",        section: "Shkolla",  defaultRequired: false },
  { key: "applicationReason",         label: "Arsyeja e Aplikimit / Transferimit", section: "Shkolla",  defaultRequired: false },
  { key: "motherBirth",               label: "Datëlindja e Nënës",                 section: "Prindërit", defaultRequired: false },
  { key: "motherProf",                label: "Profesioni i Nënës",                 section: "Prindërit", defaultRequired: false },
  { key: "motherEmail",               label: "E-mail i Nënës",                     section: "Prindërit", defaultRequired: false },
  { key: "motherAddress",             label: "Adresa e Nënës (nëse ndryshe)",      section: "Prindërit", defaultRequired: false },
  { key: "fatherBirth",               label: "Datëlindja e Babait",                section: "Prindërit", defaultRequired: false },
  { key: "fatherProf",                label: "Profesioni i Babait",                section: "Prindërit", defaultRequired: false },
  { key: "fatherEmail",               label: "E-mail i Babait",                    section: "Prindërit", defaultRequired: false },
  { key: "fatherAddress",             label: "Adresa e Babait (nëse ndryshe)",     section: "Prindërit", defaultRequired: false },
  { key: "guardianOtherRelation",     label: "Lidhja e Kujdestarit me Nxënësin",   section: "Prindërit", defaultRequired: false },
  { key: "guardianOtherEmail",        label: "E-mail i Kujdestarit",               section: "Prindërit", defaultRequired: false },
  { key: "country",                   label: "Vendi i Banimit",                    section: "Kontakti", defaultRequired: false },
  { key: "emergencyContactName",      label: "Emri i Kontaktit Emergjent",          section: "Kontakti", defaultRequired: false },
  { key: "emergencyContactRelation",  label: "Lidhja e Kontaktit Emergjent",        section: "Kontakti", defaultRequired: false },
  { key: "emergencyContactPhone",     label: "Telefoni i Kontaktit Emergjent",      section: "Kontakti", defaultRequired: false },
  { key: "additionalInfo",            label: "Informacion Shtesë",                  section: "Kontakti", defaultRequired: false },
];

export interface FieldOverride { visible: boolean; required: boolean }
export type FieldConfigMap = Record<string, FieldOverride>;

// Bashkon mbivendosjet e ruajtura (Setting "enrollmentFieldConfig", JSON string)
// me parazgjedhjet (të gjitha të dukshme, jo të domosdoshme) — kështu një fushë
// e re e shtuar në kod shfaqet automatikisht pa migrim të Setting-it.
export function resolveFieldConfig(rawSettingValue: string | null | undefined): FieldConfigMap {
  let stored: Record<string, Partial<FieldOverride>> = {};
  if (rawSettingValue) {
    try { stored = JSON.parse(rawSettingValue); } catch { stored = {}; }
  }
  const resolved: FieldConfigMap = {};
  for (const f of EXISTING_FIELDS) {
    resolved[f.key] = {
      visible: stored[f.key]?.visible ?? true,
      required: stored[f.key]?.required ?? f.defaultRequired,
    };
  }
  return resolved;
}

export function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // hiq diakritikët (ë, ç, etj.)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 60) || "pyetje";
}
