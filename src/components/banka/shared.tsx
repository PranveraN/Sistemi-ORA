"use client";

import { useMemo, useState } from "react";
import { Loader2, Wand2 } from "lucide-react";

// Pjesë të përbashkëta të modulit Banka (lista e lëvizjeve me klasifikim).

export const eur = (cents: number | null | undefined) =>
  cents == null ? "—" : (cents / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
export const dmy = (iso: string | null | undefined) => (iso ? iso.slice(0, 10).split("-").reverse().join(".") : "—");

export const LLOJET: Record<string, { label: string; cls: string }> = {
  E_HYRE:   { label: "E hyrë",            cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  SHPENZIM: { label: "Shpenzim",          cls: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" },
  KTHIM:    { label: "Kthim",             cls: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  FINANCIM: { label: "Financim",          cls: "bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" },
  JASHTE:   { label: "Jashtë bilancit",   cls: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
};

export interface Zer { id: number; emri: string; lloji: string; aktiv: boolean; _count?: { levizjet: number; rregullat: number } }
export interface Levizje {
  id: number; nr: number; data: string; lloji: string | null; debi: number; kredi: number; gjendja?: number | null;
  pala: string | null; pershkrimi: string | null; zerId: number | null; vitiShkollor: number | null; statusi: string; shenim: string | null;
}

const STATUS: Record<string, { t: string; c: string }> = {
  PROPOZUAR:      { t: "propozuar", c: "text-indigo-500" },
  KONFIRMUAR:     { t: "konfirmuar", c: "text-emerald-600" },
  PA_KLASIFIKUAR: { t: "pa zë", c: "text-amber-600" },
  DYFISHT:        { t: "dyfisht", c: "text-rose-600" },
};

type Filter = "all" | "pa" | "HYRJE" | "DALJE" | `z${number}`;

/** Tabela e lëvizjeve: filtra, kërkim, zgjedhje e shumëfishtë, bartje te zëri, "ruaj si rregull". */
export function LevizjetTable({ rows, zerat, readOnly, onChanged }: {
  rows: Levizje[]; zerat: Zer[]; readOnly?: boolean; onChanged: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [target, setTarget] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const zerById = useMemo(() => new Map(zerat.map(z => [z.id, z])), [zerat]);
  const aktive = zerat.filter(z => z.aktiv);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter(r => {
      if (filter === "pa" && (r.zerId !== null || r.statusi === "DYFISHT")) return false;
      if (filter === "HYRJE" && !(r.kredi > 0)) return false;
      if (filter === "DALJE" && !(r.debi > 0)) return false;
      if (filter.startsWith("z") && r.zerId !== parseInt(filter.slice(1))) return false;
      if (t && !`${r.pala ?? ""} ${r.pershkrimi ?? ""} ${r.lloji ?? ""}`.toLowerCase().includes(t)) return false;
      return true;
    });
  }, [rows, filter, q]);

  const sumK = shown.reduce((s, r) => s + r.kredi, 0), sumD = shown.reduce((s, r) => s + r.debi, 0);
  const allSel = shown.length > 0 && shown.every(r => sel.has(r.id));

  async function patch(ids: number[], body: Record<string, unknown>) {
    setBusy(true);
    const res = await fetch("/api/banka/levizjet", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ids, ...body }) });
    setBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Ruajtja dështoi."); return false; }
    onChanged();
    return true;
  }

  async function bulkMove() {
    if (!sel.size || target === "") return;
    if (await patch([...sel], { zerId: target === "null" ? null : parseInt(target) })) setSel(new Set());
  }

  async function saveRule(r: Levizje) {
    if (!r.zerId) { alert("Fillimisht zgjidh zërin e këtij rreshti, pastaj ruaje si rregull."); return; }
    const fjala = prompt(`Rregull i ri për zërin "${zerById.get(r.zerId)?.emri}".\nÇdo rresht ${r.kredi > 0 ? "hyrje" : "dalje"} që përmban këtë fjalë do ta marrë këtë zë:`, r.pala ?? "");
    if (!fjala?.trim()) return;
    const res = await fetch("/api/banka/rregullat", { method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fjala: fjala.trim(), drejtimi: r.kredi > 0 ? "HYRJE" : "DALJE", zerId: r.zerId, prioriteti: 45 }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Rregulli s'u ruajt."); return; }
    alert("Rregulli u ruajt. Kliko \"Rizbato rregullat\" që të zbatohet te rreshtat e tjerë.");
  }

  const zerOptions = (
    <>
      <option value="null">— Të paklasifikuara</option>
      {Object.entries(LLOJET).map(([k, l]) => {
        const zs = aktive.filter(z => z.lloji === k);
        return zs.length ? <optgroup key={k} label={l.label}>{zs.map(z => <option key={z.id} value={z.id}>{z.emri}</option>)}</optgroup> : null;
      })}
    </>
  );

  return (
    <div className="card overflow-hidden">
      <div className="p-3 flex flex-wrap items-center gap-2 border-b border-slate-100 dark:border-slate-700">
        <select value={filter} onChange={e => setFilter(e.target.value as Filter)} className="form-input w-auto py-1.5 text-sm">
          <option value="all">Të gjitha ({rows.length})</option>
          <option value="pa">Të paklasifikuara ({rows.filter(r => r.zerId === null && r.statusi !== "DYFISHT").length})</option>
          <option value="HYRJE">Vetëm hyrjet</option>
          <option value="DALJE">Vetëm daljet</option>
          {zerat.filter(z => rows.some(r => r.zerId === z.id)).map(z => <option key={z.id} value={`z${z.id}`}>{z.emri} ({rows.filter(r => r.zerId === z.id).length})</option>)}
        </select>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Kërko emër ose përshkrim…" className="form-input w-56 py-1.5 text-sm" />
        <span className="text-xs text-slate-500 ml-1">{shown.length} rreshta · hyrje {eur(sumK)} · dalje {eur(sumD)}</span>
        {!readOnly && (
          <div className="ml-auto flex items-center gap-2">
            <span className="text-xs text-slate-500">{sel.size} të zgjedhur →</span>
            <select value={target} onChange={e => setTarget(e.target.value)} className="form-input w-56 py-1.5 text-sm">
              <option value="">Bart te zëri…</option>
              {zerOptions}
            </select>
            <button onClick={bulkMove} disabled={busy || !sel.size || target === ""} className="btn-primary py-1.5 text-xs">
              {busy ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null} Bart
            </button>
          </div>
        )}
      </div>
      <div className="overflow-x-auto max-h-[70vh]">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/60 sticky top-0 z-10">
            <tr>
              {!readOnly && <th className="table-header w-8"><input type="checkbox" checked={allSel} onChange={() => setSel(allSel ? new Set() : new Set(shown.map(r => r.id)))} /></th>}
              <th className="table-header">Data</th>
              <th className="table-header">Pala</th>
              <th className="table-header">Përshkrimi</th>
              <th className="table-header text-right">Hyrje</th>
              <th className="table-header text-right">Dalje</th>
              <th className="table-header">Zëri</th>
              <th className="table-header">Viti shk.</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {shown.map(r => {
              const z = r.zerId ? zerById.get(r.zerId) : null;
              const st = STATUS[r.statusi];
              return (
                <tr key={r.id} className={`${sel.has(r.id) ? "bg-primary-50/50 dark:bg-primary-900/10" : ""} ${r.statusi === "DYFISHT" ? "opacity-50" : ""}`}>
                  {!readOnly && <td className="table-cell py-2"><input type="checkbox" checked={sel.has(r.id)} disabled={r.statusi === "DYFISHT"}
                    onChange={() => setSel(s => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} /></td>}
                  <td className="table-cell py-2 whitespace-nowrap text-xs">{dmy(r.data)}<div className="text-[10px] text-slate-400">#{r.nr} {r.lloji}</div></td>
                  <td className="table-cell py-2 text-xs font-medium max-w-[180px]">{r.pala || "—"}</td>
                  <td className="table-cell py-2 text-xs text-slate-500 max-w-[420px]"><div className="line-clamp-2" title={r.pershkrimi ?? ""}>{r.pershkrimi}</div></td>
                  <td className="table-cell py-2 text-right text-xs whitespace-nowrap text-emerald-700 dark:text-emerald-400">{r.kredi ? eur(r.kredi) : ""}</td>
                  <td className="table-cell py-2 text-right text-xs whitespace-nowrap text-rose-700 dark:text-rose-400">{r.debi ? eur(r.debi) : ""}</td>
                  <td className="table-cell py-2 text-xs min-w-[210px]">
                    {readOnly || r.statusi === "DYFISHT" ? (
                      <span>{z?.emri ?? "— Të paklasifikuara"}</span>
                    ) : (
                      <div className="flex items-center gap-1">
                        <select value={r.zerId ?? "null"} disabled={busy}
                          onChange={e => patch([r.id], { zerId: e.target.value === "null" ? null : parseInt(e.target.value) })}
                          className={`form-input py-1 text-xs ${r.zerId ? "" : "border-amber-300 dark:border-amber-700"}`}>
                          {zerOptions}
                        </select>
                        <button onClick={() => saveRule(r)} title="Ruaj si rregull" className="p-1 text-slate-400 hover:text-primary-600"><Wand2 className="w-3.5 h-3.5" /></button>
                      </div>
                    )}
                    {st && <div className={`text-[10px] mt-0.5 ${st.c}`}>{st.t}{z ? ` · ${LLOJET[z.lloji]?.label ?? ""}` : ""}</div>}
                  </td>
                  <td className="table-cell py-2 text-xs whitespace-nowrap">
                    {readOnly || r.statusi === "DYFISHT" ? (r.vitiShkollor ? `${r.vitiShkollor}–${r.vitiShkollor + 1}` : "—") : (
                      <select value={r.vitiShkollor ?? ""} disabled={busy} onChange={e => patch([r.id], { vitiShkollor: parseInt(e.target.value) })} className="form-input py-1 text-xs w-[104px]">
                        {[...new Set([r.vitiShkollor ?? 0, ...(r.vitiShkollor ? [r.vitiShkollor - 1, r.vitiShkollor + 1] : [])])].filter(Boolean).sort().map(y => <option key={y} value={y}>{y}–{y + 1}</option>)}
                      </select>
                    )}
                  </td>
                </tr>
              );
            })}
            {!shown.length && <tr><td colSpan={8} className="py-10 text-center text-sm text-slate-400">Asnjë rresht</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export const STATUSI_EK: Record<string, { t: string; c: string }> = {
  NE_PERPUNIM: { t: "Po lexohet", c: "bg-indigo-50 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300" },
  GABIM:       { t: "Gabim", c: "bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300" },
  DRAFT:       { t: "Draft – pret kontrollin", c: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  IMPORTUAR:   { t: "Importuar", c: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
};
