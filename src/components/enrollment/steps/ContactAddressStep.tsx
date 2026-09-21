"use client";

import { TextField, TextAreaField } from "../FormField";
import { fieldVisible, fieldRequired, type ApplicationFormState, type EnrollmentConfig, type FieldSetter } from "../types";

export default function ContactAddressStep({ form, set, config }: { form: ApplicationFormState; set: FieldSetter; config: EnrollmentConfig | null }) {
  return (
    <div className="space-y-6">
      {fieldVisible(config, "country") && (
        <div className="space-y-4">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Adresa</h3>
          <TextField label="Vendi i Banimit" required={fieldRequired(config, "country")} value={form.country} onChange={v => set("country", v)} placeholder="p.sh. Kosovë" />
        </div>
      )}

      {(fieldVisible(config, "emergencyContactName") || fieldVisible(config, "emergencyContactRelation") || fieldVisible(config, "emergencyContactPhone")) && (
        <div className="space-y-4 border-t border-slate-100 dark:border-slate-700 pt-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Kontakti Emergjent</h3>
          {fieldVisible(config, "emergencyContactName") && (
            <TextField label="Emri dhe Mbiemri" required={fieldRequired(config, "emergencyContactName")} value={form.emergencyContactName} onChange={v => set("emergencyContactName", v)} />
          )}
          {(fieldVisible(config, "emergencyContactRelation") || fieldVisible(config, "emergencyContactPhone")) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {fieldVisible(config, "emergencyContactRelation") && (
                <TextField label="Lidhja me Nxënësin" required={fieldRequired(config, "emergencyContactRelation")} value={form.emergencyContactRelation} onChange={v => set("emergencyContactRelation", v)} />
              )}
              {fieldVisible(config, "emergencyContactPhone") && (
                <TextField label="Telefoni" required={fieldRequired(config, "emergencyContactPhone")} value={form.emergencyContactPhone} onChange={v => set("emergencyContactPhone", v)} placeholder="+383 XX XXX XXX" />
              )}
            </div>
          )}
        </div>
      )}

      {fieldVisible(config, "additionalInfo") && (
        <div className="border-t border-slate-100 dark:border-slate-700 pt-5">
          <TextAreaField label="Informacion Shtesë" required={fieldRequired(config, "additionalInfo")} value={form.additionalInfo} onChange={v => set("additionalInfo", v)} placeholder="Çdo gjë tjetër që dëshironi ta dijë shkolla" rows={4} />
        </div>
      )}
    </div>
  );
}
