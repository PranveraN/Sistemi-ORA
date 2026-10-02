"use client";

import Link from "next/link";
import { UserRound, AlertCircle, HeartHandshake, ArrowRight } from "lucide-react";
import ClassMenu from "./ClassMenu";

export interface OverviewClass {
  id: number;
  name: string;
  level: string;
  teacher: string | null;
  capacity: number | null;
  effectiveCapacity: number;
  active: boolean;
  students: number;
  debt: number;
  specialCare?: number;
}

/** Teksti dhe ngjyra e kapacitetit — i përbashkët për kartat dhe tabelën. */
export function capacityInfo(students: number, cap: number) {
  const free = cap - students;
  const pct = cap > 0 ? Math.min(100, Math.round((students / cap) * 100)) : 0;
  if (free < 0) return { pct: 100, text: `${-free} mbi kapacitet`, tone: "text-red-600", bar: "bg-red-500", over: true };
  if (free <= 2) return { pct, text: free === 0 ? "Plot" : `${free} ${free === 1 ? "vend i lirë" : "vende të lira"}`, tone: "text-orange-600", bar: "bg-orange-500", over: false };
  return { pct, text: `${free} vende të lira`, tone: "text-green-600", bar: "bg-green-500", over: false };
}

export function CapacityBar({ students, cap }: { students: number; cap: number }) {
  const c = capacityInfo(students, cap);
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-600 dark:text-slate-300"><span className="font-semibold">{students}</span> / {cap} nxënës</span>
        <span className={`font-medium ${c.tone}`}>{c.text}</span>
      </div>
      <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden" role="progressbar" aria-valuenow={c.pct} aria-valuemin={0} aria-valuemax={100}>
        <div className={`h-full rounded-full ${c.bar}`} style={{ width: `${c.pct}%` }} />
      </div>
    </div>
  );
}

export default function ClassCard({ cls, year, readOnly, onChanged, onAssignTeacher }: {
  cls: OverviewClass;
  year: number;
  readOnly: boolean;
  onChanged: () => void;
  onAssignTeacher: (cls: OverviewClass) => void;
}) {
  const over = cls.students > cls.effectiveCapacity;
  const live = cls.id > 0;
  return (
    <div className={`card p-4 flex flex-col gap-3 border-2 ${over ? "border-red-300 dark:border-red-800" : "border-transparent"} ${cls.active ? "" : "opacity-60"}`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-slate-900 dark:text-white">{cls.name}</span>
          {!cls.active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">Joaktive</span>}
        </div>
        {live && <ClassMenu cls={cls} onChanged={onChanged} readOnly={readOnly} />}
      </div>

      {cls.teacher ? (
        <p className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1.5"><UserRound className="w-4 h-4 text-slate-400" /> {cls.teacher}</p>
      ) : readOnly || !live ? (
        <p className="text-sm text-orange-600 flex items-center gap-1.5"><UserRound className="w-4 h-4" /> Pa mësues</p>
      ) : (
        <button type="button" onClick={() => onAssignTeacher(cls)}
          className="self-start text-xs font-medium px-2.5 py-1 rounded-lg bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-400 border border-orange-200 dark:border-orange-800 hover:bg-orange-100">
          Pa mësues · Cakto
        </button>
      )}

      <CapacityBar students={cls.students} cap={cls.effectiveCapacity} />

      <div className="flex flex-wrap items-center gap-1.5">
        {cls.debt > 0 && live && (
          <Link href={`/students?cl=${cls.id}&card=debt&y=${year}`}
            className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400 dark:border-red-800 hover:bg-red-100"
            title="Hap Nxënësit me borxh të kësaj klase">
            <AlertCircle className="w-3 h-3" /> {cls.debt} me borxh
          </Link>
        )}
        {cls.debt > 0 && !live && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/30 dark:text-red-400">
            <AlertCircle className="w-3 h-3" /> {cls.debt} me borxh
          </span>
        )}
        {!!cls.specialCare && (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/30 dark:text-blue-400 dark:border-blue-800">
            <HeartHandshake className="w-3 h-3" /> {cls.specialCare} kujdes i veçantë
          </span>
        )}
      </div>

      {live && (
        <Link href={`/classes/${cls.id}?y=${year}`} className="mt-auto text-sm font-medium text-primary-600 hover:text-primary-700 inline-flex items-center gap-1">
          Hap klasën <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      )}
    </div>
  );
}
