"use client";

import Link from "next/link";
import type { SekretariaSummary } from "@/lib/sekretariaSummary";

interface Task { key: string; text: string; module: string; href: string; tone: "orange" | "red" }

/** "Për sot" — çka pret veprim nga modulet; çdo rresht hap modulin të filtruar. Rreshtat me 0 s'shfaqen. */
export function buildTodayTasks(s: SekretariaSummary): Task[] {
  const t: Task[] = [];
  const sc = s.staffContracts;
  if (s.studentContracts.pending > 0) t.push({ key: "sc", tone: "orange", text: `${s.studentContracts.pending} kontrata nxënësish presin nënshkrimin`, module: "Kontratat e Nxënësve", href: "/sekretaria/kontratat-nxenesve?kontrata=pending" });
  if (sc.expired > 0) t.push({ key: "exp", tone: "red", text: `${sc.expired} kontrata stafi kanë skaduar`, module: "Stafi", href: "/sekretaria/stafi?kontrata=expired" });
  if (sc.expiringSoon > 0) t.push({ key: "soon", tone: "orange", text: `${sc.expiringSoon} kontrata stafi skadojnë brenda ${sc.thresholdDays} ditëve`, module: "Stafi", href: "/sekretaria/stafi?kontrata=expiring" });
  if (s.libriAme.incomplete > 0) t.push({ key: "la", tone: "orange", text: `${s.libriAme.incomplete} nxënës me të dhëna jo të plota`, module: "Libri Amë", href: "/sekretaria/libri-ame?filter=incomplete" });
  return t;
}

export default function TodayPanel({ summary }: { summary: SekretariaSummary }) {
  const tasks = buildTodayTasks(summary);
  return (
    <div className="card p-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="font-semibold text-sm text-slate-800 dark:text-white">Për sot</h3>
        {tasks.length > 0 && <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">{tasks.length} detyra</span>}
      </div>
      {tasks.length === 0 ? (
        <p className="text-sm text-green-600 dark:text-green-400">Asgjë në pritje sot ✓</p>
      ) : (
        <ul className="space-y-1">
          {tasks.map(t => (
            <li key={t.key}>
              <Link href={t.href} className="flex items-start gap-2.5 rounded-lg px-2 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                <span className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${t.tone === "red" ? "bg-red-500" : "bg-orange-400"}`} aria-hidden />
                <span className="min-w-0">
                  <span className="block text-sm text-slate-700 dark:text-slate-200">{t.text}</span>
                  <span className="block text-[11px] text-slate-400">{t.module}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
