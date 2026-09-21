"use client";

import { useEffect, useState } from "react";
import { X, Save, Search } from "lucide-react";

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
  // Kur jepet — nxënës TASHMË joaktiv, vetëm edito arsyen/shkollën (pa ndryshim statusi).
  // Kur mungon — kërkim me autocomplete mes nxënësve AKTIVË, dhe ruajtja e shënon
  // vetë nxënësin si Joaktiv (shih handleSave).
  preselected?: {
    id: number;
    firstName: string;
    lastName: string;
    leaveReason?: string | null;
    destinationSchool?: string | null;
  } | null;
  onClose: () => void;
  onSaved: () => void;
}

export default function DepartedStudentModal({ preselected, onClose, onSaved }: Props) {
  const isNewDeparture = !preselected;
  const [student, setStudent] = useState<PickedStudent | null>(preselected ?? null);

  const [search, setSearch] = useState("");
  const [suggestions, setSuggestions] = useState<StudentSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [leaveReason, setLeaveReason] = useState(preselected?.leaveReason ?? "");
  const [destinationSchool, setDestinationSchool] = useState(preselected?.destinationSchool ?? "");
  const [saving, setSaving] = useState(false);

  // Kërkim vetëm mes nxënësve AKTIVË — s'ka kuptim të "largosh" dikë që tashmë
  // është joaktiv. I njëjti model debounce si StudentEnrichmentModal.tsx.
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
    await fetch(`/api/students/${student.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...(isNewDeparture ? { status: "INACTIVE" } : {}),
        leaveReason: leaveReason || null,
        destinationSchool: destinationSchool || null,
      }),
    });
    setSaving(false);
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">
              {isNewDeparture ? "Shëno Nxënës si Larguar" : "Arsyeja e Largimit"}
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
                      className="w-full text-left px-4 py-2.5 hover:bg-red-50 dark:hover:bg-red-900/20 text-sm transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0 flex items-center justify-between gap-3">
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
              {isNewDeparture && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 rounded-lg px-3 py-2">
                  Ky nxënës do të shënohet si <strong>Joaktiv</strong> kur ta ruash.
                </p>
              )}
              <div>
                <label className="form-label">Arsyeja e Largimit</label>
                <textarea
                  className="form-input"
                  rows={3}
                  placeholder="p.sh. Transferim i familjes, ndryshim vendbanimi..."
                  value={leaveReason}
                  onChange={e => setLeaveReason(e.target.value)}
                />
              </div>
              <div>
                <label className="form-label">Shkolla ku Kaloi</label>
                <input
                  className="form-input"
                  placeholder="Emri i shkollës së re"
                  value={destinationSchool}
                  onChange={e => setDestinationSchool(e.target.value)}
                />
              </div>
            </>
          )}
        </div>

        <div className="flex gap-2 p-5 pt-0">
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
