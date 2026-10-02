"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import ClassMenu from "./ClassMenu";
import { CapacityBar, type OverviewClass } from "./ClassCard";

type Key = "name" | "teacher" | "students" | "debt" | "active";
const collator = new Intl.Collator("sq", { numeric: true, sensitivity: "base" });

export default function ClassesTable({ classes, year, readOnly, onChanged }: {
  classes: OverviewClass[]; year: number; readOnly: boolean; onChanged: () => void;
}) {
  const [sort, setSort] = useState<Key>("name");
  const [dir, setDir] = useState<1 | -1>(1);

  const sorted = useMemo(() => {
    const cmp: Record<Key, (a: OverviewClass, b: OverviewClass) => number> = {
      name: (a, b) => collator.compare(a.name, b.name),
      teacher: (a, b) => collator.compare(a.teacher ?? "", b.teacher ?? ""),
      students: (a, b) => a.students / a.effectiveCapacity - b.students / b.effectiveCapacity,
      debt: (a, b) => a.debt - b.debt,
      active: (a, b) => Number(b.active) - Number(a.active),
    };
    return [...classes].sort((a, b) => cmp[sort](a, b) * dir || collator.compare(a.name, b.name));
  }, [classes, sort, dir]);

  function toggle(k: Key) {
    if (sort === k) setDir(d => (d === 1 ? -1 : 1));
    else { setSort(k); setDir(k === "debt" ? -1 : 1); }
  }
  const H = ({ k, label }: { k: Key; label: string }) => (
    <th className="table-header" aria-sort={sort !== k ? "none" : dir === 1 ? "ascending" : "descending"}>
      <button type="button" onClick={() => toggle(k)} className="inline-flex items-center gap-1 hover:text-primary-600">
        {label} <span className="text-slate-400 text-[11px]">{sort !== k ? "↕" : dir === 1 ? "↑" : "↓"}</span>
      </button>
    </th>
  );

  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-slate-50 dark:bg-slate-800/50">
            <tr>
              <H k="name" label="Klasa" />
              <H k="teacher" label="Mësuesi" />
              <H k="students" label="Nxënës / kapaciteti" />
              <H k="debt" label="Me borxh" />
              <H k="active" label="Statusi" />
              <th className="table-header text-right">Veprime</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {sorted.map(c => {
              const live = c.id > 0;
              return (
                <tr key={c.id} className={c.active ? "" : "opacity-60"}>
                  <td className="table-cell font-bold text-slate-900 dark:text-white">{c.name}</td>
                  <td className="table-cell text-sm">{c.teacher || <span className="text-orange-600 font-medium">Pa mësues</span>}</td>
                  <td className="table-cell min-w-[200px]"><CapacityBar students={c.students} cap={c.effectiveCapacity} /></td>
                  <td className="table-cell">
                    {c.debt > 0 ? (
                      live ? <Link href={`/students?cl=${c.id}&card=debt&y=${year}`} className="text-sm font-semibold text-red-600 hover:underline">{c.debt}</Link>
                           : <span className="text-sm font-semibold text-red-600">{c.debt}</span>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="table-cell">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${c.active ? "bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-slate-100 text-slate-500 dark:bg-slate-700"}`}>
                      {c.active ? "Aktive" : "Joaktive"}
                    </span>
                  </td>
                  <td className="table-cell">
                    <div className="flex items-center justify-end gap-1">
                      {live && (
                        <Link href={`/classes/${c.id}?y=${year}`} className="text-sm font-medium text-primary-600 hover:text-primary-700 inline-flex items-center gap-1 px-2">
                          Hap <ArrowRight className="w-3.5 h-3.5" />
                        </Link>
                      )}
                      {live && <ClassMenu cls={c} onChanged={onChanged} readOnly={readOnly} />}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
