"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/layout/Header";
import { formatCurrency, formatDate, MONTHS } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell
} from "recharts";
import { Download, FileBarChart, AlertCircle, GraduationCap, Receipt } from "lucide-react";
import { ACADEMIC_YEARS, CALENDAR_YEARS, type YearType } from "@/lib/academicYear";

const REPORT_TYPES = [
  { value: "monthly",  label: "Pagesat Mujore", icon: FileBarChart },
  { value: "invoices", label: "Faturat",         icon: Receipt },
  { value: "debts",    label: "Borxhet",         icon: AlertCircle },
  { value: "byClass",  label: "Sipas Klasës",    icon: GraduationCap },
];

const COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2", "#c026d3", "#16a34a", "#ea580c", "#0d9488", "#9333ea", "#e11d48"];

export default function ReportsPage() {
  const [reportType, setReportType] = useState("monthly");
  const [yearType, setYearType]     = useState<YearType>("calendar");
  const [year, setYear]             = useState(new Date().getFullYear());
  const [data, setData]             = useState<unknown>(null);
  const [invMeta, setInvMeta]       = useState<{ totalAmount: number; paidAmount: number; pendingAmount: number } | null>(null);
  const [loading, setLoading]       = useState(true);
  const [periodLabel, setPeriodLabel] = useState("");

  const years = yearType === "academic" ? ACADEMIC_YEARS : CALENDAR_YEARS;

  function switchYearType(yt: YearType) {
    setYearType(yt);
    const yrs = yt === "academic" ? ACADEMIC_YEARS : CALENDAR_YEARS;
    if (!yrs.includes(year)) setYear(yrs[yrs.length - 2] ?? yrs[0]);
  }

  const fetchReport = useCallback(async () => {
    setLoading(true);
    const res = await fetch(`/api/reports?type=${reportType}&year=${year}&yearType=${yearType}`);
    const json = await res.json();
    setData(json.data);
    setPeriodLabel(json.label || String(year));
    if (json.totalAmount !== undefined) {
      setInvMeta({ totalAmount: json.totalAmount, paidAmount: json.paidAmount, pendingAmount: json.pendingAmount });
    } else {
      setInvMeta(null);
    }
    setLoading(false);
  }, [reportType, year, yearType]);

  useEffect(() => { fetchReport(); }, [fetchReport]);

  async function exportExcel() {
    const XLSX = await import("xlsx");
    let wsData: (string | number)[][] = [];

    if (reportType === "monthly") {
      const d = data as { month: number; total: number; count: number }[];
      wsData = [
        ["Muaji", "Të Hyra (€)", "Numri i Pagesave"],
        ...d.map(r => [MONTHS[r.month - 1], r.total, r.count]),
        ["TOTALI", d.reduce((s, r) => s + r.total, 0), d.reduce((s, r) => s + r.count, 0)],
      ];
    } else if (reportType === "invoices") {
      const d = data as { number: string; studentName: string; className: string; total: number; status: string; date: string }[];
      wsData = [
        ["Nr. Faturës", "Nxënësi", "Klasa", "Data", "Statusi", "Totali (€)"],
        ...d.map(r => [r.number, r.studentName, r.className, formatDate(r.date), r.status, r.total]),
        ["TOTALI", "", "", "", "", d.reduce((s, r) => s + r.total, 0)],
      ];
    } else if (reportType === "debts") {
      const d = data as { name: string; class: string; totalDebt: number }[];
      wsData = [
        ["Nxënësi", "Klasa", "Borxhi Total (€)"],
        ...d.map(r => [r.name, r.class, r.totalDebt]),
        ["TOTALI", "", d.reduce((s, r) => s + r.totalDebt, 0)],
      ];
    } else {
      const d = data as { className: string; level: string; studentCount: number; totalRevenue: number }[];
      wsData = [
        ["Klasa", "Niveli", "Nxënës", "Të Hyra (€)"],
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
    doc.text(`Viti: ${year} • Data: ${formatDate(new Date())}`, 20, 28);

    let head: string[][] = [];
    let body: (string | number)[][] = [];

    if (reportType === "monthly") {
      const d = data as { month: number; total: number; count: number }[];
      head = [["Muaji", "Të Hyra (€)", "Nr. Pagesave"]];
      body = d.map(r => [MONTHS[r.month - 1], `${r.total.toLocaleString()} €`, r.count]);
    } else if (reportType === "invoices") {
      const d = data as { number: string; studentName: string; className: string; total: number; status: string; date: string }[];
      head = [["Nr. Faturës", "Nxënësi", "Klasa", "Data", "Statusi", "Totali (€)"]];
      body = d.map(r => [r.number, r.studentName, r.className, formatDate(r.date), r.status, `${r.total.toLocaleString()} €`]);
    } else if (reportType === "debts") {
      const d = data as { name: string; class: string; totalDebt: number }[];
      head = [["Nxënësi", "Klasa", "Borxhi (€)"]];
      body = d.map(r => [r.name, r.class, `${r.totalDebt.toLocaleString()} €`]);
    } else {
      const d = data as { className: string; level: string; studentCount: number; totalRevenue: number }[];
      head = [["Klasa", "Niveli", "Nxënës", "Të Hyra"]];
      body = d.map(r => [r.className, r.level, r.studentCount, `${r.totalRevenue.toLocaleString()} €`]);
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

          <div className="flex items-center gap-2 flex-wrap">
            {/* Togël Kalendarik / Akademik */}
            <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 text-xs font-semibold">
              {([["calendar", "📅 Kalendarik"], ["academic", "🎓 Akademik"]] as [YearType, string][]).map(([yt, lbl]) => (
                <button key={yt} onClick={() => switchYearType(yt)}
                  className={`px-3 py-2 transition-colors ${yearType === yt ? "bg-primary-600 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                  {lbl}
                </button>
              ))}
            </div>
            {/* Year selector */}
            <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="form-input w-32">
              {years.map(y => (
                <option key={y} value={y}>{yearType === "academic" ? `${y}–${y + 1}` : y}</option>
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
            {/* Periudha aktive */}
            {periodLabel && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wide">
                  {yearType === "academic" ? "Vit Akademik" : "Vit Kalendarik"}:
                </span>
                <span className="text-sm font-bold text-primary-700 dark:text-primary-400">{periodLabel}</span>
              </div>
            )}

            {/* Monthly Report */}
            {reportType === "monthly" && data && (
              <MonthlyReport data={data as { month: number; year: number; label: string; total: number; count: number }[]} />
            )}

            {/* Invoices Report */}
            {reportType === "invoices" && data && invMeta && (
              <InvoicesReport
                data={data as { id: number; number: string; studentName: string; className: string; total: number; status: string; date: string; paidDate: string | null }[]}
                meta={invMeta}
              />
            )}

            {/* Debts Report */}
            {reportType === "debts" && data && (
              <DebtsReport data={data as { id: number; name: string; class: string; totalDebt: number; totalPaid: number; finalPrice: number; noPay: boolean }[]} />
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

function MonthlyReport({ data }: { data: { month: number; year?: number; label?: string; total: number; count: number }[] }) {
  const totalRevenue  = data.reduce((s, d) => s + d.total, 0);
  const totalPayments = data.reduce((s, d) => s + d.count, 0);
  const maxMonth      = data.reduce((max, d) => d.total > max.total ? d : max, data[0]);

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
            {maxMonth?.label || MONTHS[(maxMonth?.month || 1) - 1]}
          </p>
        </div>
      </div>

      <div className="card p-5">
        <h3 className="section-title mb-4">Të Hyrat Mujore</h3>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.map(d => ({ ...d, name: (d.label || MONTHS[d.month - 1]).slice(0, 3) }))}>
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
              <tr key={`${row.month}-${row.year}`} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                <td className="table-cell font-medium">{row.label || MONTHS[row.month - 1]}</td>
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

function DebtsReport({ data }: { data: { id: number; name: string; class: string; totalDebt: number; totalPaid: number; finalPrice: number; noPay: boolean }[] }) {
  const totalDebt   = data.reduce((s, d) => s + d.totalDebt, 0);
  const noPayers    = data.filter(d => d.noPay).length;
  const partialPay  = data.filter(d => !d.noPay).length;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-slate-400 mb-1">Nxënës me Borxh</p>
          <p className="text-xl font-bold text-red-600">{data.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400 mb-1">Borxhi Total</p>
          <p className="text-xl font-bold text-red-600">{formatCurrency(totalDebt)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400 mb-1">Pa paguar fare</p>
          <p className="text-xl font-bold text-orange-600">{noPayers}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400 mb-1">Paguar pjesërisht</p>
          <p className="text-xl font-bold text-amber-600">{partialPay}</p>
        </div>
      </div>

      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="table-header">#</th>
              <th className="table-header">Nxënësi</th>
              <th className="table-header">Klasa</th>
              <th className="table-header">Statusi</th>
              <th className="table-header text-right">Paguar</th>
              <th className="table-header text-right">Borxhi</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {data.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-cell text-center py-8 text-slate-400">
                  Asnjë borxh i gjetur
                </td>
              </tr>
            ) : data.map((row, i) => (
              <tr key={`${row.name}-${i}`} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${row.noPay ? "bg-orange-50/30 dark:bg-orange-900/5" : ""}`}>
                <td className="table-cell text-slate-400 text-xs">{i + 1}</td>
                <td className="table-cell font-medium text-slate-900 dark:text-white">{row.name}</td>
                <td className="table-cell">
                  <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded text-xs font-medium">
                    {row.class}
                  </span>
                </td>
                <td className="table-cell">
                  {row.noPay ? (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-400">
                      Pa paguar fare
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                      Paguar pjesërisht
                    </span>
                  )}
                </td>
                <td className="table-cell text-right text-sm">
                  {row.totalPaid > 0
                    ? <span className="text-emerald-600 dark:text-emerald-400 font-medium">{formatCurrency(row.totalPaid)}</span>
                    : <span className="text-slate-300">—</span>}
                </td>
                <td className="table-cell text-right font-bold text-red-600 dark:text-red-400">
                  {formatCurrency(row.totalDebt)}
                </td>
              </tr>
            ))}
          </tbody>
          {data.length > 0 && (
            <tfoot className="bg-slate-50 dark:bg-slate-800/50 border-t-2 border-slate-200 dark:border-slate-600">
              <tr>
                <td colSpan={4} className="table-cell font-bold text-slate-700 dark:text-slate-200">TOTALI</td>
                <td className="table-cell text-right font-bold text-emerald-600">
                  {formatCurrency(data.reduce((s, d) => s + d.totalPaid, 0))}
                </td>
                <td className="table-cell text-right font-bold text-red-600 text-base">
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

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  DRAFT:     { label: "Draft",    cls: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
  SENT:      { label: "Dërguar", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
  PAID:      { label: "Paguar",  cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300" },
  CANCELLED: { label: "Anuluar", cls: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300" },
};

function InvoicesReport({
  data,
  meta,
}: {
  data: { id: number; number: string; studentName: string; className: string; total: number; status: string; date: string; paidDate: string | null }[];
  meta: { totalAmount: number; paidAmount: number; pendingAmount: number };
}) {
  const [search, setSearch] = useState("");
  const filtered = data.filter(r =>
    r.studentName.toLowerCase().includes(search.toLowerCase()) ||
    r.number.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-slate-400 mb-1">Nr. Faturave</p>
          <p className="text-xl font-bold text-slate-900 dark:text-white">{data.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400 mb-1">Totali i Faturuar</p>
          <p className="text-xl font-bold text-primary-600">{formatCurrency(meta.totalAmount)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400 mb-1">Paguar</p>
          <p className="text-xl font-bold text-emerald-600">{formatCurrency(meta.paidAmount)}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400 mb-1">Gjendje e Papaguar</p>
          <p className="text-xl font-bold text-amber-600">{formatCurrency(meta.pendingAmount)}</p>
        </div>
      </div>

      {/* Search */}
      <div className="card p-3 flex items-center gap-3">
        <input
          className="input flex-1 max-w-xs"
          placeholder="Kërko nxënës ose nr. fature..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="text-xs text-slate-400">{filtered.length} fatura</span>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <th className="table-header">Nr. Faturës</th>
              <th className="table-header">Nxënësi</th>
              <th className="table-header">Klasa</th>
              <th className="table-header">Data</th>
              <th className="table-header">Statusi</th>
              <th className="table-header text-right">Totali</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="table-cell text-center py-8 text-slate-400">Asnjë faturë e gjetur</td>
              </tr>
            ) : filtered.map(row => {
              const st = STATUS_MAP[row.status] ?? { label: row.status, cls: "bg-slate-100 text-slate-600" };
              return (
                <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="table-cell font-mono text-xs text-primary-600 dark:text-primary-400">{row.number}</td>
                  <td className="table-cell font-medium text-slate-900 dark:text-white">{row.studentName}</td>
                  <td className="table-cell">
                    <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded text-xs font-medium">
                      {row.className}
                    </span>
                  </td>
                  <td className="table-cell text-slate-500 text-sm">{formatDate(row.date)}</td>
                  <td className="table-cell">
                    <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold ${st.cls}`}>{st.label}</span>
                  </td>
                  <td className="table-cell text-right font-semibold text-slate-900 dark:text-white">{formatCurrency(row.total)}</td>
                </tr>
              );
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot className="bg-slate-50 dark:bg-slate-800/50 border-t-2 border-slate-200 dark:border-slate-600">
              <tr>
                <td colSpan={5} className="table-cell font-bold text-slate-700 dark:text-slate-200">TOTALI</td>
                <td className="table-cell text-right font-bold text-primary-600">
                  {formatCurrency(filtered.reduce((s, r) => s + r.total, 0))}
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
