"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import {
  GraduationCap, ArrowRight, ArrowLeft, Check, Loader2,
  AlertTriangle, Search, ShieldAlert,
} from "lucide-react";

interface SchoolYearRow { id: number; label: string; active: boolean }
interface ClassRow { id: number; name: string; level: string }

type Outcome = "PROMOTED" | "REPEATED" | "GRADUATED" | "LEFT";

interface PreviewStudent {
  studentId: number;
  firstName: string;
  lastName: string;
  currentClassId: number | null;
  currentClassName: string | null;
  currentClassLevel: string | null;
  discountPct: number;
  proposedOutcome: "PROMOTED" | "GRADUATED" | "MANUAL";
  proposedClassId: number | null;
  proposedClassName: string | null;
}

interface PreviewResponse {
  fromYear: { id: number; label: string } | null;
  toYear: { id: number; label: string };
  alreadyPromoted: boolean;
  summary: { total: number; promoted: number; graduated: number; manual: number };
  classMapping: { fromClassId: number | null; fromClassName: string | null; toClassId: number | null; toClassName: string | null; studentCount: number }[];
  students: PreviewStudent[];
}

interface DecisionState { outcome: Outcome; targetClassId: number | null; note?: string }

const OUTCOME_LABEL: Record<Outcome, string> = {
  PROMOTED: "Promovohet",
  REPEATED: "Përsërit",
  GRADUATED: "Diplomohet",
  LEFT: "Largohet",
};

export default function VitiShkollorPage() {
  const { data: session } = useSession();
  const isAdmin = (session?.user as { role?: string } | undefined)?.role === "ADMIN";

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [years, setYears] = useState<SchoolYearRow[]>([]);
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [toYearId, setToYearId] = useState<number | "">("");
  const [newYearLabel, setNewYearLabel] = useState("");
  const [creatingYear, setCreatingYear] = useState(false);
  const [loadingYears, setLoadingYears] = useState(true);

  const [preview, setPreview] = useState<PreviewResponse | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [decisions, setDecisions] = useState<Record<number, DecisionState>>({});
  const [search, setSearch] = useState("");

  const [confirmText, setConfirmText] = useState("");
  const [applying, setApplying] = useState(false);
  const [applyErr, setApplyErr] = useState<string | null>(null);
  const [applyResult, setApplyResult] = useState<{ promotionRunId: number; counts: Record<string, number> } | null>(null);

  const fetchYears = useCallback(async () => {
    setLoadingYears(true);
    const r = await fetch("/api/school-years");
    if (r.ok) setYears(await r.json());
    setLoadingYears(false);
  }, []);

  useEffect(() => { fetchYears(); }, [fetchYears]);
  useEffect(() => {
    fetch("/api/classes").then(r => r.json()).then(setClasses);
  }, []);

  const activeYear = years.find(y => y.active);
  const nonActiveYears = years.filter(y => !y.active);

  async function handleCreateYear(e: React.SyntheticEvent) {
    e.preventDefault();
    setCreatingYear(true);
    const r = await fetch("/api/school-years", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ label: newYearLabel.trim() }),
    });
    const data = await r.json();
    setCreatingYear(false);
    if (!r.ok) { alert(data.error || "Gabim"); return; }
    setNewYearLabel("");
    await fetchYears();
    setToYearId(data.id);
  }

  async function loadPreview() {
    if (!toYearId) return;
    setLoadingPreview(true);
    const r = await fetch(`/api/students/promote/preview?toYearId=${toYearId}`);
    const data: PreviewResponse = await r.json();
    setLoadingPreview(false);
    if (!r.ok) { alert((data as unknown as { error: string }).error || "Gabim"); return; }

    const initial: Record<number, DecisionState> = {};
    for (const s of data.students) {
      initial[s.studentId] = {
        outcome: s.proposedOutcome === "MANUAL" ? ("PROMOTED" as Outcome) : (s.proposedOutcome as Outcome),
        targetClassId: s.proposedOutcome === "MANUAL" ? null : s.proposedClassId,
      };
      if (s.proposedOutcome === "MANUAL") {
        // s'ka propozim — lëmë pa klasë derisa admini të zgjedhë vetë (numërohet si i papërfunduar më poshtë)
        initial[s.studentId].targetClassId = null;
      }
    }
    setDecisions(initial);
    setPreview(data);
    setStep(2);
  }

  function updateDecision(studentId: number, patch: Partial<DecisionState>) {
    setDecisions(prev => ({ ...prev, [studentId]: { ...prev[studentId], ...patch } }));
  }

  function bulkSetClassForGroup(fromClassId: number | null, newTargetClassId: number | null) {
    if (!preview) return;
    setDecisions(prev => {
      const next = { ...prev };
      for (const s of preview.students) {
        if (s.currentClassId === fromClassId && next[s.studentId].outcome !== "GRADUATED" && next[s.studentId].outcome !== "LEFT") {
          next[s.studentId] = { ...next[s.studentId], targetClassId: newTargetClassId };
        }
      }
      return next;
    });
  }

  const unresolvedCount = useMemo(() => {
    if (!preview) return 0;
    return preview.students.filter(s => {
      const d = decisions[s.studentId];
      if (!d) return true;
      if ((d.outcome === "PROMOTED" || d.outcome === "REPEATED") && !d.targetClassId) return true;
      return false;
    }).length;
  }, [preview, decisions]);

  const filteredStudents = useMemo(() => {
    if (!preview) return [];
    const q = search.trim().toLowerCase();
    if (!q) return preview.students;
    return preview.students.filter(s => `${s.firstName} ${s.lastName}`.toLowerCase().includes(q) || (s.currentClassName || "").toLowerCase().includes(q));
  }, [preview, search]);

  const counts = useMemo(() => {
    const vals = Object.values(decisions);
    return {
      promoted: vals.filter(d => d.outcome === "PROMOTED").length,
      repeated: vals.filter(d => d.outcome === "REPEATED").length,
      graduated: vals.filter(d => d.outcome === "GRADUATED").length,
      left: vals.filter(d => d.outcome === "LEFT").length,
    };
  }, [decisions]);

  async function handleApply() {
    if (!preview || confirmText.trim() !== preview.toYear.label) return;
    setApplying(true); setApplyErr(null);
    const body = {
      toYearId: preview.toYear.id,
      decisions: preview.students.map(s => ({
        studentId: s.studentId,
        outcome: decisions[s.studentId].outcome,
        targetClassId: decisions[s.studentId].targetClassId,
        note: decisions[s.studentId].note || null,
      })),
    };
    const r = await fetch("/api/students/promote", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await r.json();
    setApplying(false);
    if (!r.ok) { setApplyErr(data.error || "Gabim"); return; }
    setApplyResult(data);
  }

  if (session && !isAdmin) {
    return (
      <>
        <Header title="Mbyllja e Vitit" />
        <div className="p-6">
          <div className="card p-8 text-center text-slate-400 flex flex-col items-center gap-2">
            <ShieldAlert className="w-8 h-8 opacity-40" />
            <p>Vetëm adminët mund ta kryejnë kalimin e vitit shkollor.</p>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Header title="Mbyllja e Vitit" />
      <div className="p-6 max-w-5xl mx-auto space-y-5 animate-fade-in">

        {applyResult ? (
          <div className="card p-8 text-center space-y-4">
            <Check className="w-10 h-10 text-green-500 mx-auto" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">Kalimi u krye me sukses</h2>
            <div className="flex justify-center gap-3 flex-wrap text-sm">
              <span className="badge bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400">{applyResult.counts.promotedCount} promovuar</span>
              <span className="badge bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">{applyResult.counts.repeatedCount} përsëritën</span>
              <span className="badge bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">{applyResult.counts.graduatedCount} diplomuan</span>
              <span className="badge bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{applyResult.counts.leftCount} u larguan</span>
            </div>
          </div>
        ) : (
          <>
            {/* Progress steps */}
            <div className="flex items-center gap-2 text-xs font-semibold text-slate-400">
              <span className={step === 1 ? "text-primary-600 dark:text-primary-400" : ""}>1. Zgjidh Vitin</span>
              <ArrowRight className="w-3 h-3" />
              <span className={step === 2 ? "text-primary-600 dark:text-primary-400" : ""}>2. Rishiko</span>
              <ArrowRight className="w-3 h-3" />
              <span className={step === 3 ? "text-primary-600 dark:text-primary-400" : ""}>3. Konfirmo</span>
            </div>

            {/* STEP 1 */}
            {step === 1 && (
              <div className="card p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-indigo-50 dark:bg-indigo-900/30 rounded-xl flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-indigo-500" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-white">Zgjidh vitin destinacion</h2>
                    <p className="text-xs text-slate-400">Duke kaluar nga: <b>{activeYear?.label ?? "—"}</b></p>
                  </div>
                </div>

                {loadingYears ? (
                  <div className="text-sm text-slate-400">Duke ngarkuar...</div>
                ) : (
                  <>
                    {nonActiveYears.length > 0 && (
                      <div>
                        <label className="form-label">Viti ekzistues</label>
                        <select value={toYearId} onChange={e => setToYearId(e.target.value ? parseInt(e.target.value) : "")} className="form-input">
                          <option value="">Zgjidh...</option>
                          {nonActiveYears.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
                        </select>
                      </div>
                    )}
                    <form onSubmit={handleCreateYear} className="flex items-end gap-2">
                      <div className="flex-1">
                        <label className="form-label">Ose krijo vit të ri</label>
                        <input value={newYearLabel} onChange={e => setNewYearLabel(e.target.value)} className="form-input" placeholder='p.sh. "2027-2028"' />
                      </div>
                      <button type="submit" disabled={creatingYear || !newYearLabel.trim()} className="btn-secondary">
                        {creatingYear ? <Loader2 className="w-4 h-4 animate-spin" /> : "Krijo"}
                      </button>
                    </form>
                  </>
                )}

                <div className="flex justify-end">
                  <button onClick={loadPreview} disabled={!toYearId || loadingPreview} className="btn-primary">
                    {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                    Vazhdo
                  </button>
                </div>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && preview && (
              <div className="space-y-4">
                {preview.alreadyPromoted && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" /> Kalimi për këtë vit është kryer tashmë — s'mund të përsëritet.
                  </div>
                )}

                <div className="flex flex-wrap gap-2 text-xs font-semibold">
                  <span className="px-3 py-1.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{preview.summary.total} gjithsej</span>
                  <span className="px-3 py-1.5 rounded-full bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400">{counts.promoted + counts.repeated} do promovohen</span>
                  <span className="px-3 py-1.5 rounded-full bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">{counts.graduated} do diplomohen</span>
                  {unresolvedCount > 0 && (
                    <span className="px-3 py-1.5 rounded-full bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400">{unresolvedCount} kërkojnë vendim</span>
                  )}
                </div>

                {/* Class mapping summary */}
                <div className="card p-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Përmbledhja e Klasave</p>
                  <div className="flex flex-wrap gap-2">
                    {preview.classMapping.map((m, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 text-xs">
                        <span className="font-medium">{m.fromClassName ?? "Pa klasë"}</span>
                        <ArrowRight className="w-3 h-3 text-slate-400" />
                        <select
                          defaultValue={m.toClassId ?? ""}
                          onChange={e => bulkSetClassForGroup(m.fromClassId, e.target.value ? parseInt(e.target.value) : null)}
                          className="text-xs bg-transparent border-none font-semibold text-primary-600 dark:text-primary-400 focus:outline-none">
                          <option value="">Diplomohet</option>
                          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        <span className="text-slate-400">({m.studentCount})</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Search */}
                <div className="relative">
                  <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Kërko nxënës ose klasë..." className="form-input pl-9" />
                </div>

                {/* Student table */}
                <div className="card overflow-hidden">
                  <div className="overflow-x-auto max-h-[28rem] overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                        <tr>
                          <th className="table-header">Nxënësi</th>
                          <th className="table-header">Klasa Aktuale</th>
                          <th className="table-header">Vendimi</th>
                          <th className="table-header">Klasa e Re</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                        {filteredStudents.map(s => {
                          const d = decisions[s.studentId];
                          const unresolved = (d.outcome === "PROMOTED" || d.outcome === "REPEATED") && !d.targetClassId;
                          return (
                            <tr key={s.studentId} className={unresolved ? "bg-amber-50/50 dark:bg-amber-900/10 border-l-2 border-amber-400" : ""}>
                              <td className="table-cell font-medium text-slate-800 dark:text-slate-100">{s.firstName} {s.lastName}</td>
                              <td className="table-cell text-slate-500 text-xs">{s.currentClassName ?? "—"}</td>
                              <td className="table-cell">
                                <select value={d.outcome} onChange={e => updateDecision(s.studentId, { outcome: e.target.value as Outcome, targetClassId: e.target.value === "GRADUATED" || e.target.value === "LEFT" ? null : d.targetClassId })}
                                  className="form-input py-1 text-xs">
                                  <option value="PROMOTED">Promovohet</option>
                                  <option value="REPEATED">Përsërit</option>
                                  <option value="GRADUATED">Diplomohet</option>
                                  <option value="LEFT">Largohet</option>
                                </select>
                              </td>
                              <td className="table-cell">
                                {(d.outcome === "PROMOTED" || d.outcome === "REPEATED") ? (
                                  <select value={d.targetClassId ?? ""} onChange={e => updateDecision(s.studentId, { targetClassId: e.target.value ? parseInt(e.target.value) : null })}
                                    className="form-input py-1 text-xs">
                                    <option value="">— zgjidh —</option>
                                    {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                  </select>
                                ) : <span className="text-slate-300 text-xs">—</span>}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex justify-between">
                  <button onClick={() => setStep(1)} className="btn-secondary"><ArrowLeft className="w-4 h-4" /> Kthehu</button>
                  <button onClick={() => setStep(3)} disabled={unresolvedCount > 0 || preview.alreadyPromoted} className="btn-primary">
                    {unresolvedCount > 0 ? `Zgjidh ${unresolvedCount} nxënës të pazgjidhur` : "Vazhdo"} <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && preview && (
              <div className="card p-6 space-y-5">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 bg-red-50 dark:bg-red-900/30 rounded-xl flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <h2 className="font-bold text-slate-900 dark:text-white">Konfirmo Kalimin e Vitit</h2>
                    <p className="text-xs text-slate-400">Ky veprim prek {preview.summary.total} nxënës aktivë njëherësh dhe krijon automatikisht një backup para se të aplikohet.</p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 text-sm">
                  <span className="badge bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400">{counts.promoted} promovohen</span>
                  <span className="badge bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400">{counts.repeated} përsërisin</span>
                  <span className="badge bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400">{counts.graduated} diplomohen</span>
                  <span className="badge bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{counts.left} largohen</span>
                </div>

                {applyErr && (
                  <div className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-400 rounded-xl text-sm">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" /> {applyErr}
                  </div>
                )}

                <div>
                  <label className="form-label">Shkruaj <b>&quot;{preview.toYear.label}&quot;</b> për të konfirmuar</label>
                  <input value={confirmText} onChange={e => setConfirmText(e.target.value)} className="form-input" placeholder={preview.toYear.label} />
                </div>

                <div className="flex justify-between">
                  <button onClick={() => setStep(2)} className="btn-secondary"><ArrowLeft className="w-4 h-4" /> Kthehu</button>
                  <button onClick={handleApply} disabled={confirmText.trim() !== preview.toYear.label || applying} className="btn-primary bg-red-600 hover:bg-red-700 border-red-600">
                    {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    {applying ? "Duke aplikuar..." : "Konfirmo Kalimin"}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </>
  );
}
