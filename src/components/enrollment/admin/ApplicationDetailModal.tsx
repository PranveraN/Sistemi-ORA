"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, FileText, Image as ImageIcon, ExternalLink, AlertTriangle, Trash2, History } from "lucide-react";
import { formatDate, formatDateTime, formatFileSize } from "@/lib/utils";
import { docTypeLabel } from "@/lib/enrollmentDocs";
import DecisionButtons, { EVIDENCA_BADGE, type DecisionApp } from "./DecisionButtons";
import type { EvidencaState } from "@/lib/enrollmentRules";

interface Doc { id: number; docType: string; originalName: string; contentType: string; size: number; }
interface Detail {
  id: number; referenceNumber: string | null; status: string; createdStudentId: number | null;
  firstName: string; lastName: string; birthDate: string | null; gender: string | null;
  personalNumber: string | null; citizenship: string | null; birthCountry: string | null;
  originType: string | null; originCountry: string | null;
  schoolYear: string; desiredGrade: number | null; previousSchool: string | null; lastCompletedGrade: string | null;
  desiredStartDate: string | null; applicationReason: string | null; waitlisted: boolean;
  class: { name: string; level: string } | null;
  motherName: string | null; motherBirth: string | null; motherProf: string | null; motherPhone: string | null; motherEmail: string | null; motherAddress: string | null;
  fatherName: string | null; fatherBirth: string | null; fatherProf: string | null; fatherPhone: string | null; fatherEmail: string | null; fatherAddress: string | null;
  primaryContact: string | null; guardianOtherName: string | null; guardianOtherRelation: string | null; guardianOtherPhone: string | null; guardianOtherEmail: string | null;
  address: string | null; country: string | null;
  emergencyContactName: string | null; emergencyContactRelation: string | null; emergencyContactPhone: string | null;
  additionalInfo: string | null; submittedAt: string | null; createdAt: string;
  customAnswers: string | null;
  documents: Doc[];
  evidencaState: EvidencaState;
  evidencaLegacy?: boolean;
  age: number | null;
  source: string | null;
  reviewNote: string | null;
  rejectReasonLabel: string | null;
  statusHistory: { id: number; fromStatus: string | null; toStatus: string; userName: string | null; note: string | null; createdAt: string }[];
  duplicate: {
    duplicateOf: { id: number; referenceNumber: string | null; status: string } | null;
    existingStudent: { id: number; name: string; className: string | null } | null;
  } | null;
}

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Draft (pa dërguar)", PENDING: "Për shqyrtim", EVIDENCA: "Evidenca", APPROVED: "Pranuar", REJECTED: "Refuzuar",
};

interface CustomFieldDef { id: number; label: string; type: string; active: boolean }

// Paneli anësor i detajeve të aplikimit (hapet nga e djathta; mbyllet me X/Esc).
// Vendimet (Prano/Refuzo/Evidenca) kalojnë te dialogët e faqes, me TË NJËJTAT
// butona si tabela (DecisionButtons); backend-i i rikontrollon rregullat.
export default function ApplicationDetailModal({ id, onClose, onChanged, decision, onApprove, onReject, onEvidenca, reloadKey }: {
  id: number; onClose: () => void; onChanged: () => void;
  decision?: DecisionApp | null;
  onApprove?: (overCapacity: boolean) => void;
  onReject?: () => void;
  onEvidenca?: () => void;
  reloadKey?: number;
}) {
  const [data, setData] = useState<Detail | null>(null);
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/enrollment/applications/${id}`).then(r => r.json()).then(setData);
    fetch("/api/enrollment-form-fields?includeInactive=1").then(r => r.json()).then(setCustomFieldDefs);
  }, [id, reloadKey]);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [onClose]);

  const customAnswers: Record<string, string> = data?.customAnswers ? JSON.parse(data.customAnswers) : {};
  const customAnswerRows = customFieldDefs
    .filter(f => customAnswers[String(f.id)] !== undefined && customAnswers[String(f.id)] !== "")
    .map(f => ({ label: f.label, value: f.type === "CHECKBOX" ? (customAnswers[String(f.id)] === "true" ? "Po" : "Jo") : customAnswers[String(f.id)] }));

  async function handleDelete() {
    if (!data) return;
    if (!confirm(`T'a fshij aplikimin e ${data.firstName} ${data.lastName}? Ky veprim s'kthehet mbrapa. Dokumentet e bashkëngjitura fshihen gjithashtu. Nxënësi (nëse është krijuar) NUK preket.`)) return;
    setBusy(true); setError("");
    const r = await fetch(`/api/enrollment/applications/${id}`, { method: "DELETE" });
    setBusy(false);
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.message || "Dështoi."); return; }
    onChanged();
    onClose();
  }

  return (
    <div className="fixed inset-0 bg-black/30 z-50 flex justify-end" onClick={onClose} role="dialog" aria-modal="true" aria-label="Detajet e aplikimit">
      <div className="bg-white dark:bg-slate-800 shadow-2xl w-full max-w-xl h-full overflow-y-auto animate-slide-in-right" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">{data ? `${data.firstName} ${data.lastName}` : "Duke ngarkuar..."}</h3>
            {data?.referenceNumber && <p className="text-xs text-slate-400 mt-0.5">{data.referenceNumber}</p>}
          </div>
          <button onClick={onClose} aria-label="Mbyll" title="Mbyll (Esc)" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        {data && (
          <div className="p-5 space-y-5">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{STATUS_LABEL[data.status] ?? data.status}</span>
              {!data.evidencaLegacy && <span className={`text-xs font-semibold px-2 py-0.5 rounded border ${EVIDENCA_BADGE[data.evidencaState].className}`}>Evidenca: {EVIDENCA_BADGE[data.evidencaState].label}</span>}
              {data.source === "OFFICE" && <span className="text-xs px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Shtuar nga zyra</span>}
            </div>
            {data.duplicate?.duplicateOf && (
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl text-sm text-orange-700 dark:text-orange-400 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>Aplikim i dyfishtë — i njëjti fëmijë ka aplikuar edhe te {data.duplicate.duplicateOf.referenceNumber ?? `#${data.duplicate.duplicateOf.id}`} ({STATUS_LABEL[data.duplicate.duplicateOf.status] ?? data.duplicate.duplicateOf.status}).</span>
              </div>
            )}
            {data.duplicate?.existingStudent && (
              <div className="p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-xl text-sm text-orange-700 dark:text-orange-400 flex items-center justify-between gap-2">
                <span className="flex items-start gap-2"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> Tashmë nxënës: {data.duplicate.existingStudent.name}{data.duplicate.existingStudent.className ? ` (${data.duplicate.existingStudent.className})` : ""}</span>
                <Link href={`/students/${data.duplicate.existingStudent.id}`} className="font-medium hover:underline shrink-0">Shiko →</Link>
              </div>
            )}
            {decision && onApprove && onReject && onEvidenca && (
              <DecisionButtons app={decision} onApprove={onApprove} onReject={onReject} onEvidenca={onEvidenca} />
            )}
            {data.status === "APPROVED" && data.createdStudentId && (
              <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl text-sm text-green-700 dark:text-green-400 flex items-center justify-between">
                Aplikimi u pranua.
                <Link href={`/students/${data.createdStudentId}`} className="flex items-center gap-1 font-medium hover:underline">
                  Shiko Profilin <ExternalLink className="w-3.5 h-3.5" />
                </Link>
              </div>
            )}
            {data.status === "REJECTED" && (
              <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-sm text-red-600 dark:text-red-400">
                Aplikimi u refuzua.{data.rejectReasonLabel && <> Arsyeja: <b>{data.rejectReasonLabel}</b>.</>}
                {data.reviewNote && data.reviewNote !== data.rejectReasonLabel && <span className="block mt-1">{data.reviewNote}</span>}
              </div>
            )}
            {data.waitlisted && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-400">
                Prindi ka pranuar listën e pritjes — klasa ishte plot në momentin e aplikimit.
              </div>
            )}

            <Section title="Nxënësi">
              <Row label="Emri" value={`${data.firstName} ${data.lastName}`} />
              <Row label="Datëlindja" value={data.birthDate ? `${formatDate(data.birthDate)}${data.age != null ? ` · ${data.age} vjeç` : ""}` : "—"} />
              <Row label="Gjinia" value={data.gender ?? "—"} />
              <Row label="Numri Personal" value={data.personalNumber ?? "—"} />
              <Row label="Shtetësia" value={data.citizenship ?? "—"} />
              <Row label="Vendi i Lindjes" value={data.birthCountry ?? "—"} />
              <Row label="Origjina" value={data.originType === "DIASPORA" ? (data.originCountry || "Diasporë") : "Kosovë"} />
            </Section>

            <Section title="Shkolla">
              <Row label="Klasa e Aplikuar" value={data.class ? `${data.class.name} (${data.class.level}) — e caktuar` : data.desiredGrade != null ? `Klasa ${data.desiredGrade}` : "—"} />
              <Row label="Viti Shkollor" value={data.schoolYear} />
              <Row label="Shkolla Paraardhëse" value={data.previousSchool ?? "—"} />
              <Row label="Klasa e Fundit e Përfunduar" value={data.lastCompletedGrade ?? "—"} />
              <Row label="Data e Dëshiruar e Fillimit" value={data.desiredStartDate ? formatDate(data.desiredStartDate) : "—"} />
              <Row label="Arsyeja e Aplikimit" value={data.applicationReason ?? "—"} />
            </Section>

            <Section title="Nëna">
              <Row label="Emri" value={data.motherName ?? "—"} />
              <Row label="Telefoni" value={data.motherPhone ?? "—"} />
              <Row label="E-mail" value={data.motherEmail ?? "—"} />
              <Row label="Profesioni" value={data.motherProf ?? "—"} />
            </Section>
            <Section title="Babai">
              <Row label="Emri" value={data.fatherName ?? "—"} />
              <Row label="Telefoni" value={data.fatherPhone ?? "—"} />
              <Row label="E-mail" value={data.fatherEmail ?? "—"} />
              <Row label="Profesioni" value={data.fatherProf ?? "—"} />
            </Section>
            <Section title="Kontakti Kryesor">
              <Row label="Kush" value={
                data.primaryContact === "MOTHER" ? "Nëna" : data.primaryContact === "FATHER" ? "Babai" : (data.guardianOtherName ?? "Kujdestar tjetër")
              } />
              {data.primaryContact === "OTHER" && (
                <>
                  <Row label="Lidhja me Nxënësin" value={data.guardianOtherRelation ?? "—"} />
                  <Row label="Telefoni" value={data.guardianOtherPhone ?? "—"} />
                </>
              )}
            </Section>

            <Section title="Adresa & Kontakti Emergjent">
              <Row label="Adresa" value={data.address || data.motherAddress || data.fatherAddress || "—"} />
              <Row label="Vendi i Banimit" value={data.country ?? "—"} />
              <Row label="Kontakti Emergjent" value={data.emergencyContactName ? `${data.emergencyContactName} (${data.emergencyContactRelation ?? "—"}) · ${data.emergencyContactPhone ?? "—"}` : "—"} />
              {data.additionalInfo && <Row label="Info Shtesë" value={data.additionalInfo} />}
            </Section>

            {customAnswerRows.length > 0 && (
              <Section title="Pyetje Shtesë">
                {customAnswerRows.map(r => <Row key={r.label} label={r.label} value={r.value} />)}
              </Section>
            )}

            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Dokumentet</h4>
              {data.documents.length === 0 ? (
                <p className="text-sm text-slate-400">Asnjë dokument i bashkëngjitur.</p>
              ) : (
                <div className="space-y-1.5">
                  {data.documents.map(doc => {
                    const Icon = doc.contentType.startsWith("image/") ? ImageIcon : FileText;
                    return (
                      <a
                        key={doc.id}
                        href={`/api/enrollment/applications/${id}/documents/${doc.id}`}
                        target="_blank" rel="noopener noreferrer"
                        className="flex items-center gap-3 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/60"
                      >
                        <Icon className="w-4 h-4 text-slate-400 shrink-0" />
                        <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 min-w-0 truncate">{docTypeLabel(doc.docType)}</span>
                        <span className="text-xs text-slate-400 shrink-0">{formatFileSize(doc.size)}</span>
                        <ExternalLink className="w-3.5 h-3.5 text-slate-300 shrink-0" />
                      </a>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-300">Dorëzuar: {data.submittedAt ? formatDateTime(data.submittedAt) : formatDateTime(data.createdAt)}</p>
              <button onClick={handleDelete} disabled={busy} title="Fshi aplikimin" className="flex items-center gap-1 text-xs text-slate-400 hover:text-red-600">
                <Trash2 className="w-3.5 h-3.5" /> Fshi Aplikimin
              </button>
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <div>
              <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Historiku i statusit</h4>
              {data.statusHistory.length === 0 ? (
                <p className="text-sm text-slate-400">Pa ndryshime të regjistruara (aplikim i vjetër).</p>
              ) : (
                <ol className="space-y-2 border-l border-slate-200 dark:border-slate-700 ml-1.5 pl-4">
                  {data.statusHistory.map(h => (
                    <li key={h.id} className="text-sm">
                      <p className="font-medium text-slate-700 dark:text-slate-200">
                        {h.fromStatus && h.fromStatus !== h.toStatus ? `${STATUS_LABEL[h.fromStatus] ?? h.fromStatus} → ` : ""}{STATUS_LABEL[h.toStatus] ?? h.toStatus}
                      </p>
                      {h.note && <p className="text-xs text-slate-500">{h.note}</p>}
                      <p className="text-[11px] text-slate-400">{formatDateTime(h.createdAt)}{h.userName ? ` · ${h.userName}` : ""}</p>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">{title}</h4>
      <div className="space-y-1.5">{children}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-baseline gap-2 text-sm">
      <span className="text-slate-400 shrink-0 min-w-[160px]">{label}</span>
      <span className="text-slate-700 dark:text-slate-200 font-medium">{value}</span>
    </p>
  );
}
