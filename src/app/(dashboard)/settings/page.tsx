"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import { useSession } from "next-auth/react";
import {
  Save, Plus, Euro, Pencil, Check, X, Trash2,
  School, Users, BookOpen, ShoppingBag, Eye, EyeOff,
  Loader2, AlertTriangle, GraduationCap, KeyRound,
  DatabaseBackup, Download, RefreshCw, CalendarRange, Star,
  Combine, Copy, Link2, ClipboardList, ArrowUp, ArrowDown, ClipboardCheck,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { DEFAULT_EVIDENCA_TEMPLATE } from "@/lib/evidencaConfig";

/* ─── Types ───────────────────────────────────────────────── */
interface SchoolInfo {
  schoolName: string; schoolPhone: string; schoolAddress: string;
  schoolEmail: string; schoolNipt: string; schoolUniqueNumber: string;
  schoolYear: string; schoolWebsite: string;
  timiInvestEnabled: string;
  furnitoriOraEmail: string;
  enrollmentOpen: string;
}

interface Category {
  id: number; name: string; type: string;
  description: string | null; defaultAmount: number;
  paymentCount: number; paymentTotal: number;
}

interface ClassRow {
  id: number; name: string; level: string; teacher: string | null;
  _count: { students: number };
}

interface ExpenseCat {
  id: number; emri: string; ngjyra: string | null; ikona: string | null;
  _count: { shpenzime: number };
}

interface UserRow {
  id: number; name: string; email: string;
  role: string; active: boolean; createdAt: string;
}

interface BackupRow {
  filename: string; size: number; createdAt: string; manual: boolean;
}

/* ─── Constants ───────────────────────────────────────────── */
const typeLabels: Record<string, string> = {
  monthly: "Mujore", annual: "Vjetore", "one-time": "Njëherësh",
};

const ROLES = [
  { value: "ADMIN",     label: "Administrator" },
  { value: "FINANCE",   label: "Financë" },
  { value: "SECRETARY", label: "Sekretari" },
  { value: "PEDAGOGIA", label: "Pedagogia (vetëm Klasat)" },
];

const ROLE_COLORS: Record<string, string> = {
  ADMIN:     "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  FINANCE:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  SECRETARY: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
  PEDAGOGIA: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
};

const TABS = [
  { key: "shkolla",    label: "Shkolla",       icon: School },
  { key: "kategorite", label: "Kategoritë",    icon: Euro },
  { key: "klasat",     label: "Klasat",        icon: GraduationCap },
  { key: "shpenzime",  label: "Shpenzime",     icon: ShoppingBag },
  { key: "formulari",  label: "Formulari i Aplikimit", icon: ClipboardList },
  { key: "evidenca",   label: "Evidenca e Regjistrimit", icon: ClipboardCheck },
  { key: "perdoruesit",label: "Përdoruesit",   icon: Users },
  { key: "backup",     label: "Backup",        icon: DatabaseBackup },
  { key: "vitet",      label: "Vitet Shkollore", icon: CalendarRange },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/* ═══════════════════════════════════════════════════════════ */
export default function SettingsPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string })?.role === "ADMIN";

  const [tab, setTab] = useState<TabKey>("shkolla");

  return (
    <>
      <Header title="Cilësimet" />
      <div className="p-6 max-w-4xl mx-auto space-y-5 animate-fade-in">

        {/* Tab bar */}
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit flex-wrap">
          {TABS.map(t => {
            if ((t.key === "perdoruesit" || t.key === "backup" || t.key === "vitet") && !isAdmin) return null;
            const Icon = t.icon;
            return (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t.key
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <Icon className="w-4 h-4" />
                {t.label}
              </button>
            );
          })}
        </div>

        {tab === "shkolla"     && <SchoolSection />}
        {tab === "kategorite"  && <CategoriesSection />}
        {tab === "klasat"      && <ClassesSection />}
        {tab === "shpenzime"   && <ExpenseCatsSection />}
        {tab === "formulari"   && <EnrollmentFormSection />}
        {tab === "evidenca"    && <EvidencaConfigSection />}
        {tab === "perdoruesit" && isAdmin && <UsersSection />}
        {tab === "backup"     && isAdmin && <BackupSection />}
        {tab === "vitet"      && isAdmin && <SchoolYearsSection />}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  1. SHKOLLA                                                 */
/* ═══════════════════════════════════════════════════════════ */
function SchoolSection() {
  const [info, setInfo] = useState<SchoolInfo>({
    schoolName: "", schoolPhone: "", schoolAddress: "",
    schoolEmail: "", schoolNipt: "", schoolUniqueNumber: "", schoolYear: "", schoolWebsite: "",
    timiInvestEnabled: "true",
    furnitoriOraEmail: "",
    enrollmentOpen: "true",
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [materialLinkCopied, setMaterialLinkCopied] = useState(false);
  const applyUrl = typeof window !== "undefined" ? `${window.location.origin}/apliko` : "/apliko";
  const materialUrl = typeof window !== "undefined" ? `${window.location.origin}/kerkesa-material/regjistrohu` : "/kerkesa-material/regjistrohu";

  async function copyApplyLink() {
    try {
      await navigator.clipboard.writeText(applyUrl);
      setLinkCopied(true);
      setTimeout(() => setLinkCopied(false), 2000);
    } catch { /* clipboard e paarritshme — injorohet */ }
  }

  async function copyMaterialLink() {
    try {
      await navigator.clipboard.writeText(materialUrl);
      setMaterialLinkCopied(true);
      setTimeout(() => setMaterialLinkCopied(false), 2000);
    } catch { /* clipboard e paarritshme — injorohet */ }
  }

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(setInfo);
  }, []);

  async function handleSave(e: React.SyntheticEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(info),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function field(label: string, key: keyof SchoolInfo, opts?: { placeholder?: string; type?: string }) {
    return (
      <div>
        <label className="form-label">{label}</label>
        <input
          type={opts?.type || "text"}
          value={info[key]}
          onChange={e => setInfo(s => ({ ...s, [key]: e.target.value }))}
          className="form-input"
          placeholder={opts?.placeholder}
        />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="card p-6 space-y-5">
      <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
        <div className="w-9 h-9 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
          <School className="w-5 h-5 text-primary-500" />
        </div>
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white">Informacioni i Shkollës</h2>
          <p className="text-xs text-slate-400">Këto të dhëna shfaqen në fatura dhe dokumente zyrtare</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {field("Emri i Biznesit *", "schoolName", { placeholder: "Akademia Ora" })}
        {field("Viti Shkollor", "schoolYear", { placeholder: "2025/2026" })}
        {field("Telefoni", "schoolPhone", { placeholder: "+383 44 XXX XXX" })}
        {field("Email", "schoolEmail", { type: "email", placeholder: "info@akademia.com" })}
        {field("Numri Fiskal", "schoolNipt", { placeholder: "LXXXXXXXXXXXXX" })}
        {field("Numri Unik i Biznesit (NUI)", "schoolUniqueNumber", { placeholder: "8XXXXXX" })}
        {field("Website", "schoolWebsite", { placeholder: "www.akademiaora.com" })}
        <div className="md:col-span-2">
          <label className="form-label">Adresa</label>
          <input
            value={info.schoolAddress}
            onChange={e => setInfo(s => ({ ...s, schoolAddress: e.target.value }))}
            className="form-input"
            placeholder="Rr. Nënë Tereza, Prishtinë"
          />
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-700">
        <label className="form-label">Email i FurnitoriOra (personi i blerjeve)</label>
        <input
          type="email"
          value={info.furnitoriOraEmail}
          onChange={e => setInfo(s => ({ ...s, furnitoriOraEmail: e.target.value }))}
          className="form-input max-w-sm"
          placeholder="furnitoriora@akademiaora.com"
        />
        <p className="text-xs text-slate-400 mt-1">
          Përdoret si adresa e parazgjedhur kur dërgohet një kërkesë e aprovuar për material — mund të ndryshohet për çdo dërgim.
        </p>
      </div>

      <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-slate-700">
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Moduli TIMI INVEST</p>
          <p className="text-xs text-slate-400 max-w-md">
            Kur është joaktiv, fshihet nga Dashboard, Nxënësit dhe kontratat e reja — për shkolla që s&apos;e përdorin këtë mundësi financimi.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setInfo(s => ({ ...s, timiInvestEnabled: s.timiInvestEnabled === "true" ? "false" : "true" }))}
          className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${info.timiInvestEnabled === "true" ? "bg-primary-600" : "bg-slate-300 dark:bg-slate-600"}`}
          aria-pressed={info.timiInvestEnabled === "true"}
        >
          <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${info.timiInvestEnabled === "true" ? "translate-x-5" : "translate-x-0"}`} />
        </button>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
        <div className="flex items-start gap-2">
          <div className="w-9 h-9 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center shrink-0">
            <Link2 className="w-4.5 h-4.5 text-primary-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Formulari Publik i Regjistrimit</p>
            <p className="text-xs text-slate-400 max-w-md">Shpërndajeni këtë link te prindërit (Facebook, mesazhe, etj.) — hapet pa kërkuar kyçje.</p>
          </div>
        </div>
        <div className="flex items-center gap-2 max-w-lg">
          <input readOnly value={applyUrl} className="form-input text-xs" onFocus={e => e.target.select()} />
          <button type="button" onClick={copyApplyLink} className="btn-secondary shrink-0 text-xs">
            {linkCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            {linkCopied ? "U kopjua" : "Kopjo"}
          </button>
        </div>
        <div className="flex items-center justify-between pt-1">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Aplikimet janë të hapura</p>
            <p className="text-xs text-slate-400 max-w-md">
              Kur e mbyllni, formulari publik shfaq "Aplikimet janë të mbyllura" — përdoreni jashtë periudhës prill-maj.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setInfo(s => ({ ...s, enrollmentOpen: s.enrollmentOpen === "true" ? "false" : "true" }))}
            className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${info.enrollmentOpen === "true" ? "bg-primary-600" : "bg-slate-300 dark:bg-slate-600"}`}
            aria-pressed={info.enrollmentOpen === "true"}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${info.enrollmentOpen === "true" ? "translate-x-5" : "translate-x-0"}`} />
          </button>
        </div>
      </div>

      <div className="pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
        <div className="flex items-start gap-2">
          <div className="w-9 h-9 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center shrink-0">
            <Link2 className="w-4.5 h-4.5 text-primary-500" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Formulari i Regjistrimit për Mësimdhënës (Kërkesa Materiale)</p>
            <p className="text-xs text-slate-400 max-w-md">Shpërndajeni këtë link te mësimdhënësit — regjistrohen vetë, llogaria mbetet joaktive derisa ta aprovoni te "Përdoruesit".</p>
          </div>
        </div>
        <div className="flex items-center gap-2 max-w-lg">
          <input readOnly value={materialUrl} className="form-input text-xs" onFocus={e => e.target.select()} />
          <button type="button" onClick={copyMaterialLink} className="btn-secondary shrink-0 text-xs">
            {materialLinkCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            {materialLinkCopied ? "U kopjua" : "Kopjo"}
          </button>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 pt-2">
        {saved && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <Check className="w-4 h-4" /> U ruajt
          </span>
        )}
        <button type="submit" disabled={saving} className="btn-primary">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Duke ruajtur..." : "Ruaj Ndryshimet"}
        </button>
      </div>
    </form>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  1b. FORMULARI I APLIKIMIT ("/apliko")                       */
/* ═══════════════════════════════════════════════════════════ */
interface ExistingFieldDef { key: string; label: string; section: string; defaultRequired: boolean }
interface FieldOverride { visible: boolean; required: boolean }
interface CustomField {
  id: number; label: string; type: string; options: string[] | null; required: boolean; order: number;
}
const CUSTOM_FIELD_TYPES = [
  { value: "TEXT", label: "Tekst i shkurtër" },
  { value: "TEXTAREA", label: "Tekst i gjatë" },
  { value: "NUMBER", label: "Numër" },
  { value: "SELECT", label: "Zgjedhje (dropdown)" },
  { value: "CHECKBOX", label: "Po / Jo" },
];

function EnrollmentFormSection() {
  const [fields, setFields] = useState<ExistingFieldDef[]>([]);
  const [config, setConfig] = useState<Record<string, FieldOverride>>({});
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | "new" | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [a, b] = await Promise.all([
      fetch("/api/settings/enrollment-fields").then(r => r.json()),
      fetch("/api/enrollment-form-fields").then(r => r.json()),
    ]);
    setFields(a.fields); setConfig(a.config);
    setCustomFields(b);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggle(key: string, prop: "visible" | "required") {
    setConfig(c => ({ ...c, [key]: { ...c[key], [prop]: !c[key]?.[prop] } }));
  }

  async function saveConfig() {
    setSavingConfig(true);
    await fetch("/api/settings/enrollment-fields", {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config }),
    });
    setSavingConfig(false); setConfigSaved(true);
    setTimeout(() => setConfigSaved(false), 2000);
  }

  async function deleteCustomField(id: number) {
    if (!confirm("T'a fshij këtë pyetje? Aplikimet e vjetra do ta ruajnë ende përgjigjen dhe etiketën.")) return;
    await fetch(`/api/enrollment-form-fields/${id}`, { method: "DELETE" });
    load();
  }

  async function moveCustomField(field: CustomField, direction: -1 | 1) {
    const sorted = [...customFields].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(f => f.id === field.id);
    const swapWith = sorted[idx + direction];
    if (!swapWith) return;
    await Promise.all([
      fetch(`/api/enrollment-form-fields/${field.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: swapWith.order }) }),
      fetch(`/api/enrollment-form-fields/${swapWith.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: field.order }) }),
    ]);
    load();
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;

  const sections = Array.from(new Set(fields.map(f => f.section)));

  return (
    <div className="space-y-5">
      <div className="card p-6 space-y-4">
        <div className="flex items-center gap-3 pb-3 border-b border-slate-100 dark:border-slate-700">
          <div className="w-9 h-9 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
            <ClipboardList className="w-5 h-5 text-primary-500" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">Fushat Ekzistuese</h2>
            <p className="text-xs text-slate-400">Fikni/ndizni fusha të formularit "/apliko", ose i shënoni të domosdoshme</p>
          </div>
        </div>

        {sections.map(section => (
          <div key={section} className="space-y-2">
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{section}</h3>
            {fields.filter(f => f.section === section).map(f => (
              <div key={f.key} className="flex items-center justify-between gap-3 py-2 border-b border-slate-50 dark:border-slate-800 last:border-0">
                <span className="text-sm text-slate-700 dark:text-slate-200">{f.label}</span>
                <div className="flex items-center gap-4 shrink-0">
                  <label className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 cursor-pointer">
                    <input type="checkbox" checked={config[f.key]?.visible ?? true} onChange={() => toggle(f.key, "visible")} />
                    Shfaqe
                  </label>
                  <label className={`flex items-center gap-1.5 text-xs cursor-pointer ${config[f.key]?.visible === false ? "text-slate-300 dark:text-slate-600" : "text-slate-500 dark:text-slate-400"}`}>
                    <input type="checkbox" disabled={config[f.key]?.visible === false} checked={config[f.key]?.required ?? f.defaultRequired} onChange={() => toggle(f.key, "required")} />
                    E domosdoshme
                  </label>
                </div>
              </div>
            ))}
          </div>
        ))}

        <div className="flex items-center justify-end gap-3 pt-2">
          {configSaved && <span className="text-sm text-green-600 flex items-center gap-1"><Check className="w-4 h-4" /> U ruajt</span>}
          <button onClick={saveConfig} disabled={savingConfig} className="btn-primary">
            {savingConfig ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {savingConfig ? "Duke ruajtur..." : "Ruaj Ndryshimet"}
          </button>
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">Pyetje Shtesë</h2>
            <p className="text-xs text-slate-400">Shfaqen si hap i ri "Pyetje Shtesë" para përmbledhjes te "/apliko"</p>
          </div>
          <button onClick={() => setEditingField("new")} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Shto Pyetje
          </button>
        </div>

        {customFields.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Asnjë pyetje shtesë ende.</p>
        ) : (
          <div className="space-y-2">
            {[...customFields].sort((a, b) => a.order - b.order).map((f, i, arr) => (
              <div key={f.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">
                    {f.label} {f.required && <span className="text-red-500">*</span>}
                  </p>
                  <p className="text-xs text-slate-400">{CUSTOM_FIELD_TYPES.find(t => t.value === f.type)?.label ?? f.type}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => moveCustomField(f, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => moveCustomField(f, 1)} disabled={i === arr.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30">
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setEditingField(f)} className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => deleteCustomField(f.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {editingField && (
        <CustomFieldModal
          field={editingField === "new" ? null : editingField}
          onClose={() => setEditingField(null)}
          onSaved={() => { setEditingField(null); load(); }}
        />
      )}
    </div>
  );
}

function CustomFieldModal({ field, onClose, onSaved }: { field: CustomField | null; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(field?.label ?? "");
  const [type, setType] = useState(field?.type ?? "TEXT");
  const [options, setOptions] = useState((field?.options ?? []).join("\n"));
  const [required, setRequired] = useState(field?.required ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!label.trim()) { setError("Etiketa është e domosdoshme."); return; }
    setSaving(true); setError("");
    const body = {
      label: label.trim(), type, required,
      options: type === "SELECT" ? options.split("\n").map(o => o.trim()).filter(Boolean) : undefined,
    };
    const r = field
      ? await fetch(`/api/enrollment-form-fields/${field.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/enrollment-form-fields", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setSaving(false);
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.message || "Dështoi."); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white">{field ? "Redakto Pyetjen" : "Pyetje e Re"}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="form-label">Etiketa <span className="text-red-500">*</span></label>
            <input className="form-input" value={label} onChange={e => setLabel(e.target.value)} placeholder='p.sh. "A ka nevoja të veçanta?"' />
          </div>
          <div>
            <label className="form-label">Lloji</label>
            <select className="form-input" value={type} onChange={e => setType(e.target.value)}>
              {CUSTOM_FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {type === "SELECT" && (
            <div>
              <label className="form-label">Opsionet (një për rresht)</label>
              <textarea className="form-input" rows={4} value={options} onChange={e => setOptions(e.target.value)} placeholder={"Po\nJo"} />
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
            <input type="checkbox" checked={required} onChange={e => setRequired(e.target.checked)} />
            E domosdoshme
          </label>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 p-5 pt-0">
          <button onClick={onClose} className="btn-secondary"><X className="w-4 h-4" />Anulo</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Duke ruajtur..." : "Ruaj"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  1c. EVIDENCA E REGJISTRIMIT (vlerësim pedagogjik + pyetësor) */
/* ═══════════════════════════════════════════════════════════ */
interface EvidCategory { id: number; label: string; order: number; active: boolean }
interface EvidItem {
  id: number; section: "SKILLS" | "GENERAL"; categoryId: number | null; label: string;
  type: "RATING" | "YES_NO" | "CHOICE" | "TEXT" | "TEXTAREA"; options: string[] | null;
  hasSpecify: boolean; order: number; active: boolean;
}
const GENERAL_ITEM_TYPES = [
  { value: "YES_NO", label: "Po / Jo" },
  { value: "CHOICE", label: "Zgjedhje (opsione)" },
  { value: "TEXT", label: "Tekst i shkurtër" },
  { value: "TEXTAREA", label: "Tekst i gjatë" },
];

function EvidencaConfigSection() {
  const [categories, setCategories] = useState<EvidCategory[]>([]);
  const [items, setItems] = useState<EvidItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryModal, setCategoryModal] = useState<EvidCategory | "new" | null>(null);
  const [skillItemModal, setSkillItemModal] = useState<{ categoryId: number; item: EvidItem | null } | null>(null);
  const [generalItemModal, setGeneralItemModal] = useState<EvidItem | "new" | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [c, i] = await Promise.all([
      fetch("/api/evidenca-categories?includeInactive=1").then(r => r.json()),
      fetch("/api/evidenca-items?includeInactive=1").then(r => r.json()),
    ]);
    setCategories(c.filter((x: EvidCategory) => x.active));
    setItems(i.filter((x: EvidItem) => x.active));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function deleteCategory(id: number) {
    if (!confirm("T'a fshij këtë kategori? Pikat e saj s'do të shfaqen më te formulari i ri (evidencat e vjetra ruajnë etiketën).")) return;
    await fetch(`/api/evidenca-categories/${id}`, { method: "DELETE" });
    load();
  }
  async function deleteItem(id: number) {
    if (!confirm("T'a fshij këtë pyetje? Evidencat e vjetra ruajnë ende përgjigjen dhe etiketën.")) return;
    await fetch(`/api/evidenca-items/${id}`, { method: "DELETE" });
    load();
  }
  async function moveCategory(cat: EvidCategory, direction: -1 | 1) {
    const sorted = [...categories].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(c => c.id === cat.id);
    const swap = sorted[idx + direction];
    if (!swap) return;
    await Promise.all([
      fetch(`/api/evidenca-categories/${cat.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: swap.order }) }),
      fetch(`/api/evidenca-categories/${swap.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: cat.order }) }),
    ]);
    load();
  }
  async function moveItem(item: EvidItem, siblings: EvidItem[], direction: -1 | 1) {
    const sorted = [...siblings].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(i => i.id === item.id);
    const swap = sorted[idx + direction];
    if (!swap) return;
    await Promise.all([
      fetch(`/api/evidenca-items/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: swap.order }) }),
      fetch(`/api/evidenca-items/${swap.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ order: item.order }) }),
    ]);
    load();
  }

  async function seedDefaults() {
    if (!confirm("Të ngarkoj kategoritë dhe pyetjet standarde (Vlerësimi i Aftësive + Pyetësori Shëndetësor/Logjistik)?")) return;
    setSeeding(true);
    for (const cat of DEFAULT_EVIDENCA_TEMPLATE.skills) {
      const catRes = await fetch("/api/evidenca-categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: cat.label }) });
      const category = await catRes.json();
      for (const label of cat.items) {
        await fetch("/api/evidenca-items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label, type: "RATING", section: "SKILLS", categoryId: category.id }) });
      }
    }
    for (const item of DEFAULT_EVIDENCA_TEMPLATE.general) {
      await fetch("/api/evidenca-items", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label: item.label, type: item.type, section: "GENERAL", hasSpecify: item.hasSpecify ?? false, options: item.options }),
      });
    }
    setSeeding(false);
    load();
  }

  if (loading) return <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;

  const generalItems = items.filter(i => i.section === "GENERAL");

  return (
    <div className="space-y-5">
      {categories.length === 0 && items.length === 0 && (
        <div className="card p-5 flex items-center justify-between gap-3 bg-primary-50/50 dark:bg-primary-900/10 border-primary-100 dark:border-primary-900/40">
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Ende s&apos;ka asnjë kategori/pyetje të konfiguruar</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">Ngarkoni shabllonin standard (5 kategori + 24 pyetje, sipas formularëve të pedagogisë) me një klikim, në vend që t&apos;i shtoni një nga një.</p>
          </div>
          <button onClick={seedDefaults} disabled={seeding} className="btn-primary text-sm shrink-0">
            {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {seeding ? "Duke ngarkuar..." : "Ngarko Shabllonin Fillestar"}
          </button>
        </div>
      )}

      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">Vlerësimi i Aftësive</h2>
            <p className="text-xs text-slate-400">Tabelë me kategori dhe pika, secila e notuar 5% / 4% / 3% / 2%</p>
          </div>
          <button onClick={() => setCategoryModal("new")} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Shto Kategori
          </button>
        </div>

        {categories.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Asnjë kategori ende.</p>
        ) : (
          <div className="space-y-4">
            {[...categories].sort((a, b) => a.order - b.order).map((cat, ci, catArr) => {
              const catItems = items.filter(i => i.section === "SKILLS" && i.categoryId === cat.id);
              return (
                <div key={cat.id} className="border border-slate-100 dark:border-slate-700 rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{cat.label}</p>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={() => moveCategory(cat, -1)} disabled={ci === 0} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                      <button onClick={() => moveCategory(cat, 1)} disabled={ci === catArr.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                      <button onClick={() => setCategoryModal(cat)} className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteCategory(cat.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5" /></button>
                    </div>
                  </div>
                  {catItems.length > 0 && (
                    <div className="space-y-1 pl-1">
                      {[...catItems].sort((a, b) => a.order - b.order).map((item, ii, itemArr) => (
                        <div key={item.id} className="flex items-center justify-between gap-2 py-1 border-b border-slate-50 dark:border-slate-800 last:border-0">
                          <span className="text-sm text-slate-600 dark:text-slate-300">{item.label}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <button onClick={() => moveItem(item, itemArr, -1)} disabled={ii === 0} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button>
                            <button onClick={() => moveItem(item, itemArr, 1)} disabled={ii === itemArr.length - 1} className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button>
                            <button onClick={() => setSkillItemModal({ categoryId: cat.id, item })} className="p-1 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"><Pencil className="w-3 h-3" /></button>
                            <button onClick={() => deleteItem(item.id)} className="p-1 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  <button onClick={() => setSkillItemModal({ categoryId: cat.id, item: null })} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Shto Pikë
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">Pyetësori Shëndetësor & Logjistik</h2>
            <p className="text-xs text-slate-400">Pyetje Po/Jo, zgjedhje ose tekst i lirë</p>
          </div>
          <button onClick={() => setGeneralItemModal("new")} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Shto Pyetje
          </button>
        </div>

        {generalItems.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Asnjë pyetje ende.</p>
        ) : (
          <div className="space-y-2">
            {[...generalItems].sort((a, b) => a.order - b.order).map((item, i, arr) => (
              <div key={item.id} className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-100 dark:border-slate-700">
                <div className="min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{item.label}</p>
                  <p className="text-xs text-slate-400">{GENERAL_ITEM_TYPES.find(t => t.value === item.type)?.label ?? item.type}</p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => moveItem(item, arr, -1)} disabled={i === 0} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"><ArrowUp className="w-3.5 h-3.5" /></button>
                  <button onClick={() => moveItem(item, arr, 1)} disabled={i === arr.length - 1} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"><ArrowDown className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setGeneralItemModal(item)} className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20"><Pencil className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteItem(item.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {categoryModal && (
        <EvidCategoryModal
          category={categoryModal === "new" ? null : categoryModal}
          onClose={() => setCategoryModal(null)}
          onSaved={() => { setCategoryModal(null); load(); }}
        />
      )}
      {skillItemModal && (
        <EvidSkillItemModal
          categoryId={skillItemModal.categoryId}
          item={skillItemModal.item}
          onClose={() => setSkillItemModal(null)}
          onSaved={() => { setSkillItemModal(null); load(); }}
        />
      )}
      {generalItemModal && (
        <EvidGeneralItemModal
          item={generalItemModal === "new" ? null : generalItemModal}
          onClose={() => setGeneralItemModal(null)}
          onSaved={() => { setGeneralItemModal(null); load(); }}
        />
      )}
    </div>
  );
}

function EvidCategoryModal({ category, onClose, onSaved }: { category: EvidCategory | null; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(category?.label ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!label.trim()) { setError("Etiketa është e domosdoshme."); return; }
    setSaving(true); setError("");
    const r = category
      ? await fetch(`/api/evidenca-categories/${category.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }) })
      : await fetch("/api/evidenca-categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }) });
    setSaving(false);
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.message || "Dështoi."); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white">{category ? "Redakto Kategorinë" : "Kategori e Re"}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="form-label">Etiketa <span className="text-red-500">*</span></label>
            <input className="form-input" value={label} onChange={e => setLabel(e.target.value)} placeholder='p.sh. "Njohuritë matematikore"' />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 p-5 pt-0">
          <button onClick={onClose} className="btn-secondary"><X className="w-4 h-4" />Anulo</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Duke ruajtur..." : "Ruaj"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EvidSkillItemModal({ categoryId, item, onClose, onSaved }: { categoryId: number; item: EvidItem | null; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(item?.label ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!label.trim()) { setError("Etiketa është e domosdoshme."); return; }
    setSaving(true); setError("");
    const r = item
      ? await fetch(`/api/evidenca-items/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label }) })
      : await fetch("/api/evidenca-items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label, type: "RATING", section: "SKILLS", categoryId }) });
    setSaving(false);
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.message || "Dështoi."); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white">{item ? "Redakto Pikën" : "Pikë e Re"}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="form-label">Etiketa <span className="text-red-500">*</span></label>
            <input className="form-input" value={label} onChange={e => setLabel(e.target.value)} placeholder='p.sh. "Njohja e shkronjave"' />
          </div>
          <p className="text-xs text-slate-400">Notohet gjithmonë 5% / 4% / 3% / 2%.</p>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 p-5 pt-0">
          <button onClick={onClose} className="btn-secondary"><X className="w-4 h-4" />Anulo</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Duke ruajtur..." : "Ruaj"}
          </button>
        </div>
      </div>
    </div>
  );
}

function EvidGeneralItemModal({ item, onClose, onSaved }: { item: EvidItem | null; onClose: () => void; onSaved: () => void }) {
  const [label, setLabel] = useState(item?.label ?? "");
  const [type, setType] = useState(item?.type ?? "YES_NO");
  const [options, setOptions] = useState((item?.options ?? []).join("\n"));
  const [hasSpecify, setHasSpecify] = useState(item?.hasSpecify ?? false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!label.trim()) { setError("Etiketa është e domosdoshme."); return; }
    setSaving(true); setError("");
    const body = {
      label: label.trim(), type, hasSpecify: type === "YES_NO" ? hasSpecify : false,
      options: type === "CHOICE" ? options.split("\n").map(o => o.trim()).filter(Boolean) : undefined,
    };
    const r = item
      ? await fetch(`/api/evidenca-items/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      : await fetch("/api/evidenca-items", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, section: "GENERAL" }) });
    setSaving(false);
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.message || "Dështoi."); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white">{item ? "Redakto Pyetjen" : "Pyetje e Re"}</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="form-label">Etiketa <span className="text-red-500">*</span></label>
            <input className="form-input" value={label} onChange={e => setLabel(e.target.value)} placeholder='p.sh. "A ka fëmija juaj histori alergjike?"' />
          </div>
          <div>
            <label className="form-label">Lloji</label>
            <select className="form-input" value={type} onChange={e => setType(e.target.value as EvidItem["type"])}>
              {GENERAL_ITEM_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          {type === "CHOICE" && (
            <div>
              <label className="form-label">Opsionet (një për rresht)</label>
              <textarea className="form-input" rows={3} value={options} onChange={e => setOptions(e.target.value)} placeholder={"Me shkollën\nIndividuale"} />
            </div>
          )}
          {type === "YES_NO" && (
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer">
              <input type="checkbox" checked={hasSpecify} onChange={e => setHasSpecify(e.target.checked)} />
              Shto fushë "Specifikoni" nëse përgjigjja është "Po"
            </label>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 p-5 pt-0">
          <button onClick={onClose} className="btn-secondary"><X className="w-4 h-4" />Anulo</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Duke ruajtur..." : "Ruaj"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  2. KATEGORITË E PAGESAVE                                   */
/* ═══════════════════════════════════════════════════════════ */
function CategoriesSection() {
  const [cats, setCats]       = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId,  setEditId]  = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", type: "monthly", description: "", defaultAmount: "" });
  const [newCat, setNewCat]   = useState({ name: "", type: "monthly", description: "", defaultAmount: "" });
  const [adding,  setAdding]  = useState(false);
  const [saving,  setSaving]  = useState(false);

  const fetchCats = useCallback(async () => {
    const r = await fetch("/api/categories");
    setCats(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchCats(); }, [fetchCats]);

  async function handleAdd(e: React.SyntheticEvent) {
    e.preventDefault();
    setAdding(true);
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...newCat, defaultAmount: parseFloat(newCat.defaultAmount) || 0 }),
    });
    setAdding(false);
    setNewCat({ name: "", type: "monthly", description: "", defaultAmount: "" });
    fetchCats();
  }

  function startEdit(cat: Category) {
    setEditId(cat.id);
    setEditForm({
      name: cat.name, type: cat.type,
      description: cat.description || "",
      defaultAmount: cat.defaultAmount > 0 ? String(cat.defaultAmount) : "",
    });
  }

  async function handleSaveEdit(id: number) {
    setSaving(true);
    await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editForm, defaultAmount: parseFloat(editForm.defaultAmount) || 0 }),
    });
    setSaving(false); setEditId(null);
    fetchCats();
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Fshi kategorinë "${name}"?\n\nMund të fshihet VETËM nëse s'ka asnjë pagesë të lidhur me të (shih numrin te lista).`)) return;
    const r = await fetch(`/api/categories/${id}`, { method: "DELETE" });
    if (!r.ok) {
      alert(`S'mund të fshihet "${name}" — ka ende pagesa të lidhura me këtë kategori. Fshini/transferoni ato pagesa së pari.`);
      return;
    }
    fetchCats();
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 p-5 border-b border-slate-100 dark:border-slate-700">
        <div className="w-9 h-9 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
          <Euro className="w-5 h-5 text-primary-500" />
        </div>
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white">Kategoritë e Pagesave</h2>
          <p className="text-xs text-slate-400">Menaxho kategoritë dhe çmimet default</p>
        </div>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Shto Kategori të Re
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <input value={newCat.name} onChange={e => setNewCat(n => ({ ...n, name: e.target.value }))}
            className="form-input" placeholder="Emri *" required />
          <select value={newCat.type} onChange={e => setNewCat(n => ({ ...n, type: e.target.value }))} className="form-input">
            <option value="monthly">Mujore</option>
            <option value="annual">Vjetore</option>
            <option value="one-time">Njëherësh</option>
          </select>
          <input value={newCat.description} onChange={e => setNewCat(n => ({ ...n, description: e.target.value }))}
            className="form-input" placeholder="Përshkrim (opsional)" />
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
              <input type="number" value={newCat.defaultAmount} onChange={e => setNewCat(n => ({ ...n, defaultAmount: e.target.value }))}
                className="form-input pl-6" placeholder="0.00" min="0" step="0.01" />
            </div>
            <button type="submit" disabled={adding} className="btn-primary flex-shrink-0 px-3">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </form>

      {/* List */}
      {loading ? (
        <div className="py-10 text-center text-slate-400 text-sm">Duke ngarkuar...</div>
      ) : cats.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm">Nuk ka kategori</div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {cats.map(cat => (
            <div key={cat.id}>
              {editId === cat.id ? (
                /* ── Edit form ── */
                <div className="p-4 bg-primary-50/30 dark:bg-primary-900/10 space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <div>
                      <label className="form-label text-xs">Emri *</label>
                      <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        className="form-input" autoFocus />
                    </div>
                    <div>
                      <label className="form-label text-xs">Lloji</label>
                      <select value={editForm.type} onChange={e => setEditForm(f => ({ ...f, type: e.target.value }))} className="form-input">
                        <option value="monthly">Mujore</option>
                        <option value="annual">Vjetore</option>
                        <option value="one-time">Njëherësh</option>
                      </select>
                    </div>
                    <div>
                      <label className="form-label text-xs">Përshkrim</label>
                      <input value={editForm.description} onChange={e => setEditForm(f => ({ ...f, description: e.target.value }))}
                        className="form-input" placeholder="Opsionale" />
                    </div>
                    <div>
                      <label className="form-label text-xs">Çmimi Default (€)</label>
                      <div className="relative">
                        <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
                        <input type="number" value={editForm.defaultAmount} onChange={e => setEditForm(f => ({ ...f, defaultAmount: e.target.value }))}
                          className="form-input pl-6" placeholder="0.00" min="0" step="0.01" />
                      </div>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button onClick={() => setEditId(null)} className="btn-secondary text-xs px-3 py-1.5">
                      <X className="w-3.5 h-3.5" /> Anulo
                    </button>
                    <button onClick={() => handleSaveEdit(cat.id)} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
                      {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                      Ruaj
                    </button>
                  </div>
                </div>
              ) : (
                /* ── Normal row ── */
                <div className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-primary-50 dark:bg-primary-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Euro className="w-4 h-4 text-primary-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{cat.name}</p>
                      <p className="text-xs text-slate-400">
                        {typeLabels[cat.type] || cat.type}
                        {cat.description && <span className="ml-2 text-slate-300">· {cat.description}</span>}
                      </p>
                      {/* Vetëm lexim — ndihmon të dallohen kategoritë "reale" (me
                          histori pagesash) nga ato bosh/të vjetruara/dublikatë. */}
                      <p className={`text-[11px] mt-0.5 ${cat.paymentCount > 0 ? "text-slate-400" : "text-amber-500"}`}>
                        {cat.paymentCount > 0
                          ? `${cat.paymentCount} pagesa · ${formatCurrency(cat.paymentTotal)} paguar gjithsej`
                          : "Bosh — asnjë pagesë e regjistruar"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className={`text-sm font-bold ${cat.defaultAmount > 0 ? "text-primary-600 dark:text-primary-400" : "text-slate-300"}`}>
                      {cat.defaultAmount > 0 ? formatCurrency(cat.defaultAmount) : "—"}
                    </span>
                    <button onClick={() => startEdit(cat)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:text-slate-500 transition-colors"
                      title="Modifiko">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(cat.id, cat.name)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-slate-500 transition-colors"
                      title="Fshi">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  3. KLASAT                                                  */
/* ═══════════════════════════════════════════════════════════ */
function ClassesSection() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId]   = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ name: "", level: "", teacher: "" });
  const [newCls, setNewCls]   = useState({ name: "", level: "", teacher: "" });
  const [adding, setAdding]   = useState(false);
  const [saving, setSaving]   = useState(false);

  const fetchClasses = useCallback(async () => {
    const r = await fetch("/api/classes");
    setClasses(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchClasses(); }, [fetchClasses]);

  async function handleAdd(e: React.SyntheticEvent) {
    e.preventDefault();
    setAdding(true);
    await fetch("/api/classes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCls),
    });
    setAdding(false);
    setNewCls({ name: "", level: "", teacher: "" });
    fetchClasses();
  }

  async function handleSaveEdit(id: number) {
    setSaving(true);
    await fetch(`/api/classes/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setSaving(false); setEditId(null);
    fetchClasses();
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Fshi klasën "${name}"? Nxënësit e kësaj klase do të qëndrojnë pa klasë.`)) return;
    await fetch(`/api/classes/${id}`, { method: "DELETE" });
    fetchClasses();
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 p-5 border-b border-slate-100 dark:border-slate-700">
        <div className="w-9 h-9 bg-amber-50 dark:bg-amber-900/30 rounded-xl flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-amber-500" />
        </div>
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white">Menaxhimi i Klasave</h2>
          <p className="text-xs text-slate-400">Shto, modifiko ose fshi klasat</p>
        </div>
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Shto Klasë të Re
        </p>
        <div className="grid grid-cols-3 gap-2">
          <input value={newCls.name} onChange={e => setNewCls(n => ({ ...n, name: e.target.value }))}
            className="form-input" placeholder="Emri (p.sh. 1A) *" required />
          <input value={newCls.level} onChange={e => setNewCls(n => ({ ...n, level: e.target.value }))}
            className="form-input" placeholder="Niveli (p.sh. Klasa 1) *" required />
          <div className="flex gap-2">
            <input value={newCls.teacher} onChange={e => setNewCls(n => ({ ...n, teacher: e.target.value }))}
              className="form-input flex-1" placeholder="Mësuesi/ja" />
            <button type="submit" disabled={adding} className="btn-primary flex-shrink-0 px-3">
              {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            </button>
          </div>
        </div>
      </form>

      {/* Table */}
      {loading ? (
        <div className="py-10 text-center text-slate-400 text-sm">Duke ngarkuar...</div>
      ) : classes.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm">Nuk ka klasa</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="table-header">Emri</th>
                <th className="table-header">Niveli</th>
                <th className="table-header">Mësuesi/ja</th>
                <th className="table-header text-center">Nxënës</th>
                <th className="table-header w-20"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {classes.map(cls => (
                editId === cls.id ? (
                  <tr key={cls.id} className="bg-amber-50/30 dark:bg-amber-900/10">
                    <td className="table-cell">
                      <input value={editForm.name} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))}
                        className="form-input py-1 text-xs" autoFocus />
                    </td>
                    <td className="table-cell">
                      <input value={editForm.level} onChange={e => setEditForm(f => ({ ...f, level: e.target.value }))}
                        className="form-input py-1 text-xs" />
                    </td>
                    <td className="table-cell">
                      <input value={editForm.teacher} onChange={e => setEditForm(f => ({ ...f, teacher: e.target.value }))}
                        className="form-input py-1 text-xs" placeholder="Opsionale" />
                    </td>
                    <td className="table-cell text-center text-slate-400">{cls._count.students}</td>
                    <td className="table-cell">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => setEditId(null)} className="p-1.5 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700">
                          <X className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleSaveEdit(cls.id)} disabled={saving}
                          className="p-1.5 rounded bg-green-500 hover:bg-green-600 text-white">
                          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  <tr key={cls.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="table-cell font-semibold text-slate-900 dark:text-white">{cls.name}</td>
                    <td className="table-cell text-slate-500">{cls.level}</td>
                    <td className="table-cell text-slate-500">{cls.teacher || <span className="text-slate-300">—</span>}</td>
                    <td className="table-cell text-center">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
                        <BookOpen className="w-3 h-3" />{cls._count.students}
                      </span>
                    </td>
                    <td className="table-cell">
                      <div className="flex gap-1 justify-end">
                        <button onClick={() => { setEditId(cls.id); setEditForm({ name: cls.name, level: cls.level, teacher: cls.teacher || "" }); }}
                          className="p-1.5 rounded text-slate-300 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 dark:text-slate-500 transition-colors"
                          title="Modifiko">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(cls.id, cls.name)}
                          className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-slate-500 transition-colors"
                          title="Fshi">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  4. KATEGORITË E SHPENZIMEVE                               */
/* ═══════════════════════════════════════════════════════════ */
function ExpenseCatsSection() {
  const [cats, setCats]       = useState<ExpenseCat[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId,  setEditId]  = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ emri: "", ngjyra: "", ikona: "" });
  const [newCat,  setNewCat]  = useState({ emri: "", ngjyra: "#6366f1", ikona: "" });
  const [adding,  setAdding]  = useState(false);
  const [saving,  setSaving]  = useState(false);
  const [mergeId,     setMergeId]     = useState<number | null>(null);
  const [mergeTarget, setMergeTarget] = useState<string>("");
  const [merging,     setMerging]     = useState(false);
  const [onlyDupes,   setOnlyDupes]   = useState(false);

  const fetchCats = useCallback(async () => {
    const r = await fetch("/api/shpenzime/kategorite");
    setCats(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchCats(); }, [fetchCats]);

  // Emra që përsëriten (pa dallim të madh/vogël, hapësira anash) — për t'i sinjalizuar te lista
  const dupeNames = new Set<string>();
  {
    const seen = new Map<string, number>();
    for (const c of cats) {
      const key = c.emri.trim().toLowerCase();
      seen.set(key, (seen.get(key) ?? 0) + 1);
    }
    for (const [key, n] of seen) if (n > 1) dupeNames.add(key);
  }
  const visibleCats = onlyDupes ? cats.filter(c => dupeNames.has(c.emri.trim().toLowerCase())) : cats;

  async function handleMerge(sourceId: number) {
    const targetId = parseInt(mergeTarget);
    if (!targetId) return;
    const source = cats.find(c => c.id === sourceId);
    const target = cats.find(c => c.id === targetId);
    if (!source || !target) return;
    if (!confirm(`Bashko "${source.emri}" (${source._count.shpenzime} shpenzime) me "${target.emri}"?\n\nTë gjitha shpenzimet e "${source.emri}" zhvendosen te "${target.emri}", dhe "${source.emri}" fshihet (bosh, pa humbje të dhënash).`)) return;
    setMerging(true);
    await fetch("/api/shpenzime/kategorite/merge", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceId, targetId }),
    });
    setMerging(false);
    setMergeId(null);
    setMergeTarget("");
    fetchCats();
  }

  async function handleAdd(e: React.SyntheticEvent) {
    e.preventDefault();
    setAdding(true);
    await fetch("/api/shpenzime/kategorite", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCat),
    });
    setAdding(false);
    setNewCat({ emri: "", ngjyra: "#6366f1", ikona: "" });
    fetchCats();
  }

  async function handleSaveEdit(id: number) {
    setSaving(true);
    await fetch(`/api/shpenzime/kategorite?id=${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    setSaving(false); setEditId(null);
    fetchCats();
  }

  async function handleDelete(id: number, name: string) {
    if (!confirm(`Fshi kategorinë "${name}"? Fshihen edhe të gjitha shpenzimet e lidhura.`)) return;
    await fetch(`/api/shpenzime/kategorite?id=${id}`, { method: "DELETE" });
    fetchCats();
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 p-5 border-b border-slate-100 dark:border-slate-700">
        <div className="w-9 h-9 bg-orange-50 dark:bg-orange-900/30 rounded-xl flex items-center justify-center">
          <ShoppingBag className="w-5 h-5 text-orange-500" />
        </div>
        <div className="flex-1">
          <h2 className="font-bold text-slate-900 dark:text-white">Kategoritë e Shpenzimeve</h2>
          <p className="text-xs text-slate-400">Menaxho kategoritë e zyrës dhe blerjet</p>
        </div>
        {dupeNames.size > 0 && (
          <button onClick={() => setOnlyDupes(v => !v)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              onlyDupes ? "bg-amber-500 text-white" : "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 hover:bg-amber-100"
            }`}>
            <AlertTriangle className="w-3.5 h-3.5" />
            {onlyDupes ? "Duke shfaqur vetëm duplikatet" : `${dupeNames.size} emra duplikatë`}
          </button>
        )}
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Shto Kategori të Re
        </p>
        <div className="flex gap-2">
          <input value={newCat.emri} onChange={e => setNewCat(n => ({ ...n, emri: e.target.value }))}
            className="form-input flex-1" placeholder="Emri i kategorisë *" required />
          <input value={newCat.ikona} onChange={e => setNewCat(n => ({ ...n, ikona: e.target.value }))}
            className="form-input w-20 text-center" placeholder="Emoji" />
          <div className="flex items-center gap-1.5">
            <input type="color" value={newCat.ngjyra} onChange={e => setNewCat(n => ({ ...n, ngjyra: e.target.value }))}
              className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer p-0.5" title="Zgjidh ngjyrën" />
          </div>
          <button type="submit" disabled={adding} className="btn-primary flex-shrink-0 px-3">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
      </form>

      {/* List */}
      {loading ? (
        <div className="py-10 text-center text-slate-400 text-sm">Duke ngarkuar...</div>
      ) : visibleCats.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm">
          {onlyDupes ? "Asnjë duplikat" : "Nuk ka kategori shpenzimesh"}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {visibleCats.map(cat => {
            const isDupe = dupeNames.has(cat.emri.trim().toLowerCase());
            return (
            <div key={cat.id}>
              {editId === cat.id ? (
                <div className="p-4 bg-orange-50/30 dark:bg-orange-900/10 space-y-2">
                  <div className="flex gap-2">
                    <input value={editForm.emri} onChange={e => setEditForm(f => ({ ...f, emri: e.target.value }))}
                      className="form-input flex-1" autoFocus />
                    <input value={editForm.ikona} onChange={e => setEditForm(f => ({ ...f, ikona: e.target.value }))}
                      className="form-input w-20 text-center" placeholder="Emoji" />
                    <input type="color" value={editForm.ngjyra || "#6366f1"} onChange={e => setEditForm(f => ({ ...f, ngjyra: e.target.value }))}
                      className="w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-600 cursor-pointer p-0.5" />
                    <button onClick={() => setEditId(null)} className="p-2 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700">
                      <X className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleSaveEdit(cat.id)} disabled={saving} className="p-2 rounded bg-green-500 hover:bg-green-600 text-white">
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ) : mergeId === cat.id ? (
                <div className="p-4 bg-blue-50/30 dark:bg-blue-900/10 space-y-2">
                  <p className="text-xs text-slate-500">
                    Bashko <span className="font-semibold">"{cat.emri}"</span> ({cat._count.shpenzime} shpenzime) me:
                  </p>
                  <div className="flex gap-2">
                    <select value={mergeTarget} onChange={e => setMergeTarget(e.target.value)} className="form-input flex-1" autoFocus>
                      <option value="">— Zgjedh kategorinë ku të zhvendosen —</option>
                      {cats.filter(c => c.id !== cat.id).map(c => (
                        <option key={c.id} value={c.id}>{c.emri} ({c._count.shpenzime} shpenzime)</option>
                      ))}
                    </select>
                    <button onClick={() => { setMergeId(null); setMergeTarget(""); }} className="p-2 rounded text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700">
                      <X className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleMerge(cat.id)} disabled={merging || !mergeTarget} className="p-2 rounded bg-blue-500 hover:bg-blue-600 text-white disabled:opacity-50">
                      {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ) : (
                <div className={`flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${isDupe ? "bg-amber-50/40 dark:bg-amber-900/5" : ""}`}>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: cat.ngjyra || "#6366f1" }}>
                      {cat.ikona || cat.emri[0]?.toUpperCase()}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-slate-900 dark:text-white text-sm">{cat.emri}</p>
                        {isDupe && (
                          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                            <AlertTriangle className="w-2.5 h-2.5" /> Duplikat
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400">{cat._count.shpenzime} shpenzime</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => { setMergeId(cat.id); setMergeTarget(""); }}
                      className="p-1.5 rounded text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:text-slate-500 transition-colors"
                      title="Bashko me kategori tjetër">
                      <Combine className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => { setEditId(cat.id); setEditForm({ emri: cat.emri, ngjyra: cat.ngjyra || "#6366f1", ikona: cat.ikona || "" }); }}
                      className="p-1.5 rounded text-slate-300 hover:text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 dark:text-slate-500 transition-colors"
                      title="Modifiko">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(cat.id, cat.emri)}
                      className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-slate-500 transition-colors"
                      title="Fshi">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  5. PËRDORUESIT                                             */
/* ═══════════════════════════════════════════════════════════ */
const emptyUserForm = { name: "", email: "", password: "", role: "SECRETARY", active: true };

function UsersSection() {
  const { data: session } = useSession();
  const currentUserId = parseInt((session?.user as { id?: string })?.id ?? "0");

  const [users, setUsers]     = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState<"add" | number | null>(null);
  const [form, setForm]       = useState({ ...emptyUserForm });
  const [showPw, setShowPw]   = useState(false);
  const [saving, setSaving]   = useState(false);
  const [err, setErr]         = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    const r = await fetch("/api/users");
    if (r.ok) setUsers(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  function openEdit(u: UserRow) {
    setModal(u.id);
    setForm({ name: u.name, email: u.email, password: "", role: u.role, active: u.active });
    setErr(null); setShowPw(false);
  }

  function openAdd() {
    setModal("add");
    setForm({ ...emptyUserForm });
    setErr(null); setShowPw(false);
  }

  async function handleSave() {
    if (!form.name || !form.email) { setErr("Emri dhe emaili janë të detyrueshme"); return; }
    if (modal === "add" && !form.password) { setErr("Fjalëkalimi është i detyrueshëm"); return; }

    setSaving(true); setErr(null);
    const payload: Record<string, unknown> = {
      name: form.name, email: form.email,
      role: form.role, active: form.active,
    };
    if (form.password) payload.password = form.password;

    const url    = modal === "add" ? "/api/users" : `/api/users/${modal}`;
    const method = modal === "add" ? "POST"       : "PATCH";

    const r = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await r.json();
    setSaving(false);
    if (!r.ok) { setErr(data.error || "Gabim"); return; }
    setModal(null);
    fetchUsers();
  }

  async function handleToggleActive(u: UserRow) {
    if (u.id === currentUserId) return;
    await fetch(`/api/users/${u.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !u.active }),
    });
    fetchUsers();
  }

  async function handleDelete(u: UserRow) {
    if (u.id === currentUserId) { alert("Nuk mund të fshish llogarinë tënde aktive."); return; }
    if (!confirm(`Fshi përdoruesin "${u.name}"?`)) return;
    const r = await fetch(`/api/users/${u.id}`, { method: "DELETE" });
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      alert(d.error || "Fshirja dështoi — provoni sërish.");
      return;
    }
    fetchUsers();
  }

  // Mësimdhënësit ndahen në seksion të vet, të veçantë nga stafi administrativ
  // (Admin/Financë/Sekretari) — sepse mësimdhënësit mund të vetë-regjistrohen
  // (llogaria fillon Joaktive derisa admini ta aktivizojë, shih register/route.ts),
  // ndaj kjo listë duhet kontrolluar shpesh e veçmas nga stafi i shtuar dorazi.
  // Ata në pritje aktivizimi renditen të parët, që të mos humbasin mes atyre
  // tashmë aktivë.
  const staffUsers   = users.filter(u => u.role !== "TEACHER");
  const teacherUsers = [...users.filter(u => u.role === "TEACHER")]
    .sort((a, b) => Number(a.active) - Number(b.active));
  const pendingTeachers = teacherUsers.filter(u => !u.active).length;

  function renderTable(list: UserRow[], emptyMessage: string, highlightPending: boolean) {
    if (loading) return <div className="py-10 text-center text-slate-400 text-sm">Duke ngarkuar...</div>;
    if (list.length === 0) return <div className="py-10 text-center text-slate-400 text-sm">{emptyMessage}</div>;
    return (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="table-header">Emri</th>
              <th className="table-header">Email</th>
              <th className="table-header">Roli</th>
              <th className="table-header text-center">Statusi</th>
              <th className="table-header w-24"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {list.map(u => {
              const pending = highlightPending && !u.active;
              return (
              <tr key={u.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${!u.active && !pending ? "opacity-50" : ""} ${pending ? "bg-amber-50/50 dark:bg-amber-900/10" : ""}`}>
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-xs font-bold text-primary-700 dark:text-primary-400 flex-shrink-0">
                      {u.name[0]?.toUpperCase()}
                    </div>
                    <span className="font-medium text-slate-900 dark:text-white">{u.name}</span>
                    {u.id === currentUserId && (
                      <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 rounded">Ti</span>
                    )}
                    {pending && (
                      <span className="text-[10px] font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400 px-1.5 py-0.5 rounded-full">Në pritje</span>
                    )}
                  </div>
                </td>
                <td className="table-cell text-slate-500 text-xs">{u.email}</td>
                <td className="table-cell">
                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${ROLE_COLORS[u.role] || ""}`}>
                    {ROLES.find(r => r.value === u.role)?.label || u.role}
                  </span>
                </td>
                <td className="table-cell text-center">
                  <button
                    onClick={() => handleToggleActive(u)}
                    disabled={u.id === currentUserId}
                    title={u.active ? "Çaktivizo" : "Aktivizo"}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold transition-colors ${
                      u.active
                        ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100"
                        : pending
                          ? "bg-amber-500 text-white hover:bg-amber-600"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-700 hover:bg-slate-200"
                    } disabled:cursor-not-allowed`}
                  >
                    {u.active ? <><Eye className="w-3 h-3" /> Aktiv</> : <><EyeOff className="w-3 h-3" /> {pending ? "Aktivizo" : "Joaktiv"}</>}
                  </button>
                </td>
                <td className="table-cell">
                  <div className="flex gap-1 justify-end">
                    <button onClick={() => openEdit(u)}
                      className="p-1.5 rounded text-slate-300 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 dark:text-slate-500 transition-colors"
                      title="Modifiko">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(u)}
                      disabled={u.id === currentUserId}
                      className="p-1.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-slate-500 transition-colors disabled:opacity-30"
                      title="Fshi">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <>
    <div className="space-y-5">
      <div className="card overflow-hidden">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-violet-50 dark:bg-violet-900/30 rounded-xl flex items-center justify-center">
              <Users className="w-5 h-5 text-violet-500" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white">Stafi Administrativ</h2>
              <p className="text-xs text-slate-400">Admin, Financë, Sekretari</p>
            </div>
          </div>
          <button onClick={openAdd} className="btn-primary text-sm">
            <Plus className="w-4 h-4" /> Shto Përdorues
          </button>
        </div>
        {renderTable(staffUsers, "Nuk ka staf", false)}
      </div>

      <div className="card overflow-hidden">
        <div className="flex items-center gap-3 p-5 border-b border-slate-100 dark:border-slate-700">
          <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-xl flex items-center justify-center">
            <GraduationCap className="w-5 h-5 text-blue-500" />
          </div>
          <div className="flex-1">
            <h2 className="font-bold text-slate-900 dark:text-white">Mësimdhënësit</h2>
            <p className="text-xs text-slate-400">Përfshin vetë-regjistrimet nga faqja e kërkesave për material</p>
          </div>
          {pendingTeachers > 0 && (
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 text-white">
              <AlertTriangle className="w-3.5 h-3.5" />
              {pendingTeachers} në pritje aktivizimi
            </span>
          )}
        </div>
        {renderTable(teacherUsers, "Asnjë mësimdhënës", true)}
      </div>
    </div>

      {/* ── Modal Shto / Modifiko ── */}
      {modal !== null && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setModal(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-violet-500" />
                {modal === "add" ? "Shto Përdorues të Ri" : "Modifiko Përdoruesin"}
              </h3>
              <button onClick={() => setModal(null)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-4">
              {err && (
                <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {err}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="form-label">Emri i Plotë *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="form-input" placeholder="Emri Mbiemri" autoFocus />
                </div>
                <div className="col-span-2">
                  <label className="form-label">Email *</label>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="form-input" placeholder="emri@shkolla.com" />
                </div>
                <div>
                  <label className="form-label">Roli</label>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))} className="form-input">
                    {ROLES.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Statusi</label>
                  <select value={String(form.active)} onChange={e => setForm(f => ({ ...f, active: e.target.value === "true" }))} className="form-input">
                    <option value="true">Aktiv</option>
                    <option value="false">Joaktiv</option>
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="form-label flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-slate-400" />
                    {modal === "add" ? "Fjalëkalimi *" : "Fjalëkalimi i Ri (lër bosh për të mbajtur)"}
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      value={form.password}
                      onChange={e => setForm(f => ({ ...f, password: e.target.value }))}
                      className="form-input pr-10"
                      placeholder="Min. 6 karaktere"
                    />
                    <button type="button" onClick={() => setShowPw(v => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 p-5 pt-0">
              <button onClick={() => setModal(null)} className="btn-ghost flex-1">Anulo</button>
              <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                {saving ? "Duke ruajtur..." : "Ruaj"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  6. BACKUP                                                   */
/* ═══════════════════════════════════════════════════════════ */
function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function BackupSection() {
  const [backups, setBackups] = useState<BackupRow[]>([]);
  const [loading, setLoading]  = useState(true);
  const [creating, setCreating] = useState(false);

  const fetchBackups = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/backups");
    if (r.ok) setBackups((await r.json()).backups);
    setLoading(false);
  }, []);

  useEffect(() => { fetchBackups(); }, [fetchBackups]);

  async function handleCreateNow() {
    setCreating(true);
    await fetch("/api/backups", { method: "POST" });
    setCreating(false);
    fetchBackups();
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-teal-50 dark:bg-teal-900/30 rounded-xl flex items-center justify-center">
            <DatabaseBackup className="w-5 h-5 text-teal-500" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">Backup i Bazës së të Dhënave</h2>
            <p className="text-xs text-slate-400">Kopje automatike çdo ditë · mbahen 30 ditët e fundit</p>
          </div>
        </div>
        <button onClick={handleCreateNow} disabled={creating} className="btn-primary text-sm">
          {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          {creating ? "Duke krijuar..." : "Bëj Backup Tani"}
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-slate-400 text-sm">Duke ngarkuar...</div>
      ) : backups.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm">Ende s&apos;ka backup-e. Kliko &quot;Bëj Backup Tani&quot;.</div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {backups.map(b => (
            <div key={b.filename} className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                  {formatDateTime(b.createdAt)}
                  {b.manual && <span className="text-[10px] font-medium bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 px-1.5 py-0.5 rounded-full">Manual</span>}
                </p>
                <p className="text-xs text-slate-400">{formatSize(b.size)}</p>
              </div>
              <a href={`/api/backups/${b.filename}`} className="btn-secondary text-xs px-3 py-1.5 flex-shrink-0">
                <Download className="w-3.5 h-3.5" /> Shkarko
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  7. VITET SHKOLLORE                                          */
/* ═══════════════════════════════════════════════════════════ */
interface SchoolYearRow {
  id: number; label: string; startDate: string | null; endDate: string | null; active: boolean;
}
interface YearPriceRow { categoryId: number; name: string; type: string; defaultAmount: number }

function SchoolYearsSection() {
  const [years, setYears] = useState<SchoolYearRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [addErr, setAddErr] = useState<string | null>(null);
  const [pricesForYear, setPricesForYear] = useState<number | null>(null);
  const [prices, setPrices] = useState<YearPriceRow[]>([]);
  const [pricesLoading, setPricesLoading] = useState(false);
  const [savingPrices, setSavingPrices] = useState(false);

  const fetchYears = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/school-years");
    if (r.ok) setYears(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchYears(); }, [fetchYears]);

  async function handleAdd(e: React.SyntheticEvent) {
    e.preventDefault();
    setAdding(true); setAddErr(null);
    const r = await fetch("/api/school-years", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newLabel.trim() }),
    });
    const data = await r.json();
    setAdding(false);
    if (!r.ok) { setAddErr(data.error || "Gabim"); return; }
    setNewLabel("");
    fetchYears();
  }

  async function openPrices(yearId: number) {
    if (pricesForYear === yearId) { setPricesForYear(null); return; }
    setPricesForYear(yearId);
    setPricesLoading(true);
    const r = await fetch(`/api/school-years/${yearId}/prices`);
    if (r.ok) setPrices(await r.json());
    setPricesLoading(false);
  }

  async function handleSavePrices(yearId: number) {
    setSavingPrices(true);
    await fetch(`/api/school-years/${yearId}/prices`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prices: prices.map(p => ({ categoryId: p.categoryId, defaultAmount: p.defaultAmount })) }),
    });
    setSavingPrices(false);
    setPricesForYear(null);
  }

  async function handleDelete(id: number, label: string) {
    if (!confirm(`Fshi vitin "${label}"?`)) return;
    const r = await fetch(`/api/school-years/${id}`, { method: "DELETE" });
    if (!r.ok) { const d = await r.json(); alert(d.error); return; }
    fetchYears();
  }

  async function handleActivate(id: number, label: string) {
    if (!confirm(`Ta bëj "${label}" vitin aktiv? Kjo ndryshon VETËM etiketën e vitit aktiv — s'prek çmimet, klasat apo nxënësit.`)) return;
    const r = await fetch(`/api/school-years/${id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ active: true }),
    });
    if (!r.ok) { const d = await r.json(); alert(d.error); return; }
    fetchYears();
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 p-5 border-b border-slate-100 dark:border-slate-700">
        <div className="w-9 h-9 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
          <CalendarRange className="w-5 h-5 text-indigo-500" />
        </div>
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white">Vitet Shkollore</h2>
          <p className="text-xs text-slate-400">Përgatit çmimet e vitit të ardhshëm pa prekur vitin aktual. Hapja zyrtare e vitit bëhet te Sekretaria → Mbyllja e Vitit.</p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Shto Vit të Ri
        </p>
        <div className="flex gap-2">
          <input value={newLabel} onChange={e => setNewLabel(e.target.value)}
            className="form-input flex-1" placeholder='p.sh. "2027-2028"' required />
          <button type="submit" disabled={adding} className="btn-primary flex-shrink-0 px-3">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
        {addErr && <p className="text-xs text-red-500 mt-2">{addErr}</p>}
      </form>

      {loading ? (
        <div className="py-10 text-center text-slate-400 text-sm">Duke ngarkuar...</div>
      ) : years.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm">Nuk ka vite shkollore</div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {years.map(y => (
            <div key={y.id}>
              <div className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <div className="flex items-center gap-2">
                  <p className="font-semibold text-slate-900 dark:text-white text-sm">{y.label}</p>
                  {y.active && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      <Star className="w-3 h-3" /> Aktiv
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => openPrices(y.id)} className="btn-secondary text-xs px-3 py-1.5">
                    Çmimet {pricesForYear === y.id ? "▴" : "▾"}
                  </button>
                  {!y.active && (
                    <button onClick={() => handleActivate(y.id, y.label)} className="btn-secondary text-xs px-3 py-1.5 text-green-700 dark:text-green-400">
                      <Star className="w-3.5 h-3.5" /> Bëje Aktiv
                    </button>
                  )}
                  {!y.active && (
                    <button onClick={() => handleDelete(y.id, y.label)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-slate-500 transition-colors"
                      title="Fshi">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
              {pricesForYear === y.id && (
                <div className="px-5 pb-4 bg-indigo-50/30 dark:bg-indigo-900/10">
                  {pricesLoading ? (
                    <div className="py-4 text-center text-slate-400 text-xs">Duke ngarkuar çmimet...</div>
                  ) : (
                    <div className="space-y-2 pt-2">
                      {prices.map((p, i) => (
                        <div key={p.categoryId} className="flex items-center justify-between gap-3">
                          <span className="text-sm text-slate-700 dark:text-slate-200">{p.name}</span>
                          <div className="relative w-32">
                            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
                            <input type="number" value={p.defaultAmount} min="0" step="0.01"
                              onChange={e => setPrices(arr => arr.map((row, j) => j === i ? { ...row, defaultAmount: parseFloat(e.target.value) || 0 } : row))}
                              className="form-input pl-6 py-1.5 text-sm" />
                          </div>
                        </div>
                      ))}
                      <div className="flex justify-end pt-2">
                        <button onClick={() => handleSavePrices(y.id)} disabled={savingPrices} className="btn-primary text-xs px-3 py-1.5">
                          {savingPrices ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                          Ruaj Çmimet
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
