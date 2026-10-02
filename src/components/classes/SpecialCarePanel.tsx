"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HeartHandshake, Plus, Pencil, AlertTriangle, X, Loader2, Search, Trash2, UserRound } from "lucide-react";
import { formatDate } from "@/lib/utils";

export interface CareItem {
  id: number;
  studentId: number;
  studentName: string;
  classId: number | null;
  className: string | null;
  hasAssistant: boolean;
  specialNeeds: boolean;
  note: string | null;
  iep: boolean;
  iepReviewDate: string | null;
  iepWarning: "overdue" | "soon" | null;
  startDate: string | null;
  endDate: string | null;
  assistant: { id: number; name: string; phone: string | null; email: string | null } | null;
}
export interface CareAssistant { id: number; name: string; phone: string | null; classes: string[]; students: number }
export interface CareData {
  canEdit: boolean;
  counts: { assistant: number; needs: number };
  items: CareItem[];
  assistants: CareAssistant[];
}

/** Ngarkon të dhënat e kujdesit të veçantë; `null` kur roli s'ka leje (403). */
export function useSpecialCare(year: number, classId?: number) {
  const [data, setData] = useState<CareData | null>(null);
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const load = useCallback(async () => {
    const p = new URLSearchParams({ year: String(year) });
    if (classId) p.set("classId", String(classId));
    try {
      const res = await fetch(`/api/special-care?${p}`);
      if (res.status === 403) { setAllowed(false); setData(null); return; }
      if (!res.ok) { setAllowed(true); return; }
      setAllowed(true);
      setData(await res.json());
    } catch { /* paneli thjesht s'shfaqet */ }
  }, [year, classId]);
  useEffect(() => { load(); }, [load]);
  return { data, allowed, reload: load };
}

const typeTags = (i: CareItem) => (
  <>
    {i.hasAssistant && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Me asistent</span>}
    {i.specialNeeds && <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">Nevoja të veçanta</span>}
  </>
);

function detailLine(i: CareItem): string {
  if (i.assistant) return `Asistentja: ${i.assistant.name}`;
  if (i.iep) return `PEI${i.iepReviewDate ? ` · rishikim ${formatDate(i.iepReviewDate)}` : ""}`;
  return i.note ?? "";
}

// Karta "Kujdes i veçantë" — numrat, filtrat dhe lista. Të dhënat vijnë nga
// /api/special-care, i cili kthen 403 për rolet pa leje (kontrolli real).
export function SpecialCareCard({ data, onChanged, limit = 8, title = "Kujdes i veçantë" }: {
  data: CareData; onChanged: () => void; limit?: number; title?: string;
}) {
  const [filter, setFilter] = useState<"all" | "assistant" | "needs">("all");
  const [editing, setEditing] = useState<CareItem | "new" | null>(null);
  const [showAll, setShowAll] = useState(false);

  const items = useMemo(() => data.items.filter(i =>
    filter === "assistant" ? i.hasAssistant : filter === "needs" ? i.specialNeeds : true), [data.items, filter]);
  const warnings = data.items.filter(i => i.iepWarning).length;

  const list = (rows: CareItem[]) => (
    <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
      {rows.map(i => (
        <li key={i.id} className="py-2 flex items-start gap-2">
          <Link href={`/students/${i.studentId}`} className="flex-1 min-w-0 group">
            <p className="text-sm font-medium text-slate-800 dark:text-slate-100 group-hover:text-primary-600 truncate">
              {i.studentName} {i.className && <span className="text-xs text-slate-400 font-normal">· {i.className}</span>}
            </p>
            <div className="flex flex-wrap gap-1 mt-0.5">{typeTags(i)}</div>
            <p className={`text-xs mt-0.5 truncate ${i.iepWarning ? "text-orange-600 font-medium" : "text-slate-400"}`}>
              {i.iepWarning && <AlertTriangle className="w-3 h-3 inline mr-0.5 -mt-0.5" />}
              {i.iepWarning === "overdue" ? `Rishikimi i PEI ka kaluar (${formatDate(i.iepReviewDate!)})`
                : i.iepWarning === "soon" ? `Rishikimi i PEI afër: ${formatDate(i.iepReviewDate!)}`
                : detailLine(i)}
            </p>
          </Link>
          {data.canEdit && (
            <button type="button" onClick={() => setEditing(i)} title="Ndrysho" aria-label={`Ndrysho kujdesin e veçantë për ${i.studentName}`}
              className="p-1 rounded text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-slate-700">
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
        </li>
      ))}
      {rows.length === 0 && <li className="py-4 text-xs text-slate-400 text-center">Asnjë nxënës në këtë listë.</li>}
    </ul>
  );

  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="section-title flex items-center gap-2"><HeartHandshake className="w-4 h-4 text-blue-500" /> {title}</h3>
        {data.canEdit && (
          <button type="button" onClick={() => setEditing("new")} title="Shto nxënës" aria-label="Shto nxënës te kujdesi i veçantë"
            className="p-1.5 rounded-lg text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20">
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl bg-blue-50 dark:bg-blue-900/20 p-2.5">
          <p className="text-lg font-bold text-blue-700 dark:text-blue-400">{data.counts.assistant}</p>
          <p className="text-xs text-slate-500">Me asistent</p>
        </div>
        <div className="rounded-xl bg-sky-50 dark:bg-sky-900/20 p-2.5">
          <p className="text-lg font-bold text-sky-700 dark:text-sky-400">{data.counts.needs}</p>
          <p className="text-xs text-slate-500">Nevoja të veçanta</p>
        </div>
      </div>
      {warnings > 0 && (
        <p className="text-xs text-orange-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {warnings} PEI me rishikim të kaluar ose brenda 7 ditëve</p>
      )}
      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
        {([["all", "Të gjithë"], ["assistant", "Me asistent"], ["needs", "Nevoja të veçanta"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setFilter(k)}
            className={`flex-1 px-2 py-1 rounded-md text-xs font-medium ${filter === k ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"}`}>
            {l}
          </button>
        ))}
      </div>
      {list(items.slice(0, limit))}
      {items.length > limit && (
        <button type="button" onClick={() => setShowAll(true)} className="text-sm font-medium text-primary-600 hover:text-primary-700">
          Shiko listën e plotë ({items.length}) →
        </button>
      )}

      {showAll && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => setShowAll(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-slate-100 dark:border-slate-700">
              <h3 className="section-title">{title} — lista e plotë</h3>
              <button onClick={() => setShowAll(false)} aria-label="Mbyll" className="p-1 rounded text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
            </div>
            <div className="overflow-y-auto px-4">{list(items)}</div>
          </div>
        </div>
      )}
      {editing && (
        <SpecialCareForm item={editing === "new" ? null : editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); }} />
      )}
    </div>
  );
}

// Karta "Asistentët" — me klasat ku punon secili dhe numrin e nxënësve.
export function AssistantsCard({ data, onAssign }: { data: CareData; onAssign: () => void }) {
  return (
    <div className="card p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="section-title flex items-center gap-2"><UserRound className="w-4 h-4 text-blue-500" /> Asistentët</h3>
        {data.canEdit && <button type="button" onClick={onAssign} className="btn-secondary text-xs">Cakto asistent</button>}
      </div>
      {data.assistants.length === 0 ? (
        <p className="text-xs text-slate-400">Asnjë asistent i caktuar këtë vit.</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
          {data.assistants.map(a => (
            <li key={a.id} className="py-2">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{a.name}</p>
              <p className="text-xs text-slate-400">
                {a.classes.length ? `Klasat ${a.classes.join(", ")}` : "Pa klasë"} · {a.students} nxënës{a.phone ? ` · ${a.phone}` : ""}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface StaffOption { id: number; name: string; position: string | null; phone: string | null }

/** Formulari Shto/Ndrysho — shkruan vetëm përmes /api/special-care (leje në backend). */
export function SpecialCareForm({ item, onClose, onSaved, presetAssistant }: {
  item: CareItem | null; onClose: () => void; onSaved: () => void; presetAssistant?: boolean;
}) {
  const toDateInput = (iso: string | null) => (iso ? iso.slice(0, 10) : "");
  const [student, setStudent] = useState<{ id: number; name: string; className: string | null } | null>(
    item ? { id: item.studentId, name: item.studentName, className: item.className } : null);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ id: number; firstName: string; lastName: string; className: string | null }[]>([]);
  const [hasAssistant, setHasAssistant] = useState(item?.hasAssistant ?? !!presetAssistant);
  const [specialNeeds, setSpecialNeeds] = useState(item?.specialNeeds ?? false);
  const [note, setNote] = useState(item?.note ?? "");
  const [iep, setIep] = useState(item?.iep ?? false);
  const [iepReviewDate, setIepReviewDate] = useState(toDateInput(item?.iepReviewDate ?? null));
  const [startDate, setStartDate] = useState(toDateInput(item?.startDate ?? null) || new Date().toISOString().slice(0, 10));
  const [endDate, setEndDate] = useState(toDateInput(item?.endDate ?? null));
  const [assistantId, setAssistantId] = useState(item?.assistant ? String(item.assistant.id) : "");
  const [staff, setStaff] = useState<StaffOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/special-care/staff-options").then(r => r.ok ? r.json() : []).then(setStaff).catch(() => {});
  }, []);
  useEffect(() => {
    if (item || query.trim().length < 2) { setResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/special-care/student-search?q=${encodeURIComponent(query.trim())}`);
      const d = await res.json().catch(() => ({}));
      setResults(d.rows ?? []);
    }, 300);
    return () => clearTimeout(t);
  }, [query, item]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (!student) { setError("Zgjidh nxënësin."); return; }
    if (!hasAssistant && !specialNeeds) { setError("Zgjidh të paktën një lloj."); return; }
    setSaving(true);
    const body = {
      studentId: student.id, hasAssistant, specialNeeds, note: note.trim() || null,
      iep, iepReviewDate: iep ? iepReviewDate || null : null,
      startDate: startDate || null, endDate: endDate || null,
      assistantStaffId: hasAssistant && assistantId ? Number(assistantId) : null,
    };
    try {
      const res = await fetch(item ? `/api/special-care/${item.id}` : "/api/special-care", {
        method: item ? "PATCH" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "Ruajtja dështoi."); return; }
      onSaved();
    } catch {
      setError("Gabim rrjeti — provo përsëri.");
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!item || !confirm(`Hiq ${item.studentName} nga lista e kujdesit të veçantë?`)) return;
    const res = await fetch(`/api/special-care/${item.id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); setError(d.error || "Heqja dështoi."); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={save} onClick={e => e.stopPropagation()} className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-slate-900 dark:text-white">{item ? "Ndrysho kujdesin e veçantë" : "Shto nxënës te kujdesi i veçantë"}</h3>
          <button type="button" onClick={onClose} aria-label="Mbyll" className="p-1 rounded text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </div>

        {student ? (
          <div className="flex items-center justify-between rounded-lg bg-slate-50 dark:bg-slate-800 px-3 py-2">
            <span className="text-sm font-medium">{student.name}{student.className && <span className="text-slate-400"> · {student.className}</span>}</span>
            {!item && <button type="button" onClick={() => setStudent(null)} className="text-xs text-primary-600">Ndrysho</button>}
          </div>
        ) : (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input autoFocus value={query} onChange={e => setQuery(e.target.value)} className="form-input pl-9" placeholder="Kërko nxënësin..." />
            {results.length > 0 && (
              <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                {results.map(r => (
                  <button key={r.id} type="button" onClick={() => { setStudent({ id: r.id, name: `${r.firstName} ${r.lastName}`, className: r.className }); setResults([]); }}
                    className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex justify-between">
                    <span>{r.firstName} {r.lastName}</span><span className="text-xs text-slate-400">{r.className}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <div className="flex gap-4">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={hasAssistant} onChange={e => setHasAssistant(e.target.checked)} /> Me asistent</label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={specialNeeds} onChange={e => setSpecialNeeds(e.target.checked)} /> Nevoja të veçanta</label>
        </div>

        {hasAssistant && (
          <div>
            <label className="form-label">Asistenti/ja (nga lista e stafit)</label>
            <select value={assistantId} onChange={e => setAssistantId(e.target.value)} className="form-input">
              <option value="">— Pa caktuar ende —</option>
              {staff.map(s => <option key={s.id} value={s.id}>{s.name}{s.position ? ` · ${s.position}` : ""}</option>)}
            </select>
          </div>
        )}

        <div>
          <label className="form-label">Shënim i shkurtër për mësuesin</label>
          <textarea value={note} onChange={e => setNote(e.target.value)} maxLength={500} className="form-input min-h-[70px]" />
        </div>

        <div className="space-y-2">
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={iep} onChange={e => setIep(e.target.checked)} /> Ka Plan Edukativ Individual (PEI)</label>
          {iep && (
            <div>
              <label className="form-label">Data e rishikimit të PEI</label>
              <input type="date" value={iepReviewDate} onChange={e => setIepReviewDate(e.target.value)} className="form-input" />
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div><label className="form-label">Data e fillimit</label><input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="form-input" /></div>
          <div><label className="form-label">Data e përfundimit</label><input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="form-input" /></div>
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex items-center justify-between gap-2">
          {item ? (
            <button type="button" onClick={remove} className="text-sm text-red-600 hover:text-red-700 inline-flex items-center gap-1"><Trash2 className="w-4 h-4" /> Hiq nga lista</button>
          ) : <span />}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary">Anulo</button>
            <button type="submit" disabled={saving} className="btn-primary">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Ruaj</button>
          </div>
        </div>
        <p className="text-[11px] text-slate-400">Të dhëna të ndjeshme — i shohin vetëm drejtoria dhe pedagogia. Historiku i nxënësit regjistron vetëm faktin e ndryshimit, jo përmbajtjen.</p>
      </form>
    </div>
  );
}
