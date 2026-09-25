"use client";

import { useEffect, useState } from "react";
import { X, Save, Search, StickyNote, Send } from "lucide-react";
import { STUDENT_RATINGS } from "@/lib/studentRatings";
import { formatDateTime } from "@/lib/utils";

interface StudentNoteRow {
  id: number;
  content: string;
  createdAt: string;
  author: { name: string } | null;
}

interface PickedStudent {
  id: number;
  firstName: string;
  lastName: string;
}

interface StudentSuggestion {
  id: number;
  firstName: string;
  lastName: string;
  class?: { name: string } | null;
}

interface Props {
  // Kur jepet — modali hapet direkt për këtë nxënës (modaliteti "Edito"), pa kërkim.
  // Kur mungon — modali fillon me kërkim me autocomplete (modaliteti "Shto").
  preselected?: {
    id: number;
    firstName: string;
    lastName: string;
    originCountry?: string | null;
    previousSchool?: string | null;
    transferResult?: string | null;
    admissionScore?: number | null;
    studentRating?: string | null;
  } | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function StudentEnrichmentModal({ preselected, onClose, onSaved }: Props) {
  const [student, setStudent] = useState<PickedStudent | null>(preselected ?? null);

  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<StudentSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  // Vetëm në modalitetin "Shto" (jo Edito) — data që e bën këtë nxënës EKZISTUES
  // të shfaqet te "Nxënës të Rinj" për periudhën aktuale. Parazgjedhje: sot.
  const [enrollDate, setEnrollDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [originCountry, setOriginCountry] = useState(preselected?.originCountry ?? "");
  const [previousSchool, setPreviousSchool] = useState(preselected?.previousSchool ?? "");
  const [transferResult, setTransferResult] = useState(preselected?.transferResult ?? "");
  const [admissionScore, setAdmissionScore] = useState(preselected?.admissionScore != null ? String(preselected.admissionScore) : "");
  const [studentRating, setStudentRating] = useState(preselected?.studentRating ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Historik/shënime manuale (StudentNote) — ditar i thjeshtë, vetëm-shtim.
  const [notes, setNotes] = useState<StudentNoteRow[]>([]);
  const [newNote, setNewNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    if (!student) return;
    fetch(`/api/students/${student.id}/notes`).then(r => r.json()).then(d => setNotes(Array.isArray(d) ? d : []));
  }, [student]);

  async function handleAddNote() {
    if (!student || !newNote.trim()) return;
    setAddingNote(true);
    const r = await fetch(`/api/students/${student.id}/notes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: newNote.trim() }),
    });
    if (r.ok) {
      const created = await r.json();
      setNotes(prev => [created, ...prev]);
      setNewNote("");
    }
    setAddingNote(false);
  }

  // Kërkim me autocomplete — i njëjti model si te TimiInvestModal.tsx (debounce
  // 300ms + /api/students?search=...&status=ACTIVE), për të lidhur me një
  // nxënës EKZISTUES — kurrë s'krijon nxënës të ri këtu.
  useEffect(() => {
    if (student || search.length < 2) { setSuggestions([]); setShowSuggestions(false); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/students?search=${encodeURIComponent(search)}&status=ACTIVE&limit=8`);
        if (r.ok) {
          const data = await r.json();
          setSuggestions(data.students || []);
          setShowSuggestions(true);
        }
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [search, student]);

  function pickStudent(s: StudentSuggestion) {
    setStudent({ id: s.id, firstName: s.firstName, lastName: s.lastName });
    setShowSuggestions(false);
  }

  async function handleSave() {
    if (!student) return;
    setSaving(true);
    setError("");
    try {
      const r = await fetch(`/api/students/${student.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          originCountry: originCountry || null,
          previousSchool: previousSchool || null,
          transferResult: transferResult || null,
          admissionScore: admissionScore === "" ? null : Number(admissionScore),
          studentRating: studentRating || null,
          // Vetëm në "Shto" (jo Edito) — kjo është vetë veprimi që e bën nxënësin
          // EKZISTUES të shfaqet te "Nxënës të Rinj" për periudhën e zgjedhur.
          // Asnjë nxënës i ri s'krijohet — vetëm data e atij ekzistues përditësohet.
          ...(preselected ? {} : { enrollDate }),
        }),
      });
      const d = await r.json().catch(() => ({}));
      setSaving(false);
      if (!r.ok) { setError(d.message || `Ruajtja dështoi (gabim ${r.status})`); return; }
      onSaved();
    } catch {
      setSaving(false);
      setError("Gabim rrjeti — provo përsëri.");
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in overflow-y-auto max-h-[92vh]" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">
              {preselected ? "Edito Detajet e Regjistrimit" : "Shto Detaje Regjistrimi"}
            </h3>
            {student && (
              <p className="text-sm text-slate-400 mt-0.5">{student.firstName} {student.lastName}</p>
            )}
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {!student && (
            <div className="relative">
              <label className="form-label">Kërko Nxënësin <span className="text-red-500">*</span></label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
                <input
                  className="form-input pl-9"
                  placeholder="Shkruaj emrin e nxënësit..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  onFocus={() => suggestions.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  autoComplete="off"
                />
              </div>
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute z-20 top-full left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl mt-1 overflow-hidden">
                  {suggestions.map(s => (
                    <button key={s.id} type="button"
                      onMouseDown={() => pickStudent(s)}
                      className="w-full text-left px-4 py-2.5 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-sm transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0 flex items-center justify-between gap-3">
                      <span className="font-semibold text-slate-800 dark:text-slate-100">{s.firstName} {s.lastName}</span>
                      {s.class && <span className="text-slate-400 text-xs">{s.class.name}</span>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {student && (
            <>
              <div>
                <label className="form-label">Vendi i Origjinës</label>
                <input className="form-input" placeholder="p.sh. Kosovë" value={originCountry} onChange={e => setOriginCountry(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Shkolla Paraardhëse</label>
                <input className="form-input" placeholder="Emri i shkollës nga ka ardhur" value={previousSchool} onChange={e => setPreviousSchool(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Suksesi i Fletëkalimit</label>
                <input className="form-input" placeholder='p.sh. "Mesatarja 4.8" ose "Kaluar me sukses"' value={transferResult} onChange={e => setTransferResult(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Pikët e Testit</label>
                  <input type="number" className="form-input" placeholder="0" min="0" step="0.1"
                    value={admissionScore} onChange={e => setAdmissionScore(e.target.value)} />
                </div>
                <div>
                  <label className="form-label">Vlerësimi</label>
                  <select className="form-input" value={studentRating} onChange={e => setStudentRating(e.target.value)}>
                    <option value="">— Pa zgjedhur —</option>
                    {STUDENT_RATINGS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              {/* Historik/Shënime — ditar manual, vetëm-shtim */}
              <div className="pt-1">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                  <StickyNote className="w-3.5 h-3.5" />
                  Historik &amp; Shënime
                </p>
                <div className="flex gap-2">
                  <input
                    className="form-input flex-1"
                    placeholder="Shto një shënim (progres, sjellje, komunikim me prindër...)"
                    value={newNote}
                    onChange={e => setNewNote(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleAddNote()}
                  />
                  <button type="button" onClick={handleAddNote} disabled={!newNote.trim() || addingNote}
                    className="btn-secondary px-3" title="Shto shënim">
                    <Send className="w-4 h-4" />
                  </button>
                </div>
                {notes.length > 0 && (
                  <div className="mt-3 max-h-40 overflow-y-auto space-y-2 pr-1">
                    {notes.map(n => (
                      <div key={n.id} className="text-sm bg-slate-50 dark:bg-slate-900/40 rounded-lg px-3 py-2">
                        <p className="text-slate-700 dark:text-slate-200">{n.content}</p>
                        <p className="text-[11px] text-slate-400 mt-1">
                          {n.author?.name ?? "—"} · {formatDateTime(n.createdAt)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {error && <p className="text-sm text-red-500 px-5">{error}</p>}
        <div className="flex gap-2 p-5 pt-2">
          <button onClick={onClose} className="btn-secondary"><X className="w-4 h-4" />Anulo</button>
          <button onClick={handleSave} disabled={!student || saving} className="btn-primary flex-1">
            <Save className="w-4 h-4" />
            {saving ? "Duke ruajtur..." : "Ruaj"}
          </button>
        </div>
      </div>
    </div>
  );
}
