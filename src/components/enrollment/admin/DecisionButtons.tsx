"use client";

import { X, Eye, ClipboardList } from "lucide-react";
import type { EvidencaState } from "@/lib/enrollmentRules";

export interface DecisionApp {
  id: number;
  status: string;
  evidencaState: EvidencaState;
  gradeSeats: { free: number; capacity: number } | null;
}

export const EVIDENCA_BADGE: Record<EvidencaState, { label: string; className: string }> = {
  REQUIRED:     { label: "E detyrueshme",  className: "bg-orange-50 text-orange-700 border-orange-200 dark:bg-orange-900/30 dark:text-orange-400 dark:border-orange-800" },
  IN_PROGRESS:  { label: "Në plotësim",    className: "bg-primary-50 text-primary-700 border-primary-200 dark:bg-primary-900/30 dark:text-primary-300 dark:border-primary-800" },
  DONE:         { label: "E plotësuar ✓",  className: "bg-green-50 text-green-700 border-green-200 dark:bg-green-900/30 dark:text-green-400 dark:border-green-800" },
  NOT_REQUIRED: { label: "Nuk kërkohet",   className: "bg-slate-100 text-slate-500 border-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:border-slate-600" },
};

/** Ngjyra/teksti i vendeve të lira — i njëjti rregull si moduli Klasat. */
export function seatsInfo(free: number) {
  if (free < 0) return { text: `${-free} mbi kapacitet`, className: "text-red-600" };
  if (free === 0) return { text: "Plot", className: "text-red-600" };
  if (free <= 2) return { text: `${free} ${free === 1 ? "vend i lirë" : "vende të lira"}`, className: "text-orange-600" };
  return { text: `${free} vende të lira`, className: "text-green-600" };
}

// Butonat e vendimit sipas rregullave — I NJËJTI komponent te tabela dhe te
// paneli i detajeve. Backend-i i rikontrollon të gjitha (s'mbështetemi te fshehja).
export default function DecisionButtons({ app, readOnly, onEvidenca, onApprove, onReject, onView, compact }: {
  app: DecisionApp;
  readOnly?: boolean;
  onEvidenca: () => void;
  onApprove: (overCapacity: boolean) => void;
  onReject: () => void;
  onView?: () => void;
  compact?: boolean;
}) {
  const open = app.status === "PENDING" || app.status === "EVIDENCA";
  const evidencaPending = app.evidencaState === "REQUIRED" || app.evidencaState === "IN_PROGRESS";
  const full = !!app.gradeSeats && app.gradeSeats.free <= 0;
  const h = compact ? "py-1.5" : "py-2";

  return (
    <div className="flex items-center justify-end gap-1.5 flex-wrap">
      {open && !readOnly && (
        evidencaPending ? (
          <button type="button" onClick={onEvidenca}
            className={`px-3 ${h} rounded-lg text-xs font-semibold bg-primary-600 text-white hover:bg-primary-700 inline-flex items-center gap-1.5`}>
            <ClipboardList className="w-3.5 h-3.5" /> Plotëso evidencën
          </button>
        ) : (
          <>
            {full ? (
              <button type="button" onClick={() => onApprove(true)}
                className={`px-3 ${h} rounded-lg text-xs font-semibold bg-orange-50 text-orange-700 border border-orange-300 hover:bg-orange-100 dark:bg-orange-900/30 dark:text-orange-400`}>
                Prano gjithsesi
              </button>
            ) : (
              <button type="button" onClick={() => onApprove(false)}
                className={`px-3 ${h} rounded-lg text-xs font-semibold bg-green-600 text-white hover:bg-green-700`}>
                Prano
              </button>
            )}
            {app.evidencaState === "NOT_REQUIRED" && (
              <button type="button" onClick={onEvidenca}
                className={`px-3 ${h} rounded-lg text-xs font-medium border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700`}>
                Evidencë
              </button>
            )}
          </>
        )
      )}
      {open && !readOnly && (
        <button type="button" onClick={onReject} title="Refuzo" aria-label="Refuzo aplikimin"
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20">
          <X className="w-4 h-4" />
        </button>
      )}
      {onView && (
        <button type="button" onClick={onView} title="Shiko" aria-label="Shiko aplikimin"
          className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20">
          <Eye className="w-4 h-4" />
        </button>
      )}
    </div>
  );
}
