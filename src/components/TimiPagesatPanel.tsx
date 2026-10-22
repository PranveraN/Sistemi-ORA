"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, X, Search } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { askDeleteReason, reasonHeaders } from "@/lib/auditReason";
import { brutoNgaShuma, ndajProporcionalisht } from "@/lib/timiPagesatCalc";
import { currentSchoolYearStart } from "@/lib/academicYear";

// "Pagesat nga TIMI": çdo pagesë që hyn në bankë nga TIMI Invest (e plotë ose pjesë-pjesë).
// Fëmijëve u llogaritet shuma bruto (÷ (1 − 4,66%)), komisioni del si shpenzim i shkollës.
// Logjika: src/lib/timiPagesat.ts · API: /api/timi-invest/pagesat

interface Femije { tiId: number; studentId: number; emri: string; klasa: string | null; prindi: string; statusi: string; cmimiCents: number; ngaTimiCents: number; paguarCents: number; mbetetCents: number; faza: string; meDoreCents?: number }
interface Pagese { id: number; data: string; shumaCents: number; brutoCents: number; komisionCents: number; komisionPct: number; referenca: string | null; prindi: string | null; shenim: string | null; createdByName: string | null; ndarja: { studentId: number; emri: string; cents: number }[] }
interface Data { viti: number; femijet: Femije[]; pagesat: Pagese[]; komisionPct: number }
interface Profature { id: number; number: string; parentName: string; timiStudentIds?: string | null }

const eur = (c: number) => `${(c / 100).toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;
const toCents = (s: string) => { const v = s.trim().replace(/\s|€/g, ""); const n = parseFloat(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v); return Number.isFinite(n) ? Math.round(n * 100) : 0; };
const today = () => new Date().toLocaleDateString("en-CA", { timeZone: "Europe/Belgrade" });
const yearLabel = (y: number) => `${y}–${String(y + 1).slice(2)}`;
const FAZA: Record<string, string> = { PROFATURE: "Profaturë", NE_PROCES: "Në proces", KRYER: "E kryer" };

export default function TimiPagesatPanel() {
  const [viti, setViti] = useState(currentSchoolYearStart());
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(async () => {
    setError("");
    const r = await fetch(`/api/timi-invest/pagesat?viti=${viti}`).catch(() => null);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) setData(j); else setError(j.error || "S'u ngarkuan pagesat nga TIMI.");
  }, [viti]);
  useEffect(() => { load(); }, [load]);

  async function remove(p: Pagese) {
    const reason = askDeleteReason(`Fshi pagesën nga TIMI ${eur(p.shumaCents)} (${formatDate(p.data)})? Pagesat te fëmijët kthehen mbrapsht.`);
    if (!reason) return;
    const r = await fetch(`/api/timi-invest/pagesat/${p.id}`, { method: "DELETE", headers: reasonHeaders(reason) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); alert(j.error || "Fshirja dështoi."); return; }
    load();
  }

  const femijet = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (data?.femijet ?? []).filter(f => !t || `${f.emri} ${f.prindi} ${f.klasa ?? ""}`.toLowerCase().includes(t));
  }, [data, q]);
  const tot = (k: keyof Pick<Femije, "cmimiCents" | "ngaTimiCents" | "paguarCents" | "mbetetCents">) => (data?.femijet ?? []).reduce((a, f) => a + f[k], 0);
  const yNow = currentSchoolYearStart();

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <select value={viti} onChange={e => setViti(parseInt(e.target.value))} className="form-input w-auto text-sm" aria-label="Viti shkollor">
          {[yNow - 1, yNow, yNow + 1].map(y => <option key={y} value={y}>Viti shkollor {yearLabel(y)}</option>)}
        </select>
        <div className="relative flex-1 min-w-[180px]">
          <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Kërko fëmijën ose prindin…" className="form-input pl-8 text-sm" />
        </div>
        <button onClick={() => setFormOpen(true)} className="btn-primary bg-amber-500 hover:bg-amber-600 border-amber-500 text-sm">
          <Plus className="w-4 h-4" /> Regjistro pagesë nga TIMI
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!data ? <Loader2 className="w-5 h-5 animate-spin text-amber-500" /> : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
            <Card label="Fëmijë me TIMI" value={String(data.femijet.length)} />
            <Card label="Çmimi gjithsej" value={eur(tot("cmimiCents"))} />
            <Card label="Paguar nga TIMI (për fëmijët)" value={eur(tot("ngaTimiCents"))} tone="text-emerald-700 dark:text-emerald-400" />
            <Card label="Mbetet" value={eur(tot("mbetetCents"))} tone="text-red-700 dark:text-red-400" />
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead className="bg-amber-50 dark:bg-amber-900/20 text-left text-xs text-amber-800 dark:text-amber-300">
                <tr><th className="px-3 py-2">Fëmija</th><th className="px-3 py-2">Prindi</th><th className="px-3 py-2 text-right">Çmimi TIMI</th><th className="px-3 py-2 text-right">Paguar nga TIMI</th><th className="px-3 py-2 text-right">Paguar gjithsej</th><th className="px-3 py-2 text-right">Mbetet</th><th className="px-3 py-2">Faza</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {femijet.map(f => (
                  <tr key={f.tiId} className={f.statusi !== "ACTIVE" ? "opacity-50" : ""}>
                    <td className="px-3 py-1.5 font-medium text-slate-800 dark:text-slate-100">{f.emri} <span className="text-xs text-slate-400">{f.klasa ?? ""}</span></td>
                    <td className="px-3 py-1.5 text-slate-500">{f.prindi}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{eur(f.cmimiCents)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                      {f.ngaTimiCents ? eur(f.ngaTimiCents) : (f.meDoreCents ?? 0) > 0 ? null : "—"}
                      {/* Muajt e shënuar me dorë (para formularit "Pagesat nga TIMI") — vetëm pamje */}
                      {(f.meDoreCents ?? 0) > 0 && <span className="block text-slate-500 dark:text-slate-400" title="Muaj TIMI të shënuar me dorë si të paguar (bankë), jo përmes Pagesat nga TIMI">{eur(f.meDoreCents!)} <span className="text-[10px]">(me dorë)</span></span>}
                    </td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{eur(f.paguarCents)}</td>
                    <td className={`px-3 py-1.5 text-right tabular-nums font-semibold ${f.mbetetCents > 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>{f.mbetetCents > 0 ? eur(f.mbetetCents) : "✓"}</td>
                    <td className="px-3 py-1.5 text-xs text-slate-500">{FAZA[f.faza] ?? f.faza}</td>
                  </tr>
                ))}
                {femijet.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">S&apos;ka fëmijë.</td></tr>}
              </tbody>
            </table>
          </div>

          <div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Pagesat që hynë nga TIMI</p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800 text-left text-xs text-slate-500">
                  <tr><th className="px-3 py-2">Data</th><th className="px-3 py-2">Fatura / Prindi</th><th className="px-3 py-2">Fëmijët</th><th className="px-3 py-2 text-right">Hyri në bankë</th><th className="px-3 py-2 text-right">Për fëmijët</th><th className="px-3 py-2 text-right">Komisioni</th><th className="px-3 py-2" /></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {data.pagesat.map(p => (
                    <tr key={p.id}>
                      <td className="px-3 py-1.5 whitespace-nowrap">{formatDate(p.data)}</td>
                      <td className="px-3 py-1.5">{p.referenca ?? "—"}<span className="block text-xs text-slate-400">{p.prindi ?? ""}</span></td>
                      <td className="px-3 py-1.5 text-xs text-slate-600 dark:text-slate-300">{p.ndarja.map(n => `${n.emri} ${eur(n.cents)}`).join(" · ")}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums">{eur(p.shumaCents)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums font-semibold">{eur(p.brutoCents)}</td>
                      <td className="px-3 py-1.5 text-right tabular-nums text-slate-500">{eur(p.komisionCents)} <span className="text-[10px]">({p.komisionPct}%)</span></td>
                      <td className="px-3 py-1.5 text-right">
                        <button onClick={() => remove(p)} aria-label="Fshi pagesën" className="p-1 rounded text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"><Trash2 className="w-3.5 h-3.5" /></button>
                      </td>
                    </tr>
                  ))}
                  {data.pagesat.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Ende s&apos;ka pagesa të regjistruara nga TIMI.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
      {formOpen && data && <TimiPageseForm data={data} onClose={() => setFormOpen(false)} onSaved={() => { setFormOpen(false); load(); }} />}
    </div>
  );
}

function Card({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${tone ?? "text-slate-900 dark:text-white"}`}>{value}</p>
    </div>
  );
}

function TimiPageseForm({ data, onClose, onSaved }: { data: Data; onClose: () => void; onSaved: () => void }) {
  const [dita, setDita] = useState(today());
  const [shuma, setShuma] = useState("");
  const [pct, setPct] = useState(String(data.komisionPct));
  const [viti, setViti] = useState(data.viti);
  const [referenca, setReferenca] = useState("");
  const [prindi, setPrindi] = useState("");
  const [shenim, setShenim] = useState("");
  const [zgjedhur, setZgjedhur] = useState<number[]>([]);
  const [pjeset, setPjeset] = useState<Record<number, string>>({});
  const [kerko, setKerko] = useState("");
  const [profaturat, setProfaturat] = useState<Profature[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/timi-invest/invoices").then(r => (r.ok ? r.json() : [])).then(j => setProfaturat(Array.isArray(j) ? j : j.invoices ?? [])).catch(() => {});
  }, []);

  const shumaCents = toCents(shuma);
  const pctNum = parseFloat(pct.replace(",", ".")) || 0;
  const bruto = shumaCents > 0 ? brutoNgaShuma(shumaCents, pctNum) : 0;
  const byId = (id: number) => data.femijet.find(f => f.studentId === id);

  // Ndarja automatike sipas asaj që mbetet (ose çmimit, kur s'mbetet asgjë)
  const autoSplit = useCallback((ids: number[], total: number) => {
    const w = ids.map(id => { const f = data.femijet.find(x => x.studentId === id); return f ? (f.mbetetCents || f.cmimiCents) : 1; });
    const parts = ndajProporcionalisht(total, w);
    setPjeset(Object.fromEntries(ids.map((id, i) => [id, total > 0 ? (parts[i] / 100).toFixed(2) : ""])));
  }, [data.femijet]);
  useEffect(() => { autoSplit(zgjedhur, bruto); }, [zgjedhur, bruto, autoSplit]);

  function shto(id: number) { if (!zgjedhur.includes(id)) setZgjedhur(z => [...z, id]); setKerko(""); }
  function ngaProfatura(id: string) {
    const p = profaturat.find(x => String(x.id) === id);
    if (!p) return;
    setReferenca(p.number); setPrindi(p.parentName);
    let tiIds: number[] = [];
    try { tiIds = JSON.parse(p.timiStudentIds || "[]"); } catch { /* bosh */ }
    const ids = data.femijet.filter(f => tiIds.includes(f.tiId)).map(f => f.studentId);
    if (ids.length) setZgjedhur(ids);
  }

  const ndarjaSum = zgjedhur.reduce((a, id) => a + toCents(pjeset[id] ?? ""), 0);
  const sugj = kerko.trim().length >= 2 ? data.femijet.filter(f => !zgjedhur.includes(f.studentId) && `${f.emri} ${f.prindi}`.toLowerCase().includes(kerko.trim().toLowerCase())).slice(0, 8) : [];

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (shumaCents <= 0) { setError("Shkruani shumën që hyri në bankë."); return; }
    if (zgjedhur.length === 0) { setError("Zgjidhni fëmijën/fëmijët."); return; }
    if (Math.abs(ndarjaSum - bruto) > 2) { setError(`Ndarja te fëmijët duhet të jetë ${eur(bruto)} (tani ${eur(ndarjaSum)}).`); return; }
    setSaving(true);
    const r = await fetch("/api/timi-invest/pagesat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: dita, shuma: shumaCents / 100, komisionPct: pctNum, vitiShkollor: viti, referenca, prindi, shenim, femijet: zgjedhur.map(id => ({ studentId: id, shuma: toCents(pjeset[id] ?? "") / 100 })) }),
    }).catch(() => null);
    setSaving(false);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (!r?.ok) { setError(j.error || "Ruajtja dështoi."); return; }
    onSaved();
  }

  const yNow = currentSchoolYearStart();
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-stretch sm:items-center justify-center sm:p-4" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <form onSubmit={save} role="dialog" aria-modal="true" aria-labelledby="tp-title" className="w-full sm:max-w-[620px] h-full sm:h-auto sm:max-h-[92vh] flex flex-col bg-white dark:bg-slate-800 sm:rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3 border-b border-slate-100 dark:border-slate-700">
          <h3 id="tp-title" className="font-bold text-slate-900 dark:text-white">Pagesë nga TIMI Invest</h3>
          <button type="button" onClick={onClose} aria-label="Mbyll" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3 text-sm">
          {profaturat.length > 0 && (
            <label className="block"><span className="form-label">Nga profatura / fatura (opsionale — plotëson fëmijët)</span>
              <select className="form-input" defaultValue="" onChange={e => ngaProfatura(e.target.value)}>
                <option value="">— Zgjidh —</option>
                {profaturat.map(p => <option key={p.id} value={p.id}>{p.number} · {p.parentName}</option>)}
              </select>
            </label>
          )}
          <div className="grid grid-cols-2 gap-3">
            <label><span className="form-label">Data në bankë</span><input type="date" required className="form-input" value={dita} onChange={e => setDita(e.target.value)} /></label>
            <label><span className="form-label">Shuma që hyri në bankë (€)</span><input inputMode="decimal" required autoFocus className="form-input" value={shuma} onChange={e => setShuma(e.target.value)} placeholder="p.sh. 1716,12" /></label>
            <label><span className="form-label">Komisioni TIMI (%)</span><input inputMode="decimal" className="form-input" value={pct} onChange={e => setPct(e.target.value)} /></label>
            <label><span className="form-label">Për vitin shkollor</span>
              <select className="form-input" value={viti} onChange={e => setViti(parseInt(e.target.value))}>
                {[yNow - 1, yNow, yNow + 1].map(y => <option key={y} value={y}>{yearLabel(y)}</option>)}
              </select>
            </label>
            <label><span className="form-label">Nr. i (pro)faturës</span><input className="form-input" value={referenca} onChange={e => setReferenca(e.target.value)} placeholder="p.sh. SHM02/05" /></label>
            <label><span className="form-label">Prindi</span><input className="form-input" value={prindi} onChange={e => setPrindi(e.target.value)} /></label>
          </div>

          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 px-3 py-2 text-amber-900 dark:text-amber-200">
            Hyri në bankë <b>{eur(shumaCents)}</b> → për fëmijët <b>{eur(bruto)}</b> (÷ {(1 - pctNum / 100).toFixed(4).replace(".", ",")}) · komisioni TIMI <b>{eur(bruto - shumaCents)}</b> (shpenzim, Bankë)
          </div>

          <div>
            <span className="form-label">Fëmijët</span>
            <div className="relative">
              <input className="form-input" value={kerko} onChange={e => setKerko(e.target.value)} placeholder="Kërko fëmijën me TIMI…" />
              {sugj.length > 0 && (
                <ul className="absolute z-10 mt-1 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg max-h-56 overflow-auto">
                  {sugj.map(f => (
                    <li key={f.studentId}><button type="button" onClick={() => shto(f.studentId)} className="w-full text-left px-3 py-1.5 hover:bg-amber-50 dark:hover:bg-slate-700">
                      {f.emri} <span className="text-xs text-slate-400">· {f.prindi} · mbetet {eur(f.mbetetCents)}</span>
                    </button></li>
                  ))}
                </ul>
              )}
            </div>
            {zgjedhur.length > 0 && (
              <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-700">
                {zgjedhur.map(id => { const f = byId(id); return (
                  <li key={id} className="flex items-center gap-2 py-1.5">
                    <span className="flex-1">{f?.emri ?? `#${id}`} <span className="text-xs text-slate-400">çmimi {eur(f?.cmimiCents ?? 0)} · mbetet {eur(f?.mbetetCents ?? 0)}</span></span>
                    <input inputMode="decimal" className="form-input w-28 text-right" value={pjeset[id] ?? ""} onChange={e => setPjeset(p => ({ ...p, [id]: e.target.value }))} aria-label={`Shuma për ${f?.emri}`} />
                    <span className="text-slate-400">€</span>
                    <button type="button" onClick={() => setZgjedhur(z => z.filter(x => x !== id))} aria-label="Hiq" className="p-1 text-slate-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                  </li>
                ); })}
              </ul>
            )}
            {zgjedhur.length > 1 && <button type="button" onClick={() => autoSplit(zgjedhur, bruto)} className="text-xs text-amber-700 hover:underline mt-1">Ndaj automatikisht</button>}
            {zgjedhur.length > 0 && Math.abs(ndarjaSum - bruto) > 2 && <p className="text-xs text-red-600 mt-1">Ndarja: {eur(ndarjaSum)} — duhet {eur(bruto)}</p>}
          </div>

          <label className="block"><span className="form-label">Shënim (opsional)</span><input className="form-input" value={shenim} onChange={e => setShenim(e.target.value)} maxLength={500} /></label>
          <p className="text-xs text-slate-500">Shuma për fëmijët mbush këstet e tyre TIMI (shtator → gusht) si pagesë me <b>Bankë</b>, me datën në bankë. Nëse fëmija s&apos;ka ende këstet TIMI për atë vit, krijohen vetë nga çmimi TIMI.</p>
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 px-5 py-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
          <button type="button" onClick={onClose} className="btn-secondary">Anulo</button>
          <button type="submit" disabled={saving} className="btn-primary bg-amber-500 hover:bg-amber-600 border-amber-500">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Ruaj pagesën</button>
        </div>
      </form>
    </div>
  );
}
