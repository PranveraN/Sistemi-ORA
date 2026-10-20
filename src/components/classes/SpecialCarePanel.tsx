"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { HeartHandshake, Plus, Pencil, AlertTriangle, X, Loader2, Search, Trash2, UserRound, ClipboardList, Paperclip } from "lucide-react";
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
  hasPia?: boolean;
  evidenceCount?: number;
  assistant: { id: number; name: string; phone: string | null; email: string | null; personal?: boolean } | null;
}
export interface CareAssistant { id: number; name: string; phone: string | null; personal?: boolean; classes: string[]; students: number }
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
  if (i.assistant) return `Asistentja: ${i.assistant.name}${i.assistant.personal ? " (personale)" : ""}`;
  if (i.iep) return `PEI${i.iepReviewDate ? ` · rishikim ${formatDate(i.iepReviewDate)}` : ""}`;
  return i.note ?? "";
}

// Karta "Kujdes i veçantë" — numrat, filtrat dhe lista. Të dhënat vijnë nga
// /api/special-care, i cili kthen 403 për rolet pa leje (kontrolli real).
export function SpecialCareCard({ data, onChanged, limit = 8, title = "Kujdes i veçantë", year }: {
  data: CareData; onChanged: () => void; limit?: number; title?: string; year?: number;
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
          <Link href={`/classes/pia/${i.studentId}${year ? `?year=${year}` : ""}`} title="Plani Individual i Arsimit (PIA)"
            className="px-1.5 py-0.5 rounded text-[11px] font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 dark:bg-violet-900/30 dark:text-violet-300 flex items-center gap-1">
            <ClipboardList className="w-3 h-3" /> PIA
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
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{a.name}{a.personal && <span className="ml-1.5 text-[10px] font-semibold px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300">personale</span>}</p>
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
  const [assistantId, setAssistantId] = useState(item?.assistant && !item.assistant.personal ? String(item.assistant.id) : "");
  // Asistentet zakonisht janë personale të nxënësit (jo nga stafi) — emri shkruhet me dorë
  const [assistantMode, setAssistantMode] = useState<"personal" | "staff">(item?.assistant && !item.assistant.personal ? "staff" : "personal");
  const [assistantName, setAssistantName] = useState(item?.assistant?.personal ? item.assistant.name : "");
  const [assistantPhone, setAssistantPhone] = useState(item?.assistant?.personal ? item.assistant.phone ?? "" : "");
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
      assistantStaffId: hasAssistant && assistantMode === "staff" && assistantId ? Number(assistantId) : null,
      assistantName: hasAssistant && assistantMode === "personal" ? assistantName.trim() || null : null,
      assistantPhone: hasAssistant && assistantMode === "personal" ? assistantPhone.trim() || null : null,
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
            <label className="form-label">Asistenti/ja</label>
            <div className="flex gap-4 mb-2 text-sm">
              <label className="flex items-center gap-1.5"><input type="radio" checked={assistantMode === "personal"} onChange={() => setAssistantMode("personal")} /> Personale e nxënësit</label>
              <label className="flex items-center gap-1.5"><input type="radio" checked={assistantMode === "staff"} onChange={() => setAssistantMode("staff")} /> Nga stafi i shkollës</label>
            </div>
            {assistantMode === "personal" ? (
              <div className="grid grid-cols-[1fr_140px] gap-2">
                <input value={assistantName} onChange={e => setAssistantName(e.target.value)} maxLength={120} className="form-input" placeholder="Emri dhe mbiemri" />
                <input value={assistantPhone} onChange={e => setAssistantPhone(e.target.value)} maxLength={40} className="form-input" placeholder="Telefoni (opsional)" />
              </div>
            ) : (
              <select value={assistantId} onChange={e => setAssistantId(e.target.value)} className="form-input">
                <option value="">— Pa caktuar ende —</option>
                {staff.map(s => <option key={s.id} value={s.id}>{s.name}{s.position ? ` · ${s.position}` : ""}</option>)}
              </select>
            )}
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

// ── Seksioni i plotë "Kujdes i veçantë" (faqja Klasat) ─────────────────────
// Vetëm paraqitje: të njëjtat të dhëna nga /api/special-care. "Pa asistent" =
// nxënës me flamurin "Me asistent" që s'kanë ende asistente të lidhur (nga
// stafi ose me emër personal) — llogaritet vetëm për shfaqje, s'ndryshon asgjë.
export function SpecialCareSection({ data, onChanged, year, onAssign }: {
  data: CareData; onChanged: () => void; year: number; onAssign: () => void;
}) {
  const [tab, setTab] = useState<"all" | "assistant" | "needs" | "noAssistant">("all");
  const [cls, setCls] = useState("");
  const [editing, setEditing] = useState<CareItem | "new" | null>(null);

  const noAssistant = (i: CareItem) => i.hasAssistant && !i.assistant;
  const classes = useMemo(() => [...new Set(data.items.map(i => i.className).filter((x): x is string => !!x))]
    .sort((a, b) => a.localeCompare(b, "sq", { numeric: true })), [data.items]);
  const inClass = data.items.filter(i => !cls || i.className === cls);
  const rows = inClass
    .filter(i => tab === "assistant" ? i.hasAssistant : tab === "needs" ? i.specialNeeds : tab === "noAssistant" ? noAssistant(i) : true)
    .sort((a, b) => (a.className ?? "").localeCompare(b.className ?? "", "sq", { numeric: true }) || a.studentName.localeCompare(b.studentName, "sq"));
  const counts = {
    assistant: inClass.filter(i => i.hasAssistant).length,
    needs: inClass.filter(i => i.specialNeeds).length,
    pia: inClass.filter(i => i.hasPia).length,
    pei: inClass.filter(i => i.iep).length,
    noAssistant: inClass.filter(noAssistant).length,
  };
  const piaHref = (i: CareItem, hash = "") => `/classes/pia/${i.studentId}?year=${year}${hash}`;
  const warnings = inClass.filter(i => i.iepWarning).length;
  const toggle = (k: typeof tab) => setTab(t => (t === k ? "all" : k));

  const stat = (value: React.ReactNode, label: string, tone: string, key?: typeof tab) => (
    <button type="button" onClick={key ? () => toggle(key) : undefined} disabled={!key}
      className={`rounded-xl p-3 text-left transition-all border-2 ${tone} ${key && tab === key ? "border-primary-500" : "border-transparent"} ${key ? "hover:brightness-95" : "cursor-default"}`}>
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs text-slate-600 dark:text-slate-300">{label}</p>
    </button>
  );

  return (
    <div className="card p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2"><HeartHandshake className="w-5 h-5 text-blue-500" /> Kujdes i veçantë</h2>
        <div className="flex flex-wrap items-center gap-2">
          <select value={cls} onChange={e => setCls(e.target.value)} className="form-input w-40 py-1.5 text-sm" aria-label="Klasa">
            <option value="">Klasa: Të gjitha</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          {data.canEdit && <button type="button" onClick={onAssign} className="btn-secondary text-sm"><Plus className="w-4 h-4" /> Cakto asistent</button>}
          {data.canEdit && <button type="button" onClick={() => setEditing("new")} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Shto nxënës</button>}
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
        {stat(counts.assistant, "Me asistent", "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300", "assistant")}
        {stat(counts.needs, "Nevoja të veçanta", "bg-violet-50 dark:bg-violet-900/20 text-violet-700 dark:text-violet-300", "needs")}
        {stat(<>{counts.pia} <span className="text-base font-semibold opacity-70">/ {counts.pei}</span></>, "PIA / PEI", "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300")}
        {stat(counts.noAssistant, "Pa asistent të caktuar", "bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300", "noAssistant")}
      </div>
      {warnings > 0 && (
        <p className="text-xs text-orange-600 flex items-center gap-1"><AlertTriangle className="w-3.5 h-3.5" /> {warnings} PEI me rishikim të kaluar ose brenda 7 ditëve</p>
      )}

      <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-full sm:w-fit overflow-x-auto">
        {([["all", "Të gjithë"], ["assistant", "Me asistent"], ["needs", "Nevoja të veçanta"], ["noAssistant", "Pa asistent"]] as const).map(([k, l]) => (
          <button key={k} type="button" onClick={() => setTab(k)}
            className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap ${tab === k ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"}`}>
            {l}
          </button>
        ))}
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[880px]">
          <thead>
            <tr className="text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700">
              <th className="text-left font-semibold py-2 px-3">Nxënësi</th>
              <th className="text-left font-semibold py-2 px-2">Klasa</th>
              <th className="text-left font-semibold py-2 px-2">Lloji</th>
              <th className="text-left font-semibold py-2 px-2">Plani</th>
              <th className="text-left font-semibold py-2 px-2">Evidencat</th>
              <th className="text-left font-semibold py-2 px-2">Asistenti</th>
              <th className="text-left font-semibold py-2 px-2">Shënim</th>
              <th className="py-2 px-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
            {rows.length === 0 && <tr><td colSpan={8} className="py-6 text-center text-xs text-slate-400">Asnjë nxënës në këtë listë.</td></tr>}
            {rows.map(i => (
              <tr key={i.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-100 whitespace-nowrap">{i.studentName}</td>
                <td className="py-2.5 px-2 text-slate-600 dark:text-slate-300">{i.className ?? "—"}</td>
                <td className="py-2.5 px-2"><div className="flex flex-wrap gap-1">{typeTags(i)}</div></td>
                <td className="py-2.5 px-2">
                  <div className="flex flex-wrap gap-1">
                    <Link href={piaHref(i)} title={i.hasPia ? "Hap PIA" : "Krijo PIA"}
                      className={`text-[10px] font-semibold px-1.5 py-0.5 rounded flex items-center gap-0.5 ${i.hasPia ? "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" : "bg-slate-100 text-slate-400 dark:bg-slate-800"}`}>
                      <ClipboardList className="w-3 h-3" /> PIA{!i.hasPia && " +"}
                    </Link>
                    {i.iep && (
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${i.iepWarning ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300"}`}
                        title={i.iepReviewDate ? `Rishikim: ${formatDate(i.iepReviewDate)}` : undefined}>PEI</span>
                    )}
                  </div>
                </td>
                <td className="py-2.5 px-2">
                  <Link href={piaHref(i, "#evidencat")} title="Testet, materialet dhe punimet e nxënësit"
                    className={`inline-flex items-center gap-1 text-xs ${i.evidenceCount ? "text-primary-600 font-semibold" : "text-slate-400 hover:text-primary-600"}`}>
                    <Paperclip className="w-3.5 h-3.5" /> {i.evidenceCount ? i.evidenceCount : "Ngarko"}
                  </Link>
                </td>
                <td className="py-2.5 px-2 whitespace-nowrap">
                  {i.assistant
                    ? <span className="text-slate-700 dark:text-slate-200">{i.assistant.name}{i.assistant.personal && <span className="text-[10px] text-slate-400"> · personale</span>}</span>
                    : i.hasAssistant ? <span className="text-orange-600 font-medium">Pa caktuar</span> : <span className="text-slate-300">—</span>}
                </td>
                <td className="py-2.5 px-2 text-xs text-slate-500 max-w-[200px] truncate" title={i.note ?? undefined}>{i.note || ""}</td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center justify-end gap-1">
                    {data.canEdit && (
                      <button type="button" onClick={() => setEditing(i)} title="Ndrysho" aria-label={`Ndrysho kujdesin e veçantë për ${i.studentName}`}
                        className="p-1.5 rounded text-slate-400 hover:text-primary-600 hover:bg-slate-100 dark:hover:bg-slate-700"><Pencil className="w-3.5 h-3.5" /></button>
                    )}
                    <Link href={`/students/${i.studentId}`} className="btn-secondary text-xs py-1 px-2.5 whitespace-nowrap">Hap profilin</Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <SpecialCareForm item={editing === "new" ? null : editing} onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); onChanged(); }} />
      )}
    </div>
  );
}
