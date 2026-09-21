"use client";

import { useEffect, useState } from "react";

// Fusha të thjeshta, ripërdorura nëpër hapat e aplikimit — të njëjtat klasa
// globale (.form-input/.form-label) si pjesa tjetër e Akademia Ora, thjesht
// të mbështjellura këtu që të mos përsëriten nëpër çdo hap.

export function TextField({ label, required, value, onChange, placeholder, type = "text" }: {
  label: string; required?: boolean; value: string; onChange: (v: string) => void; placeholder?: string; type?: string;
}) {
  return (
    <div>
      <label className="form-label">{label}{required && <span className="text-red-500"> *</span>}</label>
      <input
        type={type}
        className="form-input"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}

// ISO YYYY-MM-DD (ruajtja) <-> DD/MM/YYYY (shfaqja) — vetëm tekst, jo
// <input type="date">, që formati të mos varet nga "locale"-i i browser-it
// të prindit (i njëjti model si DateField te StudentForm.tsx).
function isoToDisplay(iso: string): string {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }
  return iso;
}

function displayToIso(val: string): string {
  const clean = val.replace(/\s/g, "");
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split("/");
    return `${y}-${m}-${d}`;
  }
  return val;
}

export function DateField({ label, required, value, onChange }: {
  label: string; required?: boolean; value: string; onChange: (v: string) => void;
}) {
  const [raw, setRaw] = useState(() => isoToDisplay(value));
  useEffect(() => { setRaw(isoToDisplay(value)); }, [value]);

  function handleChange(v: string) {
    setRaw(v);
    onChange(displayToIso(v));
  }

  function handleBlur() {
    const digits = raw.replace(/\D/g, "");
    if (digits.length === 8) {
      const formatted = `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4, 8)}`;
      setRaw(formatted);
      onChange(displayToIso(formatted));
    }
  }

  return (
    <div>
      <label className="form-label">{label}{required && <span className="text-red-500"> *</span>}</label>
      <input
        type="text"
        className="form-input"
        value={raw}
        onChange={e => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder="DD/MM/VVVV"
        required={required}
      />
    </div>
  );
}

export function SelectField({ label, required, value, onChange, options, placeholder }: {
  label: string; required?: boolean; value: string; onChange: (v: string) => void;
  options: { value: string; label: string }[]; placeholder?: string;
}) {
  return (
    <div>
      <label className="form-label">{label}{required && <span className="text-red-500"> *</span>}</label>
      <select className="form-input" value={value} onChange={e => onChange(e.target.value)} required={required}>
        <option value="">{placeholder ?? "— Zgjidh —"}</option>
        {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    </div>
  );
}

export function TextAreaField({ label, required, value, onChange, placeholder, rows = 3 }: {
  label: string; required?: boolean; value: string; onChange: (v: string) => void; placeholder?: string; rows?: number;
}) {
  return (
    <div>
      <label className="form-label">{label}{required && <span className="text-red-500"> *</span>}</label>
      <textarea
        className="form-input"
        rows={rows}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
      />
    </div>
  );
}
