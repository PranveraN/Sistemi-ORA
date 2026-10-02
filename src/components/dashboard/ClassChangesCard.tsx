"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRightLeft } from "lucide-react";
import { formatDate } from "@/lib/utils";

export interface ClassChangeRow {
  id: number; studentId: number; studentName: string; title: string;
  description: string | null; occurredAt: string; userName: string | null;
}

// "Ndërrime klase" te Lëvizjet — zhvendosjet mes klasave dhe kalimet e vitit
// (nga historiku i nxënësit). Vetëm shikim.
export default function ClassChangesCard({ data, period }: { data: { count: number; entries: ClassChangeRow[] }; period: string }) {
  const [showAll, setShowAll] = useState(false);
  const list = showAll ? data.entries : data.entries.slice(0, 8);
  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="section-title flex items-center gap-2"><ArrowRightLeft className="w-4 h-4 text-amber-500" /> Ndërrime klase</h3>
        <span className="text-xs text-slate-400">{period} · {data.count}</span>
      </div>
      {data.count === 0 ? (
        <p className="text-sm text-slate-400">Asnjë ndërrim klase në këtë periudhë.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {list.map(e => (
            <li key={e.id} className="py-2 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <Link href={`/students/${e.studentId}`} className="text-sm font-medium text-slate-800 dark:text-slate-100 hover:text-primary-600">{e.studentName}</Link>
                <p className="text-xs text-slate-500">{e.title}{e.description ? ` · ${e.description}` : ""}</p>
              </div>
              <span className="text-xs text-slate-400 shrink-0">{formatDate(e.occurredAt)}</span>
            </li>
          ))}
        </ul>
      )}
      {data.entries.length > 8 && (
        <button type="button" onClick={() => setShowAll(v => !v)} className="text-sm font-medium text-primary-600">
          {showAll ? "Shfaq më pak" : `Shfaq të gjitha (${data.entries.length})`}
        </button>
      )}
    </div>
  );
}
