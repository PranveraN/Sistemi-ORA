"use client";

import React, { useEffect, useState, useRef, useCallback } from "react";
import Header from "@/components/layout/Header";
import { formatCurrency } from "@/lib/utils";
import { MONTHS } from "@/lib/utils";
import { Plus, Trash2, Edit, X, Check, TrendingUp, Upload, Download, BarChart3 } from "lucide-react";
import * as XLSX from "xlsx";

interface Hyra {
  id: number;
  paguesit: string;
  shuma: number;
  kategoria: string;
  muaj: number;
  vit: number;
  metoda: string | null;
  referenca: string | null;
  shenime: string | null;
}

type RaportRow = { paguesit: string; muajt: Record<number, number>; total: number };

const VITET = [2023, 2024, 2025, 2026, 2027];

export default function HyratPage() {
  const now = new Date();
  const [muaj, setMuaj]   = useState(now.getMonth() + 1);
  const [vit, setVit]     = useState(now.getFullYear());
  const [hyrat, setHyrat] = useState<Hyra[]>([]);
  const [totalShuma, setTotalShuma] = useState(0);
  const [loading, setLoading]   = useState(true);
  const [tab, setTab] = useState<"lista" | "raport">("lista");

  // Raport
  const [raportVit, setRaportVit]   = useState(now.getFullYear());
  const [raportData, setRaportData] = useState<RaportRow[]>([]);
  const [raportTotal, setRaportTotal] = useState<Record<number, number>>({});
  const [raportLoading, setRaportLoading] = useState(false);

  // Import
  const [importing, setImporting]   = useState(false);
  const [importMsg, setImportMsg]   = useState<{ text: string; ok: boolean } | null>(null);
  const [importMuaj, setImportMuaj] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  // Modal
  const [showModal, setShowModal] = useState(false);
  const [editId, setEditId]       = useState<number | null>(null);
  const [saving, setSaving]       = useState(false);
  const emptyForm = { paguesit: "", shuma: "", muaj: String(now.getMonth() + 1), vit: String(now.getFullYear()), metoda: "BANK", referenca: "", shenime: "" };
  const [form, setForm] = useState(emptyForm);

  const fetchLista = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hyrat?muaj=${muaj}&vit=${vit}&limit=500`);
      if (res.status === 401) { window.location.href = "/login"; return; }
      const data = await res.json();
      setHyrat(data.hyrat || []);
      setTotalShuma(data.totalShuma || 0);
    } catch { /* gabim rrjeti */ }
    finally { setLoading(false); }
  }, [muaj, vit]);

  const _first = useRef(true);
  useEffect(() => {
    if (tab !== "lista") return;
    const isFirst = _first.current; _first.current = false;
    const t = setTimeout(fetchLista, isFirst ? 0 : 300);
    return () => clearTimeout(t);
  }, [fetchLista, tab]);

  const fetchRaport = useCallback(async () => {
    setRaportLoading(true);
    try {
      const res = await fetch(`/api/hyrat?vit=${raportVit}&limit=2000`);
      if (!res.ok) return;
      const data = await res.json();
      const map = new Map<string, RaportRow>();
      const totalet: Record<number, number> = {};

      for (const h of (data.hyrat || []) as Hyra[]) {
        if (!map.has(h.paguesit)) map.set(h.paguesit, { paguesit: h.paguesit, muajt: {}, total: 0 });
        const r = map.get(h.paguesit)!;
        r.muajt[h.muaj] = (r.muajt[h.muaj] ?? 0) + h.shuma;
        r.total += h.shuma;
        totalet[h.muaj] = (totalet[h.muaj] ?? 0) + h.shuma;
      }
      setRaportData([...map.values()].sort((a, b) => a.paguesit.localeCompare(b.paguesit, "sq")));
      setRaportTotal(totalet);
    } catch { /* */ }
    finally { setRaportLoading(false); }
  }, [raportVit]);

  useEffect(() => {
    if (tab === "raport") fetchRaport();
  }, [tab, fetchRaport]);

  async function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true); setImportMsg(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("vit", String(raportVit));
      if (importMuaj) fd.append("muaj", importMuaj);
      const res = await fetch("/api/hyrat/import", { method: "POST", body: fd });
      const d = await res.json();
      setImportMsg({ text: d.message || d.error, ok: res.ok });
      if (res.ok) fetchRaport();
    } catch {
      setImportMsg({ text: "Gabim rrjeti.", ok: false });
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function exportRaport() {
    if (!raportData.length) return;
    const headers = ["Paguesi", ...MONTHS, "Total"];
    const rows = raportData.map(r => [
      r.paguesit,
      ...Array.from({ length: 12 }, (_, i) => r.muajt[i + 1] || 0),
      r.total,
    ]);
    rows.push(["TOTALI", ...Array.from({ length: 12 }, (_, i) => raportTotal[i + 1] || 0),
      Object.values(raportTotal).reduce((s, v) => s + v, 0)]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [{ wch: 28 }, ...Array(13).fill({ wch: 12 })];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Te Hyrat ${raportVit}`);
    XLSX.writeFile(wb, `TeHyrat-${raportVit}.xlsx`);
  }

  async function handleSave() {
    if (!form.paguesit || !form.shuma) return;
    setSaving(true);
    try {
      const url    = editId ? `/api/hyrat/${editId}` : "/api/hyrat";
      const method = editId ? "PUT" : "POST";
      await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      setShowModal(false);
      fetchLista();
    } finally { setSaving(false); }
  }

  async function handleDelete(id: number) {
    if (!confirm("Fshi këtë të hyrë?")) return;
    await fetch(`/api/hyrat/${id}`, { method: "DELETE" });
    fetchLista();
  }

  const grandTotal = Object.values(raportTotal).reduce((s, v) => s + v, 0);

  return (
    <>
      <Header title="Të Hyrat — Shkollimi" />
      <div className="p-6 space-y-5 animate-fade-in">

        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <select value={muaj} onChange={e => setMuaj(parseInt(e.target.value))} className="form-input w-36">
            <option value={0}>Të gjitha</option>
            {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
          </select>
          <select value={vit} onChange={e => setVit(parseInt(e.target.value))} className="form-input w-24">
            {VITET.map(y => <option key={y} value={y}>{y}</option>)}
          </select>
          <div className="flex gap-1 ml-auto flex-wrap">
            <button onClick={() => setTab("lista")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${tab === "lista" ? "bg-primary-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
              Lista
            </button>
            <button onClick={() => setTab("raport")} className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${tab === "raport" ? "bg-primary-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300"}`}>
              <BarChart3 className="w-3.5 h-3.5" /> Raport Vjetor
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="card p-5 sm:col-span-2">
            <p className="text-xs text-slate-400 mb-1">
              Të Hyra Totale — {muaj === 0 ? `Të gjitha ${vit}` : `${MONTHS[muaj - 1]} ${vit}`}
            </p>
            <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(totalShuma)}</p>
          </div>
          <div className="card p-5">
            <p className="text-xs text-slate-400 mb-1">Nr. Paguesve</p>
            <p className="text-3xl font-bold text-slate-800 dark:text-white">{hyrat.length}</p>
          </div>
        </div>

        {/* Lista */}
        {tab === "lista" && (
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-semibold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                Lista e të Hyrave — Shkollimi
              </h3>
              <button onClick={() => { setEditId(null); setForm(emptyForm); setShowModal(true); }} className="btn-primary text-xs">
                <Plus className="w-3.5 h-3.5" /> Shto
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="table-header">Paguesi</th>
                    <th className="table-header">Muaji</th>
                    <th className="table-header">Viti</th>
                    <th className="table-header">Metoda</th>
                    <th className="table-header text-right">Shuma</th>
                    <th className="table-header w-16"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {loading ? (
                    <tr><td colSpan={6} className="table-cell text-center py-10 text-slate-400">Duke ngarkuar...</td></tr>
                  ) : hyrat.length === 0 ? (
                    <tr><td colSpan={6} className="table-cell text-center py-10 text-slate-400">Nuk ka të hyra për këtë periudhë</td></tr>
                  ) : hyrat.map(h => (
                    <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="table-cell font-medium text-slate-900 dark:text-white">{h.paguesit}</td>
                      <td className="table-cell text-slate-500">{MONTHS[h.muaj - 1]}</td>
                      <td className="table-cell text-slate-500">{h.vit}</td>
                      <td className="table-cell">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${h.metoda === "BANK" ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300"}`}>
                          {h.metoda === "BANK" ? "🏦 Bankë" : "💵 Cash"}
                        </span>
                      </td>
                      <td className="table-cell text-right font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(h.shuma)}</td>
                      <td className="table-cell">
                        <div className="flex gap-1 justify-end">
                          <button onClick={() => { setEditId(h.id); setForm({ paguesit: h.paguesit, shuma: String(h.shuma), muaj: String(h.muaj), vit: String(h.vit), metoda: h.metoda || "BANK", referenca: h.referenca || "", shenime: h.shenime || "" }); setShowModal(true); }}
                            className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-400 hover:text-slate-600">
                            <Edit className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(h.id)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-400 hover:text-red-500">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Raport Vjetor */}
        {tab === "raport" && (
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 dark:border-slate-700">
              <div className="flex items-center gap-3 flex-wrap">
                <h3 className="font-semibold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-emerald-500" /> Raport Vjetor — Shkollimi
                </h3>
                <div className="flex gap-1">
                  {VITET.map(y => (
                    <button key={y} onClick={() => setRaportVit(y)}
                      className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all ${raportVit === y ? "bg-emerald-600 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200"}`}>
                      {y}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <select value={importMuaj} onChange={e => setImportMuaj(e.target.value)}
                  className="text-xs border border-slate-200 dark:border-slate-600 rounded-lg px-2 py-1.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                  <option value="">Të gjithë muajt</option>
                  {MONTHS.map((m, i) => <option key={i + 1} value={String(i + 1)}>{m}</option>)}
                </select>
                <label className={`btn-secondary text-xs cursor-pointer flex items-center gap-1.5 ${importing ? "opacity-60 pointer-events-none" : ""}`}>
                  <Upload className="w-3.5 h-3.5" />
                  {importing ? "Duke importuar..." : `Importo ${raportVit}`}
                  <input ref={fileRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleImport} />
                </label>
                <button onClick={exportRaport} disabled={!raportData.length} className="btn-secondary text-xs flex items-center gap-1.5">
                  <Download className="w-3.5 h-3.5" /> Exporto
                </button>
              </div>
            </div>

            {importMsg && (
              <div className={`mx-4 mt-3 p-3 rounded-xl text-sm font-medium flex items-center justify-between ${importMsg.ok ? "bg-green-50 dark:bg-green-900/20 text-green-700 border border-green-200" : "bg-red-50 dark:bg-red-900/20 text-red-700 border border-red-200"}`}>
                <span>{importMsg.text}</span>
                <button onClick={() => setImportMsg(null)}><X className="w-4 h-4" /></button>
              </div>
            )}

            <div className="overflow-x-auto">
              {raportLoading ? (
                <div className="py-12 text-center text-slate-400 text-sm">Duke ngarkuar...</div>
              ) : raportData.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-sm">Nuk ka të hyra për vitin {raportVit}</div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold text-slate-600 dark:text-slate-300 sticky left-0 bg-slate-50 dark:bg-slate-800 min-w-[180px]">Paguesi</th>
                      {MONTHS.map((m, i) => (
                        <th key={i} className="px-2 py-2 font-semibold text-slate-500 text-right min-w-[80px] whitespace-nowrap">{m}</th>
                      ))}
                      <th className="px-3 py-2 font-bold text-slate-700 dark:text-slate-200 text-right min-w-[90px] bg-emerald-50 dark:bg-emerald-900/20">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {raportData.map(r => (
                      <tr key={r.paguesit} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                        <td className="px-3 py-2 sticky left-0 bg-white dark:bg-slate-900 font-medium text-slate-700 dark:text-slate-300">{r.paguesit}</td>
                        {Array.from({ length: 12 }, (_, i) => {
                          const val = r.muajt[i + 1];
                          return (
                            <td key={i} className={`px-2 py-2 text-right ${val ? "text-emerald-600 dark:text-emerald-400 font-medium" : "text-slate-200 dark:text-slate-700"}`}>
                              {val ? formatCurrency(val) : "—"}
                            </td>
                          );
                        })}
                        <td className="px-3 py-2 text-right font-bold text-emerald-700 dark:text-emerald-300 bg-emerald-50/50 dark:bg-emerald-900/10">
                          {formatCurrency(r.total)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-emerald-50 dark:bg-emerald-900/20 border-t-2 border-emerald-200 dark:border-emerald-800">
                    <tr>
                      <td className="px-3 py-2.5 font-bold text-slate-800 dark:text-white sticky left-0 bg-emerald-50 dark:bg-emerald-900/20">TOTALI</td>
                      {Array.from({ length: 12 }, (_, i) => {
                        const val = raportTotal[i + 1];
                        return (
                          <td key={i} className={`px-2 py-2.5 text-right font-bold ${val ? "text-emerald-700 dark:text-emerald-400" : "text-slate-300"}`}>
                            {val ? formatCurrency(val) : "—"}
                          </td>
                        );
                      })}
                      <td className="px-3 py-2.5 text-right font-bold text-emerald-700 dark:text-emerald-400 text-sm bg-emerald-100 dark:bg-emerald-900/30">
                        {formatCurrency(grandTotal)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Modal shto/modifiko */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setShowModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
                {editId ? "Modifiko të Hyrën" : "Shto të Hyrë"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="form-label">Emri i Paguesit <span className="text-red-500">*</span></label>
                <input value={form.paguesit} onChange={e => setForm(f => ({ ...f, paguesit: e.target.value }))} className="form-input" placeholder="Emri Mbiemri" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Shuma (€) <span className="text-red-500">*</span></label>
                  <input type="number" value={form.shuma} onChange={e => setForm(f => ({ ...f, shuma: e.target.value }))} className="form-input" placeholder="0.00" step="0.01" />
                </div>
                <div>
                  <label className="form-label">Metoda</label>
                  <select value={form.metoda} onChange={e => setForm(f => ({ ...f, metoda: e.target.value }))} className="form-input">
                    <option value="BANK">Bankë</option>
                    <option value="CASH">Cash</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Muaji</label>
                  <select value={form.muaj} onChange={e => setForm(f => ({ ...f, muaj: e.target.value }))} className="form-input">
                    {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Viti</label>
                  <select value={form.vit} onChange={e => setForm(f => ({ ...f, vit: e.target.value }))} className="form-input">
                    {VITET.map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="form-label">Referenca</label>
                <input value={form.referenca} onChange={e => setForm(f => ({ ...f, referenca: e.target.value }))} className="form-input" placeholder="Nr. faturës, etj." />
              </div>
            </div>
            <div className="flex gap-3 p-5 pt-0">
              <button onClick={() => setShowModal(false)} className="btn-ghost flex-1">Anulo</button>
              <button onClick={handleSave} disabled={saving || !form.paguesit || !form.shuma} className="btn-primary flex-1 justify-center">
                {saving ? "Duke ruajtur..." : <><Check className="w-4 h-4" /> Ruaj</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
