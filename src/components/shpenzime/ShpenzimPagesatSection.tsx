"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { askDeleteReason, reasonHeaders } from "@/lib/auditReason";

// Pagesat pjesë-pjesë të një fature (p.sh. 2.200 € nga 17.600 €). Çdo pagesë zbret
// nga arka (cash) ose banka në datën e vet; borxhi te furnitori = pjesa e mbetur.
// Rregulli: src/lib/shpenzimPagesat.ts · API: /api/shpenzime/[id]/pagesat

interface Pagese { id: number; shuma: number; data: string; metoda: string; shenim: string | null; createdByName: string | null }
interface Gjendja { pagesat: Pagese[]; paguar: number; mbetur: number; statusi: "E_PAGUAR" | "PJESERISHT" | "E_PAPAGUAR"; shpenzim: { shuma: number } }

const METODA_LABEL: Record<string, string> = { CASH: "Cash (arka)", BANK: "Bankë", CARD: "Kartelë" };
const today = () => new Date().toISOString().split("T")[0];

export default function ShpenzimPagesatSection({ shpenzimId, onChanged }: { shpenzimId: number; onChanged: () => void }) {
  const [g, setG] = useState<Gjendja | null>(null);
  const [shuma, setShuma] = useState("");
  const [data, setData] = useState(today());
  const [metoda, setMetoda] = useState("BANK");
  const [shenim, setShenim] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const r = await fetch(`/api/shpenzime/${shpenzimId}/pagesat`);
    const j = await r.json().catch(() => ({}));
    if (r.ok) setG(j); else setError(j.error || "S'u ngarkuan pagesat.");
  }, [shpenzimId]);
  useEffect(() => { load(); }, [load]);

  async function add() {
    setError("");
    const v = parseFloat(shuma.replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) { setError("Shkruani shumën e pagesës."); return; }
    setSaving(true);
    const r = await fetch(`/api/shpenzime/${shpenzimId}/pagesat`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shuma: v, data, metoda, shenim }),
    });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) { setError(j.error || "Pagesa s'u ruajt."); return; }
    setG(j); setShuma(""); setShenim("");
    onChanged();
  }

  async function remove(p: Pagese) {
    const reason = askDeleteReason(`Fshi pagesën ${formatCurrency(p.shuma)} të ${formatDate(p.data)}?`);
    if (!reason) return;
    const r = await fetch(`/api/shpenzime/${shpenzimId}/pagesat/${p.id}`, { method: "DELETE", headers: reasonHeaders(reason) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); alert(j.error || "Fshirja dështoi."); return; }
    await load();
    onChanged();
  }

  if (!g) return <div className="py-2">{error ? <p className="text-xs text-red-600">{error}</p> : <Loader2 className="w-4 h-4 animate-spin text-primary-400" aria-label="Duke ngarkuar" />}</div>;
  const pct = g.shpenzim.shuma > 0 ? Math.min(100, (g.paguar / g.shpenzim.shuma) * 100) : 0;

  return (
    <div className="space-y-3 pt-1 border-t border-slate-100 dark:border-slate-700">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide pt-1">Pagesat e faturës</p>

      <div className="rounded-xl bg-slate-50 dark:bg-slate-800/60 p-3">
        <p className="text-sm text-slate-700 dark:text-slate-200">
          Paguar <b className="text-emerald-700 dark:text-emerald-400">{formatCurrency(g.paguar)}</b> nga <b>{formatCurrency(g.shpenzim.shuma)}</b>
          {g.mbetur > 0 ? <> — mbetet <b className="text-orange-600 dark:text-orange-400">{formatCurrency(g.mbetur)}</b></> : <> — <b className="text-emerald-700 dark:text-emerald-400">e paguar plotësisht</b></>}
        </p>
        <div className="h-1.5 rounded-full bg-slate-200 dark:bg-slate-700 mt-2 overflow-hidden" role="img" aria-label={`${pct.toFixed(0)}% e paguar`}>
          <div className="h-full bg-emerald-500" style={{ width: `${pct}%` }} />
        </div>
      </div>

      {g.pagesat.length > 0 && (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700 text-sm">
          {g.pagesat.map(p => (
            <li key={p.id} className="flex items-center gap-2 py-1.5">
              <span className="w-24 text-slate-500">{formatDate(p.data)}</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">{formatCurrency(p.shuma)}</span>
              <span className="text-xs text-slate-500">{METODA_LABEL[p.metoda] ?? p.metoda}</span>
              <span className="text-xs text-slate-400 flex-1 truncate">{[p.shenim, p.createdByName].filter(Boolean).join(" · ")}</span>
              <button type="button" onClick={() => remove(p)} aria-label="Fshi pagesën" className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {g.mbetur > 0 && (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="pg-shuma" className="form-label">Shuma e pagesës (€)</label>
            <input id="pg-shuma" inputMode="decimal" className="form-input" value={shuma} onChange={e => setShuma(e.target.value)} placeholder={g.mbetur.toFixed(2)} />
          </div>
          <div>
            <label htmlFor="pg-data" className="form-label">Data e pagesës</label>
            <input id="pg-data" type="date" className="form-input" value={data} onChange={e => setData(e.target.value)} />
          </div>
          <div>
            <label htmlFor="pg-metoda" className="form-label">Metoda</label>
            <select id="pg-metoda" className="form-input" value={metoda} onChange={e => setMetoda(e.target.value)}>
              <option value="BANK">🏦 Bankë</option>
              <option value="CASH">💵 Cash (nga arka)</option>
              <option value="CARD">💳 Kartelë</option>
            </select>
          </div>
          <div>
            <label htmlFor="pg-shenim" className="form-label">Shënim (opsional)</label>
            <input id="pg-shenim" className="form-input" value={shenim} onChange={e => setShenim(e.target.value)} maxLength={500} />
          </div>
          {error && <p role="alert" className="col-span-2 text-xs text-red-600">{error}</p>}
          <div className="col-span-2 flex justify-end">
            <button type="button" onClick={add} disabled={saving} className="btn-secondary text-sm">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Shto pagesë
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
