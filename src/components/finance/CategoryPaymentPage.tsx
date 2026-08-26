"use client";

import React, { useEffect, useState, useCallback, useRef } from "react";
import Header from "@/components/layout/Header";
import Link from "next/link";
import { formatCurrency, formatDate, getStatusColor, getStatusLabel, MONTHS } from "@/lib/utils";
import { CYCLES, getCycle } from "@/lib/school-cycles";
import { ACADEMIC_YEARS, CALENDAR_YEARS, DEFAULT_ACADEMIC_YEAR, type YearType } from "@/lib/academicYear";

const PAYMENT_PLANS: { value: string; label: string }[] = [
  { value: "FULL",         label: "E plotë" },
  { value: "TWO",          label: "Dy pjesë" },
  { value: "MONTHLY",      label: "Me këste" },
  { value: "TIMI_INVEST",  label: "Përmes Timi Invest" },
];
const PAYMENT_PLAN_LABELS: Record<string, string> = Object.fromEntries(PAYMENT_PLANS.map(p => [p.value, p.label]));
import {
  Search, CheckCircle, AlertCircle, Clock,
  Plus, X, Save, Users, Loader2, Printer,
  TrendingUp, TrendingDown, ArrowLeftRight, FileUp,
  CalendarDays, Download, Trash2, Calculator, Lock, StickyNote,
} from "lucide-react";
import * as XLSX from "xlsx";
import InvoicePrintModal from "./InvoicePrintModal";
import PaymentReceiptModal from "./PaymentReceiptModal";
import ExpensesSection from "./ExpensesSection";

interface Payment {
  id: number;
  amount: number;
  finalAmount: number;
  paidAmount: number;
  balance: number;
  status: string;
  method: string | null;
  dueDate: string;
  paidDate: string | null;
  discount: number;
  discountType: string | null;
  scholarship: number;
  description: string | null;
  note: string | null;
  receiptNumber: string | null;
}

interface StudentRow {
  id: number;
  firstName: string;
  lastName: string;
  class: { id: number; name: string } | null;
  discountPct: number;
  paymentPlan: string | null;
  status: string;
  inactiveDate: string | null;
  payment: Payment | null;        // aggregated (for table stats)
  installments: Payment[];        // raw (0, 1, or 2 records)
  timiInvest: { id: number; regularPrice: number; discountPct: number; manualDiscAmt: number } | null;
}

interface Stats {
  total: number;
  paid: number;
  partial: number;
  overdue: number;
  pending: number;
  totalRevenue: number;
  totalDebt: number;
}

interface Category {
  id: number;
  name: string;
  type: string;
  defaultAmount: number;
}

interface Props {
  categoryName: string;
  title: string;
  icon: React.ReactNode;
  color: string;
  isMonthly?: boolean;
  showCalculator?: boolean;
  singlePaymentOnly?: boolean; // vetëm "Pagesë e plotë" — pa Dy Këste / Çdo Muaj (p.sh. Eshkollori, shumë fikse vjetore)
}

type Tab = "income" | "expense" | "handover";

function exportStudentsExcel(
  students: StudentRow[],
  stats: Stats | null,
  title: string,
  month: number,
  year: number,
  isMonthly: boolean,
) {
  const wb = XLSX.utils.book_new();
  const today = formatDate(new Date());
  const period = isMonthly && month > 0
    ? `${MONTHS[month - 1]} ${year > 0 ? year : ""}`
    : year > 0 ? String(year) : "Të gjitha";

  // Sheet 1: Lista nxënësve
  const rows: (string | number)[][] = [
    [`${title} — ${period}`, "", "", "", "", "", ""],
    ["#", "Emri", "Mbiemri", "Klasa", "Shuma (€)", "Paguar (€)", "Borxhi (€)", "Statusi"],
    ...students.map((s, i) => [
      i + 1,
      s.firstName,
      s.lastName,
      s.class?.name ?? "—",
      s.payment?.finalAmount ?? 0,
      s.payment?.paidAmount ?? 0,
      s.payment?.balance ?? 0,
      s.payment
        ? (s.payment.status === "PAID" ? "Paguar"
          : s.payment.status === "PARTIAL" ? "Pjesërisht"
          : s.payment.status === "OVERDUE" ? "Vonuar"
          : "Pa pagesë")
        : "Pa pagesë",
    ]),
  ];

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws["!cols"] = [
    { wch: 5 }, { wch: 18 }, { wch: 18 }, { wch: 8 },
    { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, "Lista");

  // Sheet 2: Përmbledhje
  if (stats) {
    const summary = [
      [`RAPORTI — ${title}`, "", today],
      [],
      ["Gjithsej nxënës", stats.total],
      ["Paguar", stats.paid],
      ["Pjesërisht", stats.partial],
      ["Vonuar", stats.overdue],
      ["Pa pagesë", stats.pending],
      [],
      ["Të ardhura totale (€)", stats.totalRevenue],
      ["Borxh total (€)", stats.totalDebt],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(summary);
    ws2["!cols"] = [{ wch: 26 }, { wch: 16 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Permbledhje");
  }

  const filename = `${title.replace(/\s+/g, "-")}-${period.replace(/\s+/g, "-")}-${today.replace(/\//g, "-")}.xlsx`;
  XLSX.writeFile(wb, filename);
}

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "income",   label: "Të Hyra",         icon: <TrendingUp    className="w-4 h-4" /> },
  { key: "expense",  label: "Shpenzime",        icon: <TrendingDown  className="w-4 h-4" /> },
  { key: "handover", label: "Dorezim Parash",   icon: <ArrowLeftRight className="w-4 h-4" /> },
];

export default function CategoryPaymentPage({ categoryName, title, icon, color, isMonthly = true, showCalculator = false, singlePaymentOnly = false }: Props) {
  const [month, setMonth] = useState(0); // 0 = "Të gjitha" → by default shfaq pasqyrën e plotë të vitit akademik
  const [year,  setYear]  = useState(DEFAULT_ACADEMIC_YEAR);
  const [yearType, setYearType] = useState<YearType>("academic");
  const [search,  setSearch]  = useState("");
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [stats,    setStats]   = useState<Stats | null>(null);
  const [category, setCategory] = useState<Category | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [modal,        setModal]        = useState<StudentRow | null>(null);
  const [printModal,   setPrintModal]   = useState<StudentRow | null>(null);
  const [receiptPaymentId, setReceiptPaymentId] = useState<number | null>(null);
  const [pickerOpen,       setPickerOpen]       = useState(false);
  const [calcModal,        setCalcModal]        = useState<StudentRow | null>(null);
  const [calcAmount,       setCalcAmount]       = useState<number | undefined>();
  const [tab,          setTab]          = useState<Tab>("income");
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [sortCol,  setSortCol]  = useState<string | null>(null);
  const [sortDir,  setSortDir]  = useState<"asc" | "desc">("asc");
  const [colKlasa,  setColKlasa]  = useState("");
  const [colMetoda, setColMetoda] = useState("");
  const [colCikli,  setColCikli]  = useState("");
  const [colPlan,   setColPlan]   = useState("");
  const [colBorxhi, setColBorxhi] = useState("");
  const [timiInvestEnabled, setTimiInvestEnabled] = useState(true);

  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(s => setTimiInvestEnabled(s.timiInvestEnabled !== "false"));
  }, []);

  function toggleSort(col: string) {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
  }
  function SortIcon({ col }: { col: string }) {
    if (sortCol !== col) return <span className="text-slate-300 ml-1 text-[10px]">⇅</span>;
    return <span className="text-primary-500 ml-1 text-[10px]">{sortDir === "asc" ? "▲" : "▼"}</span>;
  }

  // "year" përfaqëson vitin fillestar akademik (p.sh. 2025 = "2025–2026") kur yearType="academic",
  // ose thjesht vitin kalendarik kur yearType="calendar".
  // resolvedYear = viti kalendarik konkret që i përgjigjet muajit të zgjedhur (për query/etiketa).
  // schoolYearStart = viti fillestar i vitit shkollor, gjithmonë i saktë pavarësisht yearType-it
  // (përdoret nga calcProrated dhe PaymentModal, që tashmë presin vitin fillestar shkollor).
  const resolvedYear = year <= 0 ? 0
    : yearType === "academic"
      ? (month > 0 ? (month >= 9 ? year : year + 1) : year)
      : year;
  const schoolYearStart = year <= 0 ? 0
    : yearType === "academic"
      ? year
      : (month > 0 && month <= 8 ? year - 1 : year);

  function switchYearType(yt: YearType) {
    if (year > 0) setYear(yt === "academic" ? schoolYearStart : resolvedYear);
    setYearType(yt);
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ category: categoryName, search });
    // month=0 → "Të gjitha" → omit month param
    if (isMonthly && month > 0) params.set("month", String(month));
    // year=0 → "Të gjitha" → omit year param
    if (resolvedYear > 0) {
      params.set("year", String(resolvedYear));
      // "Të gjitha" muajt + vit akademik → API duhet të përfshijë të dy vitet kalendarike (Shtator–Gusht).
      // Vetëm për kategoritë me muaj (isMonthly) — kategoritë pa muaj (p.sh. Eshkollori) s'kanë fushën
      // "month" të populluar (null), ndaj filtri OR sipas muajit s'i gjen kurrë ato pagesa.
      if (isMonthly && !(month > 0) && yearType === "academic") params.set("yearType", "academic");
    }
    const res = await fetch(`/api/category-payments?${params}`);
    if (res.ok) {
      const d = await res.json();
      setStudents(d.students);
      setStats(d.stats);
      setCategory(d.category);
    }
    setLoading(false);
  }, [categoryName, month, resolvedYear, yearType, search, isMonthly]);

  const _firstRender = useRef(true);
  useEffect(() => {
    const delay = _firstRender.current ? 0 : 300;
    _firstRender.current = false;
    const t = setTimeout(fetchData, delay);
    return () => clearTimeout(t);
  }, [fetchData]);

  const statusOrder = ["OVERDUE", "PARTIAL", "PENDING", "PAID"];
  const activeStudents   = students.filter(s => s.status !== "INACTIVE");
  const inactiveStudents = students.filter(s => s.status === "INACTIVE");

  // Vlerat unike për dropdown filtrat
  const uniqueKlasa  = [...new Set(students.map(s => s.class?.name).filter(Boolean) as string[])].sort();
  const uniqueMetoda = [...new Set(students.flatMap(s =>
    s.installments.length ? s.installments.map(p => p.method).filter(Boolean) : [s.payment?.method].filter(Boolean)
  ) as string[])].sort();

  function applyColFilters(list: StudentRow[]) {
    return list
      .filter(s => !colKlasa  || s.class?.name === colKlasa)
      .filter(s => !colCikli  || getCycle(s.class?.name) === colCikli)
      .filter(s => !colPlan   || s.paymentPlan === colPlan)
      .filter(s => !colMetoda || s.payment?.method === colMetoda ||
        s.installments.some(p => p.method === colMetoda))
      .filter(s => {
        if (!colBorxhi) return true;
        const st = s.payment?.status || "PENDING";
        if (colBorxhi === "DEBT")    return st !== "PAID";
        if (colBorxhi === "FULL")    return st === "PENDING" || st === "OVERDUE";
        if (colBorxhi === "PARTIAL") return st === "PARTIAL";
        return true;
      });
  }

  async function savePaymentPlan(studentId: number, plan: string) {
    setStudents(prev => prev.map(s => s.id === studentId ? { ...s, paymentPlan: plan || null } : s));
    await fetch(`/api/students/${studentId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ paymentPlan: plan || null }),
    });
  }

  function applySort(list: StudentRow[]) {
    if (!sortCol) return list;
    return [...list].sort((a, b) => {
      const base = category?.defaultAmount ?? 0;
      const expA = Math.round(base * (1 - (a.discountPct ?? 0) / 100));
      const expB = Math.round(base * (1 - (b.discountPct ?? 0) / 100));
      let av = 0, bv = 0;
      if (sortCol === "shuma")  { av = a.payment?.finalAmount ?? expA; bv = b.payment?.finalAmount ?? expB; }
      if (sortCol === "paguar") { av = a.payment?.paidAmount  ?? 0;    bv = b.payment?.paidAmount  ?? 0; }
      if (sortCol === "borxhi") { av = a.payment?.balance     ?? expA; bv = b.payment?.balance     ?? expB; }
      if (sortCol === "data") {
        av = new Date(a.payment?.paidDate || a.payment?.dueDate || 0).getTime();
        bv = new Date(b.payment?.paidDate || b.payment?.dueDate || 0).getTime();
      }
      return sortDir === "asc" ? av - bv : bv - av;
    });
  }

  const filteredActives = applyColFilters(
    activeStudents.filter(s => {
      if (!statusFilter) return true;
      if (statusFilter === "NONE") return !s.payment;
      if (statusFilter === "WITH_PAYMENT") return !!s.payment && s.payment.paidAmount > 0;
      return (s.payment?.status || "PENDING") === statusFilter;
    })
  );
  const sortedActives = applySort(
    [...filteredActives].sort((a, b) => {
      if (sortCol) return 0; // sort handled by applySort
      const ai = statusOrder.indexOf(a.payment?.status || "PENDING");
      const bi = statusOrder.indexOf(b.payment?.status || "PENDING");
      return ai - bi;
    })
  );

  const sorted = [
    ...sortedActives,
    ...applyColFilters(inactiveStudents), // joaktivët gjithmonë në fund
  ];

  const totalPaidVisible = sorted.reduce((sum, s) => sum + (s.payment?.paidAmount ?? 0), 0);
  const totalDebtVisible = sorted.reduce((sum, s) => {
    if (!s.payment) return sum + Math.round((category?.defaultAmount ?? 0) * (1 - (s.discountPct ?? 0) / 100));
    if (s.payment.status === "PAID") return sum;
    return sum + s.payment.balance;
  }, 0);

  // Mesatare e ponderuar: vetëm nxënës AKTIV
  const weightedAvgData = (() => {
    if (!activeStudents.length || !category) return null;
    const base = category.defaultAmount;
    const groups: Record<number, number> = {};
    let totalExpected = 0;
    for (const s of activeStudents) {
      const price = s.payment?.finalAmount ?? Math.round(base * (1 - (s.discountPct ?? 0) / 100));
      groups[price] = (groups[price] ?? 0) + 1;
      totalExpected += price;
    }
    const avg = Math.round((totalExpected / activeStudents.length) * 100) / 100;
    return { avg, groups, totalExpected };
  })();

  return (
    <>
      <Header title={title} />
      <div className="p-4 sm:p-6 space-y-5 animate-fade-in">

        {/* Tab bar + shared filters */}
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

          <Link href="/payments/import" className="btn-secondary text-sm" title="Import pagesa nga Excel">
            <FileUp className="w-4 h-4" />
            Import Excel
          </Link>

          <button
            onClick={() => exportStudentsExcel(students, stats, title, month, resolvedYear, isMonthly)}
            className="btn-secondary text-sm"
            title="Exporto në Excel"
          >
            <Download className="w-4 h-4" />
            Exporto Excel
          </button>

          {tab === "income" && (
            <button
              onClick={() => setPickerOpen(true)}
              className="btn-primary text-sm"
            >
              <Plus className="w-4 h-4" />
              Regjistro Pagesë
            </button>
          )}

          <div className="flex items-center gap-2 ml-auto">
            <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 text-xs font-semibold flex-shrink-0">
              {([["academic", "🎓 Akademik"], ["calendar", "📅 Kalendarik"]] as [YearType, string][]).map(([yt, lbl]) => (
                <button
                  key={yt}
                  onClick={() => switchYearType(yt)}
                  className={`px-2.5 py-2 transition-colors ${
                    yearType === yt
                      ? "bg-primary-600 text-white"
                      : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
            {isMonthly && (
              <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="form-input w-36">
                <option value={0}>Të gjitha</option>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            )}
            <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="form-input w-28">
              <option value={0}>Të gjitha</option>
              {(yearType === "academic" ? ACADEMIC_YEARS : CALENDAR_YEARS).map(y => (
                <option key={y} value={y}>{yearType === "academic" ? `${y}–${y + 1}` : y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── INCOME TAB ── */}
        {tab === "income" && (
          <>
            {stats && (
              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
                <div
                  onClick={() => setStatusFilter("")}
                  className={`card p-3 cursor-pointer transition-all hover:shadow-md ${statusFilter === "" ? "ring-2 ring-slate-400" : "opacity-80 hover:opacity-100"}`}
                  title="Shfaq të gjithë"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-700 flex items-center justify-center">
                      <Users className="w-4 h-4 text-slate-600 dark:text-slate-300" />
                    </div>
                    <span className="text-xs text-slate-400">Gjithsej</span>
                    {statusFilter === "" && <span className="ml-auto text-[10px] bg-slate-200 dark:bg-slate-600 text-slate-600 dark:text-slate-300 px-1.5 rounded-full font-medium">Aktiv</span>}
                  </div>
                  <p className="text-xl font-bold text-slate-700 dark:text-slate-200">{stats.total}</p>
                </div>

                <div
                  onClick={() => setStatusFilter(f => f === "PAID" ? "" : "PAID")}
                  className={`card p-3 cursor-pointer transition-all hover:shadow-md ${statusFilter === "PAID" ? "ring-2 ring-green-400" : "opacity-80 hover:opacity-100"}`}
                  title="Filtro: Paguar"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="text-xs text-slate-400">Paguar</span>
                    {statusFilter === "PAID" && <span className="ml-auto text-[10px] bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-1.5 rounded-full font-medium">Aktiv</span>}
                  </div>
                  <p className="text-xl font-bold text-green-600 dark:text-green-400">{stats.paid}</p>
                </div>

                <div
                  onClick={() => setStatusFilter(f => f === "PARTIAL" ? "" : "PARTIAL")}
                  className={`card p-3 cursor-pointer transition-all hover:shadow-md ${statusFilter === "PARTIAL" ? "ring-2 ring-blue-400" : "opacity-80 hover:opacity-100"}`}
                  title="Filtro: Pjesërisht"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                      <Clock className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                    </div>
                    <span className="text-xs text-slate-400">Pjesërisht</span>
                    {statusFilter === "PARTIAL" && <span className="ml-auto text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 px-1.5 rounded-full font-medium">Aktiv</span>}
                  </div>
                  <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{stats.partial}</p>
                </div>

                <div
                  onClick={() => setStatusFilter(f => f === "OVERDUE" ? "" : "OVERDUE")}
                  className={`card p-3 cursor-pointer transition-all hover:shadow-md ${statusFilter === "OVERDUE" ? "ring-2 ring-red-400" : "opacity-80 hover:opacity-100"}`}
                  title="Filtro: Vonuar"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                      <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </div>
                    <span className="text-xs text-slate-400">Vonuar</span>
                    {statusFilter === "OVERDUE" && <span className="ml-auto text-[10px] bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 px-1.5 rounded-full font-medium">Aktiv</span>}
                  </div>
                  <p className="text-xl font-bold text-red-600 dark:text-red-400">{stats.overdue}</p>
                </div>

                <div
                  onClick={() => setStatusFilter(f => f === "WITH_PAYMENT" ? "" : "WITH_PAYMENT")}
                  className={`card p-3 cursor-pointer transition-all hover:shadow-md ${statusFilter === "WITH_PAYMENT" ? "ring-2 ring-emerald-400" : "opacity-80 hover:opacity-100"}`}
                  title="Filtro: Të gjitha me pagesë (Paguar + Pjesërisht)"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-7 h-7 rounded-lg bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center">
                      <CheckCircle className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <span className="text-xs text-slate-400 whitespace-nowrap">Me pagesë</span>
                    {statusFilter === "WITH_PAYMENT" && <span className="ml-auto text-[10px] bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 px-1.5 rounded-full font-medium">Aktiv</span>}
                  </div>
                  <p className="text-xl font-bold text-emerald-600 dark:text-emerald-400">{stats.paid + stats.partial}</p>
                </div>

                <div className="card p-3 sm:col-span-2">
                  <p className="text-xs text-slate-400 mb-0.5">Të Hyra</p>
                  <p className="text-lg font-bold text-green-600">{formatCurrency(stats.totalRevenue)}</p>
                </div>
                <div className="card p-3 sm:col-span-2 lg:col-span-2 hidden lg:block">
                  <p className="text-xs text-slate-400 mb-0.5">Borxhe</p>
                  <p className="text-lg font-bold text-red-500">{formatCurrency(stats.totalDebt)}</p>
                </div>

                <div className="card p-3 sm:col-span-2 lg:col-span-2">
                  <p className="text-xs text-slate-400 mb-2">Mesatarja e Ponderuar</p>
                  {weightedAvgData ? (
                    <div className="space-y-1.5">
                      {/* Grupet e çmimeve: çmimi × nxënës */}
                      <div className="space-y-0.5 max-h-20 overflow-y-auto pr-1">
                        {Object.entries(weightedAvgData.groups)
                          .sort(([a], [b]) => Number(b) - Number(a))
                          .map(([price, count]) => (
                            <div key={price} className="flex justify-between items-center text-[11px]">
                              <span className="text-slate-500">
                                {formatCurrency(Number(price))} × <span className="font-medium text-slate-700 dark:text-slate-300">{count}</span> nxënës
                              </span>
                              <span className="text-slate-400 font-mono">
                                = {formatCurrency(Number(price) * count)}
                              </span>
                            </div>
                          ))}
                      </div>
                      <div className="border-t border-slate-100 dark:border-slate-700 pt-1.5 space-y-0.5">
                        <div className="flex justify-between items-center text-[11px] text-slate-400">
                          <span>Σ / {stats.total} nxënës</span>
                          <span className="font-mono">{formatCurrency(weightedAvgData.totalExpected)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-xs font-semibold text-slate-600 dark:text-slate-300">Mesatare e ponderuar</span>
                          <span className="font-bold text-amber-600 dark:text-amber-400 text-sm">
                            {formatCurrency(weightedAvgData.avg)}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">—</p>
                  )}
                </div>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Kërko nxënësin..."
                  className="form-input pl-9"
                />
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {statusFilter && (
                  <button onClick={() => setStatusFilter("")}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 hover:bg-primary-100 transition-colors">
                    <X className="w-3 h-3" />
                    {statusFilter === "PAID" ? "Paguar" : statusFilter === "PARTIAL" ? "Pjesërisht" : statusFilter === "OVERDUE" ? "Vonuar" : statusFilter === "WITH_PAYMENT" ? "Me pagesë" : "Filtri"}
                  </button>
                )}
                {colKlasa && (
                  <button onClick={() => setColKlasa("")}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-colors">
                    <X className="w-3 h-3" />Klasa: {colKlasa}
                  </button>
                )}
                {colCikli && (
                  <button onClick={() => setColCikli("")}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-indigo-50 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-100 transition-colors">
                    <X className="w-3 h-3" />
                    {CYCLES.find(c => c.value === colCikli)?.label ?? colCikli}
                  </button>
                )}
                {colPlan && (
                  <button onClick={() => setColPlan("")}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-100 transition-colors">
                    <X className="w-3 h-3" />
                    {PAYMENT_PLAN_LABELS[colPlan] ?? colPlan}
                  </button>
                )}
                {colMetoda && (
                  <button onClick={() => setColMetoda("")}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-100 transition-colors">
                    <X className="w-3 h-3" />
                    {colMetoda === "CASH" ? "Cash" : colMetoda === "BANK" ? "Bankë" : colMetoda === "CARD" ? "Kartelë" : colMetoda}
                  </button>
                )}
                {colBorxhi && (
                  <button onClick={() => setColBorxhi("")}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300 hover:bg-red-100 transition-colors">
                    <X className="w-3 h-3" />
                    {colBorxhi === "DEBT" ? "Me borxh" : colBorxhi === "FULL" ? "Borxh total" : "Borxh në pjesë"}
                  </button>
                )}
                {sortCol && (
                  <button onClick={() => { setSortCol(null); setSortDir("asc"); }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors">
                    <X className="w-3 h-3" />
                    Sort: {sortCol} {sortDir === "asc" ? "▲" : "▼"}
                  </button>
                )}
                <span className="text-sm text-slate-400">
                  {sorted.length}{(statusFilter || colKlasa || colCikli || colPlan || colMetoda || colBorxhi) ? ` / ${students.length}` : ""} nxënës
                </span>
              </div>
            </div>

            {stats && stats.total > 0 && (
              <div className="card p-3 flex items-center gap-3">
                <span className="text-xs text-slate-400 w-20 flex-shrink-0">Pagesa</span>
                <div className="flex-1 h-2.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex">
                  <div className="bg-green-500 h-full transition-all" style={{ width: `${(stats.paid    / stats.total) * 100}%` }} />
                  <div className="bg-blue-400 h-full transition-all"  style={{ width: `${(stats.partial / stats.total) * 100}%` }} />
                  <div className="bg-red-400  h-full transition-all"  style={{ width: `${(stats.overdue / stats.total) * 100}%` }} />
                </div>
                <span className="text-xs font-semibold text-slate-600 dark:text-slate-300 w-12 text-right">
                  {Math.round(((stats.paid + stats.partial) / stats.total) * 100)}%
                </span>
              </div>
            )}

            {/* Student table */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="table-header w-8">#</th>
                      <th className="table-header">Nxënësi</th>

                      {/* KLASA + CIKLI — dropdown filters */}
                      <th className="table-header p-0">
                        <div className="flex items-center gap-1 px-3 py-2">
                          <span>Klasa</span>
                          <select
                            value={colKlasa}
                            onChange={e => setColKlasa(e.target.value)}
                            className="ml-1 text-[10px] border border-slate-200 dark:border-slate-600 rounded px-1 py-0.5 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-400 cursor-pointer"
                            title="Filtro sipas klasës"
                          >
                            <option value="">Të gjitha</option>
                            {uniqueKlasa.map(k => <option key={k} value={k}>{k}</option>)}
                          </select>
                          {colKlasa && <button onClick={() => setColKlasa("")} className="text-red-400 hover:text-red-600 text-[10px]">✕</button>}
                          <select
                            value={colCikli}
                            onChange={e => setColCikli(e.target.value)}
                            className="ml-1 text-[10px] border border-slate-200 dark:border-slate-600 rounded px-1 py-0.5 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-400 cursor-pointer"
                            title="Filtro sipas ciklit"
                          >
                            <option value="">Cikli: të gjithë</option>
                            {CYCLES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                          </select>
                          {colCikli && <button onClick={() => setColCikli("")} className="text-red-400 hover:text-red-600 text-[10px]">✕</button>}
                        </div>
                      </th>

                      {/* MENYRA E PAGESES — dropdown filter */}
                      <th className="table-header p-0">
                        <div className="flex items-center gap-1 px-3 py-2">
                          <span>Mënyra e Pagesës</span>
                          <select
                            value={colPlan}
                            onChange={e => setColPlan(e.target.value)}
                            className="ml-1 text-[10px] border border-slate-200 dark:border-slate-600 rounded px-1 py-0.5 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-400 cursor-pointer"
                            title="Filtro sipas mënyrës së pagesës"
                          >
                            <option value="">Të gjitha</option>
                            {PAYMENT_PLANS.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                          </select>
                          {colPlan && <button onClick={() => setColPlan("")} className="text-red-400 hover:text-red-600 text-[10px]">✕</button>}
                        </div>
                      </th>

                      {/* SHUMA — sortable */}
                      <th className="table-header cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => toggleSort("shuma")}>
                        <div className="flex items-center gap-1">Shuma <SortIcon col="shuma" /></div>
                      </th>

                      {/* PAGUAR — sortable */}
                      <th className="table-header cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => toggleSort("paguar")}>
                        <div className="flex items-center gap-1">Paguar <SortIcon col="paguar" /></div>
                      </th>

                      {/* BORXHI — sortable + dropdown filter */}
                      <th className="table-header p-0">
                        <div className="flex items-center gap-1 px-3 py-2">
                          <span className="cursor-pointer select-none flex items-center gap-1" onClick={() => toggleSort("borxhi")}>
                            Borxhi <SortIcon col="borxhi" />
                          </span>
                          <select
                            value={colBorxhi}
                            onChange={e => setColBorxhi(e.target.value)}
                            className="ml-1 text-[10px] border border-slate-200 dark:border-slate-600 rounded px-1 py-0.5 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-400 cursor-pointer"
                            title="Filtro sipas borxhit"
                          >
                            <option value="">Të gjitha</option>
                            <option value="DEBT">Me borxh</option>
                            <option value="FULL">Borxh total</option>
                            <option value="PARTIAL">Borxh në pjesë</option>
                          </select>
                          {colBorxhi && <button onClick={() => setColBorxhi("")} className="text-red-400 hover:text-red-600 text-[10px]">✕</button>}
                        </div>
                      </th>

                      {/* METODA — dropdown filter */}
                      <th className="table-header p-0">
                        <div className="flex items-center gap-1 px-3 py-2">
                          <span>Metoda</span>
                          <select
                            value={colMetoda}
                            onChange={e => setColMetoda(e.target.value)}
                            className="ml-1 text-[10px] border border-slate-200 dark:border-slate-600 rounded px-1 py-0.5 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-400 cursor-pointer"
                            title="Filtro sipas metodës"
                          >
                            <option value="">Të gjitha</option>
                            {uniqueMetoda.map(m => (
                              <option key={m} value={m}>
                                {m === "CASH" ? "Cash" : m === "BANK" ? "Bankë" : m === "CARD" ? "Kartelë" : m === "ONLINE" ? "Online" : m}
                              </option>
                            ))}
                          </select>
                          {colMetoda && <button onClick={() => setColMetoda("")} className="text-red-400 hover:text-red-600 text-[10px]">✕</button>}
                        </div>
                      </th>

                      {/* DATA — sortable */}
                      <th className="table-header cursor-pointer select-none hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors" onClick={() => toggleSort("data")}>
                        <div className="flex items-center gap-1">Data / Afati <SortIcon col="data" /></div>
                      </th>

                      <th className="table-header">Statusi</th>
                      <th className="table-header text-right">Veprime</th>
                      <th className="table-header w-10"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {loading ? (
                      <tr>
                        <td colSpan={12} className="py-16 text-center">
                          <Loader2 className="w-6 h-6 animate-spin text-primary-400 mx-auto" />
                        </td>
                      </tr>
                    ) : sorted.length === 0 ? (
                      <tr>
                        <td colSpan={12} className="py-16 text-center text-slate-400 text-sm">
                          Asnjë nxënës nuk u gjet
                        </td>
                      </tr>
                    ) : sorted.map((s, i) => {
                      const p = s.payment;
                      const isInactive = s.status === "INACTIVE";
                      const isFirstInactive = isInactive && (i === 0 || sorted[i - 1]?.status !== "INACTIVE");
                      const hasMonthly = s.installments.some(p => p.description?.startsWith("MUAJI_"));
                      const hasFlex = s.installments.some(p => p.description?.startsWith("FLEX_"));
                      const hasTwo = !hasMonthly && !hasFlex && s.installments.length >= 2;
                      const rowNote = s.payment?.note ?? s.installments.find(p => p.note)?.note ?? null;
                      const k1 = hasTwo ? s.installments[0] : null;
                      const k2 = hasTwo ? s.installments[1] : null;
                      const statusKey = p?.status || "PENDING";
                      const basePrice = category?.defaultAmount ?? 0;
                      const expectedPrice = Math.round(basePrice * (1 - (s.discountPct ?? 0) / 100));
                      const debt = p?.status === "PAID" ? 0 : p ? p.balance : expectedPrice;

                      // Pro-rate për joaktivët
                      const prorated = isInactive && s.inactiveDate && basePrice > 0 && year > 0
                        ? calcProrated(basePrice, s.discountPct ?? 0, new Date(s.inactiveDate), schoolYearStart)
                        : null;

                      const rowBg = isInactive
                        ? "bg-slate-50/80 dark:bg-slate-800/20 opacity-70"
                        : statusKey === "OVERDUE" ? "bg-red-50/40 dark:bg-red-900/10" : "";

                      return (
                        <React.Fragment key={s.id}>
                        {isFirstInactive && inactiveStudents.length > 0 && (
                          <tr>
                            <td colSpan={12} className="px-4 py-1.5 bg-slate-100 dark:bg-slate-800/60 border-t-2 border-slate-300 dark:border-slate-600">
                              <span className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-widest">
                                ✕ Joaktiv — {inactiveStudents.length} nxënës · të përjashtuar nga statistikat dhe mesatarja
                              </span>
                            </td>
                          </tr>
                        )}
                        <tr className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${rowBg}`}>
                          <td className="table-cell text-slate-400 text-xs">{i + 1}</td>
                          <td className="table-cell">
                            <div className="flex items-center gap-2 flex-wrap">
                              <Link href={`/students/${s.id}`} className={`font-semibold hover:text-primary-600 dark:hover:text-primary-400 ${isInactive ? "text-slate-400 dark:text-slate-500 line-through" : "text-slate-900 dark:text-white"}`}>
                                {s.firstName} {s.lastName}
                              </Link>
                              {isInactive && (
                                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-slate-200 dark:bg-slate-700 text-slate-500 dark:text-slate-400 text-[10px] font-semibold">
                                  ✕ Joaktiv
                                  {s.inactiveDate && (
                                    <span className="text-slate-400">
                                      {formatDate(s.inactiveDate)}
                                    </span>
                                  )}
                                </span>
                              )}
                              {timiInvestEnabled && s.timiInvest && (() => {
                                const tiPrice = Math.max(0, s.timiInvest.regularPrice * (1 - s.timiInvest.discountPct / 100) - (s.timiInvest.manualDiscAmt || 0));
                                return (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 text-[10px] font-semibold" title={`Çmimi TI: ${tiPrice.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`}>
                                    ● TI {tiPrice > 0 ? `${tiPrice.toLocaleString("de-DE", { minimumFractionDigits: 0 })} €` : ""}
                                  </span>
                                );
                              })()}
                            </div>
                            {hasMonthly && (
                              <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400 px-1.5 py-0.5 rounded font-medium">
                                <CalendarDays className="w-3 h-3" />
                                {s.installments.length} muaj
                              </span>
                            )}
                            {hasTwo && (
                              <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 px-1.5 py-0.5 rounded font-medium">
                                <CalendarDays className="w-3 h-3" />
                                2 këste
                              </span>
                            )}
                            {hasFlex && (
                              <span className="ml-2 inline-flex items-center gap-0.5 text-[10px] bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 px-1.5 py-0.5 rounded font-medium">
                                <CalendarDays className="w-3 h-3" />
                                {s.installments.length} pagesa
                              </span>
                            )}
                            {rowNote && (
                              <span className="ml-2 inline-flex" title={rowNote}>
                                <StickyNote className="w-3.5 h-3.5 text-amber-500 dark:text-amber-400 shrink-0" />
                              </span>
                            )}
                          </td>
                          <td className="table-cell">
                            {s.class
                              ? <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded text-xs font-medium">{s.class.name}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="table-cell">
                            <select
                              value={s.paymentPlan ?? ""}
                              onChange={e => savePaymentPlan(s.id, e.target.value)}
                              onClick={e => e.stopPropagation()}
                              className="text-xs border border-slate-200 dark:border-slate-600 rounded px-1.5 py-1 bg-white dark:bg-slate-700 text-slate-600 dark:text-slate-300 focus:outline-none focus:ring-1 focus:ring-primary-400 cursor-pointer"
                            >
                              <option value="">— Pazgjedhur —</option>
                              {PAYMENT_PLANS.map(pl => <option key={pl.value} value={pl.value}>{pl.label}</option>)}
                            </select>
                          </td>
                          <td className="table-cell font-medium text-slate-800 dark:text-slate-200">
                            {isInactive && prorated ? (
                              <div>
                                <span className="font-semibold text-amber-600 dark:text-amber-400">
                                  {formatCurrency(prorated.amount)}
                                </span>
                                <p className="text-[10px] text-slate-400">
                                  {prorated.attended}/10 muaj
                                  {prorated.effectivePrice !== prorated.amount && (
                                    <span className="line-through ml-1">{formatCurrency(prorated.effectivePrice)}</span>
                                  )}
                                </p>
                              </div>
                            ) : p ? (
                              formatCurrency(p.finalAmount)
                            ) : basePrice > 0 ? (
                              <div>
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                  {formatCurrency(expectedPrice)}
                                </span>
                                {(s.discountPct ?? 0) > 0 && (
                                  <>
                                    <span className="ml-1 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                                      -{s.discountPct}%
                                    </span>
                                    <p className="text-[10px] text-slate-400 line-through">{formatCurrency(basePrice)}</p>
                                  </>
                                )}
                              </div>
                            ) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="table-cell text-green-600 dark:text-green-400 font-medium">
                            {p ? formatCurrency(p.paidAmount) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="table-cell">
                            {p?.status === "PAID" ? (
                              <span className="text-green-500 text-xs font-medium">✓ Pa borxh</span>
                            ) : p && p.balance > 0 ? (
                              <span className="text-red-600 dark:text-red-400 font-semibold">{formatCurrency(p.balance)}</span>
                            ) : !p && expectedPrice > 0 ? (
                              <span className="text-red-600 dark:text-red-400 font-semibold">{formatCurrency(expectedPrice)}</span>
                            ) : (
                              <span className="text-slate-300">—</span>
                            )}
                          </td>
                          <td className="table-cell text-slate-500 dark:text-slate-400 text-xs">
                            {hasTwo ? (
                              <div className="space-y-0.5">
                                {k1?.method && <div>K1: {getStatusLabel(k1.method)}</div>}
                                {k2?.method && <div>K2: {getStatusLabel(k2.method)}</div>}
                                {!k1?.method && !k2?.method && "—"}
                              </div>
                            ) : (
                              p?.method ? getStatusLabel(p.method) : "—"
                            )}
                          </td>
                          <td className="table-cell text-slate-400 text-xs">
                            {hasTwo && k1 && k2 ? (
                              <div className="space-y-0.5">
                                <div className="flex items-center gap-1">
                                  <span className="text-slate-400 w-6">K1:</span>
                                  {k1.paidDate
                                    ? <span className="text-green-600">{formatDate(k1.paidDate)}</span>
                                    : <span className="text-red-400">Afati {formatDate(k1.dueDate)}</span>}
                                </div>
                                <div className="flex items-center gap-1">
                                  <span className="text-slate-400 w-6">K2:</span>
                                  {k2.paidDate
                                    ? <span className="text-green-600">{formatDate(k2.paidDate)}</span>
                                    : <span className="text-red-400">Afati {formatDate(k2.dueDate)}</span>}
                                </div>
                              </div>
                            ) : p?.paidDate ? (
                              formatDate(p.paidDate)
                            ) : p?.dueDate ? (
                              <span className="text-red-400">Afati: {formatDate(p.dueDate)}</span>
                            ) : "—"}
                          </td>
                          <td className="table-cell">
                            {hasTwo && k1 && k2 ? (
                              <div className="space-y-1">
                                <span className={`badge text-[10px] ${getStatusColor(k1.status)}`}>
                                  K1 {getStatusLabel(k1.status)}
                                </span>
                                <span className={`badge text-[10px] ${getStatusColor(k2.status)}`}>
                                  K2 {getStatusLabel(k2.status)}
                                </span>
                              </div>
                            ) : (
                              <span className={`badge ${getStatusColor(statusKey)}`}>
                                {p ? getStatusLabel(statusKey) : "Pa pagesë"}
                              </span>
                            )}
                          </td>
                          <td className="table-cell text-right">
                            <button
                              onClick={() => setModal(s)}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                                p?.status === "PAID"
                                  ? "text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-700"
                                  : "bg-primary-600 hover:bg-primary-700 text-white"
                              }`}
                            >
                              <Plus className="w-3.5 h-3.5" />
                              {hasMonthly ? "Modifiko Muajt" : hasTwo ? "Modifiko Këste" : p ? (p.status === "PAID" ? "Modifiko" : "Plotëso") : "Shto"}
                            </button>
                          </td>
                          <td className="table-cell">
                            <div className="flex items-center gap-1">
                              {showCalculator && (
                                <button
                                  onClick={() => setCalcModal(s)}
                                  title="Kalkulator i Shkollimit"
                                  className="p-1.5 rounded-lg text-amber-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                                >
                                  <Calculator className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => setPrintModal(s)}
                                title="Gjenero faturë"
                                className="p-1.5 rounded-lg text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:text-slate-500 dark:hover:text-primary-400 transition-colors"
                              >
                                <Printer className="w-4 h-4" />
                              </button>
                              {(() => {
                                const receiptId = s.payment?.receiptNumber
                                  ? s.payment.id
                                  : s.installments.find(i => i.receiptNumber)?.id;
                                return receiptId ? (
                                  <button
                                    onClick={() => setReceiptPaymentId(receiptId)}
                                    title="Riprinto Dëshminë e Pagesës"
                                    className="p-1.5 rounded-lg text-emerald-400 hover:text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-colors"
                                  >
                                    <CheckCircle className="w-4 h-4" />
                                  </button>
                                ) : null;
                              })()}
                            </div>
                          </td>
                        </tr>
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                  {sorted.length > 0 && (
                    <tfoot className="bg-slate-50 dark:bg-slate-800/50 border-t-2 border-slate-200 dark:border-slate-600">
                      <tr>
                        <td className="table-cell text-xs font-bold text-slate-500 uppercase tracking-wide" colSpan={3}>
                          Total ({sorted.length} nxënës)
                        </td>
                        <td className="table-cell" />
                        <td className="table-cell font-bold text-emerald-600 dark:text-emerald-400">
                          {formatCurrency(totalPaidVisible)}
                        </td>
                        <td className="table-cell font-bold text-red-600 dark:text-red-400">
                          {totalDebtVisible > 0 ? formatCurrency(totalDebtVisible) : <span className="text-emerald-500 text-xs">✓ Pa borxh</span>}
                        </td>
                        <td colSpan={4} />
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </>
        )}

        {tab === "expense" && (
          <ExpensesSection categoryId={category?.id ?? null} type="EXPENSE" month={month} year={resolvedYear} />
        )}

        {tab === "handover" && (
          <ExpensesSection categoryId={category?.id ?? null} type="HANDOVER" month={month} year={resolvedYear} />
        )}
      </div>

      {modal && category && (
        <PaymentModal
          student={modal}
          category={category}
          month={isMonthly && month > 0 ? month : undefined}
          year={schoolYearStart}
          overrideAmount={calcAmount}
          singlePaymentOnly={singlePaymentOnly}
          onClose={() => { setModal(null); setCalcAmount(undefined); }}
          onSave={async (rid) => {
            setModal(null);
            setCalcAmount(undefined);
            await fetchData();
            if (rid) setReceiptPaymentId(rid);
          }}
        />
      )}

      {printModal && (
        <InvoicePrintModal
          student={printModal}
          payment={printModal.payment}
          categoryName={title}
          month={isMonthly && month > 0 ? month : undefined}
          year={resolvedYear}
          onClose={() => setPrintModal(null)}
        />
      )}

      {receiptPaymentId && (
        <PaymentReceiptModal
          paymentId={receiptPaymentId}
          onClose={() => setReceiptPaymentId(null)}
        />
      )}

      {pickerOpen && (
        <StudentPickerModal
          students={students}
          onSelect={(s) => { setPickerOpen(false); setModal(s); }}
          onClose={() => setPickerOpen(false)}
        />
      )}

      {calcModal && category && (
        <SchoolFeeCalculatorModal
          student={calcModal}
          categoryDefaultAmount={category.defaultAmount}
          onClose={() => setCalcModal(null)}
          onApply={(s, amount) => {
            setCalcModal(null);
            setCalcAmount(amount);
            setModal(s);
          }}
        />
      )}
    </>
  );
}

/* ─────────────────────────────────────────────────────────── */
/*  Student Picker Modal                                       */
/* ─────────────────────────────────────────────────────────── */
function StudentPickerModal({
  students, onSelect, onClose,
}: {
  students: StudentRow[];
  onSelect: (s: StudentRow) => void;
  onClose: () => void;
}) {
  const [q, setQ] = useState("");

  const filtered = students
    .filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(q.toLowerCase())
      || (s.class?.name || "").toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => a.lastName.localeCompare(b.lastName, "sq", { sensitivity: "base" }));

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>

        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Regjistro Pagesë</h3>
            <p className="text-xs text-slate-400 mt-0.5">Zgjidh nxënësin</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              autoFocus
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Kërko emrin ose klasën..."
              className="form-input pl-9 w-full"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-10">Asnjë nxënës u gjet</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(s => (
                <li key={s.id}>
                  <button
                    onClick={() => onSelect(s)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors text-left"
                  >
                    <div className="flex-1">
                      <p className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                        {s.firstName} {s.lastName}
                      </p>
                      {s.payment && (
                        <p className="text-xs text-slate-400 mt-0.5">
                          {s.payment.status === "PAID" ? "✓ Paguar" : `Borxh: ${s.payment.balance.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €`}
                        </p>
                      )}
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

function StatCard({ label, value, icon, bg, text }: {
  label: string; value: number; icon: React.ReactNode; bg: string; text: string;
}) {
  return (
    <div className="card p-3 flex items-center gap-2.5">
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${bg}`}>
        <span className={text}>{icon}</span>
      </div>
      <div>
        <p className={`text-xl font-bold ${text}`}>{value}</p>
        <p className="text-xs text-slate-400">{label}</p>
      </div>
    </div>
  );
}

const SCHOOL_MONTHS_LBL = ["Shtator", "Tetor", "Nëntor", "Dhjetor", "Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor"];
const SCHOOL_MONTH_CALS = [9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

// Paralajmërim (jo bllokues) kur një Afat i shkruar dorazi bie jashtë vitit akademik
// aktualisht të zgjedhur (1 Shtator schoolYearStart – 31 Gusht schoolYearStart+1) —
// zbulon gabime shtypi si "Prill" në vend të "Shtator" përpara se pagesa të bëhet
// e padukshme në vitin e pritur (shih rastin Jusuf Fejzullahu).
export function AcademicYearWarning({ dueDate, schoolYearStart }: { dueDate: string; schoolYearStart: number }) {
  if (!dueDate || schoolYearStart <= 0) return null;
  const d = new Date(dueDate);
  if (isNaN(d.getTime())) return null;
  const inRange =
    (d.getFullYear() === schoolYearStart && d.getMonth() + 1 >= 9) ||
    (d.getFullYear() === schoolYearStart + 1 && d.getMonth() + 1 <= 8);
  if (inRange) return null;
  return (
    <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 flex items-center gap-1">
      <AlertCircle className="w-3 h-3 shrink-0" />
      Afati bie jashtë vitit akademik {schoolYearStart}–{schoolYearStart + 1} (1 Shtator–31 Gusht) — kontrollo nëse është shtypur gabim.
    </p>
  );
}

// Llogarit pro-rate: muajt e ndjekur deri në datën e joaktivizimit
function calcProrated(baseAmount: number, discountPct: number, inactiveDate: Date, schoolYear: number) {
  const effectivePrice = Math.round(baseAmount * (1 - discountPct / 100));
  const SM = [
    { m: 9, y: schoolYear }, { m: 10, y: schoolYear }, { m: 11, y: schoolYear }, { m: 12, y: schoolYear },
    { m: 1, y: schoolYear + 1 }, { m: 2, y: schoolYear + 1 }, { m: 3, y: schoolYear + 1 },
    { m: 4, y: schoolYear + 1 }, { m: 5, y: schoolYear + 1 }, { m: 6, y: schoolYear + 1 },
  ];
  const inM = inactiveDate.getMonth() + 1;
  const inY = inactiveDate.getFullYear();
  let attended = 0;
  for (const sm of SM) {
    if (sm.y > inY || (sm.y === inY && sm.m >= inM)) break;
    attended++;
  }
  const amount = Math.round((attended / 10) * effectivePrice * 100) / 100;
  return { attended, amount, effectivePrice };
}

// Rrumbullakos në cent — ndarja proporcionale (splitGross) prodhon numra si
// 99.99999999999999 (gabim standard floating-point), të cilët do të dukeshin
// të shëmtuar/gabuar nëse futeshin drejtpërdrejt në fushat e formularit.
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

// Ndan çmimin BRUTO (para zbritjes) dhe zbritjen proporcionalisht sipas pjesës
// (portion, shuma finale pas zbritjes) që i takon këtij kësti/muaji nga totali
// final i gjithë planit. Kjo është ana tjetër e `reconstructDiscount` më poshtë:
// bashkë garantojnë që "Çmimi Bazë" origjinal (bruto) DHE zbritja e vërtetë
// mund të rindërtohen saktësisht sa herë që rihapet plani — asnjëherë s'zhduket
// apo ndryshon vetëm sepse është ndarë në këste. Pa këtë, çdo këst ruante më
// parë discount:0 (zbritja hidhej krejtësisht), kështu "Çmimi Bazë" i rindërtuar
// binte përgjithmonë nga shuma bruto reale (p.sh. 2000€) te shuma tashmë e
// zbritur (p.sh. 1800€) — pikërisht ankesa "çmimi bazë nuk duhet të ndryshojë
// në asnjë rrethanë".
function splitGross(portionFinal: number, totalFinalAll: number, grossTotal: number, discType: string, discVal: number, scholTotal: number) {
  const ratio = totalFinalAll > 0 ? portionFinal / totalFinalAll : 0;
  return {
    amount:      round2(grossTotal * ratio),
    discount:    round2(discType === "percentage" ? discVal : discVal * ratio),
    scholarship: round2(scholTotal * ratio),
  };
}

// E kundërta e `splitGross`: rindërton zbritjen origjinale nga një grup këstesh
// që e ndajnë të njëjtin plan. Për përqindje, e njëjta % ruhet te çdo këst pa u
// shkallëzuar — mjafton e para. Për shumë fikse, secili këst mban vetëm pjesën
// e vet proporcionale (shih `splitGross`), prandaj duhen mbledhur të gjitha që
// të rikthehet shuma fikse origjinale e plotë.
function reconstructDiscount(group: { discount: number; discountType: string | null }[]): number {
  if (group.length === 0) return 0;
  return group[0].discountType === "percentage"
    ? group[0].discount
    : group.reduce((s, p) => s + p.discount, 0);
}

/* ─── Payment Modal ──────────────────────────────────────── */
interface ModalProps {
  student: StudentRow;
  category: Category;
  month?: number;
  year: number;
  onClose: () => void;
  onSave: (receiptPaymentId?: number) => void;
  overrideAmount?: number;
  singlePaymentOnly?: boolean;
}

function PaymentModal({ student, category, month, year, onClose, onSave, overrideAmount, singlePaymentOnly = false }: ModalProps) {
  const today = new Date().toISOString().split("T")[0];
  const installments = student.installments;

  // Detect existing installment type
  const isAlreadyMonthly = installments.some(p => p.description?.startsWith("MUAJI_"));
  const isAlreadyFlex = !isAlreadyMonthly && installments.some(p => p.description?.startsWith("FLEX_"));
  const isAlreadyTwo = !isAlreadyMonthly && !isAlreadyFlex && (
    installments.length >= 2 ||
    installments.some(p => p.description === "KESTI_1" || p.description === "KESTI_2")
  );
  const k1Existing = !isAlreadyFlex ? (installments.find(p => p.description === "KESTI_1") ?? installments[0] ?? null) : null;
  const k2Existing = !isAlreadyFlex ? (installments.find(p => p.description === "KESTI_2") ?? installments[1] ?? null) : null;

  // Sapo një plan i këstizuar EKZISTON (Dy Këste/Çdo Muaj/Fleksibël me rekorde
  // reale), "Çmimi Bazë"/"Zbritja" bëhen VETËM PASQYRË (jo më të editueshme).
  // Arsyeja rrënjësore: në këto mënyra, shuma REALE që i takon çdo kësti
  // ("Shuma e këstit" më poshtë) është E VETMJA burim i vërtetë — "Çmimi Bazë"
  // gjithmonë RINDËRTOHET prej saj (shih `existingTotalAmount`). Nëse admin
  // ndryshonte "Çmimi Bazë"/"Zbritja" pa prekur asnjë shumë kësti, sistemi
  // "zgjidhte mbrapsht" një total bruto krejt të ri për të mos e prekur shumën
  // e çdo kësti — dhe herës tjetër që rihapej plani, "Çmimi Bazë" dilte një
  // shifër e papritur (asnjëherë ajo që u fut). Kjo ishte pikërisht ankesa e
  // përsëritur "çmimi bazë nuk duhet të ndryshojë në asnjë rrethanë". Tani,
  // sapo ka këste reale, kjo fushë kyçet plotësisht — për të ndryshuar shumën
  // e vërtetë, modifiko drejtpërdrejt "Shuma e këstit" të çdo rreshti.
  const hasExistingInstallmentPlan = isAlreadyTwo || isAlreadyMonthly || isAlreadyFlex;

  // Single payment is the first one if it's not a KESTI/MUAJI/FLEX record
  const singleExisting = !isAlreadyTwo && !isAlreadyMonthly && !isAlreadyFlex ? (installments[0] ?? null) : null;

  const [mode, setMode] = useState<"single" | "two" | "monthly" | "flex">(
    isAlreadyMonthly ? "monthly" : isAlreadyFlex ? "flex" : isAlreadyTwo ? "two" : "single"
  );
  const [saving, setSaving] = useState(false);

  // Shuma bazë e GJITHË planit ekzistues (jo vetëm e këstit/muajit të parë që
  // gjendet). Përndryshe, kur rihapej "Modifiko" për një plan me Dy Këste (ku
  // çdo këst ruhet me `amount` = vetëm gjysma e vet), "Çmimi Bazë" merrte
  // gabimisht vetëm Këstin 1 (p.sh. 900€ në vend të 1.800€ total) — kjo e bënte
  // "Shuma e dy kësteve nuk përputhet me totalin" të dukej gabimisht, dhe nëse
  // stafi ndërronte mënyrën (p.sh. te "Pagesë e plotë") për të regjistruar një
  // pagesë të pjesshme, çmimi bazë i ri fillonte prej shifrës së gabuar (gjysma),
  // duke "tkurrur" gabimisht totalin real të negociuar.
  // Këste Fleksibël — RISTRUKTURUAR: NJË rekord i vetëm "FLEX_HEADER" mban
  // Çmimin Bazë/Zbritjen EXAKTËSISHT siç u futën, kurrë të rindërtuar nga
  // shuma të tjera. Çdo pagesë tjetër ("FLEX_PAY_N") është thjesht një
  // dëftesë e vetë-mjaftueshme (shih handleSave) — asnjë ndarje proporcionale,
  // prandaj Çmimi Bazë s'mund të "rrjedhë" më, sido që ndryshon numri i
  // pagesave. `flexLegacyRows` mbulon VETËM planet e krijuara para këtij
  // ristrukturimi (rreshta "FLEX_1"/"FLEX_2"/... pa header) — përdoret si
  // pikënisje migrimi një-herësh, kurrë më pas.
  const flexHeaderExisting = installments.find(p => p.description === "FLEX_HEADER") ?? null;
  const flexLegacyRows = isAlreadyFlex && !flexHeaderExisting
    ? installments.filter(p => p.description?.startsWith("FLEX_") && p.description !== "FLEX_HEADER" && !p.description?.startsWith("FLEX_PAY_"))
    : [];

  const existingTotalAmount: number | null =
    singleExisting ? singleExisting.amount :
    flexHeaderExisting ? flexHeaderExisting.amount :
    isAlreadyTwo && k1Existing && k2Existing ? round2(k1Existing.amount + k2Existing.amount) :
    isAlreadyMonthly ? round2(installments.reduce((sum, p) => sum + p.amount, 0)) :
    flexLegacyRows.length > 0 ? round2(flexLegacyRows.reduce((sum, p) => sum + p.amount, 0)) :
    null;

  // Njësoj si `existingTotalAmount` më sipër, por për shumën TASHMË TË PAGUAR
  // të gjithë planit. Pa këtë, kur ndërrohej te "Pagesë e plotë" nga një plan
  // Dy Këste/Çdo Muaj/Fleksibël me pagesa të pjesshme reale (p.sh. Kësti 1 =
  // 900€ i paguar), fusha "Paguar" fillonte bosh/0 — nëse stafi shënonte aty
  // vetëm pagesën E RE (p.sh. 400€ e mbledhur tani për Këstin 2), sistemi e
  // ruante si TËRË historikun e pagesës (900€ e mëparshme humbiste), duke e
  // fryrë gabimisht borxhin e mbetur. Tani "Paguar" fillon nga shuma reale e
  // paguar deri tani, kështu që çdo shtesë llogaritet saktë kundrejt borxhit
  // të vërtetë të mbetur, jo kundrejt zeros.
  const existingTotalPaid: number =
    isAlreadyTwo && k1Existing && k2Existing ? round2(k1Existing.paidAmount + k2Existing.paidAmount) :
    isAlreadyMonthly ? round2(installments.reduce((sum, p) => sum + p.paidAmount, 0)) :
    isAlreadyFlex ? round2(installments.filter(p => p.description?.startsWith("FLEX_")).reduce((sum, p) => sum + p.paidAmount, 0)) :
    0;

  // Grupi i këstizuar ekzistues (Dy Këste / Çdo Muaj) — përdoret për të
  // rindërtuar zbritjen/bursën origjinale (shih `reconstructDiscount` dhe
  // `splitGross` më sipër në skedar). Për Këste Fleksibël, zbritja/bursa
  // lexohet direkt nga `flexHeaderExisting` (ose `flexLegacyRows` gjatë
  // migrimit) — jo më e rindërtuar nga një grup.
  const existingInstallmentGroup: Payment[] =
    isAlreadyTwo && k1Existing && k2Existing ? [k1Existing, k2Existing] :
    isAlreadyMonthly ? installments.filter(p => p.description?.startsWith("MUAJI_")) :
    flexLegacyRows.length > 0 ? flexLegacyRows :
    [];
  const existingDiscountType: string | null =
    singleExisting?.discountType ?? flexHeaderExisting?.discountType ?? existingInstallmentGroup[0]?.discountType ?? null;
  const existingDiscount: number | null =
    singleExisting ? singleExisting.discount :
    flexHeaderExisting ? flexHeaderExisting.discount :
    existingInstallmentGroup.length > 0 ? round2(reconstructDiscount(existingInstallmentGroup)) :
    null;
  const existingScholarship: number =
    singleExisting ? singleExisting.scholarship :
    flexHeaderExisting ? flexHeaderExisting.scholarship :
    round2(existingInstallmentGroup.reduce((sum, p) => sum + p.scholarship, 0));
  // Shënimi i lirë ("për cilën periudhë është kjo pagesë", "borxh i vjetër", etj.) —
  // ruhet identik në çdo rresht të planit (shih handleSave), ndaj mjafton i pari që gjendet.
  const existingNote: string | null = installments.find(p => p.note)?.note ?? null;

  // ── Common form (gross amount + discounts) ──
  // Nëse kategoria ka një shumë fikse të konfiguruar (p.sh. Librat & Shkollorja = 20€/vit),
  // fusha "Shuma" mbushet automatikisht — kursen kohë kur çmimi është i njëjtë për të gjithë.
  // Zbritja e nxënësit (Student.discountPct) aplikohet automatikisht kur s'ka ende pagesë
  // reale të ruajtur — përndryshe respektohet gjithmonë zbritja e vërtetë e ruajtur më parë.
  const [form, setForm] = useState({
    amount:       overrideAmount != null ? String(overrideAmount)
      : String(existingTotalAmount ?? k1Existing?.amount ?? (category.defaultAmount > 0 ? category.defaultAmount : "")),
    discount:     String(existingDiscount ?? k1Existing?.discount ?? (student.discountPct > 0 ? student.discountPct : "0")),
    discountType: existingDiscountType ?? k1Existing?.discountType ?? (student.discountPct > 0 ? "percentage" : "fixed"),
    scholarship:  String(existingScholarship || (singleExisting?.scholarship ?? "0")),
    note:         existingNote ?? "",
  });

  // Derived final amount for reference
  const amount      = parseFloat(form.amount || "0");
  const discount    = parseFloat(form.discount || "0");
  const scholarship = parseFloat(form.scholarship || "0");
  const discountAmt = form.discountType === "percentage" ? (amount * discount) / 100 : discount;
  const totalFinal  = Math.max(0, amount - discountAmt - scholarship);

  // ── Single mode extra state ──
  const [sForm, setSForm] = useState({
    paidAmount: String(singleExisting ? singleExisting.paidAmount : (existingTotalPaid > 0 ? existingTotalPaid : "")),
    method:     singleExisting?.method            ?? "CASH",
    dueDate:    singleExisting?.dueDate
      ? new Date(singleExisting.dueDate).toISOString().split("T")[0]
      : `${year > 0 ? year : new Date().getFullYear()}-09-15`,
    paidDate:   singleExisting?.paidDate
      ? new Date(singleExisting.paidDate).toISOString().split("T")[0]
      : today,
  });

  // ── Two-installment state ──
  const half1 = k1Existing ? k1Existing.finalAmount : Math.ceil(totalFinal / 2);
  const half2 = k2Existing ? k2Existing.finalAmount : totalFinal - Math.ceil(totalFinal / 2);

  const [k1Form, setK1Form] = useState({
    portion:    String(half1),
    paidAmount: String(k1Existing?.paidAmount ?? ""),
    paidDate:   k1Existing?.paidDate ? new Date(k1Existing.paidDate).toISOString().split("T")[0] : today,
    dueDate:    k1Existing?.dueDate  ? new Date(k1Existing.dueDate).toISOString().split("T")[0]  : `${year > 0 ? year : new Date().getFullYear()}-09-15`,
    method:     k1Existing?.method   ?? "CASH",
  });

  const [k2Form, setK2Form] = useState({
    portion:    String(half2),
    paidAmount: String(k2Existing?.paidAmount ?? ""),
    paidDate:   k2Existing?.paidDate ? new Date(k2Existing.paidDate).toISOString().split("T")[0] : today,
    dueDate:    k2Existing?.dueDate  ? new Date(k2Existing.dueDate).toISOString().split("T")[0]  : `${year > 0 ? year : new Date().getFullYear()}-11-30`,
    method:     k2Existing?.method   ?? "CASH",
  });

  // Auto-update portion 2 when totalFinal or portion 1 changes
  const portion1 = parseFloat(k1Form.portion || "0");
  const portion2 = parseFloat(k2Form.portion || "0");
  const portionSum = portion1 + portion2;

  function set(field: string, val: string) { setForm(f => ({ ...f, [field]: val })); }
  function setS(field: string, val: string) { setSForm(f => ({ ...f, [field]: val })); }
  function setK1(field: string, val: string) { setK1Form(f => ({ ...f, [field]: val })); }
  function setK2(field: string, val: string) { setK2Form(f => ({ ...f, [field]: val })); }

  // ── Monthly installment state ──
  function defaultDueMonth(idx: number): string {
    const yr = year > 0 ? year : new Date().getFullYear();
    const calYear = idx < 4 ? yr : yr + 1;
    const calMonth = idx < 4 ? idx + 9 : idx - 3;
    return `${calYear}-${String(calMonth).padStart(2, "0")}-05`;
  }

  const [mForms, setMForms] = useState<{
    portion: string; paidAmount: string; paidDate: string; dueDate: string; method: string;
  }[]>(() => {
    // Nëse s'ka ende muaj (jo isAlreadyMonthly) por KA instalime nga një mënyrë
    // tjetër (Pagesë e plotë/Dy Këste) me pagesa REALE, përpiqu t'i vendosësh në
    // muajin përkatës sipas datës së vet të afatit — njësoj si te Këste Fleksibël
    // më sipër, përndryshe "Paguar"/"Borxhi" do të "harronin" çka është paguar
    // tashmë. Nëse ndonjë instalim s'përputhet me asnjë prej 10 muajve fiks
    // (Shtator–Qershor), ai rresht mbetet bosh — për raste të tilla parregullta
    // rekomandohet "Këste Fleksibël", i cili mbulon çdo datë pa kufizim.
    const yr0 = year > 0 ? year : new Date().getFullYear();
    const carryOver = !isAlreadyMonthly ? installments : [];
    const used = new Set<number>();
    return Array.from({ length: 10 }, (_, i) => {
      const targetMonth = SCHOOL_MONTH_CALS[i];
      const targetYear  = i < 4 ? yr0 : yr0 + 1;
      const ex = installments.find(p => p.description === `MUAJI_${i + 1}`)
        ?? carryOver.find(p => {
          if (used.has(p.id)) return false;
          const d = new Date(p.dueDate);
          return d.getMonth() + 1 === targetMonth && d.getFullYear() === targetYear;
        })
        ?? null;
      if (ex && carryOver.includes(ex)) used.add(ex.id);
      return {
        portion:    ex ? String(ex.finalAmount)  : "",
        paidAmount: ex ? String(ex.paidAmount)   : "0",
        paidDate:   ex?.paidDate ? new Date(ex.paidDate).toISOString().split("T")[0] : today,
        dueDate:    ex?.dueDate  ? new Date(ex.dueDate).toISOString().split("T")[0]  : defaultDueMonth(i),
        method:     ex?.method   ?? "CASH",
      };
    });
  });

  function setM(idx: number, field: string, val: string) {
    setMForms(f => f.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  }

  function splitEvenly() {
    const perMonth = totalFinal > 0 ? Math.round((totalFinal / 10) * 100) / 100 : 0;
    setMForms(f => f.map(r => ({ ...r, portion: String(perMonth) })));
  }

  const sPaid    = parseFloat(sForm.paidAmount || "0");
  const sBalance = Math.max(0, totalFinal - sPaid);
  const k1Paid   = parseFloat(k1Form.paidAmount || "0");
  const k2Paid   = parseFloat(k2Form.paidAmount || "0");

  // ── Pagesat fleksibël (Këste Fleksibël, ristrukturuar) ──
  // Çdo rresht = NJË pagesë reale (shih "FLEX_PAY_N" te handleSave); Çmimi
  // Bazë/Zbritja jetojnë VETËM te "FLEX_HEADER" (shih më sipër), kurrë të
  // ndikuar nga numri i pagesave këtu.
  const flexPaymentsExisting = installments
    .filter(p => p.description?.startsWith("FLEX_PAY_"))
    .sort((a, b) => parseInt(a.description!.replace("FLEX_PAY_", "")) - parseInt(b.description!.replace("FLEX_PAY_", "")));

  const [flexRows, setFlexRows] = useState<{
    id: number | null; portion: string; paidAmount: string; paidDate: string; dueDate: string; method: string;
  }[]>(() => {
    if (flexPaymentsExisting.length > 0) {
      return flexPaymentsExisting.map(ex => ({
        id: ex.id,
        portion:    String(ex.paidAmount),
        paidAmount: String(ex.paidAmount),
        paidDate:   ex.paidDate ? new Date(ex.paidDate).toISOString().split("T")[0] : today,
        dueDate:    new Date(ex.dueDate).toISOString().split("T")[0],
        method:     ex.method ?? "CASH",
      }));
    }
    // Migrim një-herësh: plane të krijuara PARA ristrukturimit (rreshta
    // "FLEX_1"/"FLEX_2"/... pa header) — çdo pagesë reale e tyre konvertohet
    // në një pagesë të thjeshtë të re; herën tjetër që ruhet, plani rishkruhet
    // krejtësisht sipas modelit të ri (header + pagesa) dhe ky migrim s'nevojitet më.
    if (flexLegacyRows.length > 0) {
      return flexLegacyRows.filter(p => p.paidAmount > 0).map(ex => ({
        id: null,
        portion:    String(ex.paidAmount),
        paidAmount: String(ex.paidAmount),
        paidDate:   ex.paidDate ? new Date(ex.paidDate).toISOString().split("T")[0] : today,
        dueDate:    new Date(ex.dueDate).toISOString().split("T")[0],
        method:     ex.method ?? "CASH",
      }));
    }
    // Duke ardhur nga një mënyrë tjetër (Pagesë e plotë / Dy Këste / Çdo Muaj) me
    // pagesa REALE — konverto VETËM këstet/muajt që kanë PAGESË REALE (paidAmount
    // > 0) në pagesa fleksibël. Këstet ende PA PAGESË (p.sh. Kësti 2 = 0€ i
    // paguar) NUK konvertohen fare — borxhi i tyre mbetet saktë i mbuluar nga
    // "Borxhi i mbetur" (Çmimi Bazë − Total paguar), pa nevojë për rresht "bosh".
    const paidOnly = installments.filter(p => p.paidAmount > 0);
    if (paidOnly.length > 0) {
      return paidOnly.map(ex => ({
        id: null,
        portion:    String(ex.paidAmount),
        paidAmount: String(ex.paidAmount),
        paidDate:   ex.paidDate ? new Date(ex.paidDate).toISOString().split("T")[0] : today,
        dueDate:    new Date(ex.dueDate).toISOString().split("T")[0],
        method:     ex.method ?? "CASH",
      }));
    }
    return [{ id: null, portion: "", paidAmount: "0", paidDate: today, dueDate: today, method: "CASH" }];
  });

  function setFlex(idx: number, field: string, val: string) {
    setFlexRows(f => f.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  }
  // Çdo rresht fleksibël përfaqëson NJË pagesë reale — s'ka fushë të veçantë
  // "shuma e pritur" (shih komentin te tabela më poshtë), prandaj "portion"
  // (përdoret nga handleSave/splitGross) barazohet gjithmonë me "paidAmount".
  function setFlexPaid(idx: number, val: string) {
    setFlexRows(f => f.map((r, i) => i === idx ? { ...r, portion: val, paidAmount: val } : r));
  }
  function addFlexRow() {
    setFlexRows(f => [...f, { id: null, portion: "", paidAmount: "0", paidDate: today, dueDate: today, method: "CASH" }]);
  }
  async function removeFlexRow(idx: number) {
    const row = flexRows[idx];
    if (row.id) {
      if (!confirm("Fshi këtë këst? Ky veprim nuk mund të kthehet.")) return;
      await fetch(`/api/payments/${row.id}`, { method: "DELETE" });
    }
    setFlexRows(f => f.filter((_, i) => i !== idx));
  }
  const flexTotalPaid = flexRows.reduce((s, r) => s + (parseFloat(r.paidAmount) || 0), 0);
  // Borxhi llogaritet kundrejt çmimit bazë (pas zbritjes), jo vetëm shumës së këstesh
  // të regjistruara deri tani — përndryshe borxhi real fshihet pas çdo kësti të pjesshëm.
  const flexTotalDebt    = Math.max(0, totalFinal - flexTotalPaid);

  function statusLabel(portionAmt: number, paidAmt: number, dueDateStr: string): { label: string; color: string } {
    if (portionAmt > 0 && paidAmt >= portionAmt) return { label: "✓ Paguar", color: "text-green-600" };
    if (paidAmt > 0) return { label: "~ Pjesërisht", color: "text-blue-600" };
    if (dueDateStr && new Date(dueDateStr) < new Date()) return { label: "⚠ Vonuar", color: "text-red-600" };
    return { label: "Pending", color: "text-slate-400" };
  }

  async function handleDeleteInstallment(payment: Payment | null) {
    if (!payment) return;
    if (!confirm("Fshi këtë këst? Ky veprim nuk mund të kthehet.")) return;
    setSaving(true);
    await fetch(`/api/payments/${payment.id}`, { method: "DELETE" });
    setSaving(false);
    onSave();
  }

  async function handleSave(withPrint = false) {
    setSaving(true);
    let receiptPaymentId: number | undefined;

    if (mode === "single") {
      // If switching from two-installment to single: delete both old ones
      if (isAlreadyTwo) {
        await Promise.all(installments.map(p => fetch(`/api/payments/${p.id}`, { method: "DELETE" })));
      }
      const payload = {
        studentId:    student.id,
        categoryId:   category.id,
        amount:       form.amount,
        discount:     form.discount,
        discountType: form.discountType,
        scholarship:  form.scholarship,
        paidAmount:   sForm.paidAmount,
        method:       sForm.method,
        dueDate:      sForm.dueDate,
        paidDate:     sForm.paidDate,
        description:  null,
        note:         form.note || null,
        // Muaji/viti llogariten nga Afati i pagesës, jo nga filtri aktual i tabelës
        // (mund të jetë "Të gjitha" → pa muaj konkret, gjë që e bënte pagesën të
        // "padukshme" për query-t e ardhshme që kërkojnë muaj real).
        month:        new Date(sForm.dueDate).getMonth() + 1,
        year:         new Date(sForm.dueDate).getFullYear(),
      };
      if (singleExisting) {
        const r = await fetch(`/api/payments/${singleExisting.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (r.ok && parseFloat(sForm.paidAmount) > 0) receiptPaymentId = singleExisting.id;
      } else {
        const r = await fetch("/api/payments", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (r.ok && parseFloat(sForm.paidAmount) > 0) {
          const created = await r.json();
          receiptPaymentId = created.id;
        }
      }
    } else if (mode === "two") {
      // Two-installment mode
      // If switching from single to two: delete old single payment
      if (!isAlreadyTwo && singleExisting) {
        await fetch(`/api/payments/${singleExisting.id}`, { method: "DELETE" });
      }

      const saveInstallment = async (
        existing: Payment | null,
        grossAmt: number,
        discAmt: number,
        scholAmt: number,
        paidAmt: number,
        dueDate: string,
        paidDate: string,
        method: string,
        description: string,
      ): Promise<number | undefined> => {
        const payload = {
          studentId:    student.id,
          categoryId:   category.id,
          amount:       grossAmt,
          discount:     discAmt,
          discountType: form.discountType,
          scholarship:  scholAmt,
          paidAmount:   paidAmt,
          method,
          dueDate,
          paidDate,
          description,
          note:         form.note || null,
          // Muaji/viti llogariten nga Afati i vetë këstit, jo nga filtri i tabelës.
          month:        new Date(dueDate).getMonth() + 1,
          year:         new Date(dueDate).getFullYear(),
        };
        if (existing) {
          const r = await fetch(`/api/payments/${existing.id}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          return r.ok ? existing.id : undefined;
        } else {
          const r = await fetch("/api/payments", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
          if (!r.ok) return undefined;
          const created = await r.json();
          return created.id;
        }
      };

      // Çmimi bruto (para zbritjes) dhe zbritja ndahen proporcionalisht mes K1/K2
      // (shih `splitGross`) — JO më `discount:0` fiks si më parë. Kështu, "Çmimi
      // Bazë" origjinal (p.sh. 2000€, -10%) rindërtohet gjithmonë saktë kur
      // rihapet plani, në vend që të "zhvishej" përgjithmonë te shuma tashmë e
      // zbritur (p.sh. 1800€) — pikërisht defekti i raportuar.
      const split1 = splitGross(portion1, totalFinal, amount, form.discountType, discount, scholarship);
      const split2 = splitGross(portion2, totalFinal, amount, form.discountType, discount, scholarship);

      // Krijo/perditeso vetem kestet qe kane shume reale (ose qe ekzistojne tashme) —
      // perndryshe ruajtja e vetem njerit kesti krijonte automatikisht nje pagese
      // "fantazme" 0-euro per tjetrin, gje qe ngatarronte stafin ne Historik.
      // Fletëpagesa printohet për këstin e fundit që mori pagesë reale në këtë ruajtje
      // (K2 mbizotëron K1 nëse të dy paguhen njëkohësisht).
      if (k1Existing || portion1 > 0) {
        const rid = await saveInstallment(k1Existing, split1.amount, split1.discount, split1.scholarship, k1Paid, k1Form.dueDate, k1Form.paidDate, k1Form.method, "KESTI_1");
        if (k1Paid > 0 && rid) receiptPaymentId = rid;
      }
      if (k2Existing || portion2 > 0) {
        const rid = await saveInstallment(k2Existing, split2.amount, split2.discount, split2.scholarship, k2Paid, k2Form.dueDate, k2Form.paidDate, k2Form.method, "KESTI_2");
        if (k2Paid > 0 && rid) receiptPaymentId = rid;
      }
    } else if (mode === "monthly") {
      // Monthly mode — delete non-monthly installments if switching from other mode
      if (!isAlreadyMonthly) {
        await Promise.all(installments.map(p => fetch(`/api/payments/${p.id}`, { method: "DELETE" })));
      }
      const yr = year > 0 ? year : new Date().getFullYear();
      // Fletëpagesa printohet për muajin e fundit (indeksi më i madh) që mori pagesë
      // reale në këtë ruajtje.
      const lastPaidMonthIdx = mForms.reduce((last, f, i) => parseFloat(f.paidAmount || "0") > 0 ? i : last, -1);
      await Promise.all(mForms.map(async (mf, i) => {
        const ex = installments.find(p => p.description === `MUAJI_${i + 1}`) ?? null;
        // Shih komentin te modaliteti "Dy Këste" — çmimi bruto/zbritja ndahen
        // proporcionalisht, jo `discount:0` fiks, që "Çmimi Bazë" origjinal të
        // mos ndryshojë kurrë kur rihapet plani.
        const splitM = splitGross(parseFloat(mf.portion || "0"), totalFinal, amount, form.discountType, discount, scholarship);
        const payload = {
          studentId:    student.id,
          categoryId:   category.id,
          amount:       splitM.amount,
          discount:     splitM.discount,
          discountType: form.discountType,
          scholarship:  splitM.scholarship,
          paidAmount:   parseFloat(mf.paidAmount || "0"),
          method:       mf.method,
          dueDate:      mf.dueDate,
          paidDate:     mf.paidDate,
          description:  `MUAJI_${i + 1}`,
          note:         form.note || null,
          month:        SCHOOL_MONTH_CALS[i],
          year:         i < 4 ? yr : yr + 1,
        };
        let rid: number | undefined;
        if (ex) {
          const r = await fetch(`/api/payments/${ex.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          rid = r.ok ? ex.id : undefined;
        } else {
          const r = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          if (r.ok) rid = (await r.json()).id;
        }
        if (i === lastPaidMonthIdx) receiptPaymentId = rid;
      }));
    } else {
      // Flex mode — delete installments from a DIFFERENT mode if switching in
      if (!isAlreadyFlex) {
        await Promise.all(installments.map(p => fetch(`/api/payments/${p.id}`, { method: "DELETE" })));
      }
      // Fshi rreshtat "legacy" (para header-it) — u zëvendësuan nga header-i +
      // pagesat individuale më poshtë, pjesë e migrimit një-herësh.
      if (flexLegacyRows.length > 0) {
        await Promise.all(flexLegacyRows.map(p => fetch(`/api/payments/${p.id}`, { method: "DELETE" })));
      }

      // HEADER — një rekord i vetëm mban Çmimin Bazë/Zbritjen EXAKTËSISHT siç
      // janë në formular, e kopjuar direkt, ASNJËHERË e rindërtuar nga ndonjë
      // ndarje proporcionale. Meqë s'rrjedh nga asnjë shumë tjetër, s'ka MËNYRË
      // që të ndryshojë vetvetiu, sido që shtohen/hiqen pagesa më poshtë.
      const headerDueDate = flexHeaderExisting?.dueDate ? new Date(flexHeaderExisting.dueDate).toISOString().split("T")[0] : today;
      const headerPayload = {
        studentId:    student.id,
        categoryId:   category.id,
        amount:       form.amount,
        discount:     form.discount,
        discountType: form.discountType,
        scholarship:  form.scholarship,
        paidAmount:   0,
        method:       "CASH",
        dueDate:      headerDueDate,
        paidDate:     null,
        description:  "FLEX_HEADER",
        note:         form.note || null,
        month:        new Date(headerDueDate).getMonth() + 1,
        year:         new Date(headerDueDate).getFullYear(),
      };
      if (flexHeaderExisting) {
        await fetch(`/api/payments/${flexHeaderExisting.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(headerPayload) });
      } else {
        await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(headerPayload) });
      }

      // PAGESAT — çdo rresht = 1 pagesë REALE, e vetë-mjaftueshme (amount =
      // paidAmount, 0% zbritje) — thjesht një dëftesë e vogël e paguar
      // plotësisht. Asnjë ndarje proporcionale, asnjë varësi nga rreshtat e
      // tjerë. Fletëpagesa printohet për rreshtin e fundit që mori pagesë
      // reale në këtë ruajtje.
      const lastPaidFlexIdx = flexRows.reduce((last, r, i) => parseFloat(r.paidAmount || "0") > 0 ? i : last, -1);
      await Promise.all(flexRows.map(async (fr, i) => {
        const paidAmt = parseFloat(fr.paidAmount || "0");
        if (!fr.id && paidAmt <= 0) return;
        const payload = {
          studentId:    student.id,
          categoryId:   category.id,
          amount:       paidAmt,
          discount:     0,
          discountType: "fixed",
          scholarship:  0,
          paidAmount:   paidAmt,
          method:       fr.method,
          dueDate:      fr.dueDate,
          paidDate:     fr.paidDate,
          description:  `FLEX_PAY_${i + 1}`,
          month:        new Date(fr.dueDate).getMonth() + 1,
          year:         new Date(fr.dueDate).getFullYear(),
        };
        let rid: number | undefined;
        if (fr.id) {
          const r = await fetch(`/api/payments/${fr.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          rid = r.ok ? fr.id : undefined;
        } else {
          const r = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
          if (r.ok) rid = (await r.json()).id;
        }
        if (i === lastPaidFlexIdx) receiptPaymentId = rid;
      }));
    }

    setSaving(false);
    onSave(withPrint ? receiptPaymentId : undefined);
  }

  function quickPay() {
    setSForm(f => ({ ...f, paidAmount: String(totalFinal), paidDate: today }));
  }

  const k1Status = statusLabel(portion1, k1Paid, k1Form.dueDate);
  const k2Status = statusLabel(portion2, k2Paid, k2Form.dueDate);

  // A ka diçka për t'u printuar (dëshmi pagese) pas kësaj ruajtjeje — pra a ka
  // të paktën një këst/muaj me pagesë reale (>0) në modalitetin aktual.
  const canPrint =
    mode === "single"  ? parseFloat(sForm.paidAmount || "0") > 0 :
    mode === "two"     ? (k1Paid > 0 || k2Paid > 0) :
    mode === "monthly" ? mForms.some(f => parseFloat(f.paidAmount || "0") > 0) :
    mode === "flex"    ? flexRows.some(r => parseFloat(r.paidAmount || "0") > 0) :
    false;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl animate-fade-in max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800 z-10">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">
              {mode === "two" ? "Pagesa me Dy Këste" : mode === "flex" ? "Pagesa me Këste Fleksibël" : (singleExisting ? "Modifiko Pagesën" : "Shto Pagesë")}
            </h3>
            <p className="text-sm text-slate-400 mt-0.5">
              {student.firstName} {student.lastName}
              {student.class && <span> • Klasa {student.class.name}</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Mode toggle — fshihet kur kategoria ka vetëm pagesë të plotë (p.sh. Eshkollori) */}
          {!singlePaymentOnly && (
            <div className="flex items-center gap-2 p-1 bg-slate-100 dark:bg-slate-700 rounded-xl w-fit">
              <button
                onClick={() => setMode("single")}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === "single"
                    ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                Pagesë e plotë
              </button>
              <button
                onClick={() => setMode("two")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === "two"
                    ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                Dy Këste
              </button>
              <button
                onClick={() => setMode("monthly")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === "monthly"
                    ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                Çdo Muaj
              </button>
              <button
                onClick={() => setMode("flex")}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  mode === "flex"
                    ? "bg-white dark:bg-slate-600 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                <CalendarDays className="w-4 h-4" />
                Këste Fleksibël
              </button>
            </div>
          )}

          {/* Common: gross amount + discounts — pa kuptim për Këste Fleksibël (çdo rresht ka shumën e vet) */}
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
              Çmimi Bazë & Zbritja
              {hasExistingInstallmentPlan && <Lock className="w-3 h-3 text-slate-400" />}
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Çmimi bazë (€) <span className="text-red-500">*</span></label>
                <input type="number" value={form.amount} onChange={e => set("amount", e.target.value)}
                  disabled={hasExistingInstallmentPlan}
                  className="form-input disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                  placeholder="0.00" min="0" step="0.01" />
              </div>
              <div>
                <label className="form-label">Zbritja</label>
                <div className="flex gap-1">
                  <select value={form.discountType} onChange={e => set("discountType", e.target.value)}
                    disabled={hasExistingInstallmentPlan}
                    className="form-input w-16 text-xs disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed">
                    <option value="fixed">€</option>
                    <option value="percentage">%</option>
                  </select>
                  <input type="number" value={form.discount} onChange={e => set("discount", e.target.value)}
                    disabled={hasExistingInstallmentPlan}
                    className="form-input flex-1 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed"
                    placeholder="0" min="0" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between mt-2 px-3 py-2 bg-slate-50 dark:bg-slate-900/50 rounded-lg text-sm">
              <span className="text-slate-500">Shuma finale (pas zbritjes):</span>
              <span className="font-bold text-primary-700 dark:text-primary-400">{formatCurrency(totalFinal)}</span>
            </div>
            {hasExistingInstallmentPlan ? (
              <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                <Lock className="w-3 h-3 shrink-0" />
                Çmimi bazë është fiksuar sepse ka tashmë këste reale — për ta ndryshuar, modifiko shumën e vetë kështit/muajit/rreshtit më poshtë.
              </p>
            ) : mode === "flex" && (
              <p className="text-[11px] text-slate-400 mt-1.5">
                Kjo shumë e pritur përdoret si bazë për "Borxhi i mbetur" te këstet fleksibël më poshtë.
              </p>
            )}
          </div>

          {/* Shënim i lirë — sqaron për cilën periudhë është pagesa, ose nëse është
              shlyerje e një borxhi të vjetër. Ruhet identik në çdo rresht/këst të
              planit (shih handleSave), kështu që s'zhduket kur ndryshon mënyra e pagesës. */}
          <div>
            <label className="form-label">Shënim (opsionale)</label>
            <input type="text" value={form.note} onChange={e => set("note", e.target.value)}
              className="form-input" placeholder='p.sh. "Borxh i vjetër nga 2025-2026" ose "Për Shtator-Tetor 2026"' />
          </div>

          {/* ── SINGLE MODE ── */}
          {mode === "single" && (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pagesa</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Paguar (€)</label>
                  <input type="number" value={sForm.paidAmount} onChange={e => setS("paidAmount", e.target.value)}
                    className="form-input" placeholder="0.00" min="0" step="0.01" />
                </div>
                <div>
                  <label className="form-label">Mënyra</label>
                  <select value={sForm.method} onChange={e => setS("method", e.target.value)} className="form-input">
                    <option value="CASH">Cash</option>
                    <option value="BANK">Bankë</option>
                    <option value="CARD">Kartelë</option>
                    <option value="ONLINE">Online</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Afati i Pagesës</label>
                  <input type="date" value={sForm.dueDate} onChange={e => setS("dueDate", e.target.value)} className="form-input" />
                  <AcademicYearWarning dueDate={sForm.dueDate} schoolYearStart={year} />
                </div>
                <div>
                  <label className="form-label">Data e Pagesës</label>
                  <input type="date" value={sForm.paidDate} onChange={e => setS("paidDate", e.target.value)} className="form-input" />
                </div>
              </div>
              {sBalance > 0 && sPaid > 0 && (
                <div className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-sm">
                  <span className="text-amber-700 dark:text-amber-400">Borxh i mbetur:</span>
                  <span className="font-bold text-amber-700 dark:text-amber-400">{formatCurrency(sBalance)}</span>
                </div>
              )}
              {totalFinal > 0 && sPaid < totalFinal && (
                <button onClick={quickPay} className="w-full py-2 rounded-lg border-2 border-dashed border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 text-sm font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors flex items-center justify-center gap-2">
                  <CheckCircle className="w-4 h-4" />
                  Shëno si paguar plotësisht ({formatCurrency(totalFinal)})
                </button>
              )}
            </div>
          )}

          {/* ── TWO INSTALLMENTS MODE ── */}
          {mode === "two" && (
            <div className="space-y-4">
              {/* Portion validation */}
              {totalFinal > 0 && Math.abs(portionSum - totalFinal) > 0.01 && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs text-amber-700 dark:text-amber-400">
                  ⚠ Shuma e dy kësteve ({formatCurrency(portionSum)}) nuk përputhet me totalin ({formatCurrency(totalFinal)})
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {/* K1 */}
                <div className="border border-slate-200 dark:border-slate-600 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Kësti i Parë</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${k1Status.color}`}>{k1Status.label}</span>
                      {k1Existing && (
                        <button
                          onClick={() => handleDeleteInstallment(k1Existing)}
                          disabled={saving}
                          title="Fshi këtë këst"
                          className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Shuma e këstit (€)</label>
                    <input type="number" value={k1Form.portion} onChange={e => setK1("portion", e.target.value)}
                      className="form-input" placeholder="0" min="0" step="0.01" />
                  </div>
                  <div>
                    <label className="form-label">Afati</label>
                    <input type="date" value={k1Form.dueDate} onChange={e => setK1("dueDate", e.target.value)} className="form-input" />
                    <AcademicYearWarning dueDate={k1Form.dueDate} schoolYearStart={year} />
                  </div>
                  <div>
                    <label className="form-label">Paguar (€)</label>
                    <input type="number" value={k1Form.paidAmount} onChange={e => setK1("paidAmount", e.target.value)}
                      className="form-input" placeholder="0" min="0" step="0.01" />
                  </div>
                  <div>
                    <label className="form-label">Data e pagesës</label>
                    <input type="date" value={k1Form.paidDate} onChange={e => setK1("paidDate", e.target.value)} className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Mënyra</label>
                    <select value={k1Form.method} onChange={e => setK1("method", e.target.value)} className="form-input">
                      <option value="CASH">Cash</option>
                      <option value="BANK">Bankë</option>
                      <option value="CARD">Kartelë</option>
                      <option value="ONLINE">Online</option>
                    </select>
                  </div>
                  {portion1 > 0 && k1Paid < portion1 && (
                    <button
                      onClick={() => setK1("paidAmount", String(portion1))}
                      className="w-full py-1.5 rounded-lg border border-dashed border-green-300 dark:border-green-700 text-green-600 text-xs font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                    >
                      ✓ Paguar plotësisht ({formatCurrency(portion1)})
                    </button>
                  )}
                </div>

                {/* K2 */}
                <div className="border border-slate-200 dark:border-slate-600 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-200">Kësti i Dytë</p>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-medium ${k2Status.color}`}>{k2Status.label}</span>
                      {k2Existing && (
                        <button
                          onClick={() => handleDeleteInstallment(k2Existing)}
                          disabled={saving}
                          title="Fshi këtë këst"
                          className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Shuma e këstit (€)</label>
                    <input type="number" value={k2Form.portion} onChange={e => setK2("portion", e.target.value)}
                      className="form-input" placeholder="0" min="0" step="0.01" />
                  </div>
                  <div>
                    <label className="form-label">Afati</label>
                    <input type="date" value={k2Form.dueDate} onChange={e => setK2("dueDate", e.target.value)} className="form-input" />
                    <AcademicYearWarning dueDate={k2Form.dueDate} schoolYearStart={year} />
                  </div>
                  <div>
                    <label className="form-label">Paguar (€)</label>
                    <input type="number" value={k2Form.paidAmount} onChange={e => setK2("paidAmount", e.target.value)}
                      className="form-input" placeholder="0" min="0" step="0.01" />
                  </div>
                  <div>
                    <label className="form-label">Data e pagesës</label>
                    <input type="date" value={k2Form.paidDate} onChange={e => setK2("paidDate", e.target.value)} className="form-input" />
                  </div>
                  <div>
                    <label className="form-label">Mënyra</label>
                    <select value={k2Form.method} onChange={e => setK2("method", e.target.value)} className="form-input">
                      <option value="CASH">Cash</option>
                      <option value="BANK">Bankë</option>
                      <option value="CARD">Kartelë</option>
                      <option value="ONLINE">Online</option>
                    </select>
                  </div>
                  {portion2 > 0 && k2Paid < portion2 && (
                    <button
                      onClick={() => setK2("paidAmount", String(portion2))}
                      className="w-full py-1.5 rounded-lg border border-dashed border-green-300 dark:border-green-700 text-green-600 text-xs font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors"
                    >
                      ✓ Paguar plotësisht ({formatCurrency(portion2)})
                    </button>
                  )}
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-3 gap-2 text-xs p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl">
                <div>
                  <p className="text-slate-400 mb-0.5">Total paguar</p>
                  <p className="font-bold text-green-600">{formatCurrency(k1Paid + k2Paid)}</p>
                </div>
                <div>
                  <p className="text-slate-400 mb-0.5">Borxhi</p>
                  <p className="font-bold text-red-600">{formatCurrency(Math.max(0, totalFinal - k1Paid - k2Paid))}</p>
                </div>
                <div>
                  <p className="text-slate-400 mb-0.5">Total këste</p>
                  <p className="font-bold text-primary-600">{formatCurrency(portionSum)}</p>
                </div>
              </div>
            </div>
          )}

          {/* ── MONTHLY MODE ── */}
          {mode === "monthly" && (() => {
            const totalMAmount = mForms.reduce((s, f) => s + parseFloat(f.portion || "0"), 0);
            const totalMPaid   = mForms.reduce((s, f) => s + parseFloat(f.paidAmount || "0"), 0);
            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">10 Muajt Shkollor</p>
                  <button onClick={splitEvenly} className="text-xs text-primary-600 hover:underline">
                    Ndaj njëlloj ({totalFinal > 0 ? formatCurrency(Math.round(totalFinal / 10 * 100) / 100) : "0 €"}/muaj)
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-700">
                        <th className="text-left pb-2 pr-2 font-medium">Muaji</th>
                        <th className="pb-2 pr-2 font-medium">Shuma €</th>
                        <th className="pb-2 pr-2 font-medium">Afati</th>
                        <th className="pb-2 pr-2 font-medium">Paguar €</th>
                        <th className="pb-2 pr-2 font-medium">Mënyra</th>
                        <th className="pb-2 pr-2 font-medium">Statusi</th>
                        <th className="pb-2 font-medium"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {mForms.map((mf, i) => {
                        const portionAmt = parseFloat(mf.portion || "0");
                        const paidAmt    = parseFloat(mf.paidAmount || "0");
                        const st = statusLabel(portionAmt, paidAmt, mf.dueDate);
                        return (
                          <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50">
                            <td className="py-1.5 pr-2 font-medium text-slate-600 dark:text-slate-300 whitespace-nowrap">
                              {SCHOOL_MONTHS_LBL[i]}
                            </td>
                            <td className="py-1.5 pr-2">
                              <input type="number" value={mf.portion} min="0"
                                onChange={e => setM(i, "portion", e.target.value)}
                                className="form-input py-1 w-20 text-xs text-right" placeholder="0" />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input type="date" value={mf.dueDate}
                                onChange={e => setM(i, "dueDate", e.target.value)}
                                className="form-input py-1 text-xs" />
                            </td>
                            <td className="py-1.5 pr-2">
                              <input type="number" value={mf.paidAmount} min="0"
                                onChange={e => setM(i, "paidAmount", e.target.value)}
                                className="form-input py-1 w-20 text-xs text-right" placeholder="0" />
                            </td>
                            <td className="py-1.5 pr-2">
                              <select value={mf.method} onChange={e => setM(i, "method", e.target.value)}
                                className="form-input py-1 text-xs">
                                <option value="CASH">Cash</option>
                                <option value="BANK">Bankë</option>
                                <option value="CARD">Kartelë</option>
                                <option value="ONLINE">Online</option>
                              </select>
                            </td>
                            <td className={`py-1.5 pr-2 font-medium whitespace-nowrap ${st.color}`}>{st.label}</td>
                            <td className="py-1.5">
                              {/* Vetëm kur fusha ende s'ka asnjë shumë — sapo admin fillon të
                                  shkruajë një pagesë të pjesshme (p.sh. 500 nga 1000), butoni
                                  fshihet, që të mos "kërcejë" gabimisht te shuma e plotë nëse
                                  klikohet aksidentalisht pranë fushës numerike. */}
                              {portionAmt > 0 && paidAmt === 0 && (
                                <button onClick={() => setM(i, "paidAmount", String(portionAmt))}
                                  className="text-green-600 dark:text-green-400 hover:underline text-xs whitespace-nowrap">
                                  ✓ Pago
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-xs">
                  <div>
                    <p className="text-slate-400 mb-0.5">Total paguar</p>
                    <p className="font-bold text-green-600">{formatCurrency(totalMPaid)}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-0.5">Borxhi</p>
                    <p className="font-bold text-red-600">{formatCurrency(Math.max(0, totalMAmount - totalMPaid))}</p>
                  </div>
                  <div>
                    <p className="text-slate-400 mb-0.5">Total muajor</p>
                    <p className={`font-bold ${Math.abs(totalMAmount - totalFinal) > 0.01 && totalFinal > 0 ? "text-amber-500" : "text-primary-600"}`}>
                      {formatCurrency(totalMAmount)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })()}

          {/* ── FLEX MODE ── */}
          {mode === "flex" && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Pagesat</p>
                <button onClick={addFlexRow} className="text-xs text-primary-600 hover:underline flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Shto Pagesë
                </button>
              </div>

              {/* Çdo rresht = NJË pagesë reale e marrë në një datë — s'ka fushë të veçantë
                  "shuma e pritur" për të mos ngatërruar stafin (dy fusha për të njëjtën
                  shumë ishin konfuze: "Shuma" e kështit kundrejt "Paguar" prej tij).
                  Rreshti vetë barazon shumën e paguar me vlerën e tij — "Borxhi i mbetur"
                  llogaritet kundrejt Çmimit Bazë të gjithë planit, jo kundrejt rreshtave. */}
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="text-slate-400 border-b border-slate-100 dark:border-slate-700">
                      <th className="text-left pb-2 pr-2 font-medium">Afati</th>
                      <th className="pb-2 pr-2 font-medium">Paguar €</th>
                      <th className="pb-2 pr-2 font-medium">Data e pagesës</th>
                      <th className="pb-2 pr-2 font-medium">Mënyra</th>
                      <th className="pb-2 font-medium"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {flexRows.map((fr, i) => (
                      <tr key={i} className="border-b border-slate-100 dark:border-slate-700/50">
                        <td className="py-1.5 pr-2">
                          <input type="date" value={fr.dueDate}
                            onChange={e => setFlex(i, "dueDate", e.target.value)}
                            className="form-input py-1 text-xs" />
                          <AcademicYearWarning dueDate={fr.dueDate} schoolYearStart={year} />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input type="number" value={fr.paidAmount} min="0" step="0.01"
                            onChange={e => setFlexPaid(i, e.target.value)}
                            className="form-input py-1 w-24 text-xs text-right" placeholder="0" />
                        </td>
                        <td className="py-1.5 pr-2">
                          <input type="date" value={fr.paidDate}
                            onChange={e => setFlex(i, "paidDate", e.target.value)}
                            className="form-input py-1 text-xs" />
                        </td>
                        <td className="py-1.5 pr-2">
                          <select value={fr.method} onChange={e => setFlex(i, "method", e.target.value)}
                            className="form-input py-1 text-xs">
                            <option value="CASH">Cash</option>
                            <option value="BANK">Bankë</option>
                            <option value="CARD">Kartelë</option>
                            <option value="ONLINE">Online</option>
                          </select>
                        </td>
                        <td className="py-1.5">
                          <button onClick={() => removeFlexRow(i)} disabled={saving}
                            title="Fshi këtë këst"
                            className="p-1 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-xs">
                <div>
                  <p className="text-slate-400 mb-0.5">Total paguar</p>
                  <p className="font-bold text-green-600">{formatCurrency(flexTotalPaid)}</p>
                </div>
                <div>
                  <p className="text-slate-400 mb-0.5">Borxhi i mbetur</p>
                  <p className="font-bold text-red-600">{formatCurrency(flexTotalDebt)}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 p-5 pt-0 sticky bottom-0 bg-white dark:bg-slate-800">
          <button onClick={onClose} className="btn-secondary">
            <X className="w-4 h-4" />Anulo
          </button>
          <button onClick={() => handleSave(false)} disabled={saving} className="btn-secondary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Duke ruajtur..." : mode === "two" ? "Ruaj Këste" : mode === "monthly" ? "Ruaj Muajt" : mode === "flex" ? "Ruaj Pagesat" : "Ruaj"}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={saving || !canPrint}
            title={!canPrint ? "Fut një shumë të paguar për të printuar dëshminë" : undefined}
            className="btn-primary flex-1 justify-center whitespace-nowrap"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            Ruaj &amp; Printo Dëshminë
          </button>
        </div>
      </div>
    </div>
  );
}

/* ─── School Fee Calculator Modal ───────────────────────────── */
const ACADEMIC_MONTHS = ["Shtator", "Tetor", "Nëntor", "Dhjetor", "Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor"];

function SchoolFeeCalculatorModal({ student, categoryDefaultAmount, onClose, onApply }: {
  student: StudentRow;
  categoryDefaultAmount: number;
  onClose: () => void;
  onApply: (student: StudentRow, amount: number) => void;
}) {
  const baseAmount = student.payment?.amount || student.payment?.finalAmount || categoryDefaultAmount;
  const [fee, setFee] = useState(String(Math.round(baseAmount || categoryDefaultAmount)));
  const [selected, setSelected] = useState<boolean[]>(Array(10).fill(true));

  const feeNum = parseFloat(fee) || 0;
  const monthlyRate = feeNum / 10;
  const attendedCount = selected.filter(Boolean).length;
  const calculatedAmount = Math.round(monthlyRate * attendedCount * 100) / 100;

  function selectFirst(n: number) {
    setSelected(Array(10).fill(false).map((_, i) => i < n));
  }
  function selectLast(n: number) {
    setSelected(Array(10).fill(false).map((_, i) => i >= 10 - n));
  }
  function toggleMonth(i: number) {
    setSelected(prev => prev.map((v, j) => j === i ? !v : v));
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-500" />
              Kalkulator i Shkollimit
            </h3>
            <p className="text-sm text-slate-400 mt-0.5">
              {student.firstName} {student.lastName}
              {student.class && <span> • Klasa {student.class.name}</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          <div>
            <label className="form-label">Çmimi vjetor (€)</label>
            <input
              type="number"
              value={fee}
              onChange={e => setFee(e.target.value)}
              className="form-input"
              min="0"
              step="1"
              placeholder="0"
            />
            <p className="text-xs text-slate-400 mt-1">
              Norma mujore:{" "}
              <span className="font-semibold text-slate-600 dark:text-slate-300">
                {monthlyRate.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €/muaj
              </span>
            </p>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Nxënës largohet pas:</p>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <button key={n} onClick={() => selectFirst(n)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-600 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 dark:hover:bg-amber-900/20 transition-colors">
                  {n} muaj
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Nxënës vjen vonë (muajt e fundit):</p>
            <div className="flex flex-wrap gap-1.5">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(n => (
                <button key={n} onClick={() => selectLast(n)}
                  className="px-2.5 py-1 rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-600 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 dark:hover:bg-blue-900/20 transition-colors">
                  {n} muaj
                </button>
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Muajt e ndjekur</p>
              <div className="flex gap-2">
                <button onClick={() => setSelected(Array(10).fill(true))} className="text-xs text-primary-600 hover:underline">Të gjithë</button>
                <button onClick={() => setSelected(Array(10).fill(false))} className="text-xs text-slate-400 hover:underline">Asnjë</button>
              </div>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {ACADEMIC_MONTHS.map((m, i) => (
                <button key={i} onClick={() => toggleMonth(i)}
                  className={`py-2 rounded-lg text-xs font-medium transition-all border ${
                    selected[i]
                      ? "bg-amber-500 border-amber-500 text-white shadow-sm"
                      : "bg-slate-50 dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400"
                  }`}>
                  {m.slice(0, 3)}
                </button>
              ))}
            </div>
          </div>

          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-500">Muaj të ndjekur</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{attendedCount} / 10</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-500">Norma mujore</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {monthlyRate.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-amber-200 dark:border-amber-700 pt-2 mt-2">
              <span className="font-bold text-slate-800 dark:text-white">Total për t&apos;u paguar</span>
              <span className="text-xl font-bold text-amber-600">
                {calculatedAmount.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €
              </span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Anulo</button>
          <button
            onClick={() => onApply(student, calculatedAmount)}
            disabled={attendedCount === 0 || feeNum <= 0}
            className="btn-primary flex-1 justify-center"
          >
            <Calculator className="w-4 h-4" />
            Apliko si Pagesë
          </button>
        </div>
      </div>
    </div>
  );
}
