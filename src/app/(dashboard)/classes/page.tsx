"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/layout/Header";
import YearPicker from "@/components/dashboard/YearPicker";
import { ACADEMIC_YEARS } from "@/lib/academicYear";
import {
  Plus, X, Save, Settings2, CheckCircle, Loader2, LayoutGrid, Table2, GraduationCap,
  Users, AlertTriangle, UserX, ArrowRightLeft, History, Info,
} from "lucide-react";
import ClassCard, { type OverviewClass } from "@/components/classes/ClassCard";
import ClassesTable from "@/components/classes/ClassesTable";
import { EditClassModal } from "@/components/classes/ClassMenu";
import PromotionWizard from "@/components/classes/PromotionWizard";
import { SpecialCareCard, AssistantsCard, SpecialCareForm, useSpecialCare } from "@/components/classes/SpecialCarePanel";

interface Overview {
  year: number;
  current: number;
  mode: "current" | "past" | "future";
  label?: string;
  debtVisible: boolean;
  specialCareVisible: boolean;
  unassigned?: number;
  classes: OverviewClass[];
}

const collator = new Intl.Collator("sq", { numeric: true, sensitivity: "base" });

export default function ClassesPage() {
  const sp = useSearchParams();
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  // Pedagogia: vetëm shikim (pa krijim/editim) — si më parë
  const readOnlyRole = role === "PEDAGOGIA";
  const canPromote = role === "SUPERADMIN" || role === "ADMIN";

  const [year, setYear] = useState(parseInt(sp.get("y") || "") || 0);
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<"cards" | "table">("cards");
  const [showInactive, setShowInactive] = useState(false);
  const [filter, setFilter] = useState<"" | "over" | "noTeacher">("");

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", level: "", teacher: "" });
  const [saving, setSaving] = useState(false);
  const [showSetup, setShowSetup] = useState(false);
  const [setupBusy, setSetupBusy] = useState(false);
  const [setupResult, setSetupResult] = useState<{ classesCreated: number; created: string[]; alreadyExisting: number } | null>(null);
  const [assignFor, setAssignFor] = useState<OverviewClass | null>(null);
  // ?wizard=1 — hapet direkt nga "Mbyllja e Vitit" te paneli i Sekretarisë
  const [showWizard, setShowWizard] = useState(() => sp.get("wizard") === "1");
  const [assignAssistant, setAssignAssistant] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try {
      const res = await fetch(`/api/classes/overview${year ? `?year=${year}` : ""}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "Ngarkimi i klasave dështoi."); return; }
      setData(d);
      if (!year) setYear(d.year);
    } catch {
      setError("Gabim rrjeti — provo përsëri.");
    } finally {
      setLoading(false);
    }
  }, [year]);
  useEffect(() => { load(); }, [load]);

  const effectiveYear = year || data?.year || 0;
  const editable = data?.mode === "current" && !readOnlyRole;
  const care = useSpecialCare(effectiveYear || 2026);
  const showSidebar = !!data?.specialCareVisible && data.mode === "current" && care.allowed && !!care.data;

  /* ── Numrat (vetëm klasat aktive) ── */
  const classes = data?.classes ?? [];
  const activeClasses = classes.filter(c => c.active);
  const stats = {
    active: activeClasses.length,
    students: classes.reduce((s, c) => s + c.students, 0),
    over: activeClasses.filter(c => c.students > c.effectiveCapacity).length,
    noTeacher: activeClasses.filter(c => !c.teacher).length,
  };

  const visible = useMemo(() => classes
    .filter(c => showInactive || c.active)
    .filter(c => filter === "over" ? c.students > c.effectiveCapacity : filter === "noTeacher" ? !c.teacher && c.active : true)
    .sort((a, b) => collator.compare(a.name, b.name)), [classes, showInactive, filter]);

  // Grupimi sipas nivelit ("Klasa 1 · 45 nxënës")
  const groups = useMemo(() => {
    const m = new Map<string, OverviewClass[]>();
    for (const c of visible) {
      const lvl = c.name.match(/^\d+/)?.[0] ?? c.level;
      if (!m.has(lvl)) m.set(lvl, []);
      m.get(lvl)!.push(c);
    }
    return Array.from(m.entries()).sort((a, b) => collator.compare(a[0], b[0]));
  }, [visible]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/classes", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Shtimi dështoi."); return; }
      setShowForm(false);
      setForm({ name: "", level: "", teacher: "" });
      load();
    } catch { alert("Gabim rrjeti — provo përsëri."); }
    finally { setSaving(false); }
  }

  async function handleSetup() {
    setSetupBusy(true);
    try {
      const res = await fetch("/api/classes/setup", { method: "POST" });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { alert(d.error || "Konfigurimi automatik dështoi."); return; }
      setSetupResult(d);
      load();
    } catch { alert("Gabim rrjeti — provo përsëri."); }
    finally { setSetupBusy(false); }
  }

  async function saveTeacher(v: string) {
    if (!assignFor) return;
    try {
      const res = await fetch(`/api/classes/${assignFor.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ teacher: v }) });
      if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Ruajtja dështoi."); return; }
      setAssignFor(null);
      load();
    } catch { alert("Gabim rrjeti — provo përsëri."); }
  }

  const statCards = [
    { key: "", label: "Klasa aktive", value: stats.active, icon: GraduationCap, tone: "text-primary-600 bg-primary-50 dark:bg-primary-900/30", valueTone: "text-slate-900 dark:text-white", clickable: false },
    { key: "", label: "Nxënës gjithsej", value: stats.students, icon: Users, tone: "text-blue-600 bg-blue-50 dark:bg-blue-900/30", valueTone: "text-slate-900 dark:text-white", clickable: false },
    { key: "over", label: "Klasa mbi kapacitet", value: stats.over, icon: AlertTriangle, tone: "text-red-600 bg-red-50 dark:bg-red-900/30", valueTone: "text-red-600", clickable: true },
    { key: "noTeacher", label: "Klasa pa mësues", value: stats.noTeacher, icon: UserX, tone: "text-orange-600 bg-orange-50 dark:bg-orange-900/30", valueTone: "text-orange-600", clickable: true },
  ] as const;

  return (
    <>
      <Header title="Klasat" />
      <div className="p-4 sm:p-6 space-y-4 animate-fade-in">

        {/* ── 1. Koka ── */}
        <div className="flex flex-wrap items-center gap-3 justify-between">
          <YearPicker years={ACADEMIC_YEARS} year={effectiveYear} yearType="academic" onSelect={y => { setYear(y); setFilter(""); }} />
          {!readOnlyRole && (
            <div className="flex flex-wrap gap-2">
              {canPromote && (
                <button onClick={() => setShowWizard(true)} className="btn-secondary"><ArrowRightLeft className="w-4 h-4" /> Kalo në vitin e ri</button>
              )}
              <button onClick={() => { setSetupResult(null); setShowSetup(true); }} className="btn-secondary"><Settings2 className="w-4 h-4" /> Konfigurim automatik (1A–9B)</button>
              <button onClick={() => setShowForm(true)} className="btn-primary"><Plus className="w-4 h-4" /> Shto klasë</button>
            </div>
          )}
        </div>

        {data?.mode === "past" && (
          <p className="text-sm px-4 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 text-slate-600 dark:text-slate-300 flex items-center gap-2">
            <History className="w-4 h-4 text-slate-400" /> Viti {data.label ?? `${effectiveYear}-${effectiveYear + 1}`} — vetëm shikim (fotografia e ruajtur në kalimin e vitit).
            {!classes.some(c => c.teacher) && classes.length > 0 && " Mësuesit s'janë ruajtur për këtë vit."}
          </p>
        )}
        {data?.mode === "future" && (
          <div className="card p-8 text-center space-y-3">
            <p className="text-slate-500">Klasat e vitit {effectiveYear}–{effectiveYear + 1} ende s&apos;janë krijuar.</p>
            {canPromote && <button onClick={() => setShowWizard(true)} className="btn-primary"><ArrowRightLeft className="w-4 h-4" /> Kalo në vitin e ri</button>}
          </div>
        )}

        {/* Shto klasë */}
        {showForm && (
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">Klasë e re</h3>
              <button onClick={() => setShowForm(false)} aria-label="Mbyll" className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
            </div>
            <form onSubmit={handleAdd} className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Emri <span className="text-red-500">*</span></label>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="form-input" placeholder="p.sh. 1A, 2B" required />
              </div>
              <div>
                <label className="form-label">Niveli <span className="text-red-500">*</span></label>
                <input value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value }))} className="form-input" placeholder="p.sh. Klasa 1" required />
              </div>
              <div>
                <label className="form-label">Mësuesi/ja</label>
                <input value={form.teacher} onChange={e => setForm(f => ({ ...f, teacher: e.target.value }))} className="form-input" placeholder="Emri i mësuesit" />
              </div>
              <div className="md:col-span-3 flex justify-end gap-2">
                <button type="button" onClick={() => setShowForm(false)} className="btn-secondary"><X className="w-4 h-4" />Anulo</button>
                <button type="submit" disabled={saving} className="btn-primary"><Save className="w-4 h-4" />{saving ? "Duke ruajtur..." : "Ruaj"}</button>
              </div>
            </form>
          </div>
        )}

        {data && data.mode !== "future" && (
          <>
            {/* ── 2. Kartat përmbledhëse ── */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
              {statCards.map((c, i) => {
                const Icon = c.icon;
                const active = c.clickable && filter === c.key;
                const inner = (
                  <>
                    <div className={`w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center ${c.tone}`}><Icon className="w-4 h-4" /></div>
                    <div className="min-w-0">
                      <p className={`text-lg font-bold ${c.value > 0 ? c.valueTone : "text-slate-900 dark:text-white"}`}>{c.value}</p>
                      <p className="text-xs text-slate-400 truncate">{c.label}</p>
                    </div>
                  </>
                );
                return c.clickable ? (
                  <button key={i} type="button" aria-pressed={active} onClick={() => setFilter(f => (f === c.key ? "" : c.key))}
                    className={`card p-3 sm:p-4 flex items-center gap-3 text-left border-2 transition-all ${active ? "border-primary-500 ring-2 ring-primary-100 dark:ring-primary-900/40" : "border-transparent hover:border-slate-200 dark:hover:border-slate-600"}`}>
                    {inner}
                  </button>
                ) : (
                  <div key={i} className="card p-3 sm:p-4 flex items-center gap-3 border-2 border-transparent">{inner}</div>
                );
              })}
            </div>

            {/* ── 3. Kontrollet e pamjes ── */}
            <div className="flex flex-wrap items-center gap-3 justify-between">
              <div className="flex items-center rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 text-sm font-medium">
                {([["cards", "Karta", LayoutGrid], ["table", "Tabelë", Table2]] as const).map(([k, l, Icon]) => (
                  <button key={k} onClick={() => setView(k)} aria-pressed={view === k}
                    className={`px-3 py-1.5 flex items-center gap-1.5 transition-colors ${view === k ? "bg-primary-600 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                    <Icon className="w-4 h-4" /> {l}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-3">
                {filter && (
                  <button onClick={() => setFilter("")} className="text-xs text-primary-600 font-medium">
                    Filtri: {filter === "over" ? "mbi kapacitet" : "pa mësues"} ✕
                  </button>
                )}
                <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                  <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Shfaq klasat joaktive
                </label>
              </div>
            </div>

            {(data.unassigned ?? 0) > 0 && (
              <p className="text-xs text-orange-600 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> {data.unassigned} nxënës aktivë s&apos;kanë klasë të caktuar.</p>
            )}

            {/* ── 4/5. Klasat + kolona anësore ── */}
            <div className={`grid gap-4 ${showSidebar ? "lg:grid-cols-[1fr_340px]" : ""}`}>
              <div className="space-y-5 min-w-0">
                {loading ? (
                  <p className="text-sm text-slate-400 text-center py-12">Duke ngarkuar...</p>
                ) : error ? (
                  <p className="text-sm text-red-500">{error}</p>
                ) : visible.length === 0 ? (
                  <div className="card p-10 text-center text-slate-400">
                    <GraduationCap className="w-10 h-10 mx-auto mb-2 opacity-30" />
                    {classes.length === 0 ? "Asnjë klasë — përdor \"Konfigurim automatik\" ose \"Shto klasë\"." : "Asnjë klasë s'përputhet me filtrin."}
                  </div>
                ) : view === "table" ? (
                  <ClassesTable classes={visible} year={effectiveYear} readOnly={!editable} onChanged={() => { load(); care.reload(); }} />
                ) : (
                  groups.map(([lvl, list]) => (
                    <section key={lvl}>
                      <h3 className="text-sm font-semibold text-slate-500 mb-2">
                        Klasa {lvl} · {list.reduce((s, c) => s + c.students, 0)} nxënës
                      </h3>
                      <div className="grid sm:grid-cols-2 gap-3">
                        {list.map(c => (
                          <ClassCard key={c.id} cls={c} year={effectiveYear} readOnly={!editable}
                            onChanged={() => { load(); care.reload(); }} onAssignTeacher={setAssignFor} />
                        ))}
                      </div>
                    </section>
                  ))
                )}
              </div>

              {showSidebar && care.data && (
                <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
                  <SpecialCareCard data={care.data} onChanged={() => { care.reload(); load(); }} />
                  <AssistantsCard data={care.data} onAssign={() => setAssignAssistant(true)} />
                </aside>
              )}
            </div>
          </>
        )}
      </div>

      {/* Konfigurim automatik — tani i sigurt (krijon vetëm klasat që mungojnë) */}
      {showSetup && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
            {!setupResult ? (
              <>
                <h3 className="font-bold text-slate-900 dark:text-white text-lg">Konfigurim automatik i klasave</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">
                  Krijon klasat standarde 1A, 1B … 9A, 9B që <b>mungojnë</b>. Klasat ekzistuese, mësuesit, kapacitetet dhe nxënësit
                  <b> nuk preken</b>.
                </p>
                <div className="flex gap-3 pt-2">
                  <button onClick={() => setShowSetup(false)} className="btn-secondary flex-1 justify-center"><X className="w-4 h-4" />Anulo</button>
                  <button onClick={handleSetup} disabled={setupBusy} className="btn-primary flex-1 justify-center">
                    {setupBusy ? <><Loader2 className="w-4 h-4 animate-spin" />Duke konfiguruar...</> : <><Settings2 className="w-4 h-4" />Konfiguro</>}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex flex-col items-center text-center gap-3 py-2">
                  <div className="w-14 h-14 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center"><CheckCircle className="w-7 h-7 text-green-600" /></div>
                  <h3 className="font-bold text-slate-900 dark:text-white text-lg">
                    {setupResult.classesCreated ? `U krijuan ${setupResult.classesCreated} klasa` : "Të gjitha klasat ekzistonin tashmë"}
                  </h3>
                  {setupResult.created.length > 0 && <p className="text-sm text-slate-500">{setupResult.created.join(", ")}</p>}
                </div>
                <button onClick={() => setShowSetup(false)} className="btn-primary w-full justify-center"><CheckCircle className="w-4 h-4" />Mbyll</button>
              </>
            )}
          </div>
        </div>
      )}

      {assignFor && (
        <EditClassModal
          cls={{ id: assignFor.id, name: assignFor.name, teacher: assignFor.teacher, capacity: assignFor.capacity, active: assignFor.active, students: assignFor.students }}
          field="teacher" onClose={() => setAssignFor(null)} onSave={saveTeacher} />
      )}
      {showWizard && <PromotionWizard onClose={() => setShowWizard(false)} onDone={() => { load(); care.reload(); }} />}
      {assignAssistant && (
        <SpecialCareForm item={null} presetAssistant onClose={() => setAssignAssistant(false)} onSaved={() => { setAssignAssistant(false); care.reload(); load(); }} />
      )}
    </>
  );
}
