"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { UserMinus, ChevronUp, ChevronDown, Plus, Pencil, Eraser, Eye, MoreVertical } from "lucide-react";
import { formatDate } from "@/lib/utils";
import DepartedStudentModal from "./DepartedStudentModal";

export interface DepartedStudentRow {
  id: number;
  firstName: string;
  lastName: string;
  className: string | null;
  leaveReason: string | null;
  destinationSchool: string | null;
  inactiveDate: string;
}

interface Props {
  data: { count: number; students: DepartedStudentRow[] };
  period: string;
  onChanged: () => void;
  emptyMessage?: string;
}

const PREVIEW_LIMIT = 6;

function initials(first: string, last: string) {
  return `${first[0] ?? ""}${last[0] ?? ""}`.toUpperCase();
}

export default function DepartedStudentsCard({ data, period, onChanged, emptyMessage }: Props) {
  const [show, setShow] = useState(true);
  const [modal, setModal] = useState<"add" | DepartedStudentRow | null>(null);
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

  async function clearReason(s: DepartedStudentRow) {
    if (!confirm(`T'i pastroj arsyen e largimit dhe shkollën ku kaloi ${s.firstName} ${s.lastName}? Statusi Joaktiv NUK ndryshon.`)) return;
    await fetch(`/api/students/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ leaveReason: null, destinationSchool: null }),
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
          <div className="w-8 h-8 rounded-lg bg-red-50 dark:bg-red-900/30 flex items-center justify-center shrink-0">
            <UserMinus className="w-4 h-4 text-red-500 dark:text-red-400" />
          </div>
          <div className="text-left">
            <span className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-semibold text-sm">
              Largime / Transfere
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-400">{data.count}</span>
            </span>
            <p className="text-xs text-slate-400 font-normal">Larguar gjatë {period}</p>
          </div>
        </div>
        {show ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {show && (
        <div className="border-t border-slate-100 dark:border-slate-700 p-4 pt-3">
          <div className="flex items-center justify-end mb-2">
            <button
              onClick={() => setModal("add")}
              className="text-xs font-medium text-primary-600 border border-primary-200 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg px-2.5 py-1.5 flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5" /> Shto Largim
            </button>
          </div>

          {data.count === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">
              {emptyMessage ?? "Asnjë nxënës s'është larguar në këtë periudhë."}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <div className="min-w-[520px]">
                <div className="grid grid-cols-[minmax(150px,1.6fr)_80px_90px_1.2fr_64px] gap-2 px-2 pb-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wide">
                  <span>Nxënësi</span>
                  <span>Klasa</span>
                  <span>Data</span>
                  <span>Lloji / Ku</span>
                  <span className="text-right">Veprimet</span>
                </div>
                <div className="space-y-0.5">
                  {visibleStudents.map(s => (
                    <div key={s.id} className="grid grid-cols-[minmax(150px,1.6fr)_80px_90px_1.2fr_64px] gap-2 items-center px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors">
                      <span className="min-w-0 flex items-center gap-2">
                        <span className="w-7 h-7 rounded-full bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 text-[11px] font-bold flex items-center justify-center shrink-0">
                          {initials(s.firstName, s.lastName)}
                        </span>
                        <Link href={`/students/${s.id}`} className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate hover:underline">
                          {s.firstName} {s.lastName}
                        </Link>
                      </span>
                      <span className="text-xs text-slate-500 dark:text-slate-400 truncate">{s.className ?? "—"}</span>
                      <span className="text-xs text-slate-400 truncate">{formatDate(s.inactiveDate)}</span>
                      <span className="min-w-0 flex flex-wrap items-center gap-1.5">
                        {s.leaveReason ? (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium truncate max-w-full">
                            {s.leaveReason}
                          </span>
                        ) : <span className="text-xs text-slate-300">—</span>}
                        {s.destinationSchool && (
                          <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 truncate max-w-full">
                            → {s.destinationSchool}
                          </span>
                        )}
                      </span>
                      <span className="flex items-center justify-end gap-0.5">
                        <Link
                          href={`/students/${s.id}`}
                          title="Shiko profilin"
                          className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:text-slate-500 dark:hover:text-primary-400"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </Link>
                        <div className="relative" ref={openMenuFor === s.id ? menuRef : undefined}>
                          <button
                            onClick={() => setOpenMenuFor(openMenuFor === s.id ? null : s.id)}
                            title="Më shumë"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 dark:hover:text-slate-200"
                          >
                            <MoreVertical className="w-3.5 h-3.5" />
                          </button>
                          {openMenuFor === s.id && (
                            <div className="absolute right-0 top-full mt-1 w-44 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl z-20 overflow-hidden text-xs">
                              <button
                                onClick={() => { setOpenMenuFor(null); setModal(s); }}
                                className="w-full text-left px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2 text-slate-600 dark:text-slate-300"
                              >
                                <Pencil className="w-3.5 h-3.5" /> Edito arsyen
                              </button>
                              <button
                                onClick={() => { setOpenMenuFor(null); clearReason(s); }}
                                className="w-full text-left px-3 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 dark:text-red-400 flex items-center gap-2 border-t border-slate-100 dark:border-slate-700"
                              >
                                <Eraser className="w-3.5 h-3.5" /> Pastro arsyen/shkollën
                              </button>
                            </div>
                          )}
                        </div>
                      </span>
                    </div>
                  ))}
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
        <DepartedStudentModal
          preselected={modal === "add" ? null : modal}
          onClose={() => setModal(null)}
          onSaved={() => { setModal(null); onChanged(); }}
        />
      )}
    </div>
  );
}
