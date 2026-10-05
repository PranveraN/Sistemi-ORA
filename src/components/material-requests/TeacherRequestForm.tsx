"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Send, Loader2, CheckCircle2, Check, Plus, Minus, Paperclip, Link as LinkIcon, X, Search, Clock, AlertTriangle, ChevronDown, Sparkles, PenLine, LayoutGrid,
} from "lucide-react";
import { buildIndex, matchText, type CatalogEntry, type SegmentMatch } from "@/lib/materialMatcher";
import { isTooSoon } from "@/lib/materialConfig";

interface Opt { id: number; name: string }

// Forma e re e mësuesit: "Shkruaj kërkesën" (tekst i lirë me përputhje të
// drejtpërdrejtë në katalog) ose "Zgjidh nga katalogu". Dërgimi është direkt
// (pa faqe përmbledhjeje). Vendimi përfundimtar i artikujve bëhet në server.

const PLACEHOLDER = "P.sh. 10 markera për tabelë, 2 pako letër A4 dhe ngjyra uji për klasën 3A. Na duhen për projektin e artit javën tjetër.";
const segKey = (m: SegmentMatch) => m.segment.raw.trim().toLowerCase();

interface Override { materialId?: number | null; quantity?: number; removed?: boolean }

export default function TeacherRequestForm({ classes, subjects, onSubmitted, prefillText }: {
  classes: Opt[];
  subjects: Opt[];
  onSubmitted: () => void;
  prefillText?: string | null;
}) {
  const [mode, setMode] = useState<"TEXT" | "CATALOG">("TEXT");
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [leadDays, setLeadDays] = useState(3);
  const [autoCreate, setAutoCreate] = useState(false);

  // Mënyra A — teksti
  const [text, setText] = useState("");
  const [matches, setMatches] = useState<SegmentMatch[]>([]);
  const [overrides, setOverrides] = useState<Record<string, Override>>({});
  const [openChip, setOpenChip] = useState<string | null>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);
  const backRef = useRef<HTMLDivElement>(null);

  // Mënyra B — katalogu
  const [catSearch, setCatSearch] = useState("");
  const [picked, setPicked] = useState<Record<number, number>>({});

  // Fushat e përbashkëta
  const [classChoice, setClassChoice] = useState(""); // id | "MULTI" | "SELF"
  const [multi, setMulti] = useState<number[]>([]);
  const [priority, setPriority] = useState<"NORMAL" | "URGENT">("NORMAL");
  const [urgencyReason, setUrgencyReason] = useState("");
  const [showMore, setShowMore] = useState(false);
  const [subjectId, setSubjectId] = useState("");
  const [dateNeeded, setDateNeeded] = useState("");
  const [showAttach, setShowAttach] = useState(false);
  const [productLink, setProductLink] = useState("");
  const [attachment, setAttachment] = useState<{ path: string; name: string } | null>(null);
  const [uploading, setUploading] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [done, setDone] = useState<{ newItems: string[] } | null>(null);
  const dateRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/material-requests/catalog").then(r => (r.ok ? r.json() : null)).then(d => {
      if (!d) return;
      setCatalog(d.entries ?? []); setLeadDays(d.leadDays ?? 3); setAutoCreate(!!d.autoCreate);
    }).catch(() => {});
  }, []);
  useEffect(() => { if (prefillText) { setMode("TEXT"); setText(prefillText); setDone(null); } }, [prefillText]);

  const index = useMemo(() => buildIndex(catalog), [catalog]);

  // Përputhja e drejtpërdrejtë (debounce ~300 ms)
  useEffect(() => {
    const t = setTimeout(() => setMatches(text.trim() ? matchText(text, index) : []), 300);
    return () => clearTimeout(t);
  }, [text, index]);

  const active = matches.filter(m => !m.segment.ignored);
  const effective = (m: SegmentMatch) => {
    const o = overrides[segKey(m)] ?? {};
    const item = o.materialId === undefined ? m.item : o.materialId === null ? null : catalog.find(c => c.id === o.materialId) ?? m.item;
    return { item, quantity: o.quantity ?? m.segment.quantity, removed: !!o.removed, manual: o.materialId !== undefined };
  };
  const setOverride = (k: string, patch: Override) => setOverrides(o => ({ ...o, [k]: { ...o[k], ...patch } }));

  // Shtresa e theksimit (pas textarea-s transparente)
  const highlighted = useMemo(() => {
    const parts: React.ReactNode[] = [];
    let pos = 0;
    const marks = active
      .map(m => ({ m, e: effective(m) }))
      .filter(x => !x.e.removed && x.m.segment.coreEnd > x.m.segment.coreStart)
      .sort((a, b) => a.m.segment.coreStart - b.m.segment.coreStart);
    for (const { m, e } of marks) {
      const { coreStart, coreEnd } = m.segment;
      if (coreStart < pos) continue;
      parts.push(text.slice(pos, coreStart));
      parts.push(
        <mark key={coreStart} className={e.item
          ? "bg-primary-100/80 text-primary-800 dark:bg-primary-900/50 dark:text-primary-200 underline decoration-primary-400 underline-offset-2 rounded-sm"
          : "bg-transparent text-primary-700 dark:text-primary-300 underline decoration-dashed decoration-primary-400 underline-offset-2"}>
          {text.slice(coreStart, coreEnd)}
        </mark>,
      );
      pos = coreEnd;
    }
    parts.push(text.slice(pos));
    return parts;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, matches, overrides, catalog]);

  // Klikimi mbi një fjalë vjollcë → hap sugjerimet e asaj pjese
  function onTextClick() {
    const pos = textRef.current?.selectionStart ?? -1;
    const hit = active.find(m => pos >= m.segment.coreStart && pos <= m.segment.coreEnd);
    setOpenChip(hit ? segKey(hit) : null);
  }

  const newItemNames = active.filter(m => { const e = effective(m); return !e.removed && !e.item; }).map(m => m.segment.core.trim()).filter(Boolean);
  const tooSoon = priority === "NORMAL" && !!dateNeeded && isTooSoon(dateNeeded, leadDays);
  const catalogResults = useMemo(() => {
    const q = catSearch.trim();
    if (q.length < 2) return [];
    const m = matchText(q, index)[0];
    const ids = new Set<number>();
    const list: CatalogEntry[] = [];
    if (m?.item) { ids.add(m.item.id); list.push(m.item); }
    for (const a of m?.alternatives ?? []) if (!ids.has(a.item.id)) { ids.add(a.item.id); list.push(a.item); }
    const nq = q.toLowerCase();
    for (const c of catalog) { if (list.length >= 12) break; if (!ids.has(c.id) && c.name.toLowerCase().includes(nq)) { ids.add(c.id); list.push(c); } }
    return list;
  }, [catSearch, index, catalog]);

  async function upload(file: File) {
    setUploading(true);
    const form = new FormData(); form.append("file", file);
    const r = await fetch("/api/material-requests/upload", { method: "POST", body: form }).catch(() => null);
    const d = r ? await r.json().catch(() => ({})) : {};
    setUploading(false);
    if (!r || !r.ok) { setErrors(e => ({ ...e, attach: d.error || "Ngarkimi dështoi." })); return; }
    setAttachment({ path: d.path, name: d.originalName });
  }

  function validate(): Record<string, string> {
    const e: Record<string, string> = {};
    if (mode === "TEXT" && text.trim().length < 3) e.text = "Shkruaj çka të nevojitet.";
    if (mode === "TEXT" && text.trim().length >= 3 && !active.some(m => !effective(m).removed)) e.text = "S'u gjet asnjë material — shkruaj p.sh. \"10 markera për tabelë\".";
    if (mode === "CATALOG" && !Object.values(picked).some(q => q > 0)) e.items = "Zgjidh të paktën një artikull.";
    if (!classChoice) e.class = "Zgjidh klasën.";
    if (classChoice === "MULTI" && multi.length < 2) e.class = "Zgjidh të paktën dy klasa.";
    if (priority === "URGENT" && urgencyReason.trim().length < 3) e.urgencyReason = "Shkruaj shkurt arsyen e urgjencës.";
    return e;
  }

  async function submit() {
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length) return;
    setSubmitting(true);
    const items = mode === "TEXT"
      ? active.map(m => ({ m, e: effective(m) })).filter(x => !x.e.removed).map(({ m, e }) => ({
          materialId: e.item?.id ?? null,
          quantity: e.quantity,
          unit: m.segment.unit ?? e.item?.unit ?? "copë",
          sourceText: text.slice(m.segment.start, m.segment.end).trim(),
          matchType: e.manual ? "manual" : m.matchType ?? "new",
          newName: m.segment.core.trim(),
        }))
      : Object.entries(picked).filter(([, q]) => q > 0).map(([id, q]) => ({ materialId: Number(id), quantity: q, unit: catalog.find(c => c.id === Number(id))?.unit }));
    const body = {
      mode, originalText: mode === "TEXT" ? text : undefined, items,
      classScope: classChoice === "MULTI" ? "MULTI" : classChoice === "SELF" ? "SELF" : "CLASS",
      classId: /^\d+$/.test(classChoice) ? Number(classChoice) : undefined, classIds: classChoice === "MULTI" ? multi : undefined,
      subjectId: subjectId || undefined, priority, urgencyReason: priority === "URGENT" ? urgencyReason : undefined,
      dateNeeded: dateNeeded || undefined, attachmentPath: attachment?.path, productLink: productLink.trim() || undefined,
    };
    try {
      const r = await fetch("/api/material-requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setErrors({ [d.field ?? "form"]: d.error || "Dërgimi dështoi." }); return; }
      setDone({ newItems: mode === "TEXT" ? newItemNames : [] });
      onSubmitted();
    } catch { setErrors({ form: "Gabim rrjeti — provo përsëri." }); }
    finally { setSubmitting(false); }
  }

  function reset() {
    setText(""); setMatches([]); setOverrides({}); setPicked({}); setCatSearch(""); setPriority("NORMAL"); setUrgencyReason("");
    setSubjectId(""); setDateNeeded(""); setShowMore(false); setAttachment(null); setProductLink(""); setShowAttach(false); setErrors({}); setDone(null);
  }

  const fieldErr = (k: string) => errors[k] ? <p className="text-sm text-red-600 mt-1" role="alert">{errors[k]}</p> : null;
  const big = "min-h-[44px]";

  if (done) {
    return (
      <div className="card p-6 text-center space-y-3">
        <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
        <p className="font-semibold text-slate-800 dark:text-white">Kërkesa u dërgua!</p>
        <p className="text-sm text-slate-500">Do të njoftohesh kur administrata ta shqyrtojë. E sheh te "Kërkesat e mia" më poshtë.</p>
        {done.newItems.length > 0 && (
          <p className="text-xs text-slate-500">{autoCreate ? "Artikujt e rinj u shtuan në katalog — administrata mund ta rregullojë emrin ose kategorinë." : "Artikujt që s'ishin në katalog do t'i shqyrtojë administrata."}</p>
        )}
        <button onClick={reset} className={`btn-primary ${big} mx-auto`}><Plus className="w-4 h-4" /> Kërkesë e re</button>
      </div>
    );
  }

  return (
    <div className="card p-4 sm:p-5 space-y-5">
      {/* Ndërprerësi i mënyrave */}
      <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800" role="tablist">
        {([["TEXT", "Shkruaj kërkesën", PenLine], ["CATALOG", "Zgjidh nga katalogu", LayoutGrid]] as const).map(([k, label, Icon]) => (
          <button key={k} role="tab" aria-selected={mode === k} onClick={() => setMode(k)}
            className={`${big} rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5 ${mode === k ? "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"}`}>
            <Icon className="w-4 h-4" /> {label}
          </button>
        ))}
      </div>

      {mode === "TEXT" ? (
        <div>
          <label htmlFor="req-text" className="form-label">Çka të nevojitet?</label>
          <div className="relative rounded-xl border border-slate-300 dark:border-slate-600 focus-within:border-primary-500 focus-within:ring-2 focus-within:ring-primary-100 dark:focus-within:ring-primary-900/40 bg-white dark:bg-slate-900">
            {/* Shtresa e theksimit — i njëjti font, padding dhe scroll si textarea */}
            <div ref={backRef} aria-hidden className="absolute inset-0 px-3.5 py-3 text-base leading-relaxed whitespace-pre-wrap break-words overflow-hidden text-slate-800 dark:text-slate-100 pointer-events-none">
              {highlighted}{"\n"}
            </div>
            <textarea
              id="req-text" ref={textRef} value={text} rows={5}
              onChange={e => { setText(e.target.value); setErrors(er => ({ ...er, text: "" })); }}
              onScroll={e => { if (backRef.current) backRef.current.scrollTop = e.currentTarget.scrollTop; }}
              onClick={onTextClick}
              placeholder={PLACEHOLDER}
              className="relative block w-full px-3.5 py-3 text-base leading-relaxed bg-transparent text-transparent caret-slate-800 dark:caret-white placeholder:text-slate-400 resize-y outline-none rounded-xl min-h-[130px]"
              style={{ WebkitTextFillColor: text ? "transparent" : undefined }}
              aria-describedby="req-text-help"
            />
          </div>
          {fieldErr("text")}

          {/* U gjetën në katalog */}
          {active.length > 0 && (
            <div className="mt-3 rounded-xl border border-primary-100 dark:border-primary-900/50 bg-primary-50/50 dark:bg-primary-900/10 p-3 space-y-2">
              <p className="text-sm font-semibold text-primary-800 dark:text-primary-300 flex items-center gap-1.5"><Check className="w-4 h-4" /> U gjetën në katalog</p>
              <div className="flex flex-wrap gap-2">
                {active.map(m => {
                  const k = segKey(m);
                  const e = effective(m);
                  if (e.removed) return null;
                  return (
                    <div key={k} className="relative">
                      <button onClick={() => setOpenChip(openChip === k ? null : k)} aria-expanded={openChip === k}
                        className={`${big} sm:min-h-0 px-3 py-1.5 rounded-full text-sm border flex items-center gap-1.5 ${e.item ? "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-slate-800 dark:text-slate-100" : "bg-white dark:bg-slate-900 border-dashed border-primary-400 text-primary-700 dark:text-primary-300"}`}>
                        {e.item ? e.item.name : m.segment.core.trim()} <span className="text-slate-400">× {e.quantity}{m.segment.unit ? ` ${m.segment.unit}` : ""}</span>
                        {!e.item && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-600 text-white">I ri</span>}
                      </button>
                      {openChip === k && (
                        <div className="absolute z-20 mt-1 left-0 w-72 max-w-[85vw] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl p-3 space-y-2">
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-slate-500">Sasia</span>
                            <div className="flex items-center gap-1">
                              <button onClick={() => setOverride(k, { quantity: Math.max(1, e.quantity - 1) })} aria-label="Ul sasinë" className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center"><Minus className="w-4 h-4" /></button>
                              <span className="w-10 text-center font-semibold">{e.quantity}</span>
                              <button onClick={() => setOverride(k, { quantity: e.quantity + 1 })} aria-label="Rrit sasinë" className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                            </div>
                          </div>
                          {m.alternatives.length > 0 && (
                            <div>
                              <p className="text-xs text-slate-500 mb-1">Mos ndoshta:</p>
                              {m.alternatives.filter(a => a.item.id !== e.item?.id).slice(0, 3).map(a => (
                                <button key={a.item.id} onClick={() => { setOverride(k, { materialId: a.item.id }); setOpenChip(null); }}
                                  className="w-full text-left text-sm px-2 py-2 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/30">{a.item.name}</button>
                              ))}
                            </div>
                          )}
                          <div className="flex justify-between gap-2 pt-1 border-t border-slate-100 dark:border-slate-800">
                            {e.item && <button onClick={() => { setOverride(k, { materialId: null }); setOpenChip(null); }} className="text-xs text-slate-500 hover:text-primary-600 py-2">S&apos;është ky artikull</button>}
                            <button onClick={() => { setOverride(k, { removed: true }); setOpenChip(null); }} className="text-xs text-red-500 py-2 ml-auto">Hiq nga kërkesa</button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              {newItemNames.map(n => (
                <p key={n} className="text-xs text-slate-600 dark:text-slate-300 flex gap-1.5">
                  <Plus className="w-3.5 h-3.5 text-primary-500 shrink-0 mt-0.5" />
                  {autoCreate
                    ? <span>&quot;{n}&quot; nuk ishte në katalog, ndaj do të shtohet si artikull i ri. Administrata njoftohet dhe mund ta rregullojë emrin ose kategorinë.</span>
                    : <span>&quot;{n}&quot; nuk është në katalog — administrata do ta shqyrtojë.</span>}
                </p>
              ))}
            </div>
          )}
          <p id="req-text-help" className="text-xs text-slate-500 mt-2">Shkruaj lirshëm. Fjalët me <span className="text-primary-700 font-medium">vjollcë</span> u lidhën me katalogun; kliko mbi to për ta ndryshuar artikullin ose sasinë. Të nënvizuarat me vija janë artikuj të rinj.</p>
        </div>
      ) : (
        <div>
          <label htmlFor="cat-search" className="form-label">Kërko në katalog</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input id="cat-search" value={catSearch} onChange={e => setCatSearch(e.target.value)} className={`form-input pl-9 text-base ${big}`} placeholder="P.sh. marker, letër A4, ngjyra uji…" />
          </div>
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-800">
            {[...new Map([...catalogResults, ...catalog.filter(c => picked[c.id])].map(c => [c.id, c])).values()].map(c => {
              const q = picked[c.id] ?? 0;
              return (
                <li key={c.id} className="flex items-center justify-between gap-2 py-2">
                  <span className="text-sm text-slate-800 dark:text-slate-100">{c.name}{c.reviewStatus === "pending" && <span className="ml-1 text-[10px] text-primary-600">(i ri)</span>}<span className="block text-xs text-slate-400">{c.categoryName}</span></span>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => setPicked(p => ({ ...p, [c.id]: Math.max(0, q - 1) }))} disabled={!q} aria-label={`Ul ${c.name}`} className="w-11 h-11 rounded-lg border border-slate-200 dark:border-slate-700 flex items-center justify-center disabled:opacity-30"><Minus className="w-4 h-4" /></button>
                    <span className="w-8 text-center font-semibold">{q}</span>
                    <button onClick={() => setPicked(p => ({ ...p, [c.id]: q + 1 }))} aria-label={`Shto ${c.name}`} className="w-11 h-11 rounded-lg border border-primary-200 bg-primary-50 dark:bg-primary-900/30 text-primary-700 flex items-center justify-center"><Plus className="w-4 h-4" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
          {fieldErr("items")}
          <button onClick={() => setMode("TEXT")} className="mt-2 text-sm text-primary-600 font-medium">Nuk e gjen? Shkruaje me fjalët e tua →</button>
        </div>
      )}

      {/* Foto / link */}
      <div>
        {!showAttach ? (
          <button onClick={() => setShowAttach(true)} className={`${big} px-3 rounded-lg text-sm font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 inline-flex items-center gap-1.5`}>
            <Paperclip className="w-4 h-4" /> Shto foto ose link (opsionale)
          </button>
        ) : (
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <label className={`${big} px-3 rounded-lg text-sm bg-slate-100 dark:bg-slate-800 inline-flex items-center gap-1.5 cursor-pointer`}>
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />} {attachment ? attachment.name : "Zgjidh foto/skedar"}
                <input type="file" accept="image/*,.pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); }} />
              </label>
              {attachment && <button onClick={() => setAttachment(null)} aria-label="Hiq skedarin" className="p-2 text-slate-400"><X className="w-4 h-4" /></button>}
            </div>
            <div className="relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={productLink} onChange={e => setProductLink(e.target.value)} className={`form-input pl-9 ${big}`} placeholder="Link i produktit (opsional)" aria-label="Link i produktit" />
            </div>
            {fieldErr("attach")}
          </div>
        )}
      </div>

      {/* Për klasën + Sa shpejt */}
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="req-class" className="form-label">Për klasën</label>
          <select id="req-class" value={classChoice} onChange={e => { setClassChoice(e.target.value); setErrors(er => ({ ...er, class: "" })); }} className={`form-input ${big}`}>
            <option value="">Zgjidh…</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            <option value="MULTI">Disa klasa</option>
            <option value="SELF">Për mua</option>
          </select>
          {classChoice === "MULTI" && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {classes.map(c => {
                const on = multi.includes(c.id);
                return <button key={c.id} onClick={() => setMulti(m => on ? m.filter(x => x !== c.id) : [...m, c.id])} aria-pressed={on}
                  className={`min-w-[44px] min-h-[36px] px-2 rounded-lg text-sm border ${on ? "bg-primary-600 text-white border-primary-600" : "border-slate-200 dark:border-slate-700 text-slate-600"}`}>{c.name}</button>;
              })}
            </div>
          )}
          {fieldErr("class")}
        </div>
        <div>
          <p className="form-label">Sa shpejt?</p>
          <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-slate-100 dark:bg-slate-800">
            {(["NORMAL", "URGENT"] as const).map(p => (
              <button key={p} onClick={() => setPriority(p)} aria-pressed={priority === p}
                className={`${big} rounded-lg text-sm font-semibold ${priority === p ? (p === "URGENT" ? "bg-red-600 text-white" : "bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm") : "text-slate-500"}`}>
                {p === "NORMAL" ? "Normale" : "Urgjente"}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Vërejtja e 3 ditëve — gjithmonë e dukshme */}
      <div className="rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/20 p-3 flex gap-2.5">
        <Clock className="w-5 h-5 text-amber-600 shrink-0" />
        <div>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">Bëje kërkesën të paktën {leadDays} ditë përpara</p>
          <p className="text-sm text-amber-800/90 dark:text-amber-300/90">Opsioni &quot;Urgjente&quot; është vetëm për raste shumë urgjente, si aktivitete jashtë klubeve ose aktivitete të papritura. Kërkesat urgjente kërkojnë një arsye të shkurtër.</p>
        </div>
      </div>

      {priority === "URGENT" && (
        <div>
          <label htmlFor="req-urgent" className="form-label">Arsyeja e urgjencës</label>
          <textarea id="req-urgent" value={urgencyReason} onChange={e => { setUrgencyReason(e.target.value); setErrors(er => ({ ...er, urgencyReason: "" })); }} rows={2} className="form-input text-base" placeholder="P.sh. aktivitet i papritur të enjten" />
          {fieldErr("urgencyReason")}
        </div>
      )}

      {/* Më shumë detaje */}
      <div>
        <button onClick={() => setShowMore(v => !v)} aria-expanded={showMore} className="text-sm font-medium text-slate-600 dark:text-slate-300 inline-flex items-center gap-1 min-h-[44px]">
          {showMore ? <ChevronDown className="w-4 h-4 rotate-180" /> : <Plus className="w-4 h-4" />} Më shumë detaje (opsionale)
        </button>
        {showMore && (
          <div className="grid gap-4 sm:grid-cols-2 mt-1">
            <div>
              <label htmlFor="req-subject" className="form-label">Lënda</label>
              <select id="req-subject" value={subjectId} onChange={e => setSubjectId(e.target.value)} className={`form-input ${big}`}>
                <option value="">—</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="req-date" className="form-label">Nevojitet deri më</label>
              <input id="req-date" ref={dateRef} type="date" value={dateNeeded} onChange={e => setDateNeeded(e.target.value)} className={`form-input ${big}`} />
            </div>
            {tooSoon && (
              <div className="sm:col-span-2 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-900/50 p-3 text-sm text-orange-800 dark:text-orange-300 flex gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  Data është më pak se {leadDays} ditë nga sot.
                  <div className="flex flex-wrap gap-3 mt-1">
                    <button onClick={() => dateRef.current?.focus()} className="underline min-h-[36px]">Ndrysho datën</button>
                    <button onClick={() => setPriority("URGENT")} className="underline min-h-[36px]">Shënoje si Urgjente</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {fieldErr("form")}
      <button onClick={submit} disabled={submitting} className="btn-primary w-full justify-center min-h-[48px] text-base">
        {submitting ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />} Dërgo kërkesën
      </button>
      {catalog.length === 0 && <p className="text-xs text-slate-400 flex items-center gap-1"><Sparkles className="w-3 h-3" /> Duke ngarkuar katalogun…</p>}
    </div>
  );
}
