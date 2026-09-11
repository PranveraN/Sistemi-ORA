"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Wallet, CreditCard, Landmark, ArrowRightLeft, AlertCircle, CheckCircle,
  XCircle, Clock, CreditCard as CardIcon, Search, Loader2, ArrowRight,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  PieChart, Pie, Cell, Legend, Tooltip, ResponsiveContainer,
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
} from "recharts";

interface StudentRow { id: number; name: string; className: string | null; finalAmount: number; paidAmount: number; balance: number; }
interface RevenueRow { id: number; studentName: string; category: string; amount: number; method: string | null; paidDate: string | null; }
interface HandoverRow { id: number; categoryName: string; amount: number; method: string; recipient: string | null; handoverAt: string; }
interface ExpenseRow { id: number; kategoria: string; shuma: number; lloji: string; data: string; marres: string | null; }
interface DebtRow { id: number; studentName: string; className: string | null; category: string; balance: number; }

interface Overview {
  period: { month: number; year: number };
  studentStatus: {
    counts: { paid: number; partial: number; unpaid: number; timiInvest: number; total: number };
    lists: { paid: StudentRow[]; partial: StudentRow[]; unpaid: StudentRow[]; timiInvest: StudentRow[] };
  };
  revenue: { totalThisMonth: number; byMethod: Record<string, number>; list: RevenueRow[] };
  monthlyByMethod: { month: string; CASH: number; BANK: number; OTHER: number }[];
  handovers: { totalThisMonth: number; byCategory: { categoryId: number | null; categoryName: string; amount: number }[]; list: HandoverRow[] };
  expenses: { totalThisMonth: number; byType: Record<string, number>; list: ExpenseRow[] };
  debt: { total: number; list: DebtRow[] };
}

type Tab = "paid" | "partial" | "unpaid" | "timiInvest" | "revenue" | "handovers" | "debt" | "expenses";

const TAB_LABELS: Record<Tab, string> = {
  paid: "Kanë Paguar", partial: "Pagesë e Pjesshme", unpaid: "S'kanë Paguar", timiInvest: "Me TIMI Invest",
  revenue: "Të Hyra", handovers: "Të Dorëzuara", debt: "Borxhet", expenses: "Shpenzimet",
};

const METHOD_LABEL: Record<string, string> = { CASH: "Cash", BANK: "Bankë", CARD: "Kartelë", ONLINE: "Online" };

const STATUS_COLORS = { paid: "#10b981", partial: "#3b82f6", unpaid: "#ef4444", timiInvest: "#a855f7" };
const EXPENSE_COLORS = { ZYRE: "#f97316", BANKE: "#0ea5e9" };

function Kpi({ icon, label, value, sub, color, onClick }: {
  icon: React.ReactNode; label: string; value: string; sub?: string; color: string; onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={`card p-4 text-left flex flex-col gap-2 ${onClick ? "hover:ring-2 hover:ring-primary-300 dark:hover:ring-primary-700 transition-all cursor-pointer" : ""}`}
    >
      <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${color}`}>{icon}</div>
      <div>
        <p className="text-lg font-bold text-slate-900 dark:text-white leading-tight">{value}</p>
        <p className="text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">{label}</p>
        {sub && <p className="text-[11px] text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </Comp>
  );
}

export default function FinancialOverview() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("paid");
  const [methodFilter, setMethodFilter] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  useEffect(() => {
    fetch("/api/dashboard/financial-overview")
      .then(r => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

  function goTo(tab: Tab, method?: string | null) {
    setActiveTab(tab);
    setMethodFilter(method ?? null);
    setSearch("");
  }

  const statusDonut = useMemo(() => {
    if (!data) return [];
    const c = data.studentStatus.counts;
    return [
      { key: "paid" as const, name: "Kanë paguar", value: c.paid },
      { key: "partial" as const, name: "Pagesë e pjesshme", value: c.partial },
      { key: "unpaid" as const, name: "Nuk kanë paguar", value: c.unpaid },
      { key: "timiInvest" as const, name: "Me TIMI Invest", value: c.timiInvest },
    ].filter(d => d.value > 0);
  }, [data]);

  const expenseDonut = useMemo(() => {
    if (!data) return [];
    return [
      { key: "ZYRE" as const, name: "Shpenzime Zyre", value: data.expenses.byType.ZYRE ?? 0 },
      { key: "BANKE" as const, name: "Shpenzime Bankë", value: data.expenses.byType.BANKE ?? 0 },
    ].filter(d => d.value > 0);
  }, [data]);

  if (loading) {
    return (
      <div className="card p-10 flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
      </div>
    );
  }
  if (!data) return null;

  const totalBank = data.revenue.byMethod.BANK ?? 0;
  const totalCash = data.revenue.byMethod.CASH ?? 0;
  const diferenca = data.revenue.totalThisMonth - data.handovers.totalThisMonth;
  const monthLabel = new Intl.DateTimeFormat("sq-AL", { month: "long", year: "numeric" }).format(new Date(data.period.year, data.period.month - 1, 1));

  const q = search.trim().toLowerCase();
  const studentRows = (activeTab === "paid" ? data.studentStatus.lists.paid
    : activeTab === "partial" ? data.studentStatus.lists.partial
    : activeTab === "unpaid" ? data.studentStatus.lists.unpaid
    : activeTab === "timiInvest" ? data.studentStatus.lists.timiInvest : [])
    .filter(s => !q || s.name.toLowerCase().includes(q) || (s.className ?? "").toLowerCase().includes(q));

  const revenueRows = data.revenue.list
    .filter(r => !methodFilter || r.method === methodFilter)
    .filter(r => !q || r.studentName.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));

  const handoverRows = data.handovers.list.filter(h => !q || h.categoryName.toLowerCase().includes(q) || (h.recipient ?? "").toLowerCase().includes(q));
  const debtRows = data.debt.list.filter(d => !q || d.studentName.toLowerCase().includes(q) || (d.className ?? "").toLowerCase().includes(q));
  const expenseRows = data.expenses.list.filter(e => !q || e.kategoria.toLowerCase().includes(q));

  const isStudentTab = activeTab === "paid" || activeTab === "partial" || activeTab === "unpaid" || activeTab === "timiInvest";

  return (
    <div className="card overflow-hidden">
      <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
        <div>
          <h2 className="section-title">Pasqyrë Financiare</h2>
          <p className="text-xs text-slate-400 mt-0.5 capitalize">{monthLabel}</p>
        </div>
        <Link href="/dorezimet" className="text-sm text-primary-600 dark:text-primary-400 hover:underline font-medium inline-flex items-center gap-1">
          Dorëzimet <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      <div className="p-5 space-y-5">
        {/* KPI row */}
        <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-3">
          <Kpi icon={<Wallet className="w-4.5 h-4.5 text-emerald-600" />} color="bg-emerald-50 dark:bg-emerald-900/30"
            label="Të Hyra Gjithsej" value={formatCurrency(data.revenue.totalThisMonth)} sub="këtë muaj"
            onClick={() => goTo("revenue", null)} />
          <Kpi icon={<Landmark className="w-4.5 h-4.5 text-blue-600" />} color="bg-blue-50 dark:bg-blue-900/30"
            label="Pagesa në Bankë" value={formatCurrency(totalBank)}
            sub={data.revenue.totalThisMonth > 0 ? `${Math.round((totalBank / data.revenue.totalThisMonth) * 100)}% e të hyrave` : undefined}
            onClick={() => goTo("revenue", "BANK")} />
          <Kpi icon={<CardIcon className="w-4.5 h-4.5 text-amber-600" />} color="bg-amber-50 dark:bg-amber-900/30"
            label="Pagesa në Cash" value={formatCurrency(totalCash)}
            sub={data.revenue.totalThisMonth > 0 ? `${Math.round((totalCash / data.revenue.totalThisMonth) * 100)}% e të hyrave` : undefined}
            onClick={() => goTo("revenue", "CASH")} />
          <Kpi icon={<ArrowRightLeft className="w-4.5 h-4.5 text-violet-600" />} color="bg-violet-50 dark:bg-violet-900/30"
            label="Të Dorëzuara" value={formatCurrency(data.handovers.totalThisMonth)} sub="këtë muaj"
            onClick={() => goTo("handovers")} />
          <Kpi icon={diferenca >= 0 ? <CheckCircle className="w-4.5 h-4.5 text-slate-600" /> : <AlertCircle className="w-4.5 h-4.5 text-red-600" />}
            color={diferenca >= 0 ? "bg-slate-100 dark:bg-slate-700" : "bg-red-50 dark:bg-red-900/30"}
            label="Diferenca (Hyrje − Dorëzime)" value={formatCurrency(diferenca)} sub="ende pa dorëzuar" />
          <Kpi icon={<AlertCircle className="w-4.5 h-4.5 text-red-600" />} color="bg-red-50 dark:bg-red-900/30"
            label="Borxhi i Papaguar" value={formatCurrency(data.debt.total)} sub={`${data.debt.list.length} rekorde`}
            onClick={() => goTo("debt")} />
        </div>

        {/* Charts row */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="card p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Statusi i Pagesave — Shkollimi</p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={statusDonut} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70}
                  onClick={(d) => goTo(d.key as Tab)} cursor="pointer">
                  {statusDonut.map(d => <Cell key={d.key} fill={STATUS_COLORS[d.key]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [v, "Nxënës"]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Shpenzimet — Zyrë / Bankë</p>
            <ResponsiveContainer width="100%" height={180}>
              <PieChart>
                <Pie data={expenseDonut} dataKey="value" nameKey="name" innerRadius={45} outerRadius={70}
                  onClick={() => goTo("expenses")} cursor="pointer">
                  {expenseDonut.map(d => <Cell key={d.key} fill={EXPENSE_COLORS[d.key]} />)}
                </Pie>
                <Tooltip formatter={(v: number) => [formatCurrency(v), "Shuma"]} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-4">
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Të Hyrat Mujore — Bankë / Cash</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={data.monthlyByMethod}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="BANK" name="Bankë" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                <Bar dataKey="CASH" name="Cash" fill="#f59e0b" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex flex-wrap gap-1.5 border-b border-slate-100 dark:border-slate-700 pb-3">
          {(Object.keys(TAB_LABELS) as Tab[]).map(t => (
            <button
              key={t}
              onClick={() => goTo(t)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeTab === t
                  ? "bg-primary-600 text-white"
                  : "bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
          {methodFilter && activeTab === "revenue" && (
            <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 flex items-center gap-1.5">
              Metoda: {METHOD_LABEL[methodFilter]}
              <button onClick={() => setMethodFilter(null)}><XCircle className="w-3.5 h-3.5" /></button>
            </span>
          )}
          <div className="relative ml-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Kërko..."
              className="form-input pl-8 py-1.5 text-xs w-40" />
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          {isStudentTab && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">#</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Emri</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Klasa</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Paguar</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Mbetet</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {studentRows.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-400 text-sm">Asnjë rezultat</td></tr>
                )}
                {studentRows.map((s, i) => (
                  <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2 text-slate-400 text-xs">{i + 1}</td>
                    <td className="px-3 py-2">
                      <Link href={`/students/${s.id}`} className="font-medium text-slate-800 dark:text-white hover:text-primary-600 dark:hover:text-primary-400">{s.name}</Link>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{s.className ?? "—"}</td>
                    <td className="px-3 py-2 text-right text-green-600 font-medium">{formatCurrency(s.paidAmount)}</td>
                    <td className="px-3 py-2 text-right">
                      {s.balance > 0 ? <span className="text-red-600 font-semibold">{formatCurrency(s.balance)}</span> : <span className="text-green-500 text-xs">✓ Pa borxh</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "revenue" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Nxënësi</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Kategoria</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Shuma</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Metoda</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {revenueRows.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-400 text-sm">Asnjë rezultat</td></tr>
                )}
                {revenueRows.map(r => (
                  <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-white">{r.studentName}</td>
                    <td className="px-3 py-2 text-slate-500">{r.category}</td>
                    <td className="px-3 py-2 text-right font-semibold text-slate-800 dark:text-white">{formatCurrency(r.amount)}</td>
                    <td className="px-3 py-2 text-slate-500">{r.method ? (METHOD_LABEL[r.method] ?? r.method) : "—"}</td>
                    <td className="px-3 py-2 text-slate-400">{r.paidDate ? formatDate(r.paidDate) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "handovers" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Kategoria</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Shuma</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Metoda</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Marrësi</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {handoverRows.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-400 text-sm">
                    Asnjë dorëzim i regjistruar këtë muaj — <Link href="/dorezimet" className="text-primary-600 hover:underline">regjistro një</Link>
                  </td></tr>
                )}
                {handoverRows.map(h => (
                  <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-white">{h.categoryName}</td>
                    <td className="px-3 py-2 text-right font-semibold text-green-600">{formatCurrency(h.amount)}</td>
                    <td className="px-3 py-2 text-slate-500">{METHOD_LABEL[h.method] ?? h.method}</td>
                    <td className="px-3 py-2 text-slate-500">{h.recipient ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-400">{formatDate(h.handoverAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "debt" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Nxënësi</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Klasa</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Kategoria</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Borxhi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {debtRows.length === 0 && (
                  <tr><td colSpan={4} className="text-center py-8 text-slate-400 text-sm">Asnjë borxh</td></tr>
                )}
                {debtRows.map(d => (
                  <tr key={d.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2">
                      <Link href={`/students/${d.id}`} className="font-medium text-slate-800 dark:text-white hover:text-primary-600 dark:hover:text-primary-400">{d.studentName}</Link>
                    </td>
                    <td className="px-3 py-2 text-slate-500">{d.className ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-500">{d.category}</td>
                    <td className="px-3 py-2 text-right text-red-600 font-semibold">{formatCurrency(d.balance)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {activeTab === "expenses" && (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-700">
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Kategoria</th>
                  <th className="text-right px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Shuma</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Lloji</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Marrësi</th>
                  <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Data</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {expenseRows.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-8 text-slate-400 text-sm">Asnjë shpenzim këtë muaj</td></tr>
                )}
                {expenseRows.map(e => (
                  <tr key={e.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                    <td className="px-3 py-2 font-medium text-slate-800 dark:text-white">{e.kategoria}</td>
                    <td className="px-3 py-2 text-right font-semibold text-red-600">{formatCurrency(e.shuma)}</td>
                    <td className="px-3 py-2 text-slate-500">{e.lloji === "ZYRE" ? "Zyrë" : "Bankë"}</td>
                    <td className="px-3 py-2 text-slate-500">{e.marres ?? "—"}</td>
                    <td className="px-3 py-2 text-slate-400">{formatDate(e.data)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
