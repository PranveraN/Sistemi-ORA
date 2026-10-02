"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { formatDate } from "@/lib/utils";
import { Search, Download, Plus, ChevronLeft, ChevronRight, AlertTriangle, Copy, Check, ClipboardList, ArrowLeft } from "lucide-react";
import ApplicationDetailModal from "@/components/enrollment/admin/ApplicationDetailModal";
import ApplicationEvidencaModal from "@/components/enrollment/admin/ApplicationEvidencaModal";
import DecisionButtons, { EVIDENCA_BADGE, seatsInfo, type DecisionApp } from "@/components/enrollment/admin/DecisionButtons";
import { ApproveDialog, RejectDialog } from "@/components/enrollment/admin/DecisionDialogs";
import EnrollmentSidebar from "@/components/enrollment/admin/EnrollmentSidebar";
import EvidencaTab from "@/components/evidenca/EvidencaTab";
import { exportEnrollmentApplicationsExcel } from "@/lib/enrollmentApplicationExport";
import type { EvidencaState } from "@/lib/enrollmentRules";

type Tab = "PENDING" | "EVIDENCA" | "APPROVED" | "REJECTED" | "ALL";

interface Row {
  id: number; status: string; referenceNumber: string | null; schoolYear: string;
  firstName: string; lastName: string; birthDate: string | null; age: number | null;
  desiredGrade: number | null; class: { name: string } | null;
  primaryContact: string | null;
  motherName: string | null; motherPhone: string | null; fatherName: string | null; fatherPhone: string | null;
  guardianOtherName: string | null; guardianOtherPhone: string | null;
  submittedAt: string | null; createdAt: string; daysWaiting: number; overdue: boolean;
  evidencaState: EvidencaState; evidencaLegacy?: boolean; waitlisted: boolean; source: string | null;
  gradeSeats: { free: number; capacity: number } | null;
  duplicate: { duplicateOf: { id: number; referenceNumber: string | null } | null; existingStudent: { id: number; name: string; className: string | null } | null } | null;
  [k: string]: unknown;
}

interface ListResponse {
  rows: Row[]; total: number; page: number; limit: number;
  counts: Record<Tab, number>; newThisWeek: number;
  rules: { evidencaGrade1: boolean; evidencaOtherGrades: boolean; delayDays: number; enrollmentOpen: boolean };
  seats: { id: number; name: string; free: number; capacity: number; students: number }[];
  years: string[];
}

interface CustomFieldDef { id: number; label: string; type: string; active: boolean }

const TABS: { key: Tab; label: string }[] = [
  { key: "PENDING", label: "Për shqyrtim" },
  { key: "EVIDENCA", label: "Evidenca" },
  { key: "APPROVED", label: "Pranuar" },
  { key: "REJECTED", label: "Refuzuar" },
  { key: "ALL", label: "Të gjitha" },
];

const EMPTY: Record<Tab, string> = {
  PENDING: "S'ka aplikime që presin shqyrtim. Aplikimet e reja nga prindërit shfaqen këtu.",
  EVIDENCA: "Asnjë aplikim në evidencë. Klikoni \"Plotëso evidencën\" te një aplikim për ta nisur.",
  APPROVED: "Ende s'është pranuar asnjë aplikim me këto filtra.",
  REJECTED: "Asnjë aplikim i refuzuar me këto filtra.",
  ALL: "Asnjë aplikim me këto filtra.",
};

const LIMIT = 20;

function contactOf(r: Row) {
  if (r.primaryContact === "FATHER") return { name: r.fatherName, phone: r.fatherPhone };
  if (r.primaryContact === "OTHER") return { name: r.guardianOtherName, phone: r.guardianOtherPhone };
  return { name: r.motherName || r.fatherName, phone: r.motherPhone || r.fatherPhone };
}

function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

export default function RegjistrimetPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const { data: session } = useSession();
  const canEditRules = (session?.user as { role?: string } | undefined)?.role === "SUPERADMIN";

  const tabParam = (sp.get("tab") || "PENDING").toUpperCase();
  const showStudentEvidenca = tabParam === "EVIDENCAT_NXENESVE";
  const [tab, setTab] = useState<Tab>((TABS.some(t => t.key === tabParam) ? tabParam : "PENDING") as Tab);
  const [qInput, setQInput] = useState(sp.get("q") || "");
  const q = useDebounced(qInput);
  const [grade, setGrade] = useState(sp.get("grade") || "");
  const [year, setYear] = useState(sp.get("year") || "");
  const [sort, setSort] = useState(sp.get("sort") || "");
  const [page, setPage] = useState(parseInt(sp.get("page") || "1") || 1);

  const [data, setData] = useState<ListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [fieldDefs, setFieldDefs] = useState<CustomFieldDef[]>([]);
  const [openId, setOpenId] = useState<number | null>(null);
  const [panelReload, setPanelReload] = useState(0);
  const [approveFor, setApproveFor] = useState<Row | null>(null);
  const [rejectFor, setRejectFor] = useState<Row | null>(null);
  const [evidencaFor, setEvidencaFor] = useState<Row | null>(null);
  const [copied, setCopied] = useState(false);

  const effectiveSort = sort || (tab === "PENDING" || tab === "EVIDENCA" ? "old" : "new");

  const params = useMemo(() => {
    const p = new URLSearchParams({ tab, sort: effectiveSort });
    if (q.trim()) p.set("q", q.trim());
    if (grade) p.set("grade", grade);
    if (year) p.set("year", year);
    return p;
  }, [tab, effectiveSort, q, grade, year]);

  // Filtrat në URL
  useEffect(() => {
    if (showStudentEvidenca) return;
    const u = new URLSearchParams();
    if (tab !== "PENDING") u.set("tab", tab);
    if (q.trim()) u.set("q", q.trim());
    if (grade) u.set("grade", grade);
    if (year) u.set("year", year);
    if (sort) u.set("sort", sort);
    if (page > 1) u.set("page", String(page));
    const s = u.toString();
    router.replace(s ? `/regjistrimet?${s}` : "/regjistrimet", { scroll: false });
  }, [router, tab, q, grade, year, sort, page, showStudentEvidenca]);

  const load = useCallback(async () => {
    if (showStudentEvidenca) return;
    setError("");
    try {
      const p = new URLSearchParams(params);
      p.set("page", String(page));
      p.set("limit", String(LIMIT));
      const r = await fetch(`/api/enrollment/applications?${p}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Ngarkimi dështoi."); return; }
      setData(d);
    } catch { setError("Gabim rrjeti — provo përsëri."); }
    finally { setLoading(false); }
  }, [params, page, showStudentEvidenca]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { fetch("/api/enrollment-form-fields?includeInactive=1").then(r => r.ok ? r.json() : []).then(setFieldDefs).catch(() => {}); }, []);

  function refreshAll() { load(); setPanelReload(k => k + 1); }
  function changeTab(t: Tab) { setTab(t); setPage(1); setSort(""); }

  async function startEvidenca(r: Row) {
    try {
      const res = await fetch(`/api/enrollment/applications/${r.id}/evidenca`, {
        method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "START" }),
      });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Hapja e evidencës dështoi."); return; }
    } catch { alert("Gabim rrjeti — provo përsëri."); return; }
    setEvidencaFor(r);
    refreshAll();
  }

  async function exportExcel() {
    const p = new URLSearchParams(params);
    p.set("export", "1");
    const r = await fetch(`/api/enrollment/applications?${p}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { alert(d.error || "Eksporti dështoi."); return; }
    exportEnrollmentApplicationsExcel(d.rows, `Regjistrimet-${TABS.find(t => t.key === tab)?.label.replace(/\s+/g, "-") ?? tab}`, fieldDefs);
  }

  async function copyLink() {
    const url = `${window.location.origin}/apliko`;
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { prompt("Kopjo linkun:", url); }
  }

  const decisionOf = (r: Row): DecisionApp => ({ id: r.id, status: r.status, evidencaState: r.evidencaState, gradeSeats: r.gradeSeats });
  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const openRow = rows.find(r => r.id === openId) ?? null;

  if (showStudentEvidenca) {
    return (
      <>
        <Header title="Regjistrimet" />
        <div className="p-4 sm:p-6 space-y-4">
          <Link href="/regjistrimet" className="text-sm text-slate-500 hover:text-primary-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Kthehu te aplikimet</Link>
          <h2 className="section-title">Evidencat e nxënësve</h2>
          <EvidencaTab initialQuery={sp.get("q") ?? ""} />
        </div>
      </>
    );
  }

  const cards: { key: Tab; label: string; sub: string; tone: string }[] = [
    { key: "PENDING", label: "Për shqyrtim", sub: `${data?.newThisWeek ?? 0} të reja këtë javë`, tone: "text-orange-600" },
    { key: "EVIDENCA", label: "Evidenca", sub: "Në plotësim, para pranimit", tone: "text-primary-600" },
    { key: "APPROVED", label: "Pranuar", sub: year ? `Viti ${year}` : "Të gjitha vitet", tone: "text-green-600" },
    { key: "REJECTED", label: "Refuzuar", sub: year ? `Viti ${year}` : "Të gjitha vitet", tone: "text-red-600" },
  ];

  return (
    <>
      <Header title="Regjistrimet" />
      <div className="p-4 sm:p-6 space-y-4 animate-fade-in">
        {/* ── Koka ── */}
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2"><ClipboardList className="w-5 h-5 text-primary-500" /> Regjistrimet</h1>
            <p className="text-sm text-slate-400 mt-0.5">Aplikimet e dërguara nga prindërit përmes formularit publik të regjistrimit</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportExcel} disabled={!total} className="btn-secondary" title="Eksporton sipas filtrave aktivë"><Download className="w-4 h-4" /> Eksporto Excel</button>
            <a href="/apliko?burimi=zyre" target="_blank" rel="noopener noreferrer" className="btn-primary"><Plus className="w-4 h-4" /> Shto aplikim me dorë</a>
          </div>
        </div>

        {/* ── Kartat ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {cards.map(c => (
            <button key={c.key} type="button" onClick={() => changeTab(c.key)} aria-pressed={tab === c.key}
              className={`card p-3 sm:p-4 text-left border-2 transition-all ${tab === c.key ? "border-primary-500 ring-2 ring-primary-100 dark:ring-primary-900/40" : "border-transparent hover:border-slate-200 dark:hover:border-slate-600"}`}>
              <p className="text-xs font-medium text-slate-500">{c.label}</p>
              <p className={`text-2xl font-bold ${c.tone}`}>{data?.counts[c.key] ?? "—"}</p>
              <p className="text-[11px] text-slate-400">{c.sub}</p>
            </button>
          ))}
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
          <div className="card overflow-hidden min-w-0">
            {/* ── Tabat ── */}
            <div className="flex gap-1 px-3 pt-3 border-b border-slate-100 dark:border-slate-700 overflow-x-auto">
              {TABS.map(t => (
                <button key={t.key} onClick={() => changeTab(t.key)}
                  className={`px-3 py-2 text-sm font-medium whitespace-nowrap border-b-2 -mb-px ${tab === t.key ? "border-primary-600 text-primary-700 dark:text-primary-300" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                  {t.label} <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700">{data?.counts[t.key] ?? 0}</span>
                </button>
              ))}
            </div>
            {/* ── Filtrat ── */}
            <div className="flex flex-wrap gap-2 p-3">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input value={qInput} onChange={e => { setQInput(e.target.value); setPage(1); }} className="form-input pl-9 text-sm py-2" placeholder="Kërko fëmijën, prindin ose telefonin" />
              </div>
              <select value={grade} onChange={e => { setGrade(e.target.value); setPage(1); }} className="form-input w-auto text-sm py-2" aria-label="Klasa">
                <option value="">Klasa: të gjitha</option>
                {Array.from({ length: 9 }, (_, i) => i + 1).map(g => <option key={g} value={g}>Klasa {g}</option>)}
              </select>
              <select value={year} onChange={e => { setYear(e.target.value); setPage(1); }} className="form-input w-auto text-sm py-2" aria-label="Viti akademik">
                <option value="">Viti: të gjithë</option>
                {(data?.years ?? []).map(y => <option key={y} value={y}>Viti {y}</option>)}
              </select>
              <select value={effectiveSort} onChange={e => { setSort(e.target.value); setPage(1); }} className="form-input w-auto text-sm py-2" aria-label="Renditja">
                <option value="old">Më të vjetrat së pari</option>
                <option value="new">Më të rejat së pari</option>
              </select>
            </div>

            {/* ── Tabela ── */}
            <div className="overflow-x-auto">
              {loading ? (
                <p className="text-center text-slate-400 py-10 text-sm">Duke ngarkuar...</p>
              ) : error ? (
                <p className="text-center text-red-500 py-10 text-sm">{error}</p>
              ) : rows.length === 0 ? (
                <div className="text-center py-12 px-4 space-y-3">
                  <p className="text-sm text-slate-500">{EMPTY[tab]}</p>
                  {tab === "PENDING" && (
                    <button onClick={copyLink} className="btn-secondary text-sm">
                      {copied ? <><Check className="w-4 h-4" /> U kopjua</> : <><Copy className="w-4 h-4" /> Kopjo linkun e formularit publik</>}
                    </button>
                  )}
                </div>
              ) : (
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="table-header">Fëmija</th>
                      <th className="table-header">Klasa e kërkuar</th>
                      <th className="table-header">Prindi</th>
                      <th className="table-header">Aplikuar</th>
                      <th className="table-header">Evidenca</th>
                      <th className="table-header text-right">Vendimi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {rows.map(r => {
                      const c = contactOf(r);
                      const seat = r.gradeSeats ? seatsInfo(r.gradeSeats.free) : null;
                      const applied = r.submittedAt ?? r.createdAt;
                      const isOpen = r.status === "PENDING" || r.status === "EVIDENCA";
                      const full = !!r.gradeSeats && r.gradeSeats.free <= 0;
                      return (
                        <tr key={r.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 ${isOpen && full ? "bg-orange-50/40 dark:bg-orange-900/10" : ""}`}>
                          <td className="table-cell">
                            <button onClick={() => setOpenId(r.id)} className="font-semibold text-slate-900 dark:text-white hover:text-primary-600 text-left">{r.firstName} {r.lastName}</button>
                            <p className="text-xs text-slate-400">{r.birthDate ? `Lindur: ${formatDate(r.birthDate)}` : "Pa datëlindje"}{r.age != null ? ` · ${r.age} vjeç` : ""}</p>
                            <div className="flex flex-wrap gap-1 mt-0.5">
                              {r.duplicate?.duplicateOf && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 inline-flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" /> Aplikim i dyfishtë</span>}
                              {r.duplicate?.existingStudent && (
                                <Link href={`/students/${r.duplicate.existingStudent.id}`} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-400 inline-flex items-center gap-0.5 hover:underline">
                                  <AlertTriangle className="w-3 h-3" /> Tashmë nxënës
                                </Link>
                              )}
                              {r.source === "OFFICE" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Zyra</span>}
                              {r.status === "DRAFT" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Draft</span>}
                            </div>
                          </td>
                          <td className="table-cell">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                              {r.class?.name ?? (r.desiredGrade != null ? `Klasa ${r.desiredGrade}` : "—")}
                            </span>
                            {isOpen && seat && <p className={`text-xs mt-0.5 ${seat.className}`}>{seat.text}</p>}
                          </td>
                          <td className="table-cell">
                            <p className="text-sm">{c.name || "—"}</p>
                            {c.phone && <p className="text-xs text-slate-400">{c.phone}</p>}
                          </td>
                          <td className="table-cell">
                            <p className="text-sm">{formatDate(applied)}</p>
                            <p className={`text-xs ${r.overdue ? "text-red-600 font-semibold" : "text-slate-400"}`}>
                              {r.daysWaiting === 0 ? "sot" : `para ${r.daysWaiting} ${r.daysWaiting === 1 ? "dite" : "ditësh"}`}{r.overdue ? " · vonesë" : ""}
                            </p>
                          </td>
                          <td className="table-cell">
                            {r.evidencaLegacy ? <span className="text-slate-300">—</span> : (
                              <span className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${EVIDENCA_BADGE[r.evidencaState].className}`}>{EVIDENCA_BADGE[r.evidencaState].label}</span>
                            )}
                          </td>
                          <td className="table-cell">
                            <DecisionButtons app={decisionOf(r)} compact
                              onEvidenca={() => startEvidenca(r)}
                              onApprove={() => setApproveFor(r)}
                              onReject={() => setRejectFor(r)}
                              onView={() => setOpenId(r.id)} />
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
            {total > 0 && (
              <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
                <p className="text-sm text-slate-500">Duke shfaqur {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} nga {total}</p>
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} aria-label="Faqja e mëparshme" className="btn-secondary text-xs px-2 py-1 disabled:opacity-40"><ChevronLeft className="w-4 h-4" /> Para</button>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages} aria-label="Faqja tjetër" className="btn-secondary text-xs px-2 py-1 disabled:opacity-40">Pas <ChevronRight className="w-4 h-4" /></button>
                </div>
              </div>
            )}
          </div>

          {data && <EnrollmentSidebar seats={data.seats} rules={data.rules} canEditRules={canEditRules} onChanged={load} />}
        </div>
      </div>

      {openId !== null && (
        <ApplicationDetailModal id={openId} reloadKey={panelReload} onClose={() => setOpenId(null)} onChanged={refreshAll}
          decision={openRow ? decisionOf(openRow) : null}
          onApprove={() => openRow && setApproveFor(openRow)}
          onReject={() => openRow && setRejectFor(openRow)}
          onEvidenca={() => openRow && startEvidenca(openRow)} />
      )}
      {approveFor && <ApproveDialog app={approveFor} onClose={() => setApproveFor(null)} onDone={refreshAll} />}
      {rejectFor && <RejectDialog app={{ ...rejectFor, parentPhone: contactOf(rejectFor).phone }} onClose={() => setRejectFor(null)} onDone={refreshAll} />}
      {evidencaFor && (
        <ApplicationEvidencaModal applicationId={evidencaFor.id} applicantName={`${evidencaFor.firstName} ${evidencaFor.lastName}`}
          onSaved={refreshAll} onClose={() => { setEvidencaFor(null); refreshAll(); }} />
      )}
    </>
  );
}
