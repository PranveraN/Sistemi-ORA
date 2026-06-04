"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Header from "@/components/layout/Header";
import Link from "next/link";
import { formatCurrency, formatDate, getStatusColor, getStatusLabel, MONTHS } from "@/lib/utils";
import * as XLSX from "xlsx";
import {
  Search, CheckCircle, AlertCircle, Plus, X, Save,
  Users, Loader2, Printer, Calculator, ChevronDown, ChevronUp, Info,
  TrendingUp, TrendingDown, ArrowLeftRight, Phone, BarChart3, Download, FileUp,
} from "lucide-react";
import InvoicePrintModal from "@/components/finance/InvoicePrintModal";
import ExpensesSection from "@/components/finance/ExpensesSection";

type Tab = "income" | "expense" | "handover" | "report";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "income",   label: "Të Hyra",       icon: <TrendingUp     className="w-4 h-4" /> },
  { key: "expense",  label: "Shpenzime",      icon: <TrendingDown   className="w-4 h-4" /> },
  { key: "handover", label: "Dorezim Parash", icon: <ArrowLeftRight className="w-4 h-4" /> },
  { key: "report",   label: "Raport",         icon: <BarChart3      className="w-4 h-4" /> },
];

function exportUshqimiExcel(students: StudentRow[], month: number, year: number) {
  const wb = XLSX.utils.book_new();
  const today = new Date().toLocaleDateString("sq-AL");
  const periudha = month > 0 && year > 0
    ? `${MONTHS[month - 1]} ${year}`
    : year > 0 ? String(year) : "Të gjitha";

  const totalBilled    = students.reduce((s, r) => s + (r.payment?.finalAmount || 0), 0);
  const totalCollected = students.reduce((s, r) => s + (r.payment?.paidAmount  || 0), 0);
  const totalDebt      = students.reduce((s, r) => s + (r.payment?.balance     || 0), 0);
  const paid    = students.filter(s => s.payment?.status === "PAID").length;
  const overdue = students.filter(s => s.payment?.status === "OVERDUE").length;
  const pending = students.filter(s => !s.payment || s.payment.status === "PENDING").length;

  // Sheet 1: Permbledhje
  const summary = [
    ["RAPORTI FINANCIAR — USHQIMI", "", today],
    ["Periudha:", periudha],
    [],
    ["PASQYRA", ""],
    ["Faturuar totale",   totalBilled],
    ["E arkëtuar",        totalCollected],
    ["(-) Borxhe",        totalDebt],
    [],
    ["STATUSI I NXËNËSVE", ""],
    ["Gjithsej nxënës",  students.length],
    ["Paguar",           paid],
    ["Vonuar",           overdue],
    ["Pa pagesë",        pending],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summary);
  ws1["!cols"] = [{ wch: 24 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Përmbledhje");

  // Sheet 2: Lista nxënësve
  const rows = [
    ["#", "Emri", "Mbiemri", "Klasa", "Telefoni", "Faturuar (€)", "Paguar (€)", "Borxhi (€)", "Statusi"],
    ...students.map((s, i) => [
      i + 1,
      s.firstName,
      s.lastName,
      s.class?.name ?? "",
      s.parentPhone ?? "",
      s.payment?.finalAmount ?? 0,
      s.payment?.paidAmount  ?? 0,
      s.payment?.balance     ?? 0,
      s.payment?.status === "PAID"    ? "Paguar"
        : s.payment?.status === "OVERDUE" ? "Vonuar"
        : s.payment?.status === "PARTIAL" ? "Pjesërisht"
        : "Pa pagesë",
    ]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(rows);
  ws2["!cols"] = [{ wch: 4 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 13 }, { wch: 13 }, { wch: 12 }, { wch: 13 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Lista nxënësve");

  XLSX.writeFile(wb, `Raporti-Ushqimi-${periudha.replace(/\s/g, "-")}-${today.replace(/\//g, "-")}.xlsx`);
}

/* ─── Types ────────────────────────────────────────────── */
interface Payment {
  id: number; amount: number; finalAmount: number; paidAmount: number;
  balance: number; discount: number; discountType: string | null;
  scholarship: number; method: string | null; paidDate: string | null;
  dueDate: string; status: string; description: string | null;
}
interface StudentRow {
  id: number; firstName: string; lastName: string;
  parentPhone: string | null;
  class: { id: number; name: string } | null;
  payment: Payment | null;
}

type StatFilter = "all" | "paid" | "overdue" | "pending" | "revenue" | "debt";

interface Period {
  name: string;
  days: number;
  klasaDays: number;
  zbritjeDays: number;
}

const DEFAULT_PERIODS: Period[] = [
  { name: "Shtator/Tetor",  days: 42, klasaDays: 37, zbritjeDays: 0  },
  { name: "Nëntor/Dhjetor", days: 37, klasaDays: 37, zbritjeDays: 0  },
  { name: "Janar/Shkurt",   days: 36, klasaDays: 36, zbritjeDays: 27 },
  { name: "Mars/Prill",     days: 37, klasaDays: 37, zbritjeDays: 23 },
  { name: "Maj/Qershor",    days: 32, klasaDays: 32, zbritjeDays: 0  },
];

const MEAL_PLANS = [
  { value: "1_shujtë_ditë",   label: "1 shujtë / ditë"    },
  { value: "2_shujta_ditë",   label: "2 shujta / ditë"    },
  { value: "1_shujtë_muaj",   label: "1 shujtë / muaj"    },
  { value: "2_shujta_muaj",   label: "2 shujta / muaj"    },
  { value: "2_muaj_1s",       label: "2 muaj – 1 shujtë"  },
  { value: "2_muaj_2s",       label: "2 muaj – 2 shujta"  },
  { value: "dite_specifike",  label: "Ditë specifike"     },
  { value: "periudhe",        label: "Periudhë e lirë"    },
];

/* ─── Pricing calculator ───────────────────────────────── */
function calcPrices(price2Meals: number, workingDays: number, monthsPerYear: number) {
  const per1 = price2Meals / 2;
  const per2 = price2Meals;
  return {
    "1_shujtë_ditë":  per1,
    "2_shujta_ditë":  per2,
    "1_shujtë_muaj":  per1 * workingDays,
    "2_shujta_muaj":  per2 * workingDays,
    "2_muaj_1s":      per1 * workingDays * 2,
    "2_muaj_2s":      per2 * workingDays * 2,
    "dite_specifike": per2,
    "periudhe":       per2 * workingDays,
    "1_shujtë_vit":   per1 * workingDays * monthsPerYear,
    "2_shujta_vit":   per2 * workingDays * monthsPerYear,
  };
}

/* ═══════════════════════════════════════════════════════ */
export default function UshqimiPage() {
  const now = new Date();
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [year, setYear]     = useState(now.getFullYear());
  const [search, setSearch] = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading]   = useState(true);

  // Pricing config
  const [price2Meals,   setPrice2Meals]   = useState(4);
  const [workingDays,   setWorkingDays]   = useState(20);
  const [monthsPerYear, setMonthsPerYear] = useState(10);
  const [periods,       setPeriods]       = useState<Period[]>(DEFAULT_PERIODS);
  const [showCalc,      setShowCalc]      = useState(true);
  const [showManual,    setShowManual]    = useState(false);

  // Tab + category ID
  const [tab,        setTab]        = useState<Tab>("income");
  const [categoryId, setCategoryId] = useState<number | null>(null);

  // View mode
  const [showOnlyEnrolled, setShowOnlyEnrolled] = useState(true);
  const [copying, setCopying] = useState(false);
  const [copyResult, setCopyResult] = useState<string | null>(null);

  // Modals
  const [payModal,    setPayModal]    = useState<StudentRow | null>(null);
  const [printModal,  setPrintModal]  = useState<StudentRow | null>(null);
  const [statFilter,  setStatFilter]  = useState<StatFilter | null>(null);
  const [enrollModal, setEnrollModal] = useState(false);

  const prices = calcPrices(price2Meals, workingDays, monthsPerYear);

  // Stats
  const enrolled    = students.filter(s => s.payment !== null).length;
  const notEnrolled = students.length - enrolled;
  const paid    = students.filter(s => s.payment?.status === "PAID").length;
  const overdue = students.filter(s => s.payment?.status === "OVERDUE").length;
  const pending = students.filter(s => !s.payment || s.payment.status === "PENDING").length;
  const totalRevenue = students.reduce((s, r) => s + (r.payment?.paidAmount || 0), 0);
  const totalDebt    = students.reduce((s, r) => s + (r.payment?.balance   || 0), 0);

  async function copyFromPrevMonth() {
    setCopying(true);
    setCopyResult(null);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear  = month === 1 ? year - 1 : year;
    const res = await fetch(`/api/category-payments?category=Ushqimi&month=${prevMonth}&year=${prevYear}`);
    const data = await res.json();
    const prevEnrolled: StudentRow[] = (data.students || []).filter((s: StudentRow) => s.payment !== null);
    const currentIds = new Set(students.filter(s => s.payment !== null).map(s => s.id));
    const toAdd = prevEnrolled.filter(s => !currentIds.has(s.id));
    if (toAdd.length === 0) {
      setCopyResult("Të gjithë nxënësit e muajit paraprak tashmë janë të regjistruar.");
      setCopying(false);
      return;
    }
    const today = new Date(year, month - 1, 5).toISOString().split("T")[0];
    await Promise.all(toAdd.map(s =>
      fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: s.id, categoryId,
          amount: 0, discount: 0, discountType: null, scholarship: 0,
          paidAmount: 0, method: "CASH",
          dueDate: today,
          description: s.payment?.description || null,
          month, year,
        }),
      })
    ));
    setCopyResult(`✓ ${toAdd.length} nxënës u kopjuan nga ${MONTHS[prevMonth - 1]}.`);
    setCopying(false);
    fetchData();
  }

  async function handleRemoveEnrollment(s: StudentRow) {
    if (!s.payment) return;
    if (s.payment.paidAmount > 0) {
      alert("Ky nxënës ka bërë pagesa — modifiko manualisht.");
      return;
    }
    if (!confirm(`Hiq ${s.firstName} ${s.lastName} nga ushqimi?`)) return;
    await fetch(`/api/payments/${s.payment.id}`, { method: "DELETE" });
    fetchData();
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ category: "Ushqimi", search });
    if (month > 0) params.set("month", String(month));
    if (year  > 0) params.set("year",  String(year));
    const res = await fetch(`/api/category-payments?${params}`);
    if (res.ok) {
      const d = await res.json();
      setStudents(d.students);
      if (d.category?.id) setCategoryId(d.category.id);
    }
    setLoading(false);
  }, [month, year, search]);

  const _firstRender = useRef(true);
  useEffect(() => {
    const delay = _firstRender.current ? 0 : 300;
    _firstRender.current = false;
    const t = setTimeout(fetchData, delay);
    return () => clearTimeout(t);
  }, [fetchData]);

  const sorted = [...students].sort((a, b) => {
    const order = ["OVERDUE", "PARTIAL", "PENDING", "PAID"];
    return order.indexOf(a.payment?.status || "PENDING") - order.indexOf(b.payment?.status || "PENDING");
  });

  const displayed = showOnlyEnrolled ? sorted.filter(s => s.payment !== null) : sorted;

  return (
    <>
      <Header title="Ushqimi" />
      <div className="p-6 space-y-4 animate-fade-in">

        {/* ── Tab bar + Month/Year ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t.key
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="form-input w-36">
              <option value={0}>Të gjitha</option>
              {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
            </select>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="form-input w-28">
              <option value={0}>Të gjitha</option>
              {[2023,2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </div>

        {/* ── EXPENSE TAB ── */}
        {tab === "expense" && (
          <ExpensesSection categoryId={categoryId} type="EXPENSE" month={month} year={year} />
        )}

        {/* ── HANDOVER TAB ── */}
        {tab === "handover" && (
          <ExpensesSection categoryId={categoryId} type="HANDOVER" month={month} year={year} />
        )}

        {/* ── REPORT TAB ── */}
        {tab === "report" && (() => {
          const totalBilled    = students.reduce((s, r) => s + (r.payment?.finalAmount || 0), 0);
          const totalCollected = students.reduce((s, r) => s + (r.payment?.paidAmount  || 0), 0);
          const totalDebtR     = students.reduce((s, r) => s + (r.payment?.balance     || 0), 0);
          const paidR    = students.filter(s => s.payment?.status === "PAID").length;
          const overdueR = students.filter(s => s.payment?.status === "OVERDUE").length;
          const pendingR = students.filter(s => !s.payment || s.payment.status === "PENDING").length;
          const collectionRate = totalBilled > 0 ? (totalCollected / totalBilled * 100).toFixed(1) : "0.0";
          return (
            <div className="space-y-4 animate-fade-in">
              {/* Export button */}
              <div className="flex justify-end">
                <button onClick={() => exportUshqimiExcel(students, month, year)}
                  className="btn-ghost">
                  <Download className="w-4 h-4" /> Exporto Excel
                </button>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <div className="card p-4">
                  <p className="text-xs text-slate-400 mb-1">Faturuar totale</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-white">{formatCurrency(totalBilled)}</p>
                  <p className="text-xs text-slate-400 mt-1">{students.filter(s => s.payment).length} nxënës me faturë</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-slate-400 mb-1">E arkëtuar</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(totalCollected)}</p>
                  <p className="text-xs text-slate-400 mt-1">{collectionRate}% e totalit</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-slate-400 mb-1">Borxhe</p>
                  <p className="text-xl font-bold text-red-500">{formatCurrency(totalDebtR)}</p>
                  <p className="text-xs text-slate-400 mt-1">{overdueR} vonuar</p>
                </div>
              </div>

              {/* Revenue bar */}
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-primary-500" /> Pasqyra financiare
                </h2>
                <div className="space-y-2 mb-4">
                  {[
                    { label: "Faturuar totale", value: totalBilled,    cls: "" },
                    { label: "E arkëtuar",       value: totalCollected, cls: "text-green-600" },
                    { label: "(-) Borxhe",       value: totalDebtR,     cls: "text-red-500" },
                  ].map(row => (
                    <div key={row.label} className="flex justify-between items-center py-1.5 border-b border-slate-100 dark:border-slate-800 last:border-0 text-sm">
                      <span className="text-slate-500">{row.label}</span>
                      <span className={`font-semibold ${row.cls || "text-slate-800 dark:text-slate-200"}`}>{formatCurrency(row.value)}</span>
                    </div>
                  ))}
                </div>
                {totalBilled > 0 && (
                  <div className="h-3 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
                    <div className="bg-green-400 h-full transition-all" style={{ width: `${totalCollected / totalBilled * 100}%` }} title="E arkëtuar" />
                    <div className="bg-red-300 h-full transition-all" style={{ width: `${totalDebtR / totalBilled * 100}%` }} title="Borxhe" />
                  </div>
                )}
                <div className="flex gap-4 mt-2">
                  <div className="flex items-center gap-1.5 text-xs"><div className="w-2.5 h-2.5 rounded-sm bg-green-400" /><span className="text-slate-500">E arkëtuar</span></div>
                  <div className="flex items-center gap-1.5 text-xs"><div className="w-2.5 h-2.5 rounded-sm bg-red-300" /><span className="text-slate-500">Borxhe</span></div>
                </div>
              </div>

              {/* Status breakdown */}
              <div className="card p-5">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Statusi i nxënësve</h2>
                <div className="space-y-3">
                  {[
                    { label: "Paguar",    count: paidR,    bar: "bg-green-500",  pct: students.length ? paidR    / students.length * 100 : 0 },
                    { label: "Vonuar",    count: overdueR, bar: "bg-red-400",    pct: students.length ? overdueR / students.length * 100 : 0 },
                    { label: "Pa pagesë", count: pendingR, bar: "bg-slate-300",  pct: students.length ? pendingR / students.length * 100 : 0 },
                  ].map(s => (
                    <div key={s.label} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-slate-500">{s.label}</span>
                        <span className="font-bold text-slate-700 dark:text-slate-300">{s.count} ({s.pct.toFixed(0)}%)</span>
                      </div>
                      <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div className={`h-full ${s.bar} rounded-full transition-all`} style={{ width: `${s.pct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── INCOME TAB content starts here ── */}
        {tab === "income" && <>

        {/* ── Pricing Calculator ── */}
        <div className="card overflow-hidden">
          <button
            onClick={() => setShowCalc(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold text-sm">
              <Calculator className="w-4 h-4 text-primary-500" />
              Kalkulatori i Çmimeve
            </div>
            {showCalc ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showCalc && (
            <div className="border-t border-slate-100 dark:border-slate-700">
              {/* Price input */}
              <div className="px-5 pt-4 pb-3 flex flex-wrap items-end gap-4">
                <div>
                  <label className="form-label">Çmimi 2 shujta / ditë (€)</label>
                  <input type="number" value={price2Meals}
                    onChange={e => setPrice2Meals(parseFloat(e.target.value) || 0)}
                    className="form-input w-36" min="0" step="0.5" />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 pb-2">
                  <Info className="w-3.5 h-3.5" />
                  Mengjesi: {formatCurrency(price2Meals * 3/8)}/ditë · Dreka: {formatCurrency(price2Meals * 5/8)}/ditë
                </div>
              </div>

              {/* Periods table */}
              <div className="overflow-x-auto px-5 pb-4">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-green-100 dark:bg-green-900/30">
                      <th className="text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300">Muaji</th>
                      <th className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 text-center">Ditë pune</th>
                      <th className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 text-center">Çmimi</th>
                      <th className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 text-center">Çmimi / 2 muaj</th>
                      <th className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 text-center">Vetëm Mengjesi</th>
                      <th className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 text-center">Vetëm Dreka</th>
                      <th className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 text-center">Klasa e parë</th>
                      <th className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 text-center">Zbritje e paparishikueshme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((p, i) => {
                      const total2   = p.days * price2Meals;
                      const mengjesi = p.days * price2Meals * 3/8;
                      const dreka    = p.days * price2Meals * 5/8;
                      const klasa    = p.klasaDays * price2Meals;
                      const zbritje  = p.zbritjeDays * price2Meals;
                      return (
                        <tr key={p.name} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="px-3 py-2.5">
                            <span className="font-medium text-slate-700 dark:text-slate-200">{p.name}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <input type="number" value={p.days}
                              onChange={e => setPeriods(prev => prev.map((x, j) => j === i ? { ...x, days: parseInt(e.target.value) || 0 } : x))}
                              className="w-14 text-center border border-slate-200 dark:border-slate-600 rounded-lg px-1.5 py-1 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              min="0" max="60" />
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-500">{price2Meals}€</td>
                          <td className="px-3 py-2.5 text-center font-bold text-primary-600 dark:text-primary-400">{formatCurrency(total2)}</td>
                          <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">{formatCurrency(mengjesi)}</td>
                          <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">{formatCurrency(dreka)}</td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <input type="number" value={p.klasaDays}
                                onChange={e => setPeriods(prev => prev.map((x, j) => j === i ? { ...x, klasaDays: parseInt(e.target.value) || 0 } : x))}
                                className="w-14 text-center border border-slate-200 dark:border-slate-600 rounded-lg px-1.5 py-1 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                min="0" max="60" />
                              <span className="font-bold text-primary-600 dark:text-primary-400 text-sm w-16 text-left">{formatCurrency(klasa)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <input type="number" value={p.zbritjeDays}
                                onChange={e => setPeriods(prev => prev.map((x, j) => j === i ? { ...x, zbritjeDays: parseInt(e.target.value) || 0 } : x))}
                                className="w-14 text-center border border-slate-200 dark:border-slate-600 rounded-lg px-1.5 py-1 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                min="0" max="60" />
                              <span className="font-bold text-slate-600 dark:text-slate-300 text-sm w-16 text-left">
                                {p.zbritjeDays > 0 ? formatCurrency(zbritje) : "—"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    {(() => {
                      const totalDays    = periods.reduce((s, p) => s + p.days, 0);
                      const totalKlasa   = periods.reduce((s, p) => s + p.klasaDays, 0);
                      const totalZbritje = periods.reduce((s, p) => s + p.zbritjeDays, 0);
                      return (
                        <tr className="bg-green-50 dark:bg-green-900/20 font-bold border-t-2 border-green-200 dark:border-green-800">
                          <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">Totali</td>
                          <td className="px-3 py-2.5 text-center text-slate-700 dark:text-slate-200">{totalDays}</td>
                          <td className="px-3 py-2.5 text-center text-slate-500">{price2Meals}€</td>
                          <td className="px-3 py-2.5 text-center text-primary-700 dark:text-primary-300">{formatCurrency(totalDays * price2Meals)}</td>
                          <td className="px-3 py-2.5 text-center text-slate-700 dark:text-slate-200">{formatCurrency(totalDays * price2Meals * 3/8)}</td>
                          <td className="px-3 py-2.5 text-center text-slate-700 dark:text-slate-200">{formatCurrency(totalDays * price2Meals * 5/8)}</td>
                          <td className="px-3 py-2.5 text-center text-primary-700 dark:text-primary-300">{formatCurrency(totalKlasa * price2Meals)}</td>
                          <td className="px-3 py-2.5 text-center text-slate-700 dark:text-slate-200">{formatCurrency(totalZbritje * price2Meals)}</td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>

              {/* Manual calculator (collapsible) */}
              <div className="border-t border-slate-100 dark:border-slate-700">
                <button onClick={() => setShowManual(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm text-slate-500 dark:text-slate-400">
                  <span className="font-medium">Kalkulator Manual</span>
                  {showManual ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showManual && (
                  <div className="px-5 pb-5 space-y-4">
                    <div className="flex flex-wrap items-end gap-4">
                      <div>
                        <label className="form-label">Ditë pune / muaj</label>
                        <input type="number" value={workingDays} onChange={e => setWorkingDays(parseInt(e.target.value) || 20)}
                          className="form-input w-28" min="1" max="31" />
                      </div>
                      <div>
                        <label className="form-label">Muaj / vit</label>
                        <input type="number" value={monthsPerYear} onChange={e => setMonthsPerYear(parseInt(e.target.value) || 10)}
                          className="form-input w-28" min="1" max="12" />
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 pb-2">
                        <Info className="w-3.5 h-3.5" />
                        Ndryshimi i çmimit nuk ndikon pagesat ekzistuese
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                      {MEAL_PLANS.filter(p => p.value !== "dite_specifike" && p.value !== "periudhe").map(plan => (
                        <div key={plan.value} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-slate-400 mb-1 leading-tight">{plan.label}</p>
                          <p className="text-base font-bold text-primary-600 dark:text-primary-400">
                            {formatCurrency(prices[plan.value as keyof typeof prices] || 0)}
                          </p>
                        </div>
                      ))}
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-slate-400 mb-1 leading-tight">Ditë specifike (× n ditë)</p>
                        <p className="text-base font-bold text-slate-500">{formatCurrency(price2Meals)}/ditë</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-slate-400 mb-1 leading-tight">Periudhë (× n muaj)</p>
                        <p className="text-base font-bold text-slate-500">{formatCurrency(price2Meals * workingDays)}/muaj</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-primary-500 mb-1 leading-tight font-medium">1 shujtë / vit ({monthsPerYear} muaj × {workingDays} ditë)</p>
                        <p className="text-lg font-bold text-primary-700 dark:text-primary-300">{formatCurrency(prices["1_shujtë_vit"])}</p>
                      </div>
                      <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-primary-500 mb-1 leading-tight font-medium">2 shujta / vit ({monthsPerYear} muaj × {workingDays} ditë)</p>
                        <p className="text-lg font-bold text-primary-700 dark:text-primary-300">{formatCurrency(prices["2_shujta_vit"])}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <button onClick={() => setStatFilter("all")}
            className="card p-3 flex items-center gap-2 hover:ring-2 hover:ring-slate-300 dark:hover:ring-slate-600 transition-all text-left">
            <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 flex-shrink-0" />
            <div><p className="text-xl font-bold text-slate-800 dark:text-white">{students.length}</p><p className="text-xs text-slate-400">Gjithsej</p></div>
          </button>
          <button onClick={() => setStatFilter("paid")}
            className="card p-3 flex items-center gap-2 hover:ring-2 hover:ring-green-300 dark:hover:ring-green-700 transition-all text-left">
            <CheckCircle className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div><p className="text-xl font-bold text-green-600">{paid}</p><p className="text-xs text-slate-400">Paguar</p></div>
          </button>
          <button onClick={() => setStatFilter("overdue")}
            className="card p-3 flex items-center gap-2 hover:ring-2 hover:ring-red-300 dark:hover:ring-red-700 transition-all text-left">
            <AlertCircle className="w-8 h-8 text-red-400 flex-shrink-0" />
            <div><p className="text-xl font-bold text-red-500">{overdue}</p><p className="text-xs text-slate-400">Vonuar</p></div>
          </button>
          <button onClick={() => setStatFilter("revenue")}
            className="card p-3 hover:ring-2 hover:ring-green-300 dark:hover:ring-green-700 transition-all text-left">
            <p className="text-xs text-slate-400">Të Hyra</p>
            <p className="text-lg font-bold text-green-600 mt-0.5">{formatCurrency(totalRevenue)}</p>
          </button>
          <button onClick={() => setStatFilter("debt")}
            className="card p-3 hover:ring-2 hover:ring-red-300 dark:hover:ring-red-700 transition-all text-left">
            <p className="text-xs text-slate-400">Borxhe</p>
            <p className="text-lg font-bold text-red-500 mt-0.5">{formatCurrency(totalDebt)}</p>
          </button>
        </div>

        {/* ── Enrollment control panel ── */}
        <div className="card p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* View toggle */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 text-sm">
              <button
                onClick={() => setShowOnlyEnrolled(true)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${showOnlyEnrolled ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Me ushqim <span className="ml-1 text-xs font-bold text-primary-600">{enrolled}</span>
              </button>
              <button
                onClick={() => setShowOnlyEnrolled(false)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${!showOnlyEnrolled ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Të gjithë <span className="ml-1 text-xs font-bold text-slate-400">{students.length}</span>
              </button>
            </div>

            {/* Shto nxënës */}
            <button
              onClick={() => setEnrollModal(true)}
              className="btn-primary text-sm"
              disabled={notEnrolled === 0}
            >
              <Plus className="w-4 h-4" />
              Shto nxënës {notEnrolled > 0 && <span className="ml-1 bg-white/20 rounded px-1.5 py-0.5 text-xs">{notEnrolled} pa ushqim</span>}
            </button>

            {/* Kopjo muajin paraprak */}
            <button
              onClick={copyFromPrevMonth}
              disabled={copying}
              className="btn-secondary text-sm"
            >
              {copying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Users className="w-4 h-4" />}
              Kopjo muajin paraprak
            </button>

            {/* Import Excel */}
            <Link href={`/ushqimi/import`} className="btn-secondary text-sm">
              <FileUp className="w-4 h-4" />
              Import Excel
            </Link>
          </div>

          {copyResult && (
            <div className={`text-xs px-3 py-2 rounded-lg ${copyResult.startsWith("✓") ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400"}`}>
              {copyResult}
            </div>
          )}
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Kërko nxënësin..." className="form-input pl-9" />
          </div>
          {enrolled > 0 && (
            <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex min-w-24 max-w-48">
              <div className="bg-green-500 h-full" style={{ width: `${(paid    / enrolled) * 100}%` }} />
              <div className="bg-red-400 h-full"   style={{ width: `${(overdue / enrolled) * 100}%` }} />
              <div className="bg-slate-200 dark:bg-slate-600 h-full" style={{ width: `${(pending / enrolled) * 100}%` }} />
            </div>
          )}
        </div>

        {/* ── Student Table ── */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="table-header w-8">#</th>
                  <th className="table-header">Nxënësi</th>
                  <th className="table-header">Klasa</th>
                  <th className="table-header">Plani</th>
                  <th className="table-header">Shuma</th>
                  <th className="table-header">Paguar</th>
                  <th className="table-header">Borxhi</th>
                  <th className="table-header">Afati</th>
                  <th className="table-header">Statusi</th>
                  <th className="table-header text-right">Veprime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {loading ? (
                  <tr><td colSpan={10} className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary-400 mx-auto" /></td></tr>
                ) : sorted.length === 0 ? (
                  <tr><td colSpan={10} className="py-16 text-center text-slate-400 text-sm">Asnjë nxënës nuk u gjet</td></tr>
                ) : displayed.map((s, i) => {
                  const p = s.payment;
                  const isOverdue = p?.status === "OVERDUE";
                  return (
                    <tr key={s.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${isOverdue ? "bg-red-50/40 dark:bg-red-900/10" : ""}`}>
                      <td className="table-cell text-slate-400 text-xs">{i + 1}</td>
                      <td className="table-cell">
                        <Link href={`/students/${s.id}`} className="font-semibold text-slate-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400">
                          {s.firstName} {s.lastName}
                        </Link>
                      </td>
                      <td className="table-cell">
                        {s.class
                          ? <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded text-xs font-medium">{s.class.name}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="table-cell text-xs text-slate-500 dark:text-slate-400 max-w-[140px]">
                        {p?.description
                          ? <span className="line-clamp-2">{p.description}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="table-cell font-medium">{p ? formatCurrency(p.finalAmount) : <span className="text-slate-300">—</span>}</td>
                      <td className="table-cell text-green-600 dark:text-green-400 font-medium">
                        {p ? formatCurrency(p.paidAmount) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="table-cell">
                        {p && p.balance > 0
                          ? <span className="text-red-600 dark:text-red-400 font-bold">{formatCurrency(p.balance)}</span>
                          : p?.status === "PAID"
                          ? <span className="text-green-500 text-xs">✓</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="table-cell text-xs">
                        {p?.dueDate
                          ? <span className={isOverdue ? "text-red-500 font-medium" : "text-slate-400"}>{formatDate(p.dueDate)}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${getStatusColor(p?.status || "PENDING")}`}>
                          {p ? getStatusLabel(p.status) : "Pa pagesë"}
                        </span>
                      </td>
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPayModal(s)}
                            className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                              p?.status === "PAID"
                                ? "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                                : "bg-primary-600 hover:bg-primary-700 text-white"
                            }`}
                          >
                            <Plus className="w-3 h-3" />
                            {p ? (p.status === "PAID" ? "Modifiko" : "Plotëso") : "Shto"}
                          </button>
                          {p && (
                            <button
                              onClick={() => handleRemoveEnrollment(s)}
                              title="Hiq nga ushqimi"
                              className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-slate-500 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => setPrintModal(s)}
                            title="Gjenero faturë"
                            className="p-1.5 rounded-lg text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:text-slate-500 dark:hover:text-primary-400 transition-colors"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        </>}
      </div>

      {/* ── Modals ── */}
      {payModal && (
        <UshqimiPayModal
          student={payModal}
          month={month} year={year}
          prices={prices}
          workingDays={workingDays}
          onClose={() => setPayModal(null)}
          onSave={async () => { setPayModal(null); await fetchData(); }}
        />
      )}
      {printModal && (
        <InvoicePrintModal
          student={printModal}
          payment={printModal.payment}
          categoryName="Ushqimi"
          month={month} year={year}
          onClose={() => setPrintModal(null)}
        />
      )}
      {statFilter && (
        <StatListModal
          filter={statFilter}
          students={students}
          onClose={() => setStatFilter(null)}
        />
      )}
      {enrollModal && (
        <EnrollModal
          notEnrolled={students.filter(s => s.payment === null)}
          onEnroll={(s) => { setEnrollModal(false); setPayModal(s); }}
          onClose={() => setEnrollModal(false)}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  Payment Modal — specialized for meals                 */
/* ═══════════════════════════════════════════════════════ */
function UshqimiPayModal({ student, month, year, prices, workingDays, onClose, onSave }: {
  student: StudentRow; month: number; year: number;
  prices: Record<string, number>; workingDays: number;
  onClose: () => void; onSave: () => void;
}) {
  const existing = student.payment;
  const [plan,        setPlan]        = useState("2_shujta_muaj");
  const [specificDays,setSpecificDays]= useState(workingDays);
  const [numMonths,   setNumMonths]   = useState(1);
  const [customPrice, setCustomPrice] = useState(0);
  const [paidAmount,  setPaidAmount]  = useState(String(existing?.paidAmount ?? ""));
  const [method,      setMethod]      = useState(existing?.method ?? "CASH");
  const [dueDate,     setDueDate]     = useState(
    existing?.dueDate
      ? new Date(existing.dueDate).toISOString().split("T")[0]
      : new Date(year, month - 1, 5).toISOString().split("T")[0]
  );
  const [paidDate, setPaidDate] = useState(
    existing?.paidDate
      ? new Date(existing.paidDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [saving, setSaving] = useState(false);

  // Calculate final amount based on plan
  const calcAmount = (): number => {
    if (plan === "dite_specifike") return prices["dite_specifike"] * specificDays;
    if (plan === "periudhe")       return prices["periudhe"] * numMonths;
    if (plan === "custom")         return customPrice;
    return prices[plan] ?? 0;
  };

  const finalAmount = calcAmount();
  const paid = parseFloat(paidAmount || "0");
  const balance = Math.max(0, finalAmount - paid);

  const planLabel = MEAL_PLANS.find(p => p.value === plan)?.label || plan;
  const description = plan === "dite_specifike"
    ? `${planLabel} × ${specificDays} ditë (${MONTHS[month - 1]} ${year})`
    : plan === "periudhe"
    ? `${planLabel} × ${numMonths} muaj (nga ${MONTHS[month - 1]} ${year})`
    : `${planLabel} — ${MONTHS[month - 1]} ${year}`;

  async function handleSave() {
    setSaving(true);
    const payload = {
      studentId: student.id,
      categoryId: 2, // Ushqimi category ID — will be resolved by API
      amount: finalAmount,
      discount: 0, discountType: null, scholarship: 0,
      finalAmount,
      paidAmount: paid,
      method,
      dueDate,
      paidDate: paid > 0 ? paidDate : null,
      month, year,
      description,
    };

    // Get real category ID
    const catRes = await fetch("/api/categories");
    const cats = await catRes.json();
    const cat = cats.find((c: { name: string; id: number }) => c.name === "Ushqimi");
    if (cat) payload.categoryId = cat.id;

    if (existing) {
      await fetch(`/api/payments/${existing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    onSave();
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in overflow-y-auto max-h-[92vh]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Pagesa Ushqimit</h3>
            <p className="text-sm text-slate-400 mt-0.5">
              {student.firstName} {student.lastName}
              {student.class && <span> • Klasa {student.class.name}</span>}
              {" • "}{MONTHS[month - 1]} {year}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Plan selector */}
          <div>
            <label className="form-label">Lloji i Planit <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-2 mt-1">
              {MEAL_PLANS.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPlan(p.value)}
                  className={`text-left px-3 py-2.5 rounded-xl border-2 text-sm font-medium transition-all ${
                    plan === p.value
                      ? "border-primary-500 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"
                      : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-primary-200 dark:hover:border-primary-700"
                  }`}
                >
                  <span className="block">{p.label}</span>
                  {p.value !== "dite_specifike" && p.value !== "periudhe" && (
                    <span className={`text-xs font-bold mt-0.5 block ${plan === p.value ? "text-primary-600" : "text-slate-400"}`}>
                      {formatCurrency(prices[p.value] || 0)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Extra inputs for variable plans */}
          {plan === "dite_specifike" && (
            <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-4">
              <label className="form-label">Numri i ditëve specifike</label>
              <input type="number" value={specificDays}
                onChange={e => setSpecificDays(parseInt(e.target.value) || 1)}
                className="form-input w-28" min="1" max="31" />
              <p className="text-xs text-slate-400 mt-2">
                {specificDays} ditë × {formatCurrency(prices["dite_specifike"])} = <strong className="text-primary-600">{formatCurrency(finalAmount)}</strong>
              </p>
            </div>
          )}

          {plan === "periudhe" && (
            <div className="bg-slate-50 dark:bg-slate-900/40 rounded-xl p-4">
              <label className="form-label">Numri i muajve</label>
              <input type="number" value={numMonths}
                onChange={e => setNumMonths(parseInt(e.target.value) || 1)}
                className="form-input w-28" min="1" max="12" />
              <p className="text-xs text-slate-400 mt-2">
                {numMonths} muaj × {formatCurrency(prices["periudhe"])} = <strong className="text-primary-600">{formatCurrency(finalAmount)}</strong>
              </p>
            </div>
          )}

          {/* Summary */}
          <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-primary-700 dark:text-primary-300 font-medium">{description}</span>
            <span className="text-lg font-black text-primary-600 dark:text-primary-400">{formatCurrency(finalAmount)}</span>
          </div>

          {/* Payment fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Paguar (€)</label>
              <input type="number" value={paidAmount}
                onChange={e => setPaidAmount(e.target.value)}
                className="form-input" placeholder="0.00" min="0" step="0.01" />
            </div>
            <div>
              <label className="form-label">Mënyra</label>
              <select value={method} onChange={e => setMethod(e.target.value)} className="form-input">
                <option value="CASH">Cash</option>
                <option value="BANK">Bankë</option>
                <option value="CARD">Kartelë</option>
                <option value="ONLINE">Online</option>
              </select>
            </div>
            <div>
              <label className="form-label">Afati i Pagesës</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="form-label">Data e Pagesës</label>
              <input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} className="form-input" />
            </div>
          </div>

          {/* Balance */}
          {balance > 0 && paid > 0 && (
            <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-sm">
              <span className="text-amber-700 dark:text-amber-400">Borxh i mbetur:</span>
              <span className="font-bold text-amber-700 dark:text-amber-400">{formatCurrency(balance)}</span>
            </div>
          )}

          {/* Quick pay */}
          {finalAmount > 0 && paid < finalAmount && (
            <button
              type="button"
              onClick={() => setPaidAmount(String(finalAmount))}
              className="w-full py-2 rounded-xl border-2 border-dashed border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 text-sm font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Shëno si paguar plotësisht ({formatCurrency(finalAmount)})
            </button>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center"><X className="w-4 h-4" />Anulo</button>
          <button onClick={handleSave} disabled={saving || finalAmount === 0} className="btn-primary flex-1 justify-center">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Duke ruajtur..." : "Ruaj"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  Enroll modal — pick students to add to food service  */
/* ═══════════════════════════════════════════════════════ */
function EnrollModal({ notEnrolled, onEnroll, onClose }: {
  notEnrolled: StudentRow[];
  onEnroll: (s: StudentRow) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = notEnrolled
    .filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      (s.class?.name || "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) =>
      a.firstName.localeCompare(b.firstName, "sq", { sensitivity: "base" }) ||
      a.lastName.localeCompare(b.lastName, "sq", { sensitivity: "base" })
    );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Shto nxënës në ushqim</h3>
            <p className="text-xs text-slate-400 mt-0.5">{notEnrolled.length} nxënës pa ushqim — kliko për të shtuar</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Kërko emrin ose klasën..."
              className="form-input pl-9 w-full"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-12">Asnjë nxënës u gjet</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(s => (
                <li key={s.id}>
                  <button
                    onClick={() => onEnroll(s)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors text-left"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 dark:text-slate-100 text-sm">
                        {s.firstName} {s.lastName}
                      </p>
                      {s.parentPhone && <p className="text-xs text-slate-400">{s.parentPhone}</p>}
                    </div>
                    {s.class && (
                      <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded text-xs font-medium flex-shrink-0">
                        {s.class.name}
                      </span>
                    )}
                    <Plus className="w-4 h-4 text-primary-500 flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  Stat list modal                                       */
/* ═══════════════════════════════════════════════════════ */
const FILTER_CONFIG: Record<StatFilter, { label: string; color: string }> = {
  all:     { label: "Të gjithë nxënësit",       color: "text-slate-700 dark:text-slate-200" },
  paid:    { label: "Nxënës me pagesë",          color: "text-green-600" },
  overdue: { label: "Nxënës me pagesë vonuar",   color: "text-red-500" },
  pending: { label: "Nxënës pa pagesë",          color: "text-slate-500" },
  revenue: { label: "Nxënës me pagesa aktive",   color: "text-green-600" },
  debt:    { label: "Nxënës me borxh",           color: "text-red-500" },
};

function StatListModal({ filter, students, onClose }: {
  filter: StatFilter;
  students: StudentRow[];
  onClose: () => void;
}) {
  const filtered = students.filter(s => {
    if (filter === "all")     return true;
    if (filter === "paid")    return s.payment?.status === "PAID";
    if (filter === "overdue") return s.payment?.status === "OVERDUE";
    if (filter === "pending") return !s.payment || s.payment.status === "PENDING";
    if (filter === "revenue") return (s.payment?.paidAmount ?? 0) > 0;
    if (filter === "debt")    return (s.payment?.balance ?? 0) > 0;
    return false;
  });

  const cfg = FILTER_CONFIG[filter];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <div>
            <h3 className={`font-bold text-base ${cfg.color}`}>{cfg.label}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{filtered.length} nxënës</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-12">Asnjë nxënës</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((s, i) => {
                const phoneProminent = filter === "overdue" || filter === "debt";
                return (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <span className="text-xs text-slate-300 dark:text-slate-600 w-5 flex-shrink-0 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate">
                        {s.firstName} {s.lastName}
                        {s.class && (
                          <span className="ml-2 text-xs font-normal text-primary-500 dark:text-primary-400">{s.class.name}</span>
                        )}
                      </p>
                      {phoneProminent && (
                        s.parentPhone ? (
                          <a href={`tel:${s.parentPhone}`}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline mt-0.5"
                            onClick={e => e.stopPropagation()}>
                            <Phone className="w-3 h-3" />
                            {s.parentPhone}
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-300 dark:text-slate-600 mt-0.5">
                            <Phone className="w-3 h-3" /> Pa numër
                          </span>
                        )
                      )}
                    </div>
                    {(filter === "revenue" || filter === "debt") && s.payment && (
                      <span className={`text-sm font-bold flex-shrink-0 ${filter === "debt" ? "text-red-500" : "text-green-600"}`}>
                        {filter === "revenue"
                          ? formatCurrency(s.payment.paidAmount)
                          : formatCurrency(s.payment.balance)}
                      </span>
                    )}
                    {!phoneProminent && (
                      s.parentPhone ? (
                        <a href={`tel:${s.parentPhone}`}
                          className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline flex-shrink-0"
                          onClick={e => e.stopPropagation()}>
                          {s.parentPhone}
                        </a>
                      ) : (
                        <span className="text-xs text-slate-300 dark:text-slate-600 flex-shrink-0">—</span>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

