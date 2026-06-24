"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import { formatCurrency } from "@/lib/utils";
import {
  TrendingUp, Plus, Pencil, Trash2, X, Search,
  ChevronLeft, ChevronRight, Building2, Clock, Filter,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────

interface Investim {
  id: number;
  tipi: string;
  data: string;
  pershkrim: string;
  kategoria: string | null;
  vlera: number;
  metoda: string;
  dokumenti: string | null;
  regjistruarNga: string | null;
  createdAt: string;
}

// ─── Constants ─────────────────────────────────────────────

const TIPI_LABELS: Record<string, string> = {
  KAPITAL:    "Investim Kapital",
  PERKOHSHEM: "Investim i Përkohshëm",
};
const TIPI_COLORS: Record<string, string> = {
  KAPITAL:    "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300",
  PERKOHSHEM: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
};
const METODAT = ["CASH", "BANK", "CARD", "TRANSFER"];
const KATEGORITE_KAPITAL    = ["Pajisje", "Teknologji", "Objekte", "Automjete", "Inventar", "Asete", "Tjetër"];
const KATEGORITE_PERKOHSHEM = ["Depozitë", "Huadhënie", "Blerje për rishitje", "Inventar", "Fond rezervë", "Tjetër"];

function fmt(iso: string) {
  return new Date(iso).toLocaleDateString("sq-AL", { day: "2-digit", month: "short", year: "numeric" });
}
function toInput(iso: string) {
  return iso ? new Date(iso).toISOString().slice(0, 10) : "";
}

// ─── Modal ─────────────────────────────────────────────────

interface FormState {
  tipi: string; data: string; pershkrim: string; kategoria: string;
  vlera: string; metoda: string; dokumenti: string; regjistruarNga: string;
}

const emptyForm = (): FormState => ({
  tipi: "KAPITAL", data: new Date().toISOString().slice(0, 10),
  pershkrim: "", kategoria: "", vlera: "", metoda: "CASH", dokumenti: "", regjistruarNga: "",
});

function InvestimModal({
  initial, onSave, onClose,
}: {
  initial?: Investim | null;
  onSave: () => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<FormState>(() =>
    initial
      ? {
          tipi: initial.tipi, data: toInput(initial.data),
          pershkrim: initial.pershkrim, kategoria: initial.kategoria || "",
          vlera: String(initial.vlera), metoda: initial.metoda,
          dokumenti: initial.dokumenti || "", regjistruarNga: initial.regjistruarNga || "",
        }
      : emptyForm()
  );
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  const set = (k: keyof FormState) => (v: string) => setForm(p => ({ ...p, [k]: v }));

  const kategorite = form.tipi === "KAPITAL" ? KATEGORITE_KAPITAL : KATEGORITE_PERKOHSHEM;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.pershkrim.trim() || !form.vlera) { setError("Plotëso fushat e detyrueshme"); return; }
    setSaving(true); setError("");
    const url = initial ? `/api/investime/${initial.id}` : "/api/investime";
    const method = initial ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, vlera: parseFloat(form.vlera) }),
    });
    setSaving(false);
    if (res.ok) { onSave(); onClose(); }
    else { const d = await res.json(); setError(d.error || "Gabim gjatë ruajtjes"); }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-violet-500" />
            {initial ? "Ndrysho Investimin" : "Regjistro Investim të Ri"}
          </h2>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
            <X className="w-4 h-4 text-slate-500" />
          </button>
        </div>

        <form onSubmit={submit} className="p-6 space-y-4">
          {/* Tipi */}
          <div>
            <label className="label">Lloji i Investimit *</label>
            <div className="flex gap-2 mt-1">
              {(["KAPITAL", "PERKOHSHEM"] as const).map(t => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setForm(p => ({ ...p, tipi: t, kategoria: "" }))}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                    form.tipi === t
                      ? t === "KAPITAL"
                        ? "border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300"
                        : "border-cyan-500 bg-cyan-50 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300"
                      : "border-slate-200 dark:border-slate-600 text-slate-500 hover:border-slate-300"
                  }`}
                >
                  {t === "KAPITAL" ? (
                    <><Building2 className="w-3.5 h-3.5 inline mr-1" />Kapital</>
                  ) : (
                    <><Clock className="w-3.5 h-3.5 inline mr-1" />Përkohshëm</>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Data */}
            <div>
              <label className="label">Data *</label>
              <input type="date" required value={form.data} onChange={e => set("data")(e.target.value)} className="input w-full mt-1" />
            </div>
            {/* Vlera */}
            <div>
              <label className="label">Vlera (€) *</label>
              <input type="number" step="0.01" min="0" required value={form.vlera}
                onChange={e => set("vlera")(e.target.value)} placeholder="0.00" className="input w-full mt-1" />
            </div>
          </div>

          {/* Përshkrimi */}
          <div>
            <label className="label">Përshkrimi *</label>
            <input type="text" required value={form.pershkrim} onChange={e => set("pershkrim")(e.target.value)}
              placeholder="Përshkruaj investimin..." className="input w-full mt-1" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Kategoria */}
            <div>
              <label className="label">Kategoria</label>
              <select value={form.kategoria} onChange={e => set("kategoria")(e.target.value)} className="input w-full mt-1">
                <option value="">— Zgjidh —</option>
                {kategorite.map(k => <option key={k} value={k}>{k}</option>)}
              </select>
            </div>
            {/* Metoda */}
            <div>
              <label className="label">Metoda e Pagesës</label>
              <select value={form.metoda} onChange={e => set("metoda")(e.target.value)} className="input w-full mt-1">
                {METODAT.map(m => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          {/* Dokumenti */}
          <div>
            <label className="label">Dokumenti / Referenca</label>
            <input type="text" value={form.dokumenti} onChange={e => set("dokumenti")(e.target.value)}
              placeholder="Nr. fature, kontrate ose shënim..." className="input w-full mt-1" />
          </div>

          {/* Regjistruar nga */}
          <div>
            <label className="label">Regjistruar nga</label>
            <input type="text" value={form.regjistruarNga} onChange={e => set("regjistruarNga")(e.target.value)}
              placeholder="Emri i personit..." className="input w-full mt-1" />
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{error}</p>}

          <div className="flex gap-2 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Anulo</button>
            <button type="submit" disabled={saving} className="btn-primary flex-1">
              {saving ? "Duke ruajtur..." : initial ? "Ndrysho" : "Regjistro"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────

export default function InvestimetPage() {
  const [investime,   setInvestime]   = useState<Investim[]>([]);
  const [total,       setTotal]       = useState(0);
  const [totalKap,    setTotalKap]    = useState(0);
  const [totalPerk,   setTotalPerk]   = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [page,        setPage]        = useState(1);
  const LIMIT = 25;

  // Filters
  const [search,    setSearch]    = useState("");
  const [tipiFilter, setTipiFilter] = useState("");
  const [metodaFilter, setMetodaFilter] = useState("");
  const [fromDate,  setFromDate]  = useState("");
  const [toDate,    setToDate]    = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Modal
  const [showModal,    setShowModal]    = useState(false);
  const [editItem,     setEditItem]     = useState<Investim | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Investim | null>(null);
  const [deleting,     setDeleting]     = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(t);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const q = new URLSearchParams({
      page:   String(page),
      limit:  String(LIMIT),
      search: debouncedSearch,
      tipi:   tipiFilter,
      metoda: metodaFilter,
      from:   fromDate,
      to:     toDate,
    });
    const res  = await fetch(`/api/investime?${q}`);
    const data = await res.json();
    setInvestime(data.investime    || []);
    setTotal(data.total            || 0);
    setTotalKap(data.totalKapital  || 0);
    setTotalPerk(data.totalPerkohshem || 0);
    setLoading(false);
  }, [page, debouncedSearch, tipiFilter, metodaFilter, fromDate, toDate]);

  useEffect(() => { fetchData(); }, [fetchData]);

  async function confirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    await fetch(`/api/investime/${deleteTarget.id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteTarget(null);
    fetchData();
  }

  const pages = Math.ceil(total / LIMIT);

  return (
    <>
      <Header title="Investimet" backHref="/bilanci" />
      <div className="p-6 space-y-5 animate-fade-in">

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-5 border-l-4 border-violet-400">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center">
                <Building2 className="w-5 h-5 text-violet-600" />
              </div>
              <p className="text-sm font-medium text-slate-500">Investime Kapitale</p>
            </div>
            <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{formatCurrency(totalKap)}</p>
            <p className="text-xs text-slate-400 mt-1">Asete afatgjata, pajisje, objekte</p>
          </div>

          <div className="card p-5 border-l-4 border-cyan-400">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-cyan-50 dark:bg-cyan-900/30 flex items-center justify-center">
                <Clock className="w-5 h-5 text-cyan-600" />
              </div>
              <p className="text-sm font-medium text-slate-500">Investime të Përkohshme</p>
            </div>
            <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{formatCurrency(totalPerk)}</p>
            <p className="text-xs text-slate-400 mt-1">Depozita, huadhënie, afatshkurtra</p>
          </div>

          <div className="card p-5 border-l-4 border-slate-300">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-800 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-slate-500" />
              </div>
              <p className="text-sm font-medium text-slate-500">Totali i Investimeve</p>
            </div>
            <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">{formatCurrency(totalKap + totalPerk)}</p>
            <p className="text-xs text-slate-400 mt-1">{total} regjistrime gjithsej</p>
          </div>
        </div>

        {/* Filters + Add */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text" placeholder="Kërko përshkrim..."
              value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
              className="input pl-9 w-52"
            />
          </div>

          <select value={tipiFilter} onChange={e => { setTipiFilter(e.target.value); setPage(1); }} className="input w-44">
            <option value="">Të gjitha llojet</option>
            <option value="KAPITAL">Investim Kapital</option>
            <option value="PERKOHSHEM">Investim Përkohshëm</option>
          </select>

          <select value={metodaFilter} onChange={e => { setMetodaFilter(e.target.value); setPage(1); }} className="input w-36">
            <option value="">Çdo metodë</option>
            {METODAT.map(m => <option key={m} value={m}>{m}</option>)}
          </select>

          <div className="flex items-center gap-1">
            <Filter className="w-4 h-4 text-slate-400" />
            <input type="date" value={fromDate} onChange={e => { setFromDate(e.target.value); setPage(1); }} className="input w-36 text-sm" />
            <span className="text-slate-400 text-xs">–</span>
            <input type="date" value={toDate}   onChange={e => { setToDate(e.target.value);   setPage(1); }} className="input w-36 text-sm" />
          </div>

          <button
            onClick={() => { setEditItem(null); setShowModal(true); }}
            className="btn-primary ml-auto flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> Regjistro Investim
          </button>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-100 dark:border-slate-700">
                <tr>
                  <th className="table-header">Lloji</th>
                  <th className="table-header">Përshkrimi</th>
                  <th className="table-header">Kategoria</th>
                  <th className="table-header text-right">Vlera</th>
                  <th className="table-header">Metoda</th>
                  <th className="table-header">Dokumenti</th>
                  <th className="table-header">Regjistruar nga</th>
                  <th className="table-header">Data</th>
                  <th className="table-header text-right">Veprimet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-700/50">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="text-center py-12 text-slate-400">
                      <div className="animate-spin w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full mx-auto mb-2" />
                      Duke ngarkuar...
                    </td>
                  </tr>
                ) : investime.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="text-center py-14 text-slate-400">
                      <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-20" />
                      <p className="font-medium">Nuk ka investime të regjistruara</p>
                      <p className="text-sm mt-1">Kliko "Regjistro Investim" për të shtuar</p>
                    </td>
                  </tr>
                ) : investime.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <td className="table-cell">
                      <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium ${TIPI_COLORS[inv.tipi]}`}>
                        {inv.tipi === "KAPITAL" ? <Building2 className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                        {TIPI_LABELS[inv.tipi] || inv.tipi}
                      </span>
                    </td>
                    <td className="table-cell font-medium text-slate-800 dark:text-slate-200 max-w-xs truncate">
                      {inv.pershkrim}
                    </td>
                    <td className="table-cell text-sm text-slate-500">{inv.kategoria || "—"}</td>
                    <td className="table-cell text-right font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(inv.vlera)}
                    </td>
                    <td className="table-cell">
                      <span className="px-2 py-0.5 rounded text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                        {inv.metoda}
                      </span>
                    </td>
                    <td className="table-cell text-sm text-slate-500 max-w-[120px] truncate" title={inv.dokumenti || ""}>
                      {inv.dokumenti || "—"}
                    </td>
                    <td className="table-cell text-sm text-slate-500">{inv.regjistruarNga || "—"}</td>
                    <td className="table-cell text-sm text-slate-500 whitespace-nowrap">{fmt(inv.data)}</td>
                    <td className="table-cell">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => { setEditItem(inv); setShowModal(true); }}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors"
                          title="Ndrysho"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(inv)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                          title="Fshi"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pages > 1 && (
            <div className="flex items-center justify-between px-5 py-3 border-t border-slate-100 dark:border-slate-700">
              <span className="text-sm text-slate-500">{total} gjithsej</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm font-medium">{page} / {pages}</span>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                  className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showModal && (
        <InvestimModal
          initial={editItem}
          onSave={fetchData}
          onClose={() => { setShowModal(false); setEditItem(null); }}
        />
      )}

      {/* Delete Confirm */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-14 h-14 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-7 h-7 text-red-500" />
            </div>
            <h3 className="font-bold text-slate-800 dark:text-white mb-2">Fshi Investimin?</h3>
            <p className="text-sm text-slate-500 mb-1">{deleteTarget.pershkrim}</p>
            <p className="text-lg font-bold text-red-600 mb-5">{formatCurrency(deleteTarget.vlera)}</p>
            <div className="flex gap-2">
              <button onClick={() => setDeleteTarget(null)} className="btn-secondary flex-1">Anulo</button>
              <button onClick={confirmDelete} disabled={deleting} className="btn-primary bg-red-600 hover:bg-red-700 flex-1">
                {deleting ? "Duke fshirë..." : "Fshi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
