"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/layout/Header";
import { formatCurrency } from "@/lib/utils";
import { TrendingUp, TrendingDown, Scale, Download, Building2, Clock, ExternalLink } from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from "recharts";
import { ACADEMIC_YEARS, CALENDAR_YEARS, type YearType } from "@/lib/academicYear";

interface MuajData {
  muaj: number; viti: number; label: string;
  hyra: number; hyraMan: number; hyraShk: number;
  shpenzim: number;
  invKapital: number; invPerkohshem: number;
  balanca: number;
}

interface BilanciData {
  vit: number; yearType: YearType; label: string;
  muajt: MuajData[];
  totalHyra: number; totalHyraMan: number; totalHyraShk: number;
  totalShpenzim: number;
  totalInvKapital: number; totalInvPerkohshem: number;
  totalBalanca: number;
}

export default function BilanciPage() {
  const now = new Date();
  const [yearType, setYearType] = useState<YearType>("calendar");
  const [vit,      setVit]      = useState(now.getFullYear());
  const [data,     setData]     = useState<BilanciData | null>(null);
  const [loading,  setLoading]  = useState(true);

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

  function switchYearType(yt: YearType) {
    setYearType(yt);
    const yrs = yt === "academic" ? ACADEMIC_YEARS : CALENDAR_YEARS;
    if (!yrs.includes(vit)) setVit(yrs[yrs.length - 2] ?? yrs[0]);
  }

  function exportExcel() {
    if (!data) return;
    const headers = [
      "Muaji", "Shkollimi (€)", "Import (€)", "Të Hyra (€)",
      "Shpenzime (€)", "Inv. Kapitale (€)", "Inv. Përkohshme (€)", "Balanca Neto (€)",
    ];
    const rows = data.muajt.map(m => [
      m.label, m.hyraShk, m.hyraMan, m.hyra,
      m.shpenzim, m.invKapital, m.invPerkohshem, m.balanca,
    ]);
    rows.push([
      "TOTALI", data.totalHyraShk, data.totalHyraMan, data.totalHyra,
      data.totalShpenzim, data.totalInvKapital, data.totalInvPerkohshem, data.totalBalanca,
    ]);
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    ws["!cols"] = [{ wch: 16 }, ...Array(7).fill({ wch: 16 })];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Bilanci ${data.label}`);
    XLSX.writeFile(wb, `Bilanci-${data.label}.xlsx`);
  }

  function exportPDF() {
    if (!data) return;
    const w = window.open("", "_blank", "width=900,height=750");
    if (!w) return;
    const rows = data.muajt.map(m => `
      <tr>
        <td>${m.label}</td>
        <td>${formatCurrency(m.hyra)}</td>
        <td>${formatCurrency(m.shpenzim)}</td>
        <td>${formatCurrency(m.invKapital)}</td>
        <td>${formatCurrency(m.invPerkohshem)}</td>
        <td style="font-weight:bold;color:${m.balanca >= 0 ? "#1d4ed8" : "#c2410c"}">${formatCurrency(m.balanca)}</td>
      </tr>`).join("");
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
    <title>Bilanci ${data.label}</title>
    <style>
      body { font-family: Arial, sans-serif; font-size: 11pt; color: #000; padding: 20mm; }
      h1 { font-size: 16pt; margin-bottom: 4px; }
      .sub { color: #666; font-size: 9pt; margin-bottom: 20px; }
      table { width: 100%; border-collapse: collapse; }
      th { background: #1e40af; color: #fff; padding: 8px 6px; font-size: 9pt; text-align: right; }
      th:first-child { text-align: left; }
      td { border-bottom: 1px solid #e2e8f0; padding: 6px; font-size: 9pt; text-align: right; }
      td:first-child { text-align: left; }
      tfoot td { font-weight: bold; background: #f8fafc; border-top: 2px solid #94a3b8; }
      .kpi { display: flex; gap: 16px; margin-bottom: 20px; flex-wrap: wrap; }
      .kpi-card { flex: 1; min-width: 120px; padding: 10px 14px; border-radius: 8px; border-left: 4px solid; }
      .green  { border-color: #10b981; background: #f0fdf4; }
      .red    { border-color: #ef4444; background: #fef2f2; }
      .violet { border-color: #8b5cf6; background: #f5f3ff; }
      .cyan   { border-color: #06b6d4; background: #ecfeff; }
      .blue   { border-color: #3b82f6; background: #eff6ff; }
      .kpi-label { font-size: 8pt; color: #666; margin-bottom: 2px; }
      .kpi-val   { font-size: 14pt; font-weight: bold; }
      .formula   { font-size: 8pt; color: #666; margin: 8px 0 16px; font-style: italic; }
      @page { size: A4 landscape; margin: 15mm; }
    </style></head><body>
    <h1>Bilanci Financiar — ${data.label}</h1>
    <p class="sub">Gjeneruar: ${new Date().toLocaleDateString("sq-AL")} | Formula: Të Hyra − Shpenzime − Inv. Kapitale − Inv. Përkohshme</p>
    <div class="kpi">
      <div class="kpi-card green"><div class="kpi-label">Të Hyra Totale</div><div class="kpi-val" style="color:#059669">${formatCurrency(data.totalHyra)}</div></div>
      <div class="kpi-card red"><div class="kpi-label">Shpenzime Totale</div><div class="kpi-val" style="color:#dc2626">${formatCurrency(data.totalShpenzim)}</div></div>
      <div class="kpi-card violet"><div class="kpi-label">Inv. Kapitale</div><div class="kpi-val" style="color:#7c3aed">${formatCurrency(data.totalInvKapital)}</div></div>
      <div class="kpi-card cyan"><div class="kpi-label">Inv. Përkohshme</div><div class="kpi-val" style="color:#0891b2">${formatCurrency(data.totalInvPerkohshem)}</div></div>
      <div class="kpi-card blue"><div class="kpi-label">Bilanci Neto</div><div class="kpi-val" style="color:${data.totalBalanca >= 0 ? "#1d4ed8" : "#c2410c"}">${formatCurrency(data.totalBalanca)}</div></div>
    </div>
    <table>
      <thead><tr>
        <th>Muaji</th><th>Të Hyra</th><th>Shpenzime</th>
        <th>Inv. Kapitale</th><th>Inv. Përkohshme</th><th>Balanca Neto</th>
      </tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr>
        <td>TOTALI ${data.label}</td>
        <td>${formatCurrency(data.totalHyra)}</td>
        <td>${formatCurrency(data.totalShpenzim)}</td>
        <td>${formatCurrency(data.totalInvKapital)}</td>
        <td>${formatCurrency(data.totalInvPerkohshem)}</td>
        <td style="color:${data.totalBalanca >= 0 ? "#1d4ed8" : "#c2410c"}">${formatCurrency(data.totalBalanca)}</td>
      </tr></tfoot>
    </table>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }

  const chartData = data?.muajt.map(m => ({
    name:                  m.label.slice(0, 3),
    "Të Hyra":             m.hyra,
    "Shpenzime":           m.shpenzim,
    "Inv. Kapitale":       m.invKapital,
    "Inv. Përkohshme":     m.invPerkohshem,
    "Balanca":             m.balanca,
  })) ?? [];

  const activeMonths   = data?.muajt.filter(m => m.hyra > 0 || m.shpenzim > 0 || m.invKapital > 0 || m.invPerkohshem > 0) ?? [];
  const positiveMonths = activeMonths.filter(m => m.balanca >= 0).length;
  const negativeMonths = activeMonths.filter(m => m.balanca < 0).length;

  return (
    <>
      <Header title="Bilanci Financiar" />
      <div className="p-6 space-y-6 animate-fade-in">

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 text-sm font-medium">
            {([["calendar", "📅 Kalendarik"], ["academic", "🎓 Akademik"]] as [YearType, string][]).map(([yt, lbl]) => (
              <button key={yt} onClick={() => switchYearType(yt)}
                className={`px-4 py-2 transition-colors ${yearType === yt ? "bg-primary-600 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                {lbl}
              </button>
            ))}
          </div>

          <div className="flex gap-1">
            {years.map(y => (
              <button key={y} onClick={() => setVit(y)}
                className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${vit === y ? "bg-primary-600 text-white shadow-sm" : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary-300"}`}>
                {yearType === "academic" ? `${y}–${y + 1}` : y}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link href="/investime"
              className="btn-secondary flex items-center gap-2 text-sm">
              <TrendingUp className="w-4 h-4" /> Menaxho Investimet
              <ExternalLink className="w-3.5 h-3.5" />
            </Link>
            <button onClick={exportExcel} disabled={!data} className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" /> Excel
            </button>
            <button onClick={exportPDF} disabled={!data} className="btn-secondary flex items-center gap-2">
              <Download className="w-4 h-4" /> PDF
            </button>
          </div>
        </div>

        {data && (
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
              {yearType === "academic" ? "Vit Akademik" : "Vit Kalendarik"}:
            </span>
            <span className="text-sm font-bold text-primary-700 dark:text-primary-400">{data.label}</span>
            <span className="text-xs text-slate-400 ml-2 italic">
              Bilanci Neto = Të Hyra − Shpenzime − Inv. Kapitale − Inv. Përkohshme
            </span>
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin w-8 h-8 border-2 border-primary-500 border-t-transparent rounded-full" />
          </div>
        ) : data ? (
          <>
            {/* KPI Cards — 5 cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
              {/* Të Hyra */}
              <div className="card p-5 border-l-4 border-emerald-400">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                  </div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-tight">Të Hyra Totale</p>
                </div>
                <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">{formatCurrency(data.totalHyra)}</p>
                <div className="mt-1 space-y-0.5 text-xs text-slate-400">
                  {data.totalHyraShk > 0 && <p>🎓 Shkollimi: <span className="font-semibold text-emerald-500">{formatCurrency(data.totalHyraShk)}</span></p>}
                  {data.totalHyraMan > 0 && <p>📥 Import: <span className="font-semibold">{formatCurrency(data.totalHyraMan)}</span></p>}
                </div>
              </div>

              {/* Shpenzime */}
              <div className="card p-5 border-l-4 border-red-400">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0">
                    <TrendingDown className="w-4 h-4 text-red-500" />
                  </div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-tight">Shpenzime Totale</p>
                </div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400">{formatCurrency(data.totalShpenzim)}</p>
              </div>

              {/* Investime Kapitale */}
              <div className="card p-5 border-l-4 border-violet-400">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-violet-50 dark:bg-violet-900/30 flex items-center justify-center flex-shrink-0">
                    <Building2 className="w-4 h-4 text-violet-600" />
                  </div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-tight">Inv. Kapitale</p>
                </div>
                <p className="text-2xl font-bold text-violet-600 dark:text-violet-400">{formatCurrency(data.totalInvKapital)}</p>
                <p className="text-xs text-slate-400 mt-1">Asete, pajisje, objekte</p>
              </div>

              {/* Investime Përkohshme */}
              <div className="card p-5 border-l-4 border-cyan-400">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-9 h-9 rounded-xl bg-cyan-50 dark:bg-cyan-900/30 flex items-center justify-center flex-shrink-0">
                    <Clock className="w-4 h-4 text-cyan-600" />
                  </div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-tight">Inv. Përkohshme</p>
                </div>
                <p className="text-2xl font-bold text-cyan-600 dark:text-cyan-400">{formatCurrency(data.totalInvPerkohshem)}</p>
                <p className="text-xs text-slate-400 mt-1">Depozita, huadhënie</p>
              </div>

              {/* Bilanci Neto */}
              <div className={`card p-5 border-l-4 ${data.totalBalanca >= 0 ? "border-blue-400" : "border-orange-400"}`}>
                <div className="flex items-center gap-2 mb-2">
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${data.totalBalanca >= 0 ? "bg-blue-50 dark:bg-blue-900/30" : "bg-orange-50 dark:bg-orange-900/30"}`}>
                    <Scale className={`w-4 h-4 ${data.totalBalanca >= 0 ? "text-blue-600" : "text-orange-500"}`} />
                  </div>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400 leading-tight">Bilanci Neto</p>
                </div>
                <p className={`text-2xl font-bold ${data.totalBalanca >= 0 ? "text-blue-600 dark:text-blue-400" : "text-orange-600 dark:text-orange-400"}`}>
                  {data.totalBalanca >= 0 ? "+" : ""}{formatCurrency(data.totalBalanca)}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {positiveMonths > 0 && `${positiveMonths}m pozitiv`}
                  {negativeMonths > 0 && ` · ${negativeMonths}m negativ`}
                </p>
              </div>
            </div>

            {/* Bar Chart */}
            <div className="card p-5">
              <h2 className="section-title mb-5">Pasqyra Financiare — {data.label}</h2>
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
                  <Bar dataKey="Të Hyra"         fill="#10b981" radius={[4,4,0,0]} />
                  <Bar dataKey="Shpenzime"        fill="#ef4444" radius={[4,4,0,0]} />
                  <Bar dataKey="Inv. Kapitale"    fill="#8b5cf6" radius={[4,4,0,0]} />
                  <Bar dataKey="Inv. Përkohshme"  fill="#06b6d4" radius={[4,4,0,0]} />
                  <Bar dataKey="Balanca"          fill="#3b82f6" radius={[4,4,0,0]} />
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
                      <th className="table-header text-right text-violet-600">Inv. Kapitale</th>
                      <th className="table-header text-right text-cyan-600">Inv. Përkohshme</th>
                      <th className="table-header text-right">Balanca Neto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {data.muajt.map(m => {
                      const hasData = m.hyra > 0 || m.shpenzim > 0 || m.invKapital > 0 || m.invPerkohshem > 0;
                      return (
                        <tr key={`${m.muaj}-${m.viti}`}
                          className={`transition-colors ${hasData ? "hover:bg-slate-50 dark:hover:bg-slate-800/30" : "opacity-40"}`}>
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
                          <td className={`table-cell text-right font-semibold ${m.invKapital > 0 ? "text-violet-600 dark:text-violet-400" : "text-slate-300"}`}>
                            {m.invKapital > 0 ? formatCurrency(m.invKapital) : "—"}
                          </td>
                          <td className={`table-cell text-right font-semibold ${m.invPerkohshem > 0 ? "text-cyan-600 dark:text-cyan-400" : "text-slate-300"}`}>
                            {m.invPerkohshem > 0 ? formatCurrency(m.invPerkohshem) : "—"}
                          </td>
                          <td className="table-cell text-right">
                            {hasData ? (
                              <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold ${m.balanca >= 0 ? "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300" : "bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300"}`}>
                                {m.balanca >= 0 ? "+" : ""}{formatCurrency(m.balanca)}
                              </span>
                            ) : "—"}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-100 dark:bg-slate-800 border-t-2 border-slate-200 dark:border-slate-600">
                    <tr>
                      <td className="table-cell font-bold text-slate-800 dark:text-white text-sm" colSpan={1}>TOTALI {data.label}</td>
                      <td className="table-cell text-right font-bold text-emerald-600 dark:text-emerald-400 text-sm">{formatCurrency(data.totalHyraShk)}</td>
                      <td className="table-cell text-right font-bold text-teal-600 dark:text-teal-400 text-sm">{formatCurrency(data.totalHyraMan)}</td>
                      <td className="table-cell text-right font-bold text-emerald-700 dark:text-emerald-300 text-sm">{formatCurrency(data.totalHyra)}</td>
                      <td className="table-cell text-right font-bold text-red-600 dark:text-red-400 text-sm">{formatCurrency(data.totalShpenzim)}</td>
                      <td className="table-cell text-right font-bold text-violet-600 dark:text-violet-400 text-sm">{formatCurrency(data.totalInvKapital)}</td>
                      <td className="table-cell text-right font-bold text-cyan-600 dark:text-cyan-400 text-sm">{formatCurrency(data.totalInvPerkohshem)}</td>
                      <td className="table-cell text-right">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-bold ${data.totalBalanca >= 0 ? "bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300" : "bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300"}`}>
                          {data.totalBalanca >= 0 ? "+" : ""}{formatCurrency(data.totalBalanca)}
                        </span>
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
