"use client";

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { Copy, Check, QrCode, ExternalLink, Plus, Loader2, X, Save, Phone } from "lucide-react";
import Header from "@/components/layout/Header";
import { ARSYET, LIDHJET, STATUSET, fmtDay, fmtTime, sotDay, type KerkeseRow } from "@/components/lirimi/shared";

type Klasa = { id: number; name: string };
type Kujdestare = { id: number; userId: number; emri: string; email: string; aktive: boolean; classId: number; klasa: string; telefoni: string | null };
type LogRow = { id: number; veprimi: string; pershkrim: string | null; kush: string | null; createdAt: string };
type Tab = "sot" | "te-gjitha" | "kujdestaret" | "linku";

export default function LirimetPage() {
  const [tab, setTab] = useState<Tab>("sot");
  const [klasat, setKlasat] = useState<Klasa[]>([]);
  useEffect(() => { fetch("/api/classes").then(r => r.json()).then(d => setKlasat(Array.isArray(d) ? d : [])).catch(() => {}); }, []);

  const tabs: [Tab, string][] = [["sot", "Sot"], ["te-gjitha", "Të gjitha kërkesat"], ["kujdestaret", "Kujdestaret"], ["linku", "Linku dhe QR"]];
  return (
    <>
      <Header title="Lirimet e Nxënësve" />
      <div className="p-4 sm:p-6 space-y-4 animate-fade-in">
        <div role="tablist" className="flex gap-1 border-b border-slate-200 dark:border-slate-700 overflow-x-auto">
          {tabs.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 ${tab === k ? "border-primary-700 text-primary-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{l}</button>
          ))}
        </div>
        {tab === "sot" && <Sot />}
        {tab === "te-gjitha" && <TeGjitha klasat={klasat} />}
        {tab === "kujdestaret" && <Kujdestaret klasat={klasat} />}
        {tab === "linku" && <Linku />}
      </div>
    </>
  );
}

const badge = (s: string) => <span className={`px-2 py-0.5 rounded-full text-xs font-medium whitespace-nowrap ${STATUSET[s]?.cls ?? ""}`}>{STATUSET[s]?.label ?? s}</span>;

/* ── Sot: për recepsionin te dera ───────────────────────────── */
function Sot() {
  const [rows, setRows] = useState<KerkeseRow[] | null>(null);
  useEffect(() => {
    const d = sotDay();
    fetch(`/api/lirimet/kerkesat?nga=${d}&deri=${d}`).then(r => r.json()).then(x => setRows(Array.isArray(x) ? x : [])).catch(() => setRows([]));
  }, []);
  const aprovuar = (rows ?? []).filter(r => r.statusi === "APROVUAR").sort((a, b) => a.ora.localeCompare(b.ora));
  const pritje = (rows ?? []).filter(r => r.statusi === "NE_PRITJE");
  return (
    <div className="space-y-4">
      <div className="card overflow-x-auto">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 font-semibold text-slate-900 dark:text-white">
          Të aprovuar për lirim sot · {fmtDay(sotDay())} ({aprovuar.length})
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500 bg-slate-50 dark:bg-slate-800">
            <tr><th className="px-4 py-2">Ora</th><th className="px-4 py-2">Nxënësi</th><th className="px-4 py-2">Klasa</th><th className="px-4 py-2">E merr</th><th className="px-4 py-2">Arsyeja</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {rows === null ? <tr><td colSpan={5} className="px-4 py-5 text-slate-500">Duke ngarkuar…</td></tr>
              : aprovuar.length === 0 ? <tr><td colSpan={5} className="px-4 py-5 text-slate-500">Asnjë nxënës i aprovuar për lirim sot.</td></tr>
              : aprovuar.map(r => (
                <tr key={r.id}>
                  <td className="px-4 py-2 font-bold text-slate-900 dark:text-white">{r.ora}</td>
                  <td className="px-4 py-2 font-medium">{r.emri}</td>
                  <td className="px-4 py-2">{r.klasa}</td>
                  <td className="px-4 py-2">{r.marresEmri} <span className="text-slate-500">({LIDHJET[r.marresLidhja] ?? r.marresLidhja})</span></td>
                  <td className="px-4 py-2 text-slate-600">{ARSYET[r.arsyeja] ?? r.arsyeja}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {pritje.length > 0 && (
        <div className="card p-4 text-sm">
          <p className="font-semibold text-amber-700 mb-2">Ende në pritje për sot ({pritje.length})</p>
          <ul className="space-y-1">{pritje.map(r => <li key={r.id}>{r.ora} · {r.emri} ({r.klasa}) · merr: {r.marresEmri}</li>)}</ul>
        </div>
      )}
    </div>
  );
}

/* ── Të gjitha: filtra + detajet + ndryshimi i vendimit ─────── */
function TeGjitha({ klasat }: { klasat: Klasa[] }) {
  const [nga, setNga] = useState(() => { const d = new Date(Date.now() - 30 * 864e5); return d.toLocaleDateString("en-CA", { timeZone: "Europe/Belgrade" }); });
  const [deri, setDeri] = useState("");
  const [classId, setClassId] = useState("");
  const [statusi, setStatusi] = useState("");
  const [rows, setRows] = useState<KerkeseRow[] | null>(null);
  const [sel, setSel] = useState<number | null>(null);

  const load = useCallback(() => {
    const q = new URLSearchParams({ ...(nga ? { nga } : {}), ...(deri ? { deri } : {}), ...(classId ? { classId } : {}), ...(statusi ? { statusi } : {}) });
    fetch(`/api/lirimet/kerkesat?${q}`).then(r => r.json()).then(x => setRows(Array.isArray(x) ? x : [])).catch(() => setRows([]));
  }, [nga, deri, classId, statusi]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-3">
      <div className="card p-3 flex flex-wrap items-end gap-2">
        <label className="text-xs text-slate-500">Nga<input type="date" className="input mt-1" value={nga} onChange={e => setNga(e.target.value)} /></label>
        <label className="text-xs text-slate-500">Deri<input type="date" className="input mt-1" value={deri} onChange={e => setDeri(e.target.value)} /></label>
        <label className="text-xs text-slate-500">Klasa
          <select className="input mt-1" value={classId} onChange={e => setClassId(e.target.value)}>
            <option value="">Të gjitha</option>{klasat.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>
        <label className="text-xs text-slate-500">Statusi
          <select className="input mt-1" value={statusi} onChange={e => setStatusi(e.target.value)}>
            <option value="">Të gjitha</option>{Object.entries(STATUSET).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        </label>
      </div>
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500 bg-slate-50 dark:bg-slate-800">
            <tr><th className="px-4 py-2">Data · ora</th><th className="px-4 py-2">Nxënësi</th><th className="px-4 py-2">Klasa</th><th className="px-4 py-2">Arsyeja</th><th className="px-4 py-2">E merr</th><th className="px-4 py-2">Statusi</th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {rows === null ? <tr><td colSpan={6} className="px-4 py-5 text-slate-500">Duke ngarkuar…</td></tr>
              : rows.length === 0 ? <tr><td colSpan={6} className="px-4 py-5 text-slate-500">Asnjë kërkesë për këta filtra.</td></tr>
              : rows.map(r => (
                <tr key={r.id} onClick={() => setSel(r.id)} className="cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50">
                  <td className="px-4 py-2 whitespace-nowrap">{fmtDay(r.data)} · {r.ora}</td>
                  <td className="px-4 py-2 font-medium">{r.emri}</td>
                  <td className="px-4 py-2">{r.klasa}</td>
                  <td className="px-4 py-2 text-slate-600">{ARSYET[r.arsyeja] ?? r.arsyeja}</td>
                  <td className="px-4 py-2">{r.marresEmri}</td>
                  <td className="px-4 py-2">{badge(r.statusi)}</td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      {sel && <Detaje id={sel} onClose={() => setSel(null)} onChanged={load} />}
    </div>
  );
}

function Detaje({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const [k, setK] = useState<(KerkeseRow & { log: LogRow[] }) | null>(null);
  const [statusi, setStatusi] = useState("");
  const [arsye, setArsye] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(() => fetch(`/api/lirimet/kerkesat/${id}`).then(r => r.json()).then(d => { setK(d); setStatusi(d.statusi); setArsye(d.arsyeRefuzimi ?? ""); }), [id]);
  useEffect(() => { void load(); }, [load]);

  async function ruaj() {
    setBusy(true); setError("");
    const r = await fetch(`/api/lirimet/kerkesat/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ statusi, arsyeRefuzimi: arsye }) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(d.error || "Ruajtja dështoi."); return; }
    await load(); onChanged();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex justify-end" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <aside className="w-full sm:w-[440px] h-full bg-white dark:bg-slate-900 overflow-y-auto p-5 space-y-4 shadow-2xl">
        <div className="flex items-start justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white">Kërkesa #{id}</h2>
          <button onClick={onClose} aria-label="Mbyll" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        {!k ? <p className="text-sm text-slate-500">Duke ngarkuar…</p> : (
          <>
            <dl className="text-sm space-y-1.5">
              <div className="flex justify-between"><dt className="text-slate-500">Data · ora</dt><dd>{fmtDay(k.data)} · {k.ora}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Arsyeja</dt><dd>{ARSYET[k.arsyeja] ?? k.arsyeja}</dd></div>
              {k.shpjegim && <div className="flex justify-between gap-4"><dt className="text-slate-500">Shpjegimi</dt><dd className="text-right">{k.shpjegim}</dd></div>}
              <div className="flex justify-between"><dt className="text-slate-500">E merr</dt><dd>{k.marresEmri} ({LIDHJET[k.marresLidhja] ?? k.marresLidhja})</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Telefoni i prindit</dt><dd>{k.telefoni}</dd></div>
              <div className="flex justify-between"><dt className="text-slate-500">Statusi</dt><dd>{badge(k.statusi)}</dd></div>
            </dl>
            <div className="border-t border-slate-100 dark:border-slate-700 pt-3 space-y-2">
              <p className="text-xs font-semibold uppercase text-slate-500">Ndrysho vendimin (administrata)</p>
              <select className="input" value={statusi} onChange={e => setStatusi(e.target.value)}>
                {Object.entries(STATUSET).map(([s, v]) => <option key={s} value={s}>{v.label}</option>)}
              </select>
              {statusi === "REFUZUAR" && <input className="input" placeholder="Arsyeja e refuzimit" value={arsye} onChange={e => setArsye(e.target.value)} />}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button onClick={ruaj} disabled={busy || (statusi === k.statusi && (statusi !== "REFUZUAR" || arsye === (k.arsyeRefuzimi ?? "")))} className="btn-primary w-full justify-center">
                {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Ruaj ndryshimin
              </button>
              <p className="text-xs text-slate-400">Ndryshimi regjistrohet te historiku. Kur bëhet Aprovuar/Refuzuar, prindi merr SMS.</p>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-700 pt-3">
              <p className="text-xs font-semibold uppercase text-slate-500 mb-2">Historiku</p>
              <ul className="space-y-2 text-xs">
                {k.log.map(l => (
                  <li key={l.id}><span className="text-slate-400">{fmtTime(l.createdAt)}</span> · <b>{l.veprimi}</b>{l.kush ? ` · ${l.kush}` : ""}{l.pershkrim ? <div className="text-slate-600 dark:text-slate-300 break-words">{l.pershkrim}</div> : null}</li>
                ))}
              </ul>
            </div>
          </>
        )}
      </aside>
    </div>
  );
}

/* ── Kujdestaret: llogaritë, klasa, telefoni ────────────────── */
function Kujdestaret({ klasat }: { klasat: Klasa[] }) {
  const [list, setList] = useState<Kujdestare[] | null>(null);
  const [shto, setShto] = useState(false);
  const [f, setF] = useState({ emri: "", email: "", password: "", classId: "", telefoni: "" });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => fetch("/api/lirimet/kujdestaret").then(r => r.json()).then(d => setList(Array.isArray(d) ? d : [])).catch(() => setList([]));
  useEffect(() => { void load(); }, []);

  async function krijo() {
    setBusy(true); setError("");
    const r = await fetch("/api/lirimet/kujdestaret", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(f) });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(d.error || "Krijimi dështoi."); return; }
    setShto(false); setF({ emri: "", email: "", password: "", classId: "", telefoni: "" }); await load();
  }
  async function ndrysho(id: number, data: Record<string, unknown>) {
    const r = await fetch(`/api/lirimet/kujdestaret/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) alert(d.error || "Ndryshimi dështoi."); else await load();
  }

  return (
    <div className="space-y-3">
      <div className="flex justify-end"><button onClick={() => setShto(s => !s)} className="btn-primary"><Plus className="w-4 h-4" /> Shto kujdestare</button></div>
      {shto && (
        <div className="card p-4 grid sm:grid-cols-2 gap-3">
          <label className="block"><span className="form-label">Emri i plotë</span><input className="input" value={f.emri} onChange={e => setF({ ...f, emri: e.target.value })} /></label>
          <label className="block"><span className="form-label">Email (për login)</span><input className="input" type="email" value={f.email} onChange={e => setF({ ...f, email: e.target.value })} /></label>
          <label className="block"><span className="form-label">Fjalëkalimi (min. 6)</span><input className="input" type="text" value={f.password} onChange={e => setF({ ...f, password: e.target.value })} /></label>
          <label className="block"><span className="form-label">Klasa</span>
            <select className="input" value={f.classId} onChange={e => setF({ ...f, classId: e.target.value })}><option value="">Zgjidhni…</option>{klasat.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
          </label>
          <label className="block sm:col-span-2"><span className="form-label">Telefoni (për SMS-të e kërkesave)</span><input className="input" inputMode="tel" placeholder="044 123 456" value={f.telefoni} onChange={e => setF({ ...f, telefoni: e.target.value })} /></label>
          {error && <p className="sm:col-span-2 text-sm text-red-600">{error}</p>}
          <button onClick={krijo} disabled={busy} className="btn-primary sm:col-span-2 justify-center">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Krijo llogarinë</button>
        </div>
      )}
      <div className="card overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-slate-500 bg-slate-50 dark:bg-slate-800">
            <tr><th className="px-4 py-2">Kujdestarja</th><th className="px-4 py-2">Klasa</th><th className="px-4 py-2">Telefoni</th><th className="px-4 py-2">Llogaria</th><th className="px-4 py-2"></th></tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
            {list === null ? <tr><td colSpan={5} className="px-4 py-5 text-slate-500">Duke ngarkuar…</td></tr>
              : list.length === 0 ? <tr><td colSpan={5} className="px-4 py-5 text-slate-500">Ende s&apos;ka kujdestare. Kliko “Shto kujdestare”.</td></tr>
              : list.map(k => (
                <tr key={k.id}>
                  <td className="px-4 py-2"><p className="font-medium">{k.emri}</p><p className="text-xs text-slate-500">{k.email}</p></td>
                  <td className="px-4 py-2">
                    <select className="input py-1" value={k.classId} onChange={e => ndrysho(k.id, { classId: Number(e.target.value) })} aria-label={`Klasa e ${k.emri}`}>
                      {klasat.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <button className="text-primary-700 hover:underline" onClick={() => { const t = prompt("Telefoni për SMS:", k.telefoni ?? ""); if (t !== null) void ndrysho(k.id, { telefoni: t }); }}>{k.telefoni || "Shto"}</button>
                  </td>
                  <td className="px-4 py-2">{k.aktive ? <span className="text-emerald-700">Aktive</span> : <span className="text-slate-400">Joaktive</span>}</td>
                  <td className="px-4 py-2 text-right whitespace-nowrap space-x-3">
                    <button className="text-xs text-slate-600 hover:underline" onClick={() => { const p = prompt("Fjalëkalimi i ri (min. 6 shenja):"); if (p) void ndrysho(k.id, { password: p }); }}>Fjalëkalim i ri</button>
                    <button className="text-xs text-slate-600 hover:underline" onClick={() => ndrysho(k.id, { aktive: !k.aktive })}>{k.aktive ? "Çaktivizo" : "Aktivizo"}</button>
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ── Linku publik, QR, telefoni i administratës ─────────────── */
function Linku() {
  const [url, setUrl] = useState("");
  const [copied, setCopied] = useState(false);
  const [tel, setTel] = useState("");
  const [saved, setSaved] = useState("");
  useEffect(() => {
    setUrl(`${window.location.origin}/lirimi`);
    fetch("/api/lirimet/cilesimet").then(r => r.json()).then(d => { setTel(d.adminTelefoni ?? ""); setSaved(d.adminTelefoni ?? ""); }).catch(() => {});
  }, []);

  async function downloadQr() {
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 768, margin: 2, color: { dark: "#1e1b4b", light: "#ffffff" } });
      const a = document.createElement("a");
      a.href = dataUrl; a.download = "Lirimi-i-nxenesit-QR.png"; a.click();
    } catch { alert("Gjenerimi i QR kodit dështoi."); }
  }
  async function ruajTel() {
    const r = await fetch("/api/lirimet/cilesimet", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ adminTelefoni: tel }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { alert(d.error || "Ruajtja dështoi."); return; }
    setTel(d.adminTelefoni); setSaved(d.adminTelefoni);
  }

  return (
    <div className="grid lg:grid-cols-2 gap-4">
      <div className="card p-5 space-y-3">
        <p className="font-semibold text-slate-900 dark:text-white">Linku për prindërit</p>
        <div className="flex gap-2">
          <input readOnly className="input font-mono text-sm" value={url} aria-label="Linku publik" />
          <button onClick={() => { void navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1500); }} className="btn-secondary" aria-label="Kopjo linkun">
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={downloadQr} className="btn-secondary"><QrCode className="w-4 h-4" /> Shkarko QR</button>
          <a href="/lirimi" target="_blank" rel="noopener noreferrer" className="btn-secondary"><ExternalLink className="w-4 h-4" /> Hap faqen</a>
        </div>
        <p className="text-xs text-slate-500">
          Për ta dërguar linkun te të gjithë prindërit: te <b>SMS</b> zgjidhni marrësit dhe shablloni i gatshëm <b>“Lirimi online”</b>.
        </p>
      </div>
      <div className="card p-5 space-y-3">
        <p className="font-semibold text-slate-900 dark:text-white flex items-center gap-2"><Phone className="w-4 h-4" /> Telefoni i administratës</p>
        <p className="text-sm text-slate-500">Merr SMS kur një kërkesë mbetet pa përgjigje nga kujdestarja më shumë se 30 minuta. Bosh = asnjë SMS.</p>
        <div className="flex gap-2">
          <input className="input" inputMode="tel" placeholder="044 123 456" value={tel} onChange={e => setTel(e.target.value)} />
          <button onClick={ruajTel} disabled={tel === saved} className="btn-primary"><Save className="w-4 h-4" /> Ruaj</button>
        </div>
      </div>
    </div>
  );
}
