"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, X } from "lucide-react";

interface Class { id: number; name: string; level: string }

interface StudentFormData {
  firstName: string;
  lastName: string;
  birthDate: string;
  personalNumber: string;
  motherNumber: string;
  diaryNumber: string;
  address: string;
  guardian: string;
  // Mother
  motherName: string;
  motherBirth: string;
  motherProf: string;
  motherPhone: string;
  motherEmail: string;
  // Father
  fatherName: string;
  fatherBirth: string;
  fatherProf: string;
  fatherPhone: string;
  fatherEmail: string;
  // School
  classId: string;
  status: string;
  notes: string;
}

interface Props {
  initial?: Partial<StudentFormData>;
  studentId?: number;
}

const empty: StudentFormData = {
  firstName: "", lastName: "", birthDate: "", personalNumber: "",
  motherNumber: "", diaryNumber: "", address: "", guardian: "",
  motherName: "", motherBirth: "", motherProf: "", motherPhone: "", motherEmail: "",
  fatherName: "", fatherBirth: "", fatherProf: "", fatherPhone: "", fatherEmail: "",
  classId: "", status: "ACTIVE", notes: "",
};

function Field({ label, type = "text", required = false, placeholder = "", value, onChange }: {
  label: string; type?: string; required?: boolean; placeholder?: string;
  value: string; onChange: (v: string) => void;
}) {
  return (
    <div>
      <label className="form-label">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)}
        className="form-input" placeholder={placeholder} required={required} />
    </div>
  );
}

// Konverton YYYY-MM-DD → DD/MM/YYYY për display
function isoToDisplay(iso: string): string {
  if (!iso) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(iso)) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }
  return iso;
}

// Konverton DD/MM/YYYY (ose DD.MM.YYYY, për input të vjetër) → YYYY-MM-DD për ruajtje
function displayToIso(val: string): string {
  const clean = val.replace(/\s/g, "");
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split(".");
    return `${y}-${m}-${d}`;
  }
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(clean)) {
    const [d, m, y] = clean.split("/");
    return `${y}-${m}-${d}`;
  }
  return val;
}

function DateField({ label, required = false, value, onChange }: {
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
      const formatted = `${digits.slice(0,2)}/${digits.slice(2,4)}/${digits.slice(4,8)}`;
      setRaw(formatted);
      onChange(displayToIso(formatted));
    }
  }

  return (
    <div>
      <label className="form-label">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        type="text"
        value={raw}
        onChange={e => handleChange(e.target.value)}
        onBlur={handleBlur}
        placeholder="DD/MM/VVVV"
        className="form-input"
      />
    </div>
  );
}

export default function StudentForm({ initial, studentId }: Props) {
  const router = useRouter();
  const [form, setForm] = useState<StudentFormData>({ ...empty, ...initial });
  const [classes, setClasses] = useState<Class[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/classes").then(r => r.json()).then(setClasses);
  }, []);

  function set(field: keyof StudentFormData, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  // Detektim i llojit të vlerës
  function looksLikeDate(v: string)    { return /^\d{1,2}[\/\.\-]\d{1,2}[\/\.\-]\d{2,4}$/.test(v.trim()) || /^\d{4}-\d{2}-\d{2}$/.test(v.trim()); }
  function looksLikePhone(v: string)   { return /^[\+\d\s\-\(\)]{6,}$/.test(v.trim()) && /\d{5,}/.test(v); }
  function looksLikeEmail(v: string)   { return /@/.test(v); }
  function looksLikeAddress(v: string) { return /rrug|lagj|rrug|bulevard|sheshi|nr\.|pallat/i.test(v); }

  function autoFixParent(prefix: "father" | "mother") {
    setForm(prev => {
      const f = { ...prev };
      const name  = f[`${prefix}Name`  as keyof StudentFormData] as string;
      const birth = f[`${prefix}Birth` as keyof StudentFormData] as string;
      const prof  = f[`${prefix}Prof`  as keyof StudentFormData] as string;
      const phone = f[`${prefix}Phone` as keyof StudentFormData] as string;
      const email = f[`${prefix}Email` as keyof StudentFormData] as string;

      let newName  = name, newBirth = birth, newProf = prof, newPhone = phone, newEmail = email;

      // Nëse telefoni ka datë dhe datëlindja është bosh/gabim
      if (looksLikeDate(phone) && !looksLikeDate(birth)) {
        newBirth = phone;
        newPhone = birth || ""; // bosh ose datën e vjetër
      }

      // Nëse profesioni ka adresë
      if (looksLikeAddress(prof)) {
        if (!f.address) f.address = prof;
        newProf = email || ""; // profesioni ishte në email?
        if (!looksLikeEmail(email)) newEmail = "";
      }

      // Nëse email ka profesion (jo format email)
      if (!looksLikeEmail(email) && email && !looksLikeDate(email) && !looksLikePhone(email)) {
        if (!newProf || looksLikeAddress(newProf)) {
          newProf  = email;
          newEmail = "";
        }
      }

      // Nëse emri ka adresë
      if (looksLikeAddress(name)) {
        if (!f.address) f.address = name;
        newName = "";
      }

      return {
        ...f,
        [`${prefix}Name`]:  newName,
        [`${prefix}Birth`]: newBirth,
        [`${prefix}Prof`]:  newProf,
        [`${prefix}Phone`]: newPhone,
        [`${prefix}Email`]: newEmail,
      } as StudentFormData;
    });
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const url = studentId ? `/api/students/${studentId}` : "/api/students";
    const method = studentId ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setLoading(false);

    if (res.ok) {
      const data = await res.json();
      router.push(`/students/${data.id}`);
      router.refresh();
    } else {
      const err = await res.json();
      setError(err.message || "Ndodhi një gabim. Provoni sërish.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Personal Info */}
      <div className="card p-5 space-y-4">
        <h3 className="section-title">Të Dhënat Personale</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Emri" required placeholder="Emri i nxënësit" value={form.firstName} onChange={v => set("firstName", v)} />
          <Field label="Mbiemri" required placeholder="Mbiemri i nxënësit" value={form.lastName} onChange={v => set("lastName", v)} />
          <DateField label="Datëlindja" value={form.birthDate} onChange={v => set("birthDate", v)} />
          <Field label="Numri Personal" placeholder="XXXXXXXXXX" value={form.personalNumber} onChange={v => set("personalNumber", v)} />
          <Field label="Numri Amë" placeholder="Numri amë" value={form.motherNumber} onChange={v => set("motherNumber", v)} />
          <Field label="Numri i Ditarit" placeholder="Numri i ditarit" value={form.diaryNumber} onChange={v => set("diaryNumber", v)} />
        </div>
      </div>

      {/* Mother */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="section-title">Të Dhënat e Nënës</h3>
          <button type="button" onClick={() => autoFixParent("mother")}
            className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
            🔧 Rregullo automatikisht
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Emri dhe Mbiemri" placeholder="Emri i nënës" value={form.motherName} onChange={v => set("motherName", v)} />
          <DateField label="Datëlindja" value={form.motherBirth} onChange={v => set("motherBirth", v)} />
          <Field label="Profesioni" placeholder="Profesioni" value={form.motherProf} onChange={v => set("motherProf", v)} />
          <Field label="Telefoni" placeholder="+383 XX XXX XXX" value={form.motherPhone} onChange={v => set("motherPhone", v)} />
          <div className="md:col-span-2">
            <Field label="E-mail" placeholder="email@email.com" value={form.motherEmail} onChange={v => set("motherEmail", v)} />
          </div>
        </div>
      </div>

      {/* Father */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="section-title">Të Dhënat e Babës</h3>
          <button type="button" onClick={() => autoFixParent("father")}
            className="text-xs text-amber-600 hover:text-amber-700 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors">
            🔧 Rregullo automatikisht
          </button>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Emri dhe Mbiemri" placeholder="Emri i babës" value={form.fatherName} onChange={v => set("fatherName", v)} />
          <DateField label="Datëlindja" value={form.fatherBirth} onChange={v => set("fatherBirth", v)} />
          <Field label="Profesioni" placeholder="Profesioni" value={form.fatherProf} onChange={v => set("fatherProf", v)} />
          <Field label="Telefoni" placeholder="+383 XX XXX XXX" value={form.fatherPhone} onChange={v => set("fatherPhone", v)} />
          <div className="md:col-span-2">
            <Field label="E-mail" placeholder="email@email.com" value={form.fatherEmail} onChange={v => set("fatherEmail", v)} />
          </div>
        </div>
      </div>

      {/* Address & Guardian */}
      <div className="card p-5 space-y-4">
        <h3 className="section-title">Adresa & Kujdestari</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Adresa e Shtëpisë" placeholder="Adresa e shtëpisë" value={form.address} onChange={v => set("address", v)} />
          <Field label="Kujdestari/ja" placeholder="Nëse ndryshe nga prindi" value={form.guardian} onChange={v => set("guardian", v)} />
        </div>
      </div>

      {/* School Info */}
      <div className="card p-5 space-y-4">
        <h3 className="section-title">Informacioni Shkollor</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="form-label">Klasa</label>
            <select value={form.classId} onChange={e => set("classId", e.target.value)} className="form-input">
              <option value="">— Zgjidh klasën —</option>
              {classes.map(c => (
                <option key={c.id} value={c.id}>{c.name} ({c.level})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="form-label">Statusi</label>
            <select value={form.status} onChange={e => set("status", e.target.value)} className="form-input">
              <option value="ACTIVE">Aktiv</option>
              <option value="INACTIVE">Joaktiv</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="form-label">Shënime</label>
            <textarea value={form.notes} onChange={e => set("notes", e.target.value)}
              className="form-input min-h-[80px] resize-none" placeholder="Shënime shtesë..." />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-3">
        <button type="button" onClick={() => router.back()} className="btn-secondary">
          <X className="w-4 h-4" /> Anulo
        </button>
        <button type="submit" disabled={loading} className="btn-primary">
          <Save className="w-4 h-4" />
          {loading ? "Duke ruajtur..." : studentId ? "Ruaj Ndryshimet" : "Regjistro Nxënësin"}
        </button>
      </div>
    </form>
  );
}
