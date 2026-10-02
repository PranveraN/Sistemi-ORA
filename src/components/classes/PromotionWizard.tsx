"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Loader2, ArrowRight, AlertTriangle, CheckCircle2, Search } from "lucide-react";
import { DEFAULT_CLASS_CAPACITY } from "@/lib/classCapacity";

// "Kalo në vitin e ri" — asistent me hapa mbi API-në EKZISTUESE të kalimit të
// vitit (/api/students/promote): pamje paraprake, backup i plotë, një
// transaksion i vetëm (ose gjithçka ose asgjë), fotografia e vitit të vjetër.
// S'fshin dhe s'ndryshon të dhënat e vitit të vjetër; borxhet s'kopjohen.

interface SchoolYearRow { id: number; label: string; active: boolean }
interface ClassRow { id: number; name: string; level: string; capacity: number | null; active: boolean }
type Outcome = "PROMOTED" | "REPEATED" | "GRADUATED" | "LEFT";
interface PreviewStudent {
  studentId: number; firstName: string; lastName: string;
  currentClassId: number | null; currentClassName: string | null;
  proposedOutcome: "PROMOTED" | "GRADUATED" | "MANUAL";
  proposedClassId: number | null;
}
interface Preview {
  fromYear: { id: number; label: string } | null;
  toYear: { id: number; label: string };
  alreadyPromoted: boolean;
  students: PreviewStudent[];
}
interface Decision { outcome: Outcome; targetClassId: number | null }

const OUTCOMES: [Outcome, string][] = [["PROMOTED", "Kalon"], ["REPEATED", "Përsërit"], ["GRADUATED", "Diplomohet"], ["LEFT", "Largohet"]];
const STEPS = ["Vitet", "Klasat", "Rishikimi", "Konfirmimi"];
const collator = new Intl.Collator("sq", { numeric: true, sensitivity: "base" });

export default function PromotionWizard({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [step, setStep] = useState(0);
  const [years, setYears] = useState<SchoolYearRow[]>([]);
  const [toYearId, setToYearId] = useState<number | "">("");
  const [newLabel, setNewLabel] = useState("");
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [decisions, setDecisions] = useState<Record<number, Decision>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [result, setResult] = useState<{ counts: Record<string, number>; toYear: { label: string } } | null>(null);

  const activeYear = years.find(y => y.active) ?? null;

  async function loadYears() {
    const r = await fetch("/api/school-years");
    if (r.ok) setYears(await r.json());
  }
  async function loadClasses() {
    const r = await fetch("/api/classes");
    if (r.ok) setClasses(await r.json());
  }
  useEffect(() => { loadYears(); loadClasses(); }, []);
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [busy, onClose]);

  async function createYear() {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/school-years", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ label: newLabel.trim() }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Krijimi i vitit dështoi."); return; }
      setNewLabel("");
      await loadYears();
      setToYearId(d.id);
    } finally { setBusy(false); }
  }

  const missingStandard = useMemo(() => {
    const have = new Set(classes.map(c => c.name.toUpperCase()));
    return ["1A","1B","2A","2B","3A","3B","4A","4B","5A","5B","6A","6B","7A","7B","8A","8B","9A","9B"].filter(n => !have.has(n));
  }, [classes]);

  async function runSetup() {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/classes/setup", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Konfigurimi dështoi."); return; }
      await loadClasses();
    } finally { setBusy(false); }
  }

  async function loadPreview() {
    if (!toYearId) return;
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/students/promote/preview?toYearId=${toYearId}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Pamja paraprake dështoi."); return; }
      const p = d as Preview;
      if (p.alreadyPromoted) { setError(`Kalimi për ${p.toYear.label} është kryer tashmë.`); return; }
      const init: Record<number, Decision> = {};
      for (const s of p.students) {
        init[s.studentId] = s.proposedOutcome === "MANUAL"
          ? { outcome: "PROMOTED", targetClassId: null }
          : { outcome: s.proposedOutcome, targetClassId: s.proposedClassId };
      }
      setDecisions(init);
      setPreview(p);
      setStep(2);
    } finally { setBusy(false); }
  }

  const unresolved = preview ? preview.students.filter(s => {
    const d = decisions[s.studentId];
    return !d || ((d.outcome === "PROMOTED" || d.outcome === "REPEATED") && !d.targetClassId);
  }).length : 0;

  // Paralajmërim kapaciteti për klasat e reja
  const overCapacity = useMemo(() => {
    const count = new Map<number, number>();
    for (const d of Object.values(decisions)) {
      if ((d.outcome === "PROMOTED" || d.outcome === "REPEATED") && d.targetClassId) count.set(d.targetClassId, (count.get(d.targetClassId) ?? 0) + 1);
    }
    return classes
      .map(c => ({ name: c.name, n: count.get(c.id) ?? 0, cap: c.capacity ?? DEFAULT_CLASS_CAPACITY }))
      .filter(x => x.n > x.cap)
      .sort((a, b) => collator.compare(a.name, b.name));
  }, [decisions, classes]);

  const counts = useMemo(() => {
    const v = Object.values(decisions);
    return Object.fromEntries(OUTCOMES.map(([k]) => [k, v.filter(d => d.outcome === k).length])) as Record<Outcome, number>;
  }, [decisions]);

  const visibleStudents = useMemo(() => {
    if (!preview) return [];
    const q = search.trim().toLowerCase();
    return [...preview.students]
      .filter(s => !q || `${s.firstName} ${s.lastName} ${s.currentClassName ?? ""}`.toLowerCase().includes(q))
      .sort((a, b) => collator.compare(a.currentClassName ?? "~", b.currentClassName ?? "~") || collator.compare(a.firstName, b.firstName));
  }, [preview, search]);

  async function apply() {
    if (!preview || !confirmed || unresolved) return;
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/students/promote", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          toYearId: preview.toYear.id,
          decisions: preview.students.map(s => ({ studentId: s.studentId, outcome: decisions[s.studentId].outcome, targetClassId: decisions[s.studentId].targetClassId, note: null })),
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Kalimi dështoi — asgjë s'u ndryshua."); return; }
      setResult(d);
      onDone();
    } catch {
      setError("Gabim rrjeti — kontrollo nëse kalimi u krye para se ta provosh përsëri.");
    } finally { setBusy(false); }
  }

  const nonActiveYears = years.filter(y => !y.active);

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="section-title">Kalo në vitin e ri</h2>
            <ol className="flex gap-3 mt-2 text-xs">
              {STEPS.map((s, i) => (
                <li key={s} className={`flex items-center gap-1 ${i === step ? "text-primary-600 font-semibold" : i < step ? "text-green-600" : "text-slate-400"}`}>
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] ${i === step ? "bg-primary-600 text-white" : i < step ? "bg-green-100 text-green-700" : "bg-slate-100 dark:bg-slate-800"}`}>{i + 1}</span>{s}
                </li>
              ))}
            </ol>
          </div>
          <button onClick={onClose} disabled={busy} aria-label="Mbyll" className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {result ? (
            <div className="text-center py-8 space-y-3">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
              <p className="font-semibold">Kalimi në {result.toYear.label} u krye.</p>
              <p className="text-sm text-slate-500">
                Kaluan {result.counts.promotedCount ?? 0} · Përsëritin {result.counts.repeatedCount ?? 0} · Diplomuan {result.counts.graduatedCount ?? 0} · U larguan {result.counts.leftCount ?? 0}
              </p>
              <button onClick={onClose} className="btn-primary">Mbyll</button>
            </div>
          ) : step === 0 ? (
            <div className="space-y-4">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-800/50 p-4 text-sm">
                <p className="text-slate-500">Viti burim (aktiv)</p>
                <p className="font-semibold">{activeYear?.label ?? "— asnjë vit aktiv i regjistruar —"}</p>
              </div>
              <div>
                <label className="form-label">Viti i ri</label>
                <select value={toYearId} onChange={e => setToYearId(e.target.value ? Number(e.target.value) : "")} className="form-input">
                  <option value="">Zgjidh vitin e ri...</option>
                  {nonActiveYears.map(y => <option key={y.id} value={y.id}>{y.label}</option>)}
                </select>
              </div>
              <div className="flex gap-2 items-end">
                <div className="flex-1">
                  <label className="form-label">ose krijo vitin e ri</label>
                  <input value={newLabel} onChange={e => setNewLabel(e.target.value)} className="form-input" placeholder="p.sh. 2027-2028" />
                </div>
                <button type="button" onClick={createYear} disabled={busy || !newLabel.trim()} className="btn-secondary">Krijo</button>
              </div>
              <p className="text-xs text-slate-400">Të dhënat e vitit të vjetër (pagesat, borxhet, historiku) s&apos;preken; borxhet mbeten te viti ku u krijuan.</p>
            </div>
          ) : step === 1 ? (
            <div className="space-y-3">
              <p className="text-sm text-slate-600 dark:text-slate-300">
                Klasat e vitit të ri janë të njëjtat paralele (1A…9B). Nxënësit propozohen të kalojnë 1A → 2A … 8B → 9B; klasa 9 diplomohet.
              </p>
              {missingStandard.length ? (
                <div className="rounded-xl bg-orange-50 dark:bg-orange-900/20 p-4 text-sm space-y-2">
                  <p className="text-orange-700 dark:text-orange-400">Mungojnë {missingStandard.length} klasa standarde: {missingStandard.join(", ")}</p>
                  <button type="button" onClick={runSetup} disabled={busy} className="btn-secondary text-sm">Krijo klasat që mungojnë (Konfigurim automatik)</button>
                </div>
              ) : (
                <p className="text-sm text-green-600 flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> Të gjitha klasat 1A–9B ekzistojnë ({classes.length} klasa gjithsej).</p>
              )}
            </div>
          ) : step === 2 && preview ? (
            <div className="space-y-3">
              <div className="flex flex-wrap gap-2 text-xs">
                {OUTCOMES.map(([k, l]) => <span key={k} className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800">{l}: <b>{counts[k]}</b></span>)}
                {unresolved > 0 && <span className="px-2 py-1 rounded-lg bg-orange-50 text-orange-700">Pa klasë të re: <b>{unresolved}</b></span>}
              </div>
              {overCapacity.length > 0 && (
                <p className="text-xs text-red-600 flex items-start gap-1"><AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                  Mbi kapacitet: {overCapacity.map(o => `${o.name} (${o.n}/${o.cap})`).join(", ")}</p>
              )}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} className="form-input pl-9" placeholder="Kërko nxënësin ose klasën..." />
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                  <tr>
                    <th className="text-left px-2 py-2 text-xs text-slate-500">Nxënësi</th>
                    <th className="text-left px-2 py-2 text-xs text-slate-500">Klasa e vjetër</th>
                    <th className="text-left px-2 py-2 text-xs text-slate-500">Vendimi</th>
                    <th className="text-left px-2 py-2 text-xs text-slate-500">Klasa e re</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {visibleStudents.map(s => {
                    const d = decisions[s.studentId];
                    const needsClass = d.outcome === "PROMOTED" || d.outcome === "REPEATED";
                    return (
                      <tr key={s.studentId}>
                        <td className="px-2 py-1.5">{s.firstName} {s.lastName}</td>
                        <td className="px-2 py-1.5 text-slate-500">{s.currentClassName ?? "—"}</td>
                        <td className="px-2 py-1.5">
                          <select value={d.outcome} aria-label={`Vendimi për ${s.firstName} ${s.lastName}`}
                            onChange={e => {
                              const o = e.target.value as Outcome;
                              setDecisions(prev => ({ ...prev, [s.studentId]: {
                                outcome: o,
                                targetClassId: o === "GRADUATED" || o === "LEFT" ? null : o === "REPEATED" ? s.currentClassId : (prev[s.studentId].targetClassId ?? s.proposedClassId),
                              } }));
                            }}
                            className="text-xs px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800">
                            {OUTCOMES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                          </select>
                        </td>
                        <td className="px-2 py-1.5">
                          {needsClass ? (
                            <select value={d.targetClassId ?? ""} aria-label={`Klasa e re për ${s.firstName} ${s.lastName}`}
                              onChange={e => setDecisions(prev => ({ ...prev, [s.studentId]: { ...prev[s.studentId], targetClassId: e.target.value ? Number(e.target.value) : null } }))}
                              className={`text-xs px-2 py-1 rounded-md border bg-white dark:bg-slate-800 ${d.targetClassId ? "border-slate-200 dark:border-slate-600" : "border-orange-400"}`}>
                              <option value="">Zgjidh...</option>
                              {[...classes].sort((a, b) => collator.compare(a.name, b.name)).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                            </select>
                          ) : <span className="text-xs text-slate-400">—</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : step === 3 && preview ? (
            <div className="space-y-4 text-sm">
              <p>Kalimi nga <b>{preview.fromYear?.label ?? "—"}</b> në <b>{preview.toYear.label}</b> për <b>{preview.students.length}</b> nxënës:</p>
              <ul className="space-y-1 text-slate-600 dark:text-slate-300">
                {OUTCOMES.map(([k, l]) => <li key={k}>• {l}: {counts[k]}</li>)}
              </ul>
              <ul className="text-xs text-slate-500 space-y-1">
                <li>• Para kalimit bëhet automatikisht backup i plotë i databazës.</li>
                <li>• Kryhet në një transaksion të vetëm — ose gjithçka, ose asgjë.</li>
                <li>• Viti i vjetër ruhet (klasat me mësuesit, klasa e çdo nxënësi); pagesat dhe borxhet s&apos;preken dhe s&apos;kopjohen.</li>
                <li>• Çdo kalim regjistrohet te historiku i nxënësit; të diplomuarit/larguarit dalin te &quot;Lëvizjet&quot;.</li>
              </ul>
              {overCapacity.length > 0 && <p className="text-xs text-red-600">Kujdes: {overCapacity.length} klasa do të jenë mbi kapacitet.</p>}
              <label className="flex items-center gap-2"><input type="checkbox" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} /> E konfirmoj kalimin në {preview.toYear.label}</label>
            </div>
          ) : null}
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        {!result && (
          <div className="flex items-center justify-between p-5 border-t border-slate-100 dark:border-slate-700">
            <button type="button" onClick={() => setStep(s => Math.max(0, s - 1))} disabled={busy || step === 0} className="btn-secondary">Prapa</button>
            {step === 0 && <button type="button" onClick={() => setStep(1)} disabled={!toYearId} className="btn-primary">Vazhdo <ArrowRight className="w-4 h-4" /></button>}
            {step === 1 && <button type="button" onClick={loadPreview} disabled={busy || !toYearId} className="btn-primary">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Propozo kalimin <ArrowRight className="w-4 h-4" /></button>}
            {step === 2 && <button type="button" onClick={() => setStep(3)} disabled={unresolved > 0} className="btn-primary" title={unresolved ? "Cakto klasën e re për të gjithë" : undefined}>Vazhdo <ArrowRight className="w-4 h-4" /></button>}
            {step === 3 && <button type="button" onClick={apply} disabled={busy || !confirmed || unresolved > 0} className="btn-primary">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Kryej kalimin</button>}
          </div>
        )}
      </div>
    </div>
  );
}
