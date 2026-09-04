"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Send, Loader2, Clock, CheckCircle, XCircle, Package, Plus, X, Folder,
  ChevronDown, Search, Paperclip, Sparkles, RotateCcw, ArrowLeft, ArrowRight, History,
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { UNITS, COLORS, PRIORITIES, REQUEST_STATUS_MAP } from "@/lib/materialConstants";

/* ─── Types ───────────────────────────────────────────────── */
interface Material {
  id: number; name: string; defaultUnit: string; needsColor: boolean;
  category: { id: number; name: string };
}
interface MaterialCategoryOpt { id: number; name: string }
interface SubjectOpt { id: number; name: string }
interface ClassOpt { id: number; name: string }

interface RequestItemRow {
  isCustom: boolean;
  materialId: number | null;
  material: { id: number; name: string; needsColor: boolean } | null;
  customItemName: string | null;
  customDescription: string | null;
  customCategory: { id: number; name: string } | null;
  productLink: string | null;
  attachmentPath: string | null;
  quantity: number;
  unit: string;
  color: string | null;
  itemReason: string | null;
  status: "PENDING" | "APPROVED" | "REJECTED";
  approvedQuantity: number | null;
  approvalNote: string | null;
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
  REJECTED: <XCircle className="w-3.5 h-3.5" />,
};
const PENDING_STATUSES = new Set(["SUBMITTED", "UNDER_REVIEW"]);

/* ─── Rreshti bosh i formës (jo ende dërguar) ────────────────── */
interface FormItem {
  key: string;
  isCustom: boolean;
  materialId: number | null;
  materialName: string;
  needsColor: boolean;
  searchQuery: string;
  showSuggestions: boolean;
  customItemName: string;
  customDescription: string;
  customCategoryId: string;
  productLink: string;
  attachmentPath: string | null;
  attachmentName: string | null;
  uploading: boolean;
  quantity: string;
  unit: string;
  color: string;
  itemReason: string;
}

let keySeq = 0;
function emptyItem(): FormItem {
  keySeq++;
  return {
    key: `item-${keySeq}`,
    isCustom: false, materialId: null, materialName: "", needsColor: false,
    searchQuery: "", showSuggestions: false,
    customItemName: "", customDescription: "", customCategoryId: "", productLink: "",
    attachmentPath: null, attachmentName: null, uploading: false,
    quantity: "1", unit: "copë", color: "", itemReason: "",
  };
}

export default function TeacherRequestsClient() {
  const [requests, setRequests] = useState<MaterialRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [materials, setMaterials] = useState<Material[]>([]);
  const [categories, setCategories] = useState<MaterialCategoryOpt[]>([]);
  const [subjects, setSubjects] = useState<SubjectOpt[]>([]);
  const [classes, setClasses] = useState<ClassOpt[]>([]);

  const [step, setStep] = useState<"form" | "confirm">("form");
  const [items, setItems] = useState<FormItem[]>([emptyItem()]);
  const [subjectId, setSubjectId] = useState("");
  const [classId, setClassId] = useState("");
  const [priority, setPriority] = useState("NORMAL");
  const [dateNeeded, setDateNeeded] = useState("");
  const [reason, setReason] = useState("");
  const [comment, setComment] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [openDates, setOpenDates] = useState<Set<string>>(new Set());
  const [historyStatusFilter, setHistoryStatusFilter] = useState("");
  const [historySubjectFilter, setHistorySubjectFilter] = useState("");
  const [timelineId, setTimelineId] = useState<number | null>(null);
  const [timeline, setTimeline] = useState<StatusHistoryEntry[] | null>(null);
  const [loadingTimeline, setLoadingTimeline] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [reqRes, matRes, catRes, subRes, clsRes] = await Promise.all([
      fetch("/api/material-requests"),
      fetch("/api/materials"),
      fetch("/api/material-categories"),
      fetch("/api/subjects"),
      fetch("/api/classes"),
    ]);
    if (reqRes.ok) {
      const data: MaterialRequestRow[] = await reqRes.json();
      setRequests(data);
      if (data.length) setOpenDates(new Set([formatDate(data[0].createdAt)]));
    }
    if (matRes.ok) setMaterials(await matRes.json());
    if (catRes.ok) setCategories(await catRes.json());
    if (subRes.ok) setSubjects(await subRes.json());
    if (clsRes.ok) setClasses(await clsRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  function toggleDate(date: string) {
    setOpenDates(prev => {
      const next = new Set(prev);
      next.has(date) ? next.delete(date) : next.add(date);
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

  /* ─── Materialet e përdorura më shpesh nga ky mësimdhënës ──── */
  const frequentMaterials = useMemo(() => {
    const counts = new Map<number, { material: { id: number; name: string; needsColor: boolean }; count: number }>();
    for (const r of requests) {
      for (const it of r.items) {
        if (it.isCustom || !it.material) continue;
        const cur = counts.get(it.material.id);
        counts.set(it.material.id, { material: it.material, count: (cur?.count ?? 0) + 1 });
      }
    }
    return [...counts.values()].sort((a, b) => b.count - a.count).slice(0, 6);
  }, [requests]);

  const filteredRequests = useMemo(() => {
    return requests.filter(r => {
      if (historyStatusFilter && r.status !== historyStatusFilter) return false;
      if (historySubjectFilter && String(r.subject?.id ?? "") !== historySubjectFilter) return false;
      return true;
    });
  }, [requests, historyStatusFilter, historySubjectFilter]);

  /* ─── Item helpers ───────────────────────────────────────── */
  function updateItem(key: string, patch: Partial<FormItem>) {
    setItems(list => list.map(it => it.key === key ? { ...it, ...patch } : it));
  }
  function addItem() {
    setItems(list => [...list, emptyItem()]);
  }
  function addCustomItem() {
    const it = emptyItem();
    it.isCustom = true;
    setItems(list => [...list, it]);
  }
  function removeItem(key: string) {
    setItems(list => list.length > 1 ? list.filter(it => it.key !== key) : list);
  }
  function addFrequentMaterial(m: { id: number; name: string; needsColor: boolean }) {
    const it = emptyItem();
    it.materialId = m.id;
    it.materialName = m.name;
    it.needsColor = m.needsColor;
    it.searchQuery = m.name;
    setItems(list => {
      const firstEmpty = list.find(r => !r.isCustom && !r.materialId && !r.customItemName);
      if (firstEmpty) return list.map(r => r.key === firstEmpty.key ? it : r);
      return [...list, it];
    });
  }

  function selectMaterial(key: string, m: Material) {
    updateItem(key, {
      materialId: m.id, materialName: m.name, needsColor: m.needsColor,
      unit: m.defaultUnit, searchQuery: m.name, showSuggestions: false,
    });
  }

  async function handleAttachment(key: string, file: File) {
    updateItem(key, { uploading: true });
    const form = new FormData();
    form.append("file", file);
    const res = await fetch("/api/material-requests/upload", { method: "POST", body: form });
    const d = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(d.error || "Ngarkimi i skedarit dështoi");
      updateItem(key, { uploading: false });
      return;
    }
    updateItem(key, { uploading: false, attachmentPath: d.path, attachmentName: d.originalName });
  }

  function repeatRequest(r: MaterialRequestRow) {
    const newItems: FormItem[] = r.items.map(it => {
      const row = emptyItem();
      row.isCustom = it.isCustom;
      if (it.isCustom) {
        row.customItemName = it.customItemName || "";
        row.customDescription = it.customDescription || "";
        row.customCategoryId = it.customCategory ? String(it.customCategory.id) : "";
        row.productLink = it.productLink || "";
      } else if (it.material) {
        row.materialId = it.material.id;
        row.materialName = it.material.name;
        row.searchQuery = it.material.name;
        row.needsColor = it.material.needsColor;
      }
      row.quantity = String(it.quantity);
      row.unit = it.unit;
      row.color = it.color || "";
      row.itemReason = it.itemReason || "";
      return row;
    });
    setItems(newItems.length ? newItems : [emptyItem()]);
    setSubjectId(r.subject ? String(r.subject.id) : "");
    setClassId(r.class ? String(r.class.id) : "");
    setPriority(r.priority || "NORMAL");
    setReason(r.reason);
    setComment(r.comment || "");
    setError("");
    setOk(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setItems([emptyItem()]);
    setSubjectId(""); setClassId(""); setPriority("NORMAL"); setDateNeeded("");
    setReason(""); setComment("");
  }

  function validItems() {
    return items.filter(it => it.isCustom ? it.customItemName.trim() : it.materialId);
  }

  function goToConfirm(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const valid = validItems();
    if (!valid.length || !reason.trim()) {
      setError("Plotëso të paktën një artikull (nga katalogu ose i veçantë) dhe arsyen.");
      return;
    }
    setStep("confirm");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSubmit() {
    setSubmitting(true);
    setError("");
    const payload = {
      reason, comment: comment || undefined,
      priority, dateNeeded: dateNeeded || undefined,
      subjectId: subjectId || undefined, classId: classId || undefined,
      items: validItems().map(it => ({
        isCustom: it.isCustom,
        materialId: it.isCustom ? undefined : it.materialId,
        customItemName: it.isCustom ? it.customItemName : undefined,
        customDescription: it.isCustom ? it.customDescription || undefined : undefined,
        customCategoryId: it.isCustom ? it.customCategoryId || undefined : undefined,
        productLink: it.isCustom ? it.productLink || undefined : undefined,
        attachmentPath: it.attachmentPath || undefined,
        quantity: it.quantity, unit: it.unit,
        color: it.color || undefined, itemReason: it.itemReason || undefined,
      })),
    };
    const res = await fetch("/api/material-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSubmitting(false);

    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setError(d.error || "Diçka shkoi keq.");
      setStep("form");
      return;
    }

    resetForm();
    setStep("form");
    setOk(true);
    loadAll();
  }

  const subjectName = subjects.find(s => String(s.id) === subjectId)?.name;
  const className = classes.find(c => String(c.id) === classId)?.name;

  return (
    <div className="space-y-5">
      {/* ── Forma ── */}
      <div className="card p-5">
        <h2 className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <Package className="w-4 h-4 text-primary-500" />
          {step === "form" ? "Kërkesë e Re për Material" : "Konfirmo Kërkesën"}
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}
        {ok && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            Kërkesa u dërgua me sukses!
          </div>
        )}

        {step === "form" ? (
          <form onSubmit={goToConfirm} className="space-y-4">
            {frequentMaterials.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" /> Përdorur Shpesh
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {frequentMaterials.map(({ material }) => (
                    <button
                      key={material.id}
                      type="button"
                      onClick={() => addFrequentMaterial(material)}
                      className="text-xs px-2.5 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-primary-50 hover:text-primary-700 dark:hover:bg-primary-900/30 transition-colors"
                    >
                      + {material.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-3">
              {items.map((row, idx) => (
                <ItemRowEditor
                  key={row.key}
                  row={row}
                  index={idx}
                  materials={materials}
                  categories={categories}
                  canRemove={items.length > 1}
                  fileInputRef={el => { fileInputRefs.current[row.key] = el; }}
                  onUpdate={patch => updateItem(row.key, patch)}
                  onSelectMaterial={m => selectMaterial(row.key, m)}
                  onToggleCustom={() => updateItem(row.key, {
                    isCustom: !row.isCustom, materialId: null, materialName: "", searchQuery: "", needsColor: false,
                  })}
                  onAttach={file => handleAttachment(row.key, file)}
                  onRemoveAttachment={() => updateItem(row.key, { attachmentPath: null, attachmentName: null })}
                  onRemove={() => removeItem(row.key)}
                />
              ))}
            </div>

            <div className="flex flex-wrap gap-4">
              <button type="button" onClick={addItem} className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium">
                <Plus className="w-4 h-4" /> Shto Artikull
              </button>
              <button type="button" onClick={addCustomItem} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 font-medium">
                <Plus className="w-4 h-4" /> Artikull i Veçantë (s&apos;është në listë)
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Lënda</label>
                <select value={subjectId} onChange={e => setSubjectId(e.target.value)} className="form-input">
                  <option value="">— Zgjidh —</option>
                  {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Klasa</label>
                <select value={classId} onChange={e => setClassId(e.target.value)} className="form-input">
                  <option value="">— Zgjidh —</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Prioriteti</label>
                <select value={priority} onChange={e => setPriority(e.target.value)} className="form-input">
                  {PRIORITIES.map(p => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
              <div>
                <label className="form-label">Nevojitet deri më</label>
                <input type="date" value={dateNeeded} onChange={e => setDateNeeded(e.target.value)} className="form-input" />
              </div>
            </div>

            <div>
              <label className="form-label">Arsyeja *</label>
              <textarea
                value={reason}
                onChange={e => setReason(e.target.value)}
                className="form-input"
                rows={3}
                placeholder="Përse nevojiten këto materiale?"
                required
              />
            </div>

            <div>
              <label className="form-label">Koment shtesë (opsionale)</label>
              <input value={comment} onChange={e => setComment(e.target.value)} className="form-input" placeholder="Diçka tjetër që duhet ta dijë menaxhmenti?" />
            </div>

            <button type="submit" className="btn-primary w-full sm:w-auto">
              <ArrowRight className="w-4 h-4" />
              Vazhdo te Përmbledhja
            </button>
          </form>
        ) : (
          <div className="space-y-4">
            <div className="space-y-2">
              {validItems().map((it, idx) => (
                <div key={idx} className="flex items-start justify-between gap-3 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                  <div>
                    <p className="font-medium text-slate-800 dark:text-white text-sm">
                      {it.isCustom ? it.customItemName : it.materialName}
                      {it.isCustom && <span className="ml-1.5 text-xs text-amber-600 dark:text-amber-400 font-normal">(artikull i veçantë)</span>}
                    </p>
                    {it.itemReason && <p className="text-xs text-slate-400 mt-0.5">{it.itemReason}</p>}
                    {it.attachmentName && <p className="text-xs text-slate-400 mt-0.5 flex items-center gap-1"><Paperclip className="w-3 h-3" /> {it.attachmentName}</p>}
                  </div>
                  <span className="text-sm text-slate-500 shrink-0">
                    × {it.quantity} {it.unit}{it.color ? ` · ${it.color}` : ""}
                  </span>
                </div>
              ))}
            </div>

            <div className="text-sm text-slate-500 space-y-1">
              {subjectName && <p><span className="font-medium text-slate-700 dark:text-slate-300">Lënda:</span> {subjectName}</p>}
              {className && <p><span className="font-medium text-slate-700 dark:text-slate-300">Klasa:</span> {className}</p>}
              {priority !== "NORMAL" && <p><span className="font-medium text-slate-700 dark:text-slate-300">Prioriteti:</span> {PRIORITIES.find(p => p.value === priority)?.label}</p>}
              {dateNeeded && <p><span className="font-medium text-slate-700 dark:text-slate-300">Nevojitet deri më:</span> {dateNeeded}</p>}
              <p><span className="font-medium text-slate-700 dark:text-slate-300">Arsyeja:</span> {reason}</p>
              {comment && <p><span className="font-medium text-slate-700 dark:text-slate-300">Koment:</span> {comment}</p>}
            </div>

            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setStep("form")} disabled={submitting} className="btn-secondary">
                <ArrowLeft className="w-4 h-4" /> Prapa
              </button>
              <button type="button" onClick={handleSubmit} disabled={submitting} className="btn-primary flex-1 sm:flex-none">
                {submitting ? <><Loader2 className="w-4 h-4 animate-spin" />Duke dërguar...</> : <><Send className="w-4 h-4" />Dërgo Kërkesën</>}
              </button>
            </div>
          </div>
        )}
      </div>

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
                                {(r.subject || r.class) && (
                                  <p className="text-xs text-slate-400 mt-0.5">{r.subject?.name || r.class?.name}</p>
                                )}
                                <p className="text-sm text-slate-500 mt-1.5">{r.reason}</p>
                              </div>
                              <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${st.color}`}>
                                {STATUS_ICON[r.status]}
                                {st.label}
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

/* ═══════════════════════════════════════════════════════════ */
/*  Një rresht artikulli në formë (katalog ose i veçantë)      */
/* ═══════════════════════════════════════════════════════════ */
function ItemRowEditor({
  row, index, materials, categories, canRemove, fileInputRef,
  onUpdate, onSelectMaterial, onToggleCustom, onAttach, onRemoveAttachment, onRemove,
}: {
  row: FormItem;
  index: number;
  materials: Material[];
  categories: MaterialCategoryOpt[];
  canRemove: boolean;
  fileInputRef: (el: HTMLInputElement | null) => void;
  onUpdate: (patch: Partial<FormItem>) => void;
  onSelectMaterial: (m: Material) => void;
  onToggleCustom: () => void;
  onAttach: (file: File) => void;
  onRemoveAttachment: () => void;
  onRemove: () => void;
}) {
  const suggestions = useMemo(() => {
    if (row.isCustom || !row.searchQuery || row.searchQuery.length < 2) return [];
    const q = row.searchQuery.toLowerCase();
    return materials.filter(m => m.name.toLowerCase().includes(q)).slice(0, 8);
  }, [row.isCustom, row.searchQuery, materials]);

  return (
    <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <span className="text-xs font-semibold text-slate-400 pt-2">#{index + 1}</span>
        <div className="flex-1 space-y-2.5">
          {!row.isCustom ? (
            <div className="relative">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={row.searchQuery}
                  onChange={e => onUpdate({ searchQuery: e.target.value, showSuggestions: true, materialId: null, materialName: "" })}
                  onFocus={() => row.searchQuery.length >= 2 && onUpdate({ showSuggestions: true })}
                  onBlur={() => setTimeout(() => onUpdate({ showSuggestions: false }), 150)}
                  className="form-input pl-9"
                  placeholder="Kërko material nga katalogu..."
                />
              </div>
              {row.showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                  {suggestions.map(m => (
                    <button key={m.id} type="button" onClick={() => onSelectMaterial(m)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between gap-2">
                      <span>{m.name}</span>
                      <span className="text-xs text-slate-400">{m.category.name}</span>
                    </button>
                  ))}
                </div>
              )}
              {row.materialId && (
                <p className="text-xs text-green-600 dark:text-green-400 mt-1 flex items-center gap-1">
                  <CheckCircle className="w-3 h-3" /> Zgjedhur nga katalogu
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-2 p-2.5 bg-amber-50/50 dark:bg-amber-900/10 rounded-lg">
              <input
                value={row.customItemName}
                onChange={e => onUpdate({ customItemName: e.target.value })}
                className="form-input"
                placeholder="Emri i artikullit *"
              />
              <input
                value={row.customDescription}
                onChange={e => onUpdate({ customDescription: e.target.value })}
                className="form-input"
                placeholder="Përshkrim (opsionale)"
              />
              <div className="grid grid-cols-2 gap-2">
                <select value={row.customCategoryId} onChange={e => onUpdate({ customCategoryId: e.target.value })} className="form-input">
                  <option value="">Kategoria (opsionale)</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <input
                  value={row.productLink}
                  onChange={e => onUpdate({ productLink: e.target.value })}
                  className="form-input"
                  placeholder="Lidhje produkti (opsionale)"
                />
              </div>
              {row.attachmentName ? (
                <div className="flex items-center gap-2 text-xs text-slate-500">
                  <Paperclip className="w-3.5 h-3.5" />
                  <span className="truncate">{row.attachmentName}</span>
                  <button type="button" onClick={onRemoveAttachment} className="text-red-500 hover:text-red-600"><X className="w-3.5 h-3.5" /></button>
                </div>
              ) : (
                <label className="flex items-center gap-1.5 text-xs text-primary-600 hover:text-primary-700 cursor-pointer w-fit">
                  {row.uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Paperclip className="w-3.5 h-3.5" />}
                  Bashkëngjit foto/PDF (opsionale)
                  <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) onAttach(f); }} disabled={row.uploading} />
                </label>
              )}
            </div>
          )}

          <div className="grid grid-cols-3 gap-2">
            <div>
              <input type="number" min={1} value={row.quantity} onChange={e => onUpdate({ quantity: e.target.value })} className="form-input" placeholder="Sasia" />
            </div>
            <div>
              <select value={row.unit} onChange={e => onUpdate({ unit: e.target.value })} className="form-input">
                {UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}
              </select>
            </div>
            {row.needsColor ? (
              <div>
                <select value={row.color} onChange={e => onUpdate({ color: e.target.value })} className="form-input">
                  <option value="">Ngjyra...</option>
                  {COLORS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            ) : <div />}
          </div>

          <input
            value={row.itemReason}
            onChange={e => onUpdate({ itemReason: e.target.value })}
            className="form-input text-sm"
            placeholder="Shënim vetëm për këtë artikull (opsionale)"
          />

          <button type="button" onClick={onToggleCustom} className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
            {row.isCustom ? "← Zgjidh nga katalogu në vend të kësaj" : "S'e gjej në listë → shto si artikull të veçantë"}
          </button>
        </div>
        {canRemove && (
          <button type="button" onClick={onRemove} className="p-2 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20" title="Hiq këtë artikull">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
