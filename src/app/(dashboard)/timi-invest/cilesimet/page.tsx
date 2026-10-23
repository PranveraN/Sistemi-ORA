"use client";

import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";

// Moduli TIMI INVEST → Cilësimet & marrëveshjet: komisioni i TIMI-t dhe rregullat e modulit.
export default function TimiCilesimetPage() {
  const [d, setD] = useState<{ komisionPct: number; iRuajtur: boolean; parazgjedhje: number } | null>(null);
  const [pct, setPct] = useState("");
  const [arsye, setArsye] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const load = () => fetch("/api/timi-invest/cilesimet").then(r => r.json()).then(j => { setD(j); setPct(String(j.komisionPct)); });
  useEffect(() => { load(); }, []);

  async function ruaj() {
    setBusy(true); setMsg("");
    const r = await fetch("/api/timi-invest/cilesimet", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ komisionPct: pct, arsye }) });
    const j = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(j.error || "Ruajtja dështoi."); return; }
    setArsye(""); setMsg("✓ U ruajt. Vlen për pagesat e ardhshme; ndryshimi u shënua te Historiku."); load();
  }

  if (!d) return <div className="card p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;
  const ndryshuar = parseFloat(pct.replace(",", ".")) !== d.komisionPct;

  return (
    <div className="space-y-4">
      <h1 className="page-title">Cilësimet & marrëveshjet</h1>

      <div className="card p-4 space-y-3 max-w-xl">
        <h2 className="font-semibold">Komisioni i TIMI Invest</h2>
        <p className="text-xs text-slate-500">TIMI paguan çmimin minus komisionin. Shuma për fëmijët = shuma në bankë ÷ (1 − komisioni); komisioni regjistrohet si shpenzim &quot;Komision TIMI Invest&quot;. Ndryshimi vlen vetëm për pagesat e ardhshme — pagesat e ruajtura e kanë përqindjen e vet.</p>
        <div className="flex gap-3 items-end flex-wrap">
          <div>
            <label className="form-label">Komisioni (%)</label>
            <input className="form-input !w-32" inputMode="decimal" value={pct} onChange={e => setPct(e.target.value)} />
          </div>
          {ndryshuar && (
            <div className="flex-1 min-w-[220px]">
              <label className="form-label">Arsyeja *</label>
              <input className="form-input" value={arsye} onChange={e => setArsye(e.target.value)} placeholder="p.sh. marrëveshje e re me TIMI nga data …" />
            </div>
          )}
          <button disabled={busy || !ndryshuar || arsye.trim().length < 3} onClick={ruaj} className="btn-primary"><Save className="w-4 h-4" />Ruaj</button>
        </div>
        <p className="text-[11px] text-slate-400">{d.iRuajtur ? "Vlera e ruajtur në cilësime." : `S'ka vlerë të ruajtur — përdoret parazgjedhja ${d.parazgjedhje}%.`} Vetëm administratori e ndryshon.</p>
        {msg && <p className="text-sm text-slate-700 dark:text-slate-200">{msg}</p>}
      </div>

      <div className="card p-4 space-y-2 max-w-3xl text-sm">
        <h2 className="font-semibold">Rregullat e modulit</h2>
        <ul className="list-disc pl-5 space-y-1 text-slate-600 dark:text-slate-300">
          <li><b>Fazat:</b> Profaturë = pa asnjë pagesë · Në proces = ka filluar pagesat · E kryer = e ka shlyer çmimin. Pezulluar/Anuluar vendosen vetëm me dorë dhe s&apos;ndryshojnë vetë.</li>
          <li><b>Çmimi / zbritja:</b> çdo ndryshim kërkon arsye dhe ruhet te Historiku. Muajt ekzistues te Shkollimi s&apos;preken vetvetiu.</li>
          <li><b>Pagesat nga TIMI:</b> s&apos;fshihen kurrë — anulohen me <b>Storno</b> (me arsye) dhe mund të kthehen saktësisht me <b>Rikthe</b>.</li>
          <li><b>Draftet</b> s&apos;prekin asnjë pagesë dhe s&apos;numërohen askund.</li>
          <li><b>Muaj i mbyllur</b> te Rakordimi: çdo pagesë/storno/rikthim në atë muaj kërkon arsye dhe shënohet te Historiku.</li>
          <li><b>Dyfishimet:</b> bashkimi çaktivizon rreshtin e dytë (s&apos;e fshin) dhe mund të kthehet.</li>
        </ul>
      </div>
    </div>
  );
}
