"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Clock, Plus, Minus, Trash2, LayoutGrid, X, ChevronDown, Check, Loader2 } from "lucide-react";
import type { CatalogEntry } from "@/lib/materialMatcher";
import { parseItemInput, rankCatalog, isStrongMatch, type RankedEntry } from "@/lib/teacherItemInput";
import { normalizeSearch } from "@/lib/utils";

// Faqja e mësuesit për kërkesat e materialeve: "Kërkesë e re" (artikujt + lënda
// + arsyeja) dhe "Kërkesat e mia". Statusin e ndryshon vetëm administrata.

interface Opt { id: number; name: string }
interface Item { key: string; name: string; qty: number; unit: string | null; materialId: number | null }
interface RequestRow {
  id: number;
  reason: string;
  status: string;
  createdAt: string;
  subject: Opt | null;
  items: { isCustom: boolean; materialId: number | null; material: { id: number; name: string; reviewStatus?: string } | null; customItemName: string | null; quantity: number; unit: string }[];
}
type SuggestOpt = { type: "cat"; r: RankedEntry } | { type: "free" };

const TEACHER_STATUS: Record<string, { label: string; cls: string }> = {
  pending: { label: "Në pritje", cls: "bg-blue-50 text-blue-900 dark:bg-blue-950/50 dark:text-blue-200" },
  prep: { label: "Në përgatitje", cls: "bg-violet-100 text-violet-900 dark:bg-violet-950/60 dark:text-violet-200" },
  ready: { label: "Gati për t'u marrë", cls: "bg-green-50 text-green-900 dark:bg-green-950/50 dark:text-green-200" },
  rejected: { label: "Refuzuar", cls: "bg-red-50 text-red-700 dark:bg-red-950/50 dark:text-red-300" },
};
const statusKey = (s: string) =>
  s === "REJECTED" ? "rejected" : s === "DELIVERED" ? "ready" : ["APPROVED", "PARTIALLY_APPROVED", "ORDERED"].includes(s) ? "prep" : "pending";

const MONTHS = ["janar", "shkurt", "mars", "prill", "maj", "qershor", "korrik", "gusht", "shtator", "tetor", "nëntor", "dhjetor"];
function fmtWhen(iso: string): string {
  const d = new Date(iso), now = new Date();
  const hm = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  const y = new Date(now); y.setDate(now.getDate() - 1);
  if (d.toDateString() === now.toDateString()) return `Sot, ${hm}`;
  if (d.toDateString() === y.toDateString()) return `Dje, ${hm}`;
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}, ${hm}`;
}
const capital = (s: string) => (s ? s[0].toLocaleUpperCase("sq") + s.slice(1) : s);
const same = (a: string, b: string) => normalizeSearch(a) === normalizeSearch(b);
let seq = 0;
const newKey = () => `i${Date.now()}-${++seq}`;

export default function TeacherRequestsClient() {
  const [catalog, setCatalog] = useState<CatalogEntry[]>([]);
  const [subjects, setSubjects] = useState<Opt[]>([]);
  const [requests, setRequests] = useState<RequestRow[] | null>(null);

  const [items, setItems] = useState<Item[]>([]);
  const [flashKey, setFlashKey] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [showSuggest, setShowSuggest] = useState(false);
  const [active, setActive] = useState(-1);
  const [subjectId, setSubjectId] = useState("");
  const [reason, setReason] = useState("");
  const [errors, setErrors] = useState<{ items?: string; subject?: string; reason?: string; form?: string }>({});
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState<{ subject: string; items: Item[] } | null>(null);

  const [modal, setModal] = useState(false);
  const [catSearch, setCatSearch] = useState("");
  const [toast, setToast] = useState<{ text: string; undo?: { item: Item; idx: number } } | null>(null);
  const [openIds, setOpenIds] = useState<Set<number>>(new Set());
  const [flashReq, setFlashReq] = useState<number | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);
  const subjectRef = useRef<HTMLSelectElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const catSearchRef = useRef<HTMLInputElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastFocus = useRef<HTMLElement | null>(null);

  const loadRequests = useCallback(async () => {
    const r = await fetch("/api/material-requests").catch(() => null);
    if (r?.ok) setRequests(await r.json()); else setRequests([]);
  }, []);
  useEffect(() => {
    fetch("/api/material-requests/catalog").then(r => (r.ok ? r.json() : null)).then(d => d && setCatalog(d.entries ?? [])).catch(() => {});
    fetch("/api/subjects").then(r => (r.ok ? r.json() : [])).then(setSubjects).catch(() => {});
    loadRequests();
  }, [loadRequests]);

  /* ── Artikujt ── */
  function addItem(name: string, qty: number, unit: string | null, materialId: number | null) {
    setItems(list => {
      // Nëse ekziston tashmë, rritet sasia në vend të një rreshti të ri
      const ex = list.find(i => (materialId && i.materialId === materialId) || same(i.name, name));
      if (ex) { setFlashKey(ex.key); return list.map(i => (i === ex ? { ...i, qty: i.qty + qty } : i)); }
      const it = { key: newKey(), name, qty, unit, materialId };
      setFlashKey(it.key);
      return [...list, it];
    });
    setErrors(e => ({ ...e, items: undefined }));
  }
  const fromCatalog = (e: CatalogEntry, qty: number, unit: string | null) => addItem(e.name, qty, unit ?? e.unit, e.id);

  const parsed = useMemo(() => parseItemInput(text), [text]);
  const ranked = useMemo(() => (text.trim() ? rankCatalog(parsed.name, catalog, 5) : []), [text, parsed.name, catalog]);
  const hasExact = ranked.some(r => r.exact);
  const options: SuggestOpt[] = text.trim() ? [...ranked.map(r => ({ type: "cat" as const, r })), ...(hasExact ? [] : [{ type: "free" as const }])] : [];
  // Përputhja e fortë zgjidhet vetë me Enter
  useEffect(() => { setActive(isStrongMatch(ranked[0]) ? 0 : -1); }, [text, ranked]);

  function pick(o: SuggestOpt | undefined) {
    if (!o) return;
    if (o.type === "cat") fromCatalog(o.r.entry, parsed.qty, parsed.unit);
    else addItem(capital(parsed.name), parsed.qty, parsed.unit, null);
    setText(""); setShowSuggest(false); inputRef.current?.focus();
  }
  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown" && options.length) { e.preventDefault(); setShowSuggest(true); setActive(a => Math.min(a + 1, options.length - 1)); }
    else if (e.key === "ArrowUp" && options.length) { e.preventDefault(); setActive(a => Math.max(a - 1, 0)); }
    else if (e.key === "Enter") {
      e.preventDefault();
      if (text.trim()) pick(active > -1 ? options[active] : { type: "free" }); // Enter pa zgjedhje → shton tekstin siç është
    }
    else if (e.key === "Escape") setShowSuggest(false);
  }

  function changeQty(key: string, delta: number) {
    setItems(list => list.map(i => (i.key === key ? { ...i, qty: Math.max(1, i.qty + delta) } : i)));
  }
  function showToast(t: { text: string; undo?: { item: Item; idx: number } }, ms: number) {
    setToast(t);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), ms);
  }
  function remove(key: string) {
    const idx = items.findIndex(i => i.key === key);
    if (idx < 0) return;
    const item = items[idx];
    setItems(list => list.filter(i => i.key !== key));
    showToast({ text: `„${item.name}” u hoq nga kërkesa.`, undo: { item, idx } }, 5000);
  }
  function undo() {
    const u = toast?.undo;
    if (u) {
      setItems(list => { const next = [...list]; next.splice(Math.min(u.idx, next.length), 0, u.item); return next; });
      setFlashKey(u.item.key);
    }
    setToast(null);
  }

  /* ── Katalogu (modal) ── */
  function openModal() { lastFocus.current = document.activeElement as HTMLElement; setCatSearch(""); setModal(true); setTimeout(() => catSearchRef.current?.focus(), 30); }
  function closeModal() { setModal(false); lastFocus.current?.focus(); }
  const catList = useMemo(() => {
    const q = catSearch.trim();
    return q ? rankCatalog(q, catalog, 60).map(r => r.entry) : catalog;
  }, [catSearch, catalog]);

  /* ── Dërgimi ── */
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    let list = items;
    if (text.trim()) {
      // Teksti i pashtuar shtohet automatikisht (me artikullin e katalogut kur përputhja është e fortë)
      const o = isStrongMatch(ranked[0]) ? ranked[0].entry : null;
      const it: Item = o
        ? { key: newKey(), name: o.name, qty: parsed.qty, unit: parsed.unit ?? o.unit, materialId: o.id }
        : { key: newKey(), name: capital(parsed.name), qty: parsed.qty, unit: parsed.unit, materialId: null };
      const ex = list.find(i => (it.materialId && i.materialId === it.materialId) || same(i.name, it.name));
      list = ex ? list.map(i => (i === ex ? { ...i, qty: i.qty + it.qty } : i)) : [...list, it];
      setItems(list); setText(""); setShowSuggest(false);
    }
    const errs: typeof errors = {};
    if (!list.length) errs.items = "Shtoni të paktën një artikull.";
    if (!subjectId) errs.subject = "Zgjidhni lëndën.";
    if (!reason.trim()) errs.reason = "Shkruani arsyen e kërkesës.";
    setErrors(errs);
    if (errs.items) { inputRef.current?.focus(); return; }
    if (errs.subject) { subjectRef.current?.focus(); return; }
    if (errs.reason) { reasonRef.current?.focus(); return; }

    setSending(true);
    try {
      const r = await fetch("/api/material-requests", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mode: "LIST", subjectId: Number(subjectId), reason: reason.trim(), items: list.map(i => ({ materialId: i.materialId, name: i.name, quantity: i.qty, unit: i.unit })) }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        const f = d.field === "subject" ? "subject" : d.field === "reason" ? "reason" : d.field === "items" ? "items" : "form";
        setErrors({ [f]: d.error || "Dërgimi dështoi. Provoni përsëri." });
        return;
      }
      setDone({ subject: subjects.find(s => String(s.id) === subjectId)?.name ?? "", items: list });
      setToast(null);
      await loadRequests();
      setOpenIds(new Set([d.id]));
      setFlashReq(d.id);
      setTimeout(() => setFlashReq(null), 1600);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setErrors({ form: "Gabim rrjeti — provoni përsëri." });
    } finally {
      setSending(false);
    }
  }
  function newRequest() {
    setItems([]); setSubjectId(""); setReason(""); setErrors({}); setDone(null);
    setTimeout(() => inputRef.current?.focus(), 30);
  }
  function repeat(r: RequestRow) {
    setItems(r.items.map(it => ({
      key: newKey(),
      name: (it.isCustom ? it.customItemName : it.material?.name) ?? "Artikull",
      qty: it.quantity, unit: it.unit,
      materialId: !it.isCustom && it.material ? it.material.id : null,
    })));
    setSubjectId(r.subject ? String(r.subject.id) : "");
    setReason(""); setErrors({}); setDone(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
    setTimeout(() => reasonRef.current?.focus({ preventScroll: true }), 350);
    showToast({ text: "Artikujt u kopjuan. Shkruani arsyen dhe dërgojeni." }, 4000);
  }

  const inCat = items.filter(i => i.materialId).length;
  const outCat = items.length - inCat;
  const fieldCls = "w-full rounded-xl border bg-white dark:bg-slate-900 px-4 text-[15px] text-slate-900 dark:text-slate-100 placeholder:text-slate-500 dark:placeholder:text-slate-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500";
  const border = (bad?: string) => (bad ? "border-red-600 dark:border-red-400" : "border-slate-300 dark:border-slate-600");
  const ghostBtn = "h-[38px] px-3 rounded-[9px] border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 inline-flex items-center justify-center gap-1.5 text-[13px] font-bold text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500";

  return (
    <div className="flex flex-col gap-5">
      {/* Njoftimi (informues, jo paralajmërim) */}
      <div role="note" className="flex gap-3.5 items-start rounded-[14px] border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 px-5 py-4 text-blue-950 dark:text-blue-100">
        <Clock className="w-[22px] h-[22px] text-blue-700 dark:text-blue-300 shrink-0 mt-0.5" aria-hidden />
        <p><b>Të nderuar mësimdhënës,</b> artikujt që kërkojnë kohë për t&apos;u blerë, ju lutem porositni <b>të paktën tri ditë më herët</b>.</p>
      </div>

      {done ? (
        <section className="rounded-[18px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-7 flex flex-col items-center text-center gap-3.5">
          <span className="w-14 h-14 rounded-full bg-primary-100 dark:bg-primary-900/50 flex items-center justify-center"><Check className="w-7 h-7 text-primary-600" strokeWidth={2.5} aria-hidden /></span>
          <h2 className="text-[22px] font-extrabold text-slate-900 dark:text-white">Kërkesa u dërgua</h2>
          <p className="text-slate-700 dark:text-slate-300 max-w-[52ch]">Për lëndën {done.subject}. Artikujt nga katalogu përgatiten; ata jashtë katalogut i shton administrata.</p>
          <ul className="w-full max-w-[460px] text-left rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
            {done.items.map(i => (
              <li key={i.key} className="flex justify-between gap-3 px-3.5 py-2.5 text-slate-900 dark:text-slate-100">
                <span>{i.name}</span>
                <span className={`font-bold ${i.materialId ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>{i.qty}{i.unit ? ` ${i.unit}` : ""}</span>
              </li>
            ))}
          </ul>
          <button type="button" onClick={newRequest} className={ghostBtn}>Bëj kërkesë të re</button>
        </section>
      ) : (
        <form onSubmit={submit} noValidate className="rounded-[18px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-[18px] min-[620px]:p-7 flex flex-col gap-7">
          {/* 1 — Artikujt */}
          <section className="flex flex-col gap-3" aria-labelledby="t1">
            <div className="flex items-center gap-3"><StepNum n={1} /><h2 id="t1" className="text-[19px] font-extrabold text-slate-900 dark:text-white">Çka të nevojitet?</h2></div>
            <div className={`rounded-[14px] border ${errors.items ? "border-red-600 dark:border-red-400" : "border-slate-200 dark:border-slate-700"}`}>
              <div aria-hidden className="hidden min-[620px]:grid grid-cols-[2.4fr_1.3fr_2.4fr_44px] gap-3 px-[18px] py-[11px] rounded-t-[14px] bg-slate-50 dark:bg-slate-800 text-xs font-bold tracking-[.06em] text-slate-600 dark:text-slate-300">
                <div>ARTIKULLI</div><div>SASIA</div><div>STATUSI</div><div />
              </div>
              {items.length === 0 ? (
                <div className="px-[18px] py-[22px] border-t border-slate-100 dark:border-slate-800 text-center text-slate-600 dark:text-slate-300">Ende asnjë artikull. Shkruani më poshtë ose zgjidhni nga katalogu.</div>
              ) : items.map(it => (
                <div key={it.key} onAnimationEnd={() => setFlashKey(null)}
                  className={`grid grid-cols-[1fr_auto] [grid-template-areas:'name_del'_'status_status'_'qty_qty'] gap-x-3 gap-y-2 min-[620px]:gap-y-0 min-[620px]:grid-cols-[2.4fr_1.3fr_2.4fr_44px] min-[620px]:[grid-template-areas:'name_qty_status_del'] items-center px-[18px] py-3 border-t border-slate-100 dark:border-slate-800 ${flashKey === it.key ? "animate-ora-flash" : ""}`}>
                  <div className="[grid-area:name] font-bold text-[15.5px] text-slate-900 dark:text-white break-words">{it.name}</div>
                  <div className="[grid-area:qty] flex items-center gap-2">
                    <button type="button" onClick={() => changeQty(it.key, -1)} disabled={it.qty <= 1} aria-label={`Zvogëlo sasinë e ${it.name}`}
                      className="w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-40"><Minus className="w-4 h-4" /></button>
                    <b className="min-w-[20px] text-center text-slate-900 dark:text-white">{it.qty}</b>
                    {it.unit && <span className="text-[13px] text-slate-600 dark:text-slate-300">{it.unit}</span>}
                    <button type="button" onClick={() => changeQty(it.key, 1)} aria-label={`Rrit sasinë e ${it.name}`}
                      className="w-8 h-8 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800"><Plus className="w-4 h-4" /></button>
                  </div>
                  <div className={`[grid-area:status] font-bold text-sm ${it.materialId ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>
                    {it.materialId ? "✓ Në katalog" : "ⓘ Jo në katalog – e shton administrata"}
                  </div>
                  <button type="button" onClick={() => remove(it.key)} aria-label={`Hiq ${it.name}`}
                    className="[grid-area:del] justify-self-end w-10 h-10 rounded-lg flex items-center justify-center text-slate-500 hover:text-slate-900 hover:bg-slate-100 dark:text-slate-400 dark:hover:text-white dark:hover:bg-slate-800"><Trash2 className="w-[17px] h-[17px]" /></button>
                </div>
              ))}

              {/* Shto artikull */}
              <div className="relative flex flex-wrap min-[620px]:flex-nowrap items-center gap-2.5 pl-[18px] pr-3 py-2.5 border-t border-dashed border-slate-300 dark:border-slate-600 bg-slate-50/60 dark:bg-slate-800/40 rounded-b-[14px]">
                <Plus className="w-[18px] h-[18px] text-primary-600 shrink-0" strokeWidth={2.5} aria-hidden />
                <label htmlFor="addInput" className="sr-only">Shto artikull</label>
                <input
                  id="addInput" ref={inputRef} value={text} autoComplete="off" spellCheck={false}
                  role="combobox" aria-expanded={showSuggest && options.length > 0} aria-controls="suggest" aria-autocomplete="list"
                  aria-describedby={errors.items ? "errItems" : undefined}
                  onChange={e => { setText(e.target.value); setShowSuggest(true); }}
                  onFocus={() => text && setShowSuggest(true)}
                  onBlur={() => setTimeout(() => setShowSuggest(false), 120)}
                  onKeyDown={onInputKey}
                  placeholder="Shto artikull… (p.sh. ngjitës, gërshërë)"
                  className="flex-1 min-w-0 h-[42px] bg-transparent text-[15px] text-slate-900 dark:text-white placeholder:text-slate-500 dark:placeholder:text-slate-400 outline-none"
                />
                <button type="button" onClick={openModal} className={`${ghostBtn} w-full min-[620px]:w-auto`}><LayoutGrid className="w-3.5 h-3.5" aria-hidden /> Nga katalogu</button>
                {showSuggest && options.length > 0 && (
                  <div id="suggest" role="listbox" onMouseDown={e => e.preventDefault()}
                    className="absolute left-3 right-3 top-[calc(100%+4px)] z-20 max-h-[300px] overflow-auto rounded-xl border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 p-1.5 shadow-[0_12px_32px_rgba(20,20,40,.14)]">
                    {options.map((o, i) => {
                      const q = parsed.qty > 1 || parsed.unit ? ` × ${parsed.qty}${parsed.unit ? ` ${parsed.unit}` : ""}` : "";
                      return (
                        <div key={o.type === "cat" ? o.r.entry.id : "free"}>
                          {o.type === "free" && i > 0 && <div className="h-px bg-slate-100 dark:bg-slate-800 mx-1.5 my-1" />}
                          <button type="button" role="option" aria-selected={i === active} onClick={() => pick(o)} onMouseEnter={() => setActive(i)}
                            className={`w-full flex justify-between items-center gap-2.5 text-left px-3 py-2.5 rounded-lg text-[14.5px] text-slate-900 dark:text-slate-100 ${i === active ? "bg-slate-100 dark:bg-slate-800" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"}`}>
                            {o.type === "cat"
                              ? <><span>{o.r.entry.name}{q}</span><span className="text-xs font-bold text-green-700 dark:text-green-400 whitespace-nowrap">✓ Në katalog</span></>
                              : <><span>Shto „{capital(parsed.name)}”{q}</span><span className="text-xs font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">Jo në katalog</span></>}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
            <ErrorText id="errItems" msg={errors.items} />
          </section>

          {/* 2 — Lënda */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-3"><StepNum n={2} /><label htmlFor="lenda" className="text-[19px] font-extrabold text-slate-900 dark:text-white">Për cilën lëndë?</label></div>
            <div className="relative">
              <select id="lenda" ref={subjectRef} value={subjectId} aria-invalid={!!errors.subject} aria-describedby={errors.subject ? "errLenda" : undefined}
                onChange={e => { setSubjectId(e.target.value); if (e.target.value) setErrors(er => ({ ...er, subject: undefined })); }}
                className={`${fieldCls} ${border(errors.subject)} h-12 appearance-none pr-11 cursor-pointer`}>
                <option value="">Zgjidh lëndën…</option>
                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-4 w-4 h-4 text-slate-600 dark:text-slate-300 pointer-events-none" aria-hidden />
            </div>
            <ErrorText id="errLenda" msg={errors.subject} />
          </section>

          {/* 3 — Arsyeja */}
          <section className="flex flex-col gap-3">
            <div className="flex items-center gap-3"><StepNum n={3} /><label htmlFor="arsyeja" className="text-[19px] font-extrabold text-slate-900 dark:text-white">Arsyeja</label></div>
            <textarea id="arsyeja" ref={reasonRef} value={reason} spellCheck={false} aria-invalid={!!errors.reason} aria-describedby={errors.reason ? "errArsyeja" : undefined}
              onChange={e => { setReason(e.target.value); if (e.target.value.trim()) setErrors(er => ({ ...er, reason: undefined })); }}
              placeholder="P.sh. për projektin e klasës, për provimin, materiali ka mbaruar…"
              className={`${fieldCls} ${border(errors.reason)} min-h-[100px] resize-y py-3.5`} />
            <ErrorText id="errArsyeja" msg={errors.reason} />
          </section>

          <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-100 dark:border-slate-800 pt-5">
            <p className="text-sm text-slate-700 dark:text-slate-300" aria-live="polite">
              {items.length
                ? <><b className="text-slate-900 dark:text-white">{items.length} {items.length === 1 ? "artikull" : "artikuj"}</b>{inCat > 0 && ` · ${inCat} në katalog`}{outCat > 0 && ` · ${outCat} e shton administrata`}</>
                : "Asnjë artikull ende"}
            </p>
            <button type="submit" disabled={sending} className="w-full min-[620px]:w-auto h-[50px] px-[26px] rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-extrabold text-base inline-flex items-center justify-center gap-2 disabled:opacity-70 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500">
              {sending && <Loader2 className="w-5 h-5 animate-spin" aria-hidden />} Dërgo kërkesën
            </button>
            <ErrorText id="errForm" msg={errors.form} />
          </div>
        </form>
      )}

      {/* Kërkesat e mia */}
      <section aria-labelledby="histTitle" className="rounded-[18px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-[18px] min-[620px]:p-7 flex flex-col gap-4">
        <div className="flex justify-between items-center gap-3">
          <h2 id="histTitle" className="text-[19px] font-extrabold text-slate-900 dark:text-white">Kërkesat e mia</h2>
          {!!requests?.length && <span className="text-[13px] text-slate-600 dark:text-slate-300">{requests.length} {requests.length === 1 ? "kërkesë" : "kërkesa"}</span>}
        </div>
        {requests === null ? (
          <p className="text-center text-slate-600 dark:text-slate-300 py-4">Duke ngarkuar…</p>
        ) : requests.length === 0 ? (
          <div className="text-center text-slate-700 dark:text-slate-300 pt-4 pb-2"><b className="block text-slate-900 dark:text-white mb-1">Ende s&apos;ke bërë asnjë kërkesë.</b>Kërkesat që dërgon do të shfaqen këtu, bashkë me statusin e tyre.</div>
        ) : (
          <div className="flex flex-col gap-2.5">
            {requests.map(r => {
              const st = TEACHER_STATUS[statusKey(r.status)];
              const open = openIds.has(r.id);
              const n = r.items.length;
              return (
                <div key={r.id} className={`rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden ${flashReq === r.id ? "animate-ora-flash" : ""}`}>
                  <button type="button" aria-expanded={open} onClick={() => setOpenIds(s => { const x = new Set(s); if (x.has(r.id)) x.delete(r.id); else x.add(r.id); return x; })}
                    className="w-full text-left grid grid-cols-[1fr_20px] min-[620px]:grid-cols-[1fr_auto_20px] gap-x-3.5 gap-y-1.5 items-center px-4 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500">
                    <span>
                      <span className="block font-bold text-slate-900 dark:text-white">{r.subject?.name ?? "Pa lëndë"} – {n} {n === 1 ? "artikull" : "artikuj"}</span>
                      <span className="block text-[13px] text-slate-600 dark:text-slate-300 mt-0.5">{fmtWhen(r.createdAt)}</span>
                    </span>
                    <span className={`row-start-2 min-[620px]:row-start-1 min-[620px]:col-start-2 justify-self-start text-[12.5px] font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${st.cls}`}>{st.label}</span>
                    <ChevronDown className={`row-start-1 col-start-2 min-[620px]:col-start-3 w-[18px] h-[18px] text-slate-600 dark:text-slate-300 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
                  </button>
                  {open && (
                    <div className="border-t border-slate-100 dark:border-slate-800 px-4 pt-3 pb-4 flex flex-col gap-3">
                      <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                        {r.items.map((a, i) => {
                          const inCatalog = !a.isCustom && !!a.material && a.material.reviewStatus !== "pending";
                          return (
                            <li key={i} className="flex justify-between gap-3 py-2 text-slate-900 dark:text-slate-100">
                              <span>{(a.isCustom ? a.customItemName : a.material?.name) ?? "Artikull"} <b>× {a.quantity}{a.unit ? ` ${a.unit}` : ""}</b></span>
                              <span className={`text-[12.5px] font-bold whitespace-nowrap ${inCatalog ? "text-green-700 dark:text-green-400" : "text-amber-700 dark:text-amber-400"}`}>{inCatalog ? "✓ Në katalog" : "ⓘ E shton administrata"}</span>
                            </li>
                          );
                        })}
                      </ul>
                      <p className="text-sm text-slate-700 dark:text-slate-300"><b className="text-slate-900 dark:text-white">Arsyeja:</b> {r.reason}</p>
                      <div className="flex justify-end"><button type="button" onClick={() => repeat(r)} className={ghostBtn}>Përsërit kërkesën</button></div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Katalogu */}
      {modal && (
        <div className="fixed inset-0 z-50 bg-slate-950/45 flex items-center justify-center p-5"
          onMouseDown={e => { if (e.target === e.currentTarget) closeModal(); }}
          onKeyDown={e => { if (e.key === "Escape") closeModal(); }}>
          <div role="dialog" aria-modal="true" aria-labelledby="mTitle" className="w-full max-w-[520px] max-h-[80vh] flex flex-col overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900">
            <div className="flex justify-between items-center px-5 py-[18px] border-b border-slate-100 dark:border-slate-800">
              <h2 id="mTitle" className="text-lg font-extrabold text-slate-900 dark:text-white">Katalogu</h2>
              <button type="button" onClick={closeModal} aria-label="Mbyll katalogun" className="w-10 h-10 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-[18px] h-[18px]" /></button>
            </div>
            <div className="px-5 py-3 border-b border-slate-100 dark:border-slate-800">
              <label htmlFor="catSearch" className="sr-only">Kërko në katalog</label>
              <input id="catSearch" ref={catSearchRef} type="search" value={catSearch} onChange={e => setCatSearch(e.target.value)} autoComplete="off" placeholder="Kërko në katalog…" className={`${fieldCls} ${border()} h-11`} />
            </div>
            <div className="overflow-auto px-3 pt-2 pb-3">
              {catList.length === 0 ? (
                <p className="px-3 py-5 text-center text-slate-600 dark:text-slate-300">Nuk u gjet në katalog. Mbyllni dhe shkruajeni te „Shto artikull”: administrata do ta shtojë.</p>
              ) : catList.map(c => {
                const added = items.some(i => i.materialId === c.id);
                return (
                  <button key={c.id} type="button" onClick={() => fromCatalog(c, 1, null)}
                    className="w-full flex justify-between items-center gap-3 p-3 rounded-[10px] text-left text-[15px] text-slate-900 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800">
                    <span>{c.name} <span className="text-[13px] text-slate-600 dark:text-slate-300">({c.unit})</span></span>
                    {added
                      ? <span className="text-[12.5px] font-bold text-green-700 dark:text-green-400 whitespace-nowrap">✓ Shtuar</span>
                      : <span className="text-[13px] font-bold text-primary-700 dark:text-primary-300 whitespace-nowrap">+ Shto</span>}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Toast */}
      {toast && (
        <div role="status" className="fixed left-1/2 -translate-x-1/2 bottom-6 z-[60] max-w-[calc(100%-32px)] flex items-center gap-3.5 rounded-xl bg-slate-800 text-white text-sm pl-4 pr-3 py-2.5 shadow-lg">
          <span>{toast.text}</span>
          {toast.undo && <button type="button" onClick={undo} className="h-[34px] px-3 rounded-lg bg-white/15 hover:bg-white/25 font-bold">Zhbëj</button>}
        </div>
      )}
    </div>
  );
}

function StepNum({ n }: { n: number }) {
  return <span className="w-[30px] h-[30px] rounded-[9px] bg-primary-600 text-white font-extrabold flex items-center justify-center shrink-0" aria-hidden>{n}</span>;
}

function ErrorText({ msg, id }: { msg?: string; id: string }) {
  return msg ? <p id={id} role="alert" className="text-[13.5px] font-semibold text-red-700 dark:text-red-400">{msg}</p> : null;
}
