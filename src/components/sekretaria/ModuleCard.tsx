"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle } from "lucide-react";
import type { SekModule } from "./modules";

export interface CardStat { label: string; value: number | string }

// Karta e një moduli: ikona/ngjyra e modulit, tre numra, paralajmërim (vetëm
// kur ka diçka për të bërë), veprimi kryesor dhe "Hap modulin →". E gjithë karta hap modulin.
export default function ModuleCard({ mod, stats, bar, warning, note, action }: {
  mod: SekModule;
  stats: CardStat[];
  bar?: { label: string; value: number; total: number };
  warning?: { text: string; tone: "orange" | "red"; href?: string } | null;
  note?: string | null;
  action: { label: string; href: string };
}) {
  const router = useRouter();
  const open = () => router.push(mod.href);
  const pct = bar && bar.total > 0 ? Math.min(100, Math.round((bar.value / bar.total) * 100)) : 0;

  return (
    <div
      role="link" tabIndex={0} aria-label={`Hap ${mod.label}`}
      onClick={open} onKeyDown={e => { if (e.key === "Enter") open(); }}
      className={`card p-5 flex flex-col gap-4 cursor-pointer hover:ring-2 ${mod.ring} transition-all`}
    >
      <div className="flex items-start gap-3">
        <div className={`w-11 h-11 rounded-xl ${mod.bg} flex items-center justify-center shrink-0`}>
          <mod.icon className={`w-5 h-5 ${mod.color}`} />
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-slate-800 dark:text-white text-sm">{mod.label}</p>
          <p className="text-xs text-slate-400 mt-0.5">{mod.desc}</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {stats.map(s => (
          <div key={s.label} className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-2.5 py-2">
            <p className="text-lg font-bold text-slate-800 dark:text-white leading-tight">{s.value}</p>
            <p className="text-[11px] text-slate-500 leading-tight">{s.label}</p>
          </div>
        ))}
      </div>

      {bar && (
        <div>
          <div className="flex justify-between text-[11px] text-slate-500 mb-1"><span>{bar.label}</span><span>{bar.value} / {bar.total}</span></div>
          <div className="h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
            <div className={`h-full rounded-full ${mod.color.includes("blue") ? "bg-blue-500" : "bg-primary-500"}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )}

      {warning && (
        warning.href ? (
          <Link href={warning.href} onClick={e => e.stopPropagation()}
            className={`text-xs rounded-lg px-3 py-2 flex items-center gap-2 ${warning.tone === "red" ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300" : "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300"} hover:underline`}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {warning.text}
          </Link>
        ) : (
          <p className={`text-xs rounded-lg px-3 py-2 flex items-center gap-2 ${warning.tone === "red" ? "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300" : "bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-300"}`}>
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" /> {warning.text}
          </p>
        )
      )}
      {note && <p className="text-[11px] text-slate-400 -mt-2">{note}</p>}

      <div className="flex items-center justify-between mt-auto pt-1">
        <Link href={action.href} onClick={e => e.stopPropagation()} className={`text-sm font-semibold ${mod.color} hover:underline`}>{action.label}</Link>
        <span className="text-xs text-slate-400">Hap modulin →</span>
      </div>
    </div>
  );
}
