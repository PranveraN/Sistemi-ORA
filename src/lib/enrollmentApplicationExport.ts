import { formatDate, formatDateTime } from "@/lib/utils";
import { docTypeLabel } from "@/lib/enrollmentDocs";

const STATUS_LABELS: Record<string, string> = {
  DRAFT: "Draft", PENDING: "Për Shqyrtim", APPROVED: "Pranuar", REJECTED: "Refuzuar", NEEDS_INFO: "Kërkohet Plotësim",
};

export interface ExportableApplication {
  referenceNumber: string | null;
  status: string;
  firstName: string; lastName: string; birthDate: string | null; gender: string | null;
  personalNumber: string | null; citizenship: string | null; birthCountry: string | null;
  originType: string | null; originCountry: string | null;
  schoolYear: string; desiredGrade: number | null; class: { name: string } | null;
  previousSchool: string | null; lastCompletedGrade: string | null;
  desiredStartDate: string | null; applicationReason: string | null; waitlisted: boolean;
  motherName: string | null; motherBirth: string | null; motherProf: string | null; motherPhone: string | null; motherEmail: string | null; motherAddress: string | null;
  fatherName: string | null; fatherBirth: string | null; fatherProf: string | null; fatherPhone: string | null; fatherEmail: string | null; fatherAddress: string | null;
  primaryContact: string | null; guardianOtherName: string | null; guardianOtherRelation: string | null; guardianOtherPhone: string | null; guardianOtherEmail: string | null;
  address: string | null; country: string | null;
  emergencyContactName: string | null; emergencyContactRelation: string | null; emergencyContactPhone: string | null;
  additionalInfo: string | null;
  submittedAt: string | null; createdAt: string; reviewedAt: string | null; reviewNote: string | null;
  createdStudentId: number | null;
  documents?: { docType: string }[];
  customAnswers?: string | null;
}

export interface CustomFieldDef { id: number; label: string; type: string }

function customAnswersText(r: ExportableApplication, fieldDefs: CustomFieldDef[]): string {
  if (!r.customAnswers) return "";
  let parsed: Record<string, string>;
  try { parsed = JSON.parse(r.customAnswers); } catch { return ""; }
  return fieldDefs
    .filter(f => parsed[String(f.id)] !== undefined && parsed[String(f.id)] !== "")
    .map(f => `${f.label}: ${f.type === "CHECKBOX" ? (parsed[String(f.id)] === "true" ? "Po" : "Jo") : parsed[String(f.id)]}`)
    .join("; ");
}

function primaryContactLabel(r: ExportableApplication): string {
  if (r.primaryContact === "MOTHER") return "Nëna";
  if (r.primaryContact === "FATHER") return "Babai";
  if (r.primaryContact === "OTHER") return r.guardianOtherName ? `Kujdestar: ${r.guardianOtherName}` : "Kujdestar tjetër";
  return "";
}

// Një rresht Excel për aplikim, me TË GJITHA fushat (jo vetëm ato të dukshme
// te tabela) — njësoj si exportMaterialRequestsExcel (shih lib/materialRequestExport.ts).
export async function exportEnrollmentApplicationsExcel(rows: ExportableApplication[], fileName: string, fieldDefs: CustomFieldDef[] = []) {
  const XLSX = await import("xlsx");

  const headers = [
    "Referenca", "Statusi", "Emri", "Mbiemri", "Datëlindja", "Gjinia", "Numri Personal",
    "Shtetësia", "Vendi i Lindjes", "Origjina",
    "Klasa e Aplikuar", "Paralelja e Caktuar", "Viti Shkollor",
    "Shkolla Paraardhëse", "Klasa e Fundit e Përfunduar", "Data e Dëshiruar e Fillimit", "Arsyeja e Aplikimit", "Listë Pritjeje",
    "Nëna — Emri", "Nëna — Datëlindja", "Nëna — Profesioni", "Nëna — Telefoni", "Nëna — Email", "Nëna — Adresa",
    "Babai — Emri", "Babai — Datëlindja", "Babai — Profesioni", "Babai — Telefoni", "Babai — Email", "Babai — Adresa",
    "Kontakti Kryesor", "Kujdestar Tjetër — Lidhja", "Kujdestar Tjetër — Telefoni", "Kujdestar Tjetër — Email",
    "Adresa e Banimit", "Vendi i Banimit",
    "Kontakti Emergjent — Emri", "Kontakti Emergjent — Lidhja", "Kontakti Emergjent — Telefoni",
    "Informacion Shtesë", "Dokumentet e Bashkëngjitura", "Pyetje Shtesë",
    "Data e Dorëzimit", "Data e Krijimit", "Data e Shqyrtimit", "Shënimi i Shqyrtimit", "ID Nxënësi",
  ];

  const data = rows.map(r => [
    r.referenceNumber ?? "",
    STATUS_LABELS[r.status] ?? r.status,
    r.firstName, r.lastName,
    r.birthDate ? formatDate(r.birthDate) : "",
    r.gender ?? "",
    r.personalNumber ?? "",
    r.citizenship ?? "",
    r.birthCountry ?? "",
    r.originType === "DIASPORA" ? (r.originCountry || "Diasporë") : "Kosovë",
    r.class?.name ?? (r.desiredGrade != null ? `Klasa ${r.desiredGrade}` : ""),
    r.class?.name ?? "",
    r.schoolYear,
    r.previousSchool ?? "", r.lastCompletedGrade ?? "",
    r.desiredStartDate ? formatDate(r.desiredStartDate) : "",
    r.applicationReason ?? "",
    r.waitlisted ? "Po" : "Jo",
    r.motherName ?? "", r.motherBirth ? formatDate(r.motherBirth) : "", r.motherProf ?? "", r.motherPhone ?? "", r.motherEmail ?? "", r.motherAddress ?? "",
    r.fatherName ?? "", r.fatherBirth ? formatDate(r.fatherBirth) : "", r.fatherProf ?? "", r.fatherPhone ?? "", r.fatherEmail ?? "", r.fatherAddress ?? "",
    primaryContactLabel(r), r.guardianOtherRelation ?? "", r.guardianOtherPhone ?? "", r.guardianOtherEmail ?? "",
    r.address ?? "", r.country ?? "",
    r.emergencyContactName ?? "", r.emergencyContactRelation ?? "", r.emergencyContactPhone ?? "",
    r.additionalInfo ?? "",
    (r.documents ?? []).map(d => docTypeLabel(d.docType)).join(", "),
    customAnswersText(r, fieldDefs),
    r.submittedAt ? formatDateTime(r.submittedAt) : "",
    formatDateTime(r.createdAt),
    r.reviewedAt ? formatDateTime(r.reviewedAt) : "",
    r.reviewNote ?? "",
    r.createdStudentId ?? "",
  ]);

  const ws = XLSX.utils.aoa_to_sheet([headers, ...data]);
  ws["!cols"] = headers.map(() => ({ wch: 18 }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Regjistrimet");
  XLSX.writeFile(wb, `${fileName}.xlsx`);
}
