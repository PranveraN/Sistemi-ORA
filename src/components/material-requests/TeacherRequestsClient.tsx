"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Clock, CheckCircle, XCircle, Folder, ChevronDown, RotateCcw, History, Truck, PackageCheck,
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { REQUEST_STATUS_MAP, isPartialRequest } from "@/lib/materialConstants";
import TeacherRequestForm from "./TeacherRequestForm";

// Portali i mësuesve: forma e re (tekst i lirë me përputhje në katalog ose
// zgjedhje nga katalogu — TeacherRequestForm) dhe "Kërkesat e mia" me statuset.

/* ─── Types ───────────────────────────────────────────────── */
interface SubjectOpt { id: number; name: string }
interface ClassOpt { id: number; name: string }

interface RequestItemRow {
  isCustom: boolean;
  materialId: number | null;
  material: { id: number; name: string; needsColor: boolean } | null;
  customItemName: string | null;
  quantity: number;
  unit: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approvedQuantity: number | null;
  deliveredQuantity?: number;
}

interface StatusHistoryEntry {
  id: number; fromStatus: string | null; toStatus: string; note: string | null; createdAt: string;
  changedBy: { name: string };
}

interface MaterialRequestRow {
  id: number;
  reason: string;
  comment: string | null;
  priority: string | null;
  status: string;
  reviewNote: string | null;
  createdAt: string;
  classScope: string | null;
  reviewedBy: { name: string } | null;
  subject: SubjectOpt | null;
  class: ClassOpt | null;
  items: RequestItemRow[];
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  SUBMITTED: <Clock className="w-3.5 h-3.5" />,
  UNDER_REVIEW: <Clock className="w-3.5 h-3.5" />,
  APPROVED: <CheckCircle className="w-3.5 h-3.5" />,
  PARTIALLY_APPROVED: <CheckCircle className="w-3.5 h-3.5" />,
  ORDERED: <Truck className="w-3.5 h-3.5" />,
  DELIVERED: <PackageCheck className="w-3.5 h-3.5" />,
  REJECTED: <XCircle className="w-3.5 h-3.5" />,
};
const PENDING_STATUSES = new Set(["SUBMITTED", "UNDER_REVIEW"]);

export default function TeacherRequestsClient() {
  const [requests, setRequests] = useState<MaterialRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<SubjectOpt[]>([]);
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [prefillText, setPrefillText] = useState<string | null>(null);

  const [openDates, setOpenDates] = useState<Set<string>>(new Set());
  const [historyStatusFilter, setHistoryStatusFilter] = useState("");
  const [historySubjectFilter, setHistorySubjectFilter] = useState("");
  const [timelineId, setTimelineId] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<StatusHistoryEntry[] | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [reqRes, subRes, clsRes] = await Promise.all([
      fetch("/api/material-requests"),
      fetch("/api/subjects"),
      fetch("/api/classes"),
    ]);
    if (reqRes.ok) {
      const data: MaterialRequestRow[] = await reqRes.json();
      setRequests(data);
      if (data.length) setOpenDates(new Set([formatDate(data[0].createdAt)]));
    }
    if (subRes.ok) setSubjects(await subRes.json());
    if (clsRes.ok) setClasses(await clsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  function toggleDate(date: string) {
    setOpenDates(prev => {
      const next = new Set(prev);
      if (next.has(date)) next.delete(date); else next.add(date);
      return next;
    });
  }

  async function toggleTimeline(id: number) {
    if (timelineId === id) { setTimelineId(null); setTimeline(null); return; }
    setTimelineId(id);
    setLoadingTimeline(true);
    const res = await fetch(`/api/material-requests/${id}`);
    const d = await res.json().catch(() => null);
    setTimeline(res.ok && d ? d.statusHistory : []);
    setLoadingTimeline(false);
  }

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      if (historyStatusFilter && r.status !== historyStatusFilter) return false;
      if (historySubjectFilter && String(r.subject?.id ?? "") !== historySubjectFilter) return false;
      return true;
    });
  }, [requests, historyStatusFilter, historySubjectFilter]);

  /** "Përsërit" — mbush formën e re me kërkesën e mëparshme si tekst. */
  function repeatRequest(r: MaterialRequestRow) {
    const parts = r.items.map(it => `${it.quantity} ${(it.isCustom ? it.customItemName : it.material?.name) ?? ""}`.trim());
    setPrefillText(parts.join(", ") + (r.class ? ` për klasën ${r.class.name}` : ""));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  return (
    <div className="space-y-5">
      {/* ── Forma e re: tekst i lirë me përputhje në katalog / zgjedhje nga katalogu ── */}
      <TeacherRequestForm classes={classes} subjects={subjects} onSubmitted={loadAll} prefillText={prefillText} />

      {/* ── Historia ── */}
      <div className="card p-5">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
          <h2 className="font-semibold text-slate-800 dark:text-white">Kërkesat e Mia</h2>
          {requests.length > 0 && (
            <div className="flex items-center gap-2 flex-wrap">
              <select value={historyStatusFilter} onChange={e => setHistoryStatusFilter(e.target.value)} className="form-input text-xs py-1.5">
                <option value="">Çdo status</option>
                {Object.entries(REQUEST_STATUS_MAP).map(([value, s]) => <option key={value} value={value}>{s.label}</option>)}
              </select>
              <select value={historySubjectFilter} onChange={e => setHistorySubjectFilter(e.target.value)} className="form-input text-xs py-1.5">
                <option value="">Çdo lëndë</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
          )}
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-6">Duke ngarkuar...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Ende s&apos;ke bërë asnjë kërkesë.</p>
        ) : filteredRequests.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Asnjë kërkesë s&apos;përputhet me filtrat.</p>
        ) : (
          <div className="space-y-2">
            {Object.entries(
              filteredRequests.reduce<Record<string, MaterialRequestRow[]>>((groups, r) => {
                const date = formatDate(r.createdAt);
                (groups[date] ??= []).push(r);
                return groups;
              }, {})
            ).map(([date, dayRequests]) => {
              const isOpen = openDates.has(date);
              const pendingCount = dayRequests.filter(r => PENDING_STATUSES.has(r.status)).length;
              return (
                <div key={date} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <button
                    type="button"
                    onClick={() => toggleDate(date)}
                    className="w-full flex items-center justify-between gap-3 px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                  >
                    <div className="flex items-center gap-2.5">
                      <Folder className="w-4 h-4 text-primary-500" />
                      <span className="font-medium text-sm text-slate-800 dark:text-white">{date}</span>
                      <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-full">
                        {dayRequests.length} {dayRequests.length === 1 ? "kërkesë" : "kërkesa"}
                      </span>
                      {pendingCount > 0 && (
                        <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">{pendingCount} në pritje</span>
                      )}
                    </div>
                    <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isOpen ? "rotate-180" : ""}`} />
                  </button>

                  {isOpen && (
                    <div className="px-4 pb-4 space-y-3 border-t border-slate-100 dark:border-slate-700 pt-3">
                      {dayRequests.map(r => {
                        const st = REQUEST_STATUS_MAP[r.status] ?? { label: r.status, color: "bg-slate-100 text-slate-600" };
                        return (
                          <div key={r.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="space-y-0.5">
                                  {r.items.map((it, i) => (
                                    <p key={i} className="font-medium text-slate-800 dark:text-white text-sm">
                                      {it.isCustom ? it.customItemName : it.material?.name}
                                      <span className="text-slate-400 text-sm font-normal"> × {it.quantity} {it.unit}</span>
                                      {!PENDING_STATUSES.has(r.status) && it.status === "APPROVED" && it.approvedQuantity !== it.quantity && (
                                        <span className="text-teal-600 dark:text-teal-400 text-xs font-normal"> (aprovuar {it.approvedQuantity})</span>
                                      )}
                                      {!PENDING_STATUSES.has(r.status) && it.status === "REJECTED" && (
                                        <span className="text-red-500 text-xs font-normal"> (refuzuar)</span>
                                      )}
                                    </p>
                                  ))}
                                </div>
                                {(r.subject || r.class || r.classScope === "SELF" || r.classScope === "MULTI") && (
                                  <p className="text-xs text-slate-400 mt-0.5">{[r.class?.name ?? (r.classScope === "SELF" ? "Për mua" : r.classScope === "MULTI" ? "Disa klasa" : null), r.subject?.name].filter(Boolean).join(" · ")}</p>
                                )}
                                <p className="text-sm text-slate-500 mt-1.5">{r.reason}</p>
                              </div>
                              <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${st.color}`}>
                                {STATUS_ICON[r.status]}
                                {st.label}
                                {(r.status === "ORDERED" || r.status === "DELIVERED") && isPartialRequest(r.status, r.items) && <span className="font-normal">· pjesërisht</span>}
                              </span>
                            </div>
                            {!PENDING_STATUSES.has(r.status) && r.reviewNote && (
                              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500">
                                <span className="font-medium">Shënim nga menaxhmenti:</span> {r.reviewNote}
                              </div>
                            )}
                            <div className="flex items-center gap-4 mt-3">
                              <button
                                type="button"
                                onClick={() => repeatRequest(r)}
                                className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 font-medium"
                              >
                                <RotateCcw className="w-3.5 h-3.5" /> Përsërit këtë kërkesë
                              </button>
                              <button
                                type="button"
                                onClick={() => toggleTimeline(r.id)}
                                className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 font-medium"
                              >
                                <History className="w-3.5 h-3.5" /> {timelineId === r.id ? "Fsheh historinë" : "Shiko historinë"}
                              </button>
                            </div>

                            {timelineId === r.id && (
                              <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 space-y-1">
                                {loadingTimeline ? (
                                  <p className="text-xs text-slate-400">Duke ngarkuar...</p>
                                ) : !timeline || timeline.length === 0 ? (
                                  <p className="text-xs text-slate-400">Ende s&apos;ka histori.</p>
                                ) : (
                                  timeline.map(h => (
                                    <div key={h.id} className="flex items-center justify-between text-xs text-slate-500">
                                      <span>
                                        {h.fromStatus ? `${REQUEST_STATUS_MAP[h.fromStatus]?.label ?? h.fromStatus} → ` : ""}
                                        <span className="font-medium text-slate-700 dark:text-slate-300">{REQUEST_STATUS_MAP[h.toStatus]?.label ?? h.toStatus}</span>
                                        {" "}— {h.changedBy.name}
                                        {h.note && <span className="italic"> ({h.note})</span>}
                                      </span>
                                      <span className="text-slate-400 shrink-0 ml-2">{formatDateTime(h.createdAt)}</span>
                                    </div>
                                  ))
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
