"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import { useSession } from "next-auth/react";
import {
  Save, Plus, Euro, Pencil, Check, X, Trash2,
  School, Users, BookOpen, ShoppingBag, Eye, EyeOff,
  Loader2, AlertTriangle, GraduationCap, KeyRound,
  DatabaseBackup, Download, RefreshCw, CalendarRange, Star,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

/* ─── Types ───────────────────────────────────────────────── */
interface SchoolInfo {
  schoolName: string; schoolPhone: string; schoolAddress: string;
  schoolEmail: string; schoolNipt: string; schoolYear: string; schoolWebsite: string;
  timiInvestEnabled: string;
}

interface Category {
  id: number; name: string; type: string;
  description: string | null; defaultAmount: number;
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
];

const ROLE_COLORS: Record<string, string> = {
  ADMIN:     "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  FINANCE:   "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  SECRETARY: "bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300",
};

const TABS = [
  { key: "shkolla",    label: "Shkolla",       icon: School },
  { key: "kategorite", label: "Kategoritë",    icon: Euro },
  { key: "klasat",     label: "Klasat",        icon: GraduationCap },
  { key: "shpenzime",  label: "Shpenzime",     icon: ShoppingBag },
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
    schoolEmail: "", schoolNipt: "", schoolYear: "", schoolWebsite: "",
    timiInvestEnabled: "true",
  });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

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
        {field("Emri i Shkollës *", "schoolName", { placeholder: "Akademia Ora" })}
        {field("Viti Shkollor", "schoolYear", { placeholder: "2025/2026" })}
        {field("Telefoni", "schoolPhone", { placeholder: "+383 44 XXX XXX" })}
        {field("Email", "schoolEmail", { type: "email", placeholder: "info@akademia.com" })}
        {field("NIPT / Nr. Fiskal", "schoolNipt", { placeholder: "LXXXXXXXXXXXXX" })}
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
    if (!confirm(`Fshi kategorinë "${name}"?\n\nFSHIHEN edhe të gjitha pagesat e lidhura.`)) return;
    await fetch(`/api/categories/${id}`, { method: "DELETE" });
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

  const fetchCats = useCallback(async () => {
    const r = await fetch("/api/shpenzime/kategorite");
    setCats(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchCats(); }, [fetchCats]);

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
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white">Kategoritë e Shpenzimeve</h2>
          <p className="text-xs text-slate-400">Menaxho kategoritë e zyrës dhe blerjet</p>
        </div>
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
      ) : cats.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm">Nuk ka kategori shpenzimesh</div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {cats.map(cat => (
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
              ) : (
                <div className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
                      style={{ backgroundColor: cat.ngjyra || "#6366f1" }}>
                      {cat.ikona || cat.emri[0]?.toUpperCase()}
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900 dark:text-white text-sm">{cat.emri}</p>
                      <p className="text-xs text-slate-400">{cat._count.shpenzime} shpenzime</p>
                    </div>
                  </div>
                  <div className="flex gap-1">
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
          ))}
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
    if (!r.ok) { const d = await r.json(); alert(d.error); return; }
    fetchUsers();
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-violet-50 dark:bg-violet-900/30 rounded-xl flex items-center justify-center">
            <Users className="w-5 h-5 text-violet-500" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">Menaxhimi i Përdoruesve</h2>
            <p className="text-xs text-slate-400">Shto dhe menaxho llogaritë e stafit</p>
          </div>
        </div>
        <button onClick={openAdd} className="btn-primary text-sm">
          <Plus className="w-4 h-4" /> Shto Përdorues
        </button>
      </div>

      {loading ? (
        <div className="py-10 text-center text-slate-400 text-sm">Duke ngarkuar...</div>
      ) : users.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm">Nuk ka përdorues</div>
      ) : (
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
              {users.map(u => (
                <tr key={u.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${!u.active ? "opacity-50" : ""}`}>
                  <td className="table-cell">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-xs font-bold text-primary-700 dark:text-primary-400 flex-shrink-0">
                        {u.name[0]?.toUpperCase()}
                      </div>
                      <span className="font-medium text-slate-900 dark:text-white">{u.name}</span>
                      {u.id === currentUserId && (
                        <span className="text-[10px] bg-slate-100 dark:bg-slate-700 text-slate-500 px-1.5 rounded">Ti</span>
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
                      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold transition-colors ${
                        u.active
                          ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 hover:bg-green-100"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-700 hover:bg-slate-200"
                      } disabled:cursor-not-allowed`}
                    >
                      {u.active ? <><Eye className="w-3 h-3" /> Aktiv</> : <><EyeOff className="w-3 h-3" /> Joaktiv</>}
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
              ))}
            </tbody>
          </table>
        </div>
      )}

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
    </div>
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
                  {new Date(b.createdAt).toLocaleString("sq")}
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
