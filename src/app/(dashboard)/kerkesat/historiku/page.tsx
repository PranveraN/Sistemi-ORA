"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Header from "@/components/layout/Header";
import { formatDate, formatDateTime } from "@/lib/utils";
import { exportMaterialRequestsExcel, type ExportableRequest } from "@/lib/materialRequestExport";
import { PRIORITY_MAP, REQUEST_STATUS_MAP, ITEM_STATUS_MAP } from "@/lib/materialConstants";
import {
  Package, Download, Search, ChevronDown, History, Truck, CheckCircle2,
} from "lucide-react";

interface RequestItemRow {
  id: number;
  isCustom: boolean;
  material: { id: number; name: string } | null;
  customItemName: string | null;
  quantity: number;
  approvedQuantity: number | null;
  unit: string;
  color: string | null;
  status: string;
  orderLinks?: { quantityContributed: number; orderItem: { order: { orderNumber: string; status: string } } }[];
}

interface MaterialRequestRow extends Omit<ExportableRequest, "items"> {
  id: number;
  teacherId: number;
  priority: string | null;
  items: RequestItemRow[];
}

interface StatusHistoryEntry {
  id: number; fromStatus: string | null; toStatus: string; note: string | null; createdAt: string;
  changedBy: { name: string };
}

interface RequestDetail extends MaterialRequestRow {
  statusHistory: StatusHistoryEntry[];
}

interface SubjectOpt { id: number; name: string }
interface ClassOpt { id: number; name: string }

export default function KerkesatHistorikuPage() {
  const [requests, setRequests] = useState<MaterialRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<SubjectOpt[]>([]);
  const [classes, setClasses] = useState<ClassOpt[]>([]);

  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [teacherId, setTeacherId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [search, setSearch] = useState("");

  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [reqRes, subRes, clsRes] = await Promise.all([
      fetch("/api/material-requests"),
      fetch("/api/subjects"),
      fetch("/api/classes"),
    ]);
    if (reqRes.ok) setRequests(await reqRes.json());
    if (subRes.ok) setSubjects(await subRes.json());
    if (clsRes.ok) setClasses(await clsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const teachers = useMemo(() => {
    const map = new Map<number, string>();
    for (const r of requests) map.set(r.teacherId, r.teacher.name);
    return [...map.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name, "sq"));
  }, [requests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter(r => {
      if (dateFrom && r.createdAt < dateFrom) return false;
      if (dateTo && r.createdAt.slice(0, 10) > dateTo) return false;
      if (teacherId && String(r.teacherId) !== teacherId) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      if (priorityFilter && r.priority !== priorityFilter) return false;
      if (subjectFilter && String(r.subject?.id ?? "") !== subjectFilter) return false;
      if (classFilter && String(r.class?.id ?? "") !== classFilter) return false;
      if (q) {
        const haystack = [r.teacher.name, r.reason, ...r.items.map(it => it.isCustom ? it.customItemName : it.material?.name)]
          .filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [requests, dateFrom, dateTo, teacherId, statusFilter, priorityFilter, subjectFilter, classFilter, search]);

  async function toggleExpand(id: number) {
    if (expandedId === id) { setExpandedId(null); setDetail(null); return; }
    setExpandedId(id);
    setLoadingDetail(true);
    const res = await fetch(`/api/material-requests/${id}`);
    setDetail(res.ok ? await res.json() : null);
    setLoadingDetail(false);
  }

  return (
    <>
      <Header title="Historiku i Kërkesave" backHref="/kerkesat" />
      <div className="p-6 max-w-5xl mx-auto space-y-5 animate-fade-in">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm text-slate-500">{filtered.length} nga {requests.length} kërkesa gjithsej</p>
          <button
            onClick={() => exportMaterialRequestsExcel(filtered, "Historiku-Kerkesave")}
            disabled={!filtered.length}
            className="btn-secondary text-sm"
          >
            <Download className="w-4 h-4" />
            Eksporto Excel
          </button>
        </div>

        <div className="card p-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
          <div className="relative col-span-2 sm:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} className="form-input pl-9" placeholder="Kërko..." />
          </div>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="form-input" title="Nga data" />
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="form-input" title="Deri më" />
          <select value={teacherId} onChange={e => setTeacherId(e.target.value)} className="form-input">
            <option value="">Çdo mësimdhënëse</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-input">
            <option value="">Çdo status</option>
            {Object.entries(REQUEST_STATUS_MAP).map(([value, s]) => <option key={value} value={value}>{s.label}</option>)}
          </select>
          <select value={priorityFilter} onChange={e => setPriorityFilter(e.target.value)} className="form-input">
            <option value="">Çdo prioritet</option>
            {Object.entries(PRIORITY_MAP).map(([value, p]) => <option key={value} value={value}>{p.label}</option>)}
          </select>
          <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)} className="form-input">
            <option value="">Çdo lëndë</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={classFilter} onChange={e => setClassFilter(e.target.value)} className="form-input">
            <option value="">Çdo klasë</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-10">Duke ngarkuar...</p>
        ) : filtered.length === 0 ? (
          <div className="card p-10 text-center">
            <History className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Asnjë kërkesë s&apos;përputhet me filtrat.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {filtered.map(r => {
              const st = REQUEST_STATUS_MAP[r.status] ?? { label: r.status, color: "bg-slate-100 text-slate-600" };
              const isExpanded = expandedId === r.id;
              return (
                <div key={r.id} className="card overflow-hidden">
                  <button onClick={() => toggleExpand(r.id)} className="w-full flex items-center justify-between gap-3 p-4 text-left hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-slate-800 dark:text-white text-sm">
                          {r.items.map(it => it.isCustom ? it.customItemName : it.material?.name).join(", ")}
                        </span>
                        {r.priority && r.priority !== "NORMAL" && (
                          <span className={`text-xs px-1.5 py-0.5 rounded-full ${PRIORITY_MAP[r.priority]?.color ?? ""}`}>{PRIORITY_MAP[r.priority]?.label}</span>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">{r.teacher.name} · {formatDate(r.createdAt)}</p>
                    </div>
                    <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-semibold ${st.color}`}>{st.label}</span>
                    <ChevronDown className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                  </button>

                  {isExpanded && (
                    <div className="px-4 pb-4 border-t border-slate-100 dark:border-slate-700 pt-3 space-y-3">
                      {loadingDetail ? (
                        <p className="text-xs text-slate-400">Duke ngarkuar...</p>
                      ) : !detail ? (
                        <p className="text-xs text-red-500">Gabim në ngarkim.</p>
                      ) : (
                        <>
                          <div className="space-y-1.5">
                            {detail.items.map(it => {
                              const orderLink = it.orderLinks?.[0];
                              return (
                                <div key={it.id} className="flex items-center justify-between gap-2 text-sm p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                                  <span className="text-slate-700 dark:text-slate-200">
                                    {it.isCustom ? it.customItemName : it.material?.name}
                                    {it.color && <span className="text-purple-600 dark:text-purple-400"> ({it.color})</span>}
                                    <span className="text-slate-400 text-xs ml-1.5">× {it.quantity} {it.unit}</span>
                                  </span>
                                  <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-xs px-1.5 py-0.5 rounded-full ${ITEM_STATUS_MAP[it.status]?.color ?? ""}`}>{ITEM_STATUS_MAP[it.status]?.label ?? it.status}</span>
                                    {orderLink && (
                                      <span className="text-xs text-slate-400 flex items-center gap-1">
                                        {orderLink.orderItem.order.status === "RECEIVED" ? <CheckCircle2 className="w-3 h-3 text-green-500" /> : <Truck className="w-3 h-3" />}
                                        {orderLink.orderItem.order.orderNumber}
                                      </span>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>

                          <p className="text-sm text-slate-500">{detail.reason}</p>
                          {detail.comment && <p className="text-xs text-slate-400 italic">{detail.comment}</p>}

                          <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Historia e Statuseve</p>
                            <div className="space-y-1">
                              {detail.statusHistory.map(h => (
                                <div key={h.id} className="flex items-center justify-between text-xs text-slate-500">
                                  <span>
                                    {h.fromStatus ? `${REQUEST_STATUS_MAP[h.fromStatus]?.label ?? h.fromStatus} → ` : ""}
                                    <span className="font-medium text-slate-700 dark:text-slate-300">{REQUEST_STATUS_MAP[h.toStatus]?.label ?? h.toStatus}</span>
                                    {" "}— {h.changedBy.name}
                                    {h.note && <span className="italic"> ({h.note})</span>}
                                  </span>
                                  <span className="text-slate-400 shrink-0 ml-2">{formatDateTime(h.createdAt)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
