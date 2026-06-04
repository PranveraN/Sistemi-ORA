"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { BarChart3, TrendingUp, TrendingDown, Wallet, ArrowRightLeft, Package, ShoppingBag, ArrowLeft, Download } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Stats {
  totalRevenue: number; totalCost: number; totalProfit: number;
  totalCollected: number; totalDebt: number;
  totalHandedOver: number; remainingProfit: number;
  stockValue: number; totalItems: number;
  lowStock: { name: string; stock: number }[];
  salesCount: number; paidCount: number; partialCount: number; pendingCount: number;
}

async function exportToExcel(stats: Stats) {
  // Fetch sales detail for full export
  const salesRes = await fetch("/api/uniforms/sales?limit=1000");
  const salesData = await salesRes.json();
  const sales = salesData.sales ?? [];

  const wb = XLSX.utils.book_new();
  const today = new Date().toLocaleDateString("sq-AL");

  // Sheet 1: Pasqyra financiare
  const summary = [
    ["RAPORTI FINANCIAR — UNIFORMA", "", today],
    [],
    ["PASQYRA E TË ARDHURAVE", ""],
    ["Shitje totale", stats.totalRevenue],
    ["(-) Kosto totale", stats.totalCost],
    ["= Fitim bruto", stats.totalProfit],
    [],
    ["ARKËTIMI", ""],
    ["E arkëtuar", stats.totalCollected],
    ["(-) Borxhet", stats.totalDebt],
    ["(-) Dorëzuar", stats.totalHandedOver],
    ["= Mbetja", stats.remainingProfit],
    [],
    ["STOKU", ""],
    ["Cope totale", stats.totalItems],
    ["Vlera stokut", stats.stockValue],
    [],
    ["SHITJET", ""],
    ["Gjithsej shitje", stats.salesCount],
    ["Paguar", stats.paidCount],
    ["Pjesërisht", stats.partialCount],
    ["Pa pagesë", stats.pendingCount],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summary);
  ws1["!cols"] = [{ wch: 28 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Pasqyra");

  // Sheet 2: Lista shitjeve
  if (sales.length > 0) {
    const rows = [
      ["#", "Klienti", "Telefoni", "Data", "Totali (€)", "Paguar (€)", "Borxhi (€)", "Statusi"],
      ...sales.map((s: { id: number; customerName: string; customerPhone: string | null; saleDate: string; totalAmount: number; paidAmount: number; balance: number; status: string }) => [
        s.id,
        s.customerName,
        s.customerPhone ?? "",
        new Date(s.saleDate).toLocaleDateString("sq-AL"),
        s.totalAmount,
        s.paidAmount,
        s.balance,
        s.status === "PAID" ? "Paguar" : s.status === "PARTIAL" ? "Pjesërisht" : "Pa pagesë",
      ]),
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(rows);
    ws2["!cols"] = [{ wch: 6 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Shitjet");
  }

  // Sheet 3: Stok i ulët
  if (stats.lowStock.length > 0) {
    const rows = [
      ["Produkti", "Stoku (cope)"],
      ...stats.lowStock.map(p => [p.name, p.stock]),
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(rows);
    ws3["!cols"] = [{ wch: 28 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Stok i ulët");
  }

  const filename = `Raporti-Uniforma-${today.replace(/\//g, "-")}.xlsx`;
  XLSX.writeFile(wb, filename);
}

function Row({ label, value, cls = "" }: { label: string; value: string; cls?: string }) {
  return (
    <div className={`flex justify-between items-center py-2 text-sm border-b border-slate-100 dark:border-slate-800 last:border-0 ${cls}`}>
      <span className="text-slate-500">{label}</span>
      <span className="font-semibold text-slate-800 dark:text-slate-200">{value}</span>
    </div>
  );
}

export default function RaportPage() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/uniforms/stats").then(r => r.json()).then(setStats);
  }, []);

  if (!stats) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );

  const collectionRate = stats.totalRevenue > 0 ? (stats.totalCollected / stats.totalRevenue * 100).toFixed(1) : "0.0";
  const profitMargin   = stats.totalRevenue > 0 ? (stats.totalProfit    / stats.totalRevenue * 100).toFixed(1) : "0.0";

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/uniforma" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Raporti Financiar</h1>
            <p className="text-sm text-slate-400 mt-0.5">Pasqyra e plotë e uniformave</p>
          </div>
        </div>
        <button onClick={() => exportToExcel(stats)}
          className="btn-ghost">
          <Download className="w-4 h-4" /> Exporto Excel
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { icon: ShoppingBag,    label: "Shitje",           value: formatCurrency(stats.totalRevenue),    sub: `${stats.salesCount} transaksione`,          color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/30" },
          { icon: TrendingUp,     label: "Fitim bruto",      value: formatCurrency(stats.totalProfit),     sub: `Marzha ${profitMargin}%`,                    color: "text-green-600",   bg: "bg-green-50 dark:bg-green-900/30" },
          { icon: Wallet,         label: "E arkëtuar",       value: formatCurrency(stats.totalCollected),  sub: `${collectionRate}% e totalit`,               color: "text-primary-600", bg: "bg-primary-50 dark:bg-primary-900/30" },
          { icon: ArrowRightLeft, label: "Mbetja",           value: formatCurrency(stats.remainingProfit), sub: `Dorëzuar: ${formatCurrency(stats.totalHandedOver)}`, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/30" },
        ].map(k => (
          <div key={k.label} className="card p-5">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${k.bg}`}>
              <k.icon className={`w-5 h-5 ${k.color}`} />
            </div>
            <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
            <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-0.5">{k.label}</p>
            <p className="text-xs text-slate-400 mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue breakdown */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-800 dark:text-white mb-4 text-sm flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-500" /> Pasqyra e të ardhurave
          </h2>
          <div className="space-y-1">
            <Row label="Shitje totale"    value={formatCurrency(stats.totalRevenue)} />
            <Row label="(-) Kosto totale" value={formatCurrency(stats.totalCost)} cls="text-red-500" />
            <Row label="= Fitim bruto"    value={formatCurrency(stats.totalProfit)} cls="font-bold text-green-600 border-t-2 dark:border-slate-600" />
          </div>

          <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700 space-y-1">
            <Row label="E arkëtuar" value={formatCurrency(stats.totalCollected)} />
            <Row label="(-) Borxhet" value={formatCurrency(stats.totalDebt)} cls="text-amber-500" />
            <Row label="(-) Dorëzuar" value={formatCurrency(stats.totalHandedOver)} cls="text-red-400" />
            <Row label="= Mbetja" value={formatCurrency(stats.remainingProfit)} cls="font-bold text-orange-600 border-t-2 dark:border-slate-600" />
          </div>

          {/* Visual bar */}
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-800">
            <p className="text-xs text-slate-400 mb-2">Struktura e të ardhurave</p>
            <div className="h-4 rounded-full overflow-hidden flex bg-slate-100 dark:bg-slate-800">
              {stats.totalRevenue > 0 && (
                <>
                  <div className="bg-green-400 h-full transition-all"
                    style={{ width: `${stats.totalProfit / stats.totalRevenue * 100}%` }}
                    title={`Fitim: ${profitMargin}%`} />
                  <div className="bg-blue-300 h-full transition-all"
                    style={{ width: `${stats.totalCost / stats.totalRevenue * 100}%` }}
                    title="Kosto" />
                </>
              )}
            </div>
            <div className="flex gap-4 mt-2">
              <div className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-sm bg-green-400" />
                <span className="text-slate-500">Fitim</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <div className="w-2.5 h-2.5 rounded-sm bg-blue-300" />
                <span className="text-slate-500">Kosto</span>
              </div>
            </div>
          </div>
        </div>

        {/* Sales status + Stock */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-semibold text-slate-800 dark:text-white mb-4 text-sm flex items-center gap-2">
              <ShoppingBag className="w-4 h-4 text-primary-500" /> Statusi i shitjeve
            </h2>
            <div className="space-y-3">
              {[
                { label: "Paguar",     count: stats.paidCount,    bar: "bg-green-500",  pct: stats.salesCount ? stats.paidCount / stats.salesCount * 100 : 0 },
                { label: "Pjesërisht", count: stats.partialCount, bar: "bg-blue-400",   pct: stats.salesCount ? stats.partialCount / stats.salesCount * 100 : 0 },
                { label: "Pa pagesë",  count: stats.pendingCount, bar: "bg-slate-300",  pct: stats.salesCount ? stats.pendingCount / stats.salesCount * 100 : 0 },
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

          <div className="card p-5">
            <h2 className="font-semibold text-slate-800 dark:text-white mb-4 text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-purple-500" /> Stoku
            </h2>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <p className="text-xs text-slate-400">Cope totale</p>
                <p className="text-xl font-bold text-slate-800 dark:text-white">{stats.totalItems}</p>
              </div>
              <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <p className="text-xs text-slate-400">Vlera stokut</p>
                <p className="text-lg font-bold text-primary-600">{formatCurrency(stats.stockValue)}</p>
              </div>
            </div>
            {stats.lowStock.length > 0 ? (
              <div>
                <p className="text-xs font-semibold text-amber-600 mb-2">Stok i ulët ({stats.lowStock.length})</p>
                <div className="space-y-1">
                  {stats.lowStock.slice(0, 5).map(p => (
                    <div key={p.name} className="flex justify-between text-xs">
                      <span className="text-slate-500 truncate">{p.name}</span>
                      <span className="text-amber-600 font-bold ml-2">{p.stock} cope</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-xs text-green-600 flex items-center gap-1.5">
                <span className="w-2 h-2 bg-green-500 rounded-full" /> Stok i mjaftueshëm
              </p>
            )}
          </div>

          <div className="card p-5">
            <h2 className="font-semibold text-slate-800 dark:text-white mb-3 text-sm flex items-center gap-2">
              <TrendingDown className="w-4 h-4 text-red-500" /> Borxhet
            </h2>
            <div className="space-y-1">
              <Row label="Borxhi total" value={formatCurrency(stats.totalDebt)} cls="text-amber-600 font-bold" />
              <Row label="Shitje me borxh" value={`${stats.partialCount + stats.pendingCount}`} />
              {stats.totalRevenue > 0 && (
                <Row label="% e borxhit" value={`${(stats.totalDebt / stats.totalRevenue * 100).toFixed(1)}%`} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
