"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import { exportToExcel } from "@/lib/exportExcel";
import FindingDetail from "@/components/auditimi/FindingDetail";
import HistoryTab from "@/components/auditimi/HistoryTab";
import RulesTab from "@/components/auditimi/RulesTab";
import { SEV_LABEL, SEV_CLASS, SEVERITIES, STATUS_LABEL, STATUS_CLASS, STATUSES, MODULE_LABEL, RUN_STATUS, euro, fmtDateTime } from "@/components/auditimi/labels";
import { ACADEMIC_YEARS } from "@/lib/academicYear";
import { ShieldCheck, Loader2, Play, Printer, ChevronLeft, ChevronRight, Download } from "lucide-react";

// "Auditimi" (Faza 4) — gjetjet e motorit të rregullave: përmbledhja, lista me
// filtra, detajet me dëshmi, statusi me koment, historiku i ndryshimeve,
// rregullat/pragjet dhe ekzekutimet. Super Admin dhe roli Auditor.

interface Finding {
  id: number; ruleCode: string; severity: string; module: string; status: string; title: string; description: string | null;
  amountCents: number | null; entityType: string | null; entityId: number | null; createdAt: string; lastSeenAt: string | null;
}
interface Summary {
  bySeverity: Record<string, { count: number; amountCents: number }>;
  byModule: Record<string, number>;
  byStatus: Record<string, number>;
  lastRun: { startedAt: string; status: string; findingsNew: number; findingsSeen: number } | null;
  lastOk: { startedAt: string } | null;
  activeRules: number;
}
type Tab = "gjetjet" | "historiku" | "rregullat";

const columns = [
  { header: "Rëndësia", value: (f: Finding) => SEV_LABEL[f.severity] ?? f.severity },
  { header: "Rregulli", value: (f: Finding) => f.ruleCode },
  { header: "Moduli", value: (f: Finding) => MODULE_LABEL[f.module] ?? f.module },
  { header: "Gjetja", value: (f: Finding) => f.title, width: 60 },
  { header: "Përshkrimi", value: (f: Finding) => f.description ?? "", width: 60 },
  { header: "Shuma (€)", value: (f: Finding) => (f.amountCents == null ? "" : f.amountCents / 100) },
  { header: "Statusi", value: (f: Finding) => STATUS_LABEL[f.status] ?? f.status },
  { header: "Gjetur më", value: (f: Finding) => fmtDateTime(f.createdAt) },
];

const esc = (s: unknown) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export default function AuditimiPage() {
  const [tab, setTab] = useState<Tab>("gjetjet");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [rows, setRows] = useState<Finding[]>([]);
  const [total, setTotal] = useState(0);
  const [rules, setRules] = useState<{ code: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState("");
  const [detail, setDetail] = useState<number | null>(null);
  const [f, setF] = useState({ status: "HAPUR", severity: "", module: "", rule: "", year: "", from: "", to: "", q: "" });
  const [page, setPage] = useState(1);
  const LIMIT = 50;

  const query = useCallback((extra: Record<string, string> = {}) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries({ ...f, ...extra })) if (v) p.set(k, v);
    return p.toString();
  }, [f]);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [s, l] = await Promise.all([
        fetch("/api/auditimi/permbledhje").then(r => r.json().then(j => (r.ok ? j : Promise.reject(new Error(j.error))))),
        fetch(`/api/auditimi/gjetjet?${query({ page: String(page), limit: String(LIMIT) })}`).then(r => r.json().then(j => (r.ok ? j : Promise.reject(new Error(j.error))))),
      ]);
      setSummary(s); setRows(l.rows); setTotal(l.total); setRules(l.rules);
    } catch (e) {
      setError(e instanceof Error ? e.message : "S'u ngarkua.");
    } finally {
      setLoading(false);
    }
  }, [query, page]);
  useEffect(() => { if (tab === "gjetjet") load(); }, [load, tab]);

  const setFilter = (k: keyof typeof f, v: string) => { setPage(1); setF(x => ({ ...x, [k]: v })); };

  async function runNow() {
    setRunning(true); setRunMsg("");
    const r = await fetch("/api/auditimi/ekzekuto", { method: "POST" });
    const j = await r.json().catch(() => ({}));
    setRunning(false);
    if (!r.ok) { setRunMsg(j.error || "Ekzekutimi dështoi."); return; }
    setRunMsg(`U krye: ${j.findingsNew} gjetje të reja, ${j.findingsSeen} gjithsej.`);
    load();
  }

  async function allRows(): Promise<Finding[]> {
    const r = await fetch(`/api/auditimi/gjetjet?${query({ all: "1" })}`);
    const j = await r.json();
    return r.ok ? j.rows : [];
  }

  async function printReport() {
    const list = await allRows();
    const w = window.open("", "_blank");
    if (!w) { alert("Lejoni dritaret e reja (pop-up) për të printuar raportin."); return; }
    const filters = [
      f.status && `Statusi: ${f.status === "HAPUR" ? "të hapura" : STATUS_LABEL[f.status]}`, f.severity && `Rëndësia: ${SEV_LABEL[f.severity]}`,
      f.module && `Moduli: ${MODULE_LABEL[f.module] ?? f.module}`, f.rule && `Rregulli: ${f.rule}`, f.year && `Viti: ${f.year}–${Number(f.year) + 1}`,
      f.from && `Nga: ${f.from}`, f.to && `Deri: ${f.to}`, f.q && `Kërkimi: "${f.q}"`,
    ].filter(Boolean).join(" · ") || "Të gjitha";
    const counts = SEVERITIES.map(s => `${SEV_LABEL[s]}: ${list.filter(x => x.severity === s).length}`).join(" · ");
    w.document.write(`<!doctype html><html lang="sq"><head><meta charset="utf-8"><title>Raporti i auditimit</title>
      <style>body{font-family:system-ui,sans-serif;font-size:11px;margin:24px;color:#111}h1{font-size:18px;margin:0 0 4px}p{margin:2px 0}
      table{width:100%;border-collapse:collapse;margin-top:12px}th,td{border:1px solid #ccc;padding:4px 6px;text-align:left;vertical-align:top}
      th{background:#f1f5f9}.r{text-align:right;white-space:nowrap}@media print{button{display:none}}</style></head><body>
      <h1>Raporti i auditimit — Akademia Ora</h1>
      <p>Printuar më ${esc(fmtDateTime(new Date()))} · ${esc(filters)}</p><p><b>${list.length} gjetje</b> · ${esc(counts)}</p>
      <table><thead><tr><th>#</th><th>Rëndësia</th><th>Rregulli</th><th>Gjetja</th><th class="r">Shuma</th><th>Statusi</th><th>Gjetur më</th></tr></thead><tbody>
      ${list.map((x, i) => `<tr><td>${i + 1}</td><td>${esc(SEV_LABEL[x.severity])}</td><td>${esc(x.ruleCode)}</td><td><b>${esc(x.title)}</b>${x.description ? `<br>${esc(x.description)}` : ""}</td>
        <td class="r">${esc(euro(x.amountCents))}</td><td>${esc(STATUS_LABEL[x.status])}</td><td>${esc(fmtDateTime(x.createdAt))}</td></tr>`).join("")}
      </tbody></table><p style="margin-top:16px"><button onclick="print()">Printo / Ruaj si PDF</button></p></body></html>`);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 300);
  }

  const openCount = (summary?.byStatus.E_RE ?? 0) + (summary?.byStatus.NE_SHQYRTIM ?? 0);
  const pages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <>
      <Header title="Auditimi" />
      <div className="p-4 sm:p-6 space-y-5 animate-fade-in">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><ShieldCheck className="w-5 h-5 text-primary-500" /> Auditimi</h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
              Kontrolli i fundit: {summary?.lastRun ? <>{fmtDateTime(summary.lastRun.startedAt)} · {RUN_STATUS[summary.lastRun.status] ?? summary.lastRun.status}</> : "ende asnjë"}
              {" "}· Kontrollohet vetë çdo natë pas orës 02:00 · {summary?.activeRules ?? "—"} rregulla aktive
            </p>
          </div>
          <div className="flex flex-col items-end gap-1">
            <button type="button" onClick={runNow} disabled={running} className="btn-primary">
              {running ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Ekzekuto tani
            </button>
            {runMsg && <span className="text-xs text-slate-600 dark:text-slate-300" role="status">{runMsg}</span>}
          </div>
        </div>

        <div className="flex gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit" role="tablist">
          {([["gjetjet", `Gjetjet (${openCount} të hapura)`], ["historiku", "Historiku i ndryshimeve"], ["rregullat", "Rregullat dhe ekzekutimet"]] as const).map(([k, label]) => (
            <button key={k} type="button" role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
              className={`px-3.5 py-2 rounded-lg text-sm font-medium ${tab === k ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
              {label}
            </button>
          ))}
        </div>

        {tab === "historiku" && <HistoryTab />}
        {tab === "rregullat" && <RulesTab />}

        {tab === "gjetjet" && (
          <>
            {/* Përmbledhja sipas rëndësisë (të hapurat) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {SEVERITIES.map(s => {
                const v = summary?.bySeverity[s];
                return (
                  <button key={s} type="button" onClick={() => setFilter("severity", f.severity === s ? "" : s)}
                    className={`card p-4 text-left transition-shadow hover:shadow-md ${f.severity === s ? "ring-2 ring-primary-400" : ""}`}>
                    <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${SEV_CLASS[s]}`}>{SEV_LABEL[s]}</span>
                    <p className="text-2xl font-extrabold text-slate-900 dark:text-white mt-2">{v?.count ?? 0}</p>
                    <p className="text-xs text-slate-500">të hapura{v?.amountCents ? ` · ${euro(Math.abs(v.amountCents))}` : ""}</p>
                  </button>
                );
              })}
            </div>
            {summary && Object.keys(summary.byModule).length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="text-slate-500 self-center">Sipas modulit:</span>
                {Object.entries(summary.byModule).sort((a, b) => b[1] - a[1]).map(([m, n]) => (
                  <button key={m} type="button" onClick={() => setFilter("module", f.module === m ? "" : m)}
                    className={`px-2.5 py-1 rounded-full border ${f.module === m ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30" : "border-slate-200 dark:border-slate-700"}`}>
                    {MODULE_LABEL[m] ?? m} <b>{n}</b>
                  </button>
                ))}
              </div>
            )}

            {/* Filtrat */}
            <div className="card p-3 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-2 items-end">
              <div><label htmlFor="f-status" className="form-label">Statusi</label>
                <select id="f-status" className="form-input" value={f.status} onChange={e => setFilter("status", e.target.value)}>
                  <option value="HAPUR">Të hapura</option><option value="">Të gjitha</option>
                  {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select></div>
              <div><label htmlFor="f-sev" className="form-label">Rëndësia</label>
                <select id="f-sev" className="form-input" value={f.severity} onChange={e => setFilter("severity", e.target.value)}>
                  <option value="">Të gjitha</option>{SEVERITIES.map(s => <option key={s} value={s}>{SEV_LABEL[s]}</option>)}
                </select></div>
              <div><label htmlFor="f-mod" className="form-label">Moduli</label>
                <select id="f-mod" className="form-input" value={f.module} onChange={e => setFilter("module", e.target.value)}>
                  <option value="">Të gjitha</option>{Object.keys(MODULE_LABEL).map(m => <option key={m} value={m}>{MODULE_LABEL[m]}</option>)}
                </select></div>
              <div><label htmlFor="f-rule" className="form-label">Rregulli</label>
                <select id="f-rule" className="form-input" value={f.rule} onChange={e => setFilter("rule", e.target.value)}>
                  <option value="">Të gjitha</option>{rules.sort((a, b) => a.code.localeCompare(b.code, "en", { numeric: true })).map(r => <option key={r.code} value={r.code}>{r.code} — {r.name}</option>)}
                </select></div>
              <div><label htmlFor="f-year" className="form-label">Viti akademik</label>
                <select id="f-year" className="form-input" value={f.year} onChange={e => setFilter("year", e.target.value)}>
                  <option value="">Të gjitha</option>{ACADEMIC_YEARS.map(y => <option key={y} value={y}>{y}–{y + 1}</option>)}
                </select></div>
              <div><label htmlFor="f-from" className="form-label">Nga</label><input id="f-from" type="date" className="form-input" value={f.from} onChange={e => setFilter("from", e.target.value)} /></div>
              <div><label htmlFor="f-to" className="form-label">Deri</label><input id="f-to" type="date" className="form-input" value={f.to} onChange={e => setFilter("to", e.target.value)} /></div>
              <div><label htmlFor="f-q" className="form-label">Kërko</label><input id="f-q" className="form-input" value={f.q} onChange={e => setFilter("q", e.target.value)} placeholder="emri, numri…" /></div>
            </div>

            {error && <p role="alert" className="text-red-600">{error}</p>}

            <section className="card overflow-hidden">
              <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-slate-100 dark:border-slate-700">
                <h2 className="font-bold text-slate-900 dark:text-white">{total} gjetje {loading && <Loader2 className="w-4 h-4 animate-spin inline text-primary-400" aria-label="Duke ngarkuar" />}</h2>
                <div className="flex gap-2">
                  <button type="button" onClick={printReport} className="btn-secondary text-sm" disabled={total === 0}><Printer className="w-4 h-4" /> Printo / PDF</button>
                  <button type="button" className="btn-secondary text-sm" disabled={total === 0}
                    onClick={async () => exportToExcel(`Raporti-i-auditimit-${new Date().toISOString().slice(0, 10)}`, columns, await allRows(), "Gjetjet")}>
                    <Download className="w-4 h-4" /> Eksporto Excel (të gjitha {total})
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm min-w-[820px]">
                  <thead>
                    <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50 dark:bg-slate-800/60">
                      <th className="px-4 py-2.5">Rëndësia</th><th className="px-4 py-2.5">Gjetja</th><th className="px-4 py-2.5 text-right">Shuma</th>
                      <th className="px-4 py-2.5">Statusi</th><th className="px-4 py-2.5">Gjetur më</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {!loading && rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-slate-500">S&apos;ka gjetje për këto filtra.</td></tr>}
                    {rows.map(x => (
                      <tr key={x.id} className="hover:bg-slate-50/70 dark:hover:bg-slate-800/40 cursor-pointer" onClick={() => setDetail(x.id)}>
                        <td className="px-4 py-2.5 align-top"><span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ${SEV_CLASS[x.severity]}`}>{SEV_LABEL[x.severity]}</span></td>
                        <td className="px-4 py-2.5">
                          <button type="button" className="text-left font-medium text-slate-900 dark:text-white hover:underline" onClick={e => { e.stopPropagation(); setDetail(x.id); }}>{x.title}</button>
                          <p className="text-xs text-slate-500 mt-0.5">{x.ruleCode} · {MODULE_LABEL[x.module] ?? x.module}{x.description ? ` · ${x.description.slice(0, 140)}${x.description.length > 140 ? "…" : ""}` : ""}</p>
                        </td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap font-semibold">{euro(x.amountCents)}</td>
                        <td className="px-4 py-2.5"><span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded whitespace-nowrap ${STATUS_CLASS[x.status]}`}>{STATUS_LABEL[x.status] ?? x.status}</span></td>
                        <td className="px-4 py-2.5 text-xs text-slate-500 whitespace-nowrap">{fmtDateTime(x.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {pages > 1 && (
                <div className="flex items-center justify-end gap-2 p-3 border-t border-slate-100 dark:border-slate-700 text-sm">
                  <button type="button" className="btn-secondary py-1" disabled={page <= 1} onClick={() => setPage(p => p - 1)} aria-label="Faqja e mëparshme"><ChevronLeft className="w-4 h-4" /></button>
                  <span>Faqja {page} nga {pages}</span>
                  <button type="button" className="btn-secondary py-1" disabled={page >= pages} onClick={() => setPage(p => p + 1)} aria-label="Faqja tjetër"><ChevronRight className="w-4 h-4" /></button>
                </div>
              )}
            </section>
          </>
        )}
      </div>
      {detail != null && <FindingDetail id={detail} onClose={() => setDetail(null)} onChanged={load} />}
    </>
  );
}
