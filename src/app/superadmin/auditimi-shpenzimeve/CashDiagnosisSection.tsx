"use client";

import { useEffect, useState } from "react";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import type { CashDiagnosis } from "@/lib/cashDiagnosis";
import { ACADEMIC_YEARS, DEFAULT_ACADEMIC_YEAR } from "@/lib/academicYear";

// "Pse arka del negative" — shifrat për çdo shkak të mundshëm (vetëm lexim).

const eur = (v: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
const MONTHS = ["Jan", "Shk", "Mar", "Pri", "Maj", "Qer", "Kor", "Gus", "Sht", "Tet", "Nën", "Dhj"];
const ml = (k: string) => `${MONTHS[+k.slice(5, 7) - 1]} ${k.slice(0, 4)}`;

export default function CashDiagnosisSection() {
  const [year, setYear] = useState(DEFAULT_ACADEMIC_YEAR);
  const [d, setD] = useState<CashDiagnosis | null>(null);
  const [error, setError] = useState("");
  useEffect(() => {
    setD(null); setError("");
    fetch(`/api/superadmin/cash-diagnosis?year=${year}`).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error || "Gabim"); setD(j); })
      .catch(e => setError(e instanceof Error ? e.message : "Gabim"));
  }, [year]);

  return (
    <section id="arka" className="space-y-3 rounded-2xl border-2 border-red-200 dark:border-red-900 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-bold">0. Pse arka e Shkollimit del negative</h2>
        <select value={year} onChange={e => setYear(+e.target.value)} className="form-input w-36 text-sm print:hidden" aria-label="Viti shkollor">
          {ACADEMIC_YEARS.map(y => <option key={y} value={y}>{y}–{y + 1}</option>)}
        </select>
      </div>
      {error ? <p className="text-red-600">{error}</p> : !d ? <p className="flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Duke llogaritur…</p> : (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-2 text-sm">
            {[["Hyrje cash", d.arka.cashIn], ["Dorëzuar", d.arka.handed], ["Shpenzuar nga arka", d.arka.expenses], ["Investime nga arka", d.arka.investments], ["Në arkë", d.arka.inCashBox]].map(([l, v]) => (
              <div key={l as string} className="rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2"><p className="text-xs text-slate-500">{l}</p><p className={`font-bold ${(v as number) < 0 ? "text-red-600" : ""}`}>{eur(v as number)}</p></div>
            ))}
          </div>

          {d.arka.deficit > 0 ? (
            <p className="flex items-start gap-2 rounded-lg bg-red-50 dark:bg-red-950/30 px-3 py-2 text-red-900 dark:text-red-200">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
              <span>Mungojnë <b>{eur(d.arka.deficit)}</b> hyrje cash për të mbuluar daljet. Shkaqet më poshtë shpjegojnë deri në <b>{eur(d.explainable)}</b> (pjesa cash + pa metodë e secilit, plus mbetja e vitit të kaluar).
                {d.firstNegative && <> Arka u bë negative për herë të parë në <b>{ml(d.firstNegative)}</b>.</>}</span>
            </p>
          ) : (
            <p className="flex items-center gap-2 rounded-lg bg-green-50 dark:bg-green-950/30 px-3 py-2 text-green-900 dark:text-green-200"><CheckCircle2 className="w-4 h-4" /> Arka nuk është negative për këtë vit.</p>
          )}

          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-sm">
              <thead><tr className="bg-slate-50 dark:bg-slate-800 text-left text-xs uppercase text-slate-500"><th className="px-3 py-2">Shkaku i mundshëm</th><th className="px-3 py-2">Rreshta</th><th className="px-3 py-2">Cash</th><th className="px-3 py-2">Pa metodë</th><th className="px-3 py-2">Bankë</th><th className="px-3 py-2">Çka të bëni</th></tr></thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {d.causes.map(c => (
                  <tr key={c.key} className={c.amount > 0 ? "" : "text-slate-400"}>
                    <td className="px-3 py-1.5 font-medium">{c.title}</td>
                    <td className="px-3 py-1.5">{c.split ? c.split.count : "—"}</td>
                    <td className="px-3 py-1.5">{c.split ? eur(c.split.cash) : eur(c.amount)}</td>
                    <td className="px-3 py-1.5">{c.split ? eur(c.split.none) : "—"}</td>
                    <td className="px-3 py-1.5">{c.split ? eur(c.split.bank) : "—"}</td>
                    <td className="px-3 py-1.5 text-xs text-slate-500">{c.note}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <details open>
            <summary className="cursor-pointer font-semibold">Rrjedha mujore e arkës (kur u bë negative)</summary>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 mt-2">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 dark:bg-slate-800 text-left text-xs uppercase text-slate-500"><th className="px-3 py-2">Muaji</th><th className="px-3 py-2">Hyrje cash</th><th className="px-3 py-2">Dorëzuar</th><th className="px-3 py-2">Shpenzime cash</th><th className="px-3 py-2">Investime cash</th><th className="px-3 py-2">Gjendja</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {d.monthly.map(m => (
                    <tr key={m.month}><td className="px-3 py-1.5">{ml(m.month)}</td><td className="px-3 py-1.5">{eur(m.cashIn)}</td><td className="px-3 py-1.5">{eur(m.handed)}</td><td className="px-3 py-1.5">{eur(m.expenses)}</td><td className="px-3 py-1.5">{eur(m.investments)}</td>
                      <td className={`px-3 py-1.5 font-bold ${m.balance < 0 ? "text-red-600" : "text-green-700"}`}>{eur(m.balance)}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>

          <details>
            <summary className="cursor-pointer font-semibold">Dorëzimet e këtij viti ({d.handovers.length})</summary>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700 mt-2">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 dark:bg-slate-800 text-left text-xs uppercase text-slate-500"><th className="px-3 py-2">Data</th><th className="px-3 py-2">Marrësi</th><th className="px-3 py-2">Përshkrimi</th><th className="px-3 py-2">Mënyra</th><th className="px-3 py-2 text-right">Shuma</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {d.handovers.map(h => <tr key={h.id}><td className="px-3 py-1.5">{h.day.slice(8, 10)}/{h.day.slice(5, 7)}/{h.day.slice(0, 4)}</td><td className="px-3 py-1.5">{h.recipient ?? "—"}</td><td className="px-3 py-1.5">{h.description ?? "—"}</td><td className="px-3 py-1.5">{h.method ?? "—"}</td><td className="px-3 py-1.5 text-right">{eur(h.amount)}</td></tr>)}
                </tbody>
              </table>
            </div>
          </details>
        </>
      )}
    </section>
  );
}
