"use client";

import { useMemo, useState } from "react";
import { X, Loader2, Package, Search, ClipboardList } from "lucide-react";
import type { PendingItem } from "../admin/types";

// "+ Krijo porosi të re" (Materialet → Porositë): porosi me furnitor nga
// katalogu, çmime dhe sasi të zgjedhura — e njëjta logjikë si më parë te
// /materiale/porosite. Krijohet si "Në pritje" (draft) dhe shënohet "Porositur" më pas.

interface Sipartner { id: number; emri: string }
interface LineGroup {
  key: string; materialId: number | null; customItemName: string | null; materialName: string;
  color: string | null; unit: string; supplierId: number | null; contributions: PendingItem[];
}
interface LineState { checked: Record<number, boolean>; quantity: Record<number, number>; unitPrice: string }

export default function OrderBuilderModal({ pending, onClose, onCreated }: { pending: PendingItem[]; onClose: () => void; onCreated: (orderId: number) => void }) {
  const groups = useMemo<LineGroup[]>(() => {
    const map = new Map<string, LineGroup>();
    for (const it of pending) {
      const key = it.isCustom ? `custom-${it.requestItemId}` : `mat-${it.materialId}-${it.color ?? ""}`;
      if (!map.has(key)) {
        map.set(key, {
          key, materialId: it.materialId, customItemName: it.isCustom ? it.materialName : null,
          materialName: it.materialName ?? "Artikull", color: it.color, unit: it.unit, supplierId: it.supplierId, contributions: [],
        });
      }
      map.get(key)!.contributions.push(it);
    }
    return [...map.values()];
  }, [pending]);

  const [lineStates, setLineStates] = useState<Record<string, LineState>>(() => {
    const initial: Record<string, LineState> = {};
    for (const g of groups) {
      const checked: Record<number, boolean> = {};
      const quantity: Record<number, number> = {};
      for (const c of g.contributions) { checked[c.requestItemId] = true; quantity[c.requestItemId] = c.remaining; }
      initial[g.key] = { checked, quantity, unitPrice: "" };
    }
    return initial;
  });
  const single = [...new Set(groups.map(g => g.supplierId).filter(Boolean))];
  const [supplierId, setSupplierId] = useState<number | null>(single.length === 1 ? (single[0] as number) : null);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [suggestions, setSuggestions] = useState<Sipartner[]>([]);
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setLine = (key: string, patch: Partial<LineState>) => setLineStates(s => ({ ...s, [key]: { ...s[key], ...patch } }));

  async function fetchSuppliers(q: string) {
    setSupplierQuery(q); setSupplierId(null);
    if (q.trim().length < 2) { setSuggestions([]); return; }
    const res = await fetch(`/api/sipartner?q=${encodeURIComponent(q)}`);
    if (res.ok) setSuggestions(((await res.json()) as Sipartner[]).filter(s => s.id).slice(0, 8));
  }

  const lines = useMemo(() => groups.map(g => {
    const st = lineStates[g.key];
    if (!st) return null;
    const contributions = g.contributions
      .filter(c => st.checked[c.requestItemId] && (st.quantity[c.requestItemId] ?? 0) > 0)
      .map(c => ({ requestItemId: c.requestItemId, quantity: Math.min(st.quantity[c.requestItemId], c.remaining) }));
    if (!contributions.length) return null;
    const quantity = contributions.reduce((s, c) => s + c.quantity, 0);
    const unitPrice = st.unitPrice ? parseFloat(st.unitPrice.replace(",", ".")) : null;
    return { group: g, contributions, quantity, unitPrice, lineTotal: unitPrice ? Math.round(quantity * unitPrice * 100) / 100 : null };
  }).filter((l): l is NonNullable<typeof l> => l !== null), [groups, lineStates]);
  const total = lines.reduce((s, l) => s + (l.lineTotal ?? 0), 0);

  async function submit() {
    if (!lines.length) { setError("Zgjidh të paktën një artikull për porosi."); return; }
    setSaving(true); setError("");
    const res = await fetch("/api/material-orders", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplierId: supplierId || undefined, expectedDeliveryDate: expected || undefined, notes: notes || undefined,
        lines: lines.map(l => ({
          materialId: l.group.materialId ?? undefined, customItemName: l.group.customItemName ?? undefined,
          color: l.group.color ?? undefined, unit: l.group.unit, unitPrice: l.unitPrice ?? undefined, contributions: l.contributions,
        })),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(d.error || "Diçka shkoi keq."); return; }
    onCreated(d.id);
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === e.currentTarget && !saving) onClose(); }}
      onKeyDown={e => { if (e.key === "Escape" && !saving) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="ob-title" className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <h2 id="ob-title" className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><ClipboardList className="w-4 h-4 text-primary-500" /> Krijo porosi të re</h2>
          <button type="button" onClick={onClose} disabled={saving} aria-label="Mbyll" className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <p role="alert" className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</p>}
          {groups.map(g => {
            const st = lineStates[g.key];
            if (!st) return null;
            return (
              <div key={g.key} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                  <p className="font-semibold text-slate-800 dark:text-white text-sm">{g.materialName}{g.color && <span className="font-normal text-slate-500"> ({g.color})</span>}</p>
                  <div className="relative w-28">
                    <input inputMode="decimal" value={st.unitPrice} onChange={e => setLine(g.key, { unitPrice: e.target.value })}
                      aria-label={`Çmimi për njësi i ${g.materialName}`} className="form-input text-sm pr-6" placeholder="Çmimi/njësi" />
                    <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">€</span>
                  </div>
                </div>
                {g.contributions.map(c => (
                  <label key={c.requestItemId} className="flex items-center gap-2 text-sm py-1">
                    <input type="checkbox" checked={st.checked[c.requestItemId] ?? false}
                      onChange={() => setLine(g.key, { checked: { ...st.checked, [c.requestItemId]: !st.checked[c.requestItemId] } })} />
                    <span className="flex-1 text-slate-600 dark:text-slate-300">{c.teacherName} <span className="text-slate-400 text-xs">(mbetur {c.remaining} {c.unit})</span></span>
                    <input type="number" min={1} max={c.remaining} value={st.quantity[c.requestItemId] ?? c.remaining} disabled={!st.checked[c.requestItemId]}
                      aria-label={`Sasia për ${c.teacherName}`}
                      onChange={e => setLine(g.key, { quantity: { ...st.quantity, [c.requestItemId]: Math.min(c.remaining, Math.max(1, parseInt(e.target.value) || 1)) } })}
                      className="form-input w-16 text-sm py-1 disabled:opacity-40" />
                  </label>
                ))}
              </div>
            );
          })}
          <div className="relative">
            <label className="form-label" htmlFor="ob-supplier">Furnitori (opsionale)</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden />
              <input id="ob-supplier" value={supplierQuery} onChange={e => fetchSuppliers(e.target.value)} className="form-input pl-9"
                placeholder={supplierId ? "Furnitori i caktuar te katalogu — kërko për ta ndryshuar" : "Kërko furnitor..."} />
            </div>
            {suggestions.length > 0 && !supplierId && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {suggestions.map(s => (
                  <button key={s.id} type="button" onClick={() => { setSupplierId(s.id); setSupplierQuery(s.emri); setSuggestions([]); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700">{s.emri}</button>
                ))}
              </div>
            )}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className="form-label" htmlFor="ob-date">Data e pritur e dorëzimit</label><input id="ob-date" type="date" value={expected} onChange={e => setExpected(e.target.value)} className="form-input" /></div>
            <div><label className="form-label" htmlFor="ob-notes">Shënim (opsionale)</label><input id="ob-notes" value={notes} onChange={e => setNotes(e.target.value)} className="form-input" /></div>
          </div>
          {total > 0 && <p className="text-sm text-slate-600 dark:text-slate-300 text-right">Kosto e vlerësuar: <b>{total.toFixed(2)} €</b></p>}
        </div>
        <div className="flex justify-end gap-2 p-5 pt-0">
          <button type="button" onClick={onClose} disabled={saving} className="btn-secondary">Anulo</button>
          <button type="button" onClick={submit} disabled={saving || !lines.length} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />} Krijo porosinë
          </button>
        </div>
      </div>
    </div>
  );
}
