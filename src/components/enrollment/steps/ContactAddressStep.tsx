"use client";

import { TextField, TextAreaField } from "../FormField";
import type { ApplicationFormState, FieldSetter } from "../types";

export default function ContactAddressStep({ form, set }: { form: ApplicationFormState; set: FieldSetter }) {
  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Adresa</h3>
        <TextField label="Vendi i Banimit" value={form.country} onChange={v => set("country", v)} placeholder="p.sh. Kosovë" />
      </div>

      <div className="space-y-4 border-t border-slate-100 dark:border-slate-700 pt-5">
        <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Kontakti Emergjent</h3>
        <TextField label="Emri dhe Mbiemri" value={form.emergencyContactName} onChange={v => set("emergencyContactName", v)} />
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <TextField label="Lidhja me Nxënësin" value={form.emergencyContactRelation} onChange={v => set("emergencyContactRelation", v)} />
          <TextField label="Telefoni" value={form.emergencyContactPhone} onChange={v => set("emergencyContactPhone", v)} placeholder="+383 XX XXX XXX" />
        </div>
      </div>

      <div className="border-t border-slate-100 dark:border-slate-700 pt-5">
        <TextAreaField label="Informacion Shtesë" value={form.additionalInfo} onChange={v => set("additionalInfo", v)} placeholder="Çdo gjë tjetër që dëshironi ta dijë shkolla" rows={4} />
      </div>
    </div>
  );
}
