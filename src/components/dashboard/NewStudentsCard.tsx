"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UserPlus, ChevronUp, ChevronDown, Plus, Pencil, Eraser, Eye, MoreVertical } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { STUDENT_RATING_COLORS } from "@/lib/studentRatings";
import StudentEnrichmentModal from "./StudentEnrichmentModal";

export interface NewStudentRow {
  id: number;
  firstName: string;
  lastName: string;
  className: string | null;
  originCountry: string | null;
  enrollDate: string;
  previousSchool: string | null;
  transferResult: string | null;
  admissionScore: number | null;
  studentRating: string | null;
}

interface Props {
  data: { count: number; students: NewStudentRow[] };
  activeStudents: number;
  period: string;
  onChanged: () => void;
  emptyMessage?: string;
}

const PREVIEW_LIMIT = 6;

// A ka detaje shtesë (përveç origjinës, që tashmë shfaqet në rresht)?
function hasExtra(s: NewStudentRow) {
  return !!(s.previousSchool || s.transferResult || s.admissionScore != null);
}

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

export default function NewStudentsCard({ data, activeStudents, period, onChanged, emptyMessage }: Props) {
  const [show, setShow] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [modal, setModal] = useState<"add" | NewStudentRow | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [openMenuFor, setOpenMenuFor] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openMenuFor == null) return;
    function handle(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpenMenuFor(null);
    }
    document.addEventListener("mousedown", handle);
    return () => document.removeEventListener("mousedown", handle);
  }, [openMenuFor]);

  async function clearEnrichment(s: NewStudentRow) {
    if (!confirm(`T'i pastroj detajet e regjistrimit (pikët, vlerësimin, shkollën paraardhëse, fletëkalimin) për ${s.firstName} ${s.lastName}? Vetë nxënësi NUK fshihet.`)) return;
    await fetch(`/api/students/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ previousSchool: null, transferResult: null, admissionScore: null, studentRating: null }),
    });
    onChanged();
  }

  const visibleStudents = showAll ? data.students : data.students.slice(0, PREVIEW_LIMIT);

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setShow(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
            <UserPlus className="w-4 h-4 text-blue-600 dark:text-blue-400" />
          </div>
          <div className="text-left">
            <span className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-semibold text-sm">
              Nxënës të Rinj
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">{data.count}</span>
            </span>
            <p className="text-xs text-slate-400 font-normal">Regjistruar gjatë {period}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className="hidden sm:block text-xs text-slate-400 font-normal">
            {activeStudents} aktivë gjithsej
          </span>
          {show ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </div>
      </button>

      {show && (
        <div className="border-t border-slate-100 dark:border-slate-700 p-4 pt-3">
          <div className="flex items-center justify-between mb-2">
            <span className="sm:hidden text-xs text-slate-400">{activeStudents} aktivë gjithsej</span>
            <button
              onClick={() => setModal("add")}
              className="ml-auto text-xs font-medium text-primary-600 border border-primary-200 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg px-2.5 py-1.5 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Shto Regjistrim
            </button>
          </div>

          {data.count === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              {emptyMessage ?? "Asnjë nxënës i ri i regjistruar në këtë periudhë."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[520px]">
                <div className="grid grid-cols-[minmax(150px,1.6fr)_80px_90px_120px_64px] gap-2 px-2 pb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                  <span>Nxënësi</span>
                  <span>Klasa</span>
                  <span>Data</span>
                  <span>Nga</span>
                  <span className="text-right">Veprimet</span>
                </div>
                <div className="space-y-0.5">
                  {visibleStudents.map(s => {
                    const expanded = expandedId === s.id;
                    const extra = hasExtra(s);
                    return (
                      <div key={s.id} className="rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                        <div
                          className="grid grid-cols-[minmax(150px,1.6fr)_80px_90px_120px_64px] gap-2 items-center px-2 py-2 cursor-default"
                          onClick={() => extra && setExpandedId(expanded ? null : s.id)}
                          role={extra ? "button" : undefined}
                        >
                          <span className="min-w-0 flex items-center gap-2">
                            <span className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                              {initials(s.firstName, s.lastName)}
                            </span>
                            <span className="min-w-0 flex flex-col">
                              <span className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate flex items-center gap-1.5">
                                {s.firstName} {s.lastName}
                                {extra && (expanded ? <ChevronUp className="w-3 h-3 text-slate-300 shrink-0" /> : <ChevronDown className="w-3 h-3 text-slate-300 shrink-0" />)}
                              </span>
                              {s.studentRating && (
                                <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium w-fit mt-0.5 ${STUDENT_RATING_COLORS[s.studentRating] ?? "bg-slate-100 text-slate-500"}`}>
                                  {s.studentRating}
                                </span>
                              )}
                            </span>
                          </span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{s.className ?? "—"}</span>
                          <span className="text-xs text-slate-400 truncate">{formatDate(s.enrollDate)}</span>
                          <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{s.originCountry ?? "—"}</span>
                          <span className="flex items-center justify-end gap-0.5">
                            <Link
                              href={`/students/${s.id}`}
                              onClick={e => e.stopPropagation()}
                              title="Shiko profilin"
                              className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:text-slate-500 dark:hover:text-primary-400"
                            >
                              <Eye className="w-3.5 h-3.5" />
                            </Link>
                            <div className="relative" ref={openMenuFor === s.id ? menuRef : undefined}>
                              <button
                                onClick={e => { e.stopPropagation(); setOpenMenuFor(openMenuFor === s.id ? null : s.id); }}
                                title="Më shumë"
                                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                              >
                                <MoreVertical className="w-3.5 h-3.5" />
                              </button>
                              {openMenuFor === s.id && (
                                <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden text-xs">
                                  <button
                                    onClick={e => { e.stopPropagation(); setOpenMenuFor(null); setModal(s); }}
                                    className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-600 dark:text-slate-300"
                                  >
                                    <Pencil className="w-3.5 h-3.5" /> Edito detajet
                                  </button>
                                  <button
                                    onClick={e => { e.stopPropagation(); setOpenMenuFor(null); clearEnrichment(s); }}
                                    className="w-full text-left px-3 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-2 border-t border-slate-100 dark:border-slate-700"
                                  >
                                    <Eraser className="w-3.5 h-3.5" /> Pastro detajet
                                  </button>
                                </div>
                              )}
                            </div>
                          </span>
                        </div>

                        {expanded && (
                          <div className="px-3 pb-3 pl-11 space-y-1.5 text-xs">
                            {s.previousSchool && <DetailRow label="Shkolla Paraardhëse" value={s.previousSchool} />}
                            {s.transferResult && <DetailRow label="Suksesi i Fletëkalimit" value={s.transferResult} />}
                            {s.admissionScore != null && <DetailRow label="Pikët e Testit" value={`${s.admissionScore} pikë`} />}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
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

      {modal && (
        <StudentEnrichmentModal
          preselected={modal === "add" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); onChanged(); }}
        />
      )}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-baseline gap-1.5">
      <span className="text-slate-400 shrink-0">{label}:</span>
      <span className="text-slate-600 dark:text-slate-300 font-medium">{value}</span>
    </p>
  );
}
