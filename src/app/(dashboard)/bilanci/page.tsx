"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/layout/Header";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, Scale, Download } from "lucide-react";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { ACADEMIC_YEARS, CALENDAR_YEARS, type YearType } from "@/lib/academicYear";

interface MuajData {
  muaj: number;
  viti: number;
  label: string;
  hyra: number;
  hyraMan: number;
  hyraShk: number;
  shpenzim: number;
  balanca: number;
}

interface BilanciData {
  vit: number;
  yearType: YearType;
  label: string;
  muajt: MuajData[];
  totalHyra: number;
  totalHyraMan: number;
  totalHyraShk: number;
  totalShpenzim: number;
  totalBalanca: number;
}

export default function BilanciPage() {
  const now = new Date();
  const [yearType, setYearType] = useState<YearType>("calendar");
  const [vit, setVit]           = useState(now.getFullYear());
  const [data, setData]         = useState<BilanciData | null>(null);
  const [loading, setLoading]   = useState(true);

  const years = yearType === "academic" ? ACADEMIC_YEARS : CALENDAR_YEARS;

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/bilanci?vit=${vit}&yearType=${yearType}`);
      if (res.status === 401) { window.location.href = "/login"; return; }
      setData(await res.json());
    } catch { /* gabim rrjeti */ }
    finally { setLoading(false); }
  }, [vit, yearType]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Kur ndryshon lloji, rregullohet viti nëse duhet
  function switchYearType(yt: YearType) {
    setYearType(yt);
    const yrs = yt === "academic" ? ACADEMIC_YEARS : CALENDAR_YEARS;
    if (!yrs.includes(vit)) setVit(yrs[yrs.length - 2] ?? yrs[0]);
  }

  function exportExcel() {
    if (!data) return;
    const headers = ["Muaji", "Shkollimi (€)", "Import (€)", "Të Hyra (€)", "Shpenzime (€)", "Balanca (€)"];
    const rows = data.muajt.map(m => [m.label, m.hyraShk, m.hyraMan, m.hyra, m.shpenzim, m.balanca]);
    rows.push(["TOTALI", data.totalHyraShk, data.totalHyraMan, data.totalHyra, data.totalShpenzim, data.totalBalanca]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [{ wch: 16 }, ...Array(5).fill({ wch: 14 })];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Bilanci ${data.label}`);
    XLSX.writeFile(wb, `Bilanci-${data.label}.xlsx`);
  }

  const chartData = data?.muajt.map(m => ({
    name:        m.label.slice(0, yearType === "academic" ? 3 : 3),
    "Të Hyra":   m.hyra,
    "Shpenzime": m.shpenzim,
    "Balanca":   m.balanca,
  })) ?? [];

  const activeMonths   = data?.muajt.filter(m => m.hyra > 0 || m.shpenzim > 0) ?? [];
  const positiveMonths = activeMonths.filter(m => m.balanca >= 0).length;
  const negativeMonths = activeMonths.filter(m => m.balanca < 0).length;

  return (
    <>
      <Header title="Bilanci Financiar" />
      <div className="p-6 space-y-6 animate-fade-in">

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">

          {/* Togël Kalendarik / Akademik */}
          <div className="flex items-center rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 text-sm font-medium">
            {([["calendar", "📅 Kalendarik"], ["academic", "🎓 Akademik"]] as [YearType, string][]).map(([yt, lbl]) => (
              <button
                key={yt}
                onClick={() => switchYearType(yt)}
                className={`px-4 py-2 transition-colors ${yearType === yt ? "bg-primary-600 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}
              >
                {lbl}
              </button>
            ))}
          </div>

          {/* Selector viti */}
          <div className="flex gap-1">
            {years.map(y => (
              <button
                key={y}
                onClick={() => setVit(y)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${vit === y ? "bg-primary-600 text-white shadow-sm" : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary-300"}`}
              >
                {yearType === "academic" ? `${y}–${y + 1}` : y}
              </button>
            ))}
          </div>

          <button onClick={exportExcel} disabled={!data} className="btn-secondary ml-auto flex items-center gap-2">
            <Download className="w-4 h-4" /> Exporto Excel
          </button>
        </div>

        {/* Titulli periudhës */}
        {data && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {yearType === "academic" ? "Vit Akademik" : "Vit Kalendarik"}:
            </span>
            <span className="text-sm font-bold text-primary-700 dark:text-primary-400">{data.label}</span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
          </div>
        ) : data ? (
          <>
            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="card p-5 border-l-4 border-emerald-400">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                    <TrendingUp className="w-5 h-5 text-emerald-600" />
                  </div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Të Hyra Totale {data.label}</p>
                </div>
                <p className="text-3xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(data.totalHyra)}</p>
                <div className="mt-2 space-y-0.5 text-xs text-slate-400">
                  {data.totalHyraShk > 0 && <p>🎓 Shkollimi: <span className="font-semibold text-emerald-500">{formatCurrency(data.totalHyraShk)}</span></p>}
                  {data.totalHyraMan > 0 && <p>📥 Import: <span className="font-semibold text-slate-500">{formatCurrency(data.totalHyraMan)}</span></p>}
                </div>
              </div>

              <div className="card p-5 border-l-4 border-red-400">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                    <TrendingDown className="w-5 h-5 text-red-500" />
                  </div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Shpenzime Totale {data.label}</p>
                </div>
                <p className="text-3xl font-bold text-red-600 dark:text-red-400">{formatCurrency(data.totalShpenzim)}</p>
              </div>

              <div className={`card p-5 border-l-4 ${data.totalBalanca >= 0 ? "border-blue-400" : "border-orange-400"}`}>
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${data.totalBalanca >= 0 ? "bg-blue-50 dark:bg-blue-900/30" : "bg-orange-50 dark:bg-orange-900/30"}`}>
                    <Scale className={`w-5 h-5 ${data.totalBalanca >= 0 ? "text-blue-600" : "text-orange-500"}`} />
                  </div>
                  <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Balanca Neto {data.label}</p>
                </div>
                <p className={`text-3xl font-bold ${data.totalBalanca >= 0 ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"}`}>
                  {data.totalBalanca >= 0 ? "+" : ""}{formatCurrency(data.totalBalanca)}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {positiveMonths > 0 && `${positiveMonths} muaj pozitiv`}
                  {negativeMonths > 0 && ` · ${negativeMonths} muaj negativ`}
                </p>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="card p-5">
              <h2 className="section-title mb-5">Hyra vs Shpenzime — {data.label}</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                    tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : String(v)} />
                  <Tooltip formatter={(v: number, name: string) => [formatCurrency(v), name]}
                    contentStyle={{ background: "#1e293b", border: "none", borderRadius: "8px", color: "#f8fafc", fontSize: "12px" }} />
                  <Legend wrapperStyle={{ fontSize: "12px" }} />
                  <ReferenceLine y={0} stroke="#94a3b8" strokeDasharray="3 3" />
                  <Bar dataKey="Të Hyra"   fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Shpenzime" fill="#ef4444" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="Balanca"   fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Tabela mujore */}
            <div className="card overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                <h2 className="section-title">Pasqyra Mujore — {data.label}</h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="table-header">Muaji</th>
                      <th className="table-header text-right text-emerald-600">🎓 Shkollimi</th>
                      <th className="table-header text-right text-teal-600">📥 Import</th>
                      <th className="table-header text-right font-bold text-emerald-700">Hyra Totale</th>
                      <th className="table-header text-right text-red-500">Shpenzime</th>
                      <th className="table-header text-right">Balanca</th>
                      <th className="table-header text-right">% Marzhi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {data.muajt.map(m => {
                      const hasData = m.hyra > 0 || m.shpenzim > 0;
                      const marzhi  = m.hyra > 0 ? Math.round((m.balanca / m.hyra) * 100) : null;
                      return (
                        <tr key={`${m.muaj}-${m.viti}`} className={`transition-colors ${hasData ? "hover:bg-slate-50 dark:hover:bg-slate-800/30" : "opacity-40"}`}>
                          <td className="table-cell font-medium text-slate-800 dark:text-slate-200">{m.label}</td>
                          <td className={`table-cell text-right ${m.hyraShk > 0 ? "text-emerald-600 dark:text-emerald-400 font-semibold" : "text-slate-300"}`}>
                            {m.hyraShk > 0 ? formatCurrency(m.hyraShk) : "—"}
                          </td>
                          <td className={`table-cell text-right ${m.hyraMan > 0 ? "text-teal-600 dark:text-teal-400" : "text-slate-300"}`}>
                            {m.hyraMan > 0 ? formatCurrency(m.hyraMan) : "—"}
                          </td>
                          <td className={`table-cell text-right font-bold ${m.hyra > 0 ? "text-emerald-700 dark:text-emerald-300" : "text-slate-300"}`}>
                            {m.hyra > 0 ? formatCurrency(m.hyra) : "—"}
                          </td>
                          <td className={`table-cell text-right font-semibold ${m.shpenzim > 0 ? "text-red-600 dark:text-red-400" : "text-slate-300"}`}>
                            {m.shpenzim > 0 ? formatCurrency(m.shpenzim) : "—"}
                          </td>
                          <td className="table-cell text-right">
                            {hasData ? (
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${m.balanca >= 0 ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"}`}>
                                {m.balanca >= 0 ? "+" : ""}{formatCurrency(m.balanca)}
                              </span>
                            ) : "—"}
                          </td>
                          <td className="table-cell text-right">
                            {marzhi !== null ? (
                              <span className={`text-sm font-semibold ${marzhi >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-red-500"}`}>
                                {marzhi >= 0 ? "+" : ""}{marzhi}%
                              </span>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-200 dark:border-slate-600">
                    <tr>
                      <td className="table-cell font-bold text-slate-800 dark:text-white text-sm">TOTALI {data.label}</td>
                      <td className="table-cell text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm">{formatCurrency(data.totalHyraShk)}</td>
                      <td className="table-cell text-right font-bold text-teal-600 dark:text-teal-400 text-sm">{formatCurrency(data.totalHyraMan)}</td>
                      <td className="table-cell text-right font-bold text-emerald-700 dark:text-emerald-300 text-sm">{formatCurrency(data.totalHyra)}</td>
                      <td className="table-cell text-right font-bold text-red-600 dark:text-red-400 text-sm">{formatCurrency(data.totalShpenzim)}</td>
                      <td className="table-cell text-right">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${data.totalBalanca >= 0 ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" : "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300"}`}>
                          {data.totalBalanca >= 0 ? "+" : ""}{formatCurrency(data.totalBalanca)}
                        </span>
                      </td>
                      <td className="table-cell text-right">
                        {data.totalHyra > 0 && (
                          <span className={`text-sm font-bold ${data.totalBalanca >= 0 ? "text-emerald-600" : "text-red-500"}`}>
                            {data.totalBalanca >= 0 ? "+" : ""}
                            {Math.round((data.totalBalanca / data.totalHyra) * 100)}%
                          </span>
                        )}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
