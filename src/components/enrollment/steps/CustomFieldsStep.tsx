"use client";

import { TextField, TextAreaField, SelectField } from "../FormField";
import type { ConfigCustomField } from "../types";

interface Props {
  fields: ConfigCustomField[];
  answers: Record<string, string>;
  setAnswer: (fieldId: number, value: string) => void;
}

export default function CustomFieldsStep({ fields, answers, setAnswer }: Props) {
  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-400">Pyetje shtesë nga shkolla.</p>
      {fields.map(f => {
        const value = answers[String(f.id)] ?? "";
        if (f.type === "TEXTAREA") {
          return <TextAreaField key={f.id} label={f.label} required={f.required} value={value} onChange={v => setAnswer(f.id, v)} />;
        }
        if (f.type === "SELECT") {
          return (
            <SelectField
              key={f.id} label={f.label} required={f.required} value={value} onChange={v => setAnswer(f.id, v)}
              options={(f.options ?? []).map(o => ({ value: o, label: o }))}
            />
          );
        }
        if (f.type === "CHECKBOX") {
          return (
            <label key={f.id} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={value === "true"} onChange={e => setAnswer(f.id, e.target.checked ? "true" : "false")} />
              {f.label}{f.required && <span className="text-red-500"> *</span>}
            </label>
          );
        }
        return (
          <TextField
            key={f.id} label={f.label} required={f.required} value={value} onChange={v => setAnswer(f.id, v)}
            type={f.type === "NUMBER" ? "number" : "text"}
          />
        );
      })}
    </div>
  );
}
