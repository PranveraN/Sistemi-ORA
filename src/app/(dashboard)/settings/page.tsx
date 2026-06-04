"use client";

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import { Save, Plus, Tag, List, Euro, Pencil, Check, X } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface SchoolInfo {
  schoolName: string;
  schoolPhone: string;
  schoolAddress: string;
}

interface Category {
  id: number;
  name: string;
  type: string;
  description: string | null;
  defaultAmount: number;
}

export default function SettingsPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [newCat, setNewCat] = useState({ name: "", type: "monthly", description: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>({
    schoolName: "", schoolPhone: "", schoolAddress: "",
  });
  const [infoSaving, setInfoSaving] = useState(false);
  const [infoSaved, setInfoSaved] = useState(false);

  async function fetchCats() {
    const res = await fetch("/api/categories");
    setCategories(await res.json());
    setLoading(false);
  }

  async function fetchSchoolInfo() {
    const res = await fetch("/api/settings");
    if (res.ok) setSchoolInfo(await res.json());
  }

  useEffect(() => { fetchCats(); fetchSchoolInfo(); }, []);

  async function saveSchoolInfo(e: React.FormEvent) {
    e.preventDefault();
    setInfoSaving(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(schoolInfo),
    });
    setInfoSaving(false);
    setInfoSaved(true);
    setTimeout(() => setInfoSaved(false), 2500);
  }

  async function addCategory(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newCat),
    });
    setSaving(false);
    setNewCat({ name: "", type: "monthly", description: "" });
    fetchCats();
  }

  function startEdit(cat: Category) {
    setEditingId(cat.id);
    setEditAmount(String(cat.defaultAmount || ""));
  }

  async function saveAmount(id: number) {
    await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ defaultAmount: parseFloat(editAmount) || 0 }),
    });
    setEditingId(null);
    fetchCats();
  }

  const typeLabels: Record<string, string> = {
    monthly: "Mujore", annual: "Vjetore", "one-time": "Njëherësh",
  };

  return (
    <>
      <Header title="Cilësimet" />
      <div className="p-6 max-w-3xl mx-auto space-y-6 animate-fade-in">

        {/* ── Çmimet e Kategorive ── */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-1">
            <Euro className="w-5 h-5 text-primary-500" />
            <h2 className="section-title">Çmimet e Kategorive</h2>
          </div>
          <p className="text-sm text-slate-400 mb-5">
            Çmimi standard i secilës kategori pagese — shfaqet në listën e nxënësve dhe si vlerë default kur shtohet pagesa.
          </p>

          {loading ? (
            <p className="text-slate-400 text-sm text-center py-4">Duke ngarkuar...</p>
          ) : (
            <div className="space-y-2">
              {categories.map(cat => (
                <div
                  key={cat.id}
                  className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 bg-primary-50 dark:bg-primary-900/30 rounded-lg flex items-center justify-center flex-shrink-0">
                      <Euro className="w-4 h-4 text-primary-500" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 dark:text-white">{cat.name}</p>
                      <p className="text-xs text-slate-400">{typeLabels[cat.type] || cat.type}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {editingId === cat.id ? (
                      <>
                        <div className="relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
                          <input
                            type="number"
                            value={editAmount}
                            onChange={e => setEditAmount(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") saveAmount(cat.id); if (e.key === "Escape") setEditingId(null); }}
                            className="form-input pl-6 w-32 text-right"
                            placeholder="0"
                            min="0"
                            step="0.01"
                            autoFocus
                          />
                        </div>
                        <button
                          onClick={() => saveAmount(cat.id)}
                          className="p-1.5 rounded-lg bg-green-500 hover:bg-green-600 text-white transition-colors"
                          title="Ruaj"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                          title="Anulo"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </>
                    ) : (
                      <>
                        <span className={`text-base font-bold ${cat.defaultAmount > 0 ? "text-primary-600 dark:text-primary-400" : "text-slate-300"}`}>
                          {cat.defaultAmount > 0 ? formatCurrency(cat.defaultAmount) : "—"}
                        </span>
                        <button
                          onClick={() => startEdit(cat)}
                          className="p-1.5 rounded-lg text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:text-slate-500 dark:hover:text-primary-400 transition-colors"
                          title="Ndrysho çmimin"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {categories.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-4">Asnjë kategori</p>
              )}
            </div>
          )}
        </div>

        {/* ── Kategoritë e Pagesave ── */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <Tag className="w-5 h-5 text-slate-400" />
            <h2 className="section-title">Kategoritë e Pagesave</h2>
          </div>
          <p className="text-sm text-slate-400 mb-5">
            Shto kategori të reja si: Aktivitete, Ekskursione, etj.
          </p>

          <form onSubmit={addCategory} className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-5 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
            <div>
              <label className="form-label text-xs">Emri i Kategorisë</label>
              <input
                value={newCat.name}
                onChange={e => setNewCat(n => ({ ...n, name: e.target.value }))}
                className="form-input"
                placeholder="Shkollimi, Ushqimi..."
                required
              />
            </div>
            <div>
              <label className="form-label text-xs">Lloji</label>
              <select
                value={newCat.type}
                onChange={e => setNewCat(n => ({ ...n, type: e.target.value }))}
                className="form-input"
              >
                <option value="monthly">Mujore</option>
                <option value="annual">Vjetore</option>
                <option value="one-time">Njëherësh</option>
              </select>
            </div>
            <div>
              <label className="form-label text-xs">Përshkrimi</label>
              <div className="flex gap-2">
                <input
                  value={newCat.description}
                  onChange={e => setNewCat(n => ({ ...n, description: e.target.value }))}
                  className="form-input flex-1"
                  placeholder="Opsionale"
                />
                <button type="submit" disabled={saving} className="btn-primary flex-shrink-0 px-3">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
          </form>

          <div className="space-y-2">
            {categories.map(cat => (
              <div key={cat.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <div className="flex items-center gap-3">
                  <List className="w-4 h-4 text-slate-400" />
                  <div>
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{cat.name}</p>
                    {cat.description && <p className="text-xs text-slate-400">{cat.description}</p>}
                  </div>
                </div>
                <span className="text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 px-2 py-0.5 rounded-full font-medium">
                  {typeLabels[cat.type] || cat.type}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Informacioni i Shkollës ── */}
        <form onSubmit={saveSchoolInfo} className="card p-5">
          <h2 className="section-title mb-4">Informacioni i Shkollës</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">Emri i Shkollës</label>
              <input
                value={schoolInfo.schoolName}
                onChange={e => setSchoolInfo(s => ({ ...s, schoolName: e.target.value }))}
                className="form-input"
                required
              />
            </div>
            <div>
              <label className="form-label">Telefoni</label>
              <input
                value={schoolInfo.schoolPhone}
                onChange={e => setSchoolInfo(s => ({ ...s, schoolPhone: e.target.value }))}
                className="form-input"
                placeholder="+383 XX XXX XXX"
              />
            </div>
            <div className="md:col-span-2">
              <label className="form-label">Adresa</label>
              <input
                value={schoolInfo.schoolAddress}
                onChange={e => setSchoolInfo(s => ({ ...s, schoolAddress: e.target.value }))}
                placeholder="Adresa e shkollës"
                className="form-input"
              />
            </div>
          </div>
          <div className="flex items-center justify-end gap-3 mt-4">
            {infoSaved && (
              <span className="text-sm text-green-600 dark:text-green-400 flex items-center gap-1">
                <Check className="w-4 h-4" /> U ruajt me sukses
              </span>
            )}
            <button type="submit" disabled={infoSaving} className="btn-primary">
              <Save className="w-4 h-4" />
              {infoSaving ? "Duke ruajtur..." : "Ruaj Ndryshimet"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
