"use client";

import { useState } from "react";
import { GraduationCap, ChevronUp, ChevronDown, ClipboardPaste, Trash2, X, Save, Loader2 } from "lucide-react";
import type { YearType } from "@/lib/academicYear";

export interface GradeNineLeaverRow {
  id: number;
  fullName: string;
  className: string | null;
  createdAt: string;
}

interface Props {
  data: { count: number; entries: GradeNineLeaverRow[] };
  period: string;
  year: number;
  yearType: YearType;
  onChanged: () => void;
}

const PREVIEW_LIMIT = 6;

// Listë krejt manuale (pa lidhje me Student) — këta nxënës "u diplomuan"/u
// larguan nga Klasa 9 dhe s'janë më (ose s'kanë qenë kurrë) të regjistruar në
// sistem, ndaj s'ka kuptim "gjetja"/përputhja e emrave si te kartat e tjera —
// vetëm emër + klasë, të shtuar direkt si listë.
export default function GradeNineLeaversCard({ data, period, year, yearType, onChanged }: Props) {
  const [show, setShow] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const visible = showAll ? data.entries : data.entries.slice(0, PREVIEW_LIMIT);

  async function deleteOne(entry: GradeNineLeaverRow) {
    if (!confirm(`T'a heq ${entry.fullName} nga lista "Klasa e 9"?`)) return;
    setDeletingId(entry.id);
    await fetch(`/api/movements/grade9-leavers/${entry.id}`, { method: "DELETE" });
    setDeletingId(null);
    onChanged();
  }

  return (
    <div className="card overflow-hidden">
      <button
        onClick={() => setShow(v => !v)}
        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-900/30 flex items-center justify-center shrink-0">
            <GraduationCap className="w-4 h-4 text-purple-600 dark:text-purple-400" />
          </div>
          <div className="text-left">
            <span className="flex items-center gap-2 text-slate-800 dark:text-slate-100 font-semibold text-sm">
              Klasa e 9 — Shkuarje
              <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-400">{data.count}</span>
            </span>
            <p className="text-xs text-slate-400 font-normal">U larguan gjatë {period} (listë manuale)</p>
          </div>
        </div>
        {show ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {show && (
        <div className="border-t border-slate-100 dark:border-slate-700 p-4 pt-3">
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setShowAdd(true)}
              className="text-xs font-medium text-primary-600 border border-primary-200 dark:border-primary-800 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded-lg px-2.5 py-1.5 flex items-center gap-1"
            >
              <ClipboardPaste className="w-3.5 h-3.5" /> Shto Listë
            </button>
          </div>

          {data.count === 0 ? (
            <p className="text-sm text-slate-400 py-6 text-center">Asnjë nxënës i shtuar ende për këtë periudhë.</p>
          ) : (
            <div className="space-y-0.5">
              {visible.map(e => (
                <div key={e.id} className="flex items-center gap-2 px-2 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800/60">
                  <span className="min-w-0 flex-1 text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{e.fullName}</span>
                  <span className="text-xs text-slate-500 dark:text-slate-400 shrink-0">{e.className ?? "—"}</span>
                  <button
                    onClick={() => deleteOne(e)}
                    disabled={deletingId === e.id}
                    title="Fshi"
                    className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0"
                  >
                    {deletingId === e.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                  </button>
                </div>
              ))}
            </div>
          )}

          {data.entries.length > PREVIEW_LIMIT && (
            <button
              onClick={() => setShowAll(v => !v)}
              className="w-full mt-2 text-xs font-medium text-primary-600 hover:underline py-1.5"
            >
              {showAll ? "Shiko më pak" : `Shiko të gjitha (${data.entries.length})`}
            </button>
          )}
        </div>
      )}

      {showAdd && (
        <AddGradeNineModal
          year={year}
          yearType={yearType}
          onClose={() => setShowAdd(false)}
          onSaved={() => { setShowAdd(false); onChanged(); }}
        />
      )}
    </div>
  );
}

function parseLine(raw: string): { fullName: string; className?: string } | null {
  const line = raw.trim();
  if (!line) return null;
  let parts: string[];
  if (line.includes("\t")) parts = line.split("\t");
  else if (line.includes(",")) parts = line.split(",");
  else parts = [line];
  parts = parts.map(p => p.trim()).filter(p => p !== "");
  if (parts.length === 0) return null;
  if (parts.length === 1) return { fullName: parts[0] };
  return { fullName: parts[0], className: parts[1] };
}

function AddGradeNineModal({ year, yearType, onClose, onSaved }: {
  year: number; yearType: YearType; onClose: () => void; onSaved: () => void;
}) {
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    const entries = text.split("\n").map(parseLine).filter((l): l is { fullName: string; className?: string } => l !== null);
    if (entries.length === 0) { setError("Shkruani ose ngjitni së paku një emër."); return; }
    setSaving(true);
    setError("");
    const r = await fetch("/api/movements/grade9-leavers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ year, yearType, entries }),
    });
    setSaving(false);
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || "Dështoi."); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Shto Listë — Klasa e 9</h3>
            <p className="text-xs text-slate-400 mt-0.5">Emri Mbiemri, opsionalisht klasa ndarë me presje ose Tab (p.sh. "Filan Fisteku, 9A") — një nxënës për rresht.</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-3">
          <textarea
            className="form-input font-mono text-xs"
            rows={10}
            placeholder={"Filan Fisteku\t9A\nFilane Fistekaj\t9B\n..."}
            value={text}
            onChange={e => setText(e.target.value)}
            autoFocus
          />
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex gap-2 p-5 pt-0">
          <button onClick={onClose} className="btn-secondary"><X className="w-4 h-4" />Anulo</button>
          <button onClick={handleSave} disabled={saving || !text.trim()} className="btn-primary flex-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Duke ruajtur..." : "Ruaj Listën"}
          </button>
        </div>
      </div>
    </div>
  );
}
