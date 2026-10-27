"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronLeft, Check, X, Loader2 } from "lucide-react";
import { ARSYET, LIDHJET, STATUSET, fmtDay, fmtTime, type KerkeseRow } from "./shared";

export default function KujdestareKerkesa({ id }: { id: number }) {
  const [k, setK] = useState<KerkeseRow | null>(null);
  const [error, setError] = useState("");
  const [refuzo, setRefuzo] = useState(false);
  const [arsye, setArsye] = useState("");
  const [busy, setBusy] = useState(false);

  const load = () => fetch(`/api/kujdestare/kerkesat/${id}`).then(async r => {
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || "Kërkesa nuk u gjet."); return; }
    setK(d);
  });
  useEffect(() => { void load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function vendos(veprimi: "APROVO" | "REFUZO") {
    setBusy(true); setError("");
    const r = await fetch(`/api/kujdestare/kerkesat/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ veprimi, arsye }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(d.error || "Veprimi dështoi."); return; }
    setRefuzo(false);
    await load();
  }

  const row = (label: string, value: React.ReactNode) => (
    <div className="flex justify-between gap-4 py-2 text-sm"><dt className="text-slate-500">{label}</dt><dd className="text-slate-900 dark:text-white text-right">{value}</dd></div>
  );

  return (
    <div className="space-y-4">
      <Link href="/kujdestare" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800"><ChevronLeft className="w-4 h-4" /> Kërkesat</Link>
      {error && <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>}
      {k && (
        <div className="card p-5 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-slate-900 dark:text-white">{k.emri}</h1>
              <p className="text-sm text-slate-500">{k.klasa}</p>
            </div>
            <span className={`px-2.5 py-1 rounded-full text-xs font-medium ${STATUSET[k.statusi]?.cls ?? ""}`}>{STATUSET[k.statusi]?.label ?? k.statusi}</span>
          </div>
          <dl className="divide-y divide-slate-100 dark:divide-slate-700">
            {row("Data dhe ora", `${fmtDay(k.data)} në ${k.ora}`)}
            {row("Arsyeja", ARSYET[k.arsyeja] ?? k.arsyeja)}
            {k.shpjegim && row("Shpjegimi", k.shpjegim)}
            {row("E merr", `${k.marresEmri} (${LIDHJET[k.marresLidhja] ?? k.marresLidhja})`)}
            {row("Telefoni i prindit", <a href={`tel:${k.telefoni}`} className="text-primary-700 hover:underline">{k.telefoni}</a>)}
            {row("Dërguar më", fmtTime(k.createdAt))}
            {k.vendosiEmri && k.vendosurAt && row("Vendosi", `${k.vendosiEmri} · ${fmtTime(k.vendosurAt)}`)}
            {k.arsyeRefuzimi && row("Arsyeja e refuzimit", k.arsyeRefuzimi)}
          </dl>

          {k.statusi === "NE_PRITJE" && !refuzo && (
            <div className="grid grid-cols-2 gap-3">
              <button onClick={() => vendos("APROVO")} disabled={busy} className="btn-primary justify-center bg-emerald-600 hover:bg-emerald-700">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Aprovo
              </button>
              <button onClick={() => setRefuzo(true)} disabled={busy} className="btn-secondary justify-center text-red-600 border-red-200">
                <X className="w-4 h-4" /> Refuzo
              </button>
            </div>
          )}
          {k.statusi === "NE_PRITJE" && refuzo && (
            <div className="space-y-2">
              <label className="block"><span className="form-label">Arsyeja e refuzimit</span>
                <input className="input" autoFocus maxLength={300} value={arsye} onChange={e => setArsye(e.target.value)} placeholder="p.sh. ka provim në atë orë" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setRefuzo(false)} className="btn-secondary justify-center">Anulo</button>
                <button onClick={() => vendos("REFUZO")} disabled={busy || arsye.trim().length < 3} className="btn-primary justify-center bg-red-600 hover:bg-red-700">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />} Refuzo
                </button>
              </div>
            </div>
          )}
          {k.statusi !== "NE_PRITJE" && <p className="text-xs text-slate-400">Vendimi është marrë. Vetëm administrata mund ta ndryshojë.</p>}
        </div>
      )}
    </div>
  );
}
