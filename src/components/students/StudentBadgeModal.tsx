"use client";

import { useState } from "react";
import { X, Upload, Printer, Loader2 } from "lucide-react";
import { PERIOD_BUCKETS } from "@/lib/food-periods";
import { BADGE_CSS, buildBadgeCardHTML } from "@/lib/badge-html";

interface Props {
  student: { id: number; firstName: string; lastName: string; class: { name: string } | null };
  onClose: () => void;
}

export default function StudentBadgeModal({ student, onClose }: Props) {
  const [photoVersion, setPhotoVersion] = useState(() => Date.now());
  const [photoMissing, setPhotoMissing] = useState(false);
  const [uploading, setUploading]       = useState(false);
  const [error, setError]               = useState<string | null>(null);

  const className = student.class?.name || "";
  const initials  = `${student.firstName[0] ?? ""}${student.lastName[0] ?? ""}`.toUpperCase();

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    const r = await fetch(`/api/students/${student.id}/photo`, { method: "POST", body: form });
    setUploading(false);
    if (!r.ok) {
      const d = await r.json().catch(() => ({}));
      setError(d.error || "Gabim gjatë ngarkimit.");
      return;
    }
    setPhotoMissing(false);
    setPhotoVersion(Date.now());
  }

  function handlePrint() {
    const html = buildBadgeCardHTML({ id: student.id, firstName: student.firstName, lastName: student.lastName, className });
    const win = window.open("", "_blank", "width=500,height=350");
    if (!win) return;
    win.document.write(`<!DOCTYPE html><html lang="sq"><head>
<meta charset="UTF-8"/>
<title>Bexh — ${student.firstName} ${student.lastName}</title>
<style>
@page { size: 90mm 55mm landscape; margin: 0; }
* { margin:0; padding:0; box-sizing:border-box; }
html, body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
${BADGE_CSS}
</style>
</head><body>${html}
<script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body></html>`);
    win.document.close();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <h3 className="font-bold text-slate-800 dark:text-white">Bexhi i Nxënësit</h3>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-4">
          <div className="flex items-center gap-4">
            <div className="w-20 h-24 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden flex items-center justify-center flex-shrink-0">
              {photoMissing ? (
                <span className="text-2xl font-bold text-slate-300 dark:text-slate-600">{initials}</span>
              ) : (
                <img
                  src={`/api/students/${student.id}/photo?v=${photoVersion}`}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => setPhotoMissing(true)}
                />
              )}
            </div>
            <div className="flex-1">
              <p className="font-bold text-slate-800 dark:text-white">{student.firstName} {student.lastName}</p>
              <p className="text-sm text-slate-400 mt-0.5">Klasa: {className || "—"}</p>
              <label className="btn-secondary text-xs mt-3 cursor-pointer inline-flex">
                {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                {uploading ? "Duke ngarkuar..." : "Ngarko foto"}
                <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleFileChange} disabled={uploading} />
              </label>
              {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
            </div>
          </div>

          <div className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2">Periudhat e Ushqimit</p>
            <div className="grid grid-cols-2 gap-2">
              {PERIOD_BUCKETS.map(p => (
                <div key={p.label} className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                  <span className="w-4 h-4 border-2 border-slate-300 dark:border-slate-600 rounded-sm flex-shrink-0" />
                  {p.label}
                </div>
              ))}
            </div>
            <p className="text-xs text-slate-400 mt-3">Kutitë vulosen me dorë kur nxënësi paguan çdo periudhë.</p>
          </div>
        </div>

        <div className="flex gap-2 p-5 pt-0">
          <button onClick={onClose} className="btn-secondary">Mbyll</button>
          <button onClick={handlePrint} className="btn-primary flex-1 justify-center">
            <Printer className="w-4 h-4" />
            Printo këtë bexh
          </button>
        </div>
      </div>
    </div>
  );
}
