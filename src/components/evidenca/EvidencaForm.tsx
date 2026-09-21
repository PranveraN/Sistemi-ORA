"use client";

import { TextField, TextAreaField } from "@/components/enrollment/FormField";
import { RATING_SCALE, specifyKey } from "@/lib/evidencaConfig";

export interface EvidencaItemDef {
  id: number;
  label: string;
  type: "RATING" | "YES_NO" | "CHOICE" | "TEXT" | "TEXTAREA";
  options: string[] | null;
  hasSpecify: boolean;
}
export interface EvidencaCategoryDef {
  id: number;
  label: string;
  items: EvidencaItemDef[];
}
export interface EvidencaConfig {
  skills: EvidencaCategoryDef[];
  general: EvidencaItemDef[];
}

export default function EvidencaForm({ config, answers, setAnswer }: {
  config: EvidencaConfig;
  answers: Record<string, string>;
  setAnswer: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-6">
      {config.skills.length > 0 && (
        <div className="space-y-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Vlerësimi i Aftësive</h3>
          {config.skills.map(cat => (
            <div key={cat.id} className="space-y-2">
              <h4 className="text-sm font-bold text-slate-700 dark:text-slate-200">{cat.label}</h4>
              <div className="space-y-1.5">
                {cat.items.map(item => (
                  <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 py-1.5 border-b border-slate-50 dark:border-slate-800 last:border-0">
                    <span className="text-sm text-slate-600 dark:text-slate-300">{item.label}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      {RATING_SCALE.map(s => (
                        <label key={s.value} className="flex items-center gap-1 text-xs text-slate-400 cursor-pointer" title={s.label}>
                          <input type="radio" name={`item-${item.id}`} checked={answers[String(item.id)] === s.value} onChange={() => setAnswer(String(item.id), s.value)} />
                          {s.value}%
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {config.general.length > 0 && (
        <div className="space-y-4 border-t border-slate-100 dark:border-slate-700 pt-5">
          <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Pyetësori Shëndetësor & Logjistik</h3>
          {config.general.map(item => (
            <GeneralItem key={item.id} item={item} answers={answers} setAnswer={setAnswer} />
          ))}
        </div>
      )}

      {config.skills.length === 0 && config.general.length === 0 && (
        <p className="text-sm text-slate-400 text-center py-6">
          Asnjë pyetje e konfiguruar ende — shtoni te Cilësimet → "Evidenca e Regjistrimit".
        </p>
      )}
    </div>
  );
}

function GeneralItem({ item, answers, setAnswer }: { item: EvidencaItemDef; answers: Record<string, string>; setAnswer: (key: string, value: string) => void }) {
  const value = answers[String(item.id)] ?? "";

  if (item.type === "YES_NO") {
    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-slate-600 dark:text-slate-300">{item.label}</span>
          <div className="flex items-center gap-4 shrink-0">
            {(["PO", "JO"] as const).map(v => (
              <label key={v} className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 cursor-pointer">
                <input type="radio" name={`item-${item.id}`} checked={value === v} onChange={() => setAnswer(String(item.id), v)} />
                {v === "PO" ? "Po" : "Jo"}
              </label>
            ))}
          </div>
        </div>
        {item.hasSpecify && value === "PO" && (
          <TextField label="Specifikoni" value={answers[specifyKey(item.id)] ?? ""} onChange={v => setAnswer(specifyKey(item.id), v)} />
        )}
      </div>
    );
  }

  if (item.type === "CHOICE") {
    return (
      <div className="space-y-1.5">
        <span className="text-sm text-slate-600 dark:text-slate-300">{item.label}</span>
        <div className="flex flex-wrap gap-4">
          {(item.options ?? []).map(o => (
            <label key={o} className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-slate-400 cursor-pointer">
              <input type="radio" name={`item-${item.id}`} checked={value === o} onChange={() => setAnswer(String(item.id), o)} />
              {o}
            </label>
          ))}
        </div>
      </div>
    );
  }

  if (item.type === "TEXTAREA") {
    return <TextAreaField label={item.label} value={value} onChange={v => setAnswer(String(item.id), v)} />;
  }

  return <TextField label={item.label} value={value} onChange={v => setAnswer(String(item.id), v)} />;
}
