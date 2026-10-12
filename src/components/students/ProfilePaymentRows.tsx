"use client";

import { useState } from "react";
import { Pencil, Trash2, X, Loader2, ChevronDown, ChevronRight, AlertTriangle } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { askDeleteReason, reasonHeaders } from "@/lib/auditReason";

// Pagesat një nga një te profili i nxënësit — ndryshim i çmimit/zbritjes/pagesës/
// afatit dhe fshirje (me arsye), pa kaluar te faqja e kategorisë. Afati vendos
// vitin shkollor (muaji/viti rrjedhin prej tij, si te /api/payments/[id]).

export interface ProfilePayment {
  id: number;
  amount: number;
  finalAmount: number;
  paidAmount: number;
  balance: number;
  method: string | null;
  dueDate: string;
  paidDate: string | null;
  description: string | null;
  discount?: number | null;
  discountType?: string | null;
  scholarship?: number | null;
  note?: string | null;
  month?: number | null;
  year?: number | null;
  receiptNumber?: string | null;
}

const dayOf = (iso: string | null) => iso ? new Date(iso).toLocaleDateString("en-CA", { timeZone: "Europe/Belgrade" }) : "";
const ayLabel = (m: number | null | undefined, y: number | null | undefined) => {
  if (m == null || y == null) return null;
  const start = m >= 9 ? y : y - 1;
  return `${start}–${start + 1}`;
};
const ayOfDay = (day: string) => { const [y, m] = day.split("-").map(Number); return ayLabel(m, y); };

function describe(d: string | null): string {
  if (!d) return "Pagesë";
  if (d === "FLEX_HEADER") return "Plani fleksibël (çmimi)";
  if (d === "BORXH_VJETER") return "Borxh i vjetër";
  const m = /^(KESTI|MUAJI|FLEX_PAY|FLEX|TI_MUAJI)_(\d+)$/.exec(d);
  if (m) return ({ KESTI: "Kësti", MUAJI: "Muaji", FLEX_PAY: "Pagesë fleksibël", FLEX: "Pagesë fleksibël", TI_MUAJI: "TIMI Invest – muaji" } as Record<string, string>)[m[1]] + " " + m[2];
  return d;
}

export default function ProfilePaymentRows({ rows, canEdit, onChanged }: { rows: ProfilePayment[]; canEdit: boolean; onChanged: () => void }) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<ProfilePayment | null>(null);
  const [error, setError] = useState("");
  const sorted = [...rows].sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const noMonth = rows.filter(r => r.month == null).length;

  async function remove(p: ProfilePayment) {
    const reason = askDeleteReason(`Fshi "${describe(p.description)}" (${formatCurrency(p.finalAmount)}, paguar ${formatCurrency(p.paidAmount)})? Ky veprim s'kthehet mbrapsht.`);
    if (!reason) return;
    setError("");
    const r = await fetch(`/api/payments/${p.id}`, { method: "DELETE", headers: reasonHeaders(reason) }).catch(() => null);
    if (!r?.ok) { const d = await r?.json().catch(() => ({})); setError(d?.error || `Fshirja dështoi${r ? ` (gabim ${r.status})` : ""}.`); return; }
    onChanged();
  }

  return (
    <div className="mt-3">
      <button type="button" onClick={() => setOpen(o => !o)} className="text-xs font-semibold text-primary-600 hover:underline flex items-center gap-1">
        {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        {open ? "Fshih pagesat" : `Shfaq pagesat (${rows.length})`}
        {noMonth > 0 && <span className="ml-1 text-amber-600 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> {noMonth} pa vit shkollor</span>}
      </button>
      {open && (
        <div className="mt-2 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500">
              <tr>
                <th className="text-left px-2 py-1.5 font-medium">Përshkrimi</th>
                <th className="text-left px-2 py-1.5 font-medium">Afati · viti</th>
                <th className="text-right px-2 py-1.5 font-medium">Çmimi</th>
                <th className="text-right px-2 py-1.5 font-medium">Paguar</th>
                <th className="text-left px-2 py-1.5 font-medium">Metoda · data</th>
                {canEdit && <th className="px-2 py-1.5" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {sorted.map(p => {
                const ay = ayLabel(p.month, p.year);
                return (
                  <tr key={p.id}>
                    <td className="px-2 py-1.5 text-slate-700 dark:text-slate-200">{describe(p.description)}{p.receiptNumber && <span className="block text-[10px] text-slate-400">{p.receiptNumber}</span>}</td>
                    <td className="px-2 py-1.5 text-slate-600 dark:text-slate-300 whitespace-nowrap">
                      {formatDate(p.dueDate)} · {ay ?? <span className="text-amber-600 font-semibold">pa vit shkollor</span>}
                    </td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap">{formatCurrency(p.finalAmount)}{p.amount !== p.finalAmount && <span className="block text-[10px] text-slate-400 line-through">{formatCurrency(p.amount)}</span>}</td>
                    <td className="px-2 py-1.5 text-right whitespace-nowrap text-green-700 dark:text-green-400">{formatCurrency(p.paidAmount)}</td>
                    <td className="px-2 py-1.5 whitespace-nowrap text-slate-600 dark:text-slate-300">{p.paidAmount > 0 ? `${p.method === "BANK" ? "Bankë" : p.method === "CASH" ? "Cash" : p.method === "KOMPENSIM" ? "Kompensim" : p.method ?? "—"} · ${p.paidDate ? formatDate(p.paidDate) : "—"}` : "—"}</td>
                    {canEdit && (
                      <td className="px-2 py-1.5 whitespace-nowrap text-right">
                        <button type="button" onClick={() => setEditing(p)} title="Ndrysho" className="p-1 rounded text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-slate-700"><Pencil className="w-3.5 h-3.5" /></button>
                        <button type="button" onClick={() => remove(p)} title="Fshi" className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {error && <p role="alert" className="text-xs text-red-600 mt-1">{error}</p>}
      {editing && <EditModal p={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); onChanged(); }} />}
    </div>
  );
}

function EditModal({ p, onClose, onSaved }: { p: ProfilePayment; onClose: () => void; onSaved: () => void }) {
  const isHeader = p.description === "FLEX_HEADER";
  const [f, setF] = useState({
    amount: String(p.amount ?? 0),
    discount: String(p.discount ?? 0),
    discountType: p.discountType === "percentage" ? "percentage" : "fixed",
    scholarship: String(p.scholarship ?? 0),
    paidAmount: String(p.paidAmount ?? 0),
    method: p.method ?? "",
    dueDate: dayOf(p.dueDate),
    paidDate: dayOf(p.paidDate) || new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Belgrade" }),
    note: p.note ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF(s => ({ ...s, [k]: e.target.value }));
  const num = (v: string) => parseFloat(v.replace(",", ".")) || 0;
  const disc = f.discountType === "percentage" ? num(f.amount) * num(f.discount) / 100 : num(f.discount);
  const final = Math.max(0, num(f.amount) - disc - num(f.scholarship));
  const paid = isHeader ? 0 : num(f.paidAmount);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!f.dueDate) { setError("Vendos afatin."); return; }
    if (paid > 0 && !f.method) { setError("Zgjidh metodën e pagesës (Cash ose Bankë)."); return; }
    const [y, m] = f.dueDate.split("-").map(Number);
    setSaving(true); setError("");
    const r = await fetch(`/api/payments/${p.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: num(f.amount), discount: num(f.discount), discountType: f.discountType, scholarship: num(f.scholarship),
        paidAmount: paid, method: isHeader ? "CASH" : f.method || null, dueDate: f.dueDate, paidDate: paid > 0 ? f.paidDate : null,
        description: p.description, note: f.note || null, month: m, year: y,
      }),
    }).catch(() => null);
    setSaving(false);
    if (!r?.ok) { const d = await r?.json().catch(() => ({})); setError(d?.error || `Ruajtja dështoi${r ? ` (gabim ${r.status})` : ""}.`); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="ppe-title" className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
          <h3 id="ppe-title" className="font-bold text-slate-900 dark:text-white">Ndrysho: {describe(p.description)}</h3>
          <button type="button" onClick={onClose} aria-label="Mbyll" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3 text-sm">
          <label className="col-span-2">
            <span className="form-label">Afati (vendos vitin shkollor)</span>
            <input type="date" className="form-input" value={f.dueDate} onChange={set("dueDate")} required />
            <span className="text-[11px] text-slate-500">Viti shkollor: <b>{f.dueDate ? ayOfDay(f.dueDate) : "—"}</b></span>
          </label>
          <label><span className="form-label">Çmimi bazë (€)</span><input inputMode="decimal" className="form-input" value={f.amount} onChange={set("amount")} /></label>
          <label><span className="form-label">Zbritja</span>
            <div className="flex gap-1">
              <input inputMode="decimal" className="form-input" value={f.discount} onChange={set("discount")} />
              <select className="form-input w-16" value={f.discountType} onChange={set("discountType")}><option value="fixed">€</option><option value="percentage">%</option></select>
            </div>
          </label>
          <label><span className="form-label">Bursa (€)</span><input inputMode="decimal" className="form-input" value={f.scholarship} onChange={set("scholarship")} /></label>
          <div className="self-end pb-2 text-slate-600 dark:text-slate-300">Për t&apos;u paguar: <b>{formatCurrency(final)}</b></div>
          {!isHeader && (<>
            <label><span className="form-label">Paguar (€)</span><input inputMode="decimal" className="form-input" value={f.paidAmount} onChange={set("paidAmount")} /></label>
            <label><span className="form-label">Metoda</span>
              <select className="form-input" value={f.method} onChange={set("method")}>
                <option value="">— Zgjidh —</option><option value="CASH">Cash</option><option value="BANK">Bankë</option>
                {p.method === "CARD" && <option value="CARD">Kartelë</option>}{p.method === "ONLINE" && <option value="ONLINE">Online</option>}
                <option value="KOMPENSIM">Kompensim (marrëveshje)</option>
              </select>
            </label>
            {paid > 0 && <label className="col-span-2"><span className="form-label">Data e pagesës</span><input type="date" className="form-input" value={f.paidDate} onChange={set("paidDate")} /></label>}
            <p className="col-span-2 text-xs text-slate-500">Borxhi i mbetur: <b className={final - paid > 0 ? "text-red-600" : "text-green-600"}>{formatCurrency(Math.max(0, final - paid))}</b></p>
          </>)}
          <label className="col-span-2"><span className="form-label">Shënim</span><textarea className="form-input min-h-[60px]" value={f.note} onChange={set("note")} /></label>
          {error && <p role="alert" className="col-span-2 text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-slate-100 dark:border-slate-700">
          <button type="button" onClick={onClose} className="btn-secondary">Anulo</button>
          <button type="submit" disabled={saving} className="btn-primary">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Ruaj</button>
        </div>
      </form>
    </div>
  );
}
