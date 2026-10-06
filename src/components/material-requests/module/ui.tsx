"use client";

import Link from "next/link";
import { Search } from "lucide-react";
import { initials } from "../admin/types";

// Pjesët e përbashkëta të katër tab-ave të "Materialet": lista majtas me
// kërkim, rreshti i zgjedhur (vjollcë + vijë majtas), avatari, kartelat.

export function Avatar({ name, size = "md" }: { name: string; size?: "md" | "lg" }) {
  return (
    <span aria-hidden className={`rounded-full bg-violet-100 dark:bg-violet-950/60 text-violet-900 dark:text-violet-200 font-extrabold flex items-center justify-center shrink-0 ${size === "lg" ? "w-12 h-12 text-base" : "w-9 h-9 text-xs"}`}>
      {initials(name)}
    </span>
  );
}

export function ListPanel({ search, onSearch, placeholder, label, children }: {
  search: string; onSearch: (v: string) => void; placeholder: string; label: string; children: React.ReactNode;
}) {
  return (
    <section aria-label={label} className="card overflow-hidden flex flex-col lg:max-h-[calc(100vh-260px)]">
      <div className="p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden />
          <input type="search" value={search} onChange={e => onSearch(e.target.value)} aria-label={label} placeholder={placeholder} className="form-input pl-9 text-sm" />
        </div>
      </div>
      <div className="overflow-y-auto flex-1">{children}</div>
    </section>
  );
}

/** Rresht i listës (link, që URL-ja të hapë direkt elementin). */
export function ListRow({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} scroll={false} aria-current={active ? "true" : undefined}
      className={`block px-4 py-3.5 border-t border-slate-100 dark:border-slate-700/60 transition-colors ${
        active ? "bg-violet-50 dark:bg-violet-950/30 shadow-[inset_3px_0_0_#6D28D9]" : "hover:bg-slate-50 dark:hover:bg-slate-800/50"}`}>
      {children}
    </Link>
  );
}

export function EmptyRow({ text }: { text: string }) {
  return <p className="px-4 py-10 text-center text-sm text-slate-500 dark:text-slate-400 border-t border-slate-100 dark:border-slate-700/60">{text}</p>;
}

export function StatCard({ label, value, sub, tone = "" }: { label: string; value: React.ReactNode; sub?: React.ReactNode; tone?: string }) {
  return (
    <div className="card p-4">
      <p className="text-[12.5px] font-bold text-slate-600 dark:text-slate-300">{label}</p>
      <p className={`text-[22px] font-extrabold mt-1 leading-tight ${tone || "text-slate-900 dark:text-white"}`}>{value}</p>
      {sub && <p className="text-[12.5px] text-slate-500 dark:text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}

/** Lista + detajet: majtas ≈340px, djathtas pjesa tjetër; në celular njëra pas tjetrës. */
export function SplitLayout({ list, detail, aside }: { list: React.ReactNode; detail: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className={`grid gap-4 items-start grid-cols-1 lg:grid-cols-[340px_minmax(0,1fr)] ${aside ? "xl:grid-cols-[340px_minmax(0,1fr)_320px]" : ""}`}>
      <div>{list}</div>
      <div className="min-w-0">{detail}</div>
      {aside && <div className="lg:col-span-2 xl:col-span-1 min-w-0">{aside}</div>}
    </div>
  );
}

export const fmtD = (iso: string | Date | null | undefined) => {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
};
