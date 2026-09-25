"use client";

import { useEffect, useState } from "react";
import { formatCurrency } from "@/lib/utils";
import {
  Wallet, TrendingUp, TrendingDown, Landmark, AlertCircle,
  AlertTriangle, Loader2, MessageSquare, PieChart as PieChartIcon,
  BarChart3, Receipt, ListChecks, Coins,
} from "lucide-react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import type { YearType } from "@/lib/academicYear";
import TuitionGroupModal, { type TuitionGroupRow } from "./TuitionGroupModal";

interface Row extends TuitionGroupRow { className: string | null }
interface Bucket { count: number; amount: number; paidAmount: number; students: Row[] }
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
const BAR_COLORS = { Pritur: "#64748b", Paguar: "#10b981", Shpenzime: "#f97316", Borxh: "#ef4444" };

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
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary-500 to-violet-600 flex items-center justify-center shadow-sm shadow-primary-500/30">
          <Landmark className="w-4 h-4 text-white" />
        </div>
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
          <SectionTitle icon={PieChartIcon} color="#8b5cf6" label="Statusi i Pagesave të Nxënësve" />
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
            <div className="space-y-2 text-xs min-w-0 flex-1">
              {donutData.map(d => (
                <div key={d.key} className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: d.color }} />
                  <span className="text-slate-500 dark:text-slate-400 truncate flex-1">{d.label}</span>
                  <span className="font-semibold shrink-0" style={{ color: d.color }}>{d.value}</span>
                  <span className="text-slate-300 dark:text-slate-600 shrink-0 w-9 text-right">{kpi.totalStudents > 0 ? Math.round((d.value / kpi.totalStudents) * 100) : 0}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Bar chart */}
        <div className="card p-4">
          <SectionTitle icon={BarChart3} color="#3b82f6" label="Krahasimi i Shumave" />
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={barData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} axisLine={false} tickLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
              <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "#1e293b", border: "none", borderRadius: "8px", color: "#f8fafc", fontSize: "12px" }} cursor={{ fill: "#f8fafc" }} />
              <Bar dataKey="total" radius={[6, 6, 0, 0]}>
                {barData.map(d => <Cell key={d.name} fill={BAR_COLORS[d.name as keyof typeof BAR_COLORS]} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Debt details */}
        <div className="card p-4">
          <SectionTitle icon={AlertCircle} color="#ef4444" label="Detajet e Borxheve" />
          <div className="space-y-1">
            <DebtRow label="Borxh i Plotë" bucket={b.zero} color={DONUT_COLORS.zero} onOpen={() => setOpenBucket({ title: "Borxh i Plotë (Pa Pagesë)", rows: b.zero.students })} />
            <DebtRow label="Pagesë e Pjesshme" bucket={b.partial} color={DONUT_COLORS.partial} onOpen={() => setOpenBucket({ title: "Pagesë e Pjesshme", rows: b.partial.students })} />
            <DebtRow label="TIMI Invest — Pa Paguar" bucket={b.tiUnpaid} color={DONUT_COLORS.tiUnpaid} onOpen={() => setOpenBucket({ title: "TIMI Invest — Pa Paguar", rows: b.tiUnpaid.students })} />
            <DebtRow label="TIMI Invest — Pjesërisht" bucket={b.tiPartial} color={DONUT_COLORS.tiPartial} onOpen={() => setOpenBucket({ title: "TIMI Invest — Paguar Pjesërisht", rows: b.tiPartial.students })} />
            <div className="flex items-center justify-between pt-2.5 mt-1.5 border-t-2 border-red-100 dark:border-red-900/40">
              <span className="text-sm font-bold text-slate-700 dark:text-slate-200">Total Borxh i Mbetur</span>
              <span className="text-sm font-bold text-red-600">{formatCurrency(kpi.debt)}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Price groups table */}
        <div className="card p-4 overflow-hidden">
          <SectionTitle icon={Coins} color="#64748b" label="Të Ardhurat nga Shkollimi (sipas çmimit)" />
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/60">
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
          <SectionTitle icon={Receipt} color="#10b981" label="Pasqyra e të Ardhurave dhe Shpenzimeve" />
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

        {/* Pagesat dhe Statusi */}
        <div className="card p-4 overflow-hidden">
          <SectionTitle icon={ListChecks} color="#f59e0b" label="Pagesat dhe Statusi" />
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 uppercase bg-slate-50 dark:bg-slate-800/60">
                <th className="pb-1.5 font-semibold">Statusi</th>
                <th className="pb-1.5 font-semibold text-right">Nr. Nxënësve</th>
                <th className="pb-1.5 font-semibold text-right">Shuma</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              <StatusRow color={DONUT_COLORS.full} label="Plotësisht të Paguar" bucket={b.full} />
              <StatusRow color={DONUT_COLORS.partial} label="Pagesë e Pjesshme" bucket={b.partial} />
              <StatusRow color={DONUT_COLORS.tiPartial} label="Me TIMI Invest (pjesërisht)" bucket={b.tiPartial} />
              <StatusRow color={DONUT_COLORS.tiUnpaid} label="Me TIMI Invest (pa paguar)" bucket={b.tiUnpaid} />
              <StatusRow color={DONUT_COLORS.zero} label="Pa Pagesë (borxh i plotë)" bucket={b.zero} />
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-slate-200 dark:border-slate-700 font-bold">
                <td className="pt-1.5">TOTALI</td>
                <td className="pt-1.5 text-right">{kpi.totalStudents}</td>
                <td className="pt-1.5 text-right">{formatCurrency(kpi.paid)}</td>
              </tr>
            </tfoot>
          </table>
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
    slate: { bg: "bg-slate-50 dark:bg-slate-800/60", badge: "bg-slate-500", text: "text-slate-800 dark:text-white", ring: "ring-slate-200 dark:ring-slate-700" },
    green: { bg: "bg-green-50 dark:bg-green-900/20", badge: "bg-green-500", text: "text-green-700 dark:text-green-300", ring: "ring-green-200 dark:ring-green-800" },
    orange: { bg: "bg-orange-50 dark:bg-orange-900/20", badge: "bg-orange-500", text: "text-orange-700 dark:text-orange-300", ring: "ring-orange-200 dark:ring-orange-800" },
    violet: { bg: "bg-violet-50 dark:bg-violet-900/20", badge: "bg-violet-500", text: "text-violet-700 dark:text-violet-300", ring: "ring-violet-200 dark:ring-violet-800" },
    red: { bg: "bg-red-50 dark:bg-red-900/20", badge: "bg-red-500", text: "text-red-700 dark:text-red-300", ring: "ring-red-200 dark:ring-red-800" },
  }[tone];
  return (
    <div className={`p-3.5 rounded-xl ${toneMap.bg} ring-1 ${toneMap.ring} transition-transform hover:-translate-y-0.5`}>
      <div className={`w-8 h-8 rounded-full ${toneMap.badge} flex items-center justify-center shadow-sm mb-2`}>
        <Icon className="w-4 h-4 text-white" />
      </div>
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className={`text-lg font-bold ${toneMap.text}`}>{formatCurrency(value)}</p>
      {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function SectionTitle({ icon: Icon, color, label }: { icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>; color: string; label: string }) {
  return (
    <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-2 flex items-center gap-1.5">
      <Icon className="w-4 h-4 shrink-0" style={{ color }} />
      {label}
    </p>
  );
}

function StatusRow({ color, label, bucket }: { color: string; label: string; bucket: Bucket }) {
  if (bucket.count === 0) return null;
  return (
    <tr>
      <td className="py-1.5 text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
        <span className="w-2 h-2 rounded-full shrink-0" style={{ background: color }} />
        {label}
      </td>
      <td className="py-1.5 text-right text-slate-500 dark:text-slate-400">{bucket.count}</td>
      <td className="py-1.5 text-right font-semibold text-slate-800 dark:text-white">{formatCurrency(bucket.paidAmount)}</td>
    </tr>
  );
}

function DebtRow({ label, bucket, color, onOpen }: { label: string; bucket: Bucket; color: string; onOpen: () => void }) {
  if (bucket.count === 0) return null;
  return (
    <button onClick={onOpen} className="w-full flex items-center justify-between gap-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-800/50 rounded-lg px-1.5 py-1.5 -mx-1.5 transition-colors group">
      <span className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300 min-w-0">
        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
        <span className="truncate">{label}</span>
        <span className="text-slate-400 shrink-0">({bucket.count})</span>
      </span>
      <span className="flex items-center gap-1.5 shrink-0">
        <span className="font-semibold" style={{ color }}>{formatCurrency(bucket.amount)}</span>
        <MessageSquare className="w-3 h-3 text-slate-300 opacity-0 group-hover:opacity-100 transition-opacity" />
      </span>
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
