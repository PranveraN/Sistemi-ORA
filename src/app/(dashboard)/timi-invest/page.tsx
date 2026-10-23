"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { formatCurrency, formatDate } from "@/lib/utils";
import { currentSchoolYearStart } from "@/lib/academicYear";
import { Search, Download, Columns3, Loader2, ChevronLeft, ChevronRight, ExternalLink, AlertTriangle, Users2 } from "lucide-react";

// Moduli TIMI INVEST → Pasqyra (Faza 1 — vetëm lexim, asnjë veprim që ndryshon të dhëna).
// Shifrat vijnë nga /api/timi-invest/pasqyra = e njëjta llogaritje si "Pagesat nga TIMI".

type Vemendje = "DYFISH" | "TEPRICE" | "PROFATURE_30" | "FAZA";
interface Rresht {
  tiId: number; studentId: number; emri: string; klasa: string | null; prindi: string; statusi: string;
  cmimiCents: number; ngaTimiCents: number; meDoreCents: number; paguarCents: number; mbetetCents: number; faza: string;
  fundit: { data: string; cents: number; burimi: "TIMI" | "BANKE" | "CASH" | "TJETER" } | null;
  profatura: { numri: string; data: string; dite: number } | null;
  vemendje: Vemendje[];
}

const FAZA: Record<string, { label: string; cls: string }> = {
  NE_PROCES: { label: "Në proces", cls: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  PROFATURE: { label: "Profaturë", cls: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  KRYER:     { label: "E kryer",   cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  PEZULLUAR: { label: "Pezulluar", cls: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
  ANULUAR:   { label: "Anuluar",   cls: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};
const VEM: Record<Vemendje, string> = {
  DYFISH: "Dyfish?", TEPRICE: "Tepricë", PROFATURE_30: "Profaturë > 30 ditë", FAZA: "Faza s'përputhet",
};
const BURIMI: Record<string, string> = { TIMI: "TIMI", BANKE: "bankë", CASH: "cash", TJETER: "tjetër" };
const COLS = [
  { key: "prindi", label: "Prindi" }, { key: "cmimi", label: "Çmimi TIMI" }, { key: "ngaTimi", label: "Paguar nga TIMI" },
  { key: "paguar", label: "Paguar gjithsej" }, { key: "ecuria", label: "Ecuria" }, { key: "mbetet", label: "Mbetet" },
  { key: "fundit", label: "Pagesa e fundit" }, { key: "faza", label: "Faza" },
] as const;
type ColKey = (typeof COLS)[number]["key"];
const PAGE = 25;
// Rregulli i fazës (i njëjti si rifreskoFazen te src/lib/timiPagesat.ts): pa pagesë → Profaturë,
// ka filluar → Në proces, e shlyer (brenda 0,50 €) → E kryer. Pezulluar/Anuluar s'preken kurrë.
function fazaSipasPagesave(r: { faza: string; paguarCents: number; cmimiCents: number }): string {
  if (r.faza === "PEZULLUAR" || r.faza === "ANULUAR") return r.faza;
  if (r.cmimiCents > 0 && r.paguarCents >= r.cmimiCents - 50) return "KRYER";
  return r.paguarCents > 0 ? "NE_PROCES" : "PROFATURE";
}
const eur = (c: number) => formatCurrency(c / 100);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const LS_COLS = "timi-pasqyra-cols";

export default function TimiPasqyraPage() {
  const [viti, setViti] = useState(currentSchoolYearStart());
  const [rows, setRows] = useState<Rresht[] | null>(null);
  const [error, setError] = useState("");
  const [q, setQ] = useState("");
  const [klasa, setKlasa] = useState("");
  const [cmimi, setCmimi] = useState("");
  const [chip, setChip] = useState<"ALL" | "NE_PROCES" | "PROFATURE" | "KRYER" | "VEMENDJE" | "PA_PAGESE">("ALL");
  const [family, setFamily] = useState(false);
  const [page, setPage] = useState(1);
  const [sel, setSel] = useState<Set<number>>(new Set());
  const [cols, setCols] = useState<Set<ColKey>>(new Set(COLS.map(c => c.key)));
  const [showCols, setShowCols] = useState(false);
  const [updated, setUpdated] = useState<Date | null>(null);
  const [reload, setReload] = useState(0);
  const [busy, setBusy] = useState(false);
  const [showRregullo, setShowRregullo] = useState(false);
  const [perjashto, setPerjashto] = useState<Set<number>>(new Set());

  useEffect(() => {
    try { const v = localStorage.getItem(LS_COLS); if (v) setCols(new Set(JSON.parse(v))); } catch { /* pa localStorage */ }
  }, []);
  useEffect(() => {
    let off = false;
    if (!reload) setRows(null);
    setError("");
    fetch(`/api/timi-invest/pasqyra?viti=${viti}`)
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Gabim"); return d; })
      .then(d => { if (!off) { setRows(d.rreshtat); setUpdated(new Date()); } })
      .catch(e => { if (!off) setError(e.message); });
    return () => { off = true; };
  }, [viti, reload]);
  useEffect(() => { setPage(1); }, [q, klasa, cmimi, chip, family, viti]);

  async function ndryshoFazat(ndryshime: { tiId: number; stage: string }[], arsye: string) {
    if (!ndryshime.length) return;
    setBusy(true);
    const r = await fetch("/api/timi-invest/fazat", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ndryshime, arsye }) });
    setBusy(false);
    if (!r.ok) { alert((await r.json().catch(() => ({}))).error || "Ndryshimi i fazës dështoi."); return; }
    setReload(x => x + 1);
  }

  function toggleCol(k: ColKey) {
    setCols(prev => {
      const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k);
      try { localStorage.setItem(LS_COLS, JSON.stringify([...n])); } catch { /* s'ka rëndësi */ }
      return n;
    });
  }

  const all = rows ?? [];
  // Kartat = të gjithë fëmijët (fotografia e kontrollit), jo vetëm ata të filtruar
  const tot = useMemo(() => {
    const s = (k: "cmimiCents" | "ngaTimiCents" | "meDoreCents" | "paguarCents" | "mbetetCents") => all.reduce((a, r) => a + r[k], 0);
    const families = new Set(all.map(r => norm(r.prindi || r.emri))).size;
    const vem = all.filter(r => r.vemendje.length > 0);
    return {
      n: all.length, families, cmimi: s("cmimiCents"), ngaTimi: s("ngaTimiCents"), meDore: s("meDoreCents"), paguar: s("paguarCents"), mbetet: s("mbetetCents"),
      vem: vem.length,
      dyfish: all.filter(r => r.vemendje.includes("DYFISH")).length,
      prof30: all.filter(r => r.vemendje.includes("PROFATURE_30")).length,
      teprice: all.filter(r => r.vemendje.includes("TEPRICE")).length,
      faza: all.filter(r => r.vemendje.includes("FAZA")).length,
    };
  }, [all]);
  const tjera = Math.max(0, tot.paguar - tot.ngaTimi - tot.meDore);

  const klasat = useMemo(() => [...new Set(all.map(r => r.klasa).filter(Boolean) as string[])].sort((a, b) => a.localeCompare(b, undefined, { numeric: true })), [all]);
  const cmimet = useMemo(() => [...new Set(all.map(r => r.cmimiCents))].sort((a, b) => b - a), [all]);
  const muajiKy = new Date().toISOString().slice(0, 7);

  const base = all.filter(r => {
    if (q) { const t = norm(q); if (!norm(`${r.emri} ${r.prindi}`).includes(t)) return false; }
    if (klasa && r.klasa !== klasa) return false;
    if (cmimi && r.cmimiCents !== Number(cmimi)) return false;
    return true;
  });
  const chipCount = {
    ALL: base.length,
    NE_PROCES: base.filter(r => r.faza === "NE_PROCES").length,
    PROFATURE: base.filter(r => r.faza === "PROFATURE").length,
    KRYER: base.filter(r => r.faza === "KRYER").length,
    VEMENDJE: base.filter(r => r.vemendje.length).length,
    PA_PAGESE: base.filter(r => r.mbetetCents > 0 && !(r.fundit && r.fundit.data.startsWith(muajiKy))).length,
  };
  const filtered = base.filter(r =>
    chip === "ALL" ? true
      : chip === "VEMENDJE" ? r.vemendje.length > 0
      : chip === "PA_PAGESE" ? r.mbetetCents > 0 && !(r.fundit && r.fundit.data.startsWith(muajiKy))
      : r.faza === chip);

  // Grupim sipas familjes (prindit) — familjet sipas renditjes alfabetike
  const ordered = family
    ? [...filtered].sort((a, b) => norm(a.prindi).localeCompare(norm(b.prindi)) || a.emri.localeCompare(b.emri))
    : filtered;
  const pages = Math.max(1, Math.ceil(ordered.length / PAGE));
  const view = ordered.slice((page - 1) * PAGE, page * PAGE);
  const ft = {
    cmimi: filtered.reduce((a, r) => a + r.cmimiCents, 0), ngaTimi: filtered.reduce((a, r) => a + r.ngaTimiCents, 0),
    meDore: filtered.reduce((a, r) => a + r.meDoreCents, 0), paguar: filtered.reduce((a, r) => a + r.paguarCents, 0),
    mbetet: filtered.reduce((a, r) => a + r.mbetetCents, 0),
  };

  function exportExcel(only?: Rresht[]) {
    const list = only ?? ordered;
    const data = list.map(r => ({
      "Fëmija": r.emri, "Klasa": r.klasa ?? "", "Prindi": r.prindi,
      "Çmimi TIMI (€)": r.cmimiCents / 100, "Paguar nga TIMI (€)": r.ngaTimiCents / 100, "TIMI me dorë (€)": r.meDoreCents / 100,
      "Paguar gjithsej (€)": r.paguarCents / 100, "Mbetet (€)": r.mbetetCents / 100,
      "Pagesa e fundit": r.fundit ? `${formatDate(r.fundit.data)} · ${(r.fundit.cents / 100).toFixed(2)} € · ${BURIMI[r.fundit.burimi]}` : "",
      "Profatura e fundit": r.profatura ? `${r.profatura.numri} (${formatDate(r.profatura.data)})` : "",
      "Faza": FAZA[r.faza]?.label ?? r.faza, "Kërkojnë vëmendje": r.vemendje.map(v => VEM[v]).join(", "),
    }));
    const ws = XLSX.utils.json_to_sheet(data);
    ws["!cols"] = [26, 7, 24, 14, 16, 14, 16, 12, 30, 24, 12, 26].map(w => ({ wch: w }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "TIMI");
    XLSX.writeFile(wb, `TIMI-${viti}-${viti + 1}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  const allOnPageSelected = view.length > 0 && view.every(r => sel.has(r.tiId));
  const propozime = all.filter(r => r.statusi === "ACTIVE" && fazaSipasPagesave(r) !== r.faza);
  const pct = (a: number) => (tot.cmimi > 0 ? (a / tot.cmimi) * 100 : 0);

  return (
    <div className="space-y-4">
      {/* Titulli + veprimet */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Fëmijët me TIMI INVEST</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Viti shkollor {viti}–{String(viti + 1).slice(2)}{updated && ` · përditësuar ${updated.toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" })}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {rows && propozime.length > 0 && (
            <button onClick={() => { setPerjashto(new Set()); setShowRregullo(true); }} className="btn-secondary !border-amber-300 !text-amber-800 dark:!text-amber-300">
              Rregullo fazat sipas pagesave ({propozime.length})
            </button>
          )}
          <button onClick={() => exportExcel()} disabled={!rows} className="btn-secondary"><Download className="w-4 h-4" />Eksporto Excel</button>
          <Link href="/timi-invest/pagesat/e-re" className="btn-primary !bg-amber-500 hover:!bg-amber-600">+ Regjistro pagesë nga TIMI</Link>
        </div>
      </div>

      {error && <div className="card p-4 text-sm text-red-600">{error}</div>}

      {/* Kartat */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Card label="Fëmijë me TIMI" value={rows ? String(tot.n) : "…"} sub={rows ? `${tot.families} familje` : ""} />
        <Card label="Çmimi gjithsej" value={rows ? eur(tot.cmimi) : "…"} sub={rows && tot.n ? `mesatarja ${eur(Math.round(tot.cmimi / tot.n))}` : ""} />
        <Card label="Paguar nga TIMI" value={rows ? eur(tot.ngaTimi) : "…"} tone="text-emerald-700 dark:text-emerald-400"
          sub={rows ? `+ ${eur(tot.meDore)} me dorë · + ${eur(tjera)} të tjera` : ""} />
        <Card label="Mbetet" value={rows ? eur(tot.mbetet) : "…"} tone="text-red-700 dark:text-red-400"
          sub={rows && tot.cmimi ? `${Math.round(pct(tot.mbetet))}% e totalit` : ""} />
        <button onClick={() => setChip("VEMENDJE")} className="card p-4 text-left border-amber-300 dark:border-amber-700 bg-amber-50/60 dark:bg-amber-900/10 hover:bg-amber-50 dark:hover:bg-amber-900/20">
          <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">Kërkojnë vëmendje</p>
          <p className="text-2xl font-bold text-amber-700 dark:text-amber-300">{rows ? tot.vem : "…"}</p>
          {rows && <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 leading-tight">
            {[tot.dyfish && `${tot.dyfish} dyfishime`, tot.prof30 && `${tot.prof30} profaturë > 30 ditë`, tot.teprice && `${tot.teprice} tepricë`, tot.faza && `${tot.faza} fazë`].filter(Boolean).join(" · ") || "asgjë"}
          </p>}
        </button>
      </div>

      {/* Ecuria */}
      {rows && tot.cmimi > 0 && (
        <div className="card p-4">
          <div className="flex justify-between text-sm mb-2">
            <span className="font-semibold text-slate-700 dark:text-slate-200">Ecuria e pagesave të TIMI-t</span>
            <span className="text-slate-500">{Math.round(pct(tot.paguar))}% e shlyer</span>
          </div>
          <div className="h-2.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden flex">
            <div className="bg-emerald-500" style={{ width: `${pct(tot.ngaTimi)}%` }} />
            <div className="bg-blue-500" style={{ width: `${pct(tot.meDore)}%` }} />
            <div className="bg-slate-400" style={{ width: `${pct(tjera)}%` }} />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-xs text-slate-500">
            <Legend cls="bg-emerald-500" text={`Nga TIMI (formulari) ${eur(tot.ngaTimi)}`} />
            <Legend cls="bg-blue-500" text={`TIMI me dorë ${eur(tot.meDore)}`} />
            <Legend cls="bg-slate-400" text={`Të tjera ${eur(tjera)}`} />
            <Legend cls="bg-slate-200 dark:bg-slate-600" text={`Mbetet ${eur(tot.mbetet)}`} />
          </div>
        </div>
      )}

      {/* Filtrat */}
      <div className="card p-3 space-y-3">
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Kërko fëmijën ose prindin…" className="form-input pl-9" />
          </div>
          <select value={viti} onChange={e => setViti(Number(e.target.value))} className="form-input !w-auto">
            {[currentSchoolYearStart() - 1, currentSchoolYearStart(), currentSchoolYearStart() + 1].map(y => <option key={y} value={y}>Viti: {y}–{String(y + 1).slice(2)}</option>)}
          </select>
          <select value={klasa} onChange={e => setKlasa(e.target.value)} className="form-input !w-auto">
            <option value="">Klasa: të gjitha</option>
            {klasat.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <select value={cmimi} onChange={e => setCmimi(e.target.value)} className="form-input !w-auto">
            <option value="">Çmimi: të gjitha</option>
            {cmimet.map(c => <option key={c} value={c}>{eur(c)}</option>)}
          </select>
          <label className="flex items-center gap-1.5 text-sm text-slate-600 dark:text-slate-300 px-2 cursor-pointer">
            <input type="checkbox" checked={family} onChange={e => setFamily(e.target.checked)} /> <Users2 className="w-4 h-4" />Grupo sipas familjes
          </label>
          <div className="relative">
            <button onClick={() => setShowCols(v => !v)} className="btn-secondary !py-2"><Columns3 className="w-4 h-4" />Kolonat</button>
            {showCols && (
              <div className="absolute right-0 z-20 mt-1 w-52 card p-2 shadow-lg">
                {COLS.map(c => (
                  <label key={c.key} className="flex items-center gap-2 px-2 py-1 text-sm cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-700 rounded">
                    <input type="checkbox" checked={cols.has(c.key)} onChange={() => toggleCol(c.key)} />{c.label}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {([["ALL", "Të gjithë"], ["NE_PROCES", "Në proces"], ["PROFATURE", "Profaturë"], ["KRYER", "E kryer"], ["VEMENDJE", "⚠ Kërkojnë vëmendje"], ["PA_PAGESE", "Pa pagesë këtë muaj"]] as const).map(([k, label]) => (
            <button key={k} onClick={() => setChip(k)}
              className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${chip === k
                ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                : k === "VEMENDJE" ? "border-amber-300 text-amber-700 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-300 dark:border-amber-700"
                : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
              {label} {chipCount[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Zgjedhja */}
      {sel.size > 0 && (
        <div className="card p-2.5 flex flex-wrap items-center gap-2 bg-violet-50 dark:bg-violet-900/20 border-violet-200 dark:border-violet-800">
          <span className="text-sm font-semibold text-violet-800 dark:text-violet-200 px-2">{sel.size} të zgjedhur</span>
          <button onClick={() => exportExcel(all.filter(r => sel.has(r.tiId)))} className="btn-secondary !py-1.5 !text-xs"><Download className="w-3.5 h-3.5" />Eksporto</button>
          <button onClick={() => setSel(new Set())} className="text-xs text-slate-500 hover:underline px-2">Hiq zgjedhjen</button>
          <select disabled={busy} defaultValue="" className="form-input !w-auto !py-1 !text-xs"
            onChange={e => {
              const st = e.target.value; e.target.value = ""; if (!st) return;
              if (!confirm(`Ndrysho fazën në "${FAZA[st]?.label ?? st}" për ${sel.size} fëmijë?`)) return;
              ndryshoFazat([...sel].map(tiId => ({ tiId, stage: st })), "Ndryshim në grup nga Pasqyra").then(() => setSel(new Set()));
            }}>
            <option value="">Ndrysho fazën…</option>
            {Object.entries(FAZA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <button onClick={() => { const ids = [...new Set(all.filter(r => sel.has(r.tiId)).map(r => r.studentId))]; window.location.href = `/sms?students=${ids.join(",")}`; }} className="btn-secondary !py-1.5 !text-xs">Dërgo SMS prindërve</button>
          <Link href="/timi-invest/pagesat/e-re" className="btn-secondary !py-1.5 !text-xs">Pagesë në grup</Link>
        </div>
      )}

      {/* Tabela */}
      <div className="card overflow-hidden">
        {!rows && !error ? (
          <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-700">
                <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                  <th className="px-3 py-2.5 w-8">
                    <input type="checkbox" checked={allOnPageSelected}
                      onChange={() => setSel(prev => { const n = new Set(prev); view.forEach(r => allOnPageSelected ? n.delete(r.tiId) : n.add(r.tiId)); return n; })} />
                  </th>
                  <th className="px-3 py-2.5">Fëmija</th>
                  {cols.has("prindi") && <th className="px-3 py-2.5">Prindi</th>}
                  {cols.has("cmimi") && <th className="px-3 py-2.5 text-right">Çmimi TIMI</th>}
                  {cols.has("ngaTimi") && <th className="px-3 py-2.5 text-right">Paguar nga TIMI</th>}
                  {cols.has("paguar") && <th className="px-3 py-2.5 text-right">Paguar gjithsej</th>}
                  {cols.has("ecuria") && <th className="px-3 py-2.5 w-28">Ecuria</th>}
                  {cols.has("mbetet") && <th className="px-3 py-2.5 text-right">Mbetet</th>}
                  {cols.has("fundit") && <th className="px-3 py-2.5">Pagesa e fundit</th>}
                  {cols.has("faza") && <th className="px-3 py-2.5">Faza</th>}
                  <th className="px-3 py-2.5 w-8" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {view.length === 0 && (
                  <tr><td colSpan={12} className="px-3 py-10 text-center text-slate-400">S&apos;ka fëmijë për këta filtra.</td></tr>
                )}
                {view.map((r, i) => {
                  const prev = view[i - 1];
                  const newFamily = family && (!prev || norm(prev.prindi) !== norm(r.prindi));
                  const famRows = family ? ordered.filter(x => norm(x.prindi) === norm(r.prindi)) : [];
                  const p = r.cmimiCents > 0 ? Math.min(100, (r.paguarCents / r.cmimiCents) * 100) : 0;
                  return (
                    <FragmentRow key={r.tiId} header={newFamily ? (
                      <tr className="bg-slate-50/80 dark:bg-slate-800/40">
                        <td colSpan={12} className="px-3 py-1.5 text-xs font-semibold text-slate-600 dark:text-slate-300">
                          👪 {r.prindi || "—"} · {famRows.length} fëmijë · çmimi {eur(famRows.reduce((a, x) => a + x.cmimiCents, 0))} · mbetet {eur(famRows.reduce((a, x) => a + x.mbetetCents, 0))}
                        </td>
                      </tr>
                    ) : null}>
                      <tr className={`${sel.has(r.tiId) ? "bg-violet-50/60 dark:bg-violet-900/10" : ""} ${r.statusi !== "ACTIVE" ? "opacity-50" : ""} hover:bg-slate-50 dark:hover:bg-slate-800/40`}>
                        <td className="px-3 py-2">
                          <input type="checkbox" checked={sel.has(r.tiId)} onChange={() => setSel(prev => { const n = new Set(prev); if (n.has(r.tiId)) n.delete(r.tiId); else n.add(r.tiId); return n; })} />
                        </td>
                        <td className="px-3 py-2">
                          <Link href={`/timi-invest/femijet/${r.tiId}`} className="font-semibold text-slate-800 dark:text-slate-100 hover:text-primary-600 hover:underline">{r.emri}</Link>
                          <span className="ml-1.5 text-xs text-slate-400">{r.klasa ?? ""}</span>
                          {r.vemendje.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {r.vemendje.map(v => v === "DYFISH" ? (
                                <Link key={v} href="/timi-invest/dyfishimet" className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-px rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 hover:underline">
                                  <AlertTriangle className="w-2.5 h-2.5" />{VEM[v]}
                                </Link>
                              ) : (
                                <span key={v} className="inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-px rounded bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                                  <AlertTriangle className="w-2.5 h-2.5" />{VEM[v]}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        {cols.has("prindi") && <td className="px-3 py-2 text-slate-500">{r.prindi}</td>}
                        {cols.has("cmimi") && <td className="px-3 py-2 text-right tabular-nums">{eur(r.cmimiCents)}</td>}
                        {cols.has("ngaTimi") && (
                          <td className="px-3 py-2 text-right tabular-nums text-emerald-700 dark:text-emerald-400">
                            {r.ngaTimiCents ? eur(r.ngaTimiCents) : r.meDoreCents ? null : "—"}
                            {r.meDoreCents > 0 && <span className="block text-slate-500 dark:text-slate-400" title="Muaj TIMI të shënuar me dorë (bankë), jo përmes Pagesat nga TIMI">{eur(r.meDoreCents)} <span className="text-[10px]">(me dorë)</span></span>}
                          </td>
                        )}
                        {cols.has("paguar") && <td className="px-3 py-2 text-right tabular-nums">{eur(r.paguarCents)}</td>}
                        {cols.has("ecuria") && (
                          <td className="px-3 py-2">
                            <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                              <div className={`h-full ${p >= 99.9 ? "bg-blue-500" : "bg-emerald-500"}`} style={{ width: `${p}%` }} />
                            </div>
                          </td>
                        )}
                        {cols.has("mbetet") && (
                          <td className={`px-3 py-2 text-right tabular-nums font-semibold ${r.mbetetCents > 0 ? "text-red-700 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>
                            {eur(r.mbetetCents)}
                          </td>
                        )}
                        {cols.has("fundit") && (
                          <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">
                            {r.fundit ? <>{formatDate(r.fundit.data)} · {BURIMI[r.fundit.burimi]}</>
                              : r.profatura ? <span title={`Profatura ${r.profatura.numri}`}>profaturë {r.profatura.dite} ditë</span> : "—"}
                          </td>
                        )}
                        {cols.has("faza") && (
                          <td className="px-3 py-2">
                            <select disabled={busy} value={r.faza} title="Ndrysho fazën (ruhet te Historiku)"
                              onChange={e => ndryshoFazat([{ tiId: r.tiId, stage: e.target.value }], "Ndryshim manual nga Pasqyra")}
                              className={`badge border-0 cursor-pointer pr-1 ${FAZA[r.faza]?.cls ?? "bg-slate-100 text-slate-600"}`}>
                              {Object.entries(FAZA).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                            </select>
                          </td>
                        )}
                        <td className="px-3 py-2">
                          <Link href={`/students/${r.studentId}`} title="Hap profilin e nxënësit" className="text-slate-400 hover:text-primary-600"><ExternalLink className="w-4 h-4" /></Link>
                        </td>
                      </tr>
                    </FragmentRow>
                  );
                })}
              </tbody>
              {filtered.length > 0 && (
                <tfoot className="bg-slate-50 dark:bg-slate-800/60 border-t-2 border-slate-200 dark:border-slate-700 font-semibold">
                  <tr>
                    <td />
                    <td className="px-3 py-2.5 text-xs uppercase text-slate-500">Totali ({filtered.length} fëmijë)</td>
                    {cols.has("prindi") && <td />}
                    {cols.has("cmimi") && <td className="px-3 py-2.5 text-right tabular-nums">{eur(ft.cmimi)}</td>}
                    {cols.has("ngaTimi") && <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700 dark:text-emerald-400">{eur(ft.ngaTimi)}{ft.meDore > 0 && <span className="block text-xs font-normal text-slate-500">+ {eur(ft.meDore)} me dorë</span>}</td>}
                    {cols.has("paguar") && <td className="px-3 py-2.5 text-right tabular-nums">{eur(ft.paguar)}</td>}
                    {cols.has("ecuria") && <td />}
                    {cols.has("mbetet") && <td className="px-3 py-2.5 text-right tabular-nums text-red-700 dark:text-red-400">{eur(ft.mbetet)}</td>}
                    {cols.has("fundit") && <td />}
                    {cols.has("faza") && <td />}
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        )}
        {ordered.length > PAGE && (
          <div className="flex items-center justify-between px-4 py-2.5 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500">
            <span>Shfaqen {(page - 1) * PAGE + 1}–{Math.min(page * PAGE, ordered.length)} nga {ordered.length}</span>
            <div className="flex items-center gap-1">
              <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              {Array.from({ length: pages }, (_, i) => i + 1).map(n => (
                <button key={n} onClick={() => setPage(n)} className={`w-7 h-7 rounded ${n === page ? "bg-primary-600 text-white" : "hover:bg-slate-100 dark:hover:bg-slate-700"}`}>{n}</button>
              ))}
              <button disabled={page >= pages} onClick={() => setPage(p => p + 1)} className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
          </div>
        )}
      </div>
      {showRregullo && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowRregullo(false)}>
          <div className="card w-full max-w-2xl max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <h2 className="font-semibold text-slate-900 dark:text-white">Rregullo fazat sipas pagesave</h2>
              <p className="text-xs text-slate-500 mt-1">
                <b>Profaturë</b> = s&apos;ka asnjë pagesë · <b>Në proces</b> = ka filluar pagesat · <b>E kryer</b> = e ka shlyer çmimin.
                Pezulluar/Anuluar s&apos;preken. Hiqni ✓ te ata që s&apos;doni t&apos;i ndryshoni. Asnjë pagesë s&apos;ndryshon.
              </p>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-sm">
                <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60 sticky top-0">
                  <tr><th className="px-3 py-2 w-8" /><th className="px-3 py-2 text-left">Fëmija</th><th className="px-3 py-2 text-right">Paguar / Çmimi</th><th className="px-3 py-2 text-left">Faza tani</th><th className="px-3 py-2 text-left">Bëhet</th></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {propozime.map(r => {
                    const re = fazaSipasPagesave(r);
                    return (
                      <tr key={r.tiId} className={perjashto.has(r.tiId) ? "opacity-40" : ""}>
                        <td className="px-3 py-1.5"><input type="checkbox" checked={!perjashto.has(r.tiId)} onChange={() => setPerjashto(p => { const n = new Set(p); if (n.has(r.tiId)) n.delete(r.tiId); else n.add(r.tiId); return n; })} /></td>
                        <td className="px-3 py-1.5">{r.emri} <span className="text-xs text-slate-400">{r.klasa ?? ""}</span></td>
                        <td className="px-3 py-1.5 text-right tabular-nums text-xs">{eur(r.paguarCents)} / {eur(r.cmimiCents)}</td>
                        <td className="px-3 py-1.5"><span className={`badge ${FAZA[r.faza]?.cls ?? ""}`}>{FAZA[r.faza]?.label ?? r.faza}</span></td>
                        <td className="px-3 py-1.5"><span className={`badge ${FAZA[re]?.cls ?? ""}`}>→ {FAZA[re]?.label ?? re}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="px-5 py-3 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
              <span className="text-xs text-slate-500">{propozime.length - perjashto.size} ndryshime do të zbatohen · ruhen te Historiku</span>
              <div className="flex gap-2">
                <button onClick={() => setShowRregullo(false)} className="btn-secondary">Anulo</button>
                <button disabled={busy || propozime.length === perjashto.size} className="btn-primary"
                  onClick={async () => { await ndryshoFazat(propozime.filter(r => !perjashto.has(r.tiId)).map(r => ({ tiId: r.tiId, stage: fazaSipasPagesave(r) })), "Rregullim sipas pagesave (Pasqyra)"); setShowRregullo(false); }}>
                  Apliko
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-[11px] text-slate-400">
        Të dhënat lexohen nga e njëjta tabelë pagesash si Shkollimi dhe skeda &quot;Pagesat nga TIMI&quot; — asgjë s&apos;dyfishohet. &quot;Me dorë&quot; = muaj TIMI të shënuar si të paguar me bankë para formularit &quot;Pagesat nga TIMI&quot; (p.sh. qershor–gusht); janë tashmë brenda &quot;Paguar gjithsej&quot;.
      </p>
    </div>
  );
}

function FragmentRow({ header, children }: { header: React.ReactNode; children: React.ReactNode }) {
  return <>{header}{children}</>;
}

function Card({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">{label}</p>
      <p className={`text-2xl font-bold ${tone ?? "text-slate-900 dark:text-white"}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400 leading-tight mt-0.5">{sub}</p>}
    </div>
  );
}

function Legend({ cls, text }: { cls: string; text: string }) {
  return <span className="inline-flex items-center gap-1.5"><span className={`w-2.5 h-2.5 rounded-sm ${cls}`} />{text}</span>;
}
