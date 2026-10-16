"use client";

import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/layout/Header";
import { formatDateTime } from "@/lib/utils";
import { PERIOD_BUCKETS } from "@/lib/food-periods";
import { ACADEMIC_YEARS, DEFAULT_ACADEMIC_YEAR } from "@/lib/academicYear";
import { Search, X, Loader2, AlertTriangle, ChevronRight, Send, FlaskConical, RotateCcw } from "lucide-react";
import {
  type MessageType, type MessageStatus, MESSAGE_TYPES, statusesForType, statusLabel, STATUS_COLORS,
} from "@/lib/smsStatus";
import { templateFor, variablesForType, fillTemplate, QUICK_TEMPLATES, SMS_TEMPLATES } from "@/lib/smsTemplates";
import { countSegments, stripAlbanianDiacritics } from "@/lib/smsSegments";
import SmsReviewModal, { type ReviewRow, type SkippedRow } from "@/components/sms/SmsReviewModal";
import ExportExcelButton from "@/components/ui/ExportExcelButton";
import { xlDate } from "@/lib/exportExcel";

// Mesazhe SMS: (1) qëllimi → filtrat + shablloni, (2) mesazhi, (3) pamja e mesazhit
// me vlerat e marrësit të parë dhe dërgimi. Dërgimi bëhet si më parë: vetëm pas
// rishikimit te SmsReviewModal → /api/sms/send (mbrojtja nga dërgimi i dyfishtë).

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
  messageType?: string | null; paymentStatus?: string | null;
  sentBy: { name: string };
}

type Intent = "debt" | "all" | "classes" | "one";

const INTENTS: { key: Intent; title: string; desc: string }[] = [
  { key: "debt",    title: "Kujtesë borxhi",      desc: "Prindërit që kanë borxh. Shuma dhe afati plotësohen vetë." },
  { key: "all",     title: "Njoftim për të gjithë", desc: "Pushime, mbledhje, ndryshim orari." },
  { key: "classes", title: "Sipas klasave",       desc: "Mesazh për një ose disa klasa." },
  { key: "one",     title: "Një prind",           desc: "Kërko nxënësin me emër. Pa filtra statusi." },
];

// Statuset "me borxh" — parazgjedhja e "Kujtesë borxhi"
function debtStatuses(type: MessageType): MessageStatus[] {
  if (type === "GENERAL") return [];
  return type === "SHKOLLIMI" ? ["UNPAID", "PARTIAL", "OVERDUE", "TIMI_INVEST"] : ["UNPAID", "PARTIAL"];
}
const DEBT_NOUN: Partial<Record<MessageType, string>> = {
  SHKOLLIMI: "shkollimin", USHQIMI: "ushqimin", UNIFORMA: "uniformën", ESHKOLLORI: "eShkollorin", LIBRAT: "librat e anglishtes",
};
function debtTemplate(type: MessageType): string {
  const afati = variablesForType(type).includes("{afati}") ? " Afati: {afati}." : "";
  return `Përshëndetje, {emri} ka për të paguar {mbetja} € për ${DEBT_NOUN[type] ?? "pagesën"} {viti}.${afati} Faleminderit, Akademia Ora`;
}
function defaultStatuses(type: MessageType): MessageStatus[] {
  if (type === "GENERAL") return [];
  return type === "SHKOLLIMI" ? ["OVERDUE"] : ["UNPAID"];
}
function currentFoodPeriod(): number {
  const now = new Date().getMonth() + 1;
  return (PERIOD_BUCKETS.find(p => p.months.includes(now)) ?? PERIOD_BUCKETS[0]).canonicalMonth;
}

const TEST_PHONE_KEY = "smsTestPhone";
const readLs = (k: string) => { try { return localStorage.getItem(k) ?? ""; } catch { return ""; } };
const writeLs = (k: string, v: string) => { try { localStorage.setItem(k, v); } catch { /* s'ka rëndësi */ } };

export default function SmsPage() {
  const searchParams = useSearchParams();
  const familyPhoneParam = searchParams.get("familyPhone") || "";
  const studentsParam = searchParams.get("students") || "";   // nga faqja e Nxënësve
  const classesParam = searchParams.get("classes") || "";     // nga faqja e klasës
  const textParam = searchParams.get("text") || "";           // p.sh. linku i një dokumenti (Dokumentet → "Dërgo linkun me SMS")
  const preselected = !!(familyPhoneParam || studentsParam);
  const initialIntent: Intent = preselected ? "one" : classesParam ? "classes" : textParam ? "all" : "debt";
  const initialType: MessageType = initialIntent === "debt" ? "SHKOLLIMI" : "GENERAL";

  const [intent, setIntent] = useState<Intent>(initialIntent);
  const [type, setType] = useState<MessageType>(initialType);
  const [year, setYear] = useState(DEFAULT_ACADEMIC_YEAR);
  const [period, setPeriod] = useState(currentFoodPeriod);
  const [statuses, setStatuses] = useState<MessageStatus[]>(initialIntent === "debt" ? debtStatuses("SHKOLLIMI") : []);

  const [recipientMode, setRecipientMode] = useState<"all" | "classes" | "individual">(preselected ? "individual" : classesParam ? "classes" : "all");
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [selectedClassIds, setSelectedClassIds] = useState<number[]>(() => classesParam.split(",").map(Number).filter(n => n > 0));
  const [selectedStudents, setSelectedStudents] = useState<{ id: number; name: string; className: string | null }[]>([]);
  const [individualQuery, setIndividualQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [familyMode, setFamilyMode] = useState(true);

  const [message, setMessage] = useState(textParam || (initialIntent === "debt" ? debtTemplate("SHKOLLIMI") : SMS_TEMPLATES.GENERAL));
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const templateRef = useRef<HTMLSelectElement>(null);
  const historyRef = useRef<HTMLDivElement>(null);
  const [stripDiacritics, setStripDiacritics] = useState(true);

  const [audience, setAudience] = useState<Audience | null>(null);
  const [audienceLoading, setAudienceLoading] = useState(false);
  const [audienceError, setAudienceError] = useState("");
  const [showReview, setShowReview] = useState(false);
  const [showSkipped, setShowSkipped] = useState(false);
  const [testing, setTesting] = useState(false);

  const [history, setHistory] = useState<SmsLogRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [historyTab, setHistoryTab] = useState<"all" | "failed">("all");
  const [openBatch, setOpenBatch] = useState<string | null>(null);
  const [resending, setResending] = useState<string | null>(null);

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

  // Nga karta e Familjes (butoni "SMS") — fëmijët e familjes si marrës individualë
  useEffect(() => {
    if (!familyPhoneParam) return;
    fetch(`/api/families?phone=${encodeURIComponent(familyPhoneParam)}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        type Child = { id: number; firstName: string; lastName: string; status: string; class: { name: string } | null };
        const children: Child[] = (d?.families ?? []).flatMap((f: { children: Child[] }) => f.children).filter((c: Child) => c.status === "ACTIVE");
        setSelectedStudents(children.map(c => ({ id: c.id, name: `${c.firstName} ${c.lastName}`, className: c.class?.name ?? null })));
      })
      .catch(() => {});
  }, [familyPhoneParam]);

  useEffect(() => {
    if (!studentsParam) return;
    const ids = studentsParam.split(",").map(Number).filter(n => n > 0).slice(0, 500);
    if (!ids.length) return;
    fetch(`/api/students/table?ids=${ids.join(",")}&limit=500`)
      .then(r => r.ok ? r.json() : null)
      .then(d => {
        type R = { id: number; firstName: string; lastName: string; className: string | null };
        const list: R[] = d?.rows ?? [];
        setSelectedStudents(list.map(s => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, className: s.className })));
      })
      .catch(() => {});
  }, [studentsParam]);

  /* ── Qëllimi: plotëson filtrat dhe shabllonin ── */
  function chooseIntent(i: Intent) {
    setIntent(i);
    if (i === "debt") {
      const t = type === "GENERAL" ? "SHKOLLIMI" : type;
      setType(t); setRecipientMode("all"); setStatuses(debtStatuses(t)); setMessage(debtTemplate(t));
    } else if (i === "all") {
      setType("GENERAL"); setRecipientMode("all"); setStatuses([]); setMessage(SMS_TEMPLATES.GENERAL);
    } else if (i === "classes") {
      setType("GENERAL"); setRecipientMode("classes"); setStatuses([]); setMessage(SMS_TEMPLATES.GENERAL);
    } else {
      setType("GENERAL"); setRecipientMode("individual"); setStatuses([]); setMessage(SMS_TEMPLATES.GENERAL);
    }
  }
  function changeType(t: MessageType) {
    if (t === type) return;
    setType(t);
    if (intent === "debt" && t !== "GENERAL") { setStatuses(debtStatuses(t)); setMessage(debtTemplate(t)); return; }
    const st = intent === "one" ? [] : defaultStatuses(t);
    setStatuses(st);
    const tpl = templateFor(t, st);
    if (tpl !== null) setMessage(tpl);
  }
  function toggleStatus(s: MessageStatus) {
    setStatuses(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  }
  function toggleClass(id: number) {
    setSelectedClassIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  /* ── Filtrimi ── */
  const students = useMemo(() => audience?.type === type ? audience.students : [], [audience, type]);
  const scopeStudents = useMemo(() => {
    if (recipientMode === "classes") return students.filter(s => s.classId !== null && selectedClassIds.includes(s.classId));
    if (recipientMode === "individual") {
      const ids = new Set(selectedStudents.map(s => s.id));
      return students.filter(s => ids.has(s.id));
    }
    return students;
  }, [students, recipientMode, selectedClassIds, selectedStudents]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of scopeStudents) if (s.status) counts[s.status] = (counts[s.status] ?? 0) + 1;
    return counts;
  }, [scopeStudents]);

  // Statusi është opsional: pa asnjë të zgjedhur (ose te "Një prind") → të gjithë
  const statusFilterOn = type !== "GENERAL" && intent !== "one" && statuses.length > 0;
  const targetStudents = useMemo(
    () => (statusFilterOn ? scopeStudents.filter(s => s.status && statuses.includes(s.status)) : scopeStudents),
    [scopeStudents, statuses, statusFilterOn],
  );

  const yearText = `${year}/${year + 1}`;
  const personalize = useCallback((text: string) => {
    let t = text.replace(/Afati:\s*\./g, "").replace(/ {2,}/g, " ").trim();
    if (stripDiacritics) t = stripAlbanianDiacritics(t);
    return t;
  }, [stripDiacritics]);

  /* ── Marrësit (familje, pa numër) — si më parë ── */
  const { reviewRows, skippedRows, validCount } = useMemo(() => {
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
    const msg = message.replaceAll("{viti}", type === "GENERAL" ? "" : yearText);
    const rows: ReviewRow[] = groups.map(g => {
      const multi = g.length > 1;
      const joinNames = (parts: string[]) => parts.length > 1 ? `${parts.slice(0, -1).join(", ")} dhe ${parts[parts.length - 1]}` : parts[0];
      const emri = multi ? joinNames(g.map(s => s.className ? `${s.firstName} (${s.className})` : s.firstName)) : `${g[0].firstName} ${g[0].lastName}`;
      const dueDates = g.map(s => s.dueDate).filter((d): d is string => !!d).sort();
      const text = personalize(fillTemplate(msg, {
        emri, klasa: multi ? "" : (g[0].className ?? ""),
        mbetja: g.reduce((s, x) => s + x.balance, 0),
        paguar: g.reduce((s, x) => s + x.paid, 0),
        afati: dueDates[0] ?? null,
      }));
      const statusSet = Array.from(new Set(g.map(s => s.status).filter((x): x is MessageStatus => !!x)));
      return {
        key: `p-${g[0].phoneKey}-${g[0].id}`,
        phone: g[0].phone!,
        names: multi ? emri : `${g[0].firstName} ${g[0].lastName}`,
        classes: Array.from(new Set(g.map(s => s.className).filter(Boolean))).join(", "),
        studentId: g[0].id,
        studentIds: g.map(s => s.id),
        statusLabel: type === "GENERAL" ? "—" : statusSet.map(s => statusLabel(type, s)).join(", "),
        paymentStatus: statusSet.length ? statusSet.join(",") : null,
        message: text,
        recentAt: audience?.lastSent[g[0].phoneKey!] ?? null,
      };
    });
    return { reviewRows: rows, skippedRows: skipped, validCount: valid.length };
  }, [targetStudents, familyMode, message, type, audience, yearText, personalize]);

  const previewRow = reviewRows[0] ?? null;
  const sampleText = useMemo(() => {
    if (reviewRows.length) return reviewRows.reduce((a, r) => (r.message.length > a.length ? r.message : a), "");
    return personalize(fillTemplate(message.replaceAll("{viti}", yearText), { emri: "Arta Krasniqi", klasa: "5A", mbetja: 1000, paguar: 1000, afati: new Date().toISOString() }));
  }, [reviewRows, message, yearText, personalize]);
  const seg = countSegments(sampleText);
  const segWithAccents = countSegments(fillTemplate(message, { emri: "Arta Krasniqi", klasa: "5A", mbetja: 1000, paguar: 1000, afati: new Date().toISOString() })).segments;
  const totalSms = useMemo(() => reviewRows.reduce((s, r) => s + countSegments(r.message).segments, 0), [reviewRows]);

  const suggestions = useMemo(() => {
    const q = individualQuery.trim().toLowerCase();
    if (q.length < 2) return [];
    const chosen = new Set(selectedStudents.map(s => s.id));
    return students.filter(s => !chosen.has(s.id) && `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)).slice(0, 20);
  }, [individualQuery, students, selectedStudents]);

  function insertToken(token: string) {
    const el = messageRef.current;
    if (!el) { setMessage(m => m + token); return; }
    const start = el.selectionStart ?? message.length, end = el.selectionEnd ?? message.length;
    setMessage(message.slice(0, start) + token + message.slice(end));
    requestAnimationFrame(() => { el.focus(); el.selectionStart = el.selectionEnd = start + token.length; });
  }

  /* ── Shabllonet (lista) ── */
  const templateOptions = useMemo(() => {
    const opts: { label: string; text: string }[] = [];
    if (type !== "GENERAL") opts.push({ label: "Kujtesë borxhi", text: debtTemplate(type) });
    for (const s of statusesForType(type)) {
      const t = SMS_TEMPLATES[`${type}:${s.key}`];
      if (t) opts.push({ label: `${MESSAGE_TYPES.find(m => m.key === type)?.label} — ${s.label}`, text: t });
    }
    opts.push({ label: "Njoftim i përgjithshëm", text: SMS_TEMPLATES.GENERAL });
    for (const q of QUICK_TEMPLATES) if (!opts.some(o => o.label === q.label)) opts.push(q);
    return opts;
  }, [type]);
  const currentTemplate = templateOptions.find(o => o.text === message)?.label ?? "";

  /* ── Dërgo provë te numri im (i njëjti /api/sms/send, një marrës) ── */
  async function sendTest() {
    if (!previewRow) return;
    const phone = window.prompt("Numri yt i telefonit për provën (p.sh. 044123456):", readLs(TEST_PHONE_KEY));
    if (!phone?.trim()) return;
    writeLs(TEST_PHONE_KEY, phone.trim());
    setTesting(true);
    const r = await fetch("/api/sms/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "", recipients: [{ phone: phone.trim(), name: "PROVË (stafi)", message: previewRow.message }] }),
    }).catch(() => null);
    setTesting(false);
    const d = r ? await r.json().catch(() => ({})) : {};
    alert(r?.ok ? (d.failed ? `Prova dështoi: ${(d.errors ?? []).join(", ")}` : "Prova u dërgua. Kontrollo telefonin.") : (d.error || "Prova dështoi."));
    loadHistory();
  }

  /* ── Historiku i grupuar sipas dërgimit ── */
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
  const shownHistory = historyTab === "failed" ? groupedHistory.filter(g => g.rows.some(r => r.status === "FAILED")) : groupedHistory;

  function sendKind(g: { rows: SmsLogRow[] }): string {
    const f = g.rows[0];
    if (f.recipientName?.startsWith("PROVË")) return "Provë";
    if (f.messageType && f.messageType !== "GENERAL") {
      const st = (f.paymentStatus ?? "").split(",").filter(Boolean);
      return st.length && st.every(s => s === "PAID") ? "Falënderim pagese" : "Kujtesë borxhi";
    }
    return g.rows.length > 1 ? "Njoftim në grup" : "Mesazh individual";
  }

  async function resendFailed(g: { key: string; rows: SmsLogRow[] }) {
    const failed = g.rows.filter(r => r.status === "FAILED");
    if (!failed.length || !confirm(`Të ridërgohen ${failed.length} SMS që dështuan?`)) return;
    setResending(g.key);
    const r = await fetch("/api/sms/send", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: "", messageType: g.rows[0].messageType ?? undefined,
        recipients: failed.map(x => ({ phone: x.recipientPhone, name: x.recipientName ?? undefined, studentId: x.studentId ?? undefined, message: x.message, paymentStatus: x.paymentStatus ?? undefined })),
      }),
    }).catch(() => null);
    setResending(null);
    const d = r ? await r.json().catch(() => ({})) : {};
    alert(r?.ok ? `U ridërguan: ${d.sent ?? 0} arritën, ${d.failed ?? 0} dështuan.` : (d.error || "Ridërgimi dështoi."));
    loadHistory();
  }

  function reuseMessage(g: { rows: SmsLogRow[] }) {
    setMessage(g.rows[0].message);
    const picked = g.rows.filter(r => r.studentId).map(r => ({ id: r.studentId as number, name: (r.recipientName || r.recipientPhone).replace(/\s*\(prindi\)\s*$/i, ""), className: null }));
    if (picked.length) {
      setIntent("one"); setRecipientMode("individual");
      setSelectedStudents(picked.filter((p, i) => picked.findIndex(x => x.id === p.id) === i));
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  /* ── Pamja ── */
  const debtCount = type !== "GENERAL" ? students.filter(s => s.status && debtStatuses(type).includes(s.status)).length : null;
  const activeCount = audience ? audience.students.length : null;
  const intentMeta: Record<Intent, string> = {
    debt: debtCount != null ? `${debtCount} nxënës me borxh` : "Zgjidh modulin",
    all: activeCount != null ? `${activeCount} nxënës aktivë` : "—",
    classes: recipientMode === "classes" && selectedClassIds.length ? `${selectedClassIds.length} klasa të zgjedhura` : "Zgjidh klasat",
    one: "Individual",
  };
  const showStatuses = type !== "GENERAL" && intent !== "one";
  const vars = [...variablesForType(type), ...(type !== "GENERAL" ? ["{viti}"] : [])];
  const sendLabel = familyMode ? `Dërgo te ${reviewRows.length} familje` : `Dërgo te ${reviewRows.length} marrës`;
  const canSend = reviewRows.length > 0 && !!message.trim() && !audienceLoading;
  const card = "rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800";
  const step = (n: number) => <span className="w-6 h-6 rounded-full bg-primary-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{n}</span>;

  return (
    <>
      <Header title="Mesazhe SMS" />
      <div className="p-4 sm:p-6 max-w-6xl mx-auto space-y-5 animate-fade-in">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className="text-sm text-slate-500">Tre hapa: zgjidh qëllimin, kontrollo marrësit, shiko mesazhin si e merr prindi.</p>
          <div className="flex gap-2">
            <button type="button" className="btn-secondary text-sm" onClick={() => { templateRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); templateRef.current?.focus(); }}>Shabllonet</button>
            <button type="button" className="btn-secondary text-sm" onClick={() => historyRef.current?.scrollIntoView({ behavior: "smooth" })}>Historiku</button>
          </div>
        </div>

        {/* Qëllimi */}
        <div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-2">Çka doni të dërgoni?</p>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {INTENTS.map(i => (
              <button key={i.key} type="button" onClick={() => chooseIntent(i.key)}
                className={`text-left rounded-2xl border p-4 transition-all ${intent === i.key
                  ? "border-primary-400 bg-primary-50 dark:bg-primary-900/20 ring-2 ring-primary-200 dark:ring-primary-800"
                  : "border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-primary-300"}`}>
                <p className="font-bold text-slate-900 dark:text-white">{i.title}</p>
                <p className="text-xs text-slate-500 mt-1">{i.desc}</p>
                <p className={`text-xs font-semibold mt-3 ${intent === i.key ? "text-primary-700 dark:text-primary-300" : "text-slate-600 dark:text-slate-300"}`}>{intentMeta[i.key]}</p>
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_340px] gap-5 items-start">
          <div className="space-y-5 min-w-0">
            {/* 1. Kujt */}
            <section className={`${card} p-5 space-y-4`}>
              <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">{step(1)} Kujt i dërgohet?</h2>
              <div className="flex flex-wrap gap-3">
                <label className="text-xs text-slate-500">Moduli<br />
                  <select value={type} onChange={e => changeType(e.target.value as MessageType)} className="form-input w-auto py-1.5 text-sm mt-1">
                    {MESSAGE_TYPES.map(t => <option key={t.key} value={t.key}>{t.label}</option>)}
                  </select>
                </label>
                {type !== "GENERAL" && (
                  <label className="text-xs text-slate-500">Viti<br />
                    <select value={year} onChange={e => setYear(Number(e.target.value))} className="form-input w-auto py-1.5 text-sm mt-1">
                      {ACADEMIC_YEARS.map(y => <option key={y} value={y}>{y}/{y + 1}</option>)}
                    </select>
                  </label>
                )}
                {type === "USHQIMI" && (
                  <label className="text-xs text-slate-500">Periudha<br />
                    <select value={period} onChange={e => setPeriod(Number(e.target.value))} className="form-input w-auto py-1.5 text-sm mt-1">
                      {PERIOD_BUCKETS.map(p => <option key={p.canonicalMonth} value={p.canonicalMonth}>{p.label}</option>)}
                    </select>
                  </label>
                )}
                {audienceLoading && <Loader2 className="w-4 h-4 animate-spin text-slate-400 self-end mb-2" />}
              </div>

              {recipientMode === "classes" && (
                <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl">
                  {classes.map(c => (
                    <button key={c.id} type="button" onClick={() => toggleClass(c.id)}
                      className={`text-xs px-2.5 py-1 rounded-full border ${selectedClassIds.includes(c.id) ? "bg-primary-600 border-primary-600 text-white" : "bg-white dark:bg-slate-700 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-primary-400"}`}>
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
                    <input value={individualQuery} onChange={e => { setIndividualQuery(e.target.value); setShowSuggestions(true); }}
                      onFocus={() => setShowSuggestions(true)} onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                      className="form-input pl-9" placeholder="Kërko nxënësin me emër..." />
                    {showSuggestions && suggestions.length > 0 && (
                      <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                        {suggestions.map(s => (
                          <button key={s.id} type="button"
                            onMouseDown={() => { setSelectedStudents(prev => [...prev, { id: s.id, name: `${s.firstName} ${s.lastName}`, className: s.className }]); setIndividualQuery(""); }}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between gap-2">
                            <span>{s.firstName} {s.lastName}</span><span className="text-xs text-slate-400">{s.className}</span>
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
                          <button type="button" onClick={() => setSelectedStudents(prev => prev.filter(x => x.id !== s.id))} className="hover:text-red-500" aria-label={`Hiq ${s.name}`}><X className="w-3 h-3" /></button>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {showStatuses && (
                <div className="space-y-2">
                  <p className="text-xs text-slate-500">Statusi i borxhit (opsional)</p>
                  <div className="flex flex-wrap gap-2">
                    {statusesForType(type).map(s => {
                      const on = statuses.includes(s.key);
                      return (
                        <button key={s.key} type="button" onClick={() => toggleStatus(s.key)} aria-pressed={on}
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium border ${on ? "bg-primary-50 dark:bg-primary-900/30 border-primary-300 text-primary-800 dark:text-primary-200" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"}`}>
                          <input type="checkbox" readOnly checked={on} className="pointer-events-none" tabIndex={-1} />
                          <span className={`w-2 h-2 rounded-full ${STATUS_COLORS[s.key]?.dot ?? "bg-slate-400"}`} aria-hidden="true" />
                          {s.label}
                          <span className="text-slate-400">{statusCounts[s.key] ?? 0}</span>
                        </button>
                      );
                    })}
                  </div>
                  {(type === "UNIFORMA" || type === "LIBRAT") && (audience?.unlinked ?? 0) > 0 && (
                    <p className="text-xs text-slate-400">{audience!.unlinked} shitje pa lidhje me nxënës aktiv — anashkalohen.</p>
                  )}
                </div>
              )}

              <label className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 px-3 py-2.5 cursor-pointer select-none">
                <span className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input type="checkbox" checked={familyMode} onChange={e => setFamilyMode(e.target.checked)} />
                  Një SMS për familje (vëllezër bashkë)
                </span>
                <span className="text-xs text-slate-500 tabular-nums">
                  {familyMode ? <>{validCount} nxënës → <b className="text-slate-800 dark:text-slate-100">{reviewRows.length} familje</b></> : <><b className="text-slate-800 dark:text-slate-100">{reviewRows.length}</b> marrës</>}
                </span>
              </label>
              <button type="button" onClick={() => canSend && setShowReview(true)} disabled={!canSend} className="text-sm text-primary-700 dark:text-primary-300 hover:underline disabled:opacity-50 flex items-center gap-1">
                <ChevronRight className="w-4 h-4" /> Shiko listën e marrësve · hiq ndonjë
              </button>
              {audienceError && <p className="text-sm text-red-500">{audienceError}</p>}
              {recipientMode === "classes" && selectedClassIds.length === 0 && <p className="text-xs text-amber-600">Zgjidh të paktën një klasë.</p>}
            </section>

            {/* 2. Mesazhi */}
            <section className={`${card} p-5 space-y-3`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">{step(2)} Mesazhi</h2>
                <select ref={templateRef} value={currentTemplate} onChange={e => { const o = templateOptions.find(x => x.label === e.target.value); if (o) setMessage(o.text); }}
                  className="form-input w-auto py-1.5 text-sm" aria-label="Shablloni">
                  <option value="">Shablloni: i personalizuar</option>
                  {templateOptions.map(o => <option key={o.label} value={o.label}>Shablloni: {o.label}</option>)}
                </select>
              </div>
              <label className="block text-xs text-slate-500">Teksti
                <textarea ref={messageRef} value={message} onChange={e => setMessage(e.target.value)} className="form-input min-h-[110px] resize-y mt-1 text-sm" placeholder="Shkruaj mesazhin..." />
              </label>
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-slate-500">Shto:</span>
                {vars.map(v => (
                  <button key={v} type="button" onClick={() => insertToken(v)} className="text-xs px-2.5 py-1 rounded-full border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-primary-300 hover:text-primary-700">
                    {v.replace(/[{}]/g, "")}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className={seg.segments > 1 ? "text-amber-600 font-medium" : "text-slate-500"}>{seg.length} karaktere · {seg.segments} SMS për marrës</span>
                <label className="flex items-center gap-2 text-slate-600 dark:text-slate-300 cursor-pointer select-none">
                  <input type="checkbox" checked={stripDiacritics} onChange={e => setStripDiacritics(e.target.checked)} />
                  Kthe ë/ç në e/c{segWithAccents > seg.segments && stripDiacritics ? ` (${seg.segments} SMS në vend të ${segWithAccents})` : ""}
                </label>
              </div>
            </section>
          </div>

          {/* 3. Rishiko dhe dërgo */}
          <aside className={`${card} p-5 space-y-4 lg:sticky lg:top-4`}>
            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">{step(3)} Rishiko dhe dërgo</h2>
            <div>
              <p className="text-xs text-slate-500 mb-2">{previewRow ? `Si e sheh prindi i ${previewRow.names}` : "Pamja e mesazhit"}</p>
              <div className="rounded-2xl bg-slate-100 dark:bg-slate-900 p-3">
                <div className="rounded-2xl rounded-tl-sm bg-white dark:bg-slate-800 shadow-sm px-3.5 py-2.5 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap break-words">
                  {previewRow ? previewRow.message : <span className="text-slate-400">Asnjë marrës ende.</span>}
                </div>
                <p className="text-[11px] text-slate-400 mt-1.5">Akademia Ora · tani</p>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 p-3"><p className="text-xs text-slate-500">Marrës</p><p className="text-xl font-bold tabular-nums">{reviewRows.length}</p></div>
              <div className="rounded-xl bg-slate-50 dark:bg-slate-900/50 p-3"><p className="text-xs text-slate-500">SMS gjithsej</p><p className="text-xl font-bold tabular-nums">{totalSms}</p></div>
            </div>
            {skippedRows.length > 0 && (
              <div className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 p-3 text-xs text-amber-900 dark:text-amber-200">
                <p className="flex items-start gap-1.5"><AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" /><span><b>{skippedRows.length} nxënës</b> pa numër telefoni (ose me numër të pavlefshëm) — nuk e marrin.</span></p>
                <button type="button" onClick={() => setShowSkipped(v => !v)} className="underline mt-1">{showSkipped ? "Fshih" : "Shiko"}</button>
                {showSkipped && (
                  <ul className="mt-2 max-h-40 overflow-auto space-y-0.5">
                    {skippedRows.map(s => <li key={s.key}>{s.names} {s.classes && `(${s.classes})`} — {s.reason}</li>)}
                  </ul>
                )}
              </div>
            )}
            <button type="button" onClick={sendTest} disabled={!previewRow || testing} className="btn-secondary w-full justify-center text-sm">
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />} Dërgo provë te numri im
            </button>
            <button type="button" onClick={() => setShowReview(true)} disabled={!canSend} className="btn-primary w-full justify-center">
              <Send className="w-4 h-4" /> {sendLabel}
            </button>
            <p className="text-[11px] text-slate-400 text-center">Para dërgimit hapet lista për konfirmim — asgjë s&apos;dërgohet pa e konfirmuar.</p>
          </aside>
        </div>

        {/* Dërgimet e fundit */}
        <section ref={historyRef} className={`${card} overflow-hidden`}>
          <div className="flex flex-wrap items-center gap-2 p-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="font-bold text-slate-900 dark:text-white mr-auto">Dërgimet e fundit</h2>
            <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-900 rounded-lg">
              {([["all", "Të gjitha"], ["failed", "Me dështime"]] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setHistoryTab(k)} className={`px-2.5 py-1 rounded-md text-xs font-medium ${historyTab === k ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900" : "text-slate-500"}`}>{l}</button>
              ))}
            </div>
            <ExportExcelButton<SmsLogRow> fileName="Historiku-SMS" className="btn-secondary text-xs" rows={shownHistory.flatMap(g => g.rows)} columns={[
              { header: "Data", value: r => xlDate(r.createdAt) },
              { header: "Ora", value: r => new Date(r.createdAt).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" }) },
              { header: "Marrësi", value: r => r.recipientName ?? "", width: 26 },
              { header: "Telefoni", value: r => r.recipientPhone },
              { header: "Statusi", value: r => (r.status === "SENT" ? "Dërguar" : r.status === "FAILED" ? "Dështoi" : r.status) },
              { header: "Gabimi", value: r => r.errorMessage ?? "", width: 24 },
              { header: "Dërguar nga", value: r => r.sentBy.name },
              { header: "Mesazhi", value: r => r.message, width: 60 },
            ]} />
          </div>
          {loadingHistory ? (
            <p className="text-sm text-slate-400 text-center py-8">Duke ngarkuar...</p>
          ) : shownHistory.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">{groupedHistory.length ? "Asnjë dërgim me dështime." : "Ende s'është dërguar asnjë SMS."}</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-left text-xs text-slate-500 border-b border-slate-100 dark:border-slate-700">
                  <tr><th className="px-4 py-2 font-medium">Data</th><th className="px-4 py-2 font-medium">Dërgimi</th><th className="px-4 py-2 font-medium">Moduli</th><th className="px-4 py-2 font-medium text-right">Marrës</th><th className="px-4 py-2 font-medium text-right">Arritën</th><th className="px-4 py-2 font-medium text-right">Dështuan</th><th className="px-4 py-2" /></tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                  {shownHistory.map(g => {
                    const f = g.rows[0];
                    const sent = g.rows.filter(r => r.status === "SENT").length, failed = g.rows.filter(r => r.status === "FAILED").length;
                    const open = openBatch === g.key;
                    return [
                      <tr key={g.key} className="hover:bg-slate-50 dark:hover:bg-slate-800/40">
                        <td className="px-4 py-2.5 whitespace-nowrap text-slate-600 dark:text-slate-300">{formatDateTime(f.createdAt)}</td>
                        <td className="px-4 py-2.5 font-medium text-slate-800 dark:text-slate-100">{sendKind(g)}<span className="block text-[11px] font-normal text-slate-400">{g.rows.length === 1 ? (f.recipientName || f.recipientPhone) : f.sentBy.name}</span></td>
                        <td className="px-4 py-2.5 text-slate-500">{MESSAGE_TYPES.find(t => t.key === f.messageType)?.label ?? "—"}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums">{g.rows.length}</td>
                        <td className="px-4 py-2.5 text-right tabular-nums text-green-700 dark:text-green-400">{sent}</td>
                        <td className={`px-4 py-2.5 text-right tabular-nums ${failed ? "text-red-600 font-semibold" : "text-slate-400"}`}>{failed}</td>
                        <td className="px-4 py-2.5 text-right whitespace-nowrap">
                          {failed > 0 && (
                            <button type="button" onClick={() => resendFailed(g)} disabled={resending === g.key} className="text-xs px-2.5 py-1 rounded-lg border border-red-200 text-red-700 bg-red-50 hover:bg-red-100 dark:bg-red-950/30 dark:border-red-900 dark:text-red-300 mr-2">
                              {resending === g.key ? <Loader2 className="w-3 h-3 animate-spin inline" /> : <>Ridërgo {failed} dështimet</>}
                            </button>
                          )}
                          <button type="button" onClick={() => setOpenBatch(open ? null : g.key)} className="text-xs text-primary-700 dark:text-primary-300 hover:underline">{open ? "Mbyll" : "Hap"}</button>
                        </td>
                      </tr>,
                      open && (
                        <tr key={`${g.key}-d`} className="bg-slate-50/70 dark:bg-slate-900/40">
                          <td colSpan={7} className="px-4 py-3 space-y-2">
                            <p className="text-sm text-slate-700 dark:text-slate-200 whitespace-pre-wrap">{f.message}</p>
                            <p className="text-xs text-slate-400">Dërguar nga {f.sentBy.name}</p>
                            {failed > 0 && (
                              <ul className="text-xs text-red-600 space-y-0.5">
                                {g.rows.filter(r => r.status === "FAILED").map(r => <li key={r.id}>{r.recipientName || r.recipientPhone} ({r.recipientPhone}): {r.errorMessage}</li>)}
                              </ul>
                            )}
                            {g.rows.length > 1 && (
                              <details className="text-xs text-slate-500"><summary className="cursor-pointer">Të gjithë marrësit ({g.rows.length})</summary>
                                <ul className="mt-1 max-h-48 overflow-auto">{g.rows.map(r => <li key={r.id}>{r.status === "SENT" ? "✓" : r.status === "FAILED" ? "✗" : "…"} {r.recipientName || r.recipientPhone} · {r.recipientPhone}</li>)}</ul>
                              </details>
                            )}
                            <button type="button" onClick={() => reuseMessage(g)} className="text-xs text-primary-700 dark:text-primary-300 hover:underline flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Përdor përsëri këtë mesazh</button>
                          </td>
                        </tr>
                      ),
                    ];
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
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
