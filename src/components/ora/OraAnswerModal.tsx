"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Loader2, ThumbsUp, ThumbsDown, Sparkles, Info, MessageSquare, Download, UserRound, List } from "lucide-react";
import type { OraAnswer } from "@/ora/types";

export type OraResponse = OraAnswer & { queryId?: number | null; durationMs?: number };

const itemHref = (it: OraAnswer["items"][number]) => {
  switch (it.type) {
    case "student": return `/students?q=${encodeURIComponent(it.title)}&st=all`;
    case "family": return `/families/${it.id}`;
    case "staff": return `/sekretaria/stafi?staffId=${it.id}`;
    case "class": return `/classes/${it.id}`;
    case "request": return `/materialet/kerkesat/${it.id}`;
    case "application": return `/regjistrimet?tab=ALL&q=${encodeURIComponent(it.title)}`;
    default: return "#";
  }
};

// Kartela e përgjigjes së Orës — mbi faqen aktuale (faqja e zbehur prapa),
// mbyllet me Esc ose klik jashtë. Numrat/lista vijnë nga sistemi.
export default function OraAnswerModal({ question, loading, error, answer, onClose, onAsk, examples, previous }: {
  question: string;
  loading: boolean;
  error: string;
  answer: OraResponse | null;
  onClose: () => void;
  onAsk: (q: string) => void;
  examples: string[];
  previous: { question: string; answer: string } | null;
}) {
  const [rated, setRated] = useState<1 | -1 | null>(null);
  useEffect(() => { setRated(null); }, [answer?.queryId]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  async function rate(r: 1 | -1) {
    if (!answer?.queryId || rated) return;
    setRated(r);
    fetch("/api/ora/feedback", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ queryId: answer.queryId, rating: r }) }).catch(() => {});
  }

  const shown = answer?.items.slice(0, 5) ?? [];
  const more = (answer?.total_items ?? 0) - shown.length;

  return (
    <div className="fixed inset-0 z-[60] bg-slate-900/40 backdrop-blur-[2px] flex items-start justify-center p-4 pt-[10vh]" onMouseDown={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-label="Përgjigjja e Orës" className="w-full max-w-xl bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="flex items-start gap-3 px-5 pt-4 pb-3 border-b border-slate-100 dark:border-slate-800">
          <span className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 flex items-center justify-center shrink-0"><Sparkles className="w-4 h-4" /></span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Ora</p>
            <p className="text-sm text-slate-700 dark:text-slate-200 break-words">{question}</p>
          </div>
          <button onClick={onClose} aria-label="Mbyll" title="Mbyll (Esc)" className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
        </div>

        <div className="px-5 py-4 space-y-4 max-h-[65vh] overflow-y-auto">
          {loading && <p className="flex items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Ora po kërkon…</p>}
          {error && !loading && <p className="text-sm text-red-600">{error}</p>}

          {answer && !loading && (
            <>
              {answer.big_number && (
                <div>
                  <p className="text-4xl font-bold text-slate-900 dark:text-white leading-none">{answer.big_number.value}</p>
                  <p className="text-sm text-slate-500 mt-1">{answer.big_number.label}</p>
                </div>
              )}
              <p className="text-[15px] text-slate-800 dark:text-slate-100">{answer.answer.split(" Provo p.sh.:")[0]}</p>

              {answer.breakdown.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {answer.breakdown.slice(0, 18).map(b => (
                    <span key={b.label} className="text-xs px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">
                      <span className="text-slate-400">{b.label}:</span> <b className="font-semibold">{b.value}</b>
                    </span>
                  ))}
                </div>
              )}

              {shown.length > 0 && (
                <ul className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-100 dark:border-slate-800">
                  {shown.map(it => (
                    <li key={`${it.type}-${it.id}`}>
                      {answer.status === "CLARIFICATION" ? (
                        <button onClick={() => {
                          const cat = question.match(/ushqim\w*|uniform\w*|e-?shkollor\w*|libr\w*|anglisht\w*|shkollim\w*/i)?.[0];
                          onAsk(`Sa ka paguar ${it.title}${cat ? ` për ${cat}` : ""}?`);
                        }}
                          className="w-full text-left px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                          <span className="text-sm text-slate-800 dark:text-slate-100">{it.title}</span>
                          <span className="text-xs text-slate-400">{it.subtitle}</span>
                        </button>
                      ) : (
                        <Link href={itemHref(it)} onClick={onClose} className="px-3 py-2 flex items-center justify-between gap-2 hover:bg-slate-50 dark:hover:bg-slate-800/60">
                          <span className="min-w-0">
                            <span className="block text-sm text-slate-800 dark:text-slate-100 truncate">{it.title}</span>
                            {it.subtitle && <span className="block text-xs text-slate-400 truncate">{it.subtitle}</span>}
                          </span>
                          {it.badge && <span className="text-[11px] px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 shrink-0">{it.badge}</span>}
                        </Link>
                      )}
                    </li>
                  ))}
                  {more > 0 && <li className="px-3 py-2 text-xs text-slate-400">+ {more} të tjerë</li>}
                </ul>
              )}

              {answer.suggestions && answer.suggestions.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {answer.suggestions.map(s => <button key={s} onClick={() => onAsk(s)} className="text-xs px-2.5 py-1 rounded-full border border-primary-200 dark:border-primary-800 text-primary-700 dark:text-primary-300 hover:bg-primary-50 dark:hover:bg-primary-900/30">{s}</button>)}
                </div>
              )}

              {answer.actions.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {answer.actions.map(a => {
                    const href = String(a.params.href ?? "#");
                    const Icon = a.type === "send_sms" ? MessageSquare : a.type === "export" ? Download : a.type === "open_profile" ? UserRound : List;
                    return a.type === "export" ? (
                      <a key={a.label} href={href} download className="btn-secondary text-xs"><Icon className="w-3.5 h-3.5" /> {a.label}</a>
                    ) : (
                      <Link key={a.label} href={href} onClick={onClose} className={`text-xs ${a.type === "send_sms" ? "btn-primary" : "btn-secondary"}`}><Icon className="w-3.5 h-3.5" /> {a.label}</Link>
                    );
                  })}
                </div>
              )}

              <div className="flex items-center justify-between gap-3 pt-1">
                <p className="text-[11px] text-slate-400 flex items-start gap-1">
                  <Info className="w-3 h-3 mt-0.5 shrink-0" />
                  <span>Llogaritur nga sistemi{answer.source ? ` · ${answer.source}` : ""} · vetëm lexim, sipas lejeve të tua</span>
                </p>
                {answer.queryId && (
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => rate(1)} disabled={!!rated} aria-label="Përgjigje e mirë" title="Përgjigje e mirë"
                      className={`p-1.5 rounded-lg ${rated === 1 ? "text-green-600 bg-green-50 dark:bg-green-900/20" : "text-slate-400 hover:text-green-600 hover:bg-slate-100 dark:hover:bg-slate-800"} disabled:cursor-default`}><ThumbsUp className="w-4 h-4" /></button>
                    <button onClick={() => rate(-1)} disabled={!!rated} aria-label="Përgjigje e gabuar" title="Përgjigje e gabuar"
                      className={`p-1.5 rounded-lg ${rated === -1 ? "text-red-600 bg-red-50 dark:bg-red-900/20" : "text-slate-400 hover:text-red-600 hover:bg-slate-100 dark:hover:bg-slate-800"} disabled:cursor-default`}><ThumbsDown className="w-4 h-4" /></button>
                  </div>
                )}
              </div>
            </>
          )}

          {!loading && !answer && !error && (
            <OraEmptyState examples={examples} previous={previous} onAsk={onAsk} />
          )}
        </div>
      </div>
    </div>
  );
}

export function OraEmptyState({ examples, previous, onAsk }: { examples: string[]; previous: { question: string; answer: string } | null; onAsk: (q: string) => void }) {
  return (
    <div className="space-y-3">
      {previous && (
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Pyetja e mëparshme</p>
          <button onClick={() => onAsk(previous.question)} className="w-full text-left rounded-lg px-3 py-2 bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800">
            <span className="block text-xs text-slate-500">{previous.question}</span>
            <span className="block text-sm text-slate-700 dark:text-slate-200 truncate">{previous.answer}</span>
          </button>
        </div>
      )}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-1">Provo të pyesësh</p>
        <div className="flex flex-wrap gap-1.5">
          {examples.map(q => <button key={q} onClick={() => onAsk(q)} className="text-xs px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-primary-300 hover:text-primary-700">{q}</button>)}
        </div>
      </div>
    </div>
  );
}
