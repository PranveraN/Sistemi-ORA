"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  Wallet, TrendingUp, TrendingDown, Landmark, AlertCircle,
  AlertTriangle, Loader2, MessageSquare,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import type { YearType } from "@/lib/academicYear";
import TuitionGroupModal, { type TuitionGroupRow } from "./TuitionGroupModal";

interface Row extends TuitionGroupRow { className: string | null }
interface Bucket { count: number; amount: number; students: Row[] }
interface PriceGroup { price: number; count: number; total: number }
interface Overview {
  period: { year: number; yearType: YearType; label: string };
  kpi: { expected: number; paid: number; expenses: number; handedOver: number; debt: number; totalStudents: number };
  statusBuckets: { full: Bucket; partial: Bucket; tiUnpaid: Bucket; tiPartial: Bucket; zero: Bucket };
  priceGroups: PriceGroup[];
  incomeStatement: { tuitionIncome: number; otherIncome: number; totalIncome: number; expenseLines: { name: string; amount: number }[]; totalExpenses: number; profit: number };
  anomalies: { noPaymentNoTi: Bucket; missingPlan: Bucket; overpaid: Bucket; handoverGap: number };
}

const DONUT_COLORS = { full: "#10b981", partial: "#f59e0b", tiPartial: "#3b82f6", tiUnpaid: "#8b5cf6", zero: "#a855f7" };

export default function ShkollimiFinancialOverview({ year, yearType }: { year: number; yearType: YearType }) {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [openBucket, setOpenBucket] = useState<{ title: string; rows: Row[] } | null>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/dashboard/shkollimi-financiare?year=${year}&yearType=${yearType}`)
      .then(r => r.ok ? r.json() : null)
      .then(setData)
      .finally(() => setLoading(false));
  }, [year, yearType]);

  if (loading || !data) {
    return (
      <div className="card p-10 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
      </div>
    );
  }

  const { kpi, statusBuckets, priceGroups, incomeStatement, anomalies } = data;
  const b = statusBuckets;
  const donutData = [
    { key: "full", label: "Plotësisht të Paguar", value: b.full.count, color: DONUT_COLORS.full },
    { key: "partial", label: "Pagesë e Pjesshme", value: b.partial.count, color: DONUT_COLORS.partial },
    { key: "tiPartial", label: "TIMI Invest — Pjesërisht", value: b.tiPartial.count, color: DONUT_COLORS.tiPartial },
    { key: "tiUnpaid", label: "TIMI Invest — Pa Paguar", value: b.tiUnpaid.count, color: DONUT_COLORS.tiUnpaid },
    { key: "zero", label: "Pa Pagesë (Borxh i Plotë)", value: b.zero.count, color: DONUT_COLORS.zero },
  ].filter(d => d.value > 0);

  const barData = [
    { name: "Pritur", total: kpi.expected },
    { name: "Paguar", total: kpi.paid },
    { name: "Shpenzime", total: kpi.expenses },
    { name: "Borxh", total: kpi.debt },
  ];

  const anomalyLines: string[] = [];
  if (anomalies.noPaymentNoTi.count > 0) anomalyLines.push(`${anomalies.noPaymentNoTi.count} nxënës nuk kanë asnjë pagesë dhe s'janë të regjistruar me TIMI Invest.`);
  if (anomalies.missingPlan.count > 0) anomalyLines.push(`${anomalies.missingPlan.count} nxënës kanë pagesë(a) të regjistruar, por s'kanë "Mënyrë Pagese" të zgjedhur — rregulloni derisa të mos ketë mospërputhje.`);
  if (anomalies.overpaid.count > 0) anomalyLines.push(`${anomalies.overpaid.count} nxënës kanë paguar më shumë se çmimi i caktuar.`);
  if (anomalies.handoverGap > 0.5) anomalyLines.push(`Shuma e dorëzuar (${formatCurrency(kpi.handedOver)}) është më e vogël se totali i paguar (${formatCurrency(kpi.paid)}) — mungojnë ${formatCurrency(anomalies.handoverGap)}.`);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Landmark className="w-4.5 h-4.5 text-primary-500" />
        <h2 className="section-title">Pasqyra Financiare e Shkollimit — {data.period.label}</h2>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <KpiCard icon={Wallet} tone="slate" label="Total i Pritur" value={kpi.expected} sub={`${kpi.totalStudents} nxënës`} />
        <KpiCard icon={TrendingUp} tone="green" label="Total i Paguar" value={kpi.paid} sub={kpi.expected > 0 ? `${Math.round((kpi.paid / kpi.expected) * 100)}% e shumës` : ""} />
        <KpiCard icon={TrendingDown} tone="orange" label="Shuma e Shpenzimeve" value={kpi.expenses} />
        <KpiCard icon={Landmark} tone="violet" label="Shuma e Dorëzuar" value={kpi.handedOver} sub={kpi.paid > 0 ? `${Math.round((kpi.handedOver / kpi.paid) * 100)}% e paguarës` : ""} />
        <KpiCard icon={AlertCircle} tone="red" label="Borxhi i Mbetur" value={kpi.debt} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Donut */}
        <div className="card p-4">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Statusi i Pagesave të Nxënësve</p>
          <div className="flex items-center gap-4">
            <div className="w-32 h-32 shrink-0 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" innerRadius={38} outerRadius={58} paddingAngle={2}>
                    {donutData.map(d => <Cell key={d.key} fill={d.color} />)}
                  </Pie>
                  <Tooltip formatter={(v: number, _n, p) => [`${v} nxënës`, p.payload.label]} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-lg font-bold text-slate-800 dark:text-white">{kpi.totalStudents}</p>
                <p className="text-[10px] text-slate-400">nxënës</p>
              </div>
            </div>
            <div className="space-y-1.5 text-xs min-w-0">
              {donutData.map(d => (
                <div key={d.key} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-slate-500 dark:text-slate-400 truncate">{d.label} ({d.value})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bar chart */}
        <div className="card p-4">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Krahasimi i Shumave</p>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "#1e293b", border: "none", borderRadius: "8px", color: "#f8fafc", fontSize: "12px" }} />
              <Bar dataKey="total" fill="#7c3aed" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Debt details */}
        <div className="card p-4">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Detajet e Borxheve</p>
          <div className="space-y-1.5">
            <DebtRow label="Borxh i Plotë" bucket={b.zero} tone="text-red-600" onOpen={() => setOpenBucket({ title: "Borxh i Plotë (Pa Pagesë)", rows: b.zero.students })} />
            <DebtRow label="Pagesë e Pjesshme" bucket={b.partial} tone="text-amber-600" onOpen={() => setOpenBucket({ title: "Pagesë e Pjesshme", rows: b.partial.students })} />
            <DebtRow label="TIMI Invest — Pa Paguar" bucket={b.tiUnpaid} tone="text-violet-600" onOpen={() => setOpenBucket({ title: "TIMI Invest — Pa Paguar", rows: b.tiUnpaid.students })} />
            <DebtRow label="TIMI Invest — Pjesërisht" bucket={b.tiPartial} tone="text-blue-600" onOpen={() => setOpenBucket({ title: "TIMI Invest — Paguar Pjesërisht", rows: b.tiPartial.students })} />
            <div className="flex items-center justify-between pt-2 mt-1 border-t border-slate-100 dark:border-slate-700">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Total Borxh i Mbetur</span>
              <span className="text-sm font-bold text-red-600">{formatCurrency(kpi.debt)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Price groups table */}
        <div className="card p-4 overflow-hidden">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Të Ardhurat nga Shkollimi (sipas çmimit)</p>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase">
                  <th className="pb-1.5 font-semibold">Çmimi</th>
                  <th className="pb-1.5 font-semibold text-right">Nr. Nxënësve</th>
                  <th className="pb-1.5 font-semibold text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {priceGroups.map(g => (
                  <tr key={g.price}>
                    <td className="py-1.5 text-slate-700 dark:text-slate-200">{formatCurrency(g.price)}</td>
                    <td className="py-1.5 text-right text-slate-500 dark:text-slate-400">{g.count}</td>
                    <td className="py-1.5 text-right font-semibold text-slate-800 dark:text-white">{formatCurrency(g.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200 dark:border-slate-700 font-bold">
                  <td className="pt-1.5">TOTALI I PRITUR</td>
                  <td className="pt-1.5 text-right">{kpi.totalStudents}</td>
                  <td className="pt-1.5 text-right">{formatCurrency(kpi.expected)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>

        {/* Income statement */}
        <div className="card p-4">
          <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2">Pasqyra e të Ardhurave dhe Shpenzimeve</p>
          <div className="text-sm space-y-1">
            <p className="text-xs font-bold text-green-600 uppercase tracking-wide mt-1">Të Ardhurat</p>
            <Line label="Të ardhura nga Shkollimi (të paguara)" value={incomeStatement.tuitionIncome} />
            <Line label="Të ardhura të tjera" value={incomeStatement.otherIncome} />
            <Line label="Total të Ardhura" value={incomeStatement.totalIncome} bold />
            <p className="text-xs font-bold text-red-600 uppercase tracking-wide mt-3">Shpenzimet</p>
            {incomeStatement.expenseLines.length === 0 ? (
              <p className="text-xs text-slate-400">Asnjë shpenzim i regjistruar këtë periudhë.</p>
            ) : incomeStatement.expenseLines.map(e => <Line key={e.name} label={e.name} value={e.amount} />)}
            <Line label="Total Shpenzime" value={incomeStatement.totalExpenses} bold />
            <div className="flex items-center justify-between pt-2 mt-2 border-t border-slate-200 dark:border-slate-700">
              <span className="font-bold text-slate-800 dark:text-white">FITIMI / (HUMBJA)</span>
              <span className={`font-bold ${incomeStatement.profit >= 0 ? "text-green-600" : "text-red-600"}`}>{formatCurrency(incomeStatement.profit)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Anomalies */}
      {anomalyLines.length > 0 && (
        <div className="card p-4 bg-amber-50/60 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
          <p className="text-sm font-bold text-amber-700 dark:text-amber-400 mb-2 flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" /> Vërejtje dhe Kontrolle
          </p>
          <ul className="text-xs text-amber-700 dark:text-amber-400 space-y-1 list-disc list-inside">
            {anomalyLines.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </div>
      )}

      {openBucket && (
        <TuitionGroupModal title={openBucket.title} rows={openBucket.rows} onClose={() => setOpenBucket(null)} />
      )}
    </div>
  );
}

function KpiCard({ icon: Icon, tone, label, value, sub }: { icon: React.ComponentType<{ className?: string }>; tone: "slate" | "green" | "orange" | "violet" | "red"; label: string; value: number; sub?: string }) {
  const toneMap = {
    slate: { bg: "bg-slate-50 dark:bg-slate-800/60", icon: "text-slate-400", text: "text-slate-800 dark:text-white" },
    green: { bg: "bg-green-50 dark:bg-green-900/20", icon: "text-green-500", text: "text-green-700 dark:text-green-300" },
    orange: { bg: "bg-orange-50 dark:bg-orange-900/20", icon: "text-orange-500", text: "text-orange-700 dark:text-orange-300" },
    violet: { bg: "bg-violet-50 dark:bg-violet-900/20", icon: "text-violet-500", text: "text-violet-700 dark:text-violet-300" },
    red: { bg: "bg-red-50 dark:bg-red-900/20", icon: "text-red-500", text: "text-red-700 dark:text-red-300" },
  }[tone];
  return (
    <div className={`p-3.5 rounded-xl ${toneMap.bg}`}>
      <Icon className={`w-4 h-4 ${toneMap.icon} mb-1.5`} />
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className={`text-lg font-bold ${toneMap.text}`}>{formatCurrency(value)}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function DebtRow({ label, bucket, tone, onOpen }: { label: string; bucket: Bucket; tone: string; onOpen: () => void }) {
  if (bucket.count === 0) return null;
  return (
    <button onClick={onOpen} className="w-full flex items-center justify-between gap-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg px-1.5 py-1 -mx-1.5 transition-colors">
      <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
        <MessageSquare className="w-3 h-3 text-slate-300 shrink-0" />
        {label} <span className="text-slate-400">({bucket.count})</span>
      </span>
      <span className={`font-semibold ${tone}`}>{formatCurrency(bucket.amount)}</span>
    </button>
  );
}

function Line({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "font-bold text-slate-800 dark:text-white pt-1 border-t border-slate-100 dark:border-slate-700" : "text-slate-500 dark:text-slate-400"}`}>
      <span>{label}</span>
      <span>{formatCurrency(value)}</span>
    </div>
  );
}
