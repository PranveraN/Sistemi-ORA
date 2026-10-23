"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import Header from "@/components/layout/Header";
import { LayoutDashboard, Users, Landmark, FileText, Scale, BarChart3, History, Settings, Copy } from "lucide-react";

// Moduli TIMI INVEST — navigimi i brendshëm (Faza 1). Popup-i i vjetër te Dashboard-i
// mbetet i pandryshuar dhe funksional deri në kalimin përfundimtar (Faza 5).
const NAV = [
  { href: "/timi-invest",            label: "Pasqyra",             icon: LayoutDashboard },
  { href: "/timi-invest/femijet",    label: "Fëmijët me TIMI",     icon: Users },
  { href: "/timi-invest/pagesat",    label: "Pagesat nga TIMI",    icon: Landmark },
  { href: "/timi-invest/profaturat", label: "Profaturat & faturat", icon: FileText },
  { href: "/timi-invest/rakordimi",  label: "Rakordimi me TIMI",   icon: Scale },
  { href: "/timi-invest/dyfishimet", label: "Dyfishimet",          icon: Copy },
  { href: "/timi-invest/raportet",   label: "Raportet & eksportet", icon: BarChart3 },
  { href: "/timi-invest/historiku",  label: "Historiku",           icon: History },
  { href: "/timi-invest/cilesimet",  label: "Cilësimet",           icon: Settings },
];

export default function TimiInvestLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <>
      <Header title="TIMI Invest" />
      <div className="p-4 md:p-6 flex flex-col lg:flex-row gap-5 animate-fade-in">
        <aside className="lg:w-56 flex-shrink-0">
          <div className="card p-2 lg:sticky lg:top-4">
            <div className="flex items-center gap-2.5 px-2 py-2 mb-1">
              <div className="w-9 h-9 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
                <span className="text-white font-black text-[9px] leading-none text-center">TIMI<br />INV</span>
              </div>
              <div>
                <p className="text-[9px] font-semibold tracking-widest text-amber-600 dark:text-amber-400 uppercase">Moduli i financimit</p>
                <p className="text-sm font-bold text-slate-900 dark:text-white">TIMI INVEST</p>
              </div>
            </div>
            <nav className="flex lg:flex-col gap-0.5 overflow-x-auto">
              {NAV.map(n => {
                const active = n.href === "/timi-invest" ? pathname === n.href : pathname.startsWith(n.href);
                return (
                  <Link key={n.href} href={n.href}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm whitespace-nowrap transition-colors ${active
                      ? "bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 font-semibold"
                      : "text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800"}`}>
                    <n.icon className="w-4 h-4 flex-shrink-0" />{n.label}
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </>
  );
}
