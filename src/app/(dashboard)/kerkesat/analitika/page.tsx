"use client";

import { useState, useEffect } from "react";
import Header from "@/components/layout/Header";
import { formatCurrency } from "@/lib/utils";
import { REQUEST_STATUS_MAP } from "@/lib/materialConstants";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import {
  Package, Clock, Euro, Wallet, Download, TrendingUp, Award, Users,
} from "lucide-react";

const COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2", "#c026d3", "#16a34a", "#ea580c", "#0d9488"];

interface Analytics {
  totalRequests: number;
  totalItems: number;
  totalSpend: number;
  pipelineSpend: number;
  avgApprovalHours: number | null;
  statusBreakdown: { status: string; count: number }[];
  monthlyRequests: { key: string; label: string; count: number }[];
  topMaterials: { name: string; requestCount: number; totalQuantity: number }[];
  categorySpend: { category: string; spend: number }[];
  topTeachers: { name: string; count: number }[];
}

function formatHours(h: number | null): string {
  if (h === null) return "—";
  if (h < 24) return `${h} orë`;
  return `${Math.round(h / 24 * 10) / 10} ditë`;
}

export default function KerkesatAnalitikaPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/material-requests/analytics").then(r => r.json()).then(d => { setData(d); setLoading(false); });
  }, []);

  async function handleExport() {
    if (!data) return;
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    const wsMaterials = XLSX.utils.aoa_to_sheet([
      ["Materiali", "Nr. Kërkesash", "Sasia Totale"],
      ...data.topMaterials.map(m => [m.name, m.requestCount, m.totalQuantity]),
    ]);
    XLSX.utils.book_append_sheet(wb, wsMaterials, "Top Materialet");

    const wsSpend = XLSX.utils.aoa_to_sheet([
      ["Kategoria", "Shpenzimi (€)"],
      ...data.categorySpend.map(c => [c.category, c.spend]),
    ]);
    XLSX.utils.book_append_sheet(wb, wsSpend, "Shpenzimi sipas Kategorisë");

    const wsTeachers = XLSX.utils.aoa_to_sheet([
      ["Mësimdhënësja", "Nr. Kërkesash"],
      ...data.topTeachers.map(t => [t.name, t.count]),
    ]);
    XLSX.utils.book_append_sheet(wb, wsTeachers, "Top Mësimdhënëset");

    XLSX.writeFile(wb, "Analitika-Materialeve.xlsx");
  }

  if (loading || !data) {
    return (
      <>
        <Header title="Analitika e Materialeve" backHref="/kerkesat" />
        <div className="p-6 text-center text-slate-400 text-sm">Duke ngarkuar...</div>
      </>
    );
  }

  return (
    <>
      <Header title="Analitika e Materialeve" backHref="/kerkesat" />
      <div className="p-6 max-w-5xl mx-auto space-y-5 animate-fade-in">
        <div className="flex items-center justify-end">
          <button onClick={handleExport} className="btn-secondary text-sm">
            <Download className="w-4 h-4" />
            Eksporto Excel
          </button>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card p-5">
            <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/30 flex items-center justify-center mb-3">
              <Package className="w-5 h-5 text-primary-600 dark:text-primary-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{data.totalRequests}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Kërkesa Gjithsej</p>
            <p className="text-xs text-slate-400 mt-1">{data.totalItems} artikuj</p>
          </div>
          <div className="card p-5">
            <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center mb-3">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatHours(data.avgApprovalHours)}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Koha Mesatare e Vendimit</p>
          </div>
          <div className="card p-5">
            <div className="w-10 h-10 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center mb-3">
              <Euro className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(data.totalSpend)}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Shpenzimi Real</p>
            <p className="text-xs text-slate-400 mt-1">nga artikujt e pranuar</p>
          </div>
          <div className="card p-5">
            <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center mb-3">
              <Wallet className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(data.pipelineSpend)}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">Në Proces (Porositur)</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card p-5">
            <h2 className="section-title mb-4 flex items-center gap-1.5"><TrendingUp className="w-4 h-4 text-primary-500" /> Kërkesat sipas Muajit</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.monthlyRequests}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: "8px", color: "#f8fafc", fontSize: "12px" }} />
                <Bar dataKey="count" radius={[6, 6, 0, 0]} fill="#2563eb" />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="card p-5">
            <h2 className="section-title mb-4">Kërkesat sipas Statusit</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={data.statusBreakdown.map(s => ({ ...s, label: REQUEST_STATUS_MAP[s.status]?.label ?? s.status }))} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} allowDecimals={false} />
                <YAxis type="category" dataKey="label" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={110} />
                <Tooltip contentStyle={{ background: "#1e293b", border: "none", borderRadius: "8px", color: "#f8fafc", fontSize: "12px" }} />
                <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                  {data.statusBreakdown.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {data.categorySpend.length > 0 && (
          <div className="card p-5">
            <h2 className="section-title mb-4">Shpenzimi sipas Kategorisë</h2>
            <ResponsiveContainer width="100%" height={Math.max(160, data.categorySpend.length * 40)}>
              <BarChart data={data.categorySpend} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false}
                  tickFormatter={v => formatCurrency(v)} />
                <YAxis type="category" dataKey="category" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} width={140} />
                <Tooltip formatter={(v: number) => formatCurrency(v)} contentStyle={{ background: "#1e293b", border: "none", borderRadius: "8px", color: "#f8fafc", fontSize: "12px" }} />
                <Bar dataKey="spend" radius={[0, 6, 6, 0]}>
                  {data.categorySpend.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 p-5 border-b border-slate-100 dark:border-slate-700">
              <Award className="w-4 h-4 text-primary-500" />
              <h2 className="section-title">Top 10 Materialet</h2>
            </div>
            {data.topMaterials.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Ende s&apos;ka të dhëna</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {data.topMaterials.map((m, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-2.5">
                    <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{i + 1}. {m.name}</span>
                    <span className="text-xs text-slate-400 shrink-0 ml-2">{m.requestCount} kërkesa · {m.totalQuantity} copë</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card overflow-hidden">
            <div className="flex items-center gap-2 p-5 border-b border-slate-100 dark:border-slate-700">
              <Users className="w-4 h-4 text-primary-500" />
              <h2 className="section-title">Top Mësimdhënëset</h2>
            </div>
            {data.topTeachers.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-8">Ende s&apos;ka të dhëna</p>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {data.topTeachers.map((t, i) => (
                  <div key={i} className="flex items-center justify-between px-5 py-2.5">
                    <span className="text-sm text-slate-700 dark:text-slate-200 truncate">{i + 1}. {t.name}</span>
                    <span className="text-xs text-slate-400 shrink-0 ml-2">{t.count} kërkesa</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
