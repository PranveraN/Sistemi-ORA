"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { formatDate } from "@/lib/utils";
import { exportMaterialRequestsExcel, type ExportableRequest } from "@/lib/materialRequestExport";
import { PRIORITY_MAP, REQUEST_STATUSES, REQUEST_STATUS_MAP } from "@/lib/materialConstants";
import {
  CheckCircle, XCircle, Clock, Package, Loader2, Send, Users, Download, X, Mail,
  ClipboardCheck, AlertTriangle, ListFilter, Search, ChevronDown, Truck, History, BarChart3,
} from "lucide-react";

interface RequestItemRow {
  id: number;
  isCustom: boolean;
  materialId: number | null;
  material: { id: number; name: string; needsColor: boolean } | null;
  customItemName: string | null;
  quantity: number;
  approvedQuantity: number | null;
  unit: string;
  color: string | null;
  itemReason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
}

interface MaterialRequestRow extends Omit<ExportableRequest, "items"> {
  id: number;
  priority: string | null;
  items: RequestItemRow[];
}

interface SubjectOpt { id: number; name: string }
interface ClassOpt { id: number; name: string }

// Vendim lokal (jo ende ruajtur) për një artikull, gjatë shqyrtimit të një
// kërkese — id-ja e artikullit → status + sasi e aprovuar.
type Decisions = Record<number, { status: "PENDING" | "APPROVED" | "REJECTED"; approvedQuantity: number }>;

export default function KerkesatPage() {
  const [requests, setRequests] = useState<MaterialRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [subjects, setSubjects] = useState<SubjectOpt[]>([]);
  const [classes, setClasses] = useState<ClassOpt[]>([]);

  const [statusFilter, setStatusFilter] = useState<"ALL" | string>("SUBMITTED");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [search, setSearch] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const [actingId, setActingId] = useState<number | null>(null);
  const [reviewingId, setReviewingId] = useState<number | null>(null);
  const [decisions, setDecisions] = useState<Decisions>({});
  const [reviewNote, setReviewNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [furnitoriOraEmail, setFurnitoriOraEmail] = useState("");
  const [sendError, setSendError] = useState<{ id: number; message: string } | null>(null);
  const [sendModal, setSendModal] = useState<{ id: number; email: string } | null>(null);
  const [sending, setSending] = useState(false);

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
  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(d => setFurnitoriOraEmail(d.furnitoriOraEmail || ""));
  }, []);

  /* ─── Statistika (llogaritur nga lista tashmë e ngarkuar) ──── */
  const stats = useMemo(() => {
    const thisMonth = new Date().toISOString().slice(0, 7);
    return {
      total: requests.length,
      pending: requests.filter(r => r.status === "SUBMITTED" || r.status === "UNDER_REVIEW").length,
      approved: requests.filter(r => r.status === "APPROVED" || r.status === "PARTIALLY_APPROVED").length,
      rejected: requests.filter(r => r.status === "REJECTED").length,
      urgent: requests.filter(r => r.priority === "URGENT" && (r.status === "SUBMITTED" || r.status === "UNDER_REVIEW")).length,
      thisMonth: requests.filter(r => r.createdAt.slice(0, 7) === thisMonth).length,
    };
  }, [requests]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return requests.filter(r => {
      if (statusFilter !== "ALL" && r.status !== statusFilter) return false;
      if (priorityFilter && r.priority !== priorityFilter) return false;
      if (subjectFilter && String(r.subject?.id ?? "") !== subjectFilter) return false;
      if (classFilter && String(r.class?.id ?? "") !== classFilter) return false;
      if (q) {
        const haystack = [
          r.teacher.name, r.reason,
          ...r.items.map(it => it.isCustom ? it.customItemName : it.material?.name),
        ].filter(Boolean).join(" ").toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [requests, statusFilter, priorityFilter, subjectFilter, classFilter, search]);

  function openSendModal(id: number) {
    setSendError(null);
    setSendModal({ id, email: furnitoriOraEmail || "" });
  }

  async function confirmSend() {
    if (!sendModal) return;
    const { id, email } = sendModal;
    const trimmed = email.trim();
    if (!trimmed) {
      setSendError({ id, message: "Shkruaj një email para se të dërgosh." });
      return;
    }

    setSending(true);
    setSendError(null);
    try {
      const res = await fetch(`/api/material-requests/${id}/send`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSendError({ id, message: d.error || `Dërgimi dështoi (gabim ${res.status})` });
        setSending(false);
        return;
      }
      setSending(false);
      setSendModal(null);
      load();
    } catch {
      setSending(false);
      setSendError({ id, message: "Gabim rrjeti — provo përsëri." });
    }
  }

  async function quickDecision(id: number, status: "APPROVED" | "REJECTED") {
    let note: string | null = null;
    if (status === "REJECTED") {
      note = window.prompt("Arsyeja e refuzimit (opsionale):") ?? "";
    }
    setActingId(id);
    await fetch(`/api/material-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status, reviewNote: note || undefined }),
    });
    setActingId(null);
    load();
  }

  async function markUnderReview(id: number) {
    setActingId(id);
    await fetch(`/api/material-requests/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "UNDER_REVIEW" }),
    });
    setActingId(null);
    load();
  }

  function openReview(r: MaterialRequestRow) {
    const initial: Decisions = {};
    for (const it of r.items) {
      initial[it.id] = { status: it.status === "PENDING" ? "APPROVED" : it.status, approvedQuantity: it.approvedQuantity ?? it.quantity };
    }
    setDecisions(initial);
    setReviewNote(r.reviewNote || "");
    setReviewingId(r.id);
  }

  function setDecision(itemId: number, patch: Partial<Decisions[number]>) {
    setDecisions(d => ({ ...d, [itemId]: { ...d[itemId], ...patch } }));
  }

  function setAllDecisions(status: "APPROVED" | "REJECTED") {
    setDecisions(d => {
      const next: Decisions = {};
      for (const id of Object.keys(d)) {
        const key = Number(id);
        next[key] = { ...d[key], status };
      }
      return next;
    });
  }

  async function saveReview() {
    if (!reviewingId) return;
    setSaving(true);
    const items = Object.entries(decisions).map(([id, dec]) => ({
      id: Number(id), status: dec.status, approvedQuantity: dec.approvedQuantity,
    }));
    await fetch(`/api/material-requests/${reviewingId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, reviewNote: reviewNote || undefined }),
    });
    setSaving(false);
    setReviewingId(null);
    load();
  }

  return (
    <>
      <Header title="Menaxho Kërkesat" />
      <div className="p-6 max-w-5xl mx-auto space-y-5 animate-fade-in">
        {/* ── Statistikat ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <StatCard icon={Package} label="Gjithsej" value={stats.total} />
          <StatCard icon={Clock} label="Në pritje" value={stats.pending} tone="amber" />
          <StatCard icon={CheckCircle} label="Aprovuar" value={stats.approved} tone="green" />
          <StatCard icon={XCircle} label="Refuzuar" value={stats.rejected} tone="red" />
          <StatCard icon={AlertTriangle} label="Urgjente (pa vendim)" value={stats.urgent} tone="red" />
          <StatCard icon={ClipboardCheck} label="Këtë muaj" value={stats.thisMonth} />
        </div>

        {/* ── Filtrat ── */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 flex-wrap">
            {([["SUBMITTED", "Në pritje"], ["UNDER_REVIEW", "Në shqyrtim"], ["APPROVED", "Aprovuara"], ["PARTIALLY_APPROVED", "Pjesërisht"], ["REJECTED", "Refuzuara"], ["ALL", "Të gjitha"]] as [string, string][]).map(([key, label]) => {
              const count = key === "ALL" ? requests.length : requests.filter(r => r.status === key).length;
              return (
                <button
                  key={key}
                  onClick={() => setStatusFilter(key)}
                  className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                    statusFilter === key
                      ? "bg-primary-600 text-white"
                      : "bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                  }`}
                >
                  {label}
                  {count > 0 && <span className="ml-1.5 bg-white/20 px-1.5 rounded-full text-xs">{count}</span>}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowFilters(v => !v)} className="btn-secondary text-sm">
              <ListFilter className="w-4 h-4" />
              Filtra
              <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} />
            </button>
            <Link href="/kerkesat/mesimdhenesit" className="btn-secondary text-sm">
              <Users className="w-4 h-4" />
              Mësimdhënësit
            </Link>
            <Link href="/materiale/porosite" className="btn-secondary text-sm">
              <Truck className="w-4 h-4" />
              Porositë
            </Link>
            <Link href="/kerkesat/historiku" className="btn-secondary text-sm">
              <History className="w-4 h-4" />
              Historiku
            </Link>
            <Link href="/kerkesat/analitika" className="btn-secondary text-sm">
              <BarChart3 className="w-4 h-4" />
              Analitika
            </Link>
            <button
              onClick={() => exportMaterialRequestsExcel(filtered, "Kerkesat-Materiale")}
              disabled={!filtered.length}
              className="btn-secondary text-sm"
            >
              <Download className="w-4 h-4" />
              Eksporto Excel
            </button>
          </div>
        </div>

        {showFilters && (
          <div className="card p-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
            <div className="relative col-span-2 sm:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={search} onChange={e => setSearch(e.target.value)} className="form-input pl-9" placeholder="Kërko artikull, arsye, mësimdhënëse..." />
            </div>
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
        )}

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-10">Duke ngarkuar...</p>
        ) : filtered.length === 0 ? (
          <div className="card p-10 text-center">
            <Package className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Asnjë kërkesë në këtë kategori.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(r => {
              const st = REQUEST_STATUS_MAP[r.status] ?? { label: r.status, color: "bg-slate-100 text-slate-600" };
              const isPending = r.status === "SUBMITTED" || r.status === "UNDER_REVIEW";
              const canSend = (r.status === "APPROVED" || r.status === "PARTIALLY_APPROVED") && r.items.some(it => it.status === "APPROVED");
              return (
                <div key={r.id} className="card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="space-y-1">
                        {r.items.map((it) => (
                          <div key={it.id} className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-slate-800 dark:text-white">
                              {it.isCustom ? it.customItemName : it.material?.name}
                            </p>
                            <span className="text-slate-400 text-sm">
                              × {it.quantity} {it.unit}
                              {it.approvedQuantity !== null && it.approvedQuantity !== it.quantity && (
                                <span className="text-teal-600 dark:text-teal-400"> (aprovuar {it.approvedQuantity})</span>
                              )}
                            </span>
                            {it.color && (
                              <span className="text-xs bg-purple-50 dark:bg-purple-900/20 text-purple-600 dark:text-purple-400 px-2 py-0.5 rounded-full">{it.color}</span>
                            )}
                            {!isPending && it.status !== "PENDING" && (
                              <span className={`text-xs px-1.5 py-0.5 rounded-full ${it.status === "APPROVED" ? "bg-green-50 text-green-600 dark:bg-green-900/20 dark:text-green-400" : "bg-red-50 text-red-600 dark:bg-red-900/20 dark:text-red-400"}`}>
                                {it.status === "APPROVED" ? "✓" : "✕"}
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap mt-1.5">
                        {(r.subject?.name || r.class?.name) && (
                          <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300 px-2 py-0.5 rounded-full">
                            {r.subject?.name || r.class?.name}
                          </span>
                        )}
                        {r.priority && r.priority !== "NORMAL" && (
                          <span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_MAP[r.priority]?.color ?? ""}`}>
                            {PRIORITY_MAP[r.priority]?.label ?? r.priority}
                          </span>
                        )}
                      </div>
                      <p className="text-sm text-slate-500 mt-1.5">{r.reason}</p>
                      {r.comment && <p className="text-xs text-slate-400 mt-1 italic">{r.comment}</p>}
                      <p className="text-xs text-slate-400 mt-2">
                        {r.teacher.name} · {formatDate(r.createdAt)}
                      </p>
                      {!isPending && (
                        <p className="text-xs text-slate-400 mt-1">
                          Shqyrtuar nga {r.reviewedBy?.name ?? "—"}
                          {r.reviewNote && <> — <span className="italic">{r.reviewNote}</span></>}
                        </p>
                      )}
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${st.color}`}>
                      {r.status === "REJECTED" ? <XCircle className="w-3.5 h-3.5" /> : r.status === "APPROVED" ? <CheckCircle className="w-3.5 h-3.5" /> : <Clock className="w-3.5 h-3.5" />}
                      {st.label}
                    </span>
                  </div>

                  {isPending && reviewingId !== r.id && (
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex-wrap">
                      {r.items.length > 1 ? (
                        <button onClick={() => openReview(r)} disabled={actingId === r.id} className="btn-primary text-sm">
                          <ClipboardCheck className="w-4 h-4" />
                          Shqyrto Artikujt
                        </button>
                      ) : (
                        <button onClick={() => quickDecision(r.id, "APPROVED")} disabled={actingId === r.id} className="btn-primary text-sm">
                          {actingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          Aprovo
                        </button>
                      )}
                      <button onClick={() => quickDecision(r.id, "REJECTED")} disabled={actingId === r.id} className="btn-secondary text-sm text-red-600">
                        <XCircle className="w-4 h-4" />
                        Refuzo të Gjitha
                      </button>
                      {r.status === "SUBMITTED" && (
                        <button onClick={() => markUnderReview(r.id)} disabled={actingId === r.id} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
                          Shëno si &quot;Në shqyrtim&quot;
                        </button>
                      )}
                    </div>
                  )}

                  {reviewingId === r.id && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Vendos për secilin artikull</p>
                        <div className="flex gap-2">
                          <button onClick={() => setAllDecisions("APPROVED")} className="text-xs text-primary-600 hover:text-primary-700 font-medium">Aprovo të gjitha</button>
                          <button onClick={() => setAllDecisions("REJECTED")} className="text-xs text-red-500 hover:text-red-600 font-medium">Refuzo të gjitha</button>
                        </div>
                      </div>
                      {r.items.map(it => {
                        const dec = decisions[it.id];
                        if (!dec) return null;
                        return (
                          <div key={it.id} className="flex items-center gap-2 flex-wrap p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                            <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 min-w-[140px]">
                              {it.isCustom ? it.customItemName : it.material?.name} <span className="text-slate-400">× {it.quantity} {it.unit}</span>
                            </span>
                            <div className="flex items-center gap-1 rounded-lg bg-white dark:bg-slate-700 p-0.5 border border-slate-200 dark:border-slate-600">
                              {(["APPROVED", "REJECTED"] as const).map(s => (
                                <button
                                  key={s}
                                  type="button"
                                  onClick={() => setDecision(it.id, { status: s })}
                                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                                    dec.status === s
                                      ? s === "APPROVED" ? "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400"
                                      : "text-slate-400 hover:text-slate-600"
                                  }`}
                                >
                                  {s === "APPROVED" ? "Aprovo" : "Refuzo"}
                                </button>
                              ))}
                            </div>
                            {dec.status === "APPROVED" && (
                              <input
                                type="number" min={1} max={it.quantity}
                                value={dec.approvedQuantity}
                                onChange={e => setDecision(it.id, { approvedQuantity: Math.min(it.quantity, Math.max(1, parseInt(e.target.value) || 1)) })}
                                className="form-input w-20 text-sm"
                                title={`Maksimumi ${it.quantity}`}
                              />
                            )}
                          </div>
                        );
                      })}
                      <input value={reviewNote} onChange={e => setReviewNote(e.target.value)} className="form-input text-sm" placeholder="Shënim për mësimdhënësen (opsionale)" />
                      <div className="flex items-center gap-2">
                        <button onClick={() => setReviewingId(null)} disabled={saving} className="btn-secondary text-sm">Anulo</button>
                        <button onClick={saveReview} disabled={saving} className="btn-primary text-sm">
                          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          Ruaj Vendimin
                        </button>
                      </div>
                    </div>
                  )}

                  {canSend && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                      {r.sentAt ? (
                        <span className="inline-flex items-center gap-1.5 text-sm text-green-600 font-medium">
                          <CheckCircle className="w-4 h-4" />
                          Dërguar te {r.sentToEmail}
                        </span>
                      ) : (
                        <button onClick={() => openSendModal(r.id)} className="btn-secondary text-sm">
                          <Send className="w-4 h-4" />
                          Dërgo te FurnitoriOra
                        </button>
                      )}
                      {sendError?.id === r.id && !sendModal && (
                        <p className="text-xs text-red-500 mt-2">{sendError.message}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {sendModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !sending && setSendModal(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Send className="w-4 h-4 text-primary-500" />
                Dërgo te FurnitoriOra
              </h3>
              <button onClick={() => !sending && setSendModal(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div>
                <label className="form-label">Email-i i marrësit</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email"
                    autoFocus
                    value={sendModal.email}
                    onChange={e => setSendModal(m => m && { ...m, email: e.target.value })}
                    onKeyDown={e => e.key === "Enter" && confirmSend()}
                    className="form-input pl-9"
                    placeholder="furnitori@example.com"
                  />
                </div>
              </div>
              {sendError?.id === sendModal.id && (
                <p className="text-sm text-red-500">{sendError.message}</p>
              )}
            </div>
            <div className="flex justify-end gap-2 p-5 pt-0">
              <button onClick={() => setSendModal(null)} disabled={sending} className="btn-secondary disabled:opacity-50">Anulo</button>
              <button onClick={confirmSend} disabled={sending} className="btn-primary disabled:opacity-50">
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                Dërgo
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function StatCard({ icon: Icon, label, value, tone }: { icon: React.ComponentType<{ className?: string }>; label: string; value: number; tone?: "amber" | "green" | "red" }) {
  const toneClass = tone === "amber" ? "text-amber-500" : tone === "green" ? "text-green-500" : tone === "red" ? "text-red-500" : "text-primary-500";
  return (
    <div className="card p-3.5">
      <div className="flex items-center gap-2 text-slate-400 text-xs mb-1">
        <Icon className={`w-3.5 h-3.5 ${toneClass}`} />
        {label}
      </div>
      <p className="text-xl font-bold text-slate-800 dark:text-white">{value}</p>
    </div>
  );
}
