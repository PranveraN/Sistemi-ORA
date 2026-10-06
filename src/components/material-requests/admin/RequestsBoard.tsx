"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { ListFilter, Download, ChevronDown, AlertTriangle, CheckCircle2, X, ArrowLeft } from "lucide-react";
import { PRIORITY_MAP, REQUEST_STAGES, stageOf } from "@/lib/materialConstants";
import { parseLeadDays } from "@/lib/materialConfig";
import { exportMaterialRequestsExcel } from "@/lib/materialRequestExport";
import MaterialsViewSwitch from "./MaterialsViewSwitch";
import RequestList from "./RequestList";
import RequestDetail from "./RequestDetail";
import OrderQueue from "./OrderQueue";
import {
  type MaterialRequestRow, type PendingItem, compareRequests, daysUntil, isShortNotice, itemName, sentDate, OPEN_STATUSES, UNDECIDED,
} from "./types";

interface Opt { id: number; name: string }

export default function RequestsBoard() {
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const canAct = role === "SUPERADMIN" || role === "FINANCE"; // Admini: vetëm lexim

  const [requests, setRequests] = useState<MaterialRequestRow[]>([]);
  const [pending, setPending] = useState<PendingItem[]>([]);
  const [newItemsCount, setNewItemsCount] = useState(0);
  const [subjects, setSubjects] = useState<Opt[]>([]);
  const [classes, setClasses] = useState<Opt[]>([]);
  const [leadDays, setLeadDays] = useState(3);
  const [loading, setLoading] = useState(true);
  const [showFilters, setShowFilters] = useState(false);

  // Gjendja në URL: kartë, kërkesa e zgjedhur, filtrat
  const stageParam = sp.get("s");
  const selectedId = parseInt(sp.get("id") || "") || null;
  const urgentOnly = sp.get("urgent") === "1";
  const f = {
    q: sp.get("q") ?? "", teacher: sp.get("t") ?? "", cls: sp.get("c") ?? "", subject: sp.get("sub") ?? "",
    priority: sp.get("p") ?? "", from: sp.get("from") ?? "", to: sp.get("to") ?? "",
  };
  const [search, setSearch] = useState(f.q);

  const setParams = useCallback((patch: Record<string, string | null>) => {
    const next = new URLSearchParams(sp.toString());
    for (const [k, v] of Object.entries(patch)) { if (v) next.set(k, v); else next.delete(k); }
    router.replace(`${pathname}?${next.toString()}`, { scroll: false });
  }, [sp, router, pathname]);

  const load = useCallback(async () => {
    const [reqRes, pendRes, newRes] = await Promise.all([
      fetch("/api/material-requests"),
      fetch("/api/material-orders/pending-items"),
      fetch("/api/materials?reviewStatus=pending"),
    ]);
    if (reqRes.ok) setRequests(await reqRes.json());
    if (pendRes.ok) setPending(await pendRes.json());
    if (newRes.ok) setNewItemsCount(((await newRes.json()) as unknown[]).length);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    Promise.all([fetch("/api/subjects"), fetch("/api/classes"), fetch("/api/settings")]).then(async ([s, c, st]) => {
      if (s.ok) setSubjects(await s.json());
      if (c.ok) setClasses(await c.json());
      if (st.ok) {
        const d = await st.json();
        setLeadDays(parseLeadDays(d.materialRequestLeadDays));
      }
    }).catch(() => {});
  }, []);

  // Kërkimi me vonesë të vogël → URL
  useEffect(() => {
    if (search === f.q) return;
    const t = setTimeout(() => setParams({ q: search.trim() || null }), 250);
    return () => clearTimeout(t);
  }, [search, f.q, setParams]);

  const teachers = useMemo(() => {
    const m = new Map<number, string>();
    for (const r of requests) m.set(r.teacherId, r.teacher.name);
    return [...m.entries()].map(([id, name]) => ({ id, name })).sort((a, b) => a.name.localeCompare(b.name));
  }, [requests]);

  // Filtrat (pa kartën) — numrat e kartave llogariten mbi këtë listë
  const filtered = useMemo(() => {
    const q = f.q.trim().toLowerCase();
    return requests.filter(r => {
      if (f.teacher && String(r.teacherId) !== f.teacher) return false;
      if (f.cls && String(r.class?.id ?? "") !== f.cls) return false;
      if (f.subject && String(r.subject?.id ?? "") !== f.subject) return false;
      if (f.priority && (r.priority ?? "NORMAL") !== f.priority) return false;
      const sent = sentDate(r).slice(0, 10);
      if (f.from && sent < f.from) return false;
      if (f.to && sent > f.to) return false;
      if (q) {
        const hay = [r.teacher.name, r.class?.name, r.subject?.name, r.originalText, r.reason, ...r.items.map(itemName)].filter(Boolean).join(" ").toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [requests, f.q, f.teacher, f.cls, f.subject, f.priority, f.from, f.to]);

  const counts = useMemo(() => {
    const c: Record<string, number> = { ALL: filtered.length };
    for (const s of REQUEST_STAGES) c[s.key] = 0;
    for (const r of filtered) c[stageOf(r.status)] = (c[stageOf(r.status)] ?? 0) + 1;
    return c;
  }, [filtered]);

  // Parazgjedhja: karta e parë sipas rrjedhës që ka kërkesa (që faqja të mos hapet bosh)
  const stage = stageParam ?? (urgentOnly ? "ALL" : REQUEST_STAGES.find(s => counts[s.key] > 0)?.key ?? "ALL");

  const visible = useMemo(() => {
    return filtered
      .filter(r => stage === "ALL" || stageOf(r.status) === stage)
      .filter(r => !urgentOnly || (r.priority === "URGENT" && UNDECIDED.has(r.status)))
      .sort(compareRequests);
  }, [filtered, stage, urgentOnly]);

  const urgentUndecided = requests.filter(r => r.priority === "URGENT" && UNDECIDED.has(r.status)).length;
  const thisMonth = requests.filter(r => sentDate(r).slice(0, 7) === new Date().toISOString().slice(0, 7)).length;
  const open = requests.filter(r => OPEN_STATUSES.has(r.status));
  const dueSoon = open.filter(r => { const d = daysUntil(r.dateNeeded); return d !== null && d >= 0 && d <= leadDays; }).length;
  const shortNotice = open.filter(r => isShortNotice(r, leadDays)).length;

  const selected = requests.find(r => r.id === selectedId) ?? null;

  // Hapja e një kërkese "Në pritje" nga administrata e kalon në "Në shqyrtim"
  const autoReviewed = useRef(new Set<number>());
  useEffect(() => {
    if (!selected || !canAct || selected.status !== "SUBMITTED" || autoReviewed.current.has(selected.id)) return;
    autoReviewed.current.add(selected.id);
    fetch(`/api/material-requests/${selected.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "UNDER_REVIEW" }),
    }).then(res => res.ok && setRequests(rs => rs.map(r => (r.id === selected.id ? { ...r, status: "UNDER_REVIEW" } : r)))).catch(() => {});
  }, [selected, canAct]);

  const activeFilterCount = [f.teacher, f.cls, f.subject, f.priority, f.from, f.to].filter(Boolean).length;

  const selectStage = (key: string) => setParams({ s: key, urgent: null });

  return (
    <div className="p-4 lg:p-6 space-y-4 animate-fade-in">
      {/* ── Koka: ndërprerësi i pamjeve, filtrat, eksporti ── */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <MaterialsViewSwitch />
        <div className="flex items-center gap-2">
          <button onClick={() => setShowFilters(v => !v)} aria-expanded={showFilters} className="btn-secondary text-sm">
            <ListFilter className="w-4 h-4" /> Filtra{activeFilterCount > 0 && <span className="ml-1 px-1.5 rounded-full bg-primary-600 text-white text-xs">{activeFilterCount}</span>}
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showFilters ? "rotate-180" : ""}`} />
          </button>
          <button onClick={() => exportMaterialRequestsExcel(visible, "Kerkesat-Materiale")} disabled={!visible.length} className="btn-secondary text-sm"
            title="Eksporton kërkesat sipas filtrave dhe kartës aktive">
            <Download className="w-4 h-4" /> Eksporto Excel
          </button>
        </div>
      </div>

      {showFilters && (
        <div className="card p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          <select value={f.teacher} onChange={e => setParams({ t: e.target.value || null })} className="form-input text-sm" aria-label="Mësuesi">
            <option value="">Çdo mësues</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
          </select>
          <select value={f.cls} onChange={e => setParams({ c: e.target.value || null })} className="form-input text-sm" aria-label="Klasa">
            <option value="">Çdo klasë</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <select value={f.subject} onChange={e => setParams({ sub: e.target.value || null })} className="form-input text-sm" aria-label="Lënda">
            <option value="">Çdo lëndë</option>
            {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <select value={f.priority} onChange={e => setParams({ p: e.target.value || null })} className="form-input text-sm" aria-label="Prioriteti">
            <option value="">Çdo prioritet</option>
            {Object.entries(PRIORITY_MAP).map(([v, p]) => <option key={v} value={v}>{p.label}</option>)}
          </select>
          <input type="date" value={f.from} onChange={e => setParams({ from: e.target.value || null })} className="form-input text-sm" aria-label="Nga data" title="Nga data" />
          <input type="date" value={f.to} onChange={e => setParams({ to: e.target.value || null })} className="form-input text-sm" aria-label="Deri më" title="Deri më" />
          {activeFilterCount > 0 && (
            <button onClick={() => setParams({ t: null, c: null, sub: null, p: null, from: null, to: null })} className="text-xs text-primary-600 hover:underline col-span-2 sm:col-span-1 text-left">
              Pastro filtrat
            </button>
          )}
        </div>
      )}

      {/* ── Kartat-taba sipas rrjedhës + kutia e urgjencës ── */}
      <div className="flex flex-wrap items-stretch gap-2">
        {[...REQUEST_STAGES.map(s => ({ key: s.key, label: s.label })), { key: "ALL", label: "Të gjitha" }].map(s => {
          const active = stage === s.key && !urgentOnly;
          return (
            <button key={s.key} onClick={() => selectStage(s.key)} aria-pressed={active}
              className={`min-w-[104px] flex-1 sm:flex-none text-left rounded-xl border-2 px-3 py-2 transition-colors ${
                active ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20" : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary-200"
              } ${s.key === "REJECTED" ? "sm:ml-2" : ""} ${s.key === "ALL" ? "sm:ml-2" : ""}`}>
              <p className={`text-xs ${active ? "text-primary-700 dark:text-primary-300" : "text-slate-500"}`}>{s.label}</p>
              <p className="text-xl font-bold text-slate-800 dark:text-white">{counts[s.key] ?? 0}</p>
            </button>
          );
        })}
        <div className="flex-1 min-w-[220px] flex flex-col justify-center gap-1 sm:ml-auto">
          {urgentUndecided > 0 ? (
            <button onClick={() => setParams({ urgent: urgentOnly ? null : "1", s: null })} aria-pressed={urgentOnly}
              className={`rounded-xl px-3 py-2 text-sm font-medium flex items-center gap-2 border-2 ${urgentOnly ? "border-red-500" : "border-transparent"} bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300`}>
              <AlertTriangle className="w-4 h-4" /> {urgentUndecided} {urgentUndecided === 1 ? "kërkesë urgjente" : "kërkesa urgjente"} pa vendim
            </button>
          ) : (
            <p className="rounded-xl px-3 py-2 text-sm font-medium flex items-center gap-2 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400">
              <CheckCircle2 className="w-4 h-4" /> Asnjë kërkesë urgjente pa vendim
            </p>
          )}
          <p className="text-xs text-slate-400 px-1">{thisMonth} kërkesa këtë muaj</p>
        </div>
      </div>

      {urgentOnly && (
        <p className="text-sm text-red-600 flex items-center gap-2">
          Po shfaqen vetëm kërkesat urgjente pa vendim.
          <button onClick={() => setParams({ urgent: null })} className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800" aria-label="Hiq filtrin e urgjencës"><X className="w-3.5 h-3.5" /> Hiq</button>
        </p>
      )}

      {/* ── Tri kolona: lista · detajet · veprimet ── */}
      <div className="grid gap-4 lg:grid-cols-[minmax(260px,320px)_1fr] xl:grid-cols-[minmax(240px,300px)_1fr_minmax(330px,400px)] items-start">
        <div className={selected ? "hidden lg:block" : ""}>
          <RequestList rows={visible} selectedId={selectedId} onSelect={id => setParams({ id: String(id) })} search={search} onSearch={setSearch} loading={loading} />
        </div>
        <div className={selected ? "" : "hidden lg:block"}>
          {selected ? (
            <>
              <button onClick={() => setParams({ id: null })} className="lg:hidden mb-2 text-sm text-slate-500 hover:text-primary-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Kthehu te lista</button>
              <RequestDetail
                request={selected} leadDays={leadDays} canAct={canAct}
                onUpdated={load}
                onDeleted={() => { setParams({ id: null }); load(); }}
              />
            </>
          ) : (
            <div className="card p-10 text-center text-sm text-slate-400">Zgjidh një kërkesë nga lista.</div>
          )}
        </div>
        <div className="lg:col-span-2 xl:col-span-1">
          <OrderQueue pending={pending} newItemsCount={newItemsCount} dueSoon={dueSoon} shortNotice={shortNotice} leadDays={leadDays} canAct={canAct} onOrdered={load} />
        </div>
      </div>
    </div>
  );
}
