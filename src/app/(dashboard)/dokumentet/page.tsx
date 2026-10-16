"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { formatDate, formatFileSize } from "@/lib/utils";
import { Plus, Send, X, Search, GraduationCap, Loader2, Check, Upload, Pin, Archive, LayoutGrid, List } from "lucide-react";
import ExportExcelButton from "@/components/ui/ExportExcelButton";
import { xlDate } from "@/lib/exportExcel";

// Dokumentet: kërkim, kategori me numër, ngarkim me tërheqje, të fiksuarat sipër,
// panel anësor (parapamje, detaje, dërgim me email / link me SMS / kopjo linkun),
// "Zëvendëso me version të ri" (i njëjti link) dhe "Arkivo" — asgjë s'fshihet.

interface DocRow {
  id: number; title: string; description: string | null; category: string | null;
  originalFileName: string; mimeType: string; size: number; createdAt: string;
  uploadedBy: { name: string };
  pinned?: boolean; archivedAt?: string | null; version?: number; replacedAt?: string | null;
}
interface ClassOpt { id: number; name: string; level: string }
interface StudentOpt {
  id: number; firstName: string; lastName: string;
  motherEmail: string | null; fatherEmail: string | null;
  class: { name: string } | null;
}
interface Recipient { email: string; name: string; studentId?: number }

const NONE = "__none__";

function kindOf(mime: string, name: string): { label: string; tone: string; bg: string } {
  if (mime.startsWith("image/")) return { label: "FOTO", tone: "text-orange-700", bg: "bg-orange-50 dark:bg-orange-900/20" };
  if (mime === "application/pdf" || /\.pdf$/i.test(name)) return { label: "PDF", tone: "text-violet-700", bg: "bg-violet-50 dark:bg-violet-900/20" };
  return { label: "WORD", tone: "text-blue-700", bg: "bg-blue-50 dark:bg-blue-900/20" };
}
const titleFromFile = (name: string) => name.replace(/\.[^.]+$/, "").replace(/[_-]+/g, " ").trim();

export default function DokumentetPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<DocRow[]>([]);
  const [archivedDocs, setArchivedDocs] = useState<DocRow[] | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [view, setView] = useState<"cards" | "list">("list");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [uploadFiles, setUploadFiles] = useState<File[] | null>(null);
  const [sendDoc, setSendDoc] = useState<DocRow | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [toast, setToast] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);
  const replaceInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const [d, c] = await Promise.all([
      fetch("/api/documents").then(r => (r.ok ? r.json() : [])).catch(() => []),
      fetch("/api/documents/categories").then(r => (r.ok ? r.json() : [])).catch(() => []),
    ]);
    setDocs(Array.isArray(d) ? d : []);
    setCategories(Array.isArray(c) ? c : []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(""), 3000); return () => clearTimeout(t); }, [toast]);

  const counts = useMemo(() => {
    const m = new Map<string, number>();
    for (const d of docs) { const k = d.category || NONE; m.set(k, (m.get(k) ?? 0) + 1); }
    return m;
  }, [docs]);
  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    return docs.filter(d =>
      (!categoryFilter || (categoryFilter === NONE ? !d.category : d.category === categoryFilter))
      && (!t || `${d.title} ${d.originalFileName} ${d.description ?? ""}`.toLowerCase().includes(t)));
  }, [docs, q, categoryFilter]);
  const pinned = filtered.filter(d => d.pinned);
  const others = filtered.filter(d => !d.pinned);
  const selected = docs.find(d => d.id === selectedId) ?? archivedDocs?.find(d => d.id === selectedId) ?? null;

  async function patch(d: DocRow, body: Record<string, unknown>, msg: string) {
    setBusy(msg);
    const r = await fetch(`/api/documents/${d.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    setBusy(null);
    if (!r?.ok) { const j = r ? await r.json().catch(() => ({})) : {}; alert(j.error || "Ruajtja dështoi."); return false; }
    setToast(msg);
    await load();
    if (archivedDocs) loadArchived();
    return true;
  }
  async function loadArchived() {
    const r = await fetch("/api/documents?archived=1").catch(() => null);
    setArchivedDocs(r?.ok ? await r.json() : []);
  }
  async function addCategory() {
    const name = window.prompt("Emri i kategorisë së re:")?.trim();
    if (!name) return;
    const r = await fetch("/api/documents/categories", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => null);
    if (r?.ok) { setToast(`Kategoria "${name}" u shtua`); load(); }
  }
  async function getLink(d: DocRow): Promise<string | null> {
    const r = await fetch(`/api/documents/${d.id}/link`, { method: "POST" }).catch(() => null);
    if (!r?.ok) { alert("Linku s'u krijua."); return null; }
    const j = await r.json();
    return `${window.location.origin}${j.path}`;
  }
  async function copyLink(d: DocRow) {
    const url = await getLink(d);
    if (!url) return;
    try { await navigator.clipboard.writeText(url); setToast("Linku u kopjua"); } catch { window.prompt("Kopjo linkun:", url); }
  }
  async function smsLink(d: DocRow) {
    const url = await getLink(d);
    if (!url) return;
    const text = `Përshëndetje, i nderuar prind, ${d.title}: ${url} Akademia Ora`;
    router.push(`/sms?text=${encodeURIComponent(text)}`);
  }
  async function replaceFile(d: DocRow, file: File) {
    if (!confirm(`Të zëvendësohet skedari i "${d.title}" me "${file.name}"?\n\nLinku mbetet i njëjtë; versioni i vjetër ruhet.`)) return;
    setBusy("Duke ngarkuar versionin e ri…");
    const form = new FormData(); form.append("file", file);
    const r = await fetch(`/api/documents/${d.id}/replace`, { method: "POST", body: form }).catch(() => null);
    setBusy(null);
    if (!r?.ok) { const j = r ? await r.json().catch(() => ({})) : {}; alert(j.message || j.error || "Zëvendësimi dështoi."); return; }
    setToast("U zëvendësua me versionin e ri");
    load();
  }
  async function changeCategory(d: DocRow) {
    const list = categories.length ? `\n\nKategoritë: ${categories.join(", ")}` : "";
    const v = window.prompt(`Kategoria për "${d.title}" (bosh = pa kategori):${list}`, d.category ?? "");
    if (v === null) return;
    await patch(d, { category: v.trim() || null }, "Kategoria u ndryshua");
  }
  function onDrop(e: React.DragEvent) {
    e.preventDefault(); setDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    if (files.length) setUploadFiles(files);
  }

  const chip = (active: boolean, extra = "") => `text-xs px-3 py-1.5 rounded-full border font-medium transition-colors ${active ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900" : `bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-slate-400 ${extra}`}`;
  const card = "rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800";

  const DocCard = ({ d }: { d: DocRow }) => {
    const k = kindOf(d.mimeType, d.originalFileName);
    return (
      <button type="button" onClick={() => setSelectedId(d.id)}
        className={`text-left ${card} overflow-hidden hover:shadow-md transition-shadow ${selectedId === d.id ? "ring-2 ring-primary-400 border-primary-300" : ""}`}>
        <div className={`h-24 ${k.bg} relative flex items-center justify-center`}>
          <span className={`text-[11px] font-bold px-2 py-1 rounded-md bg-white dark:bg-slate-900 ${k.tone}`}>{k.label}</span>
          {d.pinned && <span className="absolute top-2 right-2 text-[10px] font-semibold text-primary-700 dark:text-primary-300 flex items-center gap-0.5"><Pin className="w-3 h-3" /> Fiksuar</span>}
        </div>
        <div className="p-3">
          <p className="font-semibold text-sm text-slate-900 dark:text-white line-clamp-2">{d.title}</p>
          <p className="text-xs text-primary-700 dark:text-primary-300 mt-0.5">{d.category ?? <span className="text-amber-600">Pa kategori</span>}</p>
          <p className="text-[11px] text-slate-400 mt-1">{formatFileSize(d.size)} · {formatDate(d.createdAt)}</p>
        </div>
      </button>
    );
  };

  const DocRowView = ({ d, archived }: { d: DocRow; archived?: boolean }) => {
    const k = kindOf(d.mimeType, d.originalFileName);
    return (
      <div onClick={() => setSelectedId(d.id)} className={`flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60 ${selectedId === d.id ? "bg-primary-50/60 dark:bg-primary-900/10" : ""}`}>
        <span className={`w-11 h-11 rounded-xl ${k.bg} ${k.tone} text-[10px] font-bold flex items-center justify-center shrink-0`}>{k.label}</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-100 truncate">{d.title}</p>
          <p className="text-xs text-slate-400 truncate">{formatFileSize(d.size)} · {formatDate(d.createdAt)} · {d.uploadedBy.name}{(d.version ?? 1) > 1 ? ` · versioni ${d.version}` : ""}</p>
        </div>
        <span className={`hidden sm:inline text-[11px] px-2 py-0.5 rounded-full ${d.category ? "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300" : "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300"}`}>{d.category ?? "Pa kategori"}</span>
        {archived ? (
          <button type="button" onClick={e => { e.stopPropagation(); patch(d, { archived: false }, "U rikthye nga arkivi"); }} className="btn-secondary text-xs py-1">Rikthe</button>
        ) : (
          <>
            <a href={`/api/documents/${d.id}/file?inline=1`} target="_blank" rel="noopener" onClick={e => e.stopPropagation()} className="btn-secondary text-xs py-1">Shiko</a>
            <button type="button" onClick={e => { e.stopPropagation(); setSelectedId(d.id); }} className="text-xs py-1 px-3 rounded-lg bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300 hover:bg-primary-100 font-medium">Dërgo</button>
          </>
        )}
      </div>
    );
  };

  return (
    <>
      <Header title="Dokumentet" />
      <div className="p-4 sm:p-6 space-y-4 animate-fade-in">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dokumentet</h1>
            <p className="text-sm text-slate-500 mt-0.5">Katalogë, broshura, rregullore dhe formularë. Gjeji shpejt, dërgoji me një klik.</p>
          </div>
          <div className="flex gap-2">
            <ExportExcelButton<DocRow> fileName="Dokumentet" label="Eksporto listën" rows={filtered} columns={[
              { header: "Titulli", value: d => d.title, width: 30 },
              { header: "Kategoria", value: d => d.category ?? "" },
              { header: "Përshkrimi", value: d => d.description ?? "", width: 30 },
              { header: "Skedari", value: d => d.originalFileName, width: 28 },
              { header: "Madhësia (KB)", value: d => Math.round(d.size / 1024) },
              { header: "Fiksuar", value: d => (d.pinned ? "Po" : "") },
              { header: "Ngarkuar nga", value: d => d.uploadedBy.name },
              { header: "Data", value: d => xlDate(d.createdAt) },
            ]} />
            <button onClick={() => fileInput.current?.click()} className="btn-primary"><Plus className="w-4 h-4" /> Ngarko dokument</button>
            <input ref={fileInput} type="file" multiple hidden accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp"
              onChange={e => { const f = Array.from(e.target.files ?? []); if (f.length) setUploadFiles(f); e.target.value = ""; }} />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={q} onChange={e => setQ(e.target.value)} className="form-input pl-9" placeholder="Kërko dokument me emër..." />
          </div>
          <div className="flex p-1 rounded-lg bg-slate-100 dark:bg-slate-800">
            <button type="button" onClick={() => setView("cards")} className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1 ${view === "cards" ? "bg-white dark:bg-slate-700 shadow-sm" : "text-slate-500"}`}><LayoutGrid className="w-3.5 h-3.5" /> Kartela</button>
            <button type="button" onClick={() => setView("list")} className={`px-3 py-1 rounded-md text-xs font-medium flex items-center gap-1 ${view === "list" ? "bg-white dark:bg-slate-700 shadow-sm" : "text-slate-500"}`}><List className="w-3.5 h-3.5" /> Listë</button>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setCategoryFilter("")} className={chip(!categoryFilter)}>Të gjitha {docs.length}</button>
          {categories.map(c => <button key={c} type="button" onClick={() => setCategoryFilter(c)} className={chip(categoryFilter === c)}>{c} {counts.get(c) ?? 0}</button>)}
          {(counts.get(NONE) ?? 0) > 0 && <button type="button" onClick={() => setCategoryFilter(NONE)} className={chip(categoryFilter === NONE, "!bg-amber-50 !border-amber-200 !text-amber-800")}>Pa kategori {counts.get(NONE)}</button>}
          <button type="button" onClick={addCategory} className="text-xs px-3 py-1.5 rounded-full border border-dashed border-primary-300 text-primary-700 dark:text-primary-300 hover:bg-primary-50">+ Kategori</button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4 items-start">
          <div className="space-y-4 min-w-0">
            <div onDragOver={e => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
              className={`rounded-2xl border-2 border-dashed px-4 py-4 text-sm text-center transition-colors ${dragOver ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20" : "border-primary-200 dark:border-primary-900 bg-primary-50/40 dark:bg-slate-800/40 text-slate-500"}`}>
              <Upload className="w-4 h-4 inline mr-1.5 text-primary-600" />
              Tërhiq skedarët këtu ose <button type="button" onClick={() => fileInput.current?.click()} className="text-primary-700 dark:text-primary-300 underline">zgjidh nga kompjuteri</button> · PDF, Word, foto deri 50 MB
            </div>

            {loading ? (
              <p className="text-center text-slate-400 py-10 text-sm">Duke ngarkuar...</p>
            ) : filtered.length === 0 ? (
              <p className="text-center text-slate-400 py-10 text-sm">{docs.length ? "Asnjë dokument s'përputhet me kërkimin." : "Asnjë dokument ende."}</p>
            ) : (
              <>
                {pinned.length > 0 && (
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Të fiksuara · dërgohen më shpesh</p>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{pinned.map(d => <DocCard key={d.id} d={d} />)}</div>
                  </div>
                )}
                {others.length > 0 && (
                  <div>
                    {pinned.length > 0 && <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Të tjerat</p>}
                    {view === "cards"
                      ? <div className="grid grid-cols-2 md:grid-cols-3 gap-3">{others.map(d => <DocCard key={d.id} d={d} />)}</div>
                      : <div className={`${card} divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden`}>{others.map(d => <DocRowView key={d.id} d={d} />)}</div>}
                  </div>
                )}
              </>
            )}

            <div>
              <button type="button" onClick={() => (archivedDocs ? setArchivedDocs(null) : loadArchived())} className="text-xs text-slate-500 hover:text-slate-700 flex items-center gap-1">
                <Archive className="w-3.5 h-3.5" /> {archivedDocs ? "Fshih arkivin" : "Shiko arkivin"}
              </button>
              {archivedDocs && (
                <div className={`${card} mt-2 divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden`}>
                  {archivedDocs.length === 0 ? <p className="text-xs text-slate-400 p-4">Arkivi është bosh.</p> : archivedDocs.map(d => <DocRowView key={d.id} d={d} archived />)}
                </div>
              )}
            </div>
          </div>

          {/* Paneli anësor */}
          <aside className={`${card} p-4 lg:sticky lg:top-4 ${selected ? "" : "hidden lg:block"}`}>
            {!selected ? (
              <p className="text-sm text-slate-400 text-center py-10">Zgjidh një dokument për ta parë dhe dërguar.</p>
            ) : (() => {
              const k = kindOf(selected.mimeType, selected.originalFileName);
              const isArchived = !!selected.archivedAt;
              const inlineUrl = `/api/documents/${selected.id}/file?inline=1&v=${selected.version ?? 1}`;
              return (
                <div className="space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wide">Zgjedhur</p>
                      <p className="font-bold text-slate-900 dark:text-white">{selected.title}</p>
                    </div>
                    <button type="button" onClick={() => setSelectedId(null)} aria-label="Mbyll" className="p-1 text-slate-400 hover:text-slate-600 border border-slate-200 dark:border-slate-600 rounded-lg"><X className="w-4 h-4" /></button>
                  </div>
                  <div className={`rounded-xl ${k.bg} h-44 overflow-hidden flex items-center justify-center`}>
                    {k.label === "FOTO" ? <img src={inlineUrl} alt={selected.title} className="w-full h-full object-cover" />
                      : k.label === "PDF" ? <iframe src={`${inlineUrl}#page=1&toolbar=0&navpanes=0&view=FitH`} title="Parapamja e faqes së parë" className="w-full h-full bg-white" />
                      : <span className={`text-xs ${k.tone}`}>Parapamja s&apos;është e mundur për Word — kliko "Shkarko"</span>}
                  </div>
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2 text-xs">
                    <div><dt className="text-slate-400">Kategoria</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{selected.category ?? "Pa kategori"}</dd></div>
                    <div><dt className="text-slate-400">Madhësia</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{formatFileSize(selected.size)} · {k.label}</dd></div>
                    <div><dt className="text-slate-400">Ngarkuar</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{formatDate(selected.createdAt)}</dd></div>
                    <div><dt className="text-slate-400">Nga</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{selected.uploadedBy.name}</dd></div>
                    {(selected.version ?? 1) > 1 && <div className="col-span-2"><dt className="text-slate-400">Versioni</dt><dd className="font-semibold text-slate-800 dark:text-slate-100">{selected.version}{selected.replacedAt ? ` · zëvendësuar më ${formatDate(selected.replacedAt)}` : ""}</dd></div>}
                  </dl>
                  {isArchived ? (
                    <div className="space-y-2">
                      <p className="text-xs text-amber-700 dark:text-amber-300">I arkivuar — linku publik s&apos;hapet më.</p>
                      <button type="button" onClick={() => patch(selected, { archived: false }, "U rikthye nga arkivi")} className="btn-primary w-full justify-center">Rikthe nga arkivi</button>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Dërgoje te prindërit</p>
                        <button type="button" onClick={() => setSendDoc(selected)} className="btn-primary w-full justify-center"><Send className="w-4 h-4" /> Dërgo me email</button>
                        <button type="button" onClick={() => smsLink(selected)} className="btn-secondary w-full justify-center">Dërgo linkun me SMS</button>
                        <button type="button" onClick={() => copyLink(selected)} className="btn-secondary w-full justify-center">Kopjo linkun</button>
                      </div>
                      <div className="flex flex-wrap gap-2 pt-2 border-t border-slate-100 dark:border-slate-700">
                        <a href={`/api/documents/${selected.id}/file`} className="btn-secondary text-xs py-1">Shkarko</a>
                        <button type="button" onClick={() => replaceInput.current?.click()} className="btn-secondary text-xs py-1">Zëvendëso me version të ri</button>
                        <input ref={replaceInput} type="file" hidden accept=".pdf,.doc,.docx,.jpg,.jpeg,.png,.webp" onChange={e => { const f = e.target.files?.[0]; if (f) replaceFile(selected, f); e.target.value = ""; }} />
                        <button type="button" onClick={() => changeCategory(selected)} className="btn-secondary text-xs py-1">Ndrysho kategorinë</button>
                        <button type="button" onClick={() => patch(selected, { pinned: !selected.pinned }, selected.pinned ? "U hoq nga të fiksuarat" : "U fiksua")} className="btn-secondary text-xs py-1">
                          <Pin className="w-3 h-3" /> {selected.pinned ? "Hiq fiksimin" : "Fikso"}
                        </button>
                        <button type="button" onClick={() => confirm(`Ta arkivoj "${selected.title}"?\n\nNuk fshihet — mund ta rikthesh nga "Shiko arkivin".`) && patch(selected, { archived: true }, "U arkivua")}
                          className="text-xs py-1 px-3 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300">Arkivo</button>
                      </div>
                      <p className="text-[11px] text-slate-500 rounded-lg bg-slate-50 dark:bg-slate-900/50 p-2">Linku mbetet i njëjtë edhe kur e zëvendëson skedarin, kështu prindërit marrin gjithmonë versionin e fundit.</p>
                    </>
                  )}
                </div>
              );
            })()}
          </aside>
        </div>
      </div>

      {busy && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-slate-900 text-white text-sm px-4 py-2 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> {busy}</div>}
      {toast && !busy && <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-emerald-600 text-white text-sm px-4 py-2 flex items-center gap-2"><Check className="w-4 h-4" /> {toast}</div>}

      {uploadFiles && (
        <UploadDocumentsModal files={uploadFiles} categories={categories} defaultCategory={categoryFilter && categoryFilter !== NONE ? categoryFilter : ""}
          onClose={() => setUploadFiles(null)} onSaved={n => { setUploadFiles(null); setToast(`${n} dokument${n === 1 ? "" : "e"} u ngarkua${n === 1 ? "" : "n"}`); load(); }} />
      )}
      {sendDoc && <SendDocumentModal doc={sendDoc} onClose={() => setSendDoc(null)} />}
    </>
  );
}

function UploadDocumentsModal({ files, categories, defaultCategory, onClose, onSaved }: {
  files: File[]; categories: string[]; defaultCategory: string; onClose: () => void; onSaved: (n: number) => void;
}) {
  const [titles, setTitles] = useState(() => files.map(f => titleFromFile(f.name)));
  const [category, setCategory] = useState(defaultCategory);
  const [pinned, setPinned] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    if (titles.some(t => !t.trim())) { setError("Çdo dokument duhet të ketë titull."); return; }
    setSaving(true); setError("");
    let ok = 0;
    for (let i = 0; i < files.length; i++) {
      const form = new FormData();
      form.append("title", titles[i].trim()); form.append("description", ""); form.append("category", category.trim()); form.append("file", files[i]);
      const r = await fetch("/api/documents", { method: "POST", body: form }).catch(() => null);
      if (!r?.ok) { const d = r ? await r.json().catch(() => ({})) : {}; setError(`${files[i].name}: ${d.message || "ngarkimi dështoi"}`); setSaving(false); if (ok) onSaved(ok); return; }
      if (pinned) { const d = await r.json().catch(() => null); if (d?.id) await fetch(`/api/documents/${d.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pinned: true }) }).catch(() => {}); }
      ok++;
    }
    setSaving(false);
    onSaved(ok);
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget && !saving) onClose(); }}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white">Ngarko {files.length > 1 ? `${files.length} dokumente` : "dokument"}</h3>
          <button onClick={onClose} disabled={saving} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Mbyll"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4 overflow-y-auto">
          {files.map((f, i) => (
            <label key={i} className="block">
              <span className="form-label">Titulli — <span className="text-slate-400 font-normal">{f.name} · {formatFileSize(f.size)}</span></span>
              <input className="form-input" value={titles[i]} onChange={e => setTitles(t => t.map((x, j) => (j === i ? e.target.value : x)))} />
            </label>
          ))}
          <label className="block">
            <span className="form-label">Kategoria</span>
            <input className="form-input" list="doc-categories" value={category} onChange={e => setCategory(e.target.value)} placeholder="p.sh. Informata për shkollën" />
            <datalist id="doc-categories">{categories.map(c => <option key={c} value={c} />)}</datalist>
          </label>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pinned} onChange={e => setPinned(e.target.checked)} /> Fikso (dërgohet shpesh)</label>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>
        <div className="flex gap-2 p-5 pt-0">
          <button onClick={onClose} disabled={saving} className="btn-secondary">Anulo</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} {saving ? "Duke ngarkuar..." : "Ngarko"}
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
