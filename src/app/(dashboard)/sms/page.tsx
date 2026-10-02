"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/layout/Header";
import { formatDateTime } from "@/lib/utils";
import { PERIOD_BUCKETS } from "@/lib/food-periods";
import { ACADEMIC_YEARS, DEFAULT_ACADEMIC_YEAR } from "@/lib/academicYear";
import {
  MessageSquare, Search, X, Loader2, CheckCircle, XCircle, History, Sparkles,
  GraduationCap, Utensils, Shirt, BookMarked, BookOpen, Megaphone, ListChecks, Users,
} from "lucide-react";
import {
  type MessageType, type MessageStatus, MESSAGE_TYPES, statusesForType, statusLabel,
} from "@/lib/smsStatus";
import { templateFor, variablesForType, fillTemplate, QUICK_TEMPLATES } from "@/lib/smsTemplates";
import { countSegments, stripAlbanianDiacritics } from "@/lib/smsSegments";
import SmsReviewModal, { type ReviewRow, type SkippedRow } from "@/components/sms/SmsReviewModal";

interface ClassOpt { id: number; name: string; level: string }

interface AudienceStudent {
  id: number; firstName: string; lastName: string;
  classId: number | null; className: string | null;
  phone: string | null; phoneKey: string | null; phoneValid: boolean;
  status: MessageStatus | null;
  paid: number; balance: number; dueDate: string | null;
}
interface Audience {
  type: MessageType;
  periodLabel: string | null;
  students: AudienceStudent[];
  unlinked: number;
  lastSent: Record<string, string>;
  duplicateWindowDays: number;
}

interface SmsLogRow {
  id: number; batchId: string | null; recipientPhone: string; recipientName: string | null;
  studentId: number | null;
  message: string; status: string; errorMessage: string | null; createdAt: string;
  sentBy: { name: string };
}

const TYPE_ICONS: Record<MessageType, typeof GraduationCap> = {
  SHKOLLIMI: GraduationCap, USHQIMI: Utensils, UNIFORMA: Shirt,
  ESHKOLLORI: BookMarked, LIBRAT: BookOpen, GENERAL: Megaphone,
};

// Parazgjedhja e statusit kur ndryshon lloji — një status i vetëm, që
// shablloni përkatës të ngarkohet menjëherë.
function defaultStatuses(type: MessageType): MessageStatus[] {
  if (type === "GENERAL") return [];
  return type === "SHKOLLIMI" ? ["OVERDUE"] : ["UNPAID"];
}

function currentFoodPeriod(): number {
  const now = new Date().getMonth() + 1;
  return (PERIOD_BUCKETS.find(p => p.months.includes(now)) ?? PERIOD_BUCKETS[0]).canonicalMonth;
}

const chip = (active: boolean) =>
  `inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium border transition-all ${
    active
      ? "bg-primary-50 dark:bg-primary-900/30 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300"
      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-primary-300"
  }`;

export default function SmsPage() {
  const searchParams = useSearchParams();
  const familyPhoneParam = searchParams.get("familyPhone") || "";

  /* ── Hapi 1: lloji ── */
  const [type, setType] = useState<MessageType>(familyPhoneParam ? "GENERAL" : "SHKOLLIMI");
  const [year, setYear] = useState(DEFAULT_ACADEMIC_YEAR);
  const [period, setPeriod] = useState(currentFoodPeriod);

  /* ── Hapi 2: statusi ── */
  const [statuses, setStatuses] = useState<MessageStatus[]>(defaultStatuses(familyPhoneParam ? "GENERAL" : "SHKOLLIMI"));

  /* ── Hapi 3: marrësit ── */
  const [recipientMode, setRecipientMode] = useState<"all" | "classes" | "individual">(familyPhoneParam ? "individual" : "all");
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>([]);
  const [selectedStudents, setSelectedStudents] = useState<{ id: number; name: string; className: string | null }[]>([]);
  const [individualQuery, setIndividualQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [familyMode, setFamilyMode] = useState(!!familyPhoneParam);

  /* ── Mesazhi ── */
  const [message, setMessage] = useState("");
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const [stripDiacritics, setStripDiacritics] = useState(false);

  const [audience, setAudience] = useState<Audience | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [audienceError, setAudienceError] = useState("");
  const [showReview, setShowReview] = useState(false);

  /* ── Historiku ── */
  const [history, setHistory] = useState<SmsLogRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historySearch, setHistorySearch] = useState("");
  const [historyFilter, setHistoryFilter] = useState<"all" | "today" | "week" | "failed">("all");

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const res = await fetch("/api/sms");
    if (res.ok) setHistory(await res.json());
    setLoadingHistory(false);
  }, []);

  const loadAudience = useCallback(async () => {
    setAudienceLoading(true);
    setAudienceError("");
    try {
      const params = new URLSearchParams({ type, year: String(year) });
      if (type === "USHQIMI") params.set("period", String(period));
      const res = await fetch(`/api/sms/audience?${params}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setAudience(null); setAudienceError(d.error || "Ngarkimi i nxënësve dështoi."); return; }
      setAudience(d);
    } catch {
      setAudience(null);
      setAudienceError("Gabim rrjeti — provo përsëri.");
    } finally {
      setAudienceLoading(false);
    }
  }, [type, year, period]);

  useEffect(() => {
    fetch("/api/classes").then(r => r.ok ? r.json() : []).then(setClasses).catch(() => {});
    loadHistory();
  }, [loadHistory]);

  useEffect(() => { loadAudience(); }, [loadAudience]);

  // Nga karta e Familjes (butoni "SMS") — fëmijët e familjes zgjidhen
  // automatikisht si marrës individualë, me "Një SMS për familje" aktiv.
  useEffect(() => {
    if (!familyPhoneParam) return;
    fetch(`/api/families?phone=${encodeURIComponent(familyPhoneParam)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        type Child = { id: number; firstName: string; lastName: string; status: string; class: { name: string } | null };
        const children: Child[] = (d?.families ?? []).flatMap((f: { children: Child[] }) => f.children)
          .filter((c: Child) => c.status === "ACTIVE");
        setSelectedStudents(children.map(c => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, className: c.class?.name ?? null })));
      })
      .catch(() => {});
  }, [familyPhoneParam]);

  // Shablloni ngarkohet kur zgjidhet lloj + NJË status; me disa statuse
  // njëherësh teksti aktual mbetet i paprekur.
  const statusesKey = statuses.join(",");
  useEffect(() => {
    const t = templateFor(type, statuses);
    if (t !== null) setMessage(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, statusesKey]);

  function changeType(t: MessageType) {
    if (t === type) return;
    setType(t);
    setStatuses(defaultStatuses(t));
  }
  function toggleStatus(s: MessageStatus) {
    setStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }
  function toggleClass(id: number) {
    setSelectedClassIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  /* ── Filtrimi: hapi 3 (fushëveprimi) → hapi 2 (statusi) ── */
  const students = useMemo(() => audience?.type === type ? audience.students : [], [audience, type]);

  const scopeStudents = useMemo(() => {
    if (recipientMode === "classes") return students.filter(s => s.classId !== null && selectedClassIds.includes(s.classId));
    if (recipientMode === "individual") {
      const ids = new Set(selectedStudents.map(s => s.id));
      return students.filter(s => ids.has(s.id));
    }
    return students;
  }, [students, recipientMode, selectedClassIds, selectedStudents]);

  // Numrat pranë statuseve — sipas fushëveprimit të hapit 3
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of scopeStudents) if (s.status) counts[s.status] = (counts[s.status] ?? 0) + 1;
    return counts;
  }, [scopeStudents]);

  const targetStudents = useMemo(() => {
    if (type === "GENERAL") return scopeStudents;
    return scopeStudents.filter(s => s.status && statuses.includes(s.status));
  }, [scopeStudents, statuses, type]);

  /* ── Ndërtimi i marrësve (dedup familjeje, anashkalimi pa numër) ── */
  const { reviewRows, skippedRows } = useMemo(() => {
    const skipped: SkippedRow[] = [];
    const valid: AudienceStudent[] = [];
    for (const s of targetStudents) {
      if (!s.phone) skipped.push({ key: `s-${s.id}`, names: `${s.firstName} ${s.lastName}`, classes: s.className ?? "", reason: "Pa numër telefoni" });
      else if (!s.phoneValid || !s.phoneKey) skipped.push({ key: `s-${s.id}`, names: `${s.firstName} ${s.lastName}`, classes: s.className ?? "", reason: `Numër i pavlefshëm (${s.phone})` });
      else valid.push(s);
    }
    const groups: AudienceStudent[][] = [];
    if (familyMode) {
      const byPhone = new Map<string, AudienceStudent[]>();
      for (const s of valid) {
        if (!byPhone.has(s.phoneKey!)) { byPhone.set(s.phoneKey!, []); groups.push(byPhone.get(s.phoneKey!)!); }
        byPhone.get(s.phoneKey!)!.push(s);
      }
    } else {
      for (const s of valid) groups.push([s]);
    }
    const rows: ReviewRow[] = groups.map(g => {
      const multi = g.length > 1;
      // Një SMS për familje: "Arta (5A) dhe Blerim (3B)"; {klasa} mbetet bosh
      const joinNames = (parts: string[]) => parts.length > 1 ? `${parts.slice(0, -1).join(", ")} dhe ${parts[parts.length - 1]}` : parts[0];
      const emri = multi
        ? joinNames(g.map(s => s.className ? `${s.firstName} (${s.className})` : s.firstName))
        : `${g[0].firstName} ${g[0].lastName}`;
      const klasa = multi ? "" : (g[0].className ?? "");
      const dueDates = g.map(s => s.dueDate).filter((d): d is string => !!d).sort();
      let text = fillTemplate(message, {
        emri, klasa,
        mbetja: g.reduce((s, x) => s + x.balance, 0),
        paguar: g.reduce((s, x) => s + x.paid, 0),
        afati: dueDates[0] ?? null,
      });
      if (stripDiacritics) text = stripAlbanianDiacritics(text);
      const statusSet = Array.from(new Set(g.map(s => s.status).filter((x): x is MessageStatus => !!x)));
      return {
        key: `p-${g[0].phoneKey}-${g[0].id}`,
        phone: g[0].phone!,
        names: multi ? emri : `${g[0].firstName} ${g[0].lastName}`,
        classes: Array.from(new Set(g.map(s => s.className).filter(Boolean))).join(", "),
        studentId: g[0].id,
        statusLabel: type === "GENERAL" ? "—" : statusSet.map(s => statusLabel(type, s)).join(", "),
        paymentStatus: statusSet.length ? statusSet.join(",") : null,
        message: text,
        recentAt: audience?.lastSent[g[0].phoneKey!] ?? null,
      };
    });
    return { reviewRows: rows, skippedRows: skipped };
  }, [targetStudents, familyMode, message, stripDiacritics, type, audience]);

  /* ── Numëruesi: mbi mesazhin më të gjatë pas zëvendësimit të variablave ── */
  const sampleText = useMemo(() => {
    if (reviewRows.length) return reviewRows.reduce((a, r) => (r.message.length > a.length ? r.message : a), "");
    let t = fillTemplate(message, { emri: "Arta Krasniqi", klasa: "5A", mbetja: 1000, paguar: 1000, afati: new Date().toISOString() });
    if (stripDiacritics) t = stripAlbanianDiacritics(t);
    return t;
  }, [reviewRows, message, stripDiacritics]);
  const seg = countSegments(sampleText);
  const hasDiacritics = /[ëËçÇ]/.test(message);

  /* ── Kërkimi individual (brenda nxënësve të llojit të zgjedhur) ── */
  const suggestions = useMemo(() => {
    const q = individualQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const chosen = new Set(selectedStudents.map(s => s.id));
    return students
      .filter(s => !chosen.has(s.id) && `${s.firstName} ${s.lastName}`.toLowerCase().includes(q))
      .slice(0, 20);
  }, [individualQuery, students, selectedStudents]);

  function insertToken(token: string) {
    const el = messageRef.current;
    if (!el) { setMessage(m => m + token); return; }
    const start = el.selectionStart ?? message.length;
    const end = el.selectionEnd ?? message.length;
    const next = message.slice(0, start) + token + message.slice(end);
    setMessage(next);
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + token.length; });
  }

  function openReview() {
    if (!message.trim() || !reviewRows.length) return;
    setShowReview(true);
  }

  /* ── Historiku ── */
  const groupedHistory = useMemo(() => {
    const groups: { key: string; rows: SmsLogRow[] }[] = [];
    const byBatch = new Map<string, SmsLogRow[]>();
    for (const row of history) {
      const key = row.batchId || `single-${row.id}`;
      if (!byBatch.has(key)) { byBatch.set(key, []); groups.push({ key, rows: byBatch.get(key)! }); }
      byBatch.get(key)!.push(row);
    }
    return groups;
  }, [history]);

  const filteredHistory = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const startOfWeek = new Date(startOfToday.getTime() - 6 * 86400000);
    return groupedHistory.filter(g => {
      if (q && !g.rows.some(r =>
        (r.recipientName ?? "").toLowerCase().includes(q) || r.recipientPhone.toLowerCase().includes(q)
      )) return false;
      if (historyFilter === "failed" && !g.rows.some(r => r.status === "FAILED")) return false;
      if (historyFilter === "today" && new Date(g.rows[0].createdAt) < startOfToday) return false;
      if (historyFilter === "week" && new Date(g.rows[0].createdAt) < startOfWeek) return false;
      return true;
    });
  }, [groupedHistory, historySearch, historyFilter]);

  // "Përdor përsëri" — teksti + nxënësit e atij dërgimi si marrës individualë
  function reuseMessage(g: { rows: SmsLogRow[] }) {
    setMessage(g.rows[0].message);
    const picked = g.rows.filter(r => r.studentId).map(r => ({
      id: r.studentId as number,
      name: (r.recipientName || r.recipientPhone).replace(/\s*\(prindi\)\s*$/i, ""),
      className: null,
    }));
    if (picked.length) {
      setRecipientMode("individual");
      setSelectedStudents(picked.filter((p, i) => picked.findIndex(x => x.id === p.id) === i));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const typeStatuses = statusesForType(type);
  const vars = variablesForType(type);

  return (
    <>
      <Header title="Mesazhe SMS" />
      <div className="p-6 max-w-4xl mx-auto space-y-5 animate-fade-in">
        <div className="card p-5 space-y-5">
          <h2 className="section-title flex items-center gap-1.5"><MessageSquare className="w-4 h-4 text-primary-500" /> Kërko Marrësit</h2>

          {/* ── 1. Lloji i mesazhit ── */}
          <div className="space-y-2">
            <p className="text-sm text-slate-500">1. Lloji i mesazhit</p>
            <div className="flex flex-wrap gap-2">
              {MESSAGE_TYPES.map(t => {
                const Icon = TYPE_ICONS[t.key];
                return (
                  <button key={t.key} type="button" onClick={() => changeType(t.key)} className={chip(type === t.key)}>
                    <Icon className="w-4 h-4" /> {t.label}
                  </button>
                );
              })}
            </div>
            {type !== "GENERAL" && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <select value={year} onChange={e => setYear(Number(e.target.value))} className="form-input w-auto py-1.5 text-sm">
                  {ACADEMIC_YEARS.map(y => <option key={y} value={y}>Viti {y}/{y + 1}</option>)}
                </select>
                {type === "USHQIMI" && (
                  <select value={period} onChange={e => setPeriod(Number(e.target.value))} className="form-input w-auto py-1.5 text-sm">
                    {PERIOD_BUCKETS.map(p => <option key={p.canonicalMonth} value={p.canonicalMonth}>{p.label}</option>)}
                  </select>
                )}
                {audienceLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" />}
              </div>
            )}
          </div>

          {/* ── 2. Statusi i pagesës ── */}
          {type !== "GENERAL" && (
            <div className="space-y-2">
              <p className="text-sm text-slate-500">2. Statusi i pagesës (mund të zgjedhësh disa)</p>
              <div className="flex flex-wrap gap-2">
                {typeStatuses.map(s => (
                  <button key={s.key} type="button" onClick={() => toggleStatus(s.key)} className={chip(statuses.includes(s.key))}>
                    {s.label}
                    <span className="text-xs px-1.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-300">
                      {statusCounts[s.key] ?? 0}
                    </span>
                  </button>
                ))}
              </div>
              {(type === "UNIFORMA" || type === "LIBRAT") && (audience?.unlinked ?? 0) > 0 && (
                <p className="text-xs text-slate-400">
                  {audience!.unlinked} shitje pa lidhje me nxënës aktiv — anashkalohen.
                </p>
              )}
            </div>
          )}

          {/* ── 3. Marrësit ── */}
          <div className="space-y-2">
            <p className="text-sm text-slate-500">{type === "GENERAL" ? "2" : "3"}. Marrësit</p>
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => setRecipientMode("all")} className={chip(recipientMode === "all")}>Të gjithë</button>
              <button type="button" onClick={() => setRecipientMode("classes")} className={chip(recipientMode === "classes")}>
                {recipientMode === "classes" && selectedClassIds.length
                  ? `Sipas klasave: ${classes.filter(c => selectedClassIds.includes(c.id)).map(c => c.name).join(", ")}`
                  : "Sipas klasave"}
              </button>
              <button type="button" onClick={() => setRecipientMode("individual")} className={chip(recipientMode === "individual")}>Individual</button>
              <button
                type="button"
                onClick={() => setFamilyMode(v => !v)}
                className={`${chip(familyMode)} sm:ml-auto`}
                title="Prindërit me disa fëmijë marrin vetëm një SMS"
              >
                <input type="checkbox" readOnly checked={familyMode} className="pointer-events-none" /> Një SMS për familje
              </button>
            </div>

            {recipientMode === "classes" && (
              <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                {classes.map(c => (
                  <button key={c.id} type="button" onClick={() => toggleClass(c.id)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-all ${
                      selectedClassIds.includes(c.id)
                        ? "bg-primary-600 border-primary-600 text-white"
                        : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-primary-400"
                    }`}>
                    {c.name}
                  </button>
                ))}
                {classes.length === 0 && <p className="text-xs text-slate-400">Asnjë klasë.</p>}
              </div>
            )}

            {recipientMode === "individual" && (
              <div className="space-y-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={individualQuery}
                    onChange={e => { setIndividualQuery(e.target.value); setShowSuggestions(true); }}
                    onFocus={() => setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    className="form-input pl-9"
                    placeholder="Kërko nxënësin me emër..."
                  />
                  {showSuggestions && suggestions.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                      {suggestions.map(s => (
                        <button
                          key={s.id}
                          type="button"
                          onMouseDown={() => {
                            setSelectedStudents(prev => [...prev, { id: s.id, name: `${s.firstName} ${s.lastName}`, className: s.className }]);
                            setIndividualQuery("");
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between gap-2"
                        >
                          <span>{s.firstName} {s.lastName}</span>
                          <span className="text-xs text-slate-400">
                            {s.className}{s.status && type !== "GENERAL" ? ` · ${statusLabel(type, s.status)}` : ""}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                {selectedStudents.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {selectedStudents.map(s => (
                      <span key={s.id} className="text-xs pl-2.5 pr-1 py-1 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 flex items-center gap-1.5">
                        {s.name}{s.className && <span className="text-primary-400">({s.className})</span>}
                        <button type="button" onClick={() => setSelectedStudents(prev => prev.filter(x => x.id !== s.id))} className="hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {type !== "GENERAL" && selectedStudents.length > scopeStudents.length && (
                  <p className="text-xs text-slate-400">
                    {selectedStudents.length - scopeStudents.length} nga të zgjedhurit s&apos;kanë të dhëna për këtë lloj pagese.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* ── Mesazhi ── */}
          <div className="space-y-2">
            <p className="text-sm text-slate-500">Mesazhi (shablloni ngarkohet automatikisht sipas statusit)</p>
            <div className="flex flex-wrap gap-1.5">
              {QUICK_TEMPLATES.map(t => (
                <button key={t.label} type="button" onClick={() => setMessage(t.text)}
                  className="text-xs px-2.5 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700 flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> {t.label}
                </button>
              ))}
            </div>
            <textarea
              ref={messageRef}
              value={message}
              onChange={e => setMessage(e.target.value)}
              className="form-input min-h-[100px] resize-none"
              placeholder={type !== "GENERAL" && statuses.length > 1 ? "Disa statuse të zgjedhura — shkruaj mesazhin..." : "Shkruaj mesazhin..."}
            />
            <div className="flex flex-wrap items-center gap-1.5">
              {vars.map(v => (
                <button key={v} type="button" onClick={() => insertToken(v)}
                  className="text-xs px-2.5 py-1 rounded-full border border-dashed border-primary-300 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20">
                  + {v}
                </button>
              ))}
              <label className="ml-auto flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                <input type="checkbox" checked={stripDiacritics} onChange={e => setStripDiacritics(e.target.checked)} />
                Dërgo pa ë/ç
              </label>
            </div>
            <p className={`text-xs ${seg.segments > 1 ? "text-amber-600 font-medium" : "text-slate-400"}`}>
              {seg.length} karaktere · {seg.segments} segment{seg.segments === 1 ? "" : "e"} ({seg.encoding})
              {seg.encoding === "Unicode" && hasDiacritics && !stripDiacritics && " — aktivizo \"Dërgo pa ë/ç\" për 160 karaktere për SMS"}
            </p>
          </div>

          {audienceError && <p className="text-sm text-red-500">{audienceError}</p>}

          {/* ── Përmbledhja ── */}
          <div className="flex items-center justify-between gap-3 pt-4 border-t border-slate-100 dark:border-slate-700 flex-wrap">
            <p className="text-sm text-slate-500 flex items-center gap-1.5 flex-wrap">
              <Users className="w-4 h-4" />
              {reviewRows.length} marrës · {seg.segments} segment{seg.segments === 1 ? "" : "e"}
              {skippedRows.length > 0 && <span className="text-amber-600"> · {skippedRows.length} pa numër të vlefshëm</span>}
              {reviewRows.length > 0 && (
                <button type="button" onClick={openReview} disabled={!message.trim()} className="text-primary-600 hover:text-primary-700 font-medium disabled:opacity-50">
                  · Shiko listën
                </button>
              )}
            </p>
            <button
              type="button"
              onClick={openReview}
              disabled={!reviewRows.length || !message.trim() || audienceLoading}
              className="btn-secondary"
            >
              <ListChecks className="w-4 h-4" /> Rishiko dhe dërgo
            </button>
          </div>
          {type !== "GENERAL" && statuses.length === 0 && (
            <p className="text-xs text-amber-600">Zgjidh të paktën një status pagese.</p>
          )}
          {recipientMode === "classes" && selectedClassIds.length === 0 && (
            <p className="text-xs text-amber-600">Zgjidh të paktën një klasë.</p>
          )}
        </div>

        {/* History */}
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 p-5 border-b border-slate-100 dark:border-slate-700">
            <History className="w-4 h-4 text-primary-500" />
            <h2 className="section-title">Historiku i Mesazheve</h2>
          </div>
          {!loadingHistory && groupedHistory.length > 0 && (
            <div className="px-5 pt-4 pb-1 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                <input
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  className="form-input pl-8 py-1.5 text-sm"
                  placeholder="Kërko sipas emrit ose telefonit..."
                />
              </div>
              <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg w-fit flex-wrap">
                {([["all", "Të gjitha"], ["today", "Sot"], ["week", "Këtë javë"], ["failed", "Vetëm dështimet"]] as const).map(([key, label]) => (
                  <button
                    key={key}
                    onClick={() => setHistoryFilter(key)}
                    className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${historyFilter === key ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}
          {loadingHistory ? (
            <p className="text-sm text-slate-400 text-center py-8">Duke ngarkuar...</p>
          ) : groupedHistory.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Ende s&apos;është dërguar asnjë SMS.</p>
          ) : filteredHistory.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Asnjë mesazh s&apos;përputhet me këto kritere.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {filteredHistory.map(g => {
                const first = g.rows[0];
                const sentCount = g.rows.filter(r => r.status === "SENT").length;
                const failedCount = g.rows.filter(r => r.status === "FAILED").length;
                return (
                  <div key={g.key} className="p-4 group">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-700 dark:text-slate-200 line-clamp-2">{first.message}</p>
                        <p className="text-xs text-slate-400 mt-1">
                          {g.rows.length > 1 ? `${g.rows.length} marrës` : (first.recipientName || first.recipientPhone)}
                          {" · "}{first.sentBy.name} · {formatDateTime(first.createdAt)}
                        </p>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0 text-xs">
                        {sentCount > 0 && <span className="flex items-center gap-1 text-green-600"><CheckCircle className="w-3.5 h-3.5" />{sentCount}</span>}
                        {failedCount > 0 && <span className="flex items-center gap-1 text-red-500"><XCircle className="w-3.5 h-3.5" />{failedCount}</span>}
                        <button
                          onClick={() => reuseMessage(g)}
                          title="Përdor përsëri"
                          className="text-slate-300 group-hover:text-primary-600 hover:text-primary-700 transition-colors font-medium px-1.5"
                        >
                          ↺
                        </button>
                      </div>
                    </div>
                    {failedCount > 0 && (
                      <div className="mt-2 space-y-0.5">
                        {g.rows.filter(r => r.status === "FAILED").map(r => (
                          <p key={r.id} className="text-xs text-red-500">{r.recipientName || r.recipientPhone}: {r.errorMessage}</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {showReview && (
        <SmsReviewModal
          rows={reviewRows}
          skipped={skippedRows}
          type={type}
          windowDays={audience?.duplicateWindowDays ?? 3}
          onClose={() => setShowReview(false)}
          onSent={() => { loadHistory(); loadAudience(); }}
        />
      )}
    </>
  );
}
