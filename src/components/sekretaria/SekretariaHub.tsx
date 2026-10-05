"use client";

import { useCallback, useEffect, useState } from "react";
import type { SekretariaSummary } from "@/lib/sekretariaSummary";
import PersonSearch from "./PersonSearch";
import QuickActions from "./QuickActions";
import ModuleCard from "./ModuleCard";
import YearClosingCard from "./YearClosingCard";
import TodayPanel from "./TodayPanel";
import RecentDocuments from "./RecentDocuments";
import { SEK_MODULES } from "./modules";

type Summary = SekretariaSummary & { permissions: { canWrite: boolean; classes: boolean; arkiva: boolean; students: boolean } };

const GroupTitle = ({ children }: { children: React.ReactNode }) => (
  <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2">{children}</h2>
);

// Paneli i Sekretarisë — VETËM lexon dhe përmbledh modulet; çdo veprim hap
// formularin ekzistues të modulit. Të gjithë numrat vijnë nga /api/sekretaria/summary.
export default function SekretariaHub() {
  const [s, setS] = useState<Summary | null>(null);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/sekretaria/summary", { cache: "no-store" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Ngarkimi dështoi."); return; }
      setS(d); setError("");
    } catch { setError("Gabim rrjeti — provo përsëri."); }
  }, []);
  useEffect(() => { load(); }, [load]);

  const M = SEK_MODULES;
  const sc = s?.staffContracts;

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in">
      {/* ── Koka ── */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Sekretaria</h1>
          <p className="text-sm text-slate-500">Dokumentet, regjistrat dhe procedurat administrative{s?.yearLabel ? ` · Viti ${s.yearLabel}` : ""}</p>
        </div>
        <PersonSearch />
      </div>

      <QuickActions />

      {error && <p className="text-sm text-red-500">{error}</p>}
      {!s && !error && <p className="text-sm text-slate-400">Duke ngarkuar...</p>}

      {s && sc && (
        <div className="grid gap-5 lg:grid-cols-[1fr_320px] items-start">
          <div className="space-y-5 min-w-0">
            <section>
              <GroupTitle>Dokumentet</GroupTitle>
              <div className="grid gap-4 md:grid-cols-2">
                <ModuleCard
                  mod={M.kontratatNxenesve}
                  stats={[{ label: "Gjithsej", value: s.studentContracts.total }, { label: "Nënshkruar", value: s.studentContracts.signed }, { label: "Pa nënshkruar", value: s.studentContracts.pending }]}
                  bar={{ label: "Nxënës me kontratë", value: s.studentContracts.total, total: s.studentContracts.activeStudents }}
                  warning={s.studentContracts.pending > 0 ? { tone: "orange", text: `${s.studentContracts.pending} kontrata presin nënshkrimin e prindit`, href: "/sekretaria/kontratat-nxenesve?kontrata=pending" } : null}
                  action={{ label: "+ Kontratë e re", href: M.kontratatNxenesve.href }}
                />
                <ModuleCard
                  mod={M.kontratatMesimdhenesve}
                  stats={[{ label: "Aktive", value: sc.active }, { label: "Skadojnë së shpejti", value: sc.expiringSoon }, { label: "Të skaduara", value: sc.expired }]}
                  warning={sc.expired > 0
                    ? { tone: "red", text: `${sc.expired} kontrata kanë skaduar`, href: "/sekretaria/stafi?kontrata=expired" }
                    : sc.expiringSoon > 0 ? { tone: "orange", text: `${sc.expiringSoon} kontrata skadojnë brenda ${sc.thresholdDays} ditëve`, href: "/sekretaria/stafi?kontrata=expiring" } : null}
                  note={sc.withoutEndDate > 0 ? `${sc.withoutEndDate} kontrata pa datë mbarimi — plotësoje te Stafi` : null}
                  action={{ label: "+ Kontratë e re", href: M.kontratatMesimdhenesve.href }}
                />
                <ModuleCard
                  mod={M.vertetime}
                  stats={[{ label: "Këtë muaj", value: s.certificates.thisMonth }, { label: "Këtë vit", value: s.certificates.thisYear }, { label: "Shabllone", value: s.certificates.templates }]}
                  action={{ label: "+ Gjenero vërtetim", href: M.vertetime.href }}
                />
                <ModuleCard
                  mod={M.fletkalimet}
                  stats={[{ label: "Sot", value: s.transfers.today }, { label: "Këtë javë", value: s.transfers.thisWeek }, { label: "Këtë vit", value: s.transfers.thisYear }]}
                  action={{ label: "+ Lësho fletëkalim", href: M.fletkalimet.href }}
                />
              </div>
            </section>

            <section>
              <GroupTitle>Regjistrat</GroupTitle>
              <div className="grid gap-4 md:grid-cols-2">
                <ModuleCard
                  mod={M.libriAme}
                  stats={[{ label: "Të regjistruar", value: s.libriAme.registered }, { label: "Pa numër amze", value: s.libriAme.noAmza }, { label: "Me të dhëna që mungojnë", value: s.libriAme.incomplete }]}
                  warning={s.libriAme.incomplete > 0 ? { tone: "orange", text: `${s.libriAme.incomplete} nxënës me të dhëna që mungojnë`, href: "/sekretaria/libri-ame?filter=incomplete" } : null}
                  note={`Të detyrueshme: ${s.libriAme.requiredFields.join(", ").toLowerCase()}`}
                  action={{ label: "Printo regjistrin", href: M.libriAme.href }}
                />
                <ModuleCard
                  mod={M.stafi}
                  stats={[{ label: "Gjithsej", value: s.staff.total }, { label: "Mësimdhënës", value: s.staff.teachers }, { label: "Asistentë", value: s.staff.assistants }]}
                  note={s.staff.others > 0 ? `+ ${s.staff.others} menaxhment dhe staf tjetër` : null}
                  action={{ label: "+ Shto staf", href: "/sekretaria/stafi?new=1" }}
                />
              </div>
            </section>

            <section>
              <GroupTitle>Fundi i vitit</GroupTitle>
              <YearClosingCard yc={s.yearClosing} canWrite={s.permissions.canWrite} canClasses={s.permissions.classes} onChanged={load} />
            </section>
          </div>

          <aside className="space-y-4">
            <TodayPanel summary={s} />
            <RecentDocuments docs={s.recentDocuments} canArkiva={s.permissions.arkiva} />
          </aside>
        </div>
      )}
    </div>
  );
}
