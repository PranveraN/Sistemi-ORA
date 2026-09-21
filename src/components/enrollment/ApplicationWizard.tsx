"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, CheckCircle2, RotateCcw } from "lucide-react";
import { EMPTY_FORM, type ApplicationFormState, type EnrollmentConfig, type UploadedDoc } from "./types";
import StudentInfoStep from "./steps/StudentInfoStep";
import SchoolInfoStep from "./steps/SchoolInfoStep";
import ParentsStep from "./steps/ParentsStep";
import ContactAddressStep from "./steps/ContactAddressStep";
import DocumentsStep from "./steps/DocumentsStep";
import CustomFieldsStep from "./steps/CustomFieldsStep";
import ReviewSubmitStep from "./steps/ReviewSubmitStep";

const STORAGE_KEY = "enrollment_draft_v1";
const BASE_STEP_LABELS = ["Nxënësi", "Shkolla", "Prindërit", "Kontakti", "Dokumentet"];

function loadDraftRef(): { id: number; resumeToken: string } | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export default function ApplicationWizard() {
  const [config, setConfig] = useState<EnrollmentConfig | null>(null);
  const [form, setForm] = useState<ApplicationFormState>(EMPTY_FORM);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});
  const [applicationId, setApplicationId] = useState<number | null>(null);
  const [resumeToken, setResumeToken] = useState<string | null>(null);
  const [documents, setDocuments] = useState<UploadedDoc[]>([]);
  const [step, setStep] = useState(0);
  const [resumedBanner, setResumedBanner] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [missing, setMissing] = useState<string[] | null>(null);
  const [referenceNumber, setReferenceNumber] = useState<string | null>(null);
  const [honeypot, setHoneypot] = useState("");

  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const draftCreating = useRef(false);

  // Hapi "Pyetje Shtesë" shtohet vetëm kur admini ka konfiguruar të paktën
  // një pyetje aktive (shih Cilësimet → "Formulari i Aplikimit") — përndryshe
  // hiqet tërësisht, që të mos ketë hap bosh.
  const hasCustomStep = (config?.customFields.length ?? 0) > 0;
  const STEP_LABELS = [...BASE_STEP_LABELS, ...(hasCustomStep ? ["Pyetje Shtesë"] : []), "Përmbledhje"];
  const CUSTOM_STEP_INDEX = hasCustomStep ? BASE_STEP_LABELS.length : -1;
  const REVIEW_STEP_INDEX = STEP_LABELS.length - 1;

  // Ngarko konfigurimin (klasat, vitet, a janë hapur aplikimet) + provo të
  // rikthesh një draft ekzistues nga localStorage.
  useEffect(() => {
    fetch("/api/public/enrollment/config").then(r => r.json()).then((cfg: EnrollmentConfig) => {
      setConfig(cfg);
      setForm(f => ({ ...f, schoolYear: f.schoolYear || cfg.defaultSchoolYear }));
    });

    const saved = loadDraftRef();
    if (!saved) return;
    fetch(`/api/public/enrollment/applications/${saved.id}?token=${encodeURIComponent(saved.resumeToken)}`)
      .then(async r => (r.ok ? r.json() : null))
      .then(data => {
        if (!data || data.status !== "DRAFT") { localStorage.removeItem(STORAGE_KEY); return; }
        setApplicationId(saved.id);
        setResumeToken(saved.resumeToken);
        setDocuments(data.documents ?? []);
        if (data.customAnswers) {
          try { setCustomAnswers(JSON.parse(data.customAnswers)); } catch { /* injorohet */ }
        }
        setForm(f => ({
          ...f,
          ...Object.fromEntries(Object.keys(EMPTY_FORM).map(k => [k, data[k] ?? ""])),
          desiredGrade: data.desiredGrade != null ? String(data.desiredGrade) : "",
          birthDate: data.birthDate ? String(data.birthDate).slice(0, 10) : "",
          motherBirth: data.motherBirth ? String(data.motherBirth).slice(0, 10) : "",
          fatherBirth: data.fatherBirth ? String(data.fatherBirth).slice(0, 10) : "",
          desiredStartDate: data.desiredStartDate ? String(data.desiredStartDate).slice(0, 10) : "",
        }));
        setResumedBanner(true);
      })
      .catch(() => { /* injorohet — thjesht fillon bosh */ });
  }, []);

  function set<K extends keyof ApplicationFormState>(field: K, value: ApplicationFormState[K]) {
    setForm(f => ({ ...f, [field]: value }));
  }

  const scheduleSave = useCallback((nextForm: ApplicationFormState, nextCustomAnswers: Record<string, string>, appId: number, token: string) => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      fetch(`/api/public/enrollment/applications/${appId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...nextForm, customAnswers: nextCustomAnswers, resumeToken: token }),
      }).catch(() => { /* autosave — dështimi i heshtur, s'ndërpret plotësimin */ });
    }, 1500);
  }, []);

  // Autosave — sapo drafti ekziston, çdo ndryshim fushe (përfshi pyetjet
  // shtesë) ruhet (i vonuar).
  useEffect(() => {
    if (applicationId && resumeToken) scheduleSave(form, customAnswers, applicationId, resumeToken);
  }, [form, customAnswers, applicationId, resumeToken, scheduleSave]);

  function setCustomAnswer(fieldId: number, value: string) {
    setCustomAnswers(prev => ({ ...prev, [String(fieldId)]: value }));
  }

  async function ensureDraft(): Promise<{ id: number; resumeToken: string } | null> {
    if (applicationId && resumeToken) return { id: applicationId, resumeToken };
    if (draftCreating.current) return null;
    draftCreating.current = true;
    try {
      const r = await fetch("/api/public/enrollment/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, website: honeypot }),
      });
      const data = await r.json();
      if (!r.ok) { setStepError(data.message || "Diçka shkoi keq."); return null; }
      setApplicationId(data.id);
      setResumeToken(data.resumeToken);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ id: data.id, resumeToken: data.resumeToken }));
      return data;
    } finally {
      draftCreating.current = false;
    }
  }

  function validateStep(i: number): string | null {
    if (i === 0) {
      if (!form.firstName || !form.lastName || !form.birthDate || !form.gender || !form.personalNumber) return "Plotëso emrin, mbiemrin, datëlindjen, gjininë dhe numrin personal.";
    }
    if (i === 1) {
      if (!form.desiredGrade || !form.schoolYear) return "Zgjidh klasën dhe vitin shkollor.";
      const grade = config?.grades.find(g => String(g.grade) === form.desiredGrade);
      if (grade?.isFull && !form.waitlisted) return "Kjo klasë s'ka vende të lira — prano listën e pritjes për të vazhduar, ose zgjidh një klasë tjetër.";
    }
    if (i === 2) {
      if (!form.motherName || !form.motherPhone) return "Emri dhe telefoni i nënës janë të domosdoshëm.";
      if (!form.fatherName || !form.fatherPhone) return "Emri dhe telefoni i babait janë të domosdoshëm.";
      if (!form.primaryContact) return "Zgjidh kush është kontakti kryesor.";
      if (form.primaryContact === "OTHER" && (!form.guardianOtherName || !form.guardianOtherPhone)) return "Emri dhe telefoni i kujdestarit janë të domosdoshëm.";
    }
    return null;
  }

  async function goNext() {
    const err = validateStep(step);
    if (err) { setStepError(err); return; }
    setStepError(null);

    if (step === 0) {
      const draft = await ensureDraft();
      if (!draft) return;
    }
    setStep(s => Math.min(s + 1, STEP_LABELS.length - 1));
  }

  function goBack() {
    setStepError(null);
    setStep(s => Math.max(s - 1, 0));
  }

  async function handleSubmit() {
    if (!applicationId || !resumeToken) return;
    setSubmitting(true);
    setSubmitError(null);
    setMissing(null);
    try {
      const r = await fetch(`/api/public/enrollment/applications/${applicationId}/submit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resumeToken }),
      });
      if (r.status === 403) { setSubmitting(false); handleExpired(); return; }
      const data = await r.json();
      if (!r.ok) {
        setSubmitError(data.message || "Dorëzimi dështoi.");
        setMissing(data.missing ?? null);
      } else {
        localStorage.removeItem(STORAGE_KEY);
        setReferenceNumber(data.referenceNumber);
      }
    } catch {
      setSubmitError("Dorëzimi dështoi — kontrollo lidhjen e internetit.");
    }
    setSubmitting(false);
  }

  function startOver() {
    localStorage.removeItem(STORAGE_KEY);
    setApplicationId(null);
    setResumeToken(null);
    setDocuments([]);
    setForm(f => ({ ...EMPTY_FORM, schoolYear: config?.defaultSchoolYear ?? f.schoolYear }));
    setCustomAnswers({});
    setStep(0);
    setResumedBanner(false);
  }

  // Aplikimi/token-i s'ekziston më në server (fshirë, ose sesion i vjetëruar)
  // — s'ka kuptim të vazhdojmë të fshehtazi; njoftojmë qartë dhe fillojmë të re.
  function handleExpired() {
    alert("Aplikimi juaj nuk u gjet më në sistem — mund të ketë skaduar. Ju lutem filloni një aplikim të ri.");
    startOver();
  }

  if (!config) {
    return <div className="card p-8 text-center text-slate-400 text-sm">Duke ngarkuar formularin...</div>;
  }

  if (!config.enrollmentOpen) {
    return (
      <div className="card p-8 text-center space-y-2">
        <p className="text-lg font-semibold text-slate-800 dark:text-white">Aplikimet janë të mbyllura momentalisht</p>
        <p className="text-sm text-slate-400">Aplikimet për vitin e ri shkollor do të hapen sërish në prill/maj. Ju lutem kontrolloni më vonë.</p>
      </div>
    );
  }

  if (referenceNumber) {
    return (
      <div className="card p-8 text-center space-y-3">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
        <p className="text-lg font-semibold text-slate-800 dark:text-white">Aplikimi u pranua!</p>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Numri i referencës: <strong className="text-slate-700 dark:text-slate-200">{referenceNumber}</strong>
        </p>
        <p className="text-sm text-slate-400">Administrata do t&apos;ju kontaktojë sapo aplikimi të shqyrtohet.</p>
      </div>
    );
  }

  const selectedGrade = config.grades.find(g => String(g.grade) === form.desiredGrade);
  const gradeNumber = form.desiredGrade ? parseInt(form.desiredGrade, 10) : null;

  return (
    <div className="space-y-5">
      {resumedBanner && (
        <div className="flex items-center justify-between gap-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm text-blue-700 dark:text-blue-400">
          <span>Aplikimi juaj i papërfunduar u rikthye.</span>
          <button type="button" onClick={startOver} className="flex items-center gap-1 text-xs font-medium hover:underline shrink-0">
            <RotateCcw className="w-3.5 h-3.5" /> Fillo nga e para
          </button>
        </div>
      )}

      {/* Honeypot — i fshehur, njerëzit s'e shohin/plotësojnë kurrë */}
      <input
        type="text" name="website" value={honeypot} onChange={e => setHoneypot(e.target.value)}
        className="hidden" tabIndex={-1} autoComplete="off"
      />

      {/* Treguesi i hapave */}
      <div className="flex items-center justify-center gap-1 flex-wrap">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-1">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
              i === step ? "bg-primary-600 text-white" : i < step ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-slate-100 dark:bg-slate-700 text-slate-400"
            }`}>
              {i + 1}
            </div>
            <span className={`hidden sm:inline text-xs ${i === step ? "text-slate-700 dark:text-slate-200 font-medium" : "text-slate-400"}`}>{label}</span>
            {i < STEP_LABELS.length - 1 && <div className="w-4 sm:w-6 h-px bg-slate-200 dark:bg-slate-700 mx-1" />}
          </div>
        ))}
      </div>

      <div className="card p-5">
        {step === 0 && <StudentInfoStep form={form} set={set} config={config} />}
        {step === 1 && <SchoolInfoStep form={form} set={set} config={config} />}
        {step === 2 && <ParentsStep form={form} set={set} config={config} />}
        {step === 3 && <ContactAddressStep form={form} set={set} config={config} />}
        {step === 4 && (
          <DocumentsStep
            applicationId={applicationId}
            resumeToken={resumeToken}
            gradeNumber={gradeNumber}
            documents={documents}
            setDocuments={setDocuments}
            onExpired={handleExpired}
          />
        )}
        {hasCustomStep && step === CUSTOM_STEP_INDEX && (
          <CustomFieldsStep fields={config.customFields} answers={customAnswers} setAnswer={setCustomAnswer} />
        )}
        {step === REVIEW_STEP_INDEX && (
          <ReviewSubmitStep
            form={form}
            set={set}
            selectedGrade={selectedGrade}
            documents={documents}
            submitting={submitting}
            submitError={submitError}
            missing={missing}
            onSubmit={handleSubmit}
          />
        )}

        {stepError && <p className="text-sm text-red-500 mt-4">{stepError}</p>}

        {step < STEP_LABELS.length - 1 && (
          <div className="flex items-center justify-between mt-5 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button type="button" onClick={goBack} disabled={step === 0} className="btn-secondary disabled:opacity-0">
              <ChevronLeft className="w-4 h-4" /> Prapa
            </button>
            <button type="button" onClick={goNext} className="btn-primary">
              Vazhdo <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
        {step === STEP_LABELS.length - 1 && (
          <div className="flex items-center mt-5 pt-4 border-t border-slate-100 dark:border-slate-700">
            <button type="button" onClick={goBack} className="btn-secondary">
              <ChevronLeft className="w-4 h-4" /> Prapa
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
