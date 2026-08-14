"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import {
  ShoppingBag, TrendingUp, Wallet, AlertTriangle,
  Package, ArrowRightLeft, BarChart3, Plus, ChevronRight,
  Banknote, CreditCard, Archive, ClipboardList,
} from "lucide-react";

interface Stats {
  totalRevenue: number; totalCost: number; totalProfit: number;
  totalCollected: number; totalDebt: number;
  totalHandedOver: number; remainingProfit: number;
  stockValue: number; totalItems: number;
  lowStock: { name: string; stock: number }[];
  salesCount: number; paidCount: number; partialCount: number; pendingCount: number;
}

export default function UniformaDashboard() {
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    fetch("/api/uniforms/stats").then(r => r.json()).then(setStats);
  }, []);

  if (!stats) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Menaxhimi Uniformave</h1>
          <p className="text-sm text-slate-400 mt-0.5">Pasqyra e plotë — stoku, shitjet, fitimi, borxhet</p>
        </div>
        <Link href="/uniforma/shitje/new" className="btn-primary">
          <Plus className="w-4 h-4" /> Shitje e Re
        </Link>
      </div>

      {/* Quick nav */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { href: "/uniforma/shitje",    icon: ShoppingBag,    label: "Shitjet",   sub: `${stats.salesCount} gjithsej`,   color: "bg-blue-50 dark:bg-blue-900/30 text-blue-600" },
          { href: "/uniforma/produktet", icon: Package,        label: "Produktet", sub: `${stats.totalItems} cope stok`,  color: "bg-purple-50 dark:bg-purple-900/30 text-purple-600" },
          { href: "/uniforma/dorezat",   icon: ArrowRightLeft, label: "Dorezat",   sub: formatCurrency(stats.totalHandedOver), color: "bg-green-50 dark:bg-green-900/30 text-green-600" },
          { href: "/uniforma/porosite",  icon: ClipboardList,  label: "Porositë",  sub: stats.lowStock.length > 0 ? `${stats.lowStock.length} nën prag` : "Stoku në rregull", color: "bg-amber-50 dark:bg-amber-900/30 text-amber-600" },
          { href: "/uniforma/raport",    icon: BarChart3,      label: "Raporti",   sub: "Pasqyra e detajuar",             color: "bg-orange-50 dark:bg-orange-900/30 text-orange-600" },
        ].map(nav => (
          <Link key={nav.href} href={nav.href}
            className="card p-4 flex items-center gap-3 hover:shadow-md transition-shadow group">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${nav.color}`}>
              <nav.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-slate-800 dark:text-slate-200 text-sm">{nav.label}</p>
              <p className="text-xs text-slate-400 truncate">{nav.sub}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-primary-500 transition-colors flex-shrink-0" />
          </Link>
        ))}
      </div>

      {/* Main 4 stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Banknote />}      label="Të Ardhura" value={formatCurrency(stats.totalRevenue)}    sub={`${stats.salesCount} shitje`}                    color="text-blue-600"    bg="bg-blue-50 dark:bg-blue-900/30" />
        <StatCard icon={<TrendingUp />}    label="Fitim Bruto" value={formatCurrency(stats.totalProfit)}   sub={`Kosto: ${formatCurrency(stats.totalCost)}`}      color="text-green-600"   bg="bg-green-50 dark:bg-green-900/30" />
        <StatCard icon={<Wallet />}        label="E Arkëtuar"  value={formatCurrency(stats.totalCollected)} sub={`Borxhi: ${formatCurrency(stats.totalDebt)}`}     color="text-primary-600" bg="bg-primary-50 dark:bg-primary-900/30" />
        <StatCard icon={<Archive />}       label="Mbetja"      value={formatCurrency(stats.remainingProfit)} sub={`Dorëzuar: ${formatCurrency(stats.totalHandedOver)}`} color="text-orange-600" bg="bg-orange-50 dark:bg-orange-900/30" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Sales status */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-800 dark:text-white mb-4 text-sm">Statusi Shitjeve</h2>
          <div className="space-y-3">
            {[
              { label: "Paguar",     count: stats.paidCount,    bar: "bg-green-500",  badge: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
              { label: "Pjesërisht", count: stats.partialCount, bar: "bg-blue-400",   badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
              { label: "Pa pagesë",  count: stats.pendingCount, bar: "bg-slate-300",  badge: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400" },
            ].map(s => (
              <div key={s.label} className="flex items-center gap-3">
                <span className={`badge ${s.badge} text-xs w-24 text-center justify-center`}>{s.label}</span>
                <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full ${s.bar} rounded-full transition-all`}
                    style={{ width: stats.salesCount ? `${(s.count / stats.salesCount) * 100}%` : "0%" }} />
                </div>
                <span className="text-sm font-bold text-slate-700 dark:text-slate-300 w-6 text-right">{s.count}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Stock */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-800 dark:text-white mb-4 text-sm">Stoku</h2>
          <div className="grid grid-cols-2 gap-3 mb-4">
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <p className="text-xs text-slate-400">Cope në stok</p>
              <p className="text-2xl font-bold text-slate-800 dark:text-white">{stats.totalItems}</p>
            </div>
            <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
              <p className="text-xs text-slate-400">Vlera stokut</p>
              <p className="text-lg font-bold text-primary-600">{formatCurrency(stats.stockValue)}</p>
            </div>
          </div>
          {stats.lowStock.length > 0 ? (
            <>
              <p className="text-xs font-semibold text-amber-600 flex items-center gap-1 mb-2">
                <AlertTriangle className="w-3.5 h-3.5" /> Stok i ulët ({stats.lowStock.length})
              </p>
              {stats.lowStock.slice(0, 4).map(p => (
                <div key={p.name} className="flex justify-between text-xs py-0.5">
                  <span className="text-slate-500 truncate">{p.name}</span>
                  <span className="text-amber-600 font-bold ml-2">{p.stock} cope</span>
                </div>
              ))}
            </>
          ) : (
            <p className="text-xs text-green-600 flex items-center gap-1.5">
              <span className="w-2 h-2 bg-green-500 rounded-full" />Stok i mjaftueshëm
            </p>
          )}
        </div>

        {/* Finance breakdown */}
        <div className="card p-5">
          <h2 className="font-semibold text-slate-800 dark:text-white mb-4 text-sm">Pasqyra Financiare</h2>
          <div className="space-y-2">
            {[
              { label: "Shitje totale",  val: stats.totalRevenue,     cls: "text-slate-700 dark:text-slate-200" },
              { label: "(-) Kosto",      val: stats.totalCost,        cls: "text-red-500" },
              { label: "= Fitim bruto",  val: stats.totalProfit,      cls: "text-green-600 font-bold pt-1 border-t border-slate-100 dark:border-slate-700" },
              { label: "E arkëtuar",     val: stats.totalCollected,   cls: "text-primary-600 mt-1" },
              { label: "(-) Borxhet",    val: stats.totalDebt,        cls: "text-amber-500" },
              { label: "(-) Dorëzuar",   val: stats.totalHandedOver,  cls: "text-red-400" },
              { label: "= Mbetja",       val: stats.remainingProfit,  cls: "text-orange-600 font-bold pt-1 border-t border-slate-100 dark:border-slate-700" },
            ].map(r => (
              <div key={r.label} className={`flex justify-between text-sm ${r.cls}`}>
                <span className="text-slate-400">{r.label}</span>
                <span className={r.cls.includes("text-") ? r.cls.split(" ")[0] : ""}>{formatCurrency(r.val)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color, bg }: {
  icon: React.ReactNode; label: string; value: string; sub: string; color: string; bg: string;
}) {
  return (
    <div className="card p-5">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${bg}`}>
        <span className={`${color} [&>svg]:w-5 [&>svg]:h-5`}>{icon}</span>
      </div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-0.5">{label}</p>
      <p className="text-xs text-slate-400 mt-1">{sub}</p>
    </div>
  );
}
