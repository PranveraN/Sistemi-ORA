"use client";

import { useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from "@/lib/utils";
import {
  Users, CreditCard, TrendingUp, AlertCircle,
  ArrowUpRight, CheckCircle, Clock, FileText, History, Receipt,
  TrendingDown, UserPlus, CalendarClock, Wallet,
} from "lucide-react";
import Link from "next/link";
import OfertaModal from "@/components/OfertaModal";
import TimiInvestModal from "@/components/TimiInvestModal";
import QuickActions from "@/components/dashboard/QuickActions";
import SchoolCalendar from "@/components/dashboard/SchoolCalendar";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer,
} from "recharts";

interface DashboardData {
  totalStudents: number;
  activeStudents: number;
  studentsWithDebt: number;
  monthlyRevenue: number;
  prevMonthRevenue: number;
  revenueChangePct: number | null;
  totalRevenue: number;
  overdueAmount: number;
  overdueCount: number;
  newStudentsThisMonth: number;
  expiringThisWeek: number;
  recentPayments: Array<{
    id: number;
    paidAmount: number;
    paidDate: string;
    method: string;
    status: string;
    student: { firstName: string; lastName: string };
    category: { name: string };
  }>;
  monthlyChartData: Array<{ month: string; total: number; enrolled: number }>;
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [showOferta, setShowOferta] = useState(false);
  const [ofertaView, setOfertaView] = useState<"form" | "history">("form");
  const [showTimiInvest, setShowTimiInvest] = useState(false);
  const [timiInvestEnabled, setTimiInvestEnabled] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false); });
    fetch("/api/settings")
      .then(r => r.json())
      .then(s => setTimiInvestEnabled(s.timiInvestEnabled !== "false"));
  }, []);

  if (loading) return (
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

  return (
    <>
      <Header title="Dashboard" />
      <div className="p-4 sm:p-6 space-y-6 animate-fade-in">

        {/* Quick Actions bar */}
        <QuickActions />

        {/* Quick action cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
          <button onClick={() => { setOfertaView("form"); setShowOferta(true); }}
            className="flex items-center gap-3 p-4 card hover:ring-2 hover:ring-primary-300 dark:hover:ring-primary-700 transition-all text-left group">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0 group-hover:bg-primary-100 dark:group-hover:bg-primary-900/50 transition-colors">
              <FileText className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 dark:text-white text-sm">Krijo Ofertë &amp; Parafaturë</p>
              <p className="text-xs text-slate-400 mt-0.5">Gjenero ofertë me çmimet e shërbimeve</p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-300 ml-auto flex-shrink-0 group-hover:text-primary-500 transition-colors" />
          </button>

          <button onClick={() => { setOfertaView("history"); setShowOferta(true); }}
            className="flex items-center gap-3 p-4 card hover:ring-2 hover:ring-slate-300 dark:hover:ring-slate-600 transition-all text-left group">
            <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700/60 flex items-center justify-center flex-shrink-0 group-hover:bg-slate-200 dark:group-hover:bg-slate-700 transition-colors">
              <History className="w-5 h-5 text-slate-500 dark:text-slate-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 dark:text-white text-sm">Historiku i Ofertave</p>
              <p className="text-xs text-slate-400 mt-0.5">Shiko dhe printo ofertat e ruajtura</p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-300 ml-auto flex-shrink-0 group-hover:text-slate-500 transition-colors" />
          </button>

          <Link href="/faturat-rregullta"
            className="flex items-center gap-3 p-4 card hover:ring-2 hover:ring-emerald-300 dark:hover:ring-emerald-700 transition-all text-left group">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-900/30 flex items-center justify-center flex-shrink-0 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/50 transition-colors">
              <Receipt className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 dark:text-white text-sm">Faturat e Rregullta</p>
              <p className="text-xs text-slate-400 mt-0.5">ATK · R-Kosovës · TVSH</p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-300 ml-auto flex-shrink-0 group-hover:text-emerald-500 transition-colors" />
          </Link>

          {timiInvestEnabled && (
            <button onClick={() => setShowTimiInvest(true)}
              className="flex items-center gap-3 p-4 card hover:ring-2 hover:ring-amber-300 dark:hover:ring-amber-700 transition-all text-left group">
              <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0 group-hover:bg-amber-100 dark:group-hover:bg-amber-900/50 transition-colors">
                <CreditCard className="w-5 h-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div>
                <p className="font-semibold text-slate-800 dark:text-white text-sm">TIMI INVEST</p>
                <p className="text-xs text-slate-400 mt-0.5">Nxënësit, faturat dhe profaturët</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-slate-300 ml-auto flex-shrink-0 group-hover:text-amber-500 transition-colors" />
            </button>
          )}

          <Link href="/shpenzime"
            className="flex items-center gap-3 p-4 card hover:ring-2 hover:ring-red-300 dark:hover:ring-red-700 transition-all text-left group">
            <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center flex-shrink-0 group-hover:bg-red-100 dark:group-hover:bg-red-900/50 transition-colors">
              <Wallet className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="font-semibold text-slate-800 dark:text-white text-sm">Shpenzimet</p>
              <p className="text-xs text-slate-400 mt-0.5">Regjistro dhe menaxho shpenzimet</p>
            </div>
            <ArrowUpRight className="w-4 h-4 text-slate-300 ml-auto flex-shrink-0 group-hover:text-red-500 transition-colors" />
          </Link>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">

          {/* Të Hyra Mujore + trend */}
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
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(data.monthlyRevenue)}</p>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Të Hyra Mujore</p>
            <p className="text-xs text-slate-400 mt-1">
              {revPct !== null
                ? `${revUp ? "+" : ""}${revPct}% vs muaji i kaluar (${formatCurrency(data.prevMonthRevenue)})`
                : "Muaji aktual"}
            </p>
          </div>

          {/* Nxënës Aktivë + të rinj */}
          <div className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <Users className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              {data.newStudentsThisMonth > 0 && (
                <span className="inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
                  <UserPlus className="w-3 h-3" />
                  +{data.newStudentsThisMonth} të rinj
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{data.activeStudents}</p>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Nxënës Aktivë</p>
            <p className="text-xs text-slate-400 mt-1">
              {data.newStudentsThisMonth > 0
                ? `${data.newStudentsThisMonth} të regjistruar këtë muaj`
                : `${data.totalStudents} gjithsej`}
            </p>
          </div>

          {/* Pagesa që skadojnë */}
          <div className="card p-5">
            <div className="flex items-start justify-between mb-3">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                data.expiringThisWeek > 0
                  ? "bg-amber-50 dark:bg-amber-900/30"
                  : "bg-slate-100 dark:bg-slate-700"
              }`}>
                <CalendarClock className={`w-5 h-5 ${
                  data.expiringThisWeek > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-slate-400"
                }`} />
              </div>
              {data.expiringThisWeek > 0 && (
                <span className="inline-flex items-center gap-0.5 text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                  ⚠ këtë javë
                </span>
              )}
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{data.expiringThisWeek}</p>
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Pagesa Skadojnë</p>
            <p className="text-xs text-slate-400 mt-1">
              {data.expiringThisWeek > 0 ? "Brenda 7 ditëve" : "Asnjë afat këtë javë"}
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
            <p className="text-sm font-medium text-slate-500 dark:text-slate-400 mt-0.5">Borxhe Aktive</p>
            <p className="text-xs text-slate-400 mt-1">{formatCurrency(data.overdueAmount)} total</p>
          </div>

        </div>

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
              <h2 className="section-title mb-4">Të Hyrat — 6 Muajt e Fundit</h2>
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={data.monthlyChartData}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                    tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                  <Tooltip formatter={(v: number) => [formatCurrency(v), "Të hyra"]}
                    contentStyle={{ background: "#1e293b", border: "none", borderRadius: "8px", color: "#f8fafc", fontSize: "12px" }} />
                  <Area type="monotone" dataKey="total" stroke="#2563eb" strokeWidth={2} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>

            {/* Statusi i Pagesave — horizontal */}
            <div className="card p-4">
              <h2 className="section-title mb-3">Statusi i Pagesave</h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="flex items-center gap-2.5 p-3 bg-green-50 dark:bg-green-900/20 rounded-xl">
                  <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-green-600 dark:text-green-400">Të Paguara</p>
                    <p className="text-sm font-bold text-green-700 dark:text-green-300">{formatCurrency(data.totalRevenue)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-3 bg-red-50 dark:bg-red-900/20 rounded-xl">
                  <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-red-600 dark:text-red-400">Borxhe</p>
                    <p className="text-sm font-bold text-red-700 dark:text-red-300">{formatCurrency(data.overdueAmount)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                  <Clock className="w-4 h-4 text-amber-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-amber-600 dark:text-amber-400">Vonuar</p>
                    <p className="text-sm font-bold text-amber-700 dark:text-amber-300">{data.overdueCount} nxënës</p>
                  </div>
                </div>
                <div className="flex items-center gap-2.5 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                  <Users className="w-4 h-4 text-blue-600 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-blue-600 dark:text-blue-400">Nxënës Aktivë</p>
                    <p className="text-sm font-bold text-blue-700 dark:text-blue-300">{data.activeStudents}</p>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Recent Payments */}
        <div className="card">
          <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
            <h2 className="section-title">Pagesat e Fundit</h2>
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
                      Asnjë pagesë e regjistruar
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {showOferta && <OfertaModal initialView={ofertaView} onClose={() => setShowOferta(false)} />}
      {showTimiInvest && <TimiInvestModal onClose={() => setShowTimiInvest(false)} />}
    </>
  );
}
