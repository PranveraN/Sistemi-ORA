"use client";

import { useState } from "react";
import { TextField, DateField, SelectField } from "../FormField";
import { DIASPORA_COUNTRIES } from "../countries";
import type { ApplicationFormState, FieldSetter } from "../types";

const OTHER_VALUE = "__OTHER__";
const KNOWN_COUNTRIES = new Set(DIASPORA_COUNTRIES.flatMap(g => g.countries));

export default function StudentInfoStep({ form, set }: { form: ApplicationFormState; set: FieldSetter }) {
  // Nëse originCountry tashmë ka një vlerë "e panjohur" (jo nga lista), do
  // të thotë se prindi ka shkruar vetë emrin e vendit më parë (p.sh. pas
  // rifreskimit të faqes) — ruaje modalitetin "shkruaj vetë" të hapur.
  const [manualEntry, setManualEntry] = useState(
    () => !!form.originCountry && !KNOWN_COUNTRIES.has(form.originCountry)
  );
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField label="Emri" required value={form.firstName} onChange={v => set("firstName", v)} />
        <TextField label="Mbiemri" required value={form.lastName} onChange={v => set("lastName", v)} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <DateField label="Datëlindja" required value={form.birthDate} onChange={v => set("birthDate", v)} />
        <SelectField
          label="Gjinia" required value={form.gender} onChange={v => set("gender", v)}
          options={[{ value: "Mashkull", label: "Mashkull" }, { value: "Femër", label: "Femër" }]}
        />
      </div>
      <TextField label="Numri Personal" required value={form.personalNumber} onChange={v => set("personalNumber", v)} />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <TextField label="Shtetësia" value={form.citizenship} onChange={v => set("citizenship", v)} placeholder="p.sh. Kosovare" />
        <TextField label="Vendi i Lindjes" value={form.birthCountry} onChange={v => set("birthCountry", v)} placeholder="p.sh. Prishtinë, Kosovë" />
      </div>

      <div>
        <label className="form-label">Vendi i Origjinës</label>
        <div className="flex items-center gap-4 mb-2">
          {([["KOSOVE", "Kosovë"], ["DIASPORA", "Diasporë"]] as const).map(([val, lbl]) => (
            <label key={val} className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
              <input
                type="radio"
                name="originType"
                checked={form.originType === val}
                onChange={() => set("originType", val)}
              />
              {lbl}
            </label>
          ))}
        </div>
        {form.originType === "DIASPORA" && !manualEntry && (
          <select
            className="form-input"
            value={form.originCountry}
            onChange={e => {
              if (e.target.value === OTHER_VALUE) { setManualEntry(true); set("originCountry", ""); }
              else set("originCountry", e.target.value);
            }}
          >
            <option value="">— Zgjidh vendin —</option>
            {DIASPORA_COUNTRIES.map(g => (
              <optgroup key={g.group} label={g.group}>
                {g.countries.map(c => <option key={c} value={c}>{c}</option>)}
              </optgroup>
            ))}
            <option value={OTHER_VALUE}>Vend tjetër — shkruaj vetë</option>
          </select>
        )}
        {form.originType === "DIASPORA" && manualEntry && (
          <div className="flex items-center gap-2">
            <input
              className="form-input"
              placeholder="Shkruaj emrin e vendit"
              value={form.originCountry}
              onChange={e => set("originCountry", e.target.value)}
              autoFocus
            />
            <button
              type="button"
              onClick={() => { setManualEntry(false); set("originCountry", ""); }}
              className="text-xs text-primary-600 hover:underline whitespace-nowrap shrink-0"
            >
              Zgjidh nga lista
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
