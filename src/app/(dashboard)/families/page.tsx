"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import Link from "next/link";
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from "@/lib/utils";
import {
  Users, Phone, MapPin, Eye, FileSignature,
  CheckCircle, AlertCircle, Clock, ChevronDown, ChevronUp,
  Receipt, X, Plus, Trash2, Loader2,
} from "lucide-react";

interface InvoiceItem {
  description: string;
  quantity: number;
  unitPrice: number;
  studentId: number | null;
  checked: boolean;
}

interface InvoiceModal {
  open: boolean;
  clientName: string;
  vatRate: string;
  dueDate: string;
  notes: string;
  items: InvoiceItem[];
  saving: boolean;
  createdId: number | null;
}

interface Child {
  id: number;
  firstName: string;
  lastName: string;
  personalNumber: string | null;
  diaryNumber: string | null;
  class: { id: number; name: string; level: string } | null;
  status: string;
  enrollDate: string;
  discountPct: number;
  finalPrice: number;
  totalPaid: number;
  debt: number;
  kontrata: string | null;
  byCategory: Record<string, { paid: number; final: number; status: string }>;
}

interface Parent {
  name: string;
  fatherName: string | null;
  fatherPhone: string | null;
  motherName: string | null;
  motherPhone: string | null;
  parentPhone: string | null;
  address: string | null;
}

interface FamilyData {
  parent: Parent;
  children: Child[];
  summary: { totalFinal: number; totalPaid: number; totalDebt: number };
}

export default function FamiliesPage() {
  const searchParams = useSearchParams();
  const router       = useRouter();
  const phoneParam   = searchParams.get("phone") || "";
  const nameParam    = searchParams.get("name")  || "";

  const [query, setQuery]   = useState(phoneParam || nameParam);
  const [data, setData]     = useState<FamilyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});

  const fetchFamily = useCallback(async (q: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);

    const isPhone = /^[+\d\s]+$/.test(q.trim());
    const params  = isPhone ? `phone=${encodeURIComponent(q.trim())}` : `name=${encodeURIComponent(q.trim())}`;

    const res = await fetch(`/api/families?${params}`);
    const json = await res.json();

    if (!res.ok) { setError(json.error); setLoading(false); return; }
    if (!json.children?.length) { setError("Nuk u gjet asnjë familje me këto të dhëna."); setLoading(false); return; }

    setData(json);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (phoneParam) fetchFamily(phoneParam);
    else if (nameParam) fetchFamily(nameParam);
  }, [phoneParam, nameParam, fetchFamily]);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    if (!q) return;
    const isPhone = /^[+\d\s]+$/.test(q);
    router.push(`/families?${isPhone ? "phone" : "name"}=${encodeURIComponent(q)}`);
    fetchFamily(q);
  }

  function toggleExpand(id: number) {
    setExpanded(prev => ({ ...prev, [id]: !prev[id] }));
  }

  /* ── Fatura e familjes ── */
  const [inv, setInv] = useState<InvoiceModal>({
    open: false, clientName: "", vatRate: "0", dueDate: "", notes: "",
    items: [], saving: false, createdId: null,
  });

  function openInvoiceModal() {
    if (!data) return;
    const p = data.parent;
    const parentName = p.fatherName || p.motherName || p.name || "";
    const items: InvoiceItem[] = data.children.map(ch => ({
      description: `Shkollimi — ${ch.firstName} ${ch.lastName}${ch.class ? ` (${ch.class.name})` : ""}`,
      quantity: 1,
      unitPrice: ch.finalPrice,
      studentId: ch.id,
      checked: true,
    }));
    setInv({ open: true, clientName: parentName, vatRate: "0", dueDate: "", notes: "", items, saving: false, createdId: null });
  }

  function updItem(i: number, field: keyof InvoiceItem, val: string | number | boolean) {
    setInv(prev => ({
      ...prev,
      items: prev.items.map((it, idx) => idx !== i ? it : { ...it, [field]: val }),
    }));
  }

  function addItem() {
    setInv(prev => ({ ...prev, items: [...prev.items, { description: "", quantity: 1, unitPrice: 0, studentId: null, checked: true }] }));
  }

  function removeItem(i: number) {
    setInv(prev => ({ ...prev, items: prev.items.filter((_, idx) => idx !== i) }));
  }

  async function submitInvoice() {
    const activeItems = inv.items.filter(it => it.checked && it.description.trim() && it.unitPrice > 0);
    if (!activeItems.length || !inv.clientName.trim()) return;
    setInv(prev => ({ ...prev, saving: true }));

    // Gjej studentId-in e parë për lidhje (fatura regjistrohet te nxënësi i parë)
    const primaryStudentId = activeItems.find(it => it.studentId)?.studentId
      ?? data?.children[0]?.id;

    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "INVOICE",
        studentId: primaryStudentId,
        vatRate: parseFloat(inv.vatRate) || 0,
        dueDate: inv.dueDate || null,
        notes: inv.notes || null,
        clientName: inv.clientName,
        items: activeItems.map(it => ({
          description: it.description,
          quantity: it.quantity,
          unitPrice: it.unitPrice,
          total: it.quantity * it.unitPrice,
        })),
      }),
    });

    if (res.ok) {
      const created = await res.json();
      setInv(prev => ({ ...prev, saving: false, createdId: created.id }));
    } else {
      setInv(prev => ({ ...prev, saving: false }));
      alert("Gabim gjatë krijimit të faturës.");
    }
  }

  const invTotal = inv.items.filter(it => it.checked).reduce((s, it) => s + it.quantity * it.unitPrice, 0);
  const invVat   = invTotal * (parseFloat(inv.vatRate) || 0) / 100;

  const p = data?.parent;

  return (
    <>
      <Header title="Profili i Familjes" />
      <div className="p-6 space-y-6 animate-fade-in max-w-5xl mx-auto">

        {/* Search bar */}
        <form onSubmit={handleSearch} className="flex gap-3">
          <div className="relative flex-1">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="Kërko me emër prindi ose numër telefoni..."
              className="form-input pl-9 w-full"
              autoFocus
            />
          </div>
          <button type="submit" className="btn-primary px-6">Kërko</button>
        </form>

        {loading && (
          <div className="flex items-center justify-center py-16">
            <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
          </div>
        )}

        {error && !loading && (
          <div className="card p-6 text-center text-slate-400">{error}</div>
        )}

        {data && !loading && (
          <>
            {/* Parent card */}
            <div className="card p-6">
              <div className="flex flex-col sm:flex-row sm:items-start gap-5">
                <div className="w-16 h-16 rounded-2xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center shrink-0">
                  <Users className="w-8 h-8 text-primary-600 dark:text-primary-400" />
                </div>
                <div className="flex-1 space-y-3">
                  <div>
                    <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                      Familja {data.children[0]?.lastName}
                    </h2>
                    <p className="text-sm text-slate-500">{data.children.length} fëmijë të regjistruar</p>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                    {p?.fatherName && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400 text-xs w-14 shrink-0">Babai</span>
                        <span className="font-medium">{p.fatherName}</span>
                        {p.fatherPhone && (
                          <a href={`tel:${p.fatherPhone}`} className="flex items-center gap-1 text-primary-600 hover:underline ml-1">
                            <Phone className="w-3 h-3" />{p.fatherPhone}
                          </a>
                        )}
                      </div>
                    )}
                    {p?.motherName && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400 text-xs w-14 shrink-0">Nëna</span>
                        <span className="font-medium">{p.motherName}</span>
                        {p.motherPhone && (
                          <a href={`tel:${p.motherPhone}`} className="flex items-center gap-1 text-primary-600 hover:underline ml-1">
                            <Phone className="w-3 h-3" />{p.motherPhone}
                          </a>
                        )}
                      </div>
                    )}
                    {!p?.fatherName && !p?.motherName && p?.name && (
                      <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300">
                        <span className="text-slate-400 text-xs w-14 shrink-0">Prindi</span>
                        <span className="font-medium">{p.name}</span>
                        {p.parentPhone && (
                          <a href={`tel:${p.parentPhone}`} className="flex items-center gap-1 text-primary-600 hover:underline ml-1">
                            <Phone className="w-3 h-3" />{p.parentPhone}
                          </a>
                        )}
                      </div>
                    )}
                    {p?.address && (
                      <div className="flex items-center gap-2 text-slate-500">
                        <MapPin className="w-3.5 h-3.5 shrink-0" />
                        <span>{p.address}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Summary financiar */}
                <div className="flex flex-col gap-2 sm:items-end">
                  <div className="flex gap-3">
                    <div className="text-center px-4 py-2 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl">
                      <p className="text-xs text-slate-400 mb-0.5">Paguar</p>
                      <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(data.summary.totalPaid)}</p>
                    </div>
                    <div className={`text-center px-4 py-2 rounded-xl ${data.summary.totalDebt > 0 ? "bg-red-50 dark:bg-red-900/20" : "bg-slate-50 dark:bg-slate-800"}`}>
                      <p className="text-xs text-slate-400 mb-0.5">Borxhi</p>
                      <p className={`text-lg font-bold ${data.summary.totalDebt > 0 ? "text-red-600 dark:text-red-400" : "text-slate-400"}`}>
                        {data.summary.totalDebt > 0 ? formatCurrency(data.summary.totalDebt) : "✓ Pa borxh"}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">Totali familjes: {formatCurrency(data.summary.totalFinal)}</p>
                  <button onClick={openInvoiceModal} className="btn-primary text-xs mt-1">
                    <Receipt className="w-3.5 h-3.5" /> Gjenero Faturë
                  </button>
                </div>
              </div>
            </div>

            {/* Fëmijët */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Fëmijët</h3>
              {data.children.map(child => {
                const isExpanded = !!expanded[child.id];
                const cats = Object.entries(child.byCategory);
                return (
                  <div key={child.id} className="card overflow-hidden">
                    {/* Row kryesor */}
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 p-5">
                      {/* Info nxënësi */}
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-1">
                          <Link href={`/students/${child.id}`} className="text-lg font-bold text-slate-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400 transition-colors">
                            {child.firstName} {child.lastName}
                          </Link>
                          {child.class && (
                            <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded text-xs font-semibold">
                              {child.class.name}
                            </span>
                          )}
                          <span className={`badge ${getStatusColor(child.status)}`}>
                            {getStatusLabel(child.status)}
                          </span>
                          {child.discountPct > 0 && (
                            <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                              -{child.discountPct}%
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                          {child.diaryNumber && <span>Ditar #{child.diaryNumber}</span>}
                          {child.personalNumber && <span>NP: {child.personalNumber}</span>}
                          <span>Regjistruar: {formatDate(child.enrollDate)}</span>
                        </div>
                      </div>

                      {/* Financat */}
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-slate-400 mb-0.5">Çmimi final</p>
                          <p className="font-bold text-slate-800 dark:text-slate-200">{formatCurrency(child.finalPrice)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400 mb-0.5">Paguar</p>
                          <p className="font-semibold text-emerald-600 dark:text-emerald-400">{formatCurrency(child.totalPaid)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400 mb-0.5">Borxhi</p>
                          {child.debt > 0
                            ? <p className="font-bold text-red-600 dark:text-red-400">{formatCurrency(child.debt)}</p>
                            : <p className="text-emerald-500 text-xs font-medium">✓ Pa borxh</p>}
                        </div>

                        {/* Veprime */}
                        <div className="flex items-center gap-1.5 ml-2">
                          <Link href={`/students/${child.id}`} className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors" title="Shiko profilin">
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link href={`/sekretaria/kontratat-nxenesve?studentId=${child.id}`} className="p-2 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors" title="Kontrata">
                            <FileSignature className="w-4 h-4" />
                          </Link>
                          {cats.length > 0 && (
                            <button onClick={() => toggleExpand(child.id)} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" title="Shiko pagesat">
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Detajet e pagesave sipas kategorisë */}
                    {isExpanded && cats.length > 0 && (
                      <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-4 bg-slate-50 dark:bg-slate-800/50">
                        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Pagesat sipas kategorisë</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                          {cats.map(([catName, catData]) => {
                            const isPaid    = catData.status === "PAID";
                            const isPartial = catData.status === "PARTIAL";
                            const isOverdue = catData.status === "OVERDUE";
                            return (
                              <div key={catName} className={`flex items-center gap-3 p-3 rounded-xl border ${isPaid ? "border-emerald-200 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-900/20" : isOverdue ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20" : isPartial ? "border-blue-200 bg-blue-50 dark:border-blue-800 dark:bg-blue-900/20" : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"}`}>
                                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${isPaid ? "bg-emerald-100 dark:bg-emerald-900/40" : isOverdue ? "bg-red-100 dark:bg-red-900/40" : "bg-slate-100 dark:bg-slate-700"}`}>
                                  {isPaid    && <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />}
                                  {isOverdue && <AlertCircle className="w-4 h-4 text-red-500" />}
                                  {!isPaid && !isOverdue && <Clock className="w-4 h-4 text-slate-400" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-200 truncate">{catName}</p>
                                  <p className="text-xs text-slate-500">
                                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(catData.paid)}</span>
                                    {" / "}
                                    <span>{formatCurrency(catData.final)}</span>
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {!data && !loading && !error && (
          <div className="card p-12 text-center">
            <Users className="w-12 h-12 text-slate-200 dark:text-slate-700 mx-auto mb-4" />
            <p className="text-slate-400 text-sm">Kërko me emrin e prindit ose numrin e telefonit</p>
            <p className="text-slate-300 dark:text-slate-600 text-xs mt-1">P.sh: Besart Rrahmani ose +38349559063</p>
          </div>
        )}
      </div>

      {/* ── Modali i faturës ── */}
      {inv.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">

            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 bg-primary-50 dark:bg-primary-900/30 rounded-xl flex items-center justify-center">
                  <Receipt className="w-4.5 h-4.5 text-primary-600" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-800 dark:text-white text-sm">Gjenero Faturë Familjeje</h3>
                  <p className="text-xs text-slate-400">Faturë e rregullt — INVOICE</p>
                </div>
              </div>
              <button onClick={() => setInv(prev => ({ ...prev, open: false }))}
                className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Success state */}
            {inv.createdId ? (
              <div className="flex-1 flex flex-col items-center justify-center gap-5 p-10 text-center">
                <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
                <div>
                  <h4 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Fatura u krijua!</h4>
                  <p className="text-sm text-slate-400">Fatura është gati dhe mund ta shikosh ose printosh.</p>
                </div>
                <div className="flex gap-3">
                  <button onClick={() => setInv(prev => ({ ...prev, open: false, createdId: null }))}
                    className="btn-secondary">Mbyll</button>
                  <Link href={`/invoices/${inv.createdId}`} className="btn-primary">
                    <Eye className="w-4 h-4" /> Shiko Faturën
                  </Link>
                </div>
              </div>
            ) : (
              <>
                {/* Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-5">

                  {/* Emri i klientit + data */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">Emri i klientit (prindi) *</label>
                      <input
                        type="text"
                        className="form-input"
                        value={inv.clientName}
                        onChange={e => setInv(prev => ({ ...prev, clientName: e.target.value }))}
                        placeholder="Emri i prindit..."
                      />
                    </div>
                    <div>
                      <label className="form-label">Afati i pagesës</label>
                      <input
                        type="date"
                        className="form-input"
                        value={inv.dueDate}
                        onChange={e => setInv(prev => ({ ...prev, dueDate: e.target.value }))}
                      />
                    </div>
                  </div>

                  {/* Zërat */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="form-label mb-0">Zërat e faturës</label>
                      <button onClick={addItem} className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1 font-medium">
                        <Plus className="w-3.5 h-3.5" /> Shto zë
                      </button>
                    </div>

                    <div className="space-y-2">
                      {/* Header kolonat */}
                      <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider px-1">
                        <div className="col-span-1" />
                        <div className="col-span-5">Përshkrimi</div>
                        <div className="col-span-2 text-center">Sasi</div>
                        <div className="col-span-3 text-right">Çmimi (€)</div>
                        <div className="col-span-1" />
                      </div>

                      {inv.items.map((it, i) => (
                        <div key={i} className={`grid grid-cols-12 gap-2 items-center rounded-lg p-1.5 transition-colors ${it.checked ? "" : "opacity-40"}`}>
                          <div className="col-span-1 flex justify-center">
                            <input type="checkbox" checked={it.checked}
                              onChange={e => updItem(i, "checked", e.target.checked)}
                              className="w-4 h-4 rounded accent-primary-600 cursor-pointer" />
                          </div>
                          <div className="col-span-5">
                            <input type="text" value={it.description}
                              onChange={e => updItem(i, "description", e.target.value)}
                              className="form-input text-sm py-1.5"
                              placeholder="Përshkrimi..." />
                          </div>
                          <div className="col-span-2">
                            <input type="number" value={it.quantity} min={1}
                              onChange={e => updItem(i, "quantity", parseInt(e.target.value) || 1)}
                              className="form-input text-sm py-1.5 text-center" />
                          </div>
                          <div className="col-span-3">
                            <input type="number" value={it.unitPrice} min={0}
                              onChange={e => updItem(i, "unitPrice", parseFloat(e.target.value) || 0)}
                              className="form-input text-sm py-1.5 text-right" />
                          </div>
                          <div className="col-span-1 flex justify-center">
                            <button onClick={() => removeItem(i)}
                              className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* TVSH + shënime */}
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="form-label">TVSH (%)</label>
                      <input type="number" min={0} max={100} className="form-input"
                        value={inv.vatRate}
                        onChange={e => setInv(prev => ({ ...prev, vatRate: e.target.value }))} />
                    </div>
                    <div>
                      <label className="form-label">Shënime</label>
                      <input type="text" className="form-input"
                        placeholder="opsionale..."
                        value={inv.notes}
                        onChange={e => setInv(prev => ({ ...prev, notes: e.target.value }))} />
                    </div>
                  </div>
                </div>

                {/* Footer me totalet */}
                <div className="border-t border-slate-200 dark:border-slate-700 px-6 py-4 bg-slate-50 dark:bg-slate-800/50 shrink-0">
                  <div className="flex items-end justify-between">
                    <div className="space-y-1 text-sm">
                      <div className="flex gap-8">
                        <span className="text-slate-500">Nëntotali:</span>
                        <span className="font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(invTotal)}</span>
                      </div>
                      {invVat > 0 && (
                        <div className="flex gap-8">
                          <span className="text-slate-500">TVSH ({inv.vatRate}%):</span>
                          <span className="font-semibold text-slate-600">{formatCurrency(invVat)}</span>
                        </div>
                      )}
                      <div className="flex gap-8 pt-1 border-t border-slate-200 dark:border-slate-600">
                        <span className="font-bold text-slate-700 dark:text-slate-200">TOTALI:</span>
                        <span className="font-bold text-primary-600 text-base">{formatCurrency(invTotal + invVat)}</span>
                      </div>
                    </div>
                    <div className="flex gap-3">
                      <button onClick={() => setInv(prev => ({ ...prev, open: false }))} className="btn-secondary">
                        Anulo
                      </button>
                      <button
                        onClick={submitInvoice}
                        disabled={inv.saving || !inv.clientName.trim() || inv.items.filter(it => it.checked).length === 0}
                        className="btn-primary"
                      >
                        {inv.saving
                          ? <><Loader2 className="w-4 h-4 animate-spin" /> Duke krijuar...</>
                          : <><Receipt className="w-4 h-4" /> Krijo Faturën</>}
                      </button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
