"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { PhysicalCashView, ReconRow } from "@/lib/cashLedger";
import type { YearType } from "@/lib/academicYear";

// Arka fizike — VETËM për Super Admin: hapet nga ikona e vogël te koka e Pasqyrës.
// Të dhënat (physicalCash, numërimet, pikënisja) s'u dërgohen fare përdoruesve të tjerë
// (shih /api/dashboard/shkollimi-financiare, /api/dashboard/cash-count, /api/settings).

const TEAL = "#0f6b5c";
const num = (v: number) => new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
const eur = (c: number) => `${num(c / 100)} €`;
const dmy = (day: string) => day.split("-").reverse().join(".");

export default function PhysicalCashDialog({ physical: p, year, yearType, onClose }: {
  physical: PhysicalCashView; year: number; yearType: YearType; onClose: () => void;
}) {
  const [countOpen, setCountOpen] = useState(false);
  const [savedCount, setSavedCount] = useState(false);
  const [editStart, setEditStart] = useState(false);
  const [startDay, setStartDay] = useState(p.opening.day);
  const [startAmt, setStartAmt] = useState(p.opening.cents != null ? String(p.opening.cents / 100) : "0");
  const [savingStart, setSavingStart] = useState(false);
  const [startError, setStartError] = useState("");

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape" && !countOpen) onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [countOpen, onClose]);

  const r = p.reconciliation;
  const unknown = p.opening.cents == null;
  const last = p.counts.length > 0 ? p.counts[p.counts.length - 1] : null;
  const diff = last ? last.differenceNowCents : null; // + tepër, − mungon

  async function saveStart(e: React.FormEvent) {
    e.preventDefault();
    setSavingStart(true); setStartError("");
    const res = await fetch("/api/settings", {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arkaFillimiData: startDay, arkaFillimiShuma: startAmt.replace(",", ".") || "0" }),
    }).catch(() => null);
    setSavingStart(false);
    if (!res?.ok) { setStartError("Ruajtja dështoi."); return; }
    window.location.reload();
  }

  return (
    <>
      <div className="fixed inset-0 z-50 bg-black/50 flex items-stretch sm:items-center justify-center sm:p-4"
        onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
        <div role="dialog" aria-modal="true" aria-labelledby="pc-title"
          className="w-full sm:max-w-[640px] h-full sm:h-auto sm:max-h-[90vh] flex flex-col bg-white dark:bg-slate-800 sm:rounded-2xl shadow-2xl overflow-hidden tabular-nums">
          {/* Koka */}
          <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-700">
            <div>
              <div className="flex items-center gap-2">
                <h3 id="pc-title" className="font-bold text-slate-900 dark:text-white">Arka fizike</h3>
                <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 dark:bg-violet-900/40 px-2 py-0.5 text-[11px] font-semibold text-violet-700 dark:text-violet-300">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500" aria-hidden /> Superadmin
                </span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {unknown ? `Lëvizje në arkë nga 1 shtatori ${p.ay}` : `Lëvizje në arkë nga pikënisja ${dmy(p.opening.day)}`}
              </p>
            </div>
            <button type="button" onClick={onClose} aria-label="Mbyll" className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Trupi */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
            <div>
              <p className="text-xs text-slate-500 dark:text-slate-400">Duhet të jenë në arkë sot</p>
              <p className="text-[32px] leading-tight font-bold" style={{ color: TEAL }}>{eur(p.expectedCents)}</p>
            </div>

            {last && diff != null && (
              Math.abs(diff) < 1 ? (
                <CountBox tone="ok" day={last.day} counted={last.countedCents} verdict="Përputhet" />
              ) : diff < 0 ? (
                <CountBox tone="short" day={last.day} counted={last.countedCents} verdict={`Mungojnë ${eur(-diff)}`} />
              ) : (
                <CountBox tone="over" day={last.day} counted={last.countedCents} verdict={`Tepricë ${eur(diff)}`} />
              )
            )}

            {r && (
              <div className="space-y-2">
                <div className="divide-y divide-dashed divide-slate-200 dark:divide-slate-700 text-sm">
                  <Line label="Mbetja sipas vitit" value={eur(r.yearViewCents)} />
                  <Line label="Verë: para 1 shtatorit" sub={`${r.outsideWindow.rows.length} rreshta`}
                    value={`${r.outsideWindow.totalCents >= 0 ? "−" : "+"} ${eur(Math.abs(r.outsideWindow.totalCents))}`}
                    color={r.outsideWindow.totalCents >= 0 ? "#b42318" : TEAL} />
                  <Line label="Për vit tjetër / jashtë Pasqyrës" sub={`${r.otherYear.rows.length} rreshta · p.sh. Koprani`}
                    value={`${r.otherYear.totalCents >= 0 ? "+" : "−"} ${eur(Math.abs(r.otherYear.totalCents))}`}
                    color={r.otherYear.totalCents >= 0 ? TEAL : "#b42318"} />
                </div>
                <div className="flex items-center justify-between rounded-lg px-3 py-2.5 bg-[#eef6f3] dark:bg-teal-950/40">
                  <span className="text-sm font-semibold text-slate-800 dark:text-slate-100">
                    {unknown ? "Duhet të jenë në arkë" : "Lëvizjet në arkë nga 1 shtatori"}
                  </span>
                  <span className="text-lg font-bold" style={{ color: TEAL }}>{eur(r.physicalWindowCents)}</span>
                </div>
                <p className={`text-right text-xs ${r.identityHolds ? "" : "text-red-700 dark:text-red-400 font-semibold"}`} style={r.identityHolds ? { color: TEAL } : undefined}>
                  {r.identityHolds ? "✓ Përputhet me lëvizjet në arkë" : "✗ Nuk përputhet me lëvizjet në arkë — kontrollo rreshtat më poshtë"}
                </p>

                <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-200 dark:divide-slate-700">
                  <Rows title="Verë: para 1 shtatorit" rows={r.outsideWindow.rows} />
                  <Rows title="Për vit tjetër / jashtë Pasqyrës" rows={r.otherYear.rows} />
                </div>
              </div>
            )}

            {editStart && (
              <form onSubmit={saveStart} className="rounded-lg border border-slate-200 dark:border-slate-700 p-3 flex flex-wrap items-end gap-2 text-xs">
                <label className="text-slate-600 dark:text-slate-300">Arka kishte në fund të ditës<br />
                  <input type="date" required className="form-input py-1 text-xs" value={startDay} onChange={e => setStartDay(e.target.value)} />
                </label>
                <label className="text-slate-600 dark:text-slate-300">Shuma (€)<br />
                  <input inputMode="decimal" className="form-input py-1 text-xs w-28" value={startAmt} onChange={e => setStartAmt(e.target.value)} />
                </label>
                <button type="submit" disabled={savingStart} className="btn-primary text-xs py-1.5">
                  {savingStart && <Loader2 className="w-3.5 h-3.5 animate-spin" aria-hidden />} Ruaj
                </button>
                <button type="button" onClick={() => setEditStart(false)} className="btn-secondary text-xs py-1.5">Anulo</button>
                {startError && <p role="alert" className="w-full text-red-600">{startError}</p>}
              </form>
            )}

            <div className="text-xs text-slate-500 dark:text-slate-400 space-y-1">
              <p>
                {unknown
                  ? <>Pikënisja: paratë që ishin në arkë më {dmy(p.opening.day)} (s&apos;dihet)</>
                  : <>Pikënisja: {eur(p.opening.cents!)} në fund të {dmy(p.opening.day)}</>}
              </p>
              {p.futureCount > 0 && (
                <p className="text-amber-700 dark:text-amber-400">⚠ {p.futureCount} {p.futureCount === 1 ? "pagesë" : "pagesa"} me datë në të ardhmen — kontrolloje datën.</p>
              )}
            </div>
          </div>

          {/* Fundi */}
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/40">
            <button type="button" onClick={() => setEditStart(v => !v)} className="text-sm font-semibold hover:underline" style={{ color: TEAL }}>
              {unknown ? "Vendos pikënisjen" : "Ndrysho pikënisjen"}
            </button>
            <div className="flex gap-2">
              <button type="button" onClick={onClose} className="btn-secondary">Mbyll</button>
              <button type="button" onClick={() => setCountOpen(true)} className="px-3.5 py-2 rounded-lg text-sm font-semibold text-white hover:opacity-90" style={{ background: TEAL }}>
                Numëro arkën
              </button>
            </div>
          </div>
        </div>
      </div>

      {countOpen && (
        <CashCountModal year={year} yearType={yearType} system={p.expectedCents / 100} unknownOpening={unknown}
          onClose={() => { setCountOpen(false); if (savedCount) window.location.reload(); }}
          onSaved={() => setSavedCount(true)} />
      )}
    </>
  );
}

function CountBox({ tone, day, counted, verdict }: { tone: "short" | "over" | "ok"; day: string; counted: number; verdict: string }) {
  const box = tone === "short" ? "bg-[#fdf1f1] border-[#f3d3d3] dark:bg-red-950/30 dark:border-red-900"
    : tone === "over" ? "bg-[#eef6f3] border-[#cfe5dd] dark:bg-teal-950/30 dark:border-teal-900"
    : "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-900";
  const label = tone === "short" ? "text-red-700 dark:text-red-400" : "text-slate-500 dark:text-slate-400";
  const big = tone === "short" ? "text-[#9b1c1c] dark:text-red-300" : tone === "ok" ? "text-green-700 dark:text-green-400" : "";
  return (
    <div className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 ${box}`}>
      <div>
        <p className={`text-[11px] ${label}`}>Numërimi i fundit · {dmy(day)}</p>
        <p className="text-sm text-slate-700 dark:text-slate-200">Numëruar: <b>{eur(counted)}</b></p>
      </div>
      <p className={`text-lg font-bold ${big}`} style={tone === "over" ? { color: TEAL } : undefined}>{verdict}</p>
    </div>
  );
}

function Line({ label, sub, value, color }: { label: string; sub?: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div>
        <p className="text-slate-700 dark:text-slate-200">{label}</p>
        {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
      </div>
      <p className="font-semibold whitespace-nowrap text-slate-900 dark:text-white" style={color ? { color } : undefined}>{value}</p>
    </div>
  );
}

function Rows({ title, rows }: { title: string; rows: ReconRow[] }) {
  return (
    <details className="group">
      <summary className="cursor-pointer list-none flex items-center justify-between gap-2 px-3 py-2 text-sm text-slate-700 dark:text-slate-200">
        <span><span className="inline-block transition-transform group-open:rotate-90 mr-1.5 text-slate-400">▸</span>{title}</span>
        <span className="text-xs text-slate-400">{rows.length} rreshta</span>
      </summary>
      {rows.length > 0 && (
        <div className="max-h-64 overflow-auto px-3 pb-2">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="py-1 pr-2 font-medium">Data</th>
                <th className="py-1 pr-2 font-medium">Përshkrimi</th>
                <th className="py-1 font-medium text-right">Shuma</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {rows.map(x => (
                <tr key={x.key}>
                  <td className="py-1 pr-2 whitespace-nowrap text-slate-500">{dmy(x.day)}</td>
                  <td className="py-1 pr-2 text-slate-700 dark:text-slate-300">{x.label} <span className="text-slate-400">— {x.reason}</span></td>
                  <td className={`py-1 text-right whitespace-nowrap font-semibold ${x.cents < 0 ? "text-red-700 dark:text-red-400" : "text-slate-900 dark:text-white"}`}>
                    {x.cents < 0 ? "−" : "+"} {eur(Math.abs(x.cents))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </details>
  );
}

function countVerdict(diff: number): string {
  if (Math.abs(diff) < 0.005) return "Përputhet ✓";
  return diff < 0 ? `Mungojnë ${num(-diff)} €` : `Tepër ${num(diff)} €`;
}

interface CountRow { id: number; createdAt: string; countedAmount: number; systemAmount: number; difference: number; userName: string | null; basis?: string | null }

function CashCountModal({ year, yearType, system, unknownOpening, onClose, onSaved }: {
  year: number; yearType: YearType; system: number; unknownOpening?: boolean; onClose: () => void; onSaved: () => void;
}) {
  const [value, setValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<CountRow | null>(null);
  const [history, setHistory] = useState<CountRow[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    fetch(`/api/dashboard/cash-count?year=${year}&yearType=${yearType}`).then(r => (r.ok ? r.json() : [])).then(setHistory).catch(() => {});
  }, [year, yearType]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    // pranon "13513.52", "13513,52" dhe "13.513,52"
    const v = value.trim().replace(/\s|€/g, "");
    const counted = parseFloat(v.includes(",") ? v.replace(/\./g, "").replace(",", ".") : v);
    if (!Number.isFinite(counted) || counted < 0) { setError("Shkruani shumën e numëruar (€)."); inputRef.current?.focus(); return; }
    setSaving(true); setError("");
    try {
      const r = await fetch("/api/dashboard/cash-count", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ counted, year, yearType }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Ruajtja dështoi."); return; }
      setResult(d);
      setHistory(h => [d, ...h]);
      onSaved();
    } catch {
      setError("Gabim rrjeti — provo përsëri.");
    } finally {
      setSaving(false);
    }
  }

  const ok = result && Math.abs(result.difference) < 0.005;
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}
      onKeyDown={e => { if (e.key === "Escape") onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="cc-title" className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <h3 id="cc-title" className="font-bold text-slate-900 dark:text-white">Numëro arkën</h3>
          <button type="button" onClick={onClose} aria-label="Mbyll" className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
        </div>
        <form onSubmit={save} className="p-5 space-y-4">
          <div>
            <label htmlFor="cc-amount" className="form-label">Sa para ke në arkë? (€)</label>
            <input id="cc-amount" ref={inputRef} inputMode="decimal" value={value} onChange={e => { setValue(e.target.value); setResult(null); }}
              className="form-input text-lg" placeholder="0,00" autoComplete="off" />
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5">Duhet të jenë në arkë: {num(system)} €{unknownOpening && " + paratë e 31.08 (s'dihen)"}</p>
          </div>
          {error && <p role="alert" className="text-sm text-red-600 dark:text-red-400">{error}</p>}
          {result && (
            <p role="status" className={`rounded-xl px-4 py-3 font-bold ${ok ? "bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300" : "bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300"}`}>
              {countVerdict(result.difference)}
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Mbyll</button>
            <button type="submit" disabled={saving} className="btn-primary">
              {saving && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} Ruaj numërimin
            </button>
          </div>
        </form>
        {history.length > 0 && (
          <div className="px-5 pb-5">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-2">Numërimet e mëparshme</p>
            <ul className="max-h-48 overflow-auto divide-y divide-slate-100 dark:divide-slate-700 text-sm">
              {history.map(h => (
                <li key={h.id} className="py-2 flex justify-between gap-3">
                  <span className="text-slate-600 dark:text-slate-300">
                    {formatDate(h.createdAt)} · {num(h.countedAmount)} €
                    {h.userName && <span className="text-slate-400"> · {h.userName}</span>}
                    {h.basis !== "DATA_REALE" && <span className="block text-[11px] text-slate-400">krahasuar me Pasqyrën e vitit (logjika e vjetër)</span>}
                  </span>
                  <span className={`font-semibold whitespace-nowrap ${Math.abs(h.difference) < 0.005 ? "text-green-700 dark:text-green-400" : "text-orange-700 dark:text-orange-400"}`}>{countVerdict(h.difference)}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}
