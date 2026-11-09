"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { Upload, Loader2, FileText, CheckCircle2, AlertTriangle, Clock, Trash2, Plus, Pencil, Check, X } from "lucide-react";
import { eur, dmy, LLOJET, STATUSI_EK, ProgressBar, readingProgress, LevizjetTable, type Zer, type Levizje } from "@/components/banka/shared";

// Moduli "Banka": ngarkimi i ekstrakteve PDF (BKT), bilanci sipas zërave dhe
// menaxhimi i zërave/rregullave. Asgjë s'hyn në bilanc pa "Importo".

type Tab = "ekstraktet" | "permbledhja" | "paklasifikuara" | "zerat";

export default function BankaPage() {
  const [tab, setTab] = useState<Tab>("ekstraktet");
  const tabs: { k: Tab; t: string }[] = [
    { k: "ekstraktet", t: "Ekstraktet" }, { k: "permbledhja", t: "Bilanci sipas zërave" },
    { k: "paklasifikuara", t: "Të paklasifikuara" }, { k: "zerat", t: "Zërat & rregullat" },
  ];
  return (
    <div>
      <Header title="Banka" />
      <div className="p-4 sm:p-6 space-y-4">
        <div className="flex flex-wrap gap-1 border-b border-slate-200 dark:border-slate-700">
          {tabs.map(x => (
            <button key={x.k} onClick={() => setTab(x.k)}
              className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${tab === x.k ? "border-primary-600 text-primary-700 dark:text-primary-300" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
              {x.t}
            </button>
          ))}
        </div>
        {tab === "ekstraktet" && <EkstraktetTab />}
        {tab === "permbledhja" && <PermbledhjaTab />}
        {tab === "paklasifikuara" && <PaKlasifikuaraTab />}
        {tab === "zerat" && <ZeratTab />}
      </div>
    </div>
  );
}

/* ── Ekstraktet ─────────────────────────────────────────────────────────── */
interface EkRow {
  id: number; llogaria: string | null; periudhaNga: string | null; periudhaDeri: string | null; emriSkedarit: string | null;
  statusi: string; faqetGati: number; faqetGjithsej: number; totalDebi: number | null; totalKredi: number | null;
  rreshta: number; paKlasifikuara: number; gabimi: string | null; createdAt: string; importuarAt: string | null; nePunim: boolean;
}

function EkstraktetTab() {
  const [rows, setRows] = useState<EkRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadPct, setUploadPct] = useState(0);
  const [uploadName, setUploadName] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await fetch("/api/banka/ekstrakte");
    if (r.ok) setRows(await r.json());
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  // Rifreskim çdo 2 sekonda kur ka ekstrakt që po lexohet
  useEffect(() => {
    if (!rows.some(r => r.statusi === "NE_PERPUNIM")) return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [rows, load]);

  async function fshi(r: EkRow) {
    const per = r.periudhaNga ? `${dmy(r.periudhaNga)} – ${dmy(r.periudhaDeri)}` : r.emriSkedarit;
    if (!confirm(`Ta hedh poshtë ngarkimin "${per}"? Rreshtat e lexuar fshihen (s'janë importuar); PDF-në mund ta ngarkosh sërish.`)) return;
    const res = await fetch(`/api/banka/ekstrakte/${r.id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Fshirja dështoi."); return; }
    load();
  }

  // Dërgimi me XMLHttpRequest — që të shihet përqindja e ngarkimit të skedarit
  // Një ose disa PDF → NJË ekstrakt (p.sh. viti 2024 i ndarë në 2 skedarë)
  function upload(e: React.ChangeEvent<HTMLInputElement>) {
    const fs = Array.from(e.target.files ?? []);
    e.target.value = "";
    if (!fs.length) return;
    if (fs.length > 1 && !confirm(`Këta ${fs.length} skedarë janë pjesë të të NJËJTIT ekstrakt (p.sh. i njëjti vit i ndarë në pjesë)?\n\n${fs.map(f => "• " + f.name).join("\n")}\n\nBashkohen në një ekstrakt dhe renditen vetë sipas datave. Për ekstrakte të ndryshme (vite të tjera), ngarkoji veç e veç.`)) return;
    setUploading(true); setUploadPct(0); setUploadName(fs.length > 1 ? `${fs.length} skedarë` : fs[0].name); setErr(null);
    const fd = new FormData(); for (const f of fs) fd.append("file", f);
    const xhr = new XMLHttpRequest();
    xhr.open("POST", "/api/banka/ekstrakte");
    xhr.upload.onprogress = ev => { if (ev.lengthComputable) setUploadPct(ev.loaded / ev.total * 100); };
    xhr.onload = () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) { load(); return; }
      let msg = "Ngarkimi dështoi.";
      try { msg = JSON.parse(xhr.responseText).error || msg; } catch { /* përgjigje jo-JSON */ }
      setErr(msg);
    };
    xhr.onerror = () => { setUploading(false); setErr("Lidhja me serverin dështoi gjatë ngarkimit."); };
    xhr.send(fd);
  }

  return (
    <div className="space-y-4">
      <div className="card p-5 flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-[260px]">
          <h2 className="font-bold text-slate-900 dark:text-white">Ngarko ekstraktin e bankës (PDF)</h2>
          <p className="text-xs text-slate-500 mt-1">
            Ekstrakti BKT "Llogaria e-Deklarata" (edhe i skanuar). Sistemi e lexon vetë, kontrollon çdo rresht me gjendjen e bankës
            dhe propozon zërat. Nëse një ekstrakt është ndarë në disa PDF (p.sh. 2024 në 2 skedarë), zgjidhi të gjitha njëherësh — bëhen një ekstrakt. Asgjë s&apos;hyn në bilanc derisa ta kontrollosh dhe të klikosh <b>Importo</b>.
          </p>
        </div>
        <input ref={fileRef} type="file" accept="application/pdf,.pdf" multiple className="hidden" onChange={upload} />
        <button onClick={() => fileRef.current?.click()} disabled={uploading} className="btn-primary">
          {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Zgjidh PDF-në
        </button>
        {uploading && (
          <ProgressBar className="w-full" pct={uploadPct}
            label={uploadPct >= 100 ? `${uploadName} — u dërgua, po fillon leximi…` : `Po dërgohet ${uploadName}…`} />
        )}
        {err && <p className="w-full text-sm text-rose-600">{err}</p>}
      </div>

      <div className="card overflow-hidden">
        {loading ? <div className="py-10 text-center text-sm text-slate-400">Duke ngarkuar…</div> : !rows.length ? (
          <div className="py-10 text-center text-sm text-slate-400">Asnjë ekstrakt ende.</div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/60"><tr>
              <th className="table-header">Periudha</th><th className="table-header">Llogaria / skedari</th><th className="table-header">Statusi</th>
              <th className="table-header text-right">Hyrje</th><th className="table-header text-right">Dalje</th><th className="table-header text-right">Rreshta</th><th className="table-header" />
            </tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {rows.map(r => {
                const st = STATUSI_EK[r.statusi] ?? { t: r.statusi, c: "" };
                return (
                  <tr key={r.id}>
                    <td className="table-cell whitespace-nowrap">{r.periudhaNga ? `${dmy(r.periudhaNga)} – ${dmy(r.periudhaDeri)}` : "—"}</td>
                    <td className="table-cell text-xs"><div className="font-medium">{r.llogaria ?? "…"}</div><div className="text-slate-400 flex items-center gap-1"><FileText className="w-3 h-3" />{r.emriSkedarit}</div></td>
                    <td className="table-cell">
                      <span className={`badge ${st.c}`}>
                        {r.statusi === "NE_PERPUNIM" ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : r.statusi === "IMPORTUAR" ? <CheckCircle2 className="w-3 h-3 mr-1" /> : r.statusi === "GABIM" ? <AlertTriangle className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                        {st.t}{r.statusi === "NE_PERPUNIM" ? ` · faqja ${r.faqetGati}/${r.faqetGjithsej}` : ""}
                      </span>
                      {r.statusi === "NE_PERPUNIM" && r.nePunim && (() => {
                        const p = readingProgress(r.faqetGati, r.faqetGjithsej);
                        return <ProgressBar className="mt-2 min-w-[220px]" pct={p.pct} label={p.label} />;
                      })()}
                      {r.statusi === "NE_PERPUNIM" && !r.nePunim &&<div className="text-[11px] text-amber-600 mt-1">Leximi u ndërpre — hape dhe kliko "Lexo sërish".</div>}
                      {r.statusi === "GABIM" && r.gabimi && (
                        <div className="mt-1.5 max-w-[420px] rounded-md bg-rose-50 dark:bg-rose-900/20 px-2 py-1.5 text-[11px] leading-snug text-rose-700 dark:text-rose-300">
                          <b>Pse s&apos;u ngarkua:</b>
                          <ul className="list-disc pl-4 mt-0.5 space-y-0.5">
                            {r.gabimi.split("\n").filter(Boolean).slice(0, 3).map((g, i) => <li key={i}>{g}</li>)}
                          </ul>
                          {r.gabimi.split("\n").filter(Boolean).length > 3 && <Link href={`/banka/${r.id}`} className="underline">+ {r.gabimi.split("\n").filter(Boolean).length - 3} të tjera — hape</Link>}
                        </div>
                      )}
                      {r.paKlasifikuara > 0 && r.statusi !== "NE_PERPUNIM" && <div className="text-[11px] text-amber-600 mt-1">{r.paKlasifikuara} pa zë</div>}
                    </td>
                    <td className="table-cell text-right text-emerald-700 dark:text-emerald-400 whitespace-nowrap">{eur(r.totalKredi)}</td>
                    <td className="table-cell text-right text-rose-700 dark:text-rose-400 whitespace-nowrap">{eur(r.totalDebi)}</td>
                    <td className="table-cell text-right">{r.rreshta || "—"}</td>
                    <td className="table-cell text-right whitespace-nowrap">
                      <div className="inline-flex items-center gap-1">
                        <Link href={`/banka/${r.id}`} className="btn-secondary py-1.5 text-xs inline-flex">Hap</Link>
                        {r.statusi !== "IMPORTUAR" && !r.nePunim && (
                          <button onClick={() => fshi(r)} className="p-1.5 text-slate-300 hover:text-rose-600" title="Hidhe poshtë (fshi këtë ngarkim)"><Trash2 className="w-4 h-4" /></button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

/* ── Bilanci sipas zërave ───────────────────────────────────────────────── */
interface PermRow { zerId: number; emri: string; lloji: string; nr: number; kredi: number; debi: number; neto: number }
interface Perm {
  rreshtat: PermRow[]; paKlasifikuara: { nr: number; kredi: number; debi: number };
  bilanci: { teHyrat: number; kthimet: number; shpenzimet: number; rezultati: number; financim: number; jashte: number };
  vitetShkollore: number[]; vitetKalendarike: number[];
}

function PermbledhjaTab() {
  const [yearType, setYearType] = useState<"academic" | "calendar">("academic");
  const [viti, setViti] = useState<string>("");
  const [d, setD] = useState<Perm | null>(null);
  useEffect(() => {
    const q = new URLSearchParams({ yearType, ...(viti ? { viti } : {}) });
    fetch(`/api/banka/permbledhje?${q}`).then(r => r.ok ? r.json() : null).then(setD);
  }, [yearType, viti]);
  const vitet = yearType === "academic" ? d?.vitetShkollore ?? [] : d?.vitetKalendarike ?? [];
  const lbl = (y: number) => yearType === "academic" ? `${y}–${y + 1}` : String(y);

  return (
    <div className="space-y-4">
      <div className="card p-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden text-sm">
          {(["academic", "calendar"] as const).map(t => (
            <button key={t} onClick={() => { setYearType(t); setViti(""); }} className={`px-3 py-1.5 ${yearType === t ? "bg-primary-600 text-white" : "text-slate-600 dark:text-slate-300"}`}>
              {t === "academic" ? "Vit shkollor" : "Vit kalendarik"}
            </button>
          ))}
        </div>
        <select value={viti} onChange={e => setViti(e.target.value)} className="form-input w-auto py-1.5 text-sm">
          <option value="">Të gjitha vitet</option>
          {vitet.map(y => <option key={y} value={y}>{lbl(y)}</option>)}
        </select>
        <span className="text-xs text-slate-500">Vetëm ekstraktet e importuara.</span>
      </div>

      {d && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <Kpi t="Të hyrat" v={d.bilanci.teHyrat} c="text-emerald-700" />
            <Kpi t="Kthimet" v={d.bilanci.kthimet} c="text-amber-700" />
            <Kpi t="Shpenzimet" v={d.bilanci.shpenzimet} c="text-rose-700" />
            <Kpi t="Rezultati" v={d.bilanci.rezultati} c={d.bilanci.rezultati >= 0 ? "text-emerald-700" : "text-rose-700"} bold />
          </div>
          <div className="card overflow-hidden">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/60"><tr>
                <th className="table-header">Zëri</th><th className="table-header">Lloji</th><th className="table-header text-right">Rreshta</th>
                <th className="table-header text-right">Hyrje</th><th className="table-header text-right">Dalje</th><th className="table-header text-right">Neto</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {Object.keys(LLOJET).flatMap(l => d.rreshtat.filter(r => r.lloji === l && r.nr > 0).map(r => (
                  <tr key={r.zerId}>
                    <td className="table-cell font-medium">{r.emri}</td>
                    <td className="table-cell"><span className={`badge ${LLOJET[r.lloji].cls}`}>{LLOJET[r.lloji].label}</span></td>
                    <td className="table-cell text-right">{r.nr}</td>
                    <td className="table-cell text-right">{r.kredi ? eur(r.kredi) : ""}</td>
                    <td className="table-cell text-right">{r.debi ? eur(r.debi) : ""}</td>
                    <td className={`table-cell text-right font-semibold ${r.neto >= 0 ? "text-emerald-700" : "text-rose-700"}`}>{eur(r.neto)}</td>
                  </tr>
                )))}
                {d.paKlasifikuara.nr > 0 && (
                  <tr className="bg-amber-50/50 dark:bg-amber-900/10">
                    <td className="table-cell font-medium text-amber-700">— Të paklasifikuara</td><td className="table-cell text-xs text-amber-700">s&apos;hyn në bilanc</td>
                    <td className="table-cell text-right">{d.paKlasifikuara.nr}</td>
                    <td className="table-cell text-right">{eur(d.paKlasifikuara.kredi)}</td><td className="table-cell text-right">{eur(d.paKlasifikuara.debi)}</td>
                    <td className="table-cell text-right">{eur(d.paKlasifikuara.kredi - d.paKlasifikuara.debi)}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-500">
            Rezultati = Të hyrat + Kthimet + Shpenzimet. Jashtë bilancit: Financim {eur(d.bilanci.financim)} · Lëvizje të tjera {eur(d.bilanci.jashte)}.
            {d.paKlasifikuara.nr > 0 && <> Ka <b>{d.paKlasifikuara.nr}</b> rreshta pa zë — klasifikoji te skeda &quot;Të paklasifikuara&quot;.</>}
          </p>
        </>
      )}
    </div>
  );
}

function Kpi({ t, v, c, bold }: { t: string; v: number; c: string; bold?: boolean }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500">{t}</p>
      <p className={`text-xl ${bold ? "font-extrabold" : "font-bold"} ${c}`}>{eur(v)}</p>
    </div>
  );
}

/* ── Të paklasifikuara (nga të gjitha ekstraktet e importuara) ──────────── */
function PaKlasifikuaraTab() {
  const [rows, setRows] = useState<Levizje[]>([]);
  const [zerat, setZerat] = useState<Zer[]>([]);
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([fetch("/api/banka/levizjet?paKlasifikuara=1"), fetch("/api/banka/zerat")]);
    if (a.ok) setRows(await a.json());
    if (b.ok) setZerat(await b.json());
  }, []);
  useEffect(() => { load(); }, [load]);
  return (
    <div className="space-y-3">
      <p className="text-sm text-slate-500">
        Hyrjet dhe daljet pa zë nga ekstraktet e importuara (p.sh. kalime mjetesh, huazime, kthime tërheqjesh). Zgjidhi, pastaj
        <b> Bart te zëri</b>. Nëse s&apos;ka zë të përshtatshëm, krijoje te skeda &quot;Zërat &amp; rregullat&quot;.
      </p>
      <LevizjetTable rows={rows} zerat={zerat} onChanged={load} />
    </div>
  );
}

/* ── Zërat & rregullat ──────────────────────────────────────────────────── */
interface Rregull { id: number; fjala: string; drejtimi: string | null; zerId: number | null; prioriteti: number; aktiv: boolean }

function ZeratTab() {
  const [zerat, setZerat] = useState<Zer[]>([]);
  const [rregullat, setRregullat] = useState<Rregull[]>([]);
  const [emri, setEmri] = useState(""); const [lloji, setLloji] = useState("FINANCIM");
  const [nr, setNr] = useState({ fjala: "", drejtimi: "", zerId: "", prioriteti: "50" });
  const load = useCallback(async () => {
    const [a, b] = await Promise.all([fetch("/api/banka/zerat"), fetch("/api/banka/rregullat")]);
    if (a.ok) setZerat(await a.json());
    if (b.ok) setRregullat(await b.json());
  }, []);
  useEffect(() => { load(); }, [load]);

  async function send(url: string, method: string, body?: unknown) {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "Veprimi dështoi."); return false; }
    load(); return true;
  }

  const [edit, setEdit] = useState<{ id: number; emri: string } | null>(null);
  const [del, setDel] = useState<{ z: Zer; target: string } | null>(null);
  // Zë i papërdorur → fshihet me një konfirmim; i përdorur → dritarja "ku kalojnë rreshtat"
  function askDelete(z: Zer) {
    if (!z._count?.levizjet && !z._count?.rregullat) { if (confirm(`Fshi zërin "${z.emri}"?`)) send(`/api/banka/zerat/${z.id}`, "DELETE"); return; }
    setDel({ z, target: "" });
  }

  const zerName = (id: number | null) => id ? zerat.find(z => z.id === id)?.emri ?? "?" : "— Të paklasifikuara";

  return (
    <div className="grid lg:grid-cols-2 gap-4 items-start">
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white">Zërat</h3>
          <p className="text-xs text-slate-500">Lloji vendos si hyn zëri në bilanc. Financim = huazime, kthime huazimesh, kalime mjetesh (jashtë bilancit).</p>
          <form className="flex flex-wrap gap-2 mt-3" onSubmit={async e => { e.preventDefault(); if (await send("/api/banka/zerat", "POST", { emri, lloji })) setEmri(""); }}>
            <input value={emri} onChange={e => setEmri(e.target.value)} placeholder="p.sh. Huazim i përkohshëm" className="form-input flex-1 min-w-[180px] py-1.5 text-sm" required />
            <select value={lloji} onChange={e => setLloji(e.target.value)} className="form-input w-auto py-1.5 text-sm">
              {Object.entries(LLOJET).map(([k, l]) => <option key={k} value={k}>{l.label}</option>)}
            </select>
            <button className="btn-primary py-1.5 text-xs"><Plus className="w-3.5 h-3.5" /> Shto</button>
          </form>
        </div>
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {zerat.map(z => (
            <li key={z.id} className={`px-4 py-2.5 flex items-center gap-2 ${z.aktiv ? "" : "opacity-50"}`}>
              {edit?.id === z.id ? (
                <form className="flex-1 flex items-center gap-1" onSubmit={async e => { e.preventDefault(); if (edit.emri.trim() && await send(`/api/banka/zerat/${z.id}`, "PATCH", { emri: edit.emri.trim() })) setEdit(null); }}>
                  <input autoFocus value={edit.emri} onChange={e => setEdit({ id: z.id, emri: e.target.value })} onKeyDown={e => e.key === "Escape" && setEdit(null)} className="form-input py-1 text-sm" maxLength={100} />
                  <button className="p-1.5 text-emerald-600 hover:bg-emerald-50 rounded" title="Ruaj"><Check className="w-4 h-4" /></button>
                  <button type="button" onClick={() => setEdit(null)} className="p-1.5 text-slate-400 hover:bg-slate-100 rounded" title="Anulo"><X className="w-4 h-4" /></button>
                </form>
              ) : (
                <span className="flex-1 text-sm font-medium">{z.emri}</span>
              )}
              <select value={z.lloji} onChange={e => send(`/api/banka/zerat/${z.id}`, "PATCH", { lloji: e.target.value })} className="form-input w-auto py-1 text-xs">
                {Object.entries(LLOJET).map(([k, l]) => <option key={k} value={k}>{l.label}</option>)}
              </select>
              <span className="text-[11px] text-slate-400 w-16 text-right">{z._count?.levizjet ?? 0} rreshta</span>
              <button onClick={() => setEdit({ id: z.id, emri: z.emri })} className="p-1 text-slate-400 hover:text-primary-600" title="Ndrysho emrin"><Pencil className="w-3.5 h-3.5" /></button>
              <button onClick={() => send(`/api/banka/zerat/${z.id}`, "PATCH", { aktiv: !z.aktiv })} className="text-xs text-slate-400 hover:text-primary-600">{z.aktiv ? "Çaktivizo" : "Aktivizo"}</button>
              <button onClick={() => askDelete(z)} className="p-1 text-slate-300 hover:text-rose-600" title="Fshi"><Trash2 className="w-3.5 h-3.5" /></button>
            </li>
          ))}
        </ul>
      </div>

      {del && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setDel(null)}>
          <div className="card w-full max-w-md p-5 space-y-3" onClick={e => e.stopPropagation()}>
            <h3 className="font-bold text-slate-900 dark:text-white">Fshi zërin &quot;{del.z.emri}&quot;</h3>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              Ky zë ka <b>{del.z._count?.levizjet ?? 0} rreshta</b> dhe <b>{del.z._count?.rregullat ?? 0} rregulla</b>.
              Rreshtat e bankës nuk fshihen — zgjidh ku kalojnë:
            </p>
            <select value={del.target} onChange={e => setDel({ ...del, target: e.target.value })} className="form-input">
              <option value="">Zgjidh…</option>
              <option value="null">— Të paklasifikuara (rregullat e tij fshihen)</option>
              {Object.entries(LLOJET).map(([k, l]) => {
                const zs = zerat.filter(x => x.aktiv && x.lloji === k && x.id !== del.z.id);
                return zs.length ? <optgroup key={k} label={l.label}>{zs.map(x => <option key={x.id} value={x.id}>{x.emri}</option>)}</optgroup> : null;
              })}
            </select>
            <p className="text-[11px] text-slate-400">Nëse ka rreshta nga ekstrakte të importuara, bilanci ndryshon sipas zërit ku kalojnë.</p>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setDel(null)} className="btn-secondary">Anulo</button>
              <button disabled={!del.target} onClick={async () => { if (await send(`/api/banka/zerat/${del.z.id}?zhvendosTe=${del.target}`, "DELETE")) setDel(null); }} className="btn-danger">
                <Trash2 className="w-4 h-4" /> Fshi zërin
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white">Rregullat</h3>
          <p className="text-xs text-slate-500">Nëse teksti i rreshtit (emri + përshkrimi) përmban fjalën, propozohet zëri. Kontrollohen sipas prioritetit (më i vogli i pari). &quot;*&quot; = çdo rresht i atij drejtimi.</p>
          <form className="grid grid-cols-2 sm:grid-cols-5 gap-2 mt-3" onSubmit={async e => {
            e.preventDefault();
            if (await send("/api/banka/rregullat", "POST", { fjala: nr.fjala, drejtimi: nr.drejtimi || null, zerId: nr.zerId === "" ? null : parseInt(nr.zerId), prioriteti: parseInt(nr.prioriteti) })) setNr({ ...nr, fjala: "" });
          }}>
            <input value={nr.fjala} onChange={e => setNr({ ...nr, fjala: e.target.value })} placeholder="Fjala" className="form-input py-1.5 text-sm col-span-2 sm:col-span-1" required />
            <select value={nr.drejtimi} onChange={e => setNr({ ...nr, drejtimi: e.target.value })} className="form-input py-1.5 text-sm">
              <option value="">Hyrje + dalje</option><option value="HYRJE">Hyrje</option><option value="DALJE">Dalje</option>
            </select>
            <select value={nr.zerId} onChange={e => setNr({ ...nr, zerId: e.target.value })} className="form-input py-1.5 text-sm">
              <option value="">— Të paklasifikuara</option>{zerat.filter(z => z.aktiv).map(z => <option key={z.id} value={z.id}>{z.emri}</option>)}
            </select>
            <input type="number" value={nr.prioriteti} onChange={e => setNr({ ...nr, prioriteti: e.target.value })} className="form-input py-1.5 text-sm" title="Prioriteti" />
            <button className="btn-primary py-1.5 text-xs justify-center"><Plus className="w-3.5 h-3.5" /> Shto</button>
          </form>
        </div>
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/60"><tr>
            <th className="table-header">Prior.</th><th className="table-header">Fjala</th><th className="table-header">Drejtimi</th><th className="table-header">Zëri</th><th className="table-header" />
          </tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {rregullat.map(r => (
              <tr key={r.id} className={r.aktiv ? "" : "opacity-50"}>
                <td className="table-cell py-2 text-xs">{r.prioriteti}</td>
                <td className="table-cell py-2 text-xs font-mono">{r.fjala}</td>
                <td className="table-cell py-2 text-xs">{r.drejtimi === "HYRJE" ? "Hyrje" : r.drejtimi === "DALJE" ? "Dalje" : "Të dyja"}</td>
                <td className="table-cell py-2 text-xs">{zerName(r.zerId)}</td>
                <td className="table-cell py-2 text-right whitespace-nowrap">
                  <button onClick={() => send(`/api/banka/rregullat/${r.id}`, "PATCH", { aktiv: !r.aktiv })} className="text-xs text-slate-400 hover:text-primary-600 mr-2">{r.aktiv ? "Çaktivizo" : "Aktivizo"}</button>
                  <button onClick={() => confirm(`Fshi rregullin "${r.fjala}"?`) && send(`/api/banka/rregullat/${r.id}`, "DELETE")} className="p-1 text-slate-300 hover:text-rose-600" title="Fshi"><Trash2 className="w-3.5 h-3.5" /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
