"use client";

import { useState } from "react";
import { Calculator, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Box { key: string; label: string; fromDay: string; openingCents: number; expectedCents: number }
interface Data { today: string; boxes: Box[]; totalCents: number }

const eur = (c: number) => formatCurrency(c / 100);
const dmy = (d: string) => d.split("-").reverse().join(".");
const nextDay = (d: string) => new Date(new Date(`${d}T00:00:00Z`).getTime() + 86_400_000).toISOString().slice(0, 10);
const toCents = (s: string) => { const n = parseFloat(s.replace(",", ".")); return Number.isFinite(n) ? Math.round(n * 100) : null; };

/** Tabela e vogël e arkave: me një klik — sa duhet të jenë cash sot në secilën; numërimi shkruhet vetëm për krahasim (s'ruhet). */
export default function CashBoxesTable() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [counted, setCounted] = useState<Record<string, string>>({});

  async function load() {
    setLoading(true); setError(null);
    const r = await fetch("/api/arka/gjendja").catch(() => null);
    if (r?.ok) setData(await r.json()); else setError("S'u llogarit. Provo përsëri.");
    setLoading(false);
  }

  const diffs = data?.boxes.map(b => { const c = toCents(counted[b.key] ?? ""); return c == null ? null : c - b.expectedCents; }) ?? [];
  const countedTotal = data && data.boxes.every(b => toCents(counted[b.key] ?? "") != null)
    ? data.boxes.reduce((s, b) => s + toCents(counted[b.key])!, 0) : null;

  return (
    <section className="card p-4 sm:p-5" aria-labelledby="arkat-sot">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 id="arkat-sot" className="font-bold text-slate-800 dark:text-slate-100">
          Arkat — sa duhet të jenë cash sot{data ? ` (${dmy(data.today)})` : ""}
        </h3>
        <button onClick={load} disabled={loading}
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium bg-[#0F766E] text-white hover:bg-[#0d6961] disabled:opacity-60">
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
          {data ? "Llogarit përsëri" : "Llogarit arkat"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600 mt-2">{error}</p>}
      {data && (
        <div className="overflow-x-auto mt-3">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700">
                <th className="py-1.5 pr-3 font-medium">Arka</th>
                <th className="py-1.5 pr-3 font-medium text-right">Duhet të jenë</th>
                <th className="py-1.5 pr-3 font-medium text-right">Numëruar</th>
                <th className="py-1.5 font-medium text-right">Diferenca</th>
              </tr>
            </thead>
            <tbody>
              {data.boxes.map((b, i) => {
                const d = diffs[i];
                return (
                  <tr key={b.key} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-1.5 pr-3">
                      {b.label}
                      <span className="block text-[11px] text-slate-400">
                        {b.openingCents ? `nga pikënisja ${dmy(b.fromDay)} (${eur(b.openingCents)})` : `nga ${dmy(nextDay(b.fromDay))}`}
                      </span>
                    </td>
                    <td className="py-1.5 pr-3 text-right font-semibold tabular-nums">{eur(b.expectedCents)}</td>
                    <td className="py-1.5 pr-3 text-right">
                      <input inputMode="decimal" placeholder="€" value={counted[b.key] ?? ""}
                        onChange={e => setCounted(c => ({ ...c, [b.key]: e.target.value }))}
                        className="w-24 text-right rounded-md border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 px-2 py-1 tabular-nums" />
                    </td>
                    <td className={`py-1.5 text-right tabular-nums font-medium ${d == null ? "text-slate-300" : d === 0 ? "text-emerald-600" : d < 0 ? "text-red-600" : "text-amber-600"}`}>
                      {d == null ? "—" : d === 0 ? "✓ në rregull" : d < 0 ? `mungojnë ${eur(-d)}` : `tepër ${eur(d)}`}
                    </td>
                  </tr>
                );
              })}
              <tr className="font-bold">
                <td className="py-2 pr-3">Të gjitha bashkë</td>
                <td className="py-2 pr-3 text-right tabular-nums">{eur(data.totalCents)}</td>
                <td className="py-2 pr-3 text-right tabular-nums">{countedTotal == null ? "" : eur(countedTotal)}</td>
                <td className="py-2 text-right tabular-nums">
                  {countedTotal == null ? "" : countedTotal === data.totalCents ? "✓" : countedTotal < data.totalCents ? `mungojnë ${eur(data.totalCents - countedTotal)}` : `tepër ${eur(countedTotal - data.totalCents)}`}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="text-[11px] text-slate-400 mt-2">
            Shumat e numëruara këtu janë vetëm për krahasim dhe s'ruhen. Numërimi zyrtar bëhet te "Numërimi i Arkave".
          </p>
        </div>
      )}
    </section>
  );
}
