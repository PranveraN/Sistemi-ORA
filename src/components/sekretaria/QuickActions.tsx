"use client";

import Link from "next/link";
import { SEK_MODULES } from "./modules";

const ACTIONS = [
  { label: "Gjenero vërtetim",      href: "/sekretaria/vertetime",              mod: SEK_MODULES.vertetime },
  { label: "Lësho fletëkalim",      href: "/sekretaria/fletkalimet",            mod: SEK_MODULES.fletkalimet },
  { label: "Kontratë nxënësi",      href: "/sekretaria/kontratat-nxenesve",     mod: SEK_MODULES.kontratatNxenesve },
  { label: "Kontratë mësimdhënësi", href: "/sekretaria/kontratat-mesimdhnesve", mod: SEK_MODULES.kontratatMesimdhenesve },
  { label: "Shto staf",             href: "/sekretaria/stafi?new=1",            mod: SEK_MODULES.stafi },
];

// Veprimet më të shpeshta — secili hap formularin ekzistues të modulit.
export default function QuickActions() {
  return (
    <div className="flex flex-wrap gap-2">
      {ACTIONS.map(a => (
        <Link key={a.label} href={a.href}
          className="inline-flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-medium text-slate-700 dark:text-slate-200 hover:border-primary-300 hover:shadow-sm transition-all">
          <span className={`w-7 h-7 rounded-lg ${a.mod.bg} flex items-center justify-center`}><a.mod.icon className={`w-4 h-4 ${a.mod.color}`} /></span>
          {a.label}
        </Link>
      ))}
    </div>
  );
}
