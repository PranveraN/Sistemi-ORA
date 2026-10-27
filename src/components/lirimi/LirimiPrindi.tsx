"use client";

import { useEffect, useState } from "react";
import { Loader2, Phone, KeyRound, Send, CheckCircle2, X } from "lucide-react";

type Femije = { id: number; emri: string; klasa: string | null };
type Kerkese = { id: number; studentId: number; emri: string; data: string; ora: string; arsyeja: string; marresEmri: string; statusi: string; arsyeRefuzimi: string | null };

const ARSYET: Record<string, string> = { MJEKU: "Vizitë te mjeku", FAMILJARE: "Arsye familjare", SEMUNDJE: "Sëmundje", TJETER: "Tjetër" };
const LIDHJET: Record<string, string> = { NENA: "Nëna", BABAI: "Babai", TJETER: "Tjetër" };
const STATUSET: Record<string, { label: string; cls: string }> = {
  NE_PRITJE: { label: "Në pritje", cls: "bg-amber-100 text-amber-800" },
  APROVUAR: { label: "Aprovuar", cls: "bg-emerald-100 text-emerald-800" },
  REFUZUAR: { label: "Refuzuar", cls: "bg-red-100 text-red-700" },
  ANULUAR: { label: "Anuluar", cls: "bg-slate-100 text-slate-500" },
};
const TOKEN_KEY = "lirimi.token";
const ORET = Array.from({ length: 12 }, (_, i) => String(i + 7).padStart(2, "0")); // 07–18
const MINUTAT = ["00", "15", "30", "45"];
const sot = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Belgrade" });
const fmtDay = (d: string) => d.split("-").reverse().join(".");

export default function LirimiPrindi() {
  const [hapi, setHapi] = useState<"telefoni" | "kodi" | "forma" | "derguar">("telefoni");
  const [telefoni, setTelefoni] = useState("");
  const [kodi, setKodi] = useState("");
  const [devKod, setDevKod] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [femijet, setFemijet] = useState<Femije[]>([]);
  const [kerkesat, setKerkesat] = useState<Kerkese[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [f, setF] = useState({ studentId: "", data: sot(), ora: "", arsyeja: "", shpjegim: "", marresEmri: "", marresLidhja: "" });

  // Sesioni i verifikuar (2 orë) mbetet edhe pas rifreskimit të faqes
  useEffect(() => {
    try { const t = sessionStorage.getItem(TOKEN_KEY); if (t) { setToken(t); setHapi("forma"); } } catch { /* s'ka rëndësi */ }
  }, []);
  useEffect(() => { if (token && hapi === "forma") void ngarko(token); }, [token, hapi]); // eslint-disable-line react-hooks/exhaustive-deps

  async function api(path: string, opts: RequestInit = {}) {
    const res = await fetch(`/api/public/lirimi${path}`, {
      ...opts,
      headers: { "Content-Type": "application/json", ...(token ? { "x-lirim-token": token } : {}), ...(opts.headers ?? {}) },
    });
    const d = await res.json().catch(() => ({}));
    if (res.status === 401 && token) { dil(); throw new Error(d.error || "Sesioni ka skaduar."); }
    if (!res.ok) throw new Error(d.error || "Diçka shkoi keq. Provoni përsëri.");
    return d;
  }

  function dil() {
    try { sessionStorage.removeItem(TOKEN_KEY); } catch { /* s'ka rëndësi */ }
    setToken(null); setHapi("telefoni"); setKodi(""); setFemijet([]); setKerkesat([]);
  }

  async function ngarko(t: string) {
    try {
      const res = await fetch("/api/public/lirimi/femijet", { headers: { "x-lirim-token": t } });
      if (res.status === 401) { dil(); return; }
      const d = await res.json();
      setFemijet(d.femijet ?? []);
      setKerkesat(d.kerkesat ?? []);
      if ((d.femijet ?? []).length === 1) setF(x => ({ ...x, studentId: String(d.femijet[0].id) }));
    } catch { /* s'ka rëndësi */ }
  }

  async function run(fn: () => Promise<void>) {
    setBusy(true); setError("");
    try { await fn(); } catch (e) { setError(e instanceof Error ? e.message : "Gabim."); } finally { setBusy(false); }
  }

  const kerkoKodin = () => run(async () => {
    const d = await api("/kodi", { method: "POST", body: JSON.stringify({ telefoni }) });
    setDevKod(d.devKod ?? null);
    setHapi("kodi");
  });

  const verifiko = () => run(async () => {
    const d = await api("/verifiko", { method: "POST", body: JSON.stringify({ telefoni, kodi }) });
    try { sessionStorage.setItem(TOKEN_KEY, d.token); } catch { /* s'ka rëndësi */ }
    setToken(d.token);
    setHapi("forma");
  });

  const dergo = () => run(async () => {
    await api("/kerkesa", { method: "POST", body: JSON.stringify({ ...f, studentId: Number(f.studentId) }) });
    setHapi("derguar");
    setF(x => ({ ...x, ora: "", arsyeja: "", shpjegim: "" }));
    if (token) await ngarko(token);
  });

  const anulo = (id: number) => run(async () => {
    if (!confirm("Ta anuloni këtë kërkesë?")) return;
    await api(`/kerkesa/${id}/anulo`, { method: "POST" });
    if (token) await ngarko(token);
  });

  const mungojne = [
    !f.studentId && "fëmija",
    !f.data && "data",
    !f.ora && "ora",
    !f.arsyeja && "arsyeja",
    f.arsyeja === "TJETER" && !f.shpjegim.trim() && "shpjegimi",
    !f.marresEmri.trim() && "kush e merr",
    !f.marresLidhja && "lidhja me fëmijën",
  ].filter((x): x is string => !!x);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF(x => ({ ...x, [k]: e.target.value }));
  const card = "card p-5 sm:p-6 space-y-4";

  return (
    <div className="space-y-4">
      {error && (
        <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-start justify-between gap-2">
          {error}
          <button onClick={() => setError("")} aria-label="Mbyll" className="text-red-400"><X className="w-4 h-4" /></button>
        </div>
      )}

      {hapi === "telefoni" && (
        <div className={card}>
          <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2"><Phone className="w-4 h-4 text-primary-600" /> Numri juaj i telefonit</h2>
          <p className="text-sm text-slate-500">Shkruani numrin që keni dhënë në shkollë. Do t&apos;ju dërgojmë një kod me SMS.</p>
          <input className="input text-lg" inputMode="tel" autoComplete="tel" placeholder="p.sh. 044 123 456" value={telefoni} onChange={e => setTelefoni(e.target.value)} onKeyDown={e => { if (e.key === "Enter") kerkoKodin(); }} />
          <button onClick={kerkoKodin} disabled={busy || telefoni.replace(/\D/g, "").length < 8} className="btn-primary w-full justify-center">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Dërgo kodin
          </button>
        </div>
      )}

      {hapi === "kodi" && (
        <div className={card}>
          <h2 className="font-semibold text-slate-900 dark:text-white flex items-center gap-2"><KeyRound className="w-4 h-4 text-primary-600" /> Kodi nga SMS-ja</h2>
          <p className="text-sm text-slate-500">Shkruani kodin 6-shifror që sapo morët në {telefoni}. Kodi vlen 10 minuta.</p>
          {devKod && <p className="text-xs p-2 rounded-lg bg-amber-50 text-amber-800">PROVË (SMS s&apos;është konfiguruar në këtë kompjuter): kodi është <b>{devKod}</b></p>}
          <input className="input text-2xl tracking-[0.4em] text-center" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="______" value={kodi} onChange={e => setKodi(e.target.value.replace(/\D/g, ""))} onKeyDown={e => { if (e.key === "Enter") verifiko(); }} />
          <button onClick={verifiko} disabled={busy || kodi.length !== 6} className="btn-primary w-full justify-center">
            {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Verifiko
          </button>
          <button onClick={() => { setHapi("telefoni"); setKodi(""); }} className="text-sm text-slate-500 hover:underline w-full">Ndrysho numrin / kërko kod të ri</button>
        </div>
      )}

      {hapi === "derguar" && (
        <div className={`${card} text-center`}>
          <CheckCircle2 className="w-12 h-12 text-emerald-500 mx-auto" />
          <p className="text-lg font-semibold text-slate-900 dark:text-white">Kërkesa u dërgua. Do të njoftoheni me SMS.</p>
          <button onClick={() => setHapi("forma")} className="btn-secondary mx-auto">Kthehu te kërkesat</button>
        </div>
      )}

      {hapi === "forma" && (
        <>
          <div className={card}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-slate-900 dark:text-white">Kërkesë e re për lirim</h2>
              <button onClick={dil} className="text-xs text-slate-500 hover:underline">Dil</button>
            </div>
            {femijet.length === 0 ? (
              <p className="text-sm text-slate-500">Duke ngarkuar…</p>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                <label className="sm:col-span-2 block"><span className="form-label">Fëmija</span>
                  <select className="input" value={f.studentId} onChange={set("studentId")}>
                    <option value="">Zgjidhni…</option>
                    {femijet.map(c => <option key={c.id} value={c.id}>{c.emri}{c.klasa ? ` — ${c.klasa}` : ""}</option>)}
                  </select>
                </label>
                <label className="block"><span className="form-label">Data e lirimit</span>
                  <input type="date" className="input" min={sot()} value={f.data} onChange={set("data")} />
                </label>
                <div className="block"><span className="form-label">Ora e lirimit</span>
                  {/* Dy lista (24 orë) në vend të <input type="time"> — në disa telefona/browser-a ai kërkon AM/PM dhe mbetet bosh */}
                  <div className="flex items-center gap-2">
                    <select className="input" aria-label="Ora" value={f.ora.split(":")[0] ?? ""} onChange={e => setF(x => ({ ...x, ora: e.target.value ? `${e.target.value}:${x.ora.split(":")[1] || "00"}` : "" }))}>
                      <option value="">Ora</option>
                      {ORET.map(h => <option key={h} value={h}>{h}</option>)}
                    </select>
                    <span className="text-slate-400">:</span>
                    <select className="input" aria-label="Minutat" value={f.ora ? f.ora.split(":")[1] : ""} disabled={!f.ora} onChange={e => setF(x => ({ ...x, ora: `${x.ora.split(":")[0]}:${e.target.value}` }))}>
                      {MINUTAT.map(m => <option key={m} value={m}>{m}</option>)}
                    </select>
                  </div>
                </div>
                <label className="sm:col-span-2 block"><span className="form-label">Arsyeja</span>
                  <select className="input" value={f.arsyeja} onChange={set("arsyeja")}>
                    <option value="">Zgjidhni…</option>
                    {Object.entries(ARSYET).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <label className="sm:col-span-2 block"><span className="form-label">Shpjegim {f.arsyeja === "TJETER" ? "*" : "(opsional)"}</span>
                  <textarea className="input" rows={2} maxLength={500} value={f.shpjegim} onChange={set("shpjegim")} />
                </label>
                <label className="block"><span className="form-label">Kush e merr fëmijën (emri)</span>
                  <input className="input" maxLength={120} value={f.marresEmri} onChange={set("marresEmri")} />
                </label>
                <label className="block"><span className="form-label">Lidhja me fëmijën</span>
                  <select className="input" value={f.marresLidhja} onChange={set("marresLidhja")}>
                    <option value="">Zgjidhni…</option>
                    {Object.entries(LIDHJET).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </label>
                <button onClick={dergo} disabled={busy || mungojne.length > 0} className="btn-primary sm:col-span-2 justify-center">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Dërgo kërkesën
                </button>
                {mungojne.length > 0 && <p className="sm:col-span-2 text-xs text-slate-500 text-center">Plotësoni: {mungojne.join(", ")}</p>}
              </div>
            )}
          </div>

          {kerkesat.length > 0 && (
            <div className={card}>
              <h2 className="font-semibold text-slate-900 dark:text-white">Kërkesat tuaja</h2>
              <ul className="divide-y divide-slate-100 dark:divide-slate-700">
                {kerkesat.map(k => (
                  <li key={k.id} className="py-3 flex items-start justify-between gap-3">
                    <div className="text-sm">
                      <p className="font-medium text-slate-900 dark:text-white">{k.emri}</p>
                      <p className="text-slate-500">{fmtDay(k.data)} në {k.ora} · {ARSYET[k.arsyeja] ?? k.arsyeja} · merr: {k.marresEmri}</p>
                      {k.statusi === "REFUZUAR" && k.arsyeRefuzimi && <p className="text-red-600 text-xs mt-0.5">Arsyeja: {k.arsyeRefuzimi}</p>}
                    </div>
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUSET[k.statusi]?.cls ?? ""}`}>{STATUSET[k.statusi]?.label ?? k.statusi}</span>
                      {k.statusi === "NE_PRITJE" && <button onClick={() => anulo(k.id)} disabled={busy} className="text-xs text-red-600 hover:underline">Anulo</button>}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
    </div>
  );
}
