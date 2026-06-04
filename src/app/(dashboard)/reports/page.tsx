"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/layout/Header";
import { formatCurrency, MONTHS } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from "recharts";
import { Download, FileBarChart, AlertCircle, GraduationCap } from "lucide-react";

const REPORT_TYPES = [
  { value: "monthly", label: "Pagesat Mujore", icon: FileBarChart },
  { value: "debts", label: "Borxhet", icon: AlertCircle },
  { value: "byClass", label: "Sipas Klasës", icon: GraduationCap },
];

const COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2", "#c026d3", "#16a34a", "#ea580c", "#0d9488", "#9333ea", "#e11d48"];

export default function ReportsPage() {
  const [reportType, setReportType] = useState("monthly");
  const [year, setYear] = useState(new Date().getFullYear());
  const [data, setData] = useState<unknown>(null);
  const [loading, setLoading] = useState(true);

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/reports?type=${reportType}&year=${year}`);
    const json = await res.json();
    setData(json.data);
    setLoading(false);
  }, [reportType, year]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  async function exportExcel() {
    const XLSX = await import("xlsx");
    let wsData: (string | number)[][] = [];

    if (reportType === "monthly") {
      const d = data as { month: number; total: number; count: number }[];
      wsData = [
        ["Muaji", "Të Hyra (Lekë)", "Numri i Pagesave"],
        ...d.map(r => [MONTHS[r.month - 1], r.total, r.count]),
        ["TOTALI", d.reduce((s, r) => s + r.total, 0), d.reduce((s, r) => s + r.count, 0)],
      ];
    } else if (reportType === "debts") {
      const d = data as { name: string; class: string; totalDebt: number }[];
      wsData = [
        ["Nxënësi", "Klasa", "Borxhi Total (Lekë)"],
        ...d.map(r => [r.name, r.class, r.totalDebt]),
        ["TOTALI", "", d.reduce((s, r) => s + r.totalDebt, 0)],
      ];
    } else {
      const d = data as { className: string; level: string; studentCount: number; totalRevenue: number }[];
      wsData = [
        ["Klasa", "Niveli", "Nxënës", "Të Hyra (Lekë)"],
        ...d.map(r => [r.className, r.level, r.studentCount, r.totalRevenue]),
      ];
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Raporti");
    XLSX.writeFile(wb, `Raporti-${reportType}-${year}.xlsx`);
  }

  async function exportPDF() {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");

    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.setTextColor(37, 99, 235);
    doc.text("AKADEMIA ORA — Raport", 20, 20);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Viti: ${year} • Data: ${new Date().toLocaleDateString("sq-AL")}`, 20, 28);

    let head: string[][] = [];
    let body: (string | number)[][] = [];

    if (reportType === "monthly") {
      const d = data as { month: number; total: number; count: number }[];
      head = [["Muaji", "Të Hyra (Lekë)", "Nr. Pagesave"]];
      body = d.map(r => [MONTHS[r.month - 1], `${r.total.toLocaleString()} Lekë`, r.count]);
    } else if (reportType === "debts") {
      const d = data as { name: string; class: string; totalDebt: number }[];
      head = [["Nxënësi", "Klasa", "Borxhi (Lekë)"]];
      body = d.map(r => [r.name, r.class, `${r.totalDebt.toLocaleString()} Lekë`]);
    } else {
      const d = data as { className: string; level: string; studentCount: number; totalRevenue: number }[];
      head = [["Klasa", "Niveli", "Nxënës", "Të Hyra"]];
      body = d.map(r => [r.className, r.level, r.studentCount, `${r.totalRevenue.toLocaleString()} Lekë`]);
    }

    autoTable(doc, {
      startY: 38,
      head,
      body,
      headStyles: { fillColor: [37, 99, 235], textColor: 255 },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 20, right: 20 },
    });

    doc.save(`Raporti-${reportType}-${year}.pdf`);
  }

  return (
    <>
      <Header title="Raportet" />
      <div className="p-6 space-y-5 animate-fade-in">

        {/* Controls */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
          <div className="flex gap-2">
            {REPORT_TYPES.map(rt => (
              <button
                key={rt.value}
                onClick={() => setReportType(rt.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  reportType === rt.value
                    ? "bg-primary-600 text-white"
                    : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700"
                }`}
              >
                <rt.icon className="w-4 h-4" />
                {rt.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <select
              value={year}
              onChange={e => setYear(parseInt(e.target.value))}
              className="form-input w-28"
            >
              {[2023, 2024, 2025, 2026].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <button onClick={exportExcel} className="btn-secondary">
              <Download className="w-4 h-4" />
              Excel
            </button>
            <button onClick={exportPDF} className="btn-primary">
              <Download className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>

        {loading ? (
          <div className="card flex items-center justify-center h-64">
            <svg className="animate-spin w-6 h-6 text-primary-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          </div>
        ) : (
          <>
            {/* Monthly Report */}
            {reportType === "monthly" && data && (
              <MonthlyReport data={data as { month: number; total: number; count: number }[]} />
            )}

            {/* Debts Report */}
            {reportType === "debts" && data && (
              <DebtsReport data={data as { id: number; name: string; class: string; totalDebt: number }[]} />
            )}

            {/* By Class Report */}
            {reportType === "byClass" && data && (
              <ByClassReport data={data as { className: string; level: string; studentCount: number; totalRevenue: number }[]} colors={COLORS} />
            )}
          </>
        )}
      </div>
    </>
  );
}

function MonthlyReport({ data }: { data: { month: number; total: number; count: number }[] }) {
  const totalRevenue = data.reduce((s, d) => s + d.total, 0);
  const totalPayments = data.reduce((s, d) => s + d.count, 0);
  const maxMonth = data.reduce((max, d) => d.total > max.total ? d : max, data[0]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-slate-400 mb-1">Totali Vjetor</p>
          <p className="text-xl font-bold text-primary-600">{formatCurrency(totalRevenue)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400 mb-1">Nr. Total i Pagesave</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{totalPayments}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400 mb-1">Muaji më i Mirë</p>
          <p className="text-xl font-bold text-green-600">
            {MONTHS[(maxMonth?.month || 1) - 1]}
          </p>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="section-title mb-4">Të Hyrat Mujore</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.map(d => ({ ...d, name: MONTHS[d.month - 1].slice(0, 3) }))}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis
              tick={{ fontSize: 11, fill: "#94a3b8" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}
            />
            <Tooltip
              formatter={(v: number) => [formatCurrency(v), "Të hyra"]}
              contentStyle={{ background: "#1e293b", border: "none", borderRadius: "8px", color: "#f8fafc", fontSize: "12px" }}
            />
            <Bar dataKey="total" radius={[6, 6, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={i === (data.findIndex(d => d.total === Math.max(...data.map(d2 => d2.total)))) ? "#2563eb" : "#bfdbfe"} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="table-header">Muaji</th>
              <th className="table-header text-right">Të Hyra</th>
              <th className="table-header text-right">Nr. Pagesave</th>
              <th className="table-header text-right">Mesatarja</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {data.map(row => (
              <tr key={row.month} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="table-cell font-medium">{MONTHS[row.month - 1]}</td>
                <td className="table-cell text-right font-semibold text-primary-600">
                  {formatCurrency(row.total)}
                </td>
                <td className="table-cell text-right text-slate-500">{row.count}</td>
                <td className="table-cell text-right text-slate-500">
                  {row.count > 0 ? formatCurrency(row.total / row.count) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <td className="table-cell font-bold">TOTALI</td>
              <td className="table-cell text-right font-bold text-primary-600">
                {formatCurrency(data.reduce((s, d) => s + d.total, 0))}
              </td>
              <td className="table-cell text-right font-bold">
                {data.reduce((s, d) => s + d.count, 0)}
              </td>
              <td />
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}

function DebtsReport({ data }: { data: { id: number; name: string; class: string; totalDebt: number }[] }) {
  const totalDebt = data.reduce((s, d) => s + d.totalDebt, 0);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-slate-400 mb-1">Nxënës me Borxh</p>
          <p className="text-xl font-bold text-red-600">{data.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400 mb-1">Borxhi Total</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalDebt)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400 mb-1">Borxhi Mesatar</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white">
            {data.length > 0 ? formatCurrency(totalDebt / data.length) : "—"}
          </p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="table-header">#</th>
              <th className="table-header">Nxënësi</th>
              <th className="table-header">Klasa</th>
              <th className="table-header text-right">Borxhi (Lekë)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {data.length === 0 ? (
              <tr>
                <td colSpan={4} className="table-cell text-center py-8 text-slate-400">
                  Asnjë borxh i gjetur
                </td>
              </tr>
            ) : data.sort((a, b) => b.totalDebt - a.totalDebt).map((row, i) => (
              <tr key={`${row.name}-${i}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="table-cell text-slate-400">{i + 1}</td>
                <td className="table-cell font-medium text-slate-900 dark:text-white">{row.name}</td>
                <td className="table-cell">
                  <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded text-xs font-medium">
                    {row.class}
                  </span>
                </td>
                <td className="table-cell text-right font-semibold text-red-600 dark:text-red-400">
                  {formatCurrency(row.totalDebt)}
                </td>
              </tr>
            ))}
          </tbody>
          {data.length > 0 && (
            <tfoot className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <td colSpan={3} className="table-cell font-bold">TOTALI</td>
                <td className="table-cell text-right font-bold text-red-600">
                  {formatCurrency(totalDebt)}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}

function ByClassReport({ data, colors }: {
  data: { className: string; level: string; studentCount: number; totalRevenue: number }[];
  colors: string[];
}) {
  return (
    <div className="space-y-4">
      <div className="card p-5">
        <h3 className="section-title mb-4">Të Hyrat Sipas Klasës</h3>
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="className" tick={{ fontSize: 12, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
              tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
            <Tooltip
              formatter={(v: number) => [formatCurrency(v), "Të hyra"]}
              contentStyle={{ background: "#1e293b", border: "none", borderRadius: "8px", color: "#f8fafc", fontSize: "12px" }}
            />
            <Bar dataKey="totalRevenue" radius={[6, 6, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={colors[i % colors.length]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="table-header">Klasa</th>
              <th className="table-header">Niveli</th>
              <th className="table-header text-right">Nxënës</th>
              <th className="table-header text-right">Të Hyra</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {data.length === 0 ? (
              <tr>
                <td colSpan={4} className="table-cell text-center py-8 text-slate-400">Asnjë klasë e gjetur</td>
              </tr>
            ) : data.map((row, i) => (
              <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="table-cell">
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full" style={{ background: colors[i % colors.length] }} />
                    <span className="font-medium text-slate-900 dark:text-white">{row.className}</span>
                  </div>
                </td>
                <td className="table-cell text-slate-500">{row.level}</td>
                <td className="table-cell text-right font-medium">{row.studentCount}</td>
                <td className="table-cell text-right font-semibold text-primary-600">{formatCurrency(row.totalRevenue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
