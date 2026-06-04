"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import Header from "@/components/layout/Header";
import { formatCurrency } from "@/lib/utils";
import { Plus, Trash2, Edit, X, Save, Settings, TrendingDown, Calendar, BarChart3, Upload, Download } from "lucide-react";
import { MONTHS } from "@/lib/utils";
import * as XLSX from "xlsx";

interface Kategori {
  id: number;
  emri: string;
  ngjyra: string | null;
  ikona: string | null;
  _count?: { shpenzime: number };
}

interface Shpenzim {
  id: number;
  shuma: number;
  pershkrim: string | null;
  marres: string | null;
  data: string;
  metoda: string | null;
  referenca: string | null;
  docType: string;
  kategori: Kategori;
}

const NGJYRAT = ["#ef4444","#f97316","#eab308","#22c55e","#3b82f6","#8b5cf6","#ec4899","#64748b"];

export default function ShpenzimePage() {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [kategorite, setKategorite] = useState<Kategori[]>([]);
  const [shpenzime, setShpenzime] = useState<Shpenzim[]>([]);
  const [totalShuma, setTotalShuma] = useState(0);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"shpenzime" | "raport" | "kategorite">("shpenzime");

  // Raport vjetor
  type RaportKat = { id: number; emri: string; ngjyra: string | null; ikona: string | null; muajt: Record<number, number>; total: number };
  const [raport, setRaport] = useState<{ kategorite: RaportKat[]; totalPerMuaj: Record<number, number>; totalVjetor: number } | null>(null);
  const [raportLoading, setRaportLoading] = useState(false);

  // Import
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<{ text: string; ok: boolean } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Modal shtim shpenzimi
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId] = useState<number | null>(null);
  const [form, setForm] = useState({
    kategoriId: "", shuma: "", pershkrim: "", marres: "",
    data: now.toISOString().split("T")[0], metoda: "CASH", referenca: "", docType: "KUPON",
  });

  // Modal kategorive
  const [showKatModal, setShowKatModal] = useState(false);
  const [editKatId, setEditKatId] = useState<number | null>(null);
  const [katForm, setKatForm] = useState({ emri: "", ngjyra: NGJYRAT[0], ikona: "" });
  const [saving, setSaving] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [shRes, katRes] = await Promise.all([
      fetch(`/api/shpenzime?month=${month}&year=${year}&limit=100`),
      fetch("/api/shpenzime/kategorite"),
    ]);
    const [shData, katData] = await Promise.all([shRes.json(), katRes.json()]);
    setShpenzime(shData.shpenzime || []);
    setTotalShuma(shData.totalShuma || 0);
    setKategorite(katData || []);
    setLoading(false);
  }, [month, year]);

  const _first = useRef(true);
  useEffect(() => {
    const delay = _first.current ? 0 : 300;
    _first.current = false;
    const t = setTimeout(fetchData, delay);
    return () => clearTimeout(t);
  }, [fetchData]);

  function openNew() {
    setEditId(null);
    setForm({ kategoriId: kategorite[0]?.id ? String(kategorite[0].id) : "", shuma: "", pershkrim: "", marres: "", data: now.toISOString().split("T")[0], metoda: "CASH", referenca: "", docType: "KUPON" });
    setShowModal(true);
  }

  function openEdit(s: Shpenzim) {
    setEditId(s.id);
    setForm({
      kategoriId: String(s.kategori.id), shuma: String(s.shuma),
      pershkrim: s.pershkrim || "", marres: s.marres || "",
      data: new Date(s.data).toISOString().split("T")[0],
      metoda: s.metoda || "CASH", referenca: s.referenca || "",
      docType: s.docType || "KUPON",
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.kategoriId || !form.shuma) return;
    setSaving(true);
    const url = editId ? `/api/shpenzime/${editId}` : "/api/shpenzime";
    const method = editId ? "PUT" : "POST";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    setSaving(false);
    setShowModal(false);
    fetchData();
  }

  async function handleDelete(id: number) {
    if (!confirm("Fshi këtë shpenzim?")) return;
    await fetch(`/api/shpenzime/${id}`, { method: "DELETE" });
    fetchData();
  }

  function openNewKat() {
    setEditKatId(null);
    setKatForm({ emri: "", ngjyra: NGJYRAT[0], ikona: "" });
    setShowKatModal(true);
  }

  function openEditKat(k: Kategori) {
    setEditKatId(k.id);
    setKatForm({ emri: k.emri, ngjyra: k.ngjyra || NGJYRAT[0], ikona: k.ikona || "" });
    setShowKatModal(true);
  }

  async function handleSaveKategori() {
    if (!katForm.emri) return;
    setSaving(true);
    if (editKatId) {
      await fetch(`/api/shpenzime/kategorite?id=${editKatId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(katForm),
      });
    } else {
      await fetch("/api/shpenzime/kategorite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(katForm),
      });
    }
    setSaving(false);
    setShowKatModal(false);
    fetchData();
  }

  const fetchRaport = useCallback(async () => {
    setRaportLoading(true);
    const res = await fetch(`/api/shpenzime/raport?year=${year}`);
    const data = await res.json();
    setRaport(data);
    setRaportLoading(false);
  }, [year]);

  useEffect(() => {
    if (tab === "raport") fetchRaport();
  }, [tab, fetchRaport]);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("year", String(year));
    const res = await fetch("/api/shpenzime/import", { method: "POST", body: fd });
    const data = await res.json();
    setImportMsg({ text: data.message || data.error, ok: res.ok });
    setImporting(false);
    if (res.ok) { fetchData(); fetchRaport(); }
    if (fileRef.current) fileRef.current.value = "";
  }

  function exportRaportExcel() {
    if (!raport) return;
    const headers = ["Kategoria", ...MONTHS, "Total"];
    const rows = raport.kategorite.map(k => [
      k.emri,
      ...Array.from({ length: 12 }, (_, i) => k.muajt[i + 1] || 0),
      k.total,
    ]);
    rows.push(["TOTALI", ...Array.from({ length: 12 }, (_, i) => raport.totalPerMuaj[i + 1] || 0), raport.totalVjetor]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [{ wch: 30 }, ...Array(13).fill({ wch: 12 })];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Shpenzime ${year}`);
    XLSX.writeFile(wb, `Shpenzime-${year}.xlsx`);
  }

  async function handleDeleteKat(id: number) {
    if (!confirm("Fshi këtë kategori dhe të gjitha shpenzimet e saj?")) return;
    await fetch(`/api/shpenzime/kategorite?id=${id}`, { method: "DELETE" });
    fetchData();
  }

  // Grupim sipas kategorisë për summary
  const byCat = kategorite.map(k => ({
    ...k,
    total: shpenzime.filter(s => s.kategori.id === k.id).reduce((sum, s) => sum + s.shuma, 0),
    count: shpenzime.filter(s => s.kategori.id === k.id).length,
  })).filter(k => k.total > 0).sort((a, b) => b.total - a.total);

  return (
    <>
      <Header title="Shpenzimet" backHref="/dashboard" />
      <div className="p-6 space-y-5 animate-fade-in">

        {/* Filters */}
        <div className="flex items-center gap-3 flex-wrap">
          <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="form-input w-36">
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="form-input w-24">
            {[2020, 2021, 2022, 2023, 2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="flex gap-1 ml-auto flex-wrap">
            <button onClick={() => setTab("shpenzime")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === "shpenzime" ? "bg-primary-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"}`}>
              Shpenzimet
            </button>
            <button onClick={() => setTab("raport")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${tab === "raport" ? "bg-primary-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"}`}>
              <BarChart3 className="w-3.5 h-3.5" /> Raport Vjetor
            </button>
            <button onClick={() => setTab("kategorite")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${tab === "kategorite" ? "bg-primary-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"}`}>
              <Settings className="w-3.5 h-3.5" /> Kategoritë
            </button>
          </div>

          {/* Import Excel */}
          <label className={`btn-secondary text-sm cursor-pointer whitespace-nowrap flex items-center gap-1.5 ${importing ? "opacity-60 pointer-events-none" : ""}`}>
            <Upload className="w-4 h-4" />
            {importing ? "Duke importuar..." : "Import Excel"}
            <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
          </label>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-4 sm:col-span-2">
            <p className="text-xs text-slate-400 mb-1">Shpenzime Totale — {MONTHS[month - 1]} {year}</p>
            <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(totalShuma)}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-400 mb-1">Nr. Shpenzimeve</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{shpenzime.length}</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-400 mb-1">Kategori aktive</p>
            <p className="text-2xl font-bold text-slate-800 dark:text-white">{byCat.length}</p>
          </div>
        </div>

        {/* Mesazhi i importit */}
        {importMsg && (
          <div className={`p-3 rounded-xl text-sm font-medium flex items-center justify-between ${importMsg.ok ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800" : "bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 border border-red-200 dark:border-red-800"}`}>
            <span>{importMsg.text}</span>
            <button onClick={() => setImportMsg(null)}><X className="w-4 h-4" /></button>
          </div>
        )}

        {tab === "shpenzime" && (
          <>
            {/* Category breakdown */}
            {byCat.length > 0 && (
              <div className="card p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Sipas kategorisë</p>
                <div className="flex flex-wrap gap-2">
                  {byCat.map(k => (
                    <div key={k.id} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-sm">
                      <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: k.ngjyra || "#64748b" }} />
                      <span className="text-slate-700 dark:text-slate-300 font-medium">{k.emri}</span>
                      <span className="text-red-600 dark:text-red-400 font-semibold">{formatCurrency(k.total)}</span>
                      <span className="text-slate-400 text-xs">({k.count})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Table */}
            <div className="card overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
                <h3 className="font-semibold text-slate-800 dark:text-white text-sm">Lista e Shpenzimeve</h3>
                <button onClick={openNew} className="btn-primary text-sm">
                  <Plus className="w-4 h-4" /> Shto Shpenzim
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="table-header">Data</th>
                      <th className="table-header">Kategoria</th>
                      <th className="table-header">Përshkrimi</th>
                      <th className="table-header">Marrësi</th>
                      <th className="table-header">Dokumenti</th>
                      <th className="table-header">Metoda</th>
                      <th className="table-header text-right">Shuma</th>
                      <th className="table-header w-16"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {loading ? (
                      <tr><td colSpan={7} className="table-cell text-center py-10 text-slate-400">Duke ngarkuar...</td></tr>
                    ) : shpenzime.length === 0 ? (
                      <tr><td colSpan={7} className="table-cell text-center py-10 text-slate-400">Nuk ka shpenzime për këtë periudhë</td></tr>
                    ) : shpenzime.map(s => (
                      <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="table-cell text-slate-500 text-xs">
                          <div className="flex items-center gap-1.5">
                            <Calendar className="w-3 h-3" />
                            {new Date(s.data).toLocaleDateString("sq-AL")}
                          </div>
                        </td>
                        <td className="table-cell">
                          <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium text-white" style={{ backgroundColor: s.kategori.ngjyra || "#64748b" }}>
                            {s.kategori.ikona && <span>{s.kategori.ikona}</span>}
                            {s.kategori.emri}
                          </span>
                        </td>
                        <td className="table-cell text-slate-700 dark:text-slate-300">{s.pershkrim || "—"}</td>
                        <td className="table-cell text-slate-500">{s.marres || "—"}</td>
                        <td className="table-cell">
                          {s.docType === "KUPON" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
                              🧾 Kupon
                            </span>
                          )}
                          {s.docType === "FATURE" && (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300">
                              📄 Faturë
                            </span>
                          )}
                          {(!s.docType || s.docType === "TJETER") && (
                            <span className="text-slate-300 text-xs">—</span>
                          )}
                        </td>
                        <td className="table-cell text-slate-400 text-xs">{s.metoda || "—"}</td>
                        <td className="table-cell text-right font-semibold text-red-600 dark:text-red-400">
                          {formatCurrency(s.shuma)}
                        </td>
                        <td className="table-cell">
                          <div className="flex items-center gap-1 justify-end">
                            <button onClick={() => openEdit(s)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 transition-colors">
                              <Edit className="w-3.5 h-3.5" />
                            </button>
                            <button onClick={() => handleDelete(s.id)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-600 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  {shpenzime.length > 0 && (
                    <tfoot className="bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700">
                      <tr>
                        <td colSpan={5} className="table-cell font-semibold text-slate-700 dark:text-slate-200">TOTALI</td>
                        <td className="table-cell text-right font-bold text-red-600 dark:text-red-400 text-base">{formatCurrency(totalShuma)}</td>
                        <td />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </>
        )}

        {tab === "raport" && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-primary-500" />
                Raport Vjetor — {year}
              </h3>
              <button onClick={exportRaportExcel} disabled={!raport || raportLoading} className="btn-secondary text-xs flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> Exporto Excel
              </button>
            </div>
            <div className="overflow-x-auto">
              {raportLoading ? (
                <div className="py-12 text-center text-slate-400 text-sm">Duke ngarkuar raportin...</div>
              ) : !raport || raport.kategorite.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">Nuk ka shpenzime për vitin {year}</div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 sticky left-0 bg-slate-50 dark:bg-slate-800 min-w-[160px]">Kategoria</th>
                      {MONTHS.map((m, i) => (
                        <th key={i} className="px-2 py-2 font-semibold text-slate-500 dark:text-slate-400 text-right min-w-[80px] whitespace-nowrap">{m}</th>
                      ))}
                      <th className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200 text-right min-w-[90px] bg-slate-100 dark:bg-slate-700">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {raport.kategorite.map(k => (
                      <tr key={k.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20 transition-colors">
                        <td className="px-3 py-2 sticky left-0 bg-white dark:bg-slate-900 font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: k.ngjyra || "#64748b" }} />
                          <span>{k.ikona}</span>
                          {k.emri}
                        </td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const val = k.muajt[i + 1];
                          return (
                            <td key={i} className={`px-2 py-2 text-right ${val ? "text-red-600 dark:text-red-400 font-medium" : "text-slate-200 dark:text-slate-700"}`}>
                              {val ? formatCurrency(val) : "—"}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right font-bold text-slate-800 dark:text-white bg-slate-50 dark:bg-slate-800/50">
                          {formatCurrency(k.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-amber-50 dark:bg-amber-900/20 border-t-2 border-amber-200 dark:border-amber-800">
                    <tr>
                      <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-white sticky left-0 bg-amber-50 dark:bg-amber-900/20">TOTALI</td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const val = raport.totalPerMuaj[i + 1];
                        return (
                          <td key={i} className={`px-2 py-2.5 text-right font-bold ${val ? "text-red-700 dark:text-red-400" : "text-slate-300 dark:text-slate-600"}`}>
                            {val ? formatCurrency(val) : "—"}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-right font-bold text-red-700 dark:text-red-400 text-sm bg-amber-100 dark:bg-amber-900/30">
                        {formatCurrency(raport.totalVjetor)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        )}

        {tab === "kategorite" && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-white text-sm">Kategoritë e Shpenzimeve</h3>
              <button onClick={openNewKat} className="btn-primary text-sm">
                <Plus className="w-4 h-4" /> Shto Kategori
              </button>
            </div>
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {kategorite.length === 0 ? (
                <p className="text-center py-10 text-slate-400 text-sm">Nuk ka kategori — shto një të re</p>
              ) : kategorite.map(k => (
                <div key={k.id} className="flex items-center gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <span className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: k.ngjyra || "#64748b" }} />
                  <span className="text-lg">{k.ikona}</span>
                  <div className="flex-1">
                    <p className="font-medium text-slate-800 dark:text-white">{k.emri}</p>
                    <p className="text-xs text-slate-400">{k._count?.shpenzime ?? 0} shpenzime</p>
                  </div>
                  <button onClick={() => openEditKat(k)} className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                    <Edit className="w-4 h-4" />
                  </button>
                  <button onClick={() => handleDeleteKat(k.id)} className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modal — Shto/Modifiko Shpenzim */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-red-500" />
                {editId ? "Modifiko Shpenzimin" : "Shto Shpenzim të Ri"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              {/* Lloji i dokumentit */}
              <div>
                <label className="form-label">Lloji i Dokumentit</label>
                <div className="flex rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600">
                  {[
                    { val: "KUPON",  label: "🧾 Kupon Fiskal" },
                    { val: "FATURE", label: "📄 Faturë e Rregullt" },
                    { val: "TJETER", label: "— Tjetër" },
                  ].map(opt => (
                    <button key={opt.val} type="button"
                      onClick={() => setForm(f => ({ ...f, docType: opt.val }))}
                      className={`flex-1 py-2 text-xs font-medium transition-colors ${form.docType === opt.val ? "bg-primary-600 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Kategoria <span className="text-red-500">*</span></label>
                  <select value={form.kategoriId} onChange={e => setForm(f => ({ ...f, kategoriId: e.target.value }))} className="form-input">
                    <option value="">— Zgjidh —</option>
                    {kategorite.map(k => <option key={k.id} value={k.id}>{k.ikona} {k.emri}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Shuma (€) <span className="text-red-500">*</span></label>
                  <input type="number" value={form.shuma} onChange={e => setForm(f => ({ ...f, shuma: e.target.value }))} className="form-input" placeholder="0.00" min="0" step="0.01" />
                </div>
              </div>
              <div>
                <label className="form-label">Përshkrimi</label>
                <input type="text" value={form.pershkrim} onChange={e => setForm(f => ({ ...f, pershkrim: e.target.value }))} className="form-input" placeholder="Qira, fatura, etj." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Marrësi</label>
                  <input type="text" value={form.marres} onChange={e => setForm(f => ({ ...f, marres: e.target.value }))} className="form-input" placeholder="Emri i marrësit" />
                </div>
                <div>
                  <label className="form-label">Metoda</label>
                  <select value={form.metoda} onChange={e => setForm(f => ({ ...f, metoda: e.target.value }))} className="form-input">
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bankë</option>
                    <option value="CARD">Kartelë</option>
                    <option value="ONLINE">Online</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Data</label>
                  <input type="date" value={form.data} onChange={e => setForm(f => ({ ...f, data: e.target.value }))} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Referenca</label>
                  <input type="text" value={form.referenca} onChange={e => setForm(f => ({ ...f, referenca: e.target.value }))} className="form-input" placeholder="Nr. fature, etj." />
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-5 pt-0">
              <button onClick={() => setShowModal(false)} className="btn-secondary flex-1 justify-center"><X className="w-4 h-4" /> Anulo</button>
              <button onClick={handleSave} disabled={saving || !form.kategoriId || !form.shuma} className="btn-primary flex-1 justify-center">
                {saving ? "Duke ruajtur..." : <><Save className="w-4 h-4" /> Ruaj</>}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal — Shto Kategori */}
      {showKatModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowKatModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white">{editKatId ? "Modifiko Kategorinë" : "Shto Kategori të Re"}</h3>
              <button onClick={() => setShowKatModal(false)}><X className="w-5 h-5 text-slate-400" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="form-label">Emri <span className="text-red-500">*</span></label>
                <input type="text" value={katForm.emri} onChange={e => setKatForm(f => ({ ...f, emri: e.target.value }))} className="form-input" placeholder="p.sh. Qira, Paga, Komunal..." />
              </div>
              <div>
                <label className="form-label">Ikona (emoji)</label>
                <input type="text" value={katForm.ikona} onChange={e => setKatForm(f => ({ ...f, ikona: e.target.value }))} className="form-input" placeholder="🏠 💰 💡" />
              </div>
              <div>
                <label className="form-label">Ngjyra</label>
                <div className="flex gap-2 flex-wrap mt-1">
                  {NGJYRAT.map(n => (
                    <button key={n} onClick={() => setKatForm(f => ({ ...f, ngjyra: n }))}
                      className={`w-7 h-7 rounded-full border-2 transition-all ${katForm.ngjyra === n ? "border-slate-800 dark:border-white scale-110" : "border-transparent"}`}
                      style={{ backgroundColor: n }} />
                  ))}
                </div>
              </div>
            </div>
            <div className="flex gap-3 p-5 pt-0">
              <button onClick={() => setShowKatModal(false)} className="btn-secondary flex-1 justify-center">Anulo</button>
              <button onClick={handleSaveKategori} disabled={saving || !katForm.emri} className="btn-primary flex-1 justify-center">
                {saving ? "Duke ruajtur..." : editKatId ? "Ruaj Ndryshimet" : "Shto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
