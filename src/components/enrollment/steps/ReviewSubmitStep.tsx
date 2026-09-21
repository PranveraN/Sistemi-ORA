"use client";

import { AlertCircle, Loader2, Send } from "lucide-react";
import type { ApplicationFormState, ConfigGrade, FieldSetter, UploadedDoc } from "../types";
import { docTypeLabel } from "@/lib/enrollmentDocs";

interface Props {
  form: ApplicationFormState;
  set: FieldSetter;
  selectedGrade: ConfigGrade | undefined;
  documents: UploadedDoc[];
  submitting: boolean;
  submitError: string | null;
  missing: string[] | null;
  onSubmit: () => void;
}

function primaryContactLabel(form: ApplicationFormState): string {
  if (form.primaryContact === "MOTHER") return form.motherName ? `${form.motherName} (Nëna)` : "Nëna";
  if (form.primaryContact === "FATHER") return form.fatherName ? `${form.fatherName} (Babai)` : "Babai";
  if (form.primaryContact === "OTHER") return form.guardianOtherName || "Kujdestar tjetër";
  return "—";
}

export default function ReviewSubmitStep({ form, set, selectedGrade, documents, submitting, submitError, missing, onSubmit }: Props) {
  return (
    <div className="space-y-5">
      <div className="card p-4 space-y-2.5 bg-slate-50 dark:bg-slate-800/50">
        <SummaryRow label="Nxënësi" value={`${form.firstName} ${form.lastName}`.trim() || "—"} />
        <SummaryRow label="Klasa" value={selectedGrade?.label ?? "—"} />
        <SummaryRow label="Viti Shkollor" value={form.schoolYear || "—"} />
        <SummaryRow label="Prindi / Kujdestari" value={primaryContactLabel(form)} />
        <SummaryRow label="Dokumentet" value={documents.length > 0 ? documents.map(d => docTypeLabel(d.docType)).join(", ") : "Asnjë i ngarkuar"} />
      </div>

      {missing && missing.length > 0 && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-sm font-semibold text-red-600 dark:text-red-400 flex items-center gap-1.5 mb-1">
            <AlertCircle className="w-4 h-4" /> Mungojnë disa të dhëna/dokumente:
          </p>
          <ul className="text-xs text-red-600 dark:text-red-400 list-disc list-inside space-y-0.5">
            {missing.map(m => <li key={m}>{m}</li>)}
          </ul>
        </div>
      )}
      {submitError && !missing && (
        <p className="text-sm text-red-500">{submitError}</p>
      )}

      <label className="flex items-start gap-2.5 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={form.consentDataAccurate}
          onChange={e => set("consentDataAccurate", e.target.checked)}
        />
        Konfirmoj se të dhënat e dhëna në këtë aplikim janë të sakta. <span className="text-red-500">*</span>
      </label>

      <button
        type="button"
        onClick={onSubmit}
        disabled={submitting || !form.consentDataAccurate}
        className="btn-primary w-full justify-center"
      >
        {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        {submitting ? "Duke dorëzuar..." : "Dorëzo Aplikimin"}
      </button>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-slate-400 shrink-0">{label}</span>
      <span className="font-medium text-slate-800 dark:text-slate-100 text-right">{value}</span>
    </div>
  );
}
