"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import Header from "@/components/layout/Header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { currentSchoolYearStart } from "@/lib/academicYear";
import { ArrowLeft, Download, Printer, Loader2, Search, ChevronDown, ChevronRight } from "lucide-react";

// Raportet → Raporti i përgjithshëm. VETËM LEXIM. Të hyrat sipas DATËS SË PAGESËS; kompensimi
// del veç (s'është para); dorëzimet dhe investimet janë informative, jashtë bilancit.
// Rregullat e të dhënave: src/lib/raportiPergjithshem.ts

type Kanal = "cash" | "banke" | "kompensim" | "pa";
interface L { d: string; lloji: "HYRE" | "SHPENZIM" | "DOREZIM" | "INVESTIM"; kat: string; emri: string; cents: number; kanal: Kanal; ref: string | null }
interface P { kat: string; prituraCents: number; borxhCents: number }
interface Data { nga: string; deri: string; muajt: { muaj: number; vit: number }[]; levizje: L[]; pritje: P[] }

const MUAJT = ["", "Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor", "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor"];
const eur = (c: number) => formatCurrency(c / 100);
const e = (c: number) => Math.round(c) / 100;
const ym = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
const KANAL: Record<Kanal, string> = { cash: "Cash", banke: "Bankë", kompensim: "Kompensim", pa: "Pa metodë" };
const esc = (s: string) => s.replace(/[&<>"]/g, ch => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[ch]!));

export default function RaportiPergjithshemPage() {
  const sot = new Date();
  const vs = currentSchoolYearStart();
  const PRESETS = [
    { l: "Ky muaj", nga: ym(sot), deri: ym(sot) },
    { l: "Muaji i kaluar", nga: ym(new Date(sot.getFullYear(), sot.getMonth() - 1, 1)), deri: ym(new Date(sot.getFullYear(), sot.getMonth() - 1, 1)) },
    { l: `Viti shkollor ${vs}–${String(vs + 1).slice(2)}`, nga: `${vs}-09`, deri: `${vs + 1}-08` },
    { l: `Viti shkollor ${vs - 1}–${String(vs).slice(2)}`, nga: `${vs - 1}-09`, deri: `${vs}-08` },
    { l: `Viti ${sot.getFullYear()}`, nga: `${sot.getFullYear()}-01`, deri: `${sot.getFullYear()}-12` },
  ];
  const [nga, setNga] = useState(PRESETS[2].nga);
  const [deri, setDeri] = useState(PRESETS[2].deri);
  const [d, setD] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [jashte, setJashte] = useState<Set<string>>(new Set()); // kategoritë e përjashtuara
  const [kanal, setKanal] = useState<"ALL" | "cash" | "banke">("ALL");
  const [q, setQ] = useState("");
  const [hapur, setHapur] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setD(null); setErr("");
    fetch(`/api/reports/pergjithshem?nga=${nga}&deri=${deri}`)
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error || "Gabim"); setD(j); })
      .catch(x => setErr(x.message));
  }, [nga, deri]);

  const all = d?.levizje ?? [];
  const katHyra = useMemo(() => [...new Set(all.filter(l => l.lloji === "HYRE").map(l => l.kat))].sort(), [all]);
  const katShp = useMemo(() => [...new Set(all.filter(l => l.lloji === "SHPENZIM").map(l => l.kat))].sort(), [all]);
  const ok = (l: L) => !jashte.has(l.kat) && (kanal === "ALL" || l.kanal === kanal);
  const lev = all.filter(ok);
  const hyra = lev.filter(l => l.lloji === "HYRE"), shp = lev.filter(l => l.lloji === "SHPENZIM");
  const para = (x: L[]) => x.filter(l => l.kanal !== "kompensim").reduce((a, l) => a + l.cents, 0);
  const totH = para(hyra), totS = para(shp), komp = hyra.filter(l => l.kanal === "kompensim").reduce((a, l) => a + l.cents, 0);
  const pritje = (d?.pritje ?? []).filter(p => !jashte.has(p.kat));
  const borxh = pritje.reduce((a, p) => a + p.borxhCents, 0);

  const sipasKat = (lloji: "HYRE" | "SHPENZIM" | "DOREZIM" | "INVESTIM") => {
    const m = new Map<string, { cents: number; cash: number; banke: number; komp: number; pa: number; n: number }>();
    for (const l of lev.filter(x => x.lloji === lloji)) {
      const x = m.get(l.kat) ?? { cents: 0, cash: 0, banke: 0, komp: 0, pa: 0, n: 0 };
      x.n++; if (l.kanal === "kompensim") x.komp += l.cents; else { x.cents += l.cents; if (l.kanal === "cash") x.cash += l.cents; else if (l.kanal === "banke") x.banke += l.cents; else x.pa += l.cents; }
      m.set(l.kat, x);
    }
    return [...m.entries()].sort((a, b) => b[1].cents - a[1].cents);
  };
  const rH = sipasKat("HYRE"), rS = sipasKat("SHPENZIM"), rD = sipasKat("DOREZIM"), rI = sipasKat("INVESTIM");
  const pritjeOf = (kat: string) => pritje.find(p => p.kat === kat);

  // Sipas muajve: kolonat = kategoritë e të hyrave + shpenzimet gjithsej + bilanci
  const muajt = (d?.muajt ?? []).map(m => {
    const k = `${m.vit}-${String(m.muaj).padStart(2, "0")}`;
    const ne = (l: L) => l.d.startsWith(k);
    const h = Object.fromEntries(katHyra.filter(x => !jashte.has(x)).map(kat => [kat, para(hyra.filter(l => ne(l) && l.kat === kat))]));
    return { k, label: `${MUAJT[m.muaj]} ${m.vit}`, h, hyra: para(hyra.filter(ne)), shp: para(shp.filter(ne)) };
  });
  const katAktive = katHyra.filter(x => !jashte.has(x));

  const filtruar = q.trim() ? lev.filter(l => `${l.emri} ${l.kat} ${l.ref ?? ""}`.toLowerCase().includes(q.trim().toLowerCase())) : lev;
  const periudha = d ? `${formatDate(d.nga)} – ${formatDate(d.deri)}` : "";
  const toggle = (kat: string) => setJashte(p => { const n = new Set(p); if (n.has(kat)) n.delete(kat); else n.add(kat); return n; });
  const vetem = (kats: string[], tjeret: string[]) => setJashte(new Set(tjeret.filter(k => !kats.includes(k))));

  function excel() {
    if (!d) return;
    const wb = XLSX.utils.book_new();
    const add = (rows: Record<string, unknown>[], name: string) => { const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{ "": "S'ka të dhëna" }]); ws["!cols"] = Object.keys(rows[0] ?? { a: 1 }).map(k => ({ wch: Math.max(12, Math.min(40, k.length + 4)) })); XLSX.utils.book_append_sheet(wb, ws, name); };
    add([
      { "Zëri": "Periudha", "Shuma (€)": periudha },
      { "Zëri": "Të hyra (pa kompensim)", "Shuma (€)": e(totH) },
      { "Zëri": "Shpenzime", "Shuma (€)": e(totS) },
      { "Zëri": "Bilanci (hyra − shpenzime)", "Shuma (€)": e(totH - totS) },
      { "Zëri": "Kompensim (s'është para)", "Shuma (€)": e(komp) },
      { "Zëri": "Borxh i regjistruar (afat në periudhë)", "Shuma (€)": e(borxh) },
      { "Zëri": "Filtri i mënyrës", "Shuma (€)": kanal === "ALL" ? "Të gjitha" : KANAL[kanal] },
      ...rH.map(([k, x]) => ({ "Zëri": `Hyrë — ${k}`, "Shuma (€)": e(x.cents), "Cash": e(x.cash), "Bankë": e(x.banke), "Kompensim": e(x.komp), "Pritet (€)": e(pritjeOf(k)?.prituraCents ?? 0), "Borxh (€)": e(pritjeOf(k)?.borxhCents ?? 0) })),
      ...rS.map(([k, x]) => ({ "Zëri": `Shpenzim — ${k}`, "Shuma (€)": e(x.cents), "Cash": e(x.cash), "Bankë": e(x.banke) })),
    ], "Përmbledhja");
    add(muajt.map(m => ({ "Muaji": m.label, ...Object.fromEntries(katAktive.map(k => [k, e(m.h[k] ?? 0)])), "Të hyra gjithsej": e(m.hyra), "Shpenzime": e(m.shp), "Bilanci": e(m.hyra - m.shp) })), "Sipas muajve");
    const lista = (x: L[]) => x.map(l => ({ "Data": formatDate(l.d), "Kategoria": l.kat, "Emri": l.emri, "Shuma (€)": e(l.cents), "Mënyra": KANAL[l.kanal], "Referenca": l.ref ?? "" }));
    add(lista(hyra), "Të hyrat");
    add(lista(shp), "Shpenzimet");
    add(pritje.map(p => ({ "Kategoria": p.kat, "Pritet (€)": e(p.prituraCents), "Borxh (€)": e(p.borxhCents) })), "Borxhet");
    add(lista(lev.filter(l => l.lloji === "DOREZIM" || l.lloji === "INVESTIM")), "Dorëzime e investime");
    XLSX.writeFile(wb, `Raporti-i-pergjithshem-${nga}_${deri}.xlsx`);
  }

  function pdf() {
    if (!d) return;
    const tr = (cells: string[], b = false) => `<tr${b ? ' class="t"' : ""}>${cells.map((x, i) => `<td${i ? ' class="r"' : ""}>${x}</td>`).join("")}</tr>`;
    const html = `<!doctype html><html lang="sq"><head><meta charset="utf-8"><title>Raporti i përgjithshëm ${esc(periudha)}</title>
<style>body{font-family:Arial,sans-serif;color:#1e293b;margin:28px;font-size:12px}h1{font-size:18px;margin:2px 0}h2{font-size:13px;margin:18px 0 6px}.s{color:#64748b;font-size:11px}
table{width:100%;border-collapse:collapse}td,th{border-bottom:1px solid #e2e8f0;padding:5px 4px;text-align:left}th{background:#f1f5f9;font-size:10px}.r{text-align:right}.t td{font-weight:bold;border-top:2px solid #94a3b8}
.k{display:flex;gap:10px;margin-top:10px}.k div{flex:1;border:1px solid #e2e8f0;border-radius:8px;padding:8px}.k b{display:block;font-size:15px;margin-top:2px}.br{color:#b45309;font-weight:bold;letter-spacing:1px;font-size:10px}@media print{body{margin:12mm}}</style></head><body>
<div class="br">AKADEMIA ORA</div><h1>Raporti i përgjithshëm i financave</h1><div class="s">Periudha ${esc(periudha)} · të hyrat sipas datës së pagesës${kanal !== "ALL" ? ` · vetëm ${KANAL[kanal]}` : ""}${jashte.size ? ` · pa: ${esc([...jashte].join(", "))}` : ""} · gjeneruar ${formatDate(new Date().toISOString())}</div>
<div class="k"><div>Të hyra<b>${eur(totH)}</b></div><div>Shpenzime<b>${eur(totS)}</b></div><div>Bilanci<b>${eur(totH - totS)}</b></div><div>Borxh i regjistruar<b>${eur(borxh)}</b></div></div>
${komp ? `<p class="s">Kompensim (s'është para, s'hyn në të hyra): ${eur(komp)}</p>` : ""}
<h2>Të hyrat sipas kategorive</h2><table><tr><th>Kategoria</th><th class="r">Paguar</th><th class="r">Cash</th><th class="r">Bankë</th><th class="r">Pritet</th><th class="r">Borxh</th></tr>
${rH.map(([k, x]) => tr([esc(k), eur(x.cents), eur(x.cash), eur(x.banke), eur(pritjeOf(k)?.prituraCents ?? 0), eur(pritjeOf(k)?.borxhCents ?? 0)])).join("")}${tr(["Gjithsej", eur(totH), "", "", "", eur(borxh)], true)}</table>
<h2>Shpenzimet sipas kategorive</h2><table><tr><th>Kategoria</th><th class="r">Paguar</th><th class="r">Cash</th><th class="r">Bankë</th></tr>
${rS.map(([k, x]) => tr([esc(k), eur(x.cents), eur(x.cash), eur(x.banke)])).join("")}${tr(["Gjithsej", eur(totS), "", ""], true)}</table>
<h2>Sipas muajve</h2><table><tr><th>Muaji</th><th class="r">Të hyra</th><th class="r">Shpenzime</th><th class="r">Bilanci</th></tr>
${muajt.map(m => tr([m.label, eur(m.hyra), eur(m.shp), eur(m.hyra - m.shp)])).join("")}${tr(["Gjithsej", eur(totH), eur(totS), eur(totH - totS)], true)}</table>
${rD.length || rI.length ? `<h2>Informative (jashtë bilancit)</h2><table>${[...rD, ...rI].map(([k, x]) => tr([esc(k), eur(x.cents)])).join("")}</table>` : ""}
<script>window.onload=()=>window.print()</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { alert("Lejoni dritaret e reja (pop-up) për këtë faqe."); return; }
    w.document.write(html); w.document.close();
  }

  const Chip = ({ kat }: { kat: string }) => (
    <button onClick={() => toggle(kat)} className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${jashte.has(kat) ? "border-slate-200 dark:border-slate-600 text-slate-400 line-through" : "border-primary-300 bg-primary-50 text-primary-700 dark:bg-primary-900/20 dark:text-primary-300"}`}>{kat}</button>
  );

  return (
    <>
      <Header title="Raporti i përgjithshëm" />
      <div className="p-4 md:p-6 space-y-4 animate-fade-in">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/reports" className="text-xs text-slate-500 hover:text-primary-600 inline-flex items-center gap-1"><ArrowLeft className="w-3.5 h-3.5" />Raportet</Link>
          <div className="flex gap-2">
            <button onClick={excel} disabled={!d} className="btn-secondary"><Download className="w-4 h-4" />Excel</button>
            <button onClick={pdf} disabled={!d} className="btn-primary"><Printer className="w-4 h-4" />PDF</button>
          </div>
        </div>

        {/* Filtrat */}
        <div className="card p-4 space-y-3">
          <div className="flex flex-wrap items-end gap-2">
            {PRESETS.map(p => (
              <button key={p.l} onClick={() => { setNga(p.nga); setDeri(p.deri); }} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border ${nga === p.nga && deri === p.deri ? "bg-primary-600 text-white border-primary-600" : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"}`}>{p.l}</button>
            ))}
            <label className="text-xs text-slate-500 ml-2">Nga <input type="month" value={nga} onChange={ev => ev.target.value && setNga(ev.target.value)} className="form-input !w-auto !py-1" /></label>
            <label className="text-xs text-slate-500">Deri <input type="month" value={deri} onChange={ev => ev.target.value && setDeri(ev.target.value)} className="form-input !w-auto !py-1" /></label>
            <select value={kanal} onChange={ev => setKanal(ev.target.value as typeof kanal)} className="form-input !w-auto !py-1.5 ml-auto">
              <option value="ALL">Mënyra: të gjitha</option><option value="cash">Vetëm Cash</option><option value="banke">Vetëm Bankë</option>
            </select>
          </div>
          {d && (
            <>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500 w-24">Të hyrat:</span>
                {katHyra.map(k => <Chip key={k} kat={k} />)}
                <button onClick={() => vetem(katHyra, [...katHyra, ...katShp])} className="text-[11px] text-primary-600 hover:underline ml-1">vetëm të hyrat</button>
              </div>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-500 w-24">Shpenzimet:</span>
                {katShp.map(k => <Chip key={k} kat={k} />)}
                <button onClick={() => vetem(katShp, [...katHyra, ...katShp])} className="text-[11px] text-primary-600 hover:underline ml-1">vetëm shpenzimet</button>
                <button onClick={() => setJashte(new Set())} className="text-[11px] text-primary-600 hover:underline ml-1">të gjitha</button>
              </div>
              <p className="text-[11px] text-slate-400">Klikoni një kategori për ta hequr/shtuar. Për raportin e një kategorie të vetme: &quot;vetëm …&quot;, pastaj klikoni të tjerat.</p>
            </>
          )}
        </div>

        {err && <div className="card p-4 text-sm text-red-600">{err}</div>}
        {!d && !err && <div className="card p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}

        {d && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <Kart l="Të hyra" v={eur(totH)} tone="text-emerald-700 dark:text-emerald-400" s={komp ? `+ ${eur(komp)} kompensim (s'është para)` : `${hyra.length} pagesa`} />
              <Kart l="Shpenzime" v={eur(totS)} tone="text-red-700 dark:text-red-400" s={`${shp.length} shpenzime`} />
              <Kart l="Bilanci (hyra − shpenzime)" v={eur(totH - totS)} tone={totH - totS >= 0 ? "text-slate-900 dark:text-white" : "text-red-700"} s={periudha} />
              <Kart l="Borxh i regjistruar" v={eur(borxh)} tone="text-amber-700 dark:text-amber-400" s="pagesa me afat në periudhë + shitjet e saj" />
            </div>

            <div className="grid xl:grid-cols-2 gap-4">
              <Tabela titulli="Të hyrat sipas kategorive" koka={["Kategoria", "Paguar", "Cash", "Bankë", "Pritet", "Borxh"]}
                rreshta={rH.map(([k, x]) => [k, eur(x.cents), eur(x.cash), eur(x.banke), pritjeOf(k) ? eur(pritjeOf(k)!.prituraCents) : "—", pritjeOf(k) ? eur(pritjeOf(k)!.borxhCents) : "—"])}
                totali={["Gjithsej", eur(totH), eur(rH.reduce((a, [, x]) => a + x.cash, 0)), eur(rH.reduce((a, [, x]) => a + x.banke, 0)), "", eur(borxh)]} />
              <Tabela titulli="Shpenzimet sipas kategorive" koka={["Kategoria", "Paguar", "Cash", "Bankë"]}
                rreshta={rS.map(([k, x]) => [k, eur(x.cents), eur(x.cash), eur(x.banke)])}
                totali={["Gjithsej", eur(totS), eur(rS.reduce((a, [, x]) => a + x.cash, 0)), eur(rS.reduce((a, [, x]) => a + x.banke, 0))]} />
            </div>

            <Tabela titulli="Sipas muajve" koka={["Muaji", ...katAktive, "Të hyra", "Shpenzime", "Bilanci"]}
              rreshta={muajt.map(m => [m.label, ...katAktive.map(k => m.h[k] ? eur(m.h[k]) : "—"), eur(m.hyra), eur(m.shp), eur(m.hyra - m.shp)])}
              totali={["Gjithsej", ...katAktive.map(k => eur(para(hyra.filter(l => l.kat === k)))), eur(totH), eur(totS), eur(totH - totS)]} />

            {(rD.length > 0 || rI.length > 0) && (
              <Tabela titulli="Informative — jashtë bilancit (dorëzime nga arka, investime)" koka={["Zëri", "Shuma", "Cash", "Bankë"]}
                rreshta={[...rD, ...rI].map(([k, x]) => [k, eur(x.cents), eur(x.cash), eur(x.banke)])} />
            )}

            {/* Lista e detajuar */}
            <div className="card overflow-hidden">
              <div className="px-4 py-3 flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 dark:border-slate-700">
                <h2 className="font-semibold">Lista e detajuar ({filtruar.length})</h2>
                <div className="relative"><Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" /><input value={q} onChange={ev => setQ(ev.target.value)} placeholder="Kërko emrin, kategorinë, kuponin…" className="form-input pl-9 !w-72" /></div>
              </div>
              {(["HYRE", "SHPENZIM", "DOREZIM", "INVESTIM"] as const).map(t => {
                const x = filtruar.filter(l => l.lloji === t);
                if (!x.length) return null;
                const lbl = { HYRE: "Të hyrat", SHPENZIM: "Shpenzimet", DOREZIM: "Dorëzimet", INVESTIM: "Investimet" }[t];
                return (
                  <div key={t} className="border-b border-slate-100 dark:border-slate-700">
                    <button onClick={() => setHapur(h => ({ ...h, [t]: !h[t] }))} className="w-full px-4 py-2 flex items-center gap-2 text-sm font-semibold hover:bg-slate-50 dark:hover:bg-slate-800/40">
                      {hapur[t] ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}{lbl} <span className="text-xs text-slate-400 font-normal">({x.length} · {eur(x.reduce((a, l) => a + l.cents, 0))})</span>
                    </button>
                    {hapur[t] && (
                      <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                        <table className="w-full text-sm">
                          <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60 sticky top-0"><tr><th className="px-3 py-1.5 text-left">Data</th><th className="px-3 py-1.5 text-left">Kategoria</th><th className="px-3 py-1.5 text-left">Emri</th><th className="px-3 py-1.5 text-right">Shuma</th><th className="px-3 py-1.5 text-left">Mënyra</th><th className="px-3 py-1.5 text-left">Referenca</th></tr></thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                            {x.slice(0, 1500).map((l, i) => (
                              <tr key={i}><td className="px-3 py-1 whitespace-nowrap">{formatDate(l.d)}</td><td className="px-3 py-1">{l.kat}</td><td className="px-3 py-1">{l.emri}</td><td className="px-3 py-1 text-right tabular-nums">{eur(l.cents)}</td><td className="px-3 py-1 text-xs">{KANAL[l.kanal]}</td><td className="px-3 py-1 text-xs text-slate-500">{l.ref ?? ""}</td></tr>
                            ))}
                          </tbody>
                        </table>
                        {x.length > 1500 && <p className="px-4 py-2 text-xs text-slate-400">Shfaqen 1.500 të parat — lista e plotë është te Excel-i.</p>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
            <p className="text-[11px] text-slate-400">
              Të hyrat sipas datës së pagesës (vetëm pagesat e konfirmuara). Kompensimi s&apos;numërohet si para. Shpenzimet: të paguarat sipas datës; faturat me pagesa pjesë-pjesë sipas datës së secilës pagesë. &quot;Borxhi i regjistruar&quot; = pagesat me afat brenda periudhës dhe shitjet e periudhës (nxënësit pa plan pagese te Shkollimi s&apos;përfshihen — shih Shkollimin). Raporti vetëm lexon.
            </p>
          </>
        )}
      </div>
    </>
  );
}

function Kart({ l, v, s, tone }: { l: string; v: string; s?: string; tone?: string }) {
  return <div className="card p-4"><p className="text-xs text-slate-500">{l}</p><p className={`text-2xl font-bold ${tone ?? ""}`}>{v}</p>{s && <p className="text-[11px] text-slate-400">{s}</p>}</div>;
}

function Tabela({ titulli, koka, rreshta, totali }: { titulli: string; koka: string[]; rreshta: string[][]; totali?: string[] }) {
  return (
    <div className="card overflow-hidden">
      <div className="px-4 py-3 font-semibold border-b border-slate-100 dark:border-slate-700">{titulli}</div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60"><tr>{koka.map((h, i) => <th key={i} className={`px-3 py-2 whitespace-nowrap ${i ? "text-right" : "text-left"}`}>{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {rreshta.length === 0 ? <tr><td colSpan={koka.length} className="px-3 py-4 text-center text-slate-400">S&apos;ka të dhëna.</td></tr>
              : rreshta.map((r, i) => <tr key={i}>{r.map((c, j) => <td key={j} className={`px-3 py-1.5 ${j ? "text-right tabular-nums whitespace-nowrap" : ""}`}>{c}</td>)}</tr>)}
          </tbody>
          {totali && <tfoot className="bg-slate-50 dark:bg-slate-800/60 font-semibold"><tr>{totali.map((c, j) => <td key={j} className={`px-3 py-2 ${j ? "text-right tabular-nums whitespace-nowrap" : ""}`}>{c}</td>)}</tr></tfoot>}
        </table>
      </div>
    </div>
  );
}
