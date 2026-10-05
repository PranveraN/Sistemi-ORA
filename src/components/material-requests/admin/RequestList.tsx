"use client";

import { Search, Package } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { type MaterialRequestRow, initials, sentDate, daysUntil, requestSnippet } from "./types";

function deadlineText(date: string | null): { text: string; cls: string } | null {
  const d = daysUntil(date);
  if (d === null) return null;
  if (d < 0) return { text: "afati kaloi", cls: "text-red-600 dark:text-red-400" };
  if (d === 0) return { text: "nevojitet sot", cls: "text-orange-600 dark:text-orange-400" };
  return { text: `nevojitet për ${d} ditë`, cls: d <= 3 ? "text-orange-600 dark:text-orange-400" : "text-slate-400" };
}

export default function RequestList({ rows, selectedId, onSelect, search, onSearch, loading }: {
  rows: MaterialRequestRow[];
  selectedId: number | null;
  onSelect: (id: number) => void;
  search: string;
  onSearch: (q: string) => void;
  loading: boolean;
}) {
  return (
    <div className="card overflow-hidden flex flex-col lg:max-h-[calc(100vh-220px)]">
      <div className="p-3 border-b border-slate-100 dark:border-slate-700">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={e => onSearch(e.target.value)}
            className="form-input pl-9 text-sm"
            placeholder="Kërko mësues, artikull ose klasë..."
            aria-label="Kërko kërkesat"
          />
        </div>
      </div>
      <div className="overflow-y-auto flex-1">
        {loading ? (
          <p className="text-sm text-slate-400 text-center py-10">Duke ngarkuar...</p>
        ) : rows.length === 0 ? (
          <div className="p-8 text-center">
            <Package className="w-8 h-8 text-slate-300 mx-auto mb-2" />
            <p className="text-slate-400 text-sm">Asnjë kërkesë këtu.</p>
          </div>
        ) : (
          <ul>
            {rows.map(r => {
              const active = r.id === selectedId;
              const dl = deadlineText(r.dateNeeded);
              return (
                <li key={r.id}>
                  <button
                    onClick={() => onSelect(r.id)}
                    aria-current={active ? "true" : undefined}
                    className={`w-full text-left px-3 py-3 border-b border-slate-100 dark:border-slate-700/60 border-l-4 transition-colors ${
                      active
                        ? "bg-primary-50 dark:bg-primary-900/20 border-l-primary-600"
                        : "border-l-transparent hover:bg-slate-50 dark:hover:bg-slate-800/60"
                    }`}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 flex items-center justify-center text-xs font-bold shrink-0">
                        {initials(r.teacher.name)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <p className="text-sm font-semibold text-slate-800 dark:text-white truncate">{r.teacher.name}</p>
                          <span className="text-[11px] text-slate-400 shrink-0">{formatDate(sentDate(r))}</span>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 truncate mt-0.5">{requestSnippet(r)}</p>
                        <div className="flex items-center gap-1.5 flex-wrap mt-1.5 text-[11px]">
                          {r.priority === "URGENT" && (
                            <span className="px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 font-medium">Urgjente</span>
                          )}
                          {r.class?.name && (
                            <span className="px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{r.class.name}</span>
                          )}
                          <span className="text-slate-400">{r.items.length} artikuj</span>
                          {dl && <span className={dl.cls}>· {dl.text}</span>}
                        </div>
                      </div>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
