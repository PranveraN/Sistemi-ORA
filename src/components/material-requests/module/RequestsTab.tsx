"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ChevronRight, X } from "lucide-react";
import { stageOf } from "@/lib/materialConstants";
import { exportMaterialRequestsExcel } from "@/lib/materialRequestExport";
import { STATUS_UI, REQUEST_FLOW, hasLiveDeadline, type StatusKey } from "@/lib/materialStatusUi";
import { normalizeSearch } from "@/lib/utils";
import StatusBadge from "../StatusBadge";
import RequestDetail from "../admin/RequestDetail";
import OrderQueue from "../admin/OrderQueue";
import { compareRequests, daysUntil, itemName, requestSnippet, sentDate, OPEN_STATUSES } from "../admin/types";
import { Avatar, EmptyRow, ListPanel, ListRow, SplitLayout, fmtD } from "./ui";
import type { ModuleData } from "./types";

type Stage = StatusKey | "ALL";

/** Afati vetëm për kërkesat e hapura (jo Dorëzuar/Refuzuar). */
export function deadlineText(status: string, date: string | null): { text: string; cls: string } | null {
  if (!hasLiveDeadline(status)) return null;
  const d = daysUntil(date);
  if (d === null) return null;
  if (d < 0) return { text: "Afati kaloi", cls: "text-red-700 dark:text-red-400" };
  if (d === 0) return { text: "Nevojitet sot", cls: "text-orange-700 dark:text-orange-400" };
  return { text: `Nevojitet për ${d} ditë`, cls: d <= 3 ? "text-orange-700 dark:text-orange-400" : "text-slate-500 dark:text-slate-400" };
}

export default function RequestsTab({ data, selectedId }: { data: ModuleData; selectedId: number | null }) {
  const router = useRouter();
  const sp = useSearchParams();
  const { requests, pending, newItemsCount, leadDays, loading, reload, setExporter, canAct } = data;
  const stage = (sp.get("s") as Stage | null) ?? "ALL";
  const teacherFilter = sp.get("t");
  const [search, setSearch] = useState(sp.get("q") ?? "");

  const query = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    const qs = next.toString();
    return qs ? `?${qs}` : "";
  }, [sp]);
  const hrefFor = (id: number) => `/materialet/kerkesat/${id}${query({})}`;

  // Kërkimi → URL (me vonesë të vogël), që linket nga Analitika të funksionojnë
  useEffect(() => {
    if (search === (sp.get("q") ?? "")) return;
    const t = setTimeout(() => router.replace(`${window.location.pathname}${query({ q: search.trim() || null })}`, { scroll: false }), 250);
    return () => clearTimeout(t);
  }, [search, sp, router, query]);

  const filtered = useMemo(() => {
    const q = normalizeSearch(search.trim());
    return requests.filter(r => {
      if (teacherFilter && String(r.teacherId) !== teacherFilter) return false;
      if (!q) return true;
      const hay = [r.teacher.name, r.class?.name, r.subject?.name, r.reason, r.originalText, ...r.items.map(itemName)].filter(Boolean).join(" ");
      return normalizeSearch(hay).includes(q);
    });
  }, [requests, search, teacherFilter]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: filtered.length };
    for (const r of filtered) { const k = stageOf(r.status); c[k] = (c[k] ?? 0) + 1; }
    return c;
  }, [filtered]);

  const visible = useMemo(() => filtered.filter(r => stage === "ALL" || stageOf(r.status) === stage).sort(compareRequests), [filtered, stage]);
  const selected = requests.find(r => r.id === selectedId) ?? (selectedId ? null : visible[0] ?? null);

  // Hapja e qëllimshme (me ID në URL) e një kërkese "Në pritje" e kalon në "Në shqyrtim"
  const autoReviewed = useRef(new Set<number>());
  useEffect(() => {
    if (!selectedId || !selected || !canAct || selected.status !== "SUBMITTED" || autoReviewed.current.has(selected.id)) return;
    autoReviewed.current.add(selected.id);
    fetch(`/api/material-requests/${selected.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "UNDER_REVIEW" }),
    }).then(res => { if (res.ok) reload(); }).catch(() => {});
  }, [selectedId, selected, canAct, reload]);

  useEffect(() => {
    setExporter(() => exportMaterialRequestsExcel(visible, "Kerkesat-Materiale"));
    return () => setExporter(null);
  }, [visible, setExporter]);

  // Afatet — vetëm kërkesat e hapura; të dorëzuarat s'llogariten
  const open = requests.filter(r => OPEN_STATUSES.has(r.status));
  const dueSoon = open.filter(r => { const d = daysUntil(r.dateNeeded); return d !== null && d >= 0 && d <= leadDays; }).length;
  const overdue = open.filter(r => { const d = daysUntil(r.dateNeeded); return d !== null && d < 0; }).length;
  const teacherName = teacherFilter ? requests.find(r => String(r.teacherId) === teacherFilter)?.teacher.name : null;

  const stageCard = (key: Stage) => {
    const active = stage === key;
    const ui = key === "ALL" ? null : STATUS_UI[key];
    return (
      <button key={key} type="button" aria-pressed={active}
        onClick={() => router.replace(`${window.location.pathname}${query({ s: key === "ALL" ? null : key })}`, { scroll: false })}
        className={`flex-1 min-w-[108px] text-left rounded-[14px] px-3.5 py-3 border transition-colors ${
          key === "ALL"
            ? active ? "bg-slate-900 border-slate-900 text-white dark:bg-white dark:text-slate-900" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white"
            : active ? "bg-violet-50 dark:bg-violet-950/30 border-violet-400 dark:border-violet-700" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 hover:border-slate-300"}`}>
        <span className={`flex items-center gap-1.5 text-[12.5px] font-bold ${key === "ALL" ? "" : "text-slate-600 dark:text-slate-300"}`}>
          {ui && <span className={`w-2 h-2 rounded-full ${ui.dot}`} aria-hidden />}{ui ? ui.label : "Të gjitha"}
        </span>
        <span className="block text-[22px] font-extrabold leading-tight">{counts[key] ?? 0}</span>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* Statuset si rrugë: Në pritje → … → Dorëzuar | Refuzuar · Të gjitha */}
      <div className="flex flex-wrap items-stretch gap-2" role="group" aria-label="Filtro sipas statusit">
        {REQUEST_FLOW.map((k, i) => (
          <Fragment key={k}>
            {stageCard(k)}
            {i < REQUEST_FLOW.length - 1 && <ChevronRight className="hidden md:block self-center w-4 h-4 text-slate-400 shrink-0" aria-hidden />}
          </Fragment>
        ))}
        <span className="hidden md:block w-px self-stretch bg-slate-300 dark:bg-slate-600 mx-1.5" aria-hidden />
        {stageCard("REJECTED")}
        {stageCard("ALL")}
      </div>

      {teacherName && (
        <p className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-2">
          Po shfaqen kërkesat e <b>{teacherName}</b>
          <button type="button" onClick={() => router.replace(`/materialet/kerkesat${query({ t: null })}`, { scroll: false })}
            className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-900 dark:hover:text-white"><X className="w-3.5 h-3.5" /> Hiq filtrin</button>
        </p>
      )}

      <SplitLayout
        list={
          <ListPanel search={search} onSearch={setSearch} label="Kërko kërkesat" placeholder="Kërko mësues, artikull ose klasë…">
            {loading ? <EmptyRow text="Duke ngarkuar…" />
              : visible.length === 0 ? <EmptyRow text="Asnjë kërkesë me këtë status." />
              : visible.map(r => {
                const dl = deadlineText(r.status, r.dateNeeded);
                return (
                  <ListRow key={r.id} href={hrefFor(r.id)} active={selected?.id === r.id}>
                    <div className="flex gap-3">
                      <Avatar name={r.teacher.name} />
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex justify-between gap-2">
                          <b className="text-sm text-slate-900 dark:text-white truncate">{r.teacher.name}</b>
                          <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{fmtD(sentDate(r))}</span>
                        </div>
                        <p className="text-[13px] text-slate-600 dark:text-slate-300 truncate">{requestSnippet(r)}</p>
                        <div className="flex flex-wrap items-center gap-1.5">
                          {r.class?.name && <span className="text-[11.5px] font-bold px-[7px] py-px rounded-[5px] bg-violet-100 text-violet-900 dark:bg-violet-950/60 dark:text-violet-200">{r.class.name}</span>}
                          <StatusBadge status={r.status} />
                          {r.priority === "URGENT" && hasLiveDeadline(r.status) && <span className="text-[11px] font-bold text-red-700 dark:text-red-400">Urgjente</span>}
                          {dl && <span className={`text-[11.5px] font-semibold ${dl.cls}`}>{dl.text}</span>}
                        </div>
                      </div>
                    </div>
                  </ListRow>
                );
              })}
          </ListPanel>
        }
        detail={
          selected
            ? <RequestDetail key={selected.id} request={selected} leadDays={leadDays} canAct={canAct} onUpdated={reload}
                onDeleted={() => { router.replace(`/materialet/kerkesat${query({})}`, { scroll: false }); reload(); }} />
            : <div className="card p-10 text-center text-sm text-slate-500">{loading ? "Duke ngarkuar…" : "Asnjë kërkesë me këtë status."}</div>
        }
        aside={
          <OrderQueue pending={pending} newItemsCount={newItemsCount} dueSoon={dueSoon} overdue={overdue} leadDays={leadDays} canAct={canAct} onOrdered={reload} />
        }
      />
    </div>
  );
}
