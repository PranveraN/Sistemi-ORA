"use client";

import Link from "next/link";
import { Printer, FileText } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { SekretariaSummary } from "@/lib/sekretariaSummary";

// 5 dokumentet e fundit të lëshuara nga Sekretaria (arkivi). "Printo" e rihap
// dokumentin te moduli i vet (ose kontratën e nxënësit me nxënësin e zgjedhur).
export default function RecentDocuments({ docs, canArkiva }: { docs: SekretariaSummary["recentDocuments"]; canArkiva: boolean }) {
  return (
    <div className="card p-4">
      <h3 className="font-semibold text-sm text-slate-800 dark:text-white mb-3">Dokumentet e fundit</h3>
      {docs.length === 0 ? (
        <p className="text-xs text-slate-400">Ende asnjë dokument i regjistruar.</p>
      ) : (
        <ul className="space-y-2">
          {docs.map(d => (
            <li key={d.id} className="flex items-center gap-2.5">
              <FileText className="w-4 h-4 text-slate-400 shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm text-slate-700 dark:text-slate-200 truncate">{d.label} · {d.person}</p>
                <p className="text-[11px] text-slate-400">{formatDate(d.createdAt)}{d.className ? ` · ${d.className}` : ""}</p>
              </div>
              <Link href={d.href} className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-slate-800" title="Printo" aria-label={`Printo ${d.label} për ${d.person}`}>
                <Printer className="w-4 h-4" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      {canArkiva && <Link href="/arkiva" className="block mt-3 text-xs text-primary-600 hover:underline">Shiko arkivin →</Link>}
    </div>
  );
}
