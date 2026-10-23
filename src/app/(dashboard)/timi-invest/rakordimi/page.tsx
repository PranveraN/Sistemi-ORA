"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { formatCurrency, formatDate } from "@/lib/utils";
import { currentSchoolYearStart } from "@/lib/academicYear";
import { Loader2, Upload, Lock, LockOpen, Plus, Check, X } from "lucide-react";

// Moduli TIMI INVEST → Rakordimi me TIMI (Faza 4). Krahason ekstraktin e bankës (CSV/Excel)
// me pagesat nga TIMI në Orë, muaj për muaj. VETËM krahasim + shënime + mbyllje e muajit:
// asnjë pagesë s'krijohet vetvetiu ("Regjistro" hap magjistarin me të dhënat e rreshtit).

const MUAJT = ["", "Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor", "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor"];
const eur = (c: number) => formatCurrency(c / 100);
interface Muaj { viti: number; muaji: number; totalOra: number; totalBanka: number; ngarkuar: boolean; statusi: string; mosperputhje: number }
interface Rr { celes: string; status: "PERPUTHET" | "VETEM_BANKE" | "VETEM_ORA" | "NE_RREGULL"; banka?: { data: string; cents: number; pershkrim: string }; ora?: { id: number; data: string; cents: number; referenca: string | null; prindi: string | null; femijet: string }; shenim?: string }
interface Detaj { viti: number; muaji: number; ngarkuar: boolean; emriSkedarit: string | null; ngarkuarAt: string | null; ngarkuarNga: string | null; statusi: string; mbyllurAt: string | null; mbyllurNga: string | null; totalBanka: number; totalOra: number; rreshtat: Rr[]; mosperputhje: number }
interface BankRow { data: string; cents: number; pershkrim: string }

const STATUS: Record<Rr["status"], { l: string; c: string }> = {
  PERPUTHET: { l: "Përputhet", c: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  VETEM_BANKE: { l: "Vetëm në bankë", c: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  VETEM_ORA: { l: "Vetëm në Orë", c: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  NE_RREGULL: { l: "Në rregull (shënuar)", c: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
};

// ── Leximi i ekstraktit ──
const MMM: Record<string, number> = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12 };
function dataNga(v: unknown): string | null {
  if (v instanceof Date && !isNaN(v.getTime())) return `${v.getFullYear()}-${String(v.getMonth() + 1).padStart(2, "0")}-${String(v.getDate()).padStart(2, "0")}`;
  const s = String(v ?? "").trim();
  let m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = /^(\d{1,2})[./](\d{1,2})[./](\d{4})/.exec(s); if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  m = /^(\d{1,2})-([A-Za-z]{3})-(\d{2,4})/.exec(s); if (m && MMM[m[2].toUpperCase()]) { const y = m[3].length === 2 ? `20${m[3]}` : m[3]; return `${y}-${String(MMM[m[2].toUpperCase()]).padStart(2, "0")}-${m[1].padStart(2, "0")}`; }
  return null;
}
function shumaNga(v: unknown): number | null {
  if (typeof v === "number") return Math.round(v * 100);
  let s = String(v ?? "").replace(/[€\s]/g, ""); if (!s) return null;
  if (/,\d{2}$/.test(s)) s = s.replace(/\./g, "").replace(",", "."); else s = s.replace(/,/g, "");
  const n = parseFloat(s); return isFinite(n) ? Math.round(n * 100) : null;
}

export default function RakordimiPage() {
  const [vitiSh, setVitiSh] = useState(currentSchoolYearStart());
  const [muajt, setMuajt] = useState<Muaj[] | null>(null);
  const [zgj, setZgj] = useState<{ viti: number; muaji: number } | null>(null);
  const [d, setD] = useState<Detaj | null>(null);
  const [busy, setBusy] = useState(false);
  // Ngarkimi
  const [tabela, setTabela] = useState<unknown[][] | null>(null);
  const [skedari, setSkedari] = useState("");
  const [kol, setKol] = useState({ data: -1, shuma: -1, pershkrim: -1, header: 0 });
  const [vetemTimi, setVetemTimi] = useState(true);

  const loadMuajt = useCallback(() => { setMuajt(null); fetch(`/api/timi-invest/rakordimi?vitiShkollor=${vitiSh}`).then(r => r.json()).then(j => setMuajt(j.muajt ?? [])); }, [vitiSh]);
  const loadDetaj = useCallback(() => {
    if (!zgj) return;
    setD(null);
    fetch(`/api/timi-invest/rakordimi?viti=${zgj.viti}&muaji=${zgj.muaji}`).then(r => r.json()).then(setD);
  }, [zgj]);
  useEffect(() => { loadMuajt(); }, [loadMuajt]);
  useEffect(() => { loadDetaj(); setTabela(null); }, [loadDetaj]);

  async function lexo(file: File) {
    const wb = XLSX.read(await file.arrayBuffer(), { cellDates: true });
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[wb.SheetNames[0]], { header: 1, raw: true, defval: "" });
    // Rreshti i kokës + kolonat sipas emrave të zakonshëm
    let header = 0, best = { data: -1, shuma: -1, pershkrim: -1 };
    for (let i = 0; i < Math.min(15, rows.length); i++) {
      const h = (rows[i] as unknown[]).map(x => String(x).toLowerCase());
      const g = {
        data: h.findIndex(x => /^(data|date|dt)\b|data e/.test(x)),
        shuma: h.findIndex(x => /kredi|credit|shuma|amount|vlera/.test(x) && !/bruto|para kom|balanc/.test(x)),
        pershkrim: h.findIndex(x => /p[eë]rshkrim|detail|description|pershkrimi|qëllim|qellim/.test(x)),
      };
      if (g.data >= 0 && g.shuma >= 0) { header = i; best = g; break; }
    }
    setTabela(rows); setSkedari(file.name); setKol({ ...best, header });
  }

  const paraShikim: BankRow[] = useMemo(() => {
    if (!tabela || !zgj || kol.data < 0 || kol.shuma < 0) return [];
    return tabela.slice(kol.header + 1).map(r => {
      const data = dataNga(r[kol.data]), cents = shumaNga(r[kol.shuma]);
      const pershkrim = kol.pershkrim >= 0 ? String(r[kol.pershkrim] ?? "") : (r as unknown[]).map(String).join(" ");
      return { data, cents, pershkrim };
    }).filter((x): x is BankRow => !!x.data && !!x.cents && x.cents > 0)
      .filter(x => { const [y, m] = x.data.split("-").map(Number); return y === zgj.viti && m === zgj.muaji; })
      .filter(x => !vetemTimi || /timi/i.test(x.pershkrim));
  }, [tabela, kol, zgj, vetemTimi]);

  async function ruajEkstraktin() {
    if (!zgj) return;
    setBusy(true);
    const r = await fetch("/api/timi-invest/rakordimi", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...zgj, rreshtat: paraShikim, emriSkedarit: skedari }) });
    setBusy(false);
    if (!r.ok) { alert((await r.json().catch(() => ({}))).error || "Ngarkimi dështoi."); return; }
    setTabela(null); loadDetaj(); loadMuajt();
  }
  async function patch(body: Record<string, unknown>) {
    if (!zgj) return;
    setBusy(true);
    const r = await fetch("/api/timi-invest/rakordimi", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...zgj, ...body }) });
    setBusy(false);
    if (!r.ok) { alert((await r.json().catch(() => ({}))).error || "Veprimi dështoi."); return; }
    loadDetaj(); loadMuajt();
  }

  const mbyllur = d?.statusi === "MBYLLUR";
  const kokat = tabela ? (tabela[kol.header] as unknown[] | undefined)?.map((x, i) => String(x || `Kolona ${i + 1}`)) ?? [] : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Rakordimi me TIMI</h1>
          <p className="text-xs text-slate-500">Krahaso ekstraktin e bankës me pagesat nga TIMI në Orë — muaj për muaj. Asgjë s&apos;regjistrohet vetvetiu.</p>
        </div>
        <select value={vitiSh} onChange={e => { setVitiSh(Number(e.target.value)); setZgj(null); }} className="form-input !w-auto">
          {[currentSchoolYearStart() - 1, currentSchoolYearStart(), currentSchoolYearStart() + 1].map(y => <option key={y} value={y}>{y}–{String(y + 1).slice(2)}</option>)}
        </select>
      </div>

      {/* 12 muajt */}
      <div className="card overflow-hidden">
        {!muajt ? <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div> : (
          <table className="w-full text-sm">
            <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60">
              <tr><th className="px-3 py-2 text-left">Muaji</th><th className="px-3 py-2 text-right">Sipas bankës (ekstrakti)</th><th className="px-3 py-2 text-right">Në Orë</th><th className="px-3 py-2 text-right">Diferenca</th><th className="px-3 py-2 text-left">Statusi</th><th className="px-3 py-2" /></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {muajt.map(m => {
                const dif = m.totalBanka - m.totalOra, aktiv = zgj?.viti === m.viti && zgj?.muaji === m.muaji;
                return (
                  <tr key={`${m.viti}-${m.muaji}`} className={aktiv ? "bg-primary-50/60 dark:bg-primary-900/10" : m.ngarkuar && m.mosperputhje ? "bg-red-50/40 dark:bg-red-900/10" : ""}>
                    <td className="px-3 py-2 font-medium">{MUAJT[m.muaji]} {m.viti}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.ngarkuar ? eur(m.totalBanka) : <span className="text-slate-400">pa ekstrakt</span>}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{eur(m.totalOra)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${m.ngarkuar && dif !== 0 ? "text-red-600 font-semibold" : "text-slate-400"}`}>{m.ngarkuar ? eur(dif) : "—"}</td>
                    <td className="px-3 py-2 text-xs">
                      {m.statusi === "MBYLLUR" ? <span className="badge bg-slate-800 text-white dark:bg-slate-200 dark:text-slate-900"><Lock className="w-3 h-3 mr-1" />Mbyllur</span>
                        : !m.ngarkuar ? <span className="text-slate-400">—</span>
                        : m.mosperputhje ? <span className="badge bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">{m.mosperputhje} mospërputhje</span>
                        : <span className="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">Përputhet</span>}
                    </td>
                    <td className="px-3 py-2 text-right"><button onClick={() => setZgj({ viti: m.viti, muaji: m.muaji })} className="btn-secondary !py-1 !px-2 !text-xs inline-flex">Shqyrto</button></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Muaji i zgjedhur */}
      {zgj && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700">
            <div>
              <h2 className="font-semibold">{MUAJT[zgj.muaji]} {zgj.viti}</h2>
              {d && <p className="text-xs text-slate-500">
                {d.ngarkuar ? `Ekstrakti: ${d.emriSkedarit ?? "—"} · ${d.ngarkuarNga ?? ""} ${d.ngarkuarAt ? formatDate(d.ngarkuarAt) : ""}` : "S'është ngarkuar ekstrakt për këtë muaj."}
                {mbyllur && ` · Mbyllur nga ${d.mbyllurNga ?? ""} ${d.mbyllurAt ? formatDate(d.mbyllurAt) : ""}`}
              </p>}
            </div>
            {d && (
              <div className="flex flex-wrap gap-2">
                {!mbyllur && (
                  <label className="btn-secondary cursor-pointer"><Upload className="w-4 h-4" />{d.ngarkuar ? "Ngarko sërish" : "Ngarko ekstraktin (CSV/Excel)"}
                    <input type="file" className="hidden" accept=".csv,.xlsx,.xls" onChange={e => { const f = e.target.files?.[0]; if (f) lexo(f); e.target.value = ""; }} />
                  </label>
                )}
                {!mbyllur ? (
                  <button disabled={busy} className="btn-primary" onClick={() => {
                    const msg = d.mosperputhje ? `Ka ende ${d.mosperputhje} mospërputhje. Mbyll muajin gjithsesi?` : "Mbyll muajin? Pas mbylljes, çdo pagesë/storno në këtë muaj kërkon arsye dhe shënohet te Historiku.";
                    if (confirm(msg)) patch({ veprimi: "MBYLL", arsye: d.mosperputhje ? `Mbyllur me ${d.mosperputhje} mospërputhje` : "" });
                  }}><Lock className="w-4 h-4" />Mbyll muajin</button>
                ) : (
                  <button disabled={busy} className="btn-secondary" onClick={() => { const a = window.prompt("Rihap muajin — arsyeja (e detyrueshme):"); if (a && a.trim().length >= 3) patch({ veprimi: "RIHAP", arsye: a.trim() }); }}><LockOpen className="w-4 h-4" />Rihap</button>
                )}
              </div>
            )}
          </div>

          {/* Paraqitja e ekstraktit para ruajtjes */}
          {tabela && (
            <div className="p-4 space-y-3 bg-slate-50/60 dark:bg-slate-800/30 border-b border-slate-100 dark:border-slate-700">
              <p className="text-sm font-semibold">Kontrollo kolonat e ekstraktit ({skedari})</p>
              <div className="flex flex-wrap gap-2 items-center text-sm">
                {(["data", "shuma", "pershkrim"] as const).map(k => (
                  <label key={k} className="flex items-center gap-1">{k === "data" ? "Data" : k === "shuma" ? "Shuma (kredi)" : "Përshkrimi"}:
                    <select className="form-input !w-auto !py-1" value={kol[k]} onChange={e => setKol({ ...kol, [k]: Number(e.target.value) })}>
                      <option value={-1}>—</option>
                      {kokat.map((h, i) => <option key={i} value={i}>{h}</option>)}
                    </select>
                  </label>
                ))}
                <label className="flex items-center gap-1"><input type="checkbox" checked={vetemTimi} onChange={e => setVetemTimi(e.target.checked)} />vetëm rreshtat që përmendin &quot;TIMI&quot;</label>
              </div>
              <p className="text-xs text-slate-500">{paraShikim.length} rreshta TIMI për {MUAJT[zgj.muaji]} {zgj.viti} · gjithsej {eur(paraShikim.reduce((a, r) => a + r.cents, 0))}</p>
              {paraShikim.length > 0 && (
                <div className="max-h-48 overflow-y-auto text-xs border rounded-lg border-slate-200 dark:border-slate-700">
                  {paraShikim.map((r, i) => <div key={i} className="px-2 py-1 border-b border-slate-100 dark:border-slate-700 flex gap-3"><span>{formatDate(r.data)}</span><span className="tabular-nums font-semibold">{eur(r.cents)}</span><span className="text-slate-500 truncate">{r.pershkrim}</span></div>)}
                </div>
              )}
              <div className="flex gap-2">
                <button onClick={() => setTabela(null)} className="btn-secondary">Anulo</button>
                <button disabled={busy || !paraShikim.length} onClick={ruajEkstraktin} className="btn-primary"><Check className="w-4 h-4" />Ruaj ekstraktin dhe krahaso</button>
              </div>
            </div>
          )}

          {!d ? <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div> : (
            <>
              <div className="px-4 py-2.5 text-sm flex flex-wrap gap-x-6 gap-y-1">
                <span>Sipas bankës: <b>{d.ngarkuar ? eur(d.totalBanka) : "—"}</b></span>
                <span>Në Orë: <b>{eur(d.totalOra)}</b></span>
                {d.ngarkuar && <span className={d.totalBanka - d.totalOra ? "text-red-600" : "text-emerald-700"}>Diferenca: <b>{eur(d.totalBanka - d.totalOra)}</b></span>}
              </div>
              {d.rreshtat.length === 0 ? <p className="p-6 text-sm text-center text-slate-400">S&apos;ka asnjë pagesë nga TIMI në këtë muaj.</p> : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60">
                      <tr><th className="px-3 py-2 text-left">Statusi</th><th className="px-3 py-2 text-left">Në bankë</th><th className="px-3 py-2 text-left">Në Orë</th><th className="px-3 py-2" /></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                      {d.rreshtat.map(r => (
                        <tr key={r.celes}>
                          <td className="px-3 py-2"><span className={`badge ${STATUS[r.status].c}`}>{STATUS[r.status].l}</span>{r.shenim && <span className="block text-[11px] text-slate-500 italic mt-0.5">“{r.shenim}”</span>}</td>
                          <td className="px-3 py-2 text-xs">{r.banka ? <><b className="tabular-nums">{eur(r.banka.cents)}</b> · {formatDate(r.banka.data)}<span className="block text-slate-500 max-w-md truncate" title={r.banka.pershkrim}>{r.banka.pershkrim}</span></> : <span className="text-slate-400">—</span>}</td>
                          <td className="px-3 py-2 text-xs">{r.ora ? <><b className="tabular-nums">{eur(r.ora.cents)}</b> · {formatDate(r.ora.data)} · {r.ora.referenca ?? "pa ref."}<span className="block text-slate-500">{r.ora.prindi ? `${r.ora.prindi} — ` : ""}{r.ora.femijet}</span></> : <span className="text-slate-400">—</span>}</td>
                          <td className="px-3 py-2 text-right whitespace-nowrap">
                            {r.status === "VETEM_BANKE" && !mbyllur && r.banka && (
                              <Link href={`/timi-invest/pagesat/e-re?shuma=${(r.banka.cents / 100).toFixed(2)}&data=${r.banka.data}&referenca=${encodeURIComponent((/SHM\s?\d+[/ ]\d+(?: \d{4})?|Nr\.?\s?[\w/ ]{3,15}/i.exec(r.banka.pershkrim)?.[0] ?? "").trim())}`}
                                className="btn-secondary !py-1 !px-2 !text-xs inline-flex"><Plus className="w-3.5 h-3.5" />Regjistro</Link>
                            )}{" "}
                            {(r.status === "VETEM_BANKE" || r.status === "VETEM_ORA") && !mbyllur && (
                              <button disabled={busy} onClick={() => { const a = window.prompt("Pse është në rregull? (p.sh. 'pagesë e vitit të kaluar', 'kthim i gabuar')"); if (a && a.trim().length >= 3) patch({ veprimi: "SHENO", celes: r.celes, arsye: a.trim() }); }}
                                className="btn-secondary !py-1 !px-2 !text-xs inline-flex"><Check className="w-3.5 h-3.5" />Shëno në rregull</button>
                            )}
                            {r.status === "NE_RREGULL" && !mbyllur && (
                              <button disabled={busy} onClick={() => patch({ veprimi: "HIQ_SHENIM", celes: r.celes })} className="btn-secondary !py-1 !px-2 !text-xs inline-flex"><X className="w-3.5 h-3.5" />Hiq shënimin</button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
