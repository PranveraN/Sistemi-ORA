"use client";

import { TextField, DateField } from "../FormField";
import type { ApplicationFormState, FieldSetter } from "../types";

export default function ParentsStep({ form, set }: { form: ApplicationFormState; set: FieldSetter }) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-pink-500 uppercase tracking-wider">Të Dhënat e Nënës</h3>
        <TextField label="Emri dhe Mbiemri" required value={form.motherName} onChange={v => set("motherName", v)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DateField label="Datëlindja" value={form.motherBirth} onChange={v => set("motherBirth", v)} />
          <TextField label="Profesioni" value={form.motherProf} onChange={v => set("motherProf", v)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="Telefoni" required value={form.motherPhone} onChange={v => set("motherPhone", v)} placeholder="+383 XX XXX XXX" />
          <TextField label="E-mail" type="email" value={form.motherEmail} onChange={v => set("motherEmail", v)} />
        </div>
        <TextField label="Adresa" value={form.motherAddress} onChange={v => set("motherAddress", v)} placeholder="nëse është ndryshe nga adresa e nxënësit" />
      </div>

      <div className="space-y-4 border-t border-slate-100 dark:border-slate-700 pt-5">
        <h3 className="text-xs font-semibold text-blue-500 uppercase tracking-wider">Të Dhënat e Babait</h3>
        <TextField label="Emri dhe Mbiemri" required value={form.fatherName} onChange={v => set("fatherName", v)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <DateField label="Datëlindja" value={form.fatherBirth} onChange={v => set("fatherBirth", v)} />
          <TextField label="Profesioni" value={form.fatherProf} onChange={v => set("fatherProf", v)} />
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="Telefoni" required value={form.fatherPhone} onChange={v => set("fatherPhone", v)} placeholder="+383 XX XXX XXX" />
          <TextField label="E-mail" type="email" value={form.fatherEmail} onChange={v => set("fatherEmail", v)} />
        </div>
        <TextField label="Adresa" value={form.fatherAddress} onChange={v => set("fatherAddress", v)} placeholder="nëse është ndryshe nga adresa e nxënësit" />
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
            <TextField label="Lidhja me Nxënësin" value={form.guardianOtherRelation} onChange={v => set("guardianOtherRelation", v)} placeholder="p.sh. Gjyshja, Xhaxhai..." />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <TextField label="Telefoni" required value={form.guardianOtherPhone} onChange={v => set("guardianOtherPhone", v)} placeholder="+383 XX XXX XXX" />
              <TextField label="E-mail" type="email" value={form.guardianOtherEmail} onChange={v => set("guardianOtherEmail", v)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
