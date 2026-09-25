"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/layout/Header";
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from "@/lib/utils";
import {
  Users, CreditCard, TrendingUp, AlertCircle,
  Clock, FileText, History, Receipt,
  TrendingDown, UserPlus, CalendarClock, Wallet,
  ArrowRightLeft, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import OfertaModal from "@/components/OfertaModal";
import TimiInvestModal from "@/components/TimiInvestModal";
import QuickActions from "@/components/dashboard/QuickActions";
import FinancialOverview from "@/components/dashboard/FinancialOverview";
import YearPicker from "@/components/dashboard/YearPicker";
import ShkollimiFinancialOverview from "@/components/dashboard/ShkollimiFinancialOverview";
import { ACADEMIC_YEARS, CALENDAR_YEARS, DEFAULT_ACADEMIC_YEAR, type YearType } from "@/lib/academicYear";

interface DashboardData {
  period: { year: number; yearType: YearType; label: string };
  totalStudents: number;
  activeStudents: number;
  cycleCounts: { ulet: number; larte: number; paCaktuar: number };
  periodRevenue: number;
  prevPeriodRevenue: number;
  revenueChangePct: number | null;
  overdueStudentsPartial: number;
  overdueStudentsFull: number;
  newInPeriod: number;
  newStudents: {
    count: number;
    students: Array<{
      id: number; firstName: string; lastName: string; className: string | null;
      originCountry: string | null; enrollDate: string;
      previousSchool: string | null; transferResult: string | null; admissionScore: number | null; studentRating: string | null;
    }>;
  };
  departedStudents: {
    count: number;
    students: Array<{
      id: number; firstName: string; lastName: string; className: string | null;
      leaveReason: string | null; destinationSchool: string | null; inactiveDate: string;
    }>;
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
  tuitionOverview: {
    expected: number;
    paid: number;
    debt: number;
    debtStudentCount: number;
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

        {/* KPI Cards — kompakte, lartësi e njëjtë (items-stretch nga grid-i) */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">

          {/* Të Hyra + trend */}
          <div className="card p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
              </div>
              {revPct !== null && (
                <span className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full ${
                  revUp
                    ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"
                    : "bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400"
                }`}>
                  {revUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {revUp ? "+" : ""}{revPct}%
                </span>
              )}
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{formatCurrency(data.periodRevenue)}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate">Të Hyra Shkollimi — {data.period.label}</p>
            <p className="text-[11px] text-slate-400 mt-1 truncate">
              {revPct !== null
                ? `${revUp ? "+" : ""}${revPct}% vs periudha e kaluar`
                : "Vit i ri — pa krahasim ende"}
            </p>
          </div>

          {/* Nxënës Aktivë + Gjithsej */}
          <div className="card p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              {data.newInPeriod > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
                  <UserPlus className="w-3 h-3" />
                  +{data.newInPeriod}
                </span>
              )}
            </div>
            <div className="flex items-baseline gap-2">
              <p className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{data.activeStudents}</p>
              <p className="text-xs text-slate-400">Aktivë</p>
              <p className="text-sm font-semibold text-slate-400 dark:text-slate-500 ml-1">{data.totalStudents}</p>
              <p className="text-xs text-slate-400">gjithsej</p>
            </div>
            <div className="flex items-center gap-2.5 mt-1.5 text-[11px] text-slate-500 dark:text-slate-400">
              <span><span className="font-bold text-slate-700 dark:text-slate-200">{data.cycleCounts.ulet}</span> Cikli Ulët</span>
              <span><span className="font-bold text-slate-700 dark:text-slate-200">{data.cycleCounts.larte}</span> Cikli Lartë</span>
            </div>
          </div>

          {/* Pagesa të vonuara — nga nxënësit, ndarë sipas llojit */}
          <div className="card p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                data.overdueStudentsPartial + data.overdueStudentsFull > 0
                  ? "bg-amber-50 dark:bg-amber-900/30"
                  : "bg-slate-100 dark:bg-slate-700"
              }`}>
                <CalendarClock className={`w-4 h-4 ${
                  data.overdueStudentsPartial + data.overdueStudentsFull > 0
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-slate-400"
                }`} />
              </div>
              {data.overdueStudentsPartial + data.overdueStudentsFull > 0 && (
                <span className="inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400">
                  ⚠ vonuar
                </span>
              )}
            </div>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mb-1 truncate">Pagesa të Vonuara</p>
            {data.overdueStudentsPartial + data.overdueStudentsFull === 0 ? (
              <p className="text-sm text-slate-400 leading-tight">Asnjë pagesë e vonuar</p>
            ) : (
              <div className="flex items-center gap-3">
                <div>
                  <p className="text-xl font-bold text-amber-600 dark:text-amber-400 leading-tight">{data.overdueStudentsFull}</p>
                  <p className="text-[11px] text-slate-400">Pagesa e plotë</p>
                </div>
                <div>
                  <p className="text-xl font-bold text-slate-700 dark:text-slate-200 leading-tight">{data.overdueStudentsPartial}</p>
                  <p className="text-[11px] text-slate-400">Pjesa e dytë</p>
                </div>
              </div>
            )}
          </div>

          {/* Borxhe — vetëm Shkollimi */}
          <div className="card p-3.5">
            <div className="flex items-center justify-between mb-2">
              <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <AlertCircle className="w-4 h-4 text-red-600 dark:text-red-400" />
              </div>
              <CreditCard className="w-4 h-4 text-slate-300" />
            </div>
            <p className="text-xl font-bold text-slate-900 dark:text-white leading-tight">{data.tuitionOverview.debtStudentCount}</p>
            <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5 truncate">Borxhe Shkollimi — {data.period.label}</p>
            <p className="text-[11px] text-slate-400 mt-1 truncate">{formatCurrency(data.tuitionOverview.debt)} total</p>
          </div>

        </div>

        {/* Lëvizjet e Nxënësve — përmbledhje kompakte, moduli i plotë (listat,
            filtrimi, historia) jeton te faqja dedikuar /levizjet. */}
        <Link href="/levizjet" className="card p-5 block hover:ring-2 hover:ring-primary-200 dark:hover:ring-primary-800 transition-all">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <ArrowRightLeft className="w-4.5 h-4.5 text-primary-500" />
              <h2 className="section-title">Lëvizjet e Nxënësve — {data.period.label}</h2>
            </div>
            <span className="text-sm text-primary-600 dark:text-primary-400 font-medium flex items-center gap-1">
              Shiko modulin <ChevronRight className="w-4 h-4" />
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                <UserPlus className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{data.newStudents.count}</p>
                <p className="text-xs text-slate-400 truncate">Regjistrime të Reja</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-red-50 dark:bg-red-900/30 flex items-center justify-center shrink-0">
                <UserPlus className="w-4.5 h-4.5 text-red-500 dark:text-red-400 rotate-180" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{data.departedStudents.count}</p>
                <p className="text-xs text-slate-400 truncate">Largime</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                data.newStudents.count - data.departedStudents.count >= 0
                  ? "bg-green-50 dark:bg-green-900/30" : "bg-amber-50 dark:bg-amber-900/30"
              }`}>
                <ArrowRightLeft className={`w-4.5 h-4.5 ${
                  data.newStudents.count - data.departedStudents.count >= 0
                    ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"
                }`} />
              </div>
              <div className="min-w-0">
                <p className={`text-lg font-bold leading-tight ${
                  data.newStudents.count - data.departedStudents.count >= 0
                    ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"
                }`}>
                  {data.newStudents.count - data.departedStudents.count > 0 ? "+" : ""}
                  {data.newStudents.count - data.departedStudents.count}
                </p>
                <p className="text-xs text-slate-400 truncate">Bilanci Neto</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center shrink-0">
                <Users className="w-4.5 h-4.5 text-slate-500 dark:text-slate-300" />
              </div>
              <div className="min-w-0">
                <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{data.activeStudents}</p>
                <p className="text-xs text-slate-400 truncate">Nxënës Aktivë</p>
              </div>
            </div>
          </div>
        </Link>

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
          <ShkollimiFinancialOverview year={year} yearType={yearType} />
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
