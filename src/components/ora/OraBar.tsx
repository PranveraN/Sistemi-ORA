"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search, Sparkles, GraduationCap, UserRound, X, CornerDownLeft } from "lucide-react";
import OraAnswerModal, { OraEmptyState, type OraResponse } from "./OraAnswerModal";

interface StudentHit { id: number; name: string; className: string | null; active: boolean; matchedParent: string | null; href: string }
interface StaffHit { id: number; name: string; role: string | null; href: string }
type Option = { kind: "ask" } | { kind: "student"; hit: StudentHit } | { kind: "staff"; hit: StaffHit };

const QUESTION_START = /^(sa|kush|cila|cili|cilat|cilet|cilët|a|si|ku|kur|numri|lista|me trego|më trego|trego)\b/i;
/** Teksti duket si pyetje → "Pyet Orën" bëhet zgjedhja e parë. */
export const looksLikeQuestion = (q: string) => QUESTION_START.test(q.trim()) || q.trim().endsWith("?");

const LAST_KEY = "ora_last";
function readLast(): { question: string; answer: string } | null {
  try { return JSON.parse(localStorage.getItem(LAST_KEY) || "null"); } catch { return null; }
}

// "Pyet Orën ose kërko…" — në shiritin e sipërm të çdo faqeje (Ctrl K / ⌘K).
// Kërkimi i emrave del menjëherë (pa Orën); pyetjet i shkojnë /api/ora/ask.
export default function OraBar() {
  const router = useRouter();
  const [available, setAvailable] = useState(false);
  const [examples, setExamples] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [students, setStudents] = useState<StudentHit[]>([]);
  const [staff, setStaff] = useState<StaffHit[]>([]);
  const [active, setActive] = useState(0);
  const [modal, setModal] = useState<{ question: string; loading: boolean; error: string; answer: OraResponse | null } | null>(null);
  const [previous, setPrevious] = useState<{ question: string; answer: string } | null>(null);
  const [isMac, setIsMac] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const mobileInputRef = useRef<HTMLInputElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
    setPrevious(readLast());
    fetch("/api/ora/status").then(r => (r.ok ? r.json() : null)).then(d => {
      if (d?.available) { setAvailable(true); setExamples(d.examples ?? []); }
    }).catch(() => {});
  }, []);

  // Ctrl K / ⌘K
  useEffect(() => {
    if (!available) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        if (window.matchMedia("(min-width: 768px)").matches) { inputRef.current?.focus(); setOpen(true); }
        else { setMobileOpen(true); setTimeout(() => mobileInputRef.current?.focus(), 50); }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [available]);

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!boxRef.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  // Kërkimi i emrave — menjëherë, pa pritur Orën
  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) { setStudents([]); setStaff([]); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/ora/search?q=${encodeURIComponent(term)}`);
        const d = r.ok ? await r.json() : { students: [], staff: [] };
        setStudents(d.students ?? []); setStaff(d.staff ?? []);
      } catch { setStudents([]); setStaff([]); }
    }, 180);
    return () => clearTimeout(t);
  }, [q]);

  const isQuestion = looksLikeQuestion(q);
  const options: Option[] = q.trim().length >= 2
    ? (isQuestion || (!students.length && !staff.length)
        ? [{ kind: "ask" } as Option, ...students.map(hit => ({ kind: "student", hit }) as Option), ...staff.map(hit => ({ kind: "staff", hit }) as Option)]
        : [...students.map(hit => ({ kind: "student", hit }) as Option), ...staff.map(hit => ({ kind: "staff", hit }) as Option), { kind: "ask" } as Option])
    : [];
  useEffect(() => { setActive(0); }, [q, students.length, staff.length]);

  const ask = useCallback(async (question: string) => {
    const text = question.trim();
    if (text.length < 2) return;
    setOpen(false); setMobileOpen(false); setQ("");
    inputRef.current?.blur();
    setModal({ question: text, loading: true, error: "", answer: null });
    try {
      const r = await fetch("/api/ora/ask", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ question: text }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setModal({ question: text, loading: false, error: d.error || "Ora nuk u përgjigj.", answer: null }); return; }
      setModal({ question: text, loading: false, error: "", answer: d });
      const last = { question: text, answer: (d.big_number ? `${d.big_number.value} — ` : "") + String(d.answer ?? "").split(" Provo p.sh.:")[0] };
      setPrevious(last);
      try { localStorage.setItem(LAST_KEY, JSON.stringify(last)); } catch { /* s'ka rëndësi */ }
    } catch {
      setModal({ question: text, loading: false, error: "Gabim rrjeti — provo përsëri.", answer: null });
    }
  }, []);

  function choose(o: Option) {
    if (o.kind === "ask") return ask(q);
    setOpen(false); setMobileOpen(false); setQ("");
    router.push(o.hit.href);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive(a => Math.min(options.length - 1, a + 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive(a => Math.max(0, a - 1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (options[active]) choose(options[active]); else ask(q); }
    else if (e.key === "Escape") { setOpen(false); setMobileOpen(false); (e.target as HTMLInputElement).blur(); }
  }

  if (!available) return null;

  const panel = (
    <div className="py-1">
      {q.trim().length < 2 ? (
        <div className="px-3 py-2"><OraEmptyState examples={examples} previous={previous} onAsk={ask} /></div>
      ) : (
        <ul role="listbox" aria-label="Rezultatet">
          {options.map((o, i) => {
            const sel = i === active;
            const base = `w-full text-left px-3 py-2 flex items-center gap-2.5 ${sel ? "bg-primary-50 dark:bg-primary-900/30" : "hover:bg-slate-50 dark:hover:bg-slate-800/60"}`;
            if (o.kind === "ask") {
              return (
                <li key="ask" role="option" aria-selected={sel}>
                  <button onMouseEnter={() => setActive(i)} onClick={() => choose(o)} className={base}>
                    <Sparkles className="w-4 h-4 text-primary-500 shrink-0" />
                    <span className="text-sm text-slate-800 dark:text-slate-100 truncate">Pyet Orën: <b>{q.trim()}</b></span>
                    {sel && <CornerDownLeft className="w-3.5 h-3.5 text-slate-400 ml-auto shrink-0" />}
                  </button>
                </li>
              );
            }
            const isStudent = o.kind === "student";
            return (
              <li key={`${o.kind}-${o.hit.id}`} role="option" aria-selected={sel}>
                <button onMouseEnter={() => setActive(i)} onClick={() => choose(o)} className={base}>
                  {isStudent ? <GraduationCap className="w-4 h-4 text-blue-500 shrink-0" /> : <UserRound className="w-4 h-4 text-teal-500 shrink-0" />}
                  <span className="min-w-0">
                    <span className="block text-sm text-slate-800 dark:text-slate-100 truncate">{o.hit.name}</span>
                    <span className="block text-[11px] text-slate-400 truncate">
                      {isStudent
                        ? [(o.hit as StudentHit).className, (o.hit as StudentHit).matchedParent ? `prindi: ${(o.hit as StudentHit).matchedParent}` : null, (o.hit as StudentHit).active ? null : "joaktiv"].filter(Boolean).join(" · ") || "Nxënës"
                        : (o.hit as StaffHit).role ?? "Staf"}
                    </span>
                  </span>
                  {sel && <CornerDownLeft className="w-3.5 h-3.5 text-slate-400 ml-auto shrink-0" />}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop: fusha në mes të shiritit */}
      <div ref={boxRef} className="relative hidden md:block w-full max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
        <input
          ref={inputRef}
          value={q}
          onChange={e => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Pyet Orën ose kërko…"
          aria-label="Pyet Orën ose kërko"
          className="w-full h-9 pl-9 pr-16 rounded-xl bg-slate-100 dark:bg-slate-800 border border-transparent focus:border-primary-300 focus:bg-white dark:focus:bg-slate-900 text-sm text-slate-800 dark:text-slate-100 placeholder:text-slate-400 outline-none transition-colors"
        />
        <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] font-medium text-slate-400 border border-slate-200 dark:border-slate-700 rounded px-1.5 py-0.5 pointer-events-none">{isMac ? "⌘ K" : "Ctrl K"}</kbd>
        {open && (
          <div className="absolute z-50 mt-1 w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl max-h-[70vh] overflow-y-auto">
            {panel}
          </div>
        )}
      </div>

      {/* Telefon: ikonë që hap fushën në ekran të plotë */}
      <button onClick={() => { setMobileOpen(true); setTimeout(() => mobileInputRef.current?.focus(), 50); }} className="md:hidden w-9 h-9 flex items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label="Pyet Orën ose kërko" title="Pyet Orën ose kërko">
        <Search className="w-4 h-4" />
      </button>
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-[55] bg-white dark:bg-slate-900 flex flex-col">
          <div className="flex items-center gap-2 p-3 border-b border-slate-200 dark:border-slate-700">
            <Search className="w-4 h-4 text-slate-400 shrink-0" />
            <input ref={mobileInputRef} value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKeyDown} placeholder="Pyet Orën ose kërko…" aria-label="Pyet Orën ose kërko" className="flex-1 bg-transparent outline-none text-base text-slate-800 dark:text-slate-100" />
            <button onClick={() => { setMobileOpen(false); setQ(""); }} aria-label="Mbyll" className="p-1.5 rounded-lg text-slate-400"><X className="w-5 h-5" /></button>
          </div>
          <div className="flex-1 overflow-y-auto">{panel}</div>
        </div>
      )}

      {modal && (
        <OraAnswerModal
          question={modal.question} loading={modal.loading} error={modal.error} answer={modal.answer}
          examples={examples} previous={previous}
          onClose={() => setModal(null)} onAsk={ask}
        />
      )}
    </>
  );
}
