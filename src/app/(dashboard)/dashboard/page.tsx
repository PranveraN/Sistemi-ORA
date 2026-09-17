"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/layout/Header";
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from "@/lib/utils";
import {
  Users, CreditCard, TrendingUp, AlertCircle,
  CheckCircle, Clock, FileText, History, Receipt,
  TrendingDown, UserPlus, CalendarClock, Wallet,
  GraduationCap, Landmark, Wallet as WalletIcon,
} from "lucide-react";
import Link from "next/link";
import OfertaModal from "@/components/OfertaModal";
import TimiInvestModal from "@/components/TimiInvestModal";
import QuickActions from "@/components/dashboard/QuickActions";
import SchoolCalendar from "@/components/dashboard/SchoolCalendar";
import FinancialOverview from "@/components/dashboard/FinancialOverview";
import YearPicker from "@/components/dashboard/YearPicker";
import { ACADEMIC_YEARS, CALENDAR_YEARS, DEFAULT_ACADEMIC_YEAR, type YearType } from "@/lib/academicYear";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

interface DashboardData {
  period: { year: number; yearType: YearType; label: string };
  totalStudents: number;
  activeStudents: number;
  cycleCounts: { ulet: number; larte: number; paCaktuar: number };
  studentsWithDebt: number;
  periodRevenue: number;
  prevPeriodRevenue: number;
  revenueChangePct: number | null;
  totalRevenue: number;
  totalDebtAmount: number;
  overdueAmount: number;
  overdueCount: number;
  newInPeriod: number;
  newStudents: {
    count: number;
    students: Array<{ id: number; firstName: string; lastName: string; className: string | null; originCountry: string | null; enrollDate: string }>;
  };
  recentPayments: Array<{
    id: number;
    paidAmount: number;
    paidDate: string;
    method: string;
    status: string;
    student: { firstName: string; lastName: string };
    category: { name: string };
  }>;
  monthlyChartData: Array<{ month: string; total: number; isFuture: boolean }>;
  tuitionOverview: {
    expected: number;
    paid: number;
    debt: number;
    timiInvestCount: number;
    timiInvestExpected: number;
    expenses: number;
  };
}

export default function DashboardPage() {
  const [yearType, setYearType] = useState<YearType>("academic");
  const [year, setYear] = useState(DEFAULT_ACADEMIC_YEAR);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOferta, setShowOferta] = useState(false);
  const [ofertaView, setOfertaView] = useState<"form" | "history">("form");
  const [showTimiInvest, setShowTimiInvest] = useState(false);
  const [timiInvestEnabled, setTimiInvestEnabled] = useState(true);
  const [mainTab, setMainTab] = useState<"permbledhje" | "financat">("permbledhje");

  const years = yearType === "academic" ? ACADEMIC_YEARS : CALENDAR_YEARS;

  function switchYearType(yt: YearType) {
    setYearType(yt);
    const yrs = yt === "academic" ? ACADEMIC_YEARS : CALENDAR_YEARS;
    if (!yrs.includes(year)) setYear(yrs[yrs.length - 2] ?? yrs[0]);
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/dashboard?year=${year}&yearType=${yearType}`);
    const d = await r.json();
    setData(d);
    setLoading(false);
  }, [year, yearType]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => {
    fetch("/api/settings")
      .then(r => r.json())
      .then(s => setTimiInvestEnabled(s.timiInvestEnabled !== "false"));
  }, []);

  if (loading && !data) return (
    <>
      <Header title="Dashboard" />
      <div className="p-6 flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <svg className="animate-spin" width="32" height="32" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm">Duke ngarkuar...</p>
        </div>
      </div>
    </>
  );

  if (!data) return null;

  const revPct = data.revenueChangePct;
  const revUp  = revPct !== null && revPct >= 0;

  // Grafiku — ndaj "deri tani" (vijë e plotë) nga muajt e ardhshëm (vijë e
  // ndërprerë) — përndryshe një vit sapo-fillo duket sikur të hyrat "u shembën".
  const firstFutureIdx = data.monthlyChartData.findIndex(m => m.isFuture);
  const chartData = data.monthlyChartData.map((m, i) => ({
    month: m.month,
    total: firstFutureIdx === -1 || i < firstFutureIdx ? m.total : undefined,
    totalFuture: firstFutureIdx === -1 ? undefined : (i >= firstFutureIdx - 1 ? m.total : undefined),
  }));

  const tuitionCoveredPct = data.totalRevenue + data.totalDebtAmount > 0
    ? Math.round((data.totalRevenue / (data.totalRevenue + data.totalDebtAmount)) * 100)
    : 0;

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-4 sm:p-6 space-y-6 animate-fade-in">

        {/* Selektori i periudhës — Akademik/Kalendarik + Viti, si te Bilanci/Shkollimi.
            Krejt faqja (përfshi kartat më poshtë) respekton këtë periudhë. */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 text-sm font-medium">
            {([["calendar", "📅 Kalendarik"], ["academic", "🎓 Akademik"]] as [YearType, string][]).map(([yt, lbl]) => (
              <button key={yt} onClick={() => switchYearType(yt)}
                className={`px-4 py-2 transition-colors ${yearType === yt ? "bg-primary-600 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                {lbl}
              </button>
            ))}
          </div>
          <YearPicker years={years} year={year} yearType={yearType} onSelect={setYear} />
          {loading && <Clock className="w-4 h-4 text-slate-300 animate-spin" />}
        </div>

        {/* Veprime — një zonë e vetme (bar-i + kartat kompakte poshtë tij) */}
        <div className="space-y-2">
          <QuickActions />
          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-5 gap-2">
            {[
              { icon: FileText,   label: "Krijo Ofertë & Parafaturë", color: "text-primary-600 dark:text-primary-400", bg: "bg-primary-50 dark:bg-primary-900/30", onClick: () => { setOfertaView("form"); setShowOferta(true); } },
              { icon: History,    label: "Historiku i Ofertave",      color: "text-slate-500 dark:text-slate-400",     bg: "bg-slate-100 dark:bg-slate-700/60",    onClick: () => { setOfertaView("history"); setShowOferta(true); } },
              { icon: Receipt,    label: "Faturat e Rregullta",       color: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-50 dark:bg-emerald-900/30", href: "/faturat-rregullta" },
              ...(timiInvestEnabled ? [{ icon: CreditCard, label: "TIMI INVEST", color: "text-amber-600 dark:text-amber-400", bg: "bg-amber-50 dark:bg-amber-900/30", onClick: () => setShowTimiInvest(true) }] : []),
              { icon: Wallet,     label: "Shpenzimet",                color: "text-red-600 dark:text-red-400",         bg: "bg-red-50 dark:bg-red-900/30",         href: "/shpenzime" },
            ].map((a, i) => {
              const Icon = a.icon;
              const content = (
                <>
                  <div className={`w-8 h-8 rounded-lg ${a.bg} flex items-center justify-center flex-shrink-0`}>
                    <Icon className={`w-4 h-4 ${a.color}`} />
                  </div>
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300 truncate">{a.label}</span>
                </>
              );
              const cls = "flex items-center gap-2 px-3 py-2 card hover:ring-2 hover:ring-primary-200 dark:hover:ring-primary-800 transition-all text-left";
              return a.href
                ? <Link key={i} href={a.href} className={cls}>{content}</Link>
                : <button key={i} onClick={a.onClick} className={cls}>{content}</button>;
            })}
          </div>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

          {/* Të Hyra + trend */}
          <div className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
              </div>
              {revPct !== null && (
                <span className={`inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full ${
                  revUp
                    ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                    : "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
                }`}>
                  {revUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {revUp ? "+" : ""}{revPct}%
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(data.periodRevenue)}</p>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Të Hyra — {data.period.label}</p>
            <p className="text-xs text-slate-400 mt-1">
              {revPct !== null
                ? `${revUp ? "+" : ""}${revPct}% vs periudha e kaluar (${formatCurrency(data.prevPeriodRevenue)})`
                : "Vit i ri — pa krahasim ende"}
            </p>
          </div>

          {/* Nxënës Aktivë + të rinj */}
          <div className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              {data.newInPeriod > 0 && (
                <span className="inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
                  <UserPlus className="w-3 h-3" />
                  +{data.newInPeriod} të rinj
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{data.activeStudents}</p>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Nxënës Aktivë</p>
            <div className="flex items-center gap-3 mt-1.5 text-xs">
              <span className="text-slate-500 dark:text-slate-400">
                <span className="font-bold text-slate-700 dark:text-slate-200">{data.cycleCounts.ulet}</span> Cikli Ulët
              </span>
              <span className="text-slate-500 dark:text-slate-400">
                <span className="font-bold text-slate-700 dark:text-slate-200">{data.cycleCounts.larte}</span> Cikli Lartë
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {data.newInPeriod > 0
                ? `${data.newInPeriod} të regjistruar gjatë kësaj periudhe`
                : `${data.totalStudents} gjithsej`}
            </p>
          </div>

          {/* Pagesa të vonuara */}
          <div className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                data.overdueCount > 0
                  ? "bg-amber-50 dark:bg-amber-900/30"
                  : "bg-slate-100 dark:bg-slate-700"
              }`}>
                <CalendarClock className={`w-5 h-5 ${
                  data.overdueCount > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-slate-400"
                }`} />
              </div>
              {data.overdueCount > 0 && (
                <span className="inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                  ⚠ vonuar
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{data.overdueCount}</p>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Pagesa të Vonuara</p>
            <p className="text-xs text-slate-400 mt-1">
              {data.overdueCount > 0 ? `${formatCurrency(data.overdueAmount)} gjithsej` : "Asnjë pagesë e vonuar"}
            </p>
          </div>

          {/* Borxhe */}
          <div className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center">
                <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <CreditCard className="w-4 h-4 text-slate-300" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{data.studentsWithDebt}</p>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Borxhe — {data.period.label}</p>
            <p className="text-xs text-slate-400 mt-1">{formatCurrency(data.totalDebtAmount)} total</p>
          </div>

        </div>

        {/* Pasqyrë Shkollimi — vetëm kategoria Shkollimi, për vitin e zgjedhur */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <GraduationCap className="w-4.5 h-4.5 text-primary-500" />
            <h2 className="section-title">Pasqyrë Shkollimi — {data.period.label}</h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60">
              <p className="text-xs text-slate-400 mb-0.5">Pritet gjithsej</p>
              <p className="text-lg font-bold text-slate-800 dark:text-white">{formatCurrency(data.tuitionOverview.expected)}</p>
            </div>
            <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/20">
              <p className="text-xs text-green-600 dark:text-green-400 mb-0.5">Paguar</p>
              <p className="text-lg font-bold text-green-700 dark:text-green-300">{formatCurrency(data.tuitionOverview.paid)}</p>
            </div>
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20">
              <p className="text-xs text-red-600 dark:text-red-400 mb-0.5">Borxh</p>
              <p className="text-lg font-bold text-red-700 dark:text-red-300">{formatCurrency(data.tuitionOverview.debt)}</p>
            </div>
            <div className="p-3 rounded-xl bg-violet-50 dark:bg-violet-900/20">
              <p className="text-xs text-violet-600 dark:text-violet-400 mb-0.5 flex items-center gap-1">
                <Landmark className="w-3 h-3" /> Përmes TIMI Invest
              </p>
              <p className="text-lg font-bold text-violet-700 dark:text-violet-300">{formatCurrency(data.tuitionOverview.timiInvestExpected)}</p>
              <p className="text-[11px] text-violet-500 dark:text-violet-400 mt-0.5">{data.tuitionOverview.timiInvestCount} nxënës</p>
            </div>
            <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20">
              <p className="text-xs text-orange-600 dark:text-orange-400 mb-0.5 flex items-center gap-1">
                <WalletIcon className="w-3 h-3" /> Shpenzime (faturat)
              </p>
              <p className="text-lg font-bold text-orange-700 dark:text-orange-300">{formatCurrency(data.tuitionOverview.expenses)}</p>
            </div>
          </div>
        </div>

        {/* Nxënës të Rinj — regjistruar gjatë periudhës/vitit të zgjedhur në
            faqe (e njëjta periudhë si badge-i "+X të rinj" te karta "Nxënës
            Aktivë" sipër, që numrat të përputhen gjithmonë). */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <UserPlus className="w-4.5 h-4.5 text-primary-500" />
            <h2 className="section-title">Nxënës të Rinj — {data.newStudents.count} — {data.period.label}</h2>
          </div>
          {data.newStudents.count === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">Asnjë nxënës i ri i regjistruar në këtë periudhë.</p>
          ) : (
            <div className="max-h-64 overflow-y-auto space-y-1.5 pr-1">
              {data.newStudents.students.map(s => (
                <Link
                  key={s.id}
                  href={`/students/${s.id}`}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors"
                >
                  <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                    {s.firstName} {s.lastName}
                    {s.className && <span className="text-slate-400 font-normal"> · {s.className}</span>}
                  </span>
                  <span className="flex items-center gap-2 shrink-0">
                    {s.originCountry ? (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 font-medium">
                        {s.originCountry}
                      </span>
                    ) : (
                      <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-400">
                        Kosovë
                      </span>
                    )}
                    <span className="text-xs text-slate-400">{formatDate(s.enrollDate)}</span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Tabs — Përmbledhje vs Financat e Detajuara */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
          {([["permbledhje", "Përmbledhje"], ["financat", "Financat e Detajuara"]] as const).map(([key, label]) => (
            <button key={key} onClick={() => setMainTab(key)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${mainTab === key ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}>
              {label}
            </button>
          ))}
        </div>

        {mainTab === "permbledhje" && (
          <>
            {/* Kalendarit + Grafiku + Statusi */}
            <div className="grid grid-cols-1 xl:grid-cols-4 gap-4">

              {/* Kalendari */}
              <div className="xl:col-span-1">
                <SchoolCalendar />
              </div>

              {/* Grafiku + Statusi */}
              <div className="xl:col-span-3 flex flex-col gap-4">

                {/* Revenue Chart */}
                <div className="card p-5 flex-1">
                  <h2 className="section-title mb-4">Të Hyrat — {data.period.label}</h2>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                          <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="colorRevenueFuture" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#94a3b8" stopOpacity={0.1} />
                          <stop offset="95%" stopColor="#94a3b8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                        tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                      <Tooltip formatter={(v: number, key: string) => [formatCurrency(v), key === "totalFuture" ? "Ende s'ka ardhur" : "Të hyra"]}
                        contentStyle={{ background: "#1e293b", border: "none", borderRadius: "8px", color: "#f8fafc", fontSize: "12px" }} />
                      <Area type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} fill="url(#colorRevenue)" connectNulls={false} />
                      <Area type="monotone" dataKey="totalFuture" stroke="#94a3b8" strokeWidth={2} strokeDasharray="5 5" fill="url(#colorRevenueFuture)" connectNulls={false} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>

                {/* Statusi i Pagesave — horizontal, thjeshtuar (Borxhe/Nxënës Aktivë tashmë lart) */}
                <div className="card p-4">
                  <h2 className="section-title mb-3">Statusi i Pagesave</h2>
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div className="flex items-center gap-2.5 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                      <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-green-600 dark:text-green-400">Të Paguara</p>
                        <p className="text-sm font-bold text-green-700 dark:text-green-300">{formatCurrency(data.totalRevenue)}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                      <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                      <div>
                        <p className="text-xs text-amber-600 dark:text-amber-400">Vonuar</p>
                        <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{formatCurrency(data.overdueAmount)}</p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                      <span>Mbuluar nga pagesat</span>
                      <span className="font-semibold text-slate-600 dark:text-slate-300">{tuitionCoveredPct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-red-100 dark:bg-red-900/30 overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${tuitionCoveredPct}%` }} />
                    </div>
                  </div>
                </div>

              </div>
            </div>
          </>
        )}

        {mainTab === "financat" && (
          <>
            {/* Recent Payments */}
            <div className="card">
              <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
                <h2 className="section-title">Pagesat e Fundit — {data.period.label}</h2>
                <a href="/payments" className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium">
                  Shiko të gjitha →
                </a>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="table-header">Nxënësi</th>
                      <th className="table-header">Kategoria</th>
                      <th className="table-header">Shuma</th>
                      <th className="table-header">Metoda</th>
                      <th className="table-header">Data</th>
                      <th className="table-header">Statusi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {data.recentPayments.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                        <td className="table-cell font-medium text-slate-900 dark:text-white">
                          {p.student.firstName} {p.student.lastName}
                        </td>
                        <td className="table-cell text-slate-500 dark:text-slate-400">{p.category.name}</td>
                        <td className="table-cell font-semibold text-slate-900 dark:text-white">
                          {formatCurrency(p.paidAmount)}
                        </td>
                        <td className="table-cell text-slate-500 dark:text-slate-400">
                          {getStatusLabel(p.method)}
                        </td>
                        <td className="table-cell text-slate-500 dark:text-slate-400">
                          {formatDate(p.paidDate)}
                        </td>
                        <td className="table-cell">
                          <span className={`badge ${getStatusColor(p.status)}`}>
                            {getStatusLabel(p.status)}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {data.recentPayments.length === 0 && (
                      <tr>
                        <td colSpan={6} className="table-cell text-center text-slate-400 py-8">
                          Asnjë pagesë e regjistruar për këtë periudhë
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Pasqyrë Financiare — respekton të njëjtën periudhë të zgjedhur sipër */}
            <FinancialOverview yearType={yearType} year={year} />
          </>
        )}
      </div>

      {showOferta && <OfertaModal initialView={ofertaView} onClose={() => setShowOferta(false)} />}
      {showTimiInvest && <TimiInvestModal onClose={() => setShowTimiInvest(false)} />}
    </>
  );
}
