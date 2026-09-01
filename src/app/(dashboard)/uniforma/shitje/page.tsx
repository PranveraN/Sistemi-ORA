"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { ShoppingBag, Plus, Search, Eye, Trash2, Filter, ChevronLeft, ChevronRight, ArrowLeft, Users, X, Loader2, CheckCircle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import FamilyReceiptPrintModal from "@/components/finance/FamilyReceiptPrintModal";

interface Sale {
  id: number;
  customerName: string;
  customerPhone: string | null;
  totalAmount: number;
  totalCost: number;
  profit: number;
  paidAmount: number;
  balance: number;
  status: string;
  saleDate: string;
  notes: string | null;
  _count: { items: number };
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PAID:    { label: "Paguar",     cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  PARTIAL: { label: "Pjesërisht", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  PENDING: { label: "Pa pagesë",  cls: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400" },
};

export default function ShitjetPage() {
  const [sales, setSales] = useState<Sale[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [batchModal, setBatchModal] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchParentName, setBatchParentName] = useState("");
  const [batchParentPhone, setBatchParentPhone] = useState("");
  const [batchMethod, setBatchMethod] = useState("CASH");
  const [familyReceiptPrintId, setFamilyReceiptPrintId] = useState<number | null>(null);
  const limit = 20;

  const load = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    fetch(`/api/uniforms/sales?${params}`)
      .then(r => r.json())
      .then(d => { setSales(d.sales); setTotal(d.total); })
      .finally(() => setLoading(false));
  }, [search, status, page]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (v: string) => { setSearch(v); setPage(1); };
  const handleStatus = (v: string) => { setStatus(v); setPage(1); };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await fetch(`/api/uniforms/sales/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    load();
  };

  function toggleSelect(id: number) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function openBatchModal() {
    const first = sales.find(s => selected.has(s.id));
    setBatchParentName(first?.customerName || "");
    setBatchParentPhone(first?.customerPhone || "");
    setBatchMethod("CASH");
    setBatchError(null);
    setBatchModal(true);
  }

  async function submitBatch() {
    setBatchSaving(true);
    setBatchError(null);
    const res = await fetch("/api/family-receipts/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentName: batchParentName,
        parentPhone: batchParentPhone,
        method: batchMethod,
        uniSaleIds: [...selected],
      }),
    });
    setBatchSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setBatchError(d.error || "Gabim gjatë ruajtjes.");
      return;
    }
    const d = await res.json();
    setBatchModal(false);
    setSelected(new Set());
    setFamilyReceiptPrintId(d.id);
    load();
  }

  const selectedSales = sales.filter(s => selected.has(s.id));
  const selectedTotal = selectedSales.reduce((sum, s) => sum + s.paidAmount, 0);

  const pages = Math.ceil(total / limit);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/uniforma" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </Link>
        <div className="flex-1 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Shitjet</h1>
            <p className="text-sm text-slate-400 mt-0.5">{total} shitje gjithsej</p>
          </div>
          <Link href="/uniforma/shitje/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Shitje e Re
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input className="input pl-9" placeholder="Kërko klient..." value={search}
            onChange={e => handleSearch(e.target.value)} />
        </div>
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-slate-400" />
          <select className="input w-40" value={status} onChange={e => handleStatus(e.target.value)}>
            <option value="">Të gjitha</option>
            <option value="PAID">Paguar</option>
            <option value="PARTIAL">Pjesërisht</option>
            <option value="PENDING">Pa pagesë</option>
          </select>
        </div>
      </div>

      {selected.size >= 2 && (
        <div className="flex items-center justify-between p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl">
          <span className="text-sm text-primary-700 dark:text-primary-300 font-medium">{selected.size} shitje të zgjedhura — {formatCurrency(selectedTotal)}</span>
          <button onClick={openBatchModal} className="btn-primary text-sm">
            <Users className="w-4 h-4" /> Bashko në Pagesë Familjare
          </button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                <th className="px-4 py-3"></th>
                {["#", "Klienti", "Data", "Artikuj", "Totali", "Paguar", "Borxhi", "Statusi", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {sales.length === 0 && (
                <tr>
                  <td colSpan={10} className="px-4 py-12 text-center">
                    <ShoppingBag className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400">Nuk ka shitje</p>
                  </td>
                </tr>
              )}
              {sales.map(s => {
                const st = STATUS_MAP[s.status] ?? STATUS_MAP.PENDING;
                return (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} className="rounded accent-primary-600" />
                    </td>
                    <td className="px-4 py-3 text-slate-400 font-mono text-xs">#{s.id}</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-slate-800 dark:text-slate-200">{s.customerName}</p>
                      {s.customerPhone && <p className="text-xs text-slate-400">{s.customerPhone}</p>}
                    </td>
                    <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                      {formatDate(s.saleDate)}
                    </td>
                    <td className="px-4 py-3 text-slate-500">{s._count.items} copë</td>
                    <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(s.totalAmount)}</td>
                    <td className="px-4 py-3 text-green-600 font-medium">{formatCurrency(s.paidAmount)}</td>
                    <td className="px-4 py-3">
                      {s.balance > 0
                        ? <span className="text-amber-600 font-medium">{formatCurrency(s.balance)}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`badge ${st.cls}`}>{st.label}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1">
                        <Link href={`/uniforma/shitje/${s.id}`}
                          className="p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-500 transition-colors">
                          <Eye className="w-4 h-4" />
                        </Link>
                        <button onClick={() => setDeleteId(s.id)}
                          className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-400 transition-colors">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {pages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs text-slate-400">
                {(page - 1) * limit + 1}–{Math.min(page * limit, total)} nga {total}
              </p>
              <div className="flex gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-30 transition-colors">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Fshi shitjen #{deleteId}?</h3>
            <p className="text-sm text-slate-400 mb-6">Stoku do të rikthehet. Ky veprim nuk mund të kthehet.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-ghost flex-1">Anulo</button>
              <button onClick={confirmDelete} className="btn-danger flex-1">Fshi</button>
            </div>
          </div>
        </div>
      )}

      {batchModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setBatchModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-primary-500" /> Dëshmi Pagese e Përbashkët
              </h3>
              <button onClick={() => setBatchModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="space-y-1.5">
                {selectedSales.map(s => (
                  <div key={s.id} className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
                    <span>{s.customerName}</span>
                    <span className="font-semibold">{formatCurrency(s.paidAmount)}</span>
                  </div>
                ))}
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold border-t border-slate-200 dark:border-slate-600 pt-2 mt-1">
                  <span>TOTALI</span>
                  <span>{formatCurrency(selectedTotal)}</span>
                </div>
              </div>
              <div>
                <label className="label">Emri i prindit</label>
                <input className="input" value={batchParentName} onChange={e => setBatchParentName(e.target.value)} />
              </div>
              <div>
                <label className="label">Telefoni</label>
                <input className="input" value={batchParentPhone} onChange={e => setBatchParentPhone(e.target.value)} />
              </div>
              <div>
                <label className="label">Mënyra</label>
                <select className="input" value={batchMethod} onChange={e => setBatchMethod(e.target.value)}>
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bankë</option>
                  <option value="CARD">Kartelë</option>
                </select>
              </div>
              {batchError && <p className="text-sm text-red-500">{batchError}</p>}
            </div>
            <div className="flex justify-end gap-2 p-5 pt-0">
              <button onClick={() => setBatchModal(false)} className="btn-secondary">Anulo</button>
              <button onClick={submitBatch} disabled={batchSaving} className="btn-primary disabled:opacity-50">
                {batchSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Regjistro & Printo
              </button>
            </div>
          </div>
        </div>
      )}

      {familyReceiptPrintId && (
        <FamilyReceiptPrintModal
          familyReceiptId={familyReceiptPrintId}
          onClose={() => setFamilyReceiptPrintId(null)}
        />
      )}
    </div>
  );
}
