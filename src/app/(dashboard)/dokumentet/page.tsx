"use client";

import { useCallback, useEffect, useState } from "react";
import Header from "@/components/layout/Header";
import { formatDate, formatFileSize } from "@/lib/utils";
import {
  Paperclip, Plus, Download, Send, Trash2, FileText, Image as ImageIcon,
  FileType2, X, Search, GraduationCap, Loader2, Check,
} from "lucide-react";

interface DocRow {
  id: number; title: string; description: string | null; category: string | null;
  originalFileName: string; mimeType: string; size: number; createdAt: string;
  uploadedBy: { name: string };
}
interface ClassOpt { id: number; name: string; level: string }
interface StudentOpt {
  id: number; firstName: string; lastName: string;
  motherEmail: string | null; fatherEmail: string | null;
  class: { name: string } | null;
}
interface Recipient { email: string; name: string; studentId?: number }

function docIcon(mimeType: string) {
  if (mimeType.startsWith("image/")) return ImageIcon;
  if (mimeType === "application/pdf") return FileText;
  return FileType2;
}

export default function DokumentetPage() {
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [sendDoc, setSendDoc] = useState<DocRow | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/documents");
    setDocs(await r.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleDelete(doc: DocRow) {
    if (!confirm(`T'a fshij dokumentin "${doc.title}"? Ky veprim s'kthehet mbrapa.`)) return;
    await fetch(`/api/documents/${doc.id}`, { method: "DELETE" });
    load();
  }

  const categories = Array.from(new Set(docs.map(d => d.category).filter((c): c is string => !!c))).sort();
  const filtered = categoryFilter ? docs.filter(d => d.category === categoryFilter) : docs;

  return (
    <>
      <Header title="Dokumentet" />
      <div className="p-4 sm:p-6 space-y-5 animate-fade-in">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Paperclip className="w-5 h-5 text-primary-500" /> Dokumentet
            </h1>
            <p className="text-sm text-slate-400 mt-0.5">Katalogë, broshura, rregullore dhe dokumente të tjera të shkollës — të ngarkueshme dhe të dërgueshme me email</p>
          </div>
          <button onClick={() => setUploadOpen(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Ngarko Dokument
          </button>
        </div>

        {categories.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setCategoryFilter("")} className={`text-xs px-2.5 py-1 rounded-full border ${!categoryFilter ? "bg-primary-600 text-white border-primary-600" : "border-slate-200 dark:border-slate-600 text-slate-500"}`}>
              Të gjitha
            </button>
            {categories.map(c => (
              <button key={c} onClick={() => setCategoryFilter(c)} className={`text-xs px-2.5 py-1 rounded-full border ${categoryFilter === c ? "bg-primary-600 text-white border-primary-600" : "border-slate-200 dark:border-slate-600 text-slate-500"}`}>
                {c}
              </button>
            ))}
          </div>
        )}

        <div className="card overflow-hidden">
          {loading ? (
            <p className="text-center text-slate-400 py-10 text-sm">Duke ngarkuar...</p>
          ) : filtered.length === 0 ? (
            <p className="text-center text-slate-400 py-10 text-sm">Asnjë dokument ende.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {filtered.map(d => {
                const Icon = docIcon(d.mimeType);
                return (
                  <div key={d.id} className="flex items-center justify-between gap-3 p-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-10 h-10 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center shrink-0">
                        <Icon className="w-5 h-5 text-primary-500" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{d.title}</p>
                        <p className="text-xs text-slate-400">
                          {d.category && <span>{d.category} · </span>}
                          {formatFileSize(d.size)} · {formatDate(d.createdAt)} · {d.uploadedBy.name}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <a href={`/api/documents/${d.id}/file`} title="Shkarko" className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20">
                        <Download className="w-4 h-4" />
                      </a>
                      <button onClick={() => setSendDoc(d)} title="Dërgo me Email" className="p-2 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20">
                        <Send className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDelete(d)} title="Fshi" className="p-2 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {uploadOpen && (
        <UploadDocumentModal categories={categories} onClose={() => setUploadOpen(false)} onSaved={() => { setUploadOpen(false); load(); }} />
      )}
      {sendDoc && (
        <SendDocumentModal doc={sendDoc} onClose={() => setSendDoc(null)} />
      )}
    </>
  );
}

function UploadDocumentModal({ categories, onClose, onSaved }: { categories: string[]; onClose: () => void; onSaved: () => void }) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (!title.trim()) { setError("Titulli është i domosdoshëm."); return; }
    if (!file) { setError("Zgjidh një skedar."); return; }
    setSaving(true); setError("");

    const form = new FormData();
    form.append("title", title.trim());
    form.append("description", description.trim());
    form.append("category", category.trim());
    form.append("file", file);

    const r = await fetch("/api/documents", { method: "POST", body: form });
    setSaving(false);
    if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.message || "Dështoi."); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white">Ngarko Dokument</h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          <div>
            <label className="form-label">Titulli <span className="text-red-500">*</span></label>
            <input className="form-input" value={title} onChange={e => setTitle(e.target.value)} placeholder='p.sh. "Katalogu i Uniformave 2026"' />
          </div>
          <div>
            <label className="form-label">Përshkrimi</label>
            <textarea className="form-input" rows={2} value={description} onChange={e => setDescription(e.target.value)} />
          </div>
          <div>
            <label className="form-label">Kategoria</label>
            <input className="form-input" list="doc-categories" value={category} onChange={e => setCategory(e.target.value)} placeholder='p.sh. "Kataloge", "Rregullore"' />
            <datalist id="doc-categories">
              {categories.map(c => <option key={c} value={c} />)}
            </datalist>
          </div>
          <div>
            <label className="form-label">Skedari <span className="text-red-500">*</span></label>
            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" className="form-input" onChange={e => setFile(e.target.files?.[0] ?? null)} />
            <p className="text-xs text-slate-400 mt-1">PDF, Word ose foto — deri 50MB.</p>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 p-5 pt-0">
          <button onClick={onClose} className="btn-secondary">Anulo</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            {saving ? "Duke ngarkuar..." : "Ngarko"}
          </button>
        </div>
      </div>
    </div>
  );
}

function studentEmails(s: StudentOpt): Recipient[] {
  const name = `${s.firstName} ${s.lastName}`;
  const out: Recipient[] = [];
  if (s.motherEmail) out.push({ email: s.motherEmail, name: `${name} (Nëna)`, studentId: s.id });
  if (s.fatherEmail) out.push({ email: s.fatherEmail, name: `${name} (Babai)`, studentId: s.id });
  return out;
}

function SendDocumentModal({ doc, onClose }: { doc: DocRow; onClose: () => void }) {
  const [mode, setMode] = useState<"class" | "individual" | "manual">("class");
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [classId, setClassId] = useState("");
  const [addingClass, setAddingClass] = useState(false);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<StudentOpt[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [manualEmail, setManualEmail] = useState("");
  const [manualName, setManualName] = useState("");

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number; errors: string[] } | null>(null);

  useEffect(() => { fetch("/api/classes").then(r => r.json()).then(setClasses); }, []);

  useEffect(() => {
    if (!query.trim()) { setResults([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/students?search=${encodeURIComponent(query)}&status=ACTIVE&limit=20`);
      const d = await r.json();
      setResults(d.students || []);
      setShowSuggestions(true);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  function addRecipients(list: Recipient[]) {
    setRecipients(prev => {
      const seen = new Set(prev.map(r => r.email.toLowerCase()));
      const additions = list.filter(r => !seen.has(r.email.toLowerCase()));
      return [...prev, ...additions];
    });
  }
  function removeRecipient(email: string) {
    setRecipients(prev => prev.filter(r => r.email !== email));
  }

  async function addWholeClass() {
    if (!classId) return;
    setAddingClass(true);
    const r = await fetch(`/api/students?classId=${classId}&status=ACTIVE&limit=500`);
    const d = await r.json();
    setAddingClass(false);
    const students: StudentOpt[] = d.students || [];
    addRecipients(students.flatMap(studentEmails));
  }

  function addManual() {
    const email = manualEmail.trim();
    if (!email) return;
    addRecipients([{ email, name: manualName.trim() || email }]);
    setManualEmail(""); setManualName("");
  }

  async function handleSend() {
    setSending(true);
    const r = await fetch(`/api/documents/${doc.id}/send`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipients, message }),
    });
    const d = await r.json();
    setSending(false);
    if (r.ok) setResult(d);
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Dërgo me Email</h3>
            <p className="text-xs text-slate-400 mt-0.5">{doc.title}</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        {result ? (
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
              <Check className="w-5 h-5" />
              <p className="text-sm font-medium">U dërgua te {result.sent} nga {result.total} marrës.</p>
            </div>
            {result.failed > 0 && (
              <p className="text-sm text-red-500">{result.failed} dështuan{result.errors.length > 0 ? `: ${result.errors.join("; ")}` : ""}</p>
            )}
            <button onClick={onClose} className="btn-primary w-full">Mbyll</button>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit">
              {([["class", "Sipas Klase"], ["individual", "Nxënës"], ["manual", "Email Direkt"]] as const).map(([key, label]) => (
                <button key={key} onClick={() => setMode(key)} className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all ${mode === key ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"}`}>
                  {label}
                </button>
              ))}
            </div>

            {mode === "class" && (
              <div className="flex gap-2">
                <select value={classId} onChange={e => setClassId(e.target.value)} className="form-input flex-1">
                  <option value="">Zgjidh klasën...</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name} — {c.level}</option>)}
                </select>
                <button onClick={addWholeClass} disabled={!classId || addingClass} className="btn-secondary text-sm shrink-0">
                  <GraduationCap className="w-4 h-4" /> Shto Klasën
                </button>
              </div>
            )}

            {mode === "individual" && (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                  onFocus={() => results.length > 0 && setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  className="form-input pl-9"
                  placeholder="Kërko nxënësin me emër..."
                />
                {showSuggestions && results.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                    {results.map(s => (
                      <button
                        key={s.id} type="button"
                        onMouseDown={() => addRecipients(studentEmails(s))}
                        disabled={studentEmails(s).length === 0}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between gap-2 disabled:opacity-40"
                      >
                        <span>{s.firstName} {s.lastName}</span>
                        <span className="text-xs text-slate-400">{s.class?.name ?? "—"}{studentEmails(s).length === 0 ? " · pa email" : ""}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {mode === "manual" && (
              <div className="flex gap-2">
                <input className="form-input flex-1" placeholder="email@shembull.com" value={manualEmail} onChange={e => setManualEmail(e.target.value)} />
                <input className="form-input flex-1" placeholder="Emri (opsional)" value={manualName} onChange={e => setManualName(e.target.value)} />
                <button onClick={addManual} disabled={!manualEmail.trim()} className="btn-secondary text-sm shrink-0"><Plus className="w-4 h-4" /></button>
              </div>
            )}

            {recipients.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {recipients.map(r => (
                  <span key={r.email} className="text-xs pl-2.5 pr-1 py-1 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 flex items-center gap-1.5">
                    {r.name} <span className="text-primary-400">({r.email})</span>
                    <button onClick={() => removeRecipient(r.email)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            )}

            <div>
              <label className="form-label">Mesazhi (opsional)</label>
              <textarea className="form-input" rows={3} value={message} onChange={e => setMessage(e.target.value)} placeholder="Shkruaj një mesazh shoqërues..." />
            </div>

            <button onClick={handleSend} disabled={sending || recipients.length === 0} className="btn-primary w-full">
              {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {sending ? "Duke dërguar..." : `Dërgo te ${recipients.length} marrës`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
