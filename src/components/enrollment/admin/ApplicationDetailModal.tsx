"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, FileText, Image as ImageIcon, Check, Ban, ExternalLink, AlertTriangle, Trash2 } from "lucide-react";
import { formatDate, formatDateTime, formatFileSize } from "@/lib/utils";
import { docTypeLabel } from "@/lib/enrollmentDocs";
import { getGradeNumber } from "@/lib/school-cycles";

interface Doc { id: number; docType: string; originalName: string; contentType: string; size: number; }
interface ClassOption { id: number; name: string; level: string; capacity: number | null; active: boolean; _count: { students: number } }
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
}

interface CustomFieldDef { id: number; label: string; type: string; active: boolean }

export default function ApplicationDetailModal({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const [data, setData] = useState<Detail | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [customFieldDefs, setCustomFieldDefs] = useState<CustomFieldDef[]>([]);
  const [assignClassId, setAssignClassId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rejectNote, setRejectNote] = useState("");
  const [showRejectBox, setShowRejectBox] = useState(false);

  useEffect(() => {
    fetch(`/api/enrollment/applications/${id}`).then(r => r.json()).then(setData);
    fetch("/api/classes").then(r => r.json()).then(setClasses);
    fetch("/api/enrollment-form-fields?includeInactive=1").then(r => r.json()).then(setCustomFieldDefs);
  }, [id]);

  const customAnswers: Record<string, string> = data?.customAnswers ? JSON.parse(data.customAnswers) : {};
  const customAnswerRows = customFieldDefs
    .filter(f => customAnswers[String(f.id)] !== undefined && customAnswers[String(f.id)] !== "")
    .map(f => ({ label: f.label, value: f.type === "CHECKBOX" ? (customAnswers[String(f.id)] === "true" ? "Po" : "Jo") : customAnswers[String(f.id)] }));

  const matchingClasses = classes.filter(c => c.active && getGradeNumber(c.name) === data?.desiredGrade);

  async function approve() {
    if (!assignClassId) return;
    if (!confirm("Ta pranoj këtë aplikim dhe të krijoj nxënësin në sistem?")) return;
    setBusy(true); setError("");
    const r = await fetch(`/api/enrollment/applications/${id}/approve`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ classId: Number(assignClassId) }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { setError(d.message || "Dështoi."); return; }
    onChanged();
    onClose();
  }

  async function reject() {
    setBusy(true); setError("");
    const r = await fetch(`/api/enrollment/applications/${id}/reject`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewNote: rejectNote || null }),
    });
    const d = await r.json();
    setBusy(false);
    if (!r.ok) { setError(d.message || "Dështoi."); return; }
    onChanged();
    onClose();
  }

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
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">{data ? `${data.firstName} ${data.lastName}` : "Duke ngarkuar..."}</h3>
            {data?.referenceNumber && <p className="text-xs text-slate-400 mt-0.5">{data.referenceNumber}</p>}
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        {data && (
          <div className="p-5 space-y-5">
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
                Aplikimi u refuzua.
              </div>
            )}
            {data.waitlisted && (
              <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl text-sm text-amber-700 dark:text-amber-400">
                Prindi ka pranuar listën e pritjes — klasa ishte plot në momentin e aplikimit.
              </div>
            )}

            <Section title="Nxënësi">
              <Row label="Emri" value={`${data.firstName} ${data.lastName}`} />
              <Row label="Datëlindja" value={data.birthDate ? formatDate(data.birthDate) : "—"} />
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

            {data.status === "PENDING" && (
              <div className="space-y-3 border-t border-slate-100 dark:border-slate-700 pt-4">
                <div>
                  <label className="form-label">Cakto Paralelen (Klasa {data.desiredGrade ?? "—"}) <span className="text-red-500">*</span></label>
                  {matchingClasses.length === 0 ? (
                    <p className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                      <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> Asnjë paralele aktive për këtë klasë te "Klasat" (krijo një, ose shëno një ekzistuese si aktive).
                    </p>
                  ) : (
                    <select className="form-input" value={assignClassId} onChange={e => setAssignClassId(e.target.value)}>
                      <option value="">— Zgjidh paralelen —</option>
                      {matchingClasses.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} — {c._count.students}{c.capacity != null ? `/${c.capacity}` : ""} nxënës{c.capacity != null && c._count.students >= c.capacity ? " (plot)" : ""}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                {showRejectBox && (
                  <textarea
                    className="form-input"
                    rows={2}
                    placeholder="Arsyeja e refuzimit (opsionale)"
                    value={rejectNote}
                    onChange={e => setRejectNote(e.target.value)}
                  />
                )}
                <div className="flex gap-2">
                  {!showRejectBox ? (
                    <button onClick={() => setShowRejectBox(true)} disabled={busy} className="btn-secondary flex-1">
                      <Ban className="w-4 h-4" /> Refuzo
                    </button>
                  ) : (
                    <button onClick={reject} disabled={busy} className="btn-secondary flex-1 text-red-600">
                      <Ban className="w-4 h-4" /> Konfirmo Refuzimin
                    </button>
                  )}
                  <button onClick={approve} disabled={busy || !assignClassId} className="btn-primary flex-1">
                    <Check className="w-4 h-4" /> Prano
                  </button>
                </div>
              </div>
            )}
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
