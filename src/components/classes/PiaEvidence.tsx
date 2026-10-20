"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Upload, FileText, Image as ImageIcon, Download, Trash2, Loader2, Paperclip } from "lucide-react";
import { formatDate } from "@/lib/utils";

// Evidencat e PIA-s: materiale, teste dhe punime të nxënësit, të ngarkuara si
// skedarë — mbeten si histori e ecurisë (fshirja vetëm i fsheh).

interface PiaFileRow {
  id: number; date: string; category: string; title: string; goal: string | null; note: string | null;
  originalFileName: string; mimeType: string; size: number; uploadedByName: string | null;
}

const CATS: { key: string; label: string; cls: string }[] = [
  { key: "TEST", label: "Test", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  { key: "PUNIM", label: "Punim i nxënësit", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300" },
  { key: "MATERIAL", label: "Material pune", cls: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  { key: "RAPORT", label: "Raport", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  { key: "TJETER", label: "Tjetër", cls: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
];
const catOf = (k: string) => CATS.find(c => c.key === k) ?? CATS[CATS.length - 1];
const today = () => new Date().toISOString().slice(0, 10);
const kb = (n: number) => (n > 1024 * 1024 ? `${(n / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`);

export default function PiaEvidence({ studentId, year, canEdit }: { studentId: string; year: number; canEdit: boolean }) {
  const [files, setFiles] = useState<PiaFileRow[] | null>(null);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<File[]>([]);
  const [category, setCategory] = useState("TEST");
  const [date, setDate] = useState(today());
  const [title, setTitle] = useState("");
  const [goal, setGoal] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState("");
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/pia/${studentId}/files?year=${year}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || "S'u lexuan evidencat."); return; }
    setFiles(d.files); setError("");
  }, [studentId, year]);
  useEffect(() => { load(); }, [load]);

  async function upload() {
    if (!picked.length) return;
    setBusy(true); setError("");
    const fd = new FormData();
    picked.forEach(f => fd.append("file", f));
    fd.append("category", category); fd.append("date", date); fd.append("title", title); fd.append("goal", goal); fd.append("note", note);
    const r = await fetch(`/api/pia/${studentId}/files?year=${year}`, { method: "POST", body: fd });
    const d = await r.json().catch(() => ({}));
    setBusy(false);
    if (!r.ok) { setError(d.error || "Ngarkimi dështoi."); if (d.saved) load(); return; }
    setPicked([]); setTitle(""); setNote(""); setGoal("");
    if (input.current) input.current.value = "";
    load();
  }

  async function hide(f: PiaFileRow) {
    if (!confirm(`Hiq "${f.title}" nga lista? (Skedari ruhet në server si histori.)`)) return;
    const r = await fetch(`/api/pia/files/${f.id}`, { method: "DELETE" });
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "S'u hoq."); return; }
    load();
  }

  const shown = (files ?? []).filter(f => !filter || f.category === filter || f.goal === filter);

  return (
    <div className="card p-5 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="font-bold text-slate-800 dark:text-white flex items-center gap-2"><Paperclip className="w-4 h-4 text-amber-500" /> Evidencat — materiale, teste dhe punime</h2>
        {files && files.length > 0 && (
          <select value={filter} onChange={e => setFilter(e.target.value)} className="form-input w-44 py-1 text-sm">
            <option value="">Të gjitha ({files.length})</option>
            {CATS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
            {["R1", "R2", "R3", "R4"].map(g => <option key={g} value={g}>Rezultati {g}</option>)}
          </select>
        )}
      </div>

      {canEdit && (
        <div className="rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 p-4 space-y-3">
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={e => { e.preventDefault(); setDrag(false); setPicked(Array.from(e.dataTransfer.files)); }}
            onClick={() => input.current?.click()}
            className={`rounded-lg p-4 text-center cursor-pointer transition-colors ${drag ? "bg-primary-50 dark:bg-primary-900/20" : "hover:bg-slate-50 dark:hover:bg-slate-800/40"}`}>
            <Upload className="w-6 h-6 mx-auto text-slate-400" />
            <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
              {picked.length ? picked.map(f => f.name).join(", ") : "Tërhiq skedarët këtu ose kliko për t'i zgjedhur"}
            </p>
            <p className="text-xs text-slate-400">Foto, PDF ose Word · deri 25MB secili · mund të zgjedhësh disa njëherësh</p>
            <input ref={input} type="file" multiple accept="image/jpeg,image/png,image/webp,application/pdf,.doc,.docx" className="hidden"
              onChange={e => setPicked(Array.from(e.target.files ?? []))} />
          </div>
          {picked.length > 0 && (
            <>
              <div className="grid sm:grid-cols-4 gap-2">
                <div><label className="label">Lloji</label>
                  <select className="input" value={category} onChange={e => setCategory(e.target.value)}>{CATS.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}</select></div>
                <div><label className="label">Data</label><input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} /></div>
                <div><label className="label">Rezultati (opsional)</label>
                  <select className="input" value={goal} onChange={e => setGoal(e.target.value)}><option value="">—</option>{["R1", "R2", "R3", "R4"].map(g => <option key={g}>{g}</option>)}</select></div>
                <div><label className="label">Titulli (opsional)</label><input className="input" placeholder="p.sh. Test leximi" value={title} onChange={e => setTitle(e.target.value)} /></div>
              </div>
              <div><label className="label">Shënim (opsional)</label><input className="input" placeholder="p.sh. e kreu pa ndihmë, 8/10 pikë" value={note} onChange={e => setNote(e.target.value)} /></div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => { setPicked([]); if (input.current) input.current.value = ""; }} className="btn-secondary">Anulo</button>
                <button type="button" onClick={upload} disabled={busy} className="btn-primary">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Ngarko {picked.length > 1 ? `(${picked.length})` : ""}
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {error && <p className="text-sm text-red-600">{error}</p>}
      {files === null ? <Loader2 className="w-5 h-5 animate-spin text-slate-400" /> : shown.length === 0 ? (
        <p className="text-sm text-slate-400">{files.length ? "Asnjë evidencë me këtë filtër." : "Ende s'ka evidenca për këtë vit."}</p>
      ) : (
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {shown.map(f => {
            const c = catOf(f.category);
            const url = `/api/pia/files/${f.id}`;
            return (
              <li key={f.id} className="py-2.5 flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0">
                  {f.mimeType.startsWith("image/") ? <ImageIcon className="w-4 h-4 text-slate-500" /> : <FileText className="w-4 h-4 text-slate-500" />}
                </div>
                <div className="flex-1 min-w-0">
                  <a href={url} target="_blank" rel="noopener" className="text-sm font-medium text-slate-800 dark:text-slate-100 hover:text-primary-600 break-words">{f.title}</a>
                  <div className="flex flex-wrap items-center gap-1.5 mt-0.5 text-xs text-slate-400">
                    <span className={`px-1.5 py-0.5 rounded font-semibold ${c.cls}`}>{c.label}</span>
                    {f.goal && <span className="px-1.5 py-0.5 rounded font-semibold bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">{f.goal}</span>}
                    <span>{formatDate(f.date)}</span><span>· {kb(f.size)}</span>{f.uploadedByName && <span>· {f.uploadedByName}</span>}
                  </div>
                  {f.note && <p className="text-xs text-slate-500 mt-0.5">{f.note}</p>}
                </div>
                <a href={`${url}?download=1`} title="Shkarko" className="p-1.5 rounded text-slate-400 hover:text-primary-600"><Download className="w-4 h-4" /></a>
                {canEdit && <button type="button" onClick={() => hide(f)} title="Hiq nga lista" className="p-1.5 rounded text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
