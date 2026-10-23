"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { currentSchoolYearStart } from "@/lib/academicYear";
import { brutoNgaShuma, ndajProporcionalisht, TIMI_KOMISION_PCT } from "@/lib/timiPagesatCalc";
import { ArrowLeft, Check, Loader2, Plus, Search, Trash2, Upload, FileText, AlertTriangle, Save } from "lucide-react";

// Moduli TIMI INVEST → Regjistro pagesë nga TIMI (Faza 3): magjistar me 3 hapa.
// 1) të dhënat e transferit · 2) ndarja te fëmijët · 3) kontroll para ruajtjes.
// Ruajtja përdor të njëjtin funksion si gjithmonë (krijoTimiPagese): një transaksion — ose
// ruhet krejt (muajt + komisioni + pagesa), ose asgjë. Drafti s'prek asgjë.

interface Femije { tiId: number; studentId: number; emri: string; klasa: string | null; prindi: string; cmimiCents: number; paguarCents: number; mbetetCents: number; faza: string; vemendje: string[] }
interface Zgjedhur { studentId: number; euro: string }
type Menyra = "BARABARTE" | "KESTI" | "MANUAL" | "CSV";
interface Transfer { id: number; data: string; shumaCents: number; referenca: string | null; prindi: string | null; statusi: string; stornuar: boolean; femijet: { studentId: number; emri: string; cents: number }[] }

const FAZA: Record<string, string> = { PROFATURE: "Profaturë", NE_PROCES: "Në proces", KRYER: "E kryer", PEZULLUAR: "Pezulluar", ANULUAR: "Anuluar" };
const eur = (c: number) => formatCurrency(c / 100);
const toCents = (v: string) => Math.round((parseFloat(v.replace(/\s/g, "").replace(",", ".")) || 0) * 100);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim().toLowerCase();
const today = () => new Date().toISOString().slice(0, 10);

export default function Page() {
  return <Suspense fallback={<div className="card p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}><Magjistari /></Suspense>;
}

function Magjistari() {
  const router = useRouter();
  const sp = useSearchParams();
  const draftParam = parseInt(sp.get("draft") ?? "") || null;

  const [hapi, setHapi] = useState(1);
  const [draftId, setDraftId] = useState<number | null>(draftParam);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [tr, setTr] = useState({ data: today(), shuma: "", banka: "BKT", referenca: "", prindi: "", shenim: "", viti: currentSchoolYearStart(), komisionPct: TIMI_KOMISION_PCT, dokumenti: "", dokumentiEmri: "" });
  const [femijet, setFemijet] = useState<Femije[] | null>(null);
  const [zgj, setZgj] = useState<Zgjedhur[]>([]);
  const [menyra, setMenyra] = useState<Menyra>("KESTI");
  const [csv, setCsv] = useState("");
  const [q, setQ] = useState("");
  const [transferet, setTransferet] = useState<Transfer[]>([]);

  // Fëmijët TIMI të vitit (e njëjta llogaritje si Pasqyra) + transferet e kaluara
  useEffect(() => {
    setFemijet(null);
    fetch(`/api/timi-invest/pasqyra?viti=${tr.viti}`).then(r => r.json()).then(d => setFemijet(d.rreshtat ?? [])).catch(() => setFemijet([]));
    fetch(`/api/timi-invest/transferet?viti=${tr.viti}`).then(r => r.json()).then(d => {
      setTransferet((d.transferet ?? []).filter((t: Transfer) => t.statusi === "RUAJTUR" && !t.stornuar));
      if (!draftParam && d.komisionPct) setTr(t => ({ ...t, komisionPct: d.komisionPct }));
    }).catch(() => {});
  }, [tr.viti, draftParam]);

  // Hapja e një drafti
  useEffect(() => {
    if (!draftParam) return;
    fetch(`/api/timi-invest/transferet?id=${draftParam}`).then(r => r.json()).then(d => {
      const t = d.transferet?.[0];
      if (!t || t.statusi !== "DRAFT" || t.stornuar) { setMsg("Drafti s'u gjet ose është ruajtur tashmë."); setDraftId(null); return; }
      setTr({ data: String(t.data).slice(0, 10), shuma: t.shumaCents ? (t.shumaCents / 100).toFixed(2) : "", banka: t.banka ?? "", referenca: t.referenca ?? "", prindi: t.prindi ?? "",
        shenim: t.shenim ?? "", viti: t.vitiShkollor, komisionPct: t.komisionPct, dokumenti: t.dokumenti ?? "", dokumentiEmri: t.dokumentiEmri ?? "" });
      const dd = t.draftData ?? {};
      if (Array.isArray(dd.zgj)) setZgj(dd.zgj);
      if (dd.menyra) setMenyra(dd.menyra);
      if (typeof dd.csv === "string") setCsv(dd.csv);
    });
  }, [draftParam]);

  // Një fëmijë për nxënës (lidhjet e dyfishta TIMI → i njëjti nxënës, me paralajmërim)
  const sipasNxenesit = useMemo(() => {
    const m = new Map<number, Femije & { lidhje: number }>();
    for (const f of femijet ?? []) {
      const e = m.get(f.studentId);
      if (e) e.lidhje++; else m.set(f.studentId, { ...f, lidhje: 1 });
    }
    return m;
  }, [femijet]);

  const shumaCents = toCents(tr.shuma);
  const bruto = shumaCents > 0 ? brutoNgaShuma(shumaCents, tr.komisionPct) : 0;
  const komision = bruto - shumaCents;

  // Ndarja automatike sipas mënyrës (Manuale/CSV i lënë dorës)
  useEffect(() => {
    if (menyra === "MANUAL" || menyra === "CSV" || !zgj.length) return;
    const peshat = menyra === "BARABARTE" ? zgj.map(() => 1) : zgj.map(z => sipasNxenesit.get(z.studentId)?.cmimiCents ?? 1);
    const pjeset = ndajProporcionalisht(bruto, peshat);
    setZgj(prev => prev.map((z, i) => ({ ...z, euro: (pjeset[i] / 100).toFixed(2) })));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menyra, bruto, zgj.length, sipasNxenesit]);

  function shto(studentId: number) {
    if (zgj.some(z => z.studentId === studentId)) return;
    setZgj(p => [...p, { studentId, euro: "" }]);
    setQ("");
  }
  function shtoFamiljen(prindi: string) {
    const ids = [...sipasNxenesit.values()].filter(f => norm(f.prindi) === norm(prindi)).map(f => f.studentId);
    setZgj(p => [...p, ...ids.filter(id => !p.some(z => z.studentId === id)).map(id => ({ studentId: id, euro: "" }))]);
    if (!tr.prindi) setTr(t => ({ ...t, prindi }));
    setQ("");
  }
  function kopjo(t: Transfer) {
    const pjeset = ndajProporcionalisht(bruto, t.femijet.map(f => f.cents));
    setMenyra("MANUAL");
    setZgj(t.femijet.map((f, i) => ({ studentId: f.studentId, euro: (pjeset[i] / 100).toFixed(2) })));
    if (!tr.prindi && t.prindi) setTr(x => ({ ...x, prindi: t.prindi ?? "" }));
  }
  function lexoCsv(text: string) {
    setCsv(text);
    const rreshta = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
    const out: Zgjedhur[] = [];
    for (const l of rreshta) {
      const m = /^(.*?)[;,\t]\s*([\d.,]+)\s*€?$/.exec(l);
      if (!m) continue;
      const f = [...sipasNxenesit.values()].find(x => norm(x.emri) === norm(m[1]));
      if (f && !out.some(o => o.studentId === f.studentId)) out.push({ studentId: f.studentId, euro: m[2].replace(",", ".") });
    }
    setZgj(out);
  }
  const csvPaNjohur = menyra === "CSV" ? csv.split(/\r?\n/).map(l => l.trim()).filter(Boolean).filter(l => {
    const m = /^(.*?)[;,\t]\s*([\d.,]+)\s*€?$/.exec(l);
    return !m || ![...sipasNxenesit.values()].some(x => norm(x.emri) === norm(m[1]));
  }) : [];

  const rreshtat = zgj.map(z => {
    const f = sipasNxenesit.get(z.studentId);
    const cents = toCents(z.euro);
    const mbetet = f?.mbetetCents ?? 0;
    const pas = mbetet - cents;
    const paguarPas = (f?.paguarCents ?? 0) + cents;
    const fazaPas = !f ? "" : f.faza === "PEZULLUAR" || f.faza === "ANULUAR" ? f.faza : f.cmimiCents > 0 && paguarPas >= f.cmimiCents - 50 ? "KRYER" : paguarPas > 0 ? "NE_PROCES" : "PROFATURE";
    const gabim = !f ? "S'u gjet te TIMI" : cents <= 0 ? "Shuma 0" : cents > mbetet + 100 ? "Tepricë — kalon çmimin (mbetja është " + eur(mbetet) + ")" : null;
    const kujdes = f && (f.lidhje > 1 || f.vemendje.includes("DYFISH")) ? "2 regjistrime TIMI me këtë emër" : null;
    return { z, f, cents, mbetet, pas, fazaPas, gabim, kujdes };
  });
  const ndare = rreshtat.reduce((a, r) => a + r.cents, 0);
  const diferenca = bruto - ndare;
  const gati1 = shumaCents > 0 && /^\d{4}-\d{2}-\d{2}$/.test(tr.data);
  const gati2 = gati1 && rreshtat.length > 0 && Math.abs(diferenca) <= 0 && rreshtat.every(r => !r.gabim);

  function ndreqDiferencen() {
    if (!zgj.length) return;
    setMenyra("MANUAL");
    setZgj(p => p.map((z, i) => i === p.length - 1 ? { ...z, euro: ((toCents(z.euro) + diferenca) / 100).toFixed(2) } : z));
  }

  async function ngarko(file: File) {
    setBusy(true); setMsg("");
    const fd = new FormData(); fd.append("file", file);
    const r = await fetch("/api/timi-invest/dokumente", { method: "POST", body: fd });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(d.error || "Ngarkimi dështoi."); return; }
    setTr(t => ({ ...t, dokumenti: d.dokumenti, dokumentiEmri: d.dokumentiEmri }));
  }

  async function ruajDraft() {
    setBusy(true); setMsg("");
    const r = await fetch("/api/timi-invest/draft", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ draftId, data: tr.data, shuma: shumaCents / 100, komisionPct: tr.komisionPct, vitiShkollor: tr.viti, referenca: tr.referenca, prindi: tr.prindi, shenim: tr.shenim, banka: tr.banka, dokumenti: tr.dokumenti || null, dokumentiEmri: tr.dokumentiEmri || null, draftData: { zgj, menyra, csv } }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(d.error || "Ruajtja e draftit dështoi."); return; }
    setDraftId(d.id);
    setMsg("Drafti u ruajt — s'prek asnjë pagesë. Mund ta vazhdoni më vonë te \"Pagesat nga TIMI\".");
  }

  async function ruaj() {
    if (!gati2) return;
    setBusy(true); setMsg("");
    const r = await fetch("/api/timi-invest/pagesat", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ data: tr.data, shuma: shumaCents / 100, komisionPct: tr.komisionPct, vitiShkollor: tr.viti, referenca: tr.referenca, prindi: tr.prindi, shenim: tr.shenim, banka: tr.banka, dokumenti: tr.dokumenti || null, dokumentiEmri: tr.dokumentiEmri || null, draftId, femijet: rreshtat.map(r => ({ studentId: r.z.studentId, shuma: r.cents / 100 })) }),
    });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setMsg(d.error || "Ruajtja dështoi — asgjë s'u ndryshua."); return; }
    router.push("/timi-invest/pagesat?ruajtur=" + d.id);
  }

  const sugjerime = q.trim().length >= 2 ? [...sipasNxenesit.values()].filter(f => norm(`${f.emri} ${f.prindi}`).includes(norm(q))).slice(0, 8) : [];
  const prinderit = q.trim().length >= 2 ? [...new Set(sugjerime.map(f => f.prindi).filter(p => p && norm(p).includes(norm(q))))] : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <Link href="/timi-invest/pagesat" className="text-xs text-slate-500 hover:text-primary-600 inline-flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" />Pagesat nga TIMI</Link>
          <h1 className="page-title">Regjistro pagesë nga TIMI</h1>
          <p className="text-xs text-slate-500">Një transfer bankar → ndahet automatikisht te fëmijët{draftId ? ` · drafti #${draftId}` : ""}</p>
        </div>
      </div>

      {/* Hapat */}
      <div className="grid grid-cols-3 gap-2">
        {["Të dhënat e transferit", "Ndarja te fëmijët", "Kontrollo & ruaj"].map((t, i) => (
          <button key={t} onClick={() => { if (i + 1 < hapi || (i + 1 === 2 && gati1) || (i + 1 === 3 && gati2)) setHapi(i + 1); }}
            className={`card px-3 py-2.5 flex items-center gap-2 text-sm text-left ${hapi === i + 1 ? "ring-2 ring-primary-500" : ""}`}>
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${hapi > i + 1 ? "bg-emerald-500 text-white" : hapi === i + 1 ? "bg-primary-600 text-white" : "bg-slate-200 dark:bg-slate-700 text-slate-500"}`}>
              {hapi > i + 1 ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </span>
            <span className={hapi === i + 1 ? "font-semibold" : "text-slate-500"}>{t}</span>
          </button>
        ))}
      </div>

      {msg && <div className="card p-3 text-sm text-amber-800 dark:text-amber-200 bg-amber-50 dark:bg-amber-900/20 border-amber-200">{msg}</div>}

      <div className="grid lg:grid-cols-[280px_1fr] gap-4">
        {/* Përmbledhja e transferit */}
        <div className="card p-4 space-y-2 h-fit text-sm">
          <h2 className="font-semibold">Transferi</h2>
          <Rr k="Shuma në bankë" v={shumaCents ? eur(shumaCents) : "—"} b />
          <Rr k={`Për fëmijët (÷ ${(1 - tr.komisionPct / 100).toFixed(4)})`} v={bruto ? eur(bruto) : "—"} />
          <Rr k={`Komisioni ${tr.komisionPct}%`} v={komision ? eur(komision) : "—"} />
          <Rr k="Data" v={tr.data ? formatDate(tr.data) : "—"} />
          <Rr k="Banka" v={tr.banka || "—"} />
          <Rr k="Referenca" v={tr.referenca || "—"} />
          <Rr k="Viti shkollor" v={`${tr.viti}–${String(tr.viti + 1).slice(2)}`} />
          {tr.dokumenti && <a href={`/api/timi-invest/dokumente/${tr.dokumenti}`} target="_blank" className="text-xs text-primary-600 hover:underline inline-flex items-center gap-1"><FileText className="w-3.5 h-3.5" />{tr.dokumentiEmri || "dokumenti"}</a>}
          {hapi >= 2 && (
            <div className={`mt-2 rounded-lg p-2 text-xs ${diferenca === 0 && rreshtat.length ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-900/20 dark:text-emerald-300" : "bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300"}`}>
              Ndarë: {eur(ndare)} · Diferenca: <b>{eur(diferenca)}</b> {diferenca === 0 && rreshtat.length ? "✓" : ""}
            </div>
          )}
        </div>

        <div className="space-y-4 min-w-0">
          {/* HAPI 1 */}
          {hapi === 1 && (
            <div className="card p-4 grid sm:grid-cols-2 gap-3">
              <div><label className="form-label">Shuma që hyri në bankë (€) *</label><input className="form-input" inputMode="decimal" value={tr.shuma} onChange={e => setTr({ ...tr, shuma: e.target.value })} placeholder="p.sh. 3622,92" /></div>
              <div><label className="form-label">Data e transferit *</label><input type="date" className="form-input" value={tr.data} onChange={e => setTr({ ...tr, data: e.target.value })} /></div>
              <div><label className="form-label">Banka</label><input className="form-input" value={tr.banka} onChange={e => setTr({ ...tr, banka: e.target.value })} /></div>
              <div><label className="form-label">Referenca (nr. i profaturës)</label><input className="form-input" value={tr.referenca} onChange={e => setTr({ ...tr, referenca: e.target.value })} placeholder="p.sh. SHM25/06 2026" /></div>
              <div><label className="form-label">Prindi (si në bankë)</label><input className="form-input" value={tr.prindi} onChange={e => setTr({ ...tr, prindi: e.target.value })} /></div>
              <div>
                <label className="form-label">Viti shkollor</label>
                <select className="form-input" value={tr.viti} onChange={e => setTr({ ...tr, viti: Number(e.target.value) })}>
                  {[currentSchoolYearStart() - 1, currentSchoolYearStart(), currentSchoolYearStart() + 1].map(y => <option key={y} value={y}>{y}–{String(y + 1).slice(2)}</option>)}
                </select>
              </div>
              <div><label className="form-label">Komisioni TIMI (%)</label><input className="form-input" inputMode="decimal" value={tr.komisionPct} onChange={e => setTr({ ...tr, komisionPct: parseFloat(e.target.value.replace(",", ".")) || 0 })} /></div>
              <div>
                <label className="form-label">Dokumenti (ekstrakt / mandat)</label>
                <label className="btn-secondary cursor-pointer w-full justify-center"><Upload className="w-4 h-4" />{tr.dokumentiEmri ? "Ndrysho dokumentin" : "Ngarko PDF / foto"}
                  <input type="file" className="hidden" accept=".pdf,image/*,.doc,.docx" onChange={e => { const f = e.target.files?.[0]; if (f) ngarko(f); e.target.value = ""; }} />
                </label>
              </div>
              <div className="sm:col-span-2"><label className="form-label">Shënim</label><input className="form-input" value={tr.shenim} onChange={e => setTr({ ...tr, shenim: e.target.value })} /></div>
              <div className="sm:col-span-2 flex justify-between gap-2">
                <button disabled={busy} onClick={ruajDraft} className="btn-secondary"><Save className="w-4 h-4" />Ruaj si draft</button>
                <button disabled={!gati1} onClick={() => setHapi(2)} className="btn-primary">Vazhdo te ndarja →</button>
              </div>
            </div>
          )}

          {/* HAPI 2 */}
          {hapi === 2 && (
            <div className="card overflow-hidden">
              <div className="p-4 space-y-3 border-b border-slate-100 dark:border-slate-700">
                <div className="flex flex-wrap gap-2 items-center">
                  <span className="text-sm font-semibold mr-1">Mënyra e ndarjes:</span>
                  {([["BARABARTE", "Shumë e njëjtë për çdo fëmijë"], ["KESTI", "Sipas çmimit / këstit të secilit"], ["MANUAL", "Manuale"], ["CSV", "Nga lista (CSV)"]] as const).map(([k, l]) => (
                    <button key={k} onClick={() => setMenyra(k)} className={`px-3 py-1 rounded-full text-xs font-semibold border ${menyra === k ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900" : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"}`}>{l}</button>
                  ))}
                </div>
                {menyra === "CSV" && (
                  <div>
                    <textarea className="form-input font-mono text-xs" rows={4} value={csv} onChange={e => lexoCsv(e.target.value)} placeholder={"Emri Mbiemri; shuma për fëmijën (€)\nElma Shaqiri; 1202,01\nMuhamed Shaqiri; 1081,81"} />
                    {csvPaNjohur.length > 0 && <p className="text-xs text-red-600 mt-1">S&apos;u njohën: {csvPaNjohur.join(" · ")}</p>}
                  </div>
                )}
                <div className="flex flex-wrap gap-2 items-start">
                  <div className="relative flex-1 min-w-[240px]">
                    <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
                    <input className="form-input pl-9" value={q} onChange={e => setQ(e.target.value)} placeholder="Shto fëmijë — kërko emrin ose prindin…" />
                    {(sugjerime.length > 0 || prinderit.length > 0) && (
                      <div className="absolute z-20 mt-1 w-full card shadow-lg p-1 max-h-72 overflow-y-auto">
                        {prinderit.map(p => (
                          <button key={p} onClick={() => shtoFamiljen(p)} className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-violet-50 dark:hover:bg-violet-900/20 text-violet-700 dark:text-violet-300">👪 Shto të gjithë fëmijët e <b>{p}</b></button>
                        ))}
                        {sugjerime.map(f => (
                          <button key={f.studentId} onClick={() => shto(f.studentId)} className="w-full text-left px-3 py-1.5 text-sm rounded hover:bg-slate-50 dark:hover:bg-slate-700 flex justify-between gap-2">
                            <span>{f.emri} <span className="text-xs text-slate-400">{f.klasa} · {f.prindi}</span></span>
                            <span className="text-xs text-slate-500">mbetet {eur(f.mbetetCents)}</span>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  {transferet.length > 0 && (
                    <select className="form-input !w-auto" value="" onChange={e => { const t = transferet.find(x => x.id === Number(e.target.value)); if (t) kopjo(t); }}>
                      <option value="">Kopjo nga transferi i kaluar…</option>
                      {transferet.slice(0, 30).map(t => <option key={t.id} value={t.id}>{formatDate(t.data)} · {eur(t.shumaCents)} · {t.prindi || t.femijet.map(f => f.emri).join(", ")}</option>)}
                    </select>
                  )}
                </div>
              </div>
              {!femijet ? <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div> : rreshtat.length === 0 ? (
                <p className="p-6 text-sm text-slate-400 text-center">Shtoni fëmijët që i mbulon ky transfer (kërko lart, ose &quot;Shto të gjithë fëmijët e prindit&quot;).</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60">
                      <tr><th className="px-3 py-2 text-left">Fëmija</th><th className="px-3 py-2 text-right">Mbetet tani</th><th className="px-3 py-2 text-right w-36">Kjo pagesë (€)</th><th className="px-3 py-2 text-right">Mbetet pas</th><th className="px-3 py-2 text-left">Kontroll</th><th className="w-8" /></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {rreshtat.map((r, i) => (
                        <tr key={r.z.studentId} className={r.gabim ? "bg-red-50/60 dark:bg-red-900/10" : r.kujdes ? "bg-amber-50/60 dark:bg-amber-900/10" : ""}>
                          <td className="px-3 py-2">{r.f?.emri ?? `#${r.z.studentId}`} <span className="text-xs text-slate-400">{r.f?.klasa ?? ""}</span></td>
                          <td className="px-3 py-2 text-right tabular-nums">{eur(r.mbetet)}</td>
                          <td className="px-3 py-2 text-right">
                            <input className="form-input !py-1 text-right tabular-nums" inputMode="decimal" value={r.z.euro}
                              onChange={e => { setMenyra("MANUAL"); const v = e.target.value; setZgj(p => p.map((z, j) => j === i ? { ...z, euro: v } : z)); }} />
                          </td>
                          <td className={`px-3 py-2 text-right tabular-nums ${r.pas < 0 ? "text-red-600 font-semibold" : ""}`}>{eur(r.pas)}</td>
                          <td className="px-3 py-2 text-xs">
                            {r.gabim ? <span className="text-red-700 dark:text-red-300 inline-flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{r.gabim}</span>
                              : r.kujdes ? <span className="text-amber-700 dark:text-amber-300 inline-flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" />{r.kujdes}</span>
                              : <span className="text-emerald-700 dark:text-emerald-400">✓ OK</span>}
                          </td>
                          <td className="px-2"><button onClick={() => setZgj(p => p.filter((_, j) => j !== i))} className="text-slate-400 hover:text-red-600" title="Hiq"><Trash2 className="w-4 h-4" /></button></td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-800/60 font-semibold text-sm">
                      <tr>
                        <td className="px-3 py-2">Transferi {eur(bruto)} · Ndarë {eur(ndare)}</td>
                        <td colSpan={3} className={`px-3 py-2 text-right ${diferenca === 0 ? "text-emerald-700" : "text-red-700"}`}>Diferenca: {eur(diferenca)} {diferenca === 0 ? "✓" : ""}</td>
                        <td colSpan={2} className="px-3 py-2">{diferenca !== 0 && <button onClick={ndreqDiferencen} className="text-xs text-primary-600 hover:underline">Ndreq diferencën te i fundit</button>}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
              <div className="p-4 flex justify-between gap-2 border-t border-slate-100 dark:border-slate-700">
                <button onClick={() => setHapi(1)} className="btn-secondary">← Mbrapa</button>
                <div className="flex gap-2">
                  <button disabled={busy} onClick={ruajDraft} className="btn-secondary"><Save className="w-4 h-4" />Ruaj si draft</button>
                  <button disabled={!gati2} onClick={() => setHapi(3)} className="btn-primary">Vazhdo te kontrolli →</button>
                </div>
              </div>
            </div>
          )}

          {/* HAPI 3 */}
          {hapi === 3 && (
            <div className="card overflow-hidden">
              <div className="p-4 border-b border-slate-100 dark:border-slate-700">
                <h2 className="font-semibold">Kontrollo para se të ruhet</h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Do të ruhet në një transaksion: muajt e {rreshtat.length} fëmijëve mbushen me {eur(bruto)} (bankë, {formatDate(tr.data)}), komisioni {eur(komision)} regjistrohet si shpenzim &quot;Komision TIMI Invest&quot;. Mund të stornohet krejt me një klik.
                </p>
              </div>
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60">
                  <tr><th className="px-3 py-2 text-left">Fëmija</th><th className="px-3 py-2 text-right">Paguan</th><th className="px-3 py-2 text-right">Mbetet: tani → pas</th><th className="px-3 py-2 text-left">Faza: tani → pas</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {rreshtat.map(r => (
                    <tr key={r.z.studentId} className={r.fazaPas === "KRYER" && r.f?.faza !== "KRYER" ? "bg-emerald-50/60 dark:bg-emerald-900/10" : ""}>
                      <td className="px-3 py-2">{r.f?.emri} <span className="text-xs text-slate-400">{r.f?.klasa}</span></td>
                      <td className="px-3 py-2 text-right tabular-nums font-semibold">{eur(r.cents)}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{eur(r.mbetet)} → <b>{eur(Math.max(0, r.pas))}</b></td>
                      <td className="px-3 py-2">{FAZA[r.f?.faza ?? ""] ?? r.f?.faza} → <b className={r.fazaPas === "KRYER" ? "text-emerald-700 dark:text-emerald-400" : ""}>{FAZA[r.fazaPas] ?? r.fazaPas}</b></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div className="p-4 flex flex-wrap justify-between gap-2 border-t border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-800/40">
                <div className="text-sm">
                  Në bankë <b>{eur(shumaCents)}</b> · Për fëmijët <b>{eur(bruto)}</b> · Komisioni <b>{eur(komision)}</b>
                  {rreshtat.filter(r => r.fazaPas === "KRYER" && r.f?.faza !== "KRYER").length > 0 && <span className="text-emerald-700 dark:text-emerald-400"> · {rreshtat.filter(r => r.fazaPas === "KRYER" && r.f?.faza !== "KRYER").length} kalojnë në &quot;E kryer&quot;</span>}
                </div>
                <div className="flex gap-2">
                  <button onClick={() => setHapi(2)} className="btn-secondary">← Mbrapa</button>
                  <button disabled={busy} onClick={ruajDraft} className="btn-secondary"><Save className="w-4 h-4" />Ruaj si draft</button>
                  <button disabled={busy || !gati2} onClick={ruaj} className="btn-primary">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}Ruaj pagesën</button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Rr({ k, v, b }: { k: string; v: string; b?: boolean }) {
  return <div className="flex justify-between gap-2"><span className="text-slate-500">{k}</span><span className={`tabular-nums ${b ? "font-bold" : ""}`}>{v}</span></div>;
}
