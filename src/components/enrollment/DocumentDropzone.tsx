"use client";

import { useRef, useState } from "react";
import { FileText, Image as ImageIcon, Upload, X, CheckCircle, Loader2 } from "lucide-react";
import { formatFileSize } from "@/lib/utils";
import type { UploadedDoc } from "./types";

interface Props {
  applicationId: number | null;
  resumeToken: string | null;
  docType: string;
  label: string;
  required: boolean;
  multiple?: boolean;
  docs: UploadedDoc[]; // vetëm dokumentet e këtij docType
  onChanged: (docs: UploadedDoc[]) => void;
  onExpired: () => void; // aplikimi/token-i s'ekziston më (403) — sesioni ka humbur, jo gabim rrjeti
}

function iconFor(contentType: string) {
  return contentType.startsWith("image/") ? ImageIcon : FileText;
}

export default function DocumentDropzone({ applicationId, resumeToken, docType, label, required, multiple, docs, onChanged, onExpired }: Props) {
  const [dragOver, setDragOver] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    if (!applicationId || !resumeToken) return;
    setError("");
    setUploading(true);
    const form = new FormData();
    form.append("resumeToken", resumeToken);
    form.append("docType", docType);
    form.append("file", file);
    try {
      const r = await fetch(`/api/public/enrollment/applications/${applicationId}/documents`, { method: "POST", body: form });
      if (r.status === 403) { onExpired(); return; }
      const data = await r.json();
      if (!r.ok) {
        setError(data.message || "Ngarkimi dështoi.");
      } else {
        onChanged(multiple ? [...docs, data] : [data]);
      }
    } catch {
      setError("Ngarkimi dështoi — kontrollo lidhjen e internetit.");
    }
    setUploading(false);
  }

  async function handleDelete(docId: number) {
    if (!applicationId || !resumeToken) return;
    await fetch(`/api/public/enrollment/applications/${applicationId}/documents/${docId}?token=${encodeURIComponent(resumeToken)}`, { method: "DELETE" });
    onChanged(docs.filter(d => d.id !== docId));
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) upload(file);
  }

  const showDropzone = multiple || docs.length === 0;

  return (
    <div>
      <label className="form-label">{label}{required && <span className="text-red-500"> *</span>}</label>

      {docs.map(doc => {
        const Icon = iconFor(doc.contentType);
        return (
          <div key={doc.id} className="flex items-center gap-3 p-3 mb-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
            <div className="w-9 h-9 rounded-lg bg-green-50 dark:bg-green-900/30 flex items-center justify-center shrink-0">
              <Icon className="w-4 h-4 text-green-600 dark:text-green-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{doc.originalName}</p>
              <p className="text-xs text-slate-400 flex items-center gap-1.5">
                <CheckCircle className="w-3 h-3 text-green-500" /> Ngarkuar · {formatFileSize(doc.size)}
              </p>
            </div>
            <button type="button" onClick={() => handleDelete(doc.id)} title="Fshi" className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        );
      })}

      {showDropzone && (
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          onClick={() => inputRef.current?.click()}
          className={`flex flex-col items-center justify-center gap-1.5 p-5 rounded-xl border-2 border-dashed cursor-pointer transition-colors text-center ${
            dragOver ? "border-primary-400 bg-primary-50 dark:bg-primary-900/20" : "border-slate-200 dark:border-slate-700 hover:border-primary-300"
          }`}
        >
          {uploading ? (
            <Loader2 className="w-5 h-5 text-primary-500 animate-spin" />
          ) : (
            <Upload className="w-5 h-5 text-slate-300" />
          )}
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Tërhiqe skedarin këtu, ose <span className="text-primary-600 font-medium">Ngarko Dokument</span>
          </p>
          <p className="text-[11px] text-slate-300">PDF, JPEG, PNG ose WebP — deri 10MB</p>
          <input
            ref={inputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }}
          />
        </div>
      )}
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  );
}
