"use client";

import { AlertTriangle } from "lucide-react";
import { TextField, DateField, SelectField, TextAreaField } from "../FormField";
import type { ApplicationFormState, ConfigGrade, FieldSetter, EnrollmentConfig } from "../types";

export default function SchoolInfoStep({ form, set, config }: { form: ApplicationFormState; set: FieldSetter; config: EnrollmentConfig }) {
  const selectedGrade: ConfigGrade | undefined = config.grades.find(g => String(g.grade) === form.desiredGrade);
  // Klasa 2+ nënkupton vazhdimësi/transferim nga një klasë paraardhëse — për
  // Klasën 1 s'ka kuptim as "klasa e fundit e përfunduar" as "arsyeja e transferimit".
  const isFirstGrade = form.desiredGrade === "1";

  function onGradeChange(v: string) {
    set("desiredGrade", v);
    set("waitlisted", false);
    if (v === "1") {
      set("lastCompletedGrade", "");
      set("applicationReason", "");
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SelectField
          label="Klasa për të cilën Aplikohet" required value={form.desiredGrade} onChange={onGradeChange}
          options={config.grades.map(g => ({ value: String(g.grade), label: g.isFull ? `${g.label} — plot` : g.label }))}
        />
        <SelectField
          label="Viti Shkollor" required value={form.schoolYear} onChange={v => set("schoolYear", v)}
          options={config.schoolYears}
        />
      </div>

      {selectedGrade?.isFull && (
        <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-700 dark:text-amber-400" />
            <p className="text-sm text-amber-700 dark:text-amber-400">
              Momentalisht nuk ka vende të lira në <strong>{selectedGrade.label}</strong>. Dëshironi të vazhdoni aplikimin që të prisni në listën e pritjes derisa të lirohet një vend?
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400 cursor-pointer">
            <input type="checkbox" checked={form.waitlisted} onChange={e => set("waitlisted", e.target.checked)} />
            Po, dua të vazhdoj dhe të pres në listën e pritjes.
          </label>
        </div>
      )}

      <TextField
        label={isFirstGrade ? "Shkolla / Çerdhja e Mëparshme" : "Shkolla e Mëparshme"}
        value={form.previousSchool}
        onChange={v => set("previousSchool", v)}
        placeholder={isFirstGrade ? "p.sh. Çerdhja Diellza (nëse ka)" : undefined}
      />
      {!isFirstGrade && (
        <TextField label="Klasa e Fundit e Përfunduar" value={form.lastCompletedGrade} onChange={v => set("lastCompletedGrade", v)} placeholder="nëse aplikohet" />
      )}
      <DateField label="Data e Dëshiruar e Fillimit" value={form.desiredStartDate} onChange={v => set("desiredStartDate", v)} />
      {!isFirstGrade && (
        <TextAreaField label="Arsyeja e Aplikimit / Transferimit" value={form.applicationReason} onChange={v => set("applicationReason", v)} placeholder="vetëm nëse aplikohet" />
      )}
    </div>
  );
}
