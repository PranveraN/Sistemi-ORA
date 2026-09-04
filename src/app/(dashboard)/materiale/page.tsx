"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import {
  Plus, Pencil, Check, X, Trash2, Loader2, Package, Tags,
  BookMarked, Boxes, EyeOff, Eye, Search, Gauge, ChevronDown, History,
} from "lucide-react";
import { formatCurrency, formatDateTime } from "@/lib/utils";
import { getStockStatus, STOCK_STATUS_STYLE } from "@/lib/materialConstants";

/* ─── Types ───────────────────────────────────────────────── */
interface MaterialCategoryRow {
  id: number; name: string; active: boolean;
  _count: { materials: number };
}

interface SubjectRow {
  id: number; name: string; active: boolean;
  _count: { requests: number };
}

interface Sipartner { id: number; emri: string; nrFiskal: string | null }

interface MaterialRow {
  id: number; name: string; description: string | null;
  defaultUnit: string; needsColor: boolean; sku: string | null;
  defaultPrice: number | null; minStock: number; maxStock: number | null;
  currentStock: number; active: boolean;
  category: { id: number; name: string };
  supplier: { id: number; emri: string } | null;
}

const UNITS = ["copë", "metër", "kg", "litër", "paketë"];

const TABS = [
  { key: "kategorite", label: "Kategoritë", icon: Tags },
  { key: "lendet",     label: "Lëndët",     icon: BookMarked },
  { key: "materialet", label: "Materialet", icon: Boxes },
  { key: "stoku",      label: "Stoku",      icon: Gauge },
] as const;

type TabKey = (typeof TABS)[number]["key"];

/* ═══════════════════════════════════════════════════════════ */
export default function MaterialeKatalogPage() {
  const [tab, setTab] = useState<TabKey>("materialet");

  return (
    <>
      <Header title="Katalogu i Materialeve" />
      <div className="p-6 max-w-4xl mx-auto space-y-5 animate-fade-in">
        <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit flex-wrap">
          {TABS.map(t => {
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

        {tab === "kategorite" && <CategoriesSection />}
        {tab === "lendet"     && <SubjectsSection />}
        {tab === "materialet" && <MaterialsSection />}
        {tab === "stoku"      && <StockSection />}
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  KATEGORITË                                                 */
/* ═══════════════════════════════════════════════════════════ */
function CategoriesSection() {
  const [cats, setCats] = useState<MaterialCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchCats = useCallback(async () => {
    const r = await fetch("/api/material-categories");
    setCats(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchCats(); }, [fetchCats]);

  async function handleAdd(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    setError("");
    const res = await fetch("/api/material-categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    const d = await res.json().catch(() => ({}));
    setAdding(false);
    if (!res.ok) { setError(d.error || "Gabim"); return; }
    setNewName("");
    fetchCats();
  }

  async function handleSaveEdit(id: number) {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/material-categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(d.error || "Gabim"); return; }
    setEditId(null);
    fetchCats();
  }

  async function toggleActive(cat: MaterialCategoryRow) {
    await fetch(`/api/material-categories/${cat.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !cat.active }),
    });
    fetchCats();
  }

  async function handleDelete(cat: MaterialCategoryRow) {
    if (!confirm(`Fshi kategorinë "${cat.name}"?`)) return;
    const res = await fetch(`/api/material-categories/${cat.id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alert(d.error || "Gabim"); return; }
    fetchCats();
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 p-5 border-b border-slate-100 dark:border-slate-700">
        <div className="w-9 h-9 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
          <Tags className="w-5 h-5 text-primary-500" />
        </div>
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white">Kategoritë e Materialeve</h2>
          <p className="text-xs text-slate-400">Grupimi i materialeve në katalog</p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Shto Kategori të Re
        </p>
        <div className="flex gap-2">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            className="form-input flex-1" placeholder="Emri i kategorisë *" required />
          <button type="submit" disabled={adding} className="btn-primary flex-shrink-0 px-3">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </form>

      {loading ? (
        <div className="py-10 text-center text-slate-400 text-sm">Duke ngarkuar...</div>
      ) : cats.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm">Nuk ka kategori</div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {cats.map(cat => (
            <div key={cat.id}>
              {editId === cat.id ? (
                <div className="p-4 bg-primary-50/30 dark:bg-primary-900/10 flex items-center gap-2">
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    className="form-input flex-1" autoFocus />
                  <button onClick={() => setEditId(null)} className="btn-secondary text-xs px-3 py-1.5">
                    <X className="w-3.5 h-3.5" /> Anulo
                  </button>
                  <button onClick={() => handleSaveEdit(cat.id)} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Ruaj
                  </button>
                </div>
              ) : (
                <div className={`flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${!cat.active ? "opacity-50" : ""}`}>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">{cat.name}</p>
                    <p className="text-xs text-slate-400">{cat._count.materials} materiale{!cat.active && " · Joaktive"}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => toggleActive(cat)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:text-slate-500 transition-colors"
                      title={cat.active ? "Çaktivizo" : "Aktivizo"}>
                      {cat.active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => { setEditId(cat.id); setEditName(cat.name); setError(""); }}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:text-slate-500 transition-colors"
                      title="Modifiko">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(cat)}
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
/*  LËNDËT                                                     */
/* ═══════════════════════════════════════════════════════════ */
function SubjectsSection() {
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");
  const [newName, setNewName] = useState("");
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const fetchSubjects = useCallback(async () => {
    const r = await fetch("/api/subjects");
    setSubjects(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchSubjects(); }, [fetchSubjects]);

  async function handleAdd(e: React.SyntheticEvent) {
    e.preventDefault();
    if (!newName.trim()) return;
    setAdding(true);
    setError("");
    const res = await fetch("/api/subjects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName }),
    });
    const d = await res.json().catch(() => ({}));
    setAdding(false);
    if (!res.ok) { setError(d.error || "Gabim"); return; }
    setNewName("");
    fetchSubjects();
  }

  async function handleSaveEdit(id: number) {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/subjects/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(d.error || "Gabim"); return; }
    setEditId(null);
    fetchSubjects();
  }

  async function toggleActive(s: SubjectRow) {
    await fetch(`/api/subjects/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !s.active }),
    });
    fetchSubjects();
  }

  async function handleDelete(s: SubjectRow) {
    if (!confirm(`Fshi lëndën "${s.name}"?`)) return;
    const res = await fetch(`/api/subjects/${s.id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alert(d.error || "Gabim"); return; }
    fetchSubjects();
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center gap-3 p-5 border-b border-slate-100 dark:border-slate-700">
        <div className="w-9 h-9 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
          <BookMarked className="w-5 h-5 text-primary-500" />
        </div>
        <div>
          <h2 className="font-bold text-slate-900 dark:text-white">Lëndët</h2>
          <p className="text-xs text-slate-400">Përdoren te kërkesat për material</p>
        </div>
      </div>

      <form onSubmit={handleAdd} className="p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-100 dark:border-slate-700">
        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Shto Lëndë të Re
        </p>
        <div className="flex gap-2">
          <input value={newName} onChange={e => setNewName(e.target.value)}
            className="form-input flex-1" placeholder="Emri i lëndës *" required />
          <button type="submit" disabled={adding} className="btn-primary flex-shrink-0 px-3">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
          </button>
        </div>
        {error && <p className="text-xs text-red-500 mt-2">{error}</p>}
      </form>

      {loading ? (
        <div className="py-10 text-center text-slate-400 text-sm">Duke ngarkuar...</div>
      ) : subjects.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm">Nuk ka lëndë</div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {subjects.map(s => (
            <div key={s.id}>
              {editId === s.id ? (
                <div className="p-4 bg-primary-50/30 dark:bg-primary-900/10 flex items-center gap-2">
                  <input value={editName} onChange={e => setEditName(e.target.value)}
                    className="form-input flex-1" autoFocus />
                  <button onClick={() => setEditId(null)} className="btn-secondary text-xs px-3 py-1.5">
                    <X className="w-3.5 h-3.5" /> Anulo
                  </button>
                  <button onClick={() => handleSaveEdit(s.id)} disabled={saving} className="btn-primary text-xs px-3 py-1.5">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                    Ruaj
                  </button>
                </div>
              ) : (
                <div className={`flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${!s.active ? "opacity-50" : ""}`}>
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">{s.name}</p>
                    <p className="text-xs text-slate-400">{s._count.requests} kërkesa{!s.active && " · Joaktive"}</p>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button onClick={() => toggleActive(s)}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:text-slate-500 transition-colors"
                      title={s.active ? "Çaktivizo" : "Aktivizo"}>
                      {s.active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => { setEditId(s.id); setEditName(s.name); setError(""); }}
                      className="p-1.5 rounded-lg text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:text-slate-500 transition-colors"
                      title="Modifiko">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => handleDelete(s)}
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
/*  MATERIALET                                                 */
/* ═══════════════════════════════════════════════════════════ */
const emptyForm = {
  name: "", description: "", categoryId: "", defaultUnit: "copë", needsColor: false,
  sku: "", supplierId: "", supplierName: "", defaultPrice: "", minStock: "", maxStock: "",
};

function MaterialsSection() {
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [categories, setCategories] = useState<MaterialCategoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"add" | number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierSuggestions, setSupplierSuggestions] = useState<Sipartner[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const fetchAll = useCallback(async () => {
    const [mRes, cRes] = await Promise.all([
      fetch("/api/materials"),
      fetch("/api/material-categories"),
    ]);
    setMaterials(await mRes.json());
    setCategories(await cRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function openAdd() {
    setForm(emptyForm);
    setSupplierQuery("");
    setError("");
    setModal("add");
  }

  function openEdit(m: MaterialRow) {
    setForm({
      name: m.name, description: m.description || "", categoryId: String(m.category.id),
      defaultUnit: m.defaultUnit, needsColor: m.needsColor, sku: m.sku || "",
      supplierId: m.supplier ? String(m.supplier.id) : "", supplierName: m.supplier?.emri || "",
      defaultPrice: m.defaultPrice !== null ? String(m.defaultPrice) : "",
      minStock: String(m.minStock), maxStock: m.maxStock !== null ? String(m.maxStock) : "",
    });
    setSupplierQuery(m.supplier?.emri || "");
    setError("");
    setModal(m.id);
  }

  async function fetchSuppliers(q: string) {
    setSupplierQuery(q);
    setForm(f => ({ ...f, supplierId: "", supplierName: "" }));
    if (!q || q.length < 2) { setSupplierSuggestions([]); setShowSuggestions(false); return; }
    const res = await fetch(`/api/sipartner?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data: Sipartner[] = await res.json();
      // Disa rezultate nga /api/sipartner vijnë nga Shpenzimet dhe s'kanë ende
      // rresht real në tabelën Sipartner (pa `id`) — Material.supplierId kërkon
      // FK real, ndaj i lëmë jashtë listës këtu (ndryshe nga Shpenzimet, që i
      // ruajnë vetëm si tekst të lirë).
      const withId = data.filter(sp => sp.id);
      setSupplierSuggestions(withId);
      setShowSuggestions(withId.length > 0);
    }
  }

  function selectSupplier(sp: Sipartner) {
    setForm(f => ({ ...f, supplierId: String(sp.id), supplierName: sp.emri }));
    setSupplierQuery(sp.emri);
    setSupplierSuggestions([]);
    setShowSuggestions(false);
  }

  async function handleSave() {
    if (!form.name.trim() || !form.categoryId) return;
    setSaving(true);
    setError("");
    const url = modal === "add" ? "/api/materials" : `/api/materials/${modal}`;
    const method = modal === "add" ? "POST" : "PATCH";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(d.error || "Gabim"); return; }
    setModal(null);
    fetchAll();
  }

  async function toggleActive(m: MaterialRow) {
    await fetch(`/api/materials/${m.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: !m.active }),
    });
    fetchAll();
  }

  async function handleDelete(m: MaterialRow) {
    if (!confirm(`Fshi materialin "${m.name}"?`)) return;
    const res = await fetch(`/api/materials/${m.id}`, { method: "DELETE" });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { alert(d.error || "Gabim"); return; }
    fetchAll();
  }

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-100 dark:border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
            <Boxes className="w-5 h-5 text-primary-500" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">Materialet</h2>
            <p className="text-xs text-slate-400">Katalogu i plotë, i disponueshëm te kërkesat</p>
          </div>
        </div>
        <button onClick={openAdd} disabled={!categories.length} className="btn-primary text-sm">
          <Plus className="w-4 h-4" />
          Shto Material
        </button>
      </div>

      {!loading && categories.length === 0 && (
        <div className="p-4 text-xs text-amber-600 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/40">
          Krijo së pari të paktën një kategori te tabi &quot;Kategoritë&quot;.
        </div>
      )}

      {loading ? (
        <div className="py-10 text-center text-slate-400 text-sm">Duke ngarkuar...</div>
      ) : materials.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm flex flex-col items-center gap-2">
          <Package className="w-8 h-8 text-slate-300" />
          Nuk ka materiale në katalog
        </div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {materials.map(m => (
            <div key={m.id} className={`flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${!m.active ? "opacity-50" : ""}`}>
              <div className="min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-slate-900 dark:text-white text-sm">{m.name}</p>
                  <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-0.5 rounded-full">
                    {m.category.name}
                  </span>
                  {m.needsColor && (
                    <span className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full">
                      Ngjyrë
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 mt-1">
                  Njësia: {m.defaultUnit}
                  {m.defaultPrice !== null && <> · {formatCurrency(m.defaultPrice)}</>}
                  {m.supplier && <> · {m.supplier.emri}</>}
                  {m.sku && <> · SKU: {m.sku}</>}
                  {!m.active && " · Joaktive"}
                </p>
              </div>
              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => toggleActive(m)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:text-slate-500 transition-colors"
                  title={m.active ? "Çaktivizo" : "Aktivizo"}>
                  {m.active ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
                <button onClick={() => openEdit(m)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:text-slate-500 transition-colors"
                  title="Modifiko">
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button onClick={() => handleDelete(m)}
                  className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-slate-500 transition-colors"
                  title="Fshi">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !saving && setModal(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white">
                {modal === "add" ? "Material i Ri" : "Modifiko Materialin"}
              </h3>
              <button onClick={() => !saving && setModal(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="form-label">Emri *</label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  className="form-input" autoFocus />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Kategoria *</label>
                  <select value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))} className="form-input">
                    <option value="">Zgjidh...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Njësia</label>
                  <select value={form.defaultUnit} onChange={e => setForm(f => ({ ...f, defaultUnit: e.target.value }))} className="form-input">
                    {UNITS.map(u => <option key={u} value={u}>{u}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Përshkrim</label>
                <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  className="form-input" placeholder="Opsionale" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">SKU</label>
                  <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))}
                    className="form-input" placeholder="Opsionale" />
                </div>
                <div>
                  <label className="form-label">Çmimi Default (€)</label>
                  <div className="relative">
                    <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">€</span>
                    <input type="number" value={form.defaultPrice} onChange={e => setForm(f => ({ ...f, defaultPrice: e.target.value }))}
                      className="form-input pl-6" placeholder="0.00" min="0" step="0.01" />
                  </div>
                </div>
              </div>
              <div className="relative">
                <label className="form-label">Furnitori</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={supplierQuery} onChange={e => fetchSuppliers(e.target.value)}
                    onFocus={() => supplierSuggestions.length > 0 && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    className="form-input pl-9" placeholder="Kërko furnitor (opsionale)" />
                </div>
                {showSuggestions && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {supplierSuggestions.map(sp => (
                      <button key={sp.id} type="button" onClick={() => selectSupplier(sp)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                        {sp.emri}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Stoku Minimal</label>
                  <input type="number" value={form.minStock} onChange={e => setForm(f => ({ ...f, minStock: e.target.value }))}
                    className="form-input" placeholder="0" min="0" />
                </div>
                <div>
                  <label className="form-label">Stoku Maksimal</label>
                  <input type="number" value={form.maxStock} onChange={e => setForm(f => ({ ...f, maxStock: e.target.value }))}
                    className="form-input" placeholder="Opsionale" min="0" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                <input type="checkbox" checked={form.needsColor} onChange={e => setForm(f => ({ ...f, needsColor: e.target.checked }))}
                  className="rounded" />
                Kërkon zgjedhje ngjyre (p.sh. markera, penj)
              </label>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
            <div className="flex justify-end gap-2 p-5 pt-0">
              <button onClick={() => setModal(null)} disabled={saving} className="btn-secondary disabled:opacity-50">Anulo</button>
              <button onClick={handleSave} disabled={saving || !form.name.trim() || !form.categoryId} className="btn-primary disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Ruaj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  STOKU                                                       */
/* ═══════════════════════════════════════════════════════════ */
interface Transaction {
  id: number; type: string; quantity: number; balanceAfter: number;
  note: string | null; createdAt: string;
  createdBy: { name: string };
  orderItem: { order: { orderNumber: string } } | null;
}

function StockSection() {
  const [materials, setMaterials] = useState<MaterialRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"ALL" | "RED" | "YELLOW" | "GREEN">("ALL");
  const [adjustingId, setAdjustingId] = useState<number | null>(null);
  const [delta, setDelta] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loadingTx, setLoadingTx] = useState(false);

  const fetchMaterials = useCallback(async () => {
    const r = await fetch("/api/materials");
    setMaterials(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { fetchMaterials(); }, [fetchMaterials]);

  async function loadTransactions(id: number) {
    setLoadingTx(true);
    const r = await fetch(`/api/materials/${id}/transactions`);
    setTransactions(r.ok ? await r.json() : []);
    setLoadingTx(false);
  }

  async function toggleExpand(id: number) {
    if (expandedId === id) { setExpandedId(null); return; }
    setExpandedId(id);
    await loadTransactions(id);
  }

  function openAdjust(id: number) {
    setAdjustingId(id);
    setDelta("");
    setNote("");
    setError("");
  }

  async function saveAdjust(id: number) {
    const d = parseInt(delta);
    if (!d) { setError("Shkruaj një ndryshim (pozitiv ose negativ)"); return; }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/materials/${id}/adjust-stock`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delta: d, note: note || undefined }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(data.error || "Gabim"); return; }
    setAdjustingId(null);
    fetchMaterials();
    if (expandedId === id) loadTransactions(id);
  }

  const withStatus = materials.map(m => ({ ...m, stockStatus: getStockStatus(m.currentStock, m.minStock) }));
  const filtered = withStatus.filter(m => filter === "ALL" || m.stockStatus === filter);
  const counts = {
    RED: withStatus.filter(m => m.stockStatus === "RED").length,
    YELLOW: withStatus.filter(m => m.stockStatus === "YELLOW").length,
    GREEN: withStatus.filter(m => m.stockStatus === "GREEN").length,
  };

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between gap-3 p-5 border-b border-slate-100 dark:border-slate-700 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
            <Gauge className="w-5 h-5 text-primary-500" />
          </div>
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white">Stoku</h2>
            <p className="text-xs text-slate-400">Sasia aktuale e çdo materiali në katalog</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {(["ALL", "RED", "YELLOW", "GREEN"] as const).map(key => (
            <button
              key={key}
              onClick={() => setFilter(key)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filter === key ? "bg-primary-600 text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {key === "ALL" ? "Të gjitha" : STOCK_STATUS_STYLE[key].label}
              {key !== "ALL" && counts[key] > 0 && <span className="ml-1">({counts[key]})</span>}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="py-10 text-center text-slate-400 text-sm">Duke ngarkuar...</div>
      ) : filtered.length === 0 ? (
        <div className="py-10 text-center text-slate-400 text-sm">Nuk ka materiale në këtë kategori</div>
      ) : (
        <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {filtered.map(m => (
            <div key={m.id}>
              <div className="flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                <button onClick={() => toggleExpand(m.id)} className="flex items-center gap-3 min-w-0 flex-1 text-left">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${STOCK_STATUS_STYLE[m.stockStatus].dot}`} />
                  <div className="min-w-0">
                    <p className="font-semibold text-slate-900 dark:text-white text-sm">{m.name}</p>
                    <p className="text-xs text-slate-400">{m.category.name} · min {m.minStock}{m.maxStock !== null && ` · maks ${m.maxStock}`}</p>
                  </div>
                  <ChevronDown className={`w-3.5 h-3.5 text-slate-300 shrink-0 transition-transform ${expandedId === m.id ? "rotate-180" : ""}`} />
                </button>
                <div className="flex items-center gap-3 shrink-0">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${STOCK_STATUS_STYLE[m.stockStatus].color}`}>{STOCK_STATUS_STYLE[m.stockStatus].label}</span>
                  <span className="text-lg font-bold text-slate-800 dark:text-white w-14 text-right">{m.currentStock}</span>
                  <button onClick={() => openAdjust(m.id)} className="btn-secondary text-xs px-2.5 py-1.5">Rregullo</button>
                </div>
              </div>

              {adjustingId === m.id && (
                <div className="px-5 pb-4 flex items-center gap-2 bg-slate-50 dark:bg-slate-800/50">
                  <input type="number" value={delta} onChange={e => setDelta(e.target.value)} className="form-input w-24 text-sm" placeholder="+/-" autoFocus />
                  <input value={note} onChange={e => setNote(e.target.value)} className="form-input flex-1 text-sm" placeholder="Arsyeja (opsionale)" />
                  {error && <p className="text-xs text-red-500">{error}</p>}
                  <button onClick={() => setAdjustingId(null)} className="btn-secondary text-xs px-2.5 py-1.5">Anulo</button>
                  <button onClick={() => saveAdjust(m.id)} disabled={saving} className="btn-primary text-xs px-2.5 py-1.5">
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  </button>
                </div>
              )}

              {expandedId === m.id && (
                <div className="px-5 pb-4 bg-slate-50/50 dark:bg-slate-800/20">
                  {loadingTx ? (
                    <p className="text-xs text-slate-400 py-2">Duke ngarkuar historikun...</p>
                  ) : transactions.length === 0 ? (
                    <p className="text-xs text-slate-400 py-2 flex items-center gap-1.5"><History className="w-3.5 h-3.5" /> Ende s&apos;ka lëvizje stoku</p>
                  ) : (
                    <div className="space-y-1 py-2">
                      {transactions.map(t => (
                        <div key={t.id} className="flex items-center justify-between text-xs text-slate-500">
                          <span>
                            {t.type === "RECEIVED" ? "Pranim" : "Rregullim"}
                            {t.orderItem && ` (${t.orderItem.order.orderNumber})`}
                            {t.note && ` — ${t.note}`}
                            <span className="text-slate-400"> · {t.createdBy.name} · {formatDateTime(t.createdAt)}</span>
                          </span>
                          <span className={`font-semibold shrink-0 ${t.quantity > 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                            {t.quantity > 0 ? "+" : ""}{t.quantity} → {t.balanceAfter}
                          </span>
                        </div>
                      ))}
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
