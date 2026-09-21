"use client";

import { TextField, DateField } from "../FormField";
import { fieldVisible, fieldRequired, type ApplicationFormState, type EnrollmentConfig, type FieldSetter } from "../types";

export default function ParentsStep({ form, set, config }: { form: ApplicationFormState; set: FieldSetter; config: EnrollmentConfig | null }) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-pink-500 uppercase tracking-wider">Të Dhënat e Nënës</h3>
        <TextField label="Emri dhe Mbiemri" required value={form.motherName} onChange={v => set("motherName", v)} />
        {(fieldVisible(config, "motherBirth") || fieldVisible(config, "motherProf")) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fieldVisible(config, "motherBirth") && <DateField label="Datëlindja" required={fieldRequired(config, "motherBirth")} value={form.motherBirth} onChange={v => set("motherBirth", v)} />}
            {fieldVisible(config, "motherProf") && <TextField label="Profesioni" required={fieldRequired(config, "motherProf")} value={form.motherProf} onChange={v => set("motherProf", v)} />}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="Telefoni" required value={form.motherPhone} onChange={v => set("motherPhone", v)} placeholder="+383 XX XXX XXX" />
          {fieldVisible(config, "motherEmail") && <TextField label="E-mail" type="email" required={fieldRequired(config, "motherEmail")} value={form.motherEmail} onChange={v => set("motherEmail", v)} />}
        </div>
        {fieldVisible(config, "motherAddress") && (
          <TextField label="Adresa" required={fieldRequired(config, "motherAddress")} value={form.motherAddress} onChange={v => set("motherAddress", v)} placeholder="nëse është ndryshe nga adresa e nxënësit" />
        )}
      </div>

      <div className="space-y-4 border-t border-slate-100 dark:border-slate-700 pt-5">
        <h3 className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Të Dhënat e Babait</h3>
        <TextField label="Emri dhe Mbiemri" required value={form.fatherName} onChange={v => set("fatherName", v)} />
        {(fieldVisible(config, "fatherBirth") || fieldVisible(config, "fatherProf")) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {fieldVisible(config, "fatherBirth") && <DateField label="Datëlindja" required={fieldRequired(config, "fatherBirth")} value={form.fatherBirth} onChange={v => set("fatherBirth", v)} />}
            {fieldVisible(config, "fatherProf") && <TextField label="Profesioni" required={fieldRequired(config, "fatherProf")} value={form.fatherProf} onChange={v => set("fatherProf", v)} />}
          </div>
        )}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="Telefoni" required value={form.fatherPhone} onChange={v => set("fatherPhone", v)} placeholder="+383 XX XXX XXX" />
          {fieldVisible(config, "fatherEmail") && <TextField label="E-mail" type="email" required={fieldRequired(config, "fatherEmail")} value={form.fatherEmail} onChange={v => set("fatherEmail", v)} />}
        </div>
        {fieldVisible(config, "fatherAddress") && (
          <TextField label="Adresa" required={fieldRequired(config, "fatherAddress")} value={form.fatherAddress} onChange={v => set("fatherAddress", v)} placeholder="nëse është ndryshe nga adresa e nxënësit" />
        )}
      </div>

      <div className="space-y-3 border-t border-slate-100 dark:border-slate-700 pt-5">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Kujdestari / Kontakti Kryesor</h3>
        <p className="text-xs text-slate-400">Kush duhet ta kontaktojë shkolla si person kryesor?</p>
        <div className="flex flex-wrap gap-4">
          {([["MOTHER", "Nëna"], ["FATHER", "Babai"], ["OTHER", "Kujdestar tjetër"]] as const).map(([val, lbl]) => (
            <label key={val} className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="radio" name="primaryContact" checked={form.primaryContact === val} onChange={() => set("primaryContact", val)} />
              {lbl}
            </label>
          ))}
        </div>

        {form.primaryContact === "OTHER" && (
          <div className="space-y-4 pt-2">
            <TextField label="Emri dhe Mbiemri" required value={form.guardianOtherName} onChange={v => set("guardianOtherName", v)} />
            {fieldVisible(config, "guardianOtherRelation") && (
              <TextField label="Lidhja me Nxënësin" required={fieldRequired(config, "guardianOtherRelation")} value={form.guardianOtherRelation} onChange={v => set("guardianOtherRelation", v)} placeholder="p.sh. Gjyshja, Xhaxhai..." />
            )}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField label="Telefoni" required value={form.guardianOtherPhone} onChange={v => set("guardianOtherPhone", v)} placeholder="+383 XX XXX XXX" />
              {fieldVisible(config, "guardianOtherEmail") && (
                <TextField label="E-mail" type="email" required={fieldRequired(config, "guardianOtherEmail")} value={form.guardianOtherEmail} onChange={v => set("guardianOtherEmail", v)} />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
