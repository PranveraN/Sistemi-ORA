"use client";

import { useState } from "react";
import { X, Search, Loader2, Users, CheckCircle } from "lucide-react";
import { formatCurrency, MONTHS } from "@/lib/utils";

interface FamilyChild {
  id: number;
  firstName: string;
  lastName: string;
  class: { id: number; name: string; level: string } | null;
  status: string;
  discountPct: number;
}

interface RowState {
  checked: boolean;
  amount: string;
  paidAmount: string;
  note: string;
}

interface Props {
  categoryId: number;
  categoryName: string;
  // Merr muajin (canonical, ose null për kategori jo-mujore) dhe klasën e fëmijës
  // (disa kategori, p.sh. Ushqimi, kanë çmim tjetër për klasën e parë) e kthen
  // shumën parazgjedhje — llogaritet në kohën e zgjedhjes, jo vetëm një herë te
  // kërkimi, që të përditësohet nëse stafi ndryshon periudhën pasi ka gjetur familjen.
  computeDefaultAmount: (discountPct: number, month: number | null, className: string | null) => number;
  isMonthly: boolean;
  defaultMonth: number;   // > 0 kur faqja mëmë ka zgjedhur një muaj/periudhë specifike
  schoolYearStart: number; // viti fillestar i vitit shkollor (p.sh. 2026 = "2026-2027")
  // Kur kategoria s'ka muaj të lirë (p.sh. Ushqimi, 5 periudha dy-mujore) — nëse mungon,
  // përdoret dropdown standard me 12 muaj.
  periodOptions?: { label: string; canonicalMonth: number }[];
  onClose: () => void;
  onSaved: (familyReceiptId: number) => void;
}

export default function FamilyPaymentModal({ categoryId, categoryName, computeDefaultAmount, isMonthly, defaultMonth, schoolYearStart, periodOptions, onClose, onSaved }: Props) {
  const [query, setQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searched, setSearched] = useState(false);
  const [parent, setParent] = useState<{ name: string; parentPhone: string | null } | null>(null);
  const [children, setChildren] = useState<FamilyChild[]>([]);
  const [rows, setRows] = useState<Record<number, RowState>>({});
  const [method, setMethod] = useState("CASH");
  const [selMonth, setSelMonth] = useState(defaultMonth > 0 ? defaultMonth : (periodOptions?.[0]?.canonicalMonth ?? new Date().getMonth() + 1));
  const [dueDate, setDueDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const month = isMonthly ? selMonth : null;
  // Konvencioni i të gjithë aplikacionit: muajt Shtator-Dhjetor (9-12) i takojnë
  // vitit kalendarik fillestar; Janar-Gusht (1-8) i takojnë vitit pasardhës.
  const year = isMonthly && selMonth <= 8 ? schoolYearStart + 1 : schoolYearStart;

  async function handleSearch() {
    if (!query.trim()) return;
    setSearching(true);
    setError(null);
    const isPhone = /\d/.test(query);
    const param = isPhone ? `phone=${encodeURIComponent(query)}` : `name=${encodeURIComponent(query)}`;
    const res = await fetch(`/api/families?${param}`);
    const data = await res.json();
    setSearching(false);
    setSearched(true);
    if (!res.ok || !data.children?.length) {
      setParent(null);
      setChildren([]);
      return;
    }
    setParent({ name: data.parent.name, parentPhone: data.parent.parentPhone });
    const active = (data.children as FamilyChild[]).filter(c => c.status === "ACTIVE");
    setChildren(active);
    const initialRows: Record<number, RowState> = {};
    for (const c of active) {
      initialRows[c.id] = { checked: false, amount: "0", paidAmount: "0", note: "" };
    }
    setRows(initialRows);
  }

  function toggleChild(id: number) {
    setRows(r => {
      const current = r[id];
      if (current.checked) return { ...r, [id]: { ...current, checked: false } };
      const student = children.find(c => c.id === id);
      const def = Math.max(0, computeDefaultAmount(student?.discountPct ?? 0, month, student?.class?.name ?? null));
      return { ...r, [id]: { ...current, checked: true, amount: String(def), paidAmount: String(def) } };
    });
  }
  function updateRow(id: number, field: "amount" | "paidAmount" | "note", value: string) {
    setRows(r => ({ ...r, [id]: { ...r[id], [field]: value } }));
  }

  const checkedChildren = children.filter(c => rows[c.id]?.checked);
  const total = checkedChildren.reduce((sum, c) => sum + (parseFloat(rows[c.id]?.paidAmount || "0") || 0), 0);

  async function handleSubmit() {
    if (checkedChildren.length < 2) return;
    setSaving(true);
    setError(null);
    const res = await fetch("/api/family-receipts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentName: parent?.name,
        parentPhone: parent?.parentPhone,
        method,
        children: checkedChildren.map(c => ({
          studentId: c.id,
          categoryId,
          amount: parseFloat(rows[c.id].amount) || 0,
          paidAmount: parseFloat(rows[c.id].paidAmount) || 0,
          dueDate,
          month,
          year,
          description: month ? undefined : `${categoryName} ${year}`,
          note: rows[c.id].note || undefined,
        })),
      }),
    });
    setSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Gabim gjatë ruajtjes.");
      return;
    }
    const d = await res.json();
    onSaved(d.id);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-4 h-4 text-primary-500" />
            Pagesë e Përbashkët — {categoryName}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          <div>
            <label className="form-label">Kërko familjen (telefon ose emër prindi)</label>
            <div className="flex gap-2">
              <input type="text" value={query} onChange={e => setQuery(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleSearch()}
                className="form-input flex-1" placeholder="p.sh. 04X XXX XXX ose Agron Berisha" />
              <button onClick={handleSearch} disabled={searching || !query.trim()} className="btn-secondary">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                Kërko
              </button>
            </div>
          </div>

          {searched && children.length === 0 && (
            <p className="text-sm text-slate-400 py-4 text-center">Nuk u gjet asnjë familje me këtë kërkim, ose familja ka më pak se 2 fëmijë aktivë.</p>
          )}

          {children.length > 0 && (
            <>
              <div className={`grid gap-3 ${isMonthly ? "grid-cols-3" : "grid-cols-2"}`}>
                {isMonthly && (
                  <div>
                    <label className="form-label">{periodOptions ? "Periudha" : "Muaji"}</label>
                    <select value={selMonth} onChange={e => setSelMonth(parseInt(e.target.value))} className="form-input">
                      {periodOptions
                        ? periodOptions.map(p => <option key={p.canonicalMonth} value={p.canonicalMonth}>{p.label}</option>)
                        : MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="form-label">Mënyra</label>
                  <select value={method} onChange={e => setMethod(e.target.value)} className="form-input">
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bankë</option>
                    <option value="CARD">Kartelë</option>
                    <option value="ONLINE">Online</option>
                  </select>
                </div>
                <div>
                  <label className="form-label">Afati i Pagesës</label>
                  <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="form-input" />
                </div>
              </div>

              <div className="space-y-2">
                {children.map(c => {
                  const row = rows[c.id];
                  return (
                    <div key={c.id} className={`border rounded-xl p-3 transition-colors ${row?.checked ? "border-primary-300 bg-primary-50/40 dark:bg-primary-900/10 dark:border-primary-700" : "border-slate-200 dark:border-slate-700"}`}>
                      <label className="flex items-center gap-2 cursor-pointer select-none">
                        <input type="checkbox" checked={!!row?.checked} onChange={() => toggleChild(c.id)} className="rounded accent-primary-600" />
                        <span className="font-medium text-sm text-slate-800 dark:text-slate-100">{c.firstName} {c.lastName}</span>
                        {c.class && <span className="text-xs text-slate-400">({c.class.name})</span>}
                        {c.discountPct > 0 && <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">-{c.discountPct}%</span>}
                      </label>
                      {row?.checked && (
                        <div className="grid grid-cols-3 gap-2 mt-2 pl-6">
                          <div>
                            <label className="form-label text-xs">Shuma (€)</label>
                            <input type="number" value={row.amount} onChange={e => updateRow(c.id, "amount", e.target.value)} className="form-input" min="0" step="0.01" />
                          </div>
                          <div>
                            <label className="form-label text-xs">Paguar (€)</label>
                            <input type="number" value={row.paidAmount} onChange={e => updateRow(c.id, "paidAmount", e.target.value)} className="form-input" min="0" step="0.01" />
                          </div>
                          <div>
                            <label className="form-label text-xs">Shënim</label>
                            <input type="text" value={row.note} onChange={e => updateRow(c.id, "note", e.target.value)} className="form-input" />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {checkedChildren.length > 0 && checkedChildren.length < 2 && (
                <p className="text-xs text-amber-600 dark:text-amber-400">Zgjidh të paktën 2 fëmijë për pagesë të përbashkët.</p>
              )}

              {checkedChildren.length >= 2 && (
                <div className="flex items-center justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 rounded-xl">
                  <span className="text-sm text-emerald-700 dark:text-emerald-400 font-medium">Totali për {checkedChildren.length} fëmijë</span>
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">{formatCurrency(total)}</span>
                </div>
              )}
            </>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 p-5 pt-0 border-t border-slate-100 dark:border-slate-700">
          <button onClick={onClose} className="btn-secondary">Anulo</button>
          <button onClick={handleSubmit} disabled={saving || checkedChildren.length < 2} className="btn-primary disabled:opacity-50">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            Regjistro & Printo
          </button>
        </div>
      </div>
    </div>
  );
}
