"use client";

import { useCallback, useEffect, useState } from "react";
import {
  X, Loader2, Wallet, FileSignature, MessageSquare, ArrowRightLeft, Percent,
  PencilLine, UserPlus, UserMinus, History,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";

interface HistoryEvent {
  id: number;
  type: string;
  title: string;
  description: string | null;
  occurredAt: string;
  userName: string | null;
  source: string;
}
interface HistoryResponse {
  student: { id: number; name: string; className: string | null; status: string; parentName: string | null; parentPhone: string | null };
  events: HistoryEvent[];
  nextCursor: number | null;
}

const GROUPS: [string, string][] = [
  ["", "Të gjitha"], ["pagesat", "Pagesat"], ["kontrata", "Kontrata"],
  ["sms", "SMS"], ["ndryshime", "Ndryshime"], ["regjistrimi", "Regjistrimi"],
];

export const EVENT_META: Record<string, { label: string; icon: typeof Wallet; color: string }> = {
  PAGESE:              { label: "Pagesë",             icon: Wallet,          color: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" },
  KONTRATE:            { label: "Kontratë",           icon: FileSignature,   color: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400" },
  SMS:                 { label: "SMS",                icon: MessageSquare,   color: "bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300" },
  NDRYSHIM_KLASE:      { label: "Ndryshim klase",     icon: ArrowRightLeft,  color: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400" },
  ZBRITJE:             { label: "Zbritje",            icon: Percent,         color: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400" },
  NDRYSHIM_TE_DHENASH: { label: "Ndryshim të dhënash", icon: PencilLine,     color: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
  REGJISTRIM:          { label: "Regjistrim",         icon: UserPlus,        color: "bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300" },
  CREGJISTRIM:         { label: "Çregjistrim",        icon: UserMinus,       color: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400" },
};

// Paneli anësor i historikut të nxënësit — hapet nga e djathta (kolona
// "Historiku" te tabela e Nxënësve); mbyllet me X ose Esc.
export default function StudentHistoryPanel({ studentId, onClose }: { studentId: number; onClose: () => void }) {
  const [group, setGroup] = useState("");
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [events, setEvents] = useState<HistoryEvent[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async (cursor: number | null) => {
    const params = new URLSearchParams({ limit: "20" });
    if (group) params.set("group", group);
    if (cursor) params.set("cursor", String(cursor));
    const res = await fetch(`/api/students/${studentId}/history?${params}`);
    const d = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(d.error || "Ngarkimi i historikut dështoi.");
    return d as HistoryResponse;
  }, [studentId, group]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError("");
    load(null)
      .then(d => { if (!cancelled) { setData(d); setEvents(d.events); setNextCursor(d.nextCursor); } })
      .catch(e => { if (!cancelled) setError(e instanceof Error ? e.message : "Gabim"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [load]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    try {
      const d = await load(nextCursor);
      setEvents(prev => [...prev, ...d.events]);
      setNextCursor(d.nextCursor);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Gabim");
    } finally {
      setLoadingMore(false);
    }
  }

  const s = data?.student;

  return (
    <div className="fixed inset-0 z-50 flex justify-end" role="dialog" aria-modal="true" aria-label="Historiku i nxënësit">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-md h-full bg-white dark:bg-slate-900 shadow-2xl flex flex-col animate-slide-in-right">
        <div className="flex items-start justify-between gap-3 p-5 border-b border-slate-100 dark:border-slate-700">
          <div className="min-w-0">
            <p className="text-xs text-slate-400 flex items-center gap-1"><History className="w-3.5 h-3.5" /> Historiku</p>
            <h2 className="font-semibold text-slate-900 dark:text-white truncate">{s?.name ?? "…"}</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              {s?.className ? `Klasa ${s.className}` : "Pa klasë"}
              {s?.status === "INACTIVE" && <span className="ml-1.5 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">Joaktiv</span>}
            </p>
            {(s?.parentName || s?.parentPhone) && (
              <p className="text-xs text-slate-400 mt-0.5">{[s.parentName, s.parentPhone].filter(Boolean).join(" · ")}</p>
            )}
          </div>
          <button onClick={onClose} aria-label="Mbyll" title="Mbyll (Esc)"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex gap-1 p-3 border-b border-slate-100 dark:border-slate-700 overflow-x-auto">
          {GROUPS.map(([key, label]) => (
            <button key={key} onClick={() => setGroup(key)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
                group === key ? "bg-primary-600 text-white" : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              }`}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5">
          {loading ? (
            <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
          ) : error ? (
            <p className="text-sm text-red-500">{error}</p>
          ) : events.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-12">Asnjë ngjarje e regjistruar.</p>
          ) : (
            <ol className="relative border-l border-slate-200 dark:border-slate-700 ml-3 space-y-5">
              {events.map(e => {
                const meta = EVENT_META[e.type] ?? EVENT_META.NDRYSHIM_TE_DHENASH;
                const Icon = meta.icon;
                return (
                  <li key={e.id} className="ml-5">
                    <span className={`absolute -left-3 flex items-center justify-center w-6 h-6 rounded-full ring-4 ring-white dark:ring-slate-900 ${meta.color}`}>
                      <Icon className="w-3 h-3" />
                    </span>
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{e.title}</p>
                    {e.description && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 whitespace-pre-line line-clamp-4">{e.description}</p>
                    )}
                    <p className="text-[11px] text-slate-400 mt-1">
                      {formatDateTime(e.occurredAt)}
                      {e.userName ? ` · ${e.userName}` : e.source === "backfill" ? " · nga të dhënat ekzistuese" : ""}
                    </p>
                  </li>
                );
              })}
            </ol>
          )}
          {nextCursor && !loading && (
            <button onClick={loadMore} disabled={loadingMore} className="btn-secondary w-full justify-center mt-6 text-sm">
              {loadingMore ? <Loader2 className="w-4 h-4 animate-spin" /> : null} Shfaq më shumë
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
