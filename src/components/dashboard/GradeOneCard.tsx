"use client";

import { useState } from "react";
import { Baby, ChevronUp, ChevronDown, ClipboardPaste } from "lucide-react";
import { formatDate } from "@/lib/utils";
import BulkAddNewStudentsModal from "./BulkAddNewStudentsModal";
import type { NewStudentRow } from "./NewStudentsCard";

interface Props {
  data: { count: number; students: NewStudentRow[] };
  period: string;
  onChanged: () => void;
}

const PREVIEW_LIMIT = 6;

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

// Nën-pasqyrë e "Nxënës të Rinj" — vetëm nxënës e Klasës së Parë (filtrim
// client-side sipas emrit të klasës, shih isGrade1). S'ka API të vet: "Ngjit
// Listë" hap TË NJËJTIN modal si karta kryesore (kërkon mes nxënësve
// ekzistues, s'krijon të rinj) — çdo ndryshim atje rifreskon edhe këtu.
export default function GradeOneCard({ data, period, onChanged }: Props) {
  const [show, setShow] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  const visible = showAll ? data.students : data.students.slice(0, PREVIEW_LIMIT);

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setShow(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-teal-50 dark:bg-teal-900/30 flex items-center justify-center shrink-0">
            <Baby className="w-4 h-4 text-teal-600 dark:text-teal-400" />
          </div>
          <div className="text-left">
            <span className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-semibold text-sm">
              Klasa e Parë — Ardhje
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-400">{data.count}</span>
            </span>
            <p className="text-xs text-slate-400 font-normal">Regjistruar gjatë {period}</p>
          </div>
        </div>
        {show ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {show && (
        <div className="border-t border-slate-100 dark:border-slate-700 p-4 pt-3">
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setShowBulk(true)}
              className="text-xs font-medium text-primary-600 border border-primary-200 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg px-2.5 py-1.5 flex items-center gap-1"
            >
              <ClipboardPaste className="w-3.5 h-3.5" /> Ngjit Listë
            </button>
          </div>

          {data.count === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Asnjë nxënës i ri i Klasës së Parë në këtë periudhë.</p>
          ) : (
            <div className="space-y-0.5">
              {visible.map(s => (
                <div key={s.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <span className="w-7 h-7 rounded-full bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                    {initials(s.firstName, s.lastName)}
                  </span>
                  <span className="min-w-0 flex-1 text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{s.firstName} {s.lastName}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{s.className ?? "—"}</span>
                  <span className="text-xs text-slate-400 shrink-0 w-20 text-right">{formatDate(s.enrollDate)}</span>
                </div>
              ))}
            </div>
          )}

          {data.students.length > PREVIEW_LIMIT && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="w-full mt-2 text-xs font-medium text-primary-600 hover:underline py-1.5"
            >
              {showAll ? "Shiko më pak" : `Shiko të gjitha (${data.students.length})`}
            </button>
          )}
        </div>
      )}

      {showBulk && (
        <BulkAddNewStudentsModal
          onClose={() => setShowBulk(false)}
          onSaved={() => { setShowBulk(false); onChanged(); }}
        />
      )}
    </div>
  );
}
