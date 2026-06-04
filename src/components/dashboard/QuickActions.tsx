"use client";

import { useState } from "react";
import Link from "next/link";
import { UserPlus, CreditCard, FileText, X, Plus, ChevronRight } from "lucide-react";

const ACTIONS = [
  {
    id: "student",
    label: "Regjistro Nxënës",
    shortLabel: "Nxënës",
    href: "/students/new",
    icon: UserPlus,
    color:  "text-blue-600 dark:text-blue-400",
    bg:     "bg-blue-50 dark:bg-blue-900/30",
    hover:  "hover:bg-blue-100 dark:hover:bg-blue-900/50 hover:shadow-blue-100 dark:hover:shadow-blue-900/20",
    ring:   "hover:ring-blue-200 dark:hover:ring-blue-800",
    fab:    "bg-blue-500 hover:bg-blue-600 shadow-blue-200",
  },
  {
    id: "payment",
    label: "Regjistro Pagesë",
    shortLabel: "Pagesë",
    href: "/payments/new",
    icon: CreditCard,
    color:  "text-emerald-600 dark:text-emerald-400",
    bg:     "bg-emerald-50 dark:bg-emerald-900/30",
    hover:  "hover:bg-emerald-100 dark:hover:bg-emerald-900/50",
    ring:   "hover:ring-emerald-200 dark:hover:ring-emerald-800",
    fab:    "bg-emerald-500 hover:bg-emerald-600 shadow-emerald-200",
  },
  {
    id: "invoice",
    label: "Gjenero Faturë",
    shortLabel: "Faturë",
    href: "/invoices/new",
    icon: FileText,
    color:  "text-violet-600 dark:text-violet-400",
    bg:     "bg-violet-50 dark:bg-violet-900/30",
    hover:  "hover:bg-violet-100 dark:hover:bg-violet-900/50",
    ring:   "hover:ring-violet-200 dark:hover:ring-violet-800",
    fab:    "bg-violet-500 hover:bg-violet-600 shadow-violet-200",
  },
] as const;

export default function QuickActions() {
  const [fabOpen, setFabOpen] = useState(false);

  return (
    <>
      {/* ── Desktop / Tablet bar ─────────────────────────── */}
      <div className="hidden sm:flex items-center gap-2 bg-white dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 rounded-2xl px-4 py-3 shadow-sm">
        <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mr-2 hidden lg:block">
          Veprime të shpejta
        </p>
        <div className="flex items-center gap-2 flex-1">
          {ACTIONS.map(a => {
            const Icon = a.icon;
            return (
              <Link
                key={a.id}
                href={a.href}
                title={a.label}
                className={`
                  group flex items-center gap-2.5 px-4 py-2.5 rounded-xl
                  border border-transparent ring-1 ring-slate-100 dark:ring-slate-700
                  ${a.bg} ${a.hover} ${a.ring}
                  transition-all duration-200 ease-out
                  hover:shadow-md hover:-translate-y-px
                `}
              >
                <Icon className={`w-4 h-4 ${a.color} flex-shrink-0`} />
                <span className={`text-sm font-medium ${a.color} whitespace-nowrap hidden lg:block`}>
                  {a.label}
                </span>
                <span className={`text-sm font-medium ${a.color} whitespace-nowrap lg:hidden`}>
                  {a.shortLabel}
                </span>
                <ChevronRight className={`w-3.5 h-3.5 ${a.color} opacity-0 -ml-1 group-hover:opacity-60 group-hover:ml-0 transition-all duration-200`} />
              </Link>
            );
          })}
        </div>
      </div>

      {/* ── Mobile FAB ───────────────────────────────────── */}
      <div className="sm:hidden">
        {/* Backdrop */}
        {fabOpen && (
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
            onClick={() => setFabOpen(false)}
          />
        )}

        {/* Expanded actions */}
        <div className={`
          fixed bottom-24 right-5 z-50 flex flex-col gap-2.5 items-end
          transition-all duration-200
          ${fabOpen ? "opacity-100 translate-y-0 pointer-events-auto" : "opacity-0 translate-y-4 pointer-events-none"}
        `}>
          {[...ACTIONS].reverse().map((a, i) => {
            const Icon = a.icon;
            return (
              <Link
                key={a.id}
                href={a.href}
                onClick={() => setFabOpen(false)}
                className={`
                  flex items-center gap-3 pl-4 pr-5 py-3 rounded-2xl
                  text-white font-medium text-sm shadow-lg
                  ${a.fab}
                  transition-all duration-200
                `}
                style={{ transitionDelay: `${i * 40}ms` }}
              >
                <Icon className="w-4.5 h-4.5" />
                {a.label}
              </Link>
            );
          })}
        </div>

        {/* FAB trigger */}
        <button
          onClick={() => setFabOpen(v => !v)}
          className={`
            fixed bottom-6 right-5 z-50 w-14 h-14 rounded-2xl
            flex items-center justify-center shadow-xl
            transition-all duration-200 ease-out
            ${fabOpen
              ? "bg-slate-700 rotate-45 shadow-slate-300"
              : "bg-primary-600 hover:bg-primary-700 shadow-primary-200"}
          `}
        >
          {fabOpen
            ? <X className="w-6 h-6 text-white" />
            : <Plus className="w-6 h-6 text-white" />}
        </button>
      </div>
    </>
  );
}
