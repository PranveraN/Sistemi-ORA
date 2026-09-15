"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { YearType } from "@/lib/academicYear";

// Vitet e fundit gjithmonë të dukshme; pjesa tjetër palosen te "Vite të tjera"
// — një rresht me shumë butona vitesh njëherësh ishte zë vizual i panevojshëm.
const VISIBLE_YEARS_COUNT = 4;

export default function YearPicker({ years, year, yearType, onSelect }: {
  years: readonly number[]; year: number; yearType: YearType; onSelect: (y: number) => void;
}) {
  const [showMore, setShowMore] = useState(false);
  const recent = years.slice(-VISIBLE_YEARS_COUNT);
  const older = years.slice(0, -VISIBLE_YEARS_COUNT);
  const label = (y: number) => yearType === "academic" ? `${y}–${y + 1}` : String(y);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {recent.map(y => (
        <button key={y} onClick={() => onSelect(y)}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${year === y ? "bg-primary-600 text-white shadow-sm" : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary-300"}`}>
          {label(y)}
        </button>
      ))}
      {older.length > 0 && (
        <div className="relative">
          <button onClick={() => setShowMore(v => !v)}
            className={`flex items-center gap-1 px-3 py-2 rounded-xl text-sm font-medium transition-all ${older.includes(year) ? "bg-primary-600 text-white shadow-sm" : "bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:border-primary-300"}`}>
            {older.includes(year) ? label(year) : "Vite të tjera"}
            <ChevronDown className="w-3.5 h-3.5" />
          </button>
          {showMore && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowMore(false)} />
              <div className="absolute z-50 mt-1 p-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg flex flex-col gap-1 max-h-64 overflow-y-auto">
                {older.map(y => (
                  <button key={y} onClick={() => { onSelect(y); setShowMore(false); }}
                    className={`px-3 py-1.5 rounded-lg text-sm text-left whitespace-nowrap transition-colors ${year === y ? "bg-primary-600 text-white" : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700"}`}>
                    {label(y)}
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
