"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Loader2, ExternalLink } from "lucide-react";
import { formatCurrency, formatDate, MONTHS } from "@/lib/utils";
import type { YearType } from "@/lib/academicYear";
import type { ShkollimiExpenseRow, ShkollimiExpenseTotals } from "@/lib/shkollimiExpenses";
import ExpensesSection from "./ExpensesSection";

// Shkollimi → "Shpenzime": shpenzimet që regjistrohen te moduli "Shpenzimet"
// (menyja), për periudhën e zgjedhur. Me Cash zbriten nga arka; me Bankë jo;
// të papaguarat (borxh) s'llogariten si të shpenzuara.

export default function ShkollimiExpensesSection({ categoryId, month, year, yearType }: {
  categoryId: number | null; month: number; year: number; yearType: YearType;
}) {
  const [data, setData] = useState<{ rows: ShkollimiExpenseRow[]; totals: ShkollimiExpenseTotals } | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setData(null); setError("");
    const qs = new URLSearchParams({ month: String(month), year: String(year), yearType });
    fetch(`/api/shkollimi/expenses?${qs}`)
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Shpenzimet s'u ngarkuan."); setData(d); })
      .catch(e => setError(e instanceof Error ? e.message : "Shpenzimet s'u ngarkuan."));
  }, [month, year, yearType]);

  const period = month > 0 ? `${MONTHS[month - 1]} ${year}` : year > 0 ? (yearType === "academic" ? `Viti ${year}–${year + 1}` : `Viti ${year}`) : "Të gjitha";
  const hasLegacy = !!data?.rows.some(r => r.source === "EXPENSE");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card label="Total shpenzuar" value={data?.totals.paid} tone="text-red-600 dark:text-red-400" sub={period} />
        <Card label="Nga arka (cash)" value={data?.totals.cash} tone="text-orange-700 dark:text-orange-400" sub="zbriten nga arka e shkollimit" />
        <Card label="Nga banka" value={data?.totals.bank} tone="text-blue-700 dark:text-blue-300" sub="s'prekin arkën" />
        <Card label="Pa paguar (borxh)" value={data?.totals.unpaid} tone="text-slate-700 dark:text-slate-200" sub="nuk llogariten si të shpenzuara" />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Shpenzimet regjistrohen te moduli <Link href="/shpenzime" className="text-primary-700 dark:text-primary-300 font-semibold hover:underline">Shpenzimet</Link> dhe shfaqen këtu automatikisht.
        </p>
        <Link href="/shpenzime" className="btn-primary text-sm"><Plus className="w-4 h-4" /> Shto shpenzim</Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="text-left text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60 uppercase">
              <th className="px-3 py-2.5 w-10">#</th><th className="px-3 py-2.5">Data</th><th className="px-3 py-2.5">Përshkrimi</th>
              <th className="px-3 py-2.5 text-right">Shuma</th><th className="px-3 py-2.5">Paguar nga</th><th className="px-3 py-2.5">Statusi</th><th className="px-3 py-2.5">Referenca</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {error ? <tr><td colSpan={7} className="px-3 py-10 text-center text-red-600">{error}</td></tr>
              : !data ? <tr><td colSpan={7} className="px-3 py-10 text-center"><Loader2 className="w-5 h-5 animate-spin text-primary-400 inline" /></td></tr>
              : data.rows.length === 0 ? <tr><td colSpan={7} className="px-3 py-10 text-center text-slate-500">Nuk ka shpenzime për {period}.</td></tr>
              : data.rows.map((r, i) => {
                const cash = !r.method || r.method === "CASH";
                return (
                  <tr key={r.key} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2.5 text-slate-500">{i + 1}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-700 dark:text-slate-200">{formatDate(r.date)}</td>
                    <td className="px-3 py-2.5">
                      <p className="font-medium text-slate-900 dark:text-white">{r.description || r.category || "—"}</p>
                      <p className="text-xs text-slate-500">{[r.category && r.description ? r.category : null, r.supplier, r.source === "EXPENSE" ? "regjistruar direkt te kjo skedë" : null].filter(Boolean).join(" · ")}</p>
                    </td>
                    <td className={`px-3 py-2.5 text-right font-bold whitespace-nowrap ${r.paid ? "text-red-600 dark:text-red-400" : "text-slate-500"}`}>{formatCurrency(r.amount)}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{cash ? <span className="text-orange-700 dark:text-orange-400 font-semibold">Arka</span> : <span className="text-blue-700 dark:text-blue-300 font-semibold">Banka</span>}</td>
                    <td className="px-3 py-2.5">{r.paid
                      ? <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300">Paguar</span>
                      : <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-200">Borxh</span>}</td>
                    <td className="px-3 py-2.5 text-xs text-slate-500">{r.reference || "—"}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1">
        Për ndryshim ose fshirje, hape shpenzimin te moduli <Link href="/shpenzime" className="text-primary-700 dark:text-primary-300 hover:underline inline-flex items-center gap-0.5">Shpenzimet <ExternalLink className="w-3 h-3" /></Link>.
      </p>

      {hasLegacy && (
        <details className="card p-4">
          <summary className="cursor-pointer text-sm font-semibold text-slate-700 dark:text-slate-200">Shpenzime të regjistruara më parë direkt te kjo skedë (për ndryshim/fshirje)</summary>
          <div className="mt-3"><ExpensesSection categoryId={categoryId} type="EXPENSE" month={month} year={year} yearType={yearType} /></div>
        </details>
      )}
    </div>
  );
}

function Card({ label, value, tone, sub }: { label: string; value: number | undefined; tone: string; sub: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500 dark:text-slate-400">{label}</p>
      <p className={`text-xl font-bold mt-0.5 ${tone}`}>{value === undefined ? "…" : formatCurrency(value)}</p>
      <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>
    </div>
  );
}
