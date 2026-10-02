"use client";

import { useEffect, useState } from "react";
import { X, Search, Loader2, AlertTriangle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import type { FamilyProfileData } from "./FamilyProfile";

interface ListRow { id: number; label: string; contactName: string | null; children: { firstName: string; className: string | null }[] }

// "Bashko me familje tjetër" — tregon të dyja familjet krah për krah; pas
// konfirmimit, fëmijët (me prindërit/numrat), shënimet dhe dokumentet kalojnë
// te familja që MBAHET. Asgjë s'bashkohet pa konfirmim.
export default function MergeFamiliesDialog({ current, year, onClose, onMerged }: {
  current: FamilyProfileData; year: number; onClose: () => void; onMerged: (keptId: number) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<ListRow[]>([]);
  const [other, setOther] = useState<FamilyProfileData | null>(null);
  const [keep, setKeep] = useState<"current" | "other">("current");
  const [confirmed, setConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (q.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/families/list?q=${encodeURIComponent(q.trim())}&limit=8&year=${year}`);
      const d = await r.json().catch(() => ({}));
      setResults((d.rows ?? []).filter((x: ListRow) => x.id !== current.id));
    }, 300);
    return () => clearTimeout(t);
  }, [q, current.id, year]);

  async function pick(id: number) {
    setError("");
    const r = await fetch(`/api/families/${id}?year=${year}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || "Ngarkimi dështoi."); return; }
    setOther(d); setResults([]); setQ("");
  }

  async function merge() {
    if (!other || !confirmed) return;
    const source = keep === "current" ? other : current;
    const target = keep === "current" ? current : other;
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/families/${source.id}/merge`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetId: target.id }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Bashkimi dështoi."); return; }
      onMerged(target.id);
    } catch { setError("Gabim rrjeti — provo përsëri."); }
    finally { setBusy(false); }
  }

  const Col = ({ f, role }: { f: FamilyProfileData; role: "current" | "other" }) => (
    <label className={`flex-1 min-w-[200px] rounded-xl border-2 p-3 cursor-pointer ${keep === role ? "border-primary-500 bg-primary-50/40 dark:bg-primary-900/10" : "border-slate-200 dark:border-slate-700"}`}>
      <div className="flex items-center gap-2 mb-2">
        <input type="radio" name="keep" checked={keep === role} onChange={() => setKeep(role)} />
        <span className="font-semibold">Familja {f.label}</span>
        <span className="text-xs text-slate-400">{keep === role ? "· mbahet" : "· bashkohet"}</span>
      </div>
      <p className="text-xs text-slate-500 mb-1">Fëmijët:</p>
      <ul className="text-sm space-y-0.5 mb-2">{f.children.map(c => <li key={c.id}>{c.firstName} {c.lastName}{c.className ? ` (${c.className})` : ""}</li>)}</ul>
      <p className="text-xs text-slate-500 mb-1">Prindërit:</p>
      <ul className="text-xs space-y-0.5 mb-2">{f.parents.map((p, i) => <li key={i}>{p.name} · {p.phones.join(", ") || "pa telefon"}</li>)}</ul>
      <p className="text-xs text-slate-400">{f.notes.length} shënime · {f.documents.length} dokumente{f.totals ? ` · borxh ${formatCurrency(f.totals.balance)}` : ""}</p>
    </label>
  );

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Bashko familjet" onClick={e => e.stopPropagation()} className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold">Bashko me familje tjetër</h3>
          <button onClick={onClose} disabled={busy} aria-label="Mbyll" className="p-1 rounded text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">
          {!other ? (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input autoFocus value={q} onChange={e => setQ(e.target.value)} className="form-input pl-9" placeholder="Kërko familjen tjetër (prind, fëmijë, telefon)..." />
              {results.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {results.map(r => (
                    <button key={r.id} onClick={() => pick(r.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                      <b>Familja {r.label}</b> <span className="text-slate-400">· {r.children.map(c => `${c.firstName}${c.className ? ` ${c.className}` : ""}`).join(" · ")}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <>
              <div className="flex flex-wrap gap-3">
                <Col f={current} role="current" />
                <Col f={other} role="other" />
              </div>
              <p className="text-xs text-slate-500 flex items-start gap-1.5">
                <AlertTriangle className="w-4 h-4 text-orange-500 shrink-0" />
                Fëmijët, prindërit/numrat, shënimet dhe dokumentet e familjes që bashkohet kalojnë te familja që mbahet; ajo tjetër fshihet.
                Pagesat s&apos;preken. Regjistrohet te historiku i fëmijëve.
              </p>
              <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> E konfirmoj: këto janë e njëjta familje.</label>
              <button onClick={() => { setOther(null); setConfirmed(false); }} className="text-xs text-primary-600">Zgjidh familje tjetër</button>
            </>
          )}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 p-5 border-t border-slate-100 dark:border-slate-700">
          <button onClick={onClose} disabled={busy} className="btn-secondary">Anulo</button>
          <button onClick={merge} disabled={busy || !other || !confirmed} className="btn-primary">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Bashko</button>
        </div>
      </div>
    </div>
  );
}
