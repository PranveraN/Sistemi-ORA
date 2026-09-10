"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Header from "@/components/layout/Header";
import { formatDateTime } from "@/lib/utils";
import { PERIOD_BUCKETS } from "@/lib/food-periods";
import {
  MessageSquare, Search, Users, GraduationCap, X, Send, Loader2,
  CheckCircle, XCircle, History, Wallet,
} from "lucide-react";

interface ClassOpt { id: number; name: string; level: string }
interface StudentRow {
  id: number; firstName: string; lastName: string;
  parentPhone: string | null; fatherPhone: string | null; motherPhone: string | null;
  class: { name: string } | null;
}
interface CategoryOpt { id: number; name: string }
interface FamilyGroup {
  parent: { name: string; parentPhone: string | null; fatherPhone?: string | null; motherPhone?: string | null } | null;
  children: StudentRow[];
}
interface DebtStudentRow extends StudentRow {
  class: { id: number; name: string } | null;
  status: string;
  payment: { status: string; finalAmount: number; balance: number } | null;
  timiInvest: unknown | null;
  // Rreshtat e papërmbledhur — nevojiten (a) për Ushqimin, ku një "periudhë" e
  // vetme (p.sh. Nëntor/Dhjetor) mbulon 2 muaj kalendarikë dhe s'mund të
  // kontrollohet saktë me filtrin e thjeshtë "month", dhe (b) për të nxjerrë
  // "formatin" real të pagesës — fusha `Student.paymentPlan` në bazë s'përdoret
  // faktikisht nga shkolla (mbetet gjithmonë bosh); formati real shihet nga
  // numri/lloji i këstëve, saktësisht si te faqja e Shkollimit/Ushqimit.
  installments: { month: number; finalAmount: number; paidAmount: number; status: string; description: string | null }[];
}

const PAYMENT_FORMAT_LABELS: Record<string, string> = {
  TWO: "Dy pjesë", MONTHLY: "Me këste", FLEX: "Këste fleksibël",
  TIMI_INVEST: "Përmes Timi Invest", FULL: "E plotë", NONE: "Pa të dhëna",
};

// Njëjtë si inferenca e formatit të pagesës te CategoryPaymentPage.tsx (hasMonthly/
// hasFlex/hasTwo) — TI ka përparësi (financim i jashtëm, pavarësisht këstëve reale).
function inferPaymentFormat(s: Pick<DebtStudentRow, "installments" | "timiInvest">): string {
  if (s.timiInvest) return "TIMI_INVEST";
  const hasMonthly = s.installments.some(p => p.description?.startsWith("MUAJI_"));
  const hasFlex    = s.installments.some(p => p.description?.startsWith("FLEX_"));
  if (hasMonthly) return "MONTHLY";
  if (hasFlex) return "FLEX";
  if (s.installments.length >= 2) return "TWO";
  if (s.installments.length === 1) return "FULL";
  return "NONE";
}

// Statusi + borxhi për muajt e kërkuar (p.sh. [9,10] për një periudhë
// ushqimi, ose [9] për një muaj të vetëm Shkollimi, ose null = gjithë vitin
// i mbledhur) — nga rreshtat e papërmbledhur, gjithmonë të marrë për tërë
// vitin (shih searchDebt), sepse një plan "Dy pjesë" mund të ketë këstet e
// veta të etiketuara nën muaj/vite krejt të ndryshëm (p.sh. K1 Shtator 2026,
// K2 Nëntor 2025) — filtrimi me vetëm një muaj të saktë do të humbiste
// këstin tjetër dhe do ta gabonte edhe formatin e inferuar (shih më poshtë).
function periodInfo(installments: DebtStudentRow["installments"], months: number[] | null): { status: string; balance: number } {
  const matches = months ? installments.filter(p => months.includes(p.month)) : installments;
  if (!matches.length) return { status: "PENDING", balance: 0 };
  const finalAmount = matches.reduce((s, p) => s + p.finalAmount, 0);
  const paidAmount  = matches.reduce((s, p) => s + p.paidAmount, 0);
  const balance = Math.max(0, finalAmount - paidAmount);
  if (matches.length === 1) return { status: matches[0].status, balance };
  if (finalAmount > 0 && paidAmount >= finalAmount) return { status: "PAID", balance };
  if (paidAmount > 0) return { status: "PARTIAL", balance };
  return { status: matches[0].status, balance };
}
interface Recipient { phone: string; name: string; studentId?: number }

const MONTHS_SQ = ["Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor", "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor"];

interface SmsLogRow {
  id: number; batchId: string | null; recipientPhone: string; recipientName: string | null;
  message: string; status: string; errorMessage: string | null; createdAt: string;
  sentBy: { name: string };
}

function studentPhone(s: StudentRow): string | null {
  return s.parentPhone || s.fatherPhone || s.motherPhone || null;
}

export default function SmsPage() {
  const [mode, setMode] = useState<"class" | "family" | "individual" | "debt">("class");

  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [classId, setClassId] = useState("");

  const [categories, setCategories] = useState<CategoryOpt[]>([]);
  const [debtCategory, setDebtCategory] = useState("");
  const [debtMonth, setDebtMonth] = useState(String(new Date().getMonth() + 1));
  const [debtYear, setDebtYear] = useState(String(new Date().getFullYear()));
  const [debtClassId, setDebtClassId] = useState("");
  const [debtFormat, setDebtFormat] = useState("");
  const [debtStatus, setDebtStatus] = useState<"DEBT" | "PARTIAL" | "PAID" | "ALL">("DEBT");
  const [debtSearching, setDebtSearching] = useState(false);
  const [debtSearched, setDebtSearched] = useState(false);
  const [debtResults, setDebtResults] = useState<(DebtStudentRow & { debtBalance: number; format: string })[]>([]);

  const [familyQuery, setFamilyQuery] = useState("");
  const [familySearching, setFamilySearching] = useState(false);
  const [familySearched, setFamilySearched] = useState(false);
  const [familyGroups, setFamilyGroups] = useState<FamilyGroup[]>([]);
  const [selectedFamily, setSelectedFamily] = useState<FamilyGroup | null>(null);

  const [individualQuery, setIndividualQuery] = useState("");
  const [individualResults, setIndividualResults] = useState<StudentRow[]>([]);
  const [showIndividualSuggestions, setShowIndividualSuggestions] = useState(false);

  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number; total: number; errors: string[] } | null>(null);
  const [error, setError] = useState("");

  const [history, setHistory] = useState<SmsLogRow[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const loadHistory = useCallback(async () => {
    setLoadingHistory(true);
    const res = await fetch("/api/sms");
    if (res.ok) setHistory(await res.json());
    setLoadingHistory(false);
  }, []);

  useEffect(() => {
    fetch("/api/classes").then(r => r.json()).then(setClasses);
    fetch("/api/categories").then(r => r.json()).then((cats: CategoryOpt[]) => {
      setCategories(cats);
      const shkollimi = cats.find(c => c.name === "Shkollimi");
      const defaultCat = shkollimi?.name ?? cats[0]?.name;
      if (!defaultCat) return;
      setDebtCategory(defaultCat);
      if (defaultCat === "Ushqimi") {
        const now = new Date().getMonth() + 1;
        const bucket = PERIOD_BUCKETS.find(p => p.months.includes(now)) ?? PERIOD_BUCKETS[0];
        setDebtMonth(String(bucket.canonicalMonth));
      }
    });
    loadHistory();
  }, [loadHistory]);

  async function searchDebt() {
    if (!debtCategory) return;
    setDebtSearching(true);
    setDebtSearched(false);
    const isFood = debtCategory === "Ushqimi";
    // Merren gjithmonë të gjitha këstet e vitit akademik (month=0), jo vetëm
    // muaji i zgjedhur — përndryshe një plan "Dy pjesë" me këste të etiketuara
    // nën muaj/vite të ndryshme (shih koment te periodInfo) do të shfaqej
    // gabimisht si "E plotë" (vetëm një kësti do të gjendej). Statusi/borxhi
    // dhe formati llogariten më poshtë, klient-anësisht, nga e njëjta listë.
    const params = new URLSearchParams({ category: debtCategory, year: debtYear || "0", month: "0", yearType: "academic" });
    const res = await fetch(`/api/category-payments?${params}`);
    const d = await res.json();
    setDebtSearching(false);
    setDebtSearched(true);
    if (!res.ok) { setDebtResults([]); return; }
    const all: DebtStudentRow[] = d.students || [];
    const targetMonths = isFood
      ? PERIOD_BUCKETS.find(p => p.canonicalMonth === Number(debtMonth))?.months ?? null
      : (Number(debtMonth) > 0 ? [Number(debtMonth)] : null);
    const filtered = all
      .filter(s => s.status === "ACTIVE")
      .filter(s => !debtClassId || s.class?.id === Number(debtClassId))
      .map(s => {
        const info = periodInfo(s.installments ?? [], targetMonths);
        return { ...s, __status: info.status, debtBalance: info.balance, format: inferPaymentFormat(s) };
      })
      .filter(s => !debtFormat || s.format === debtFormat)
      .filter(s => {
        if (debtStatus === "DEBT") return s.__status !== "PAID";
        if (debtStatus === "PARTIAL") return s.__status === "PARTIAL";
        if (debtStatus === "PAID") return s.__status === "PAID";
        return true;
      });
    setDebtResults(filtered);
  }

  function addAllDebtResults() {
    for (const s of debtResults) addRecipient(studentPhone(s), `${s.firstName} ${s.lastName} (prindi)`, s.id);
  }

  function addRecipient(phone: string | null, name: string, studentId?: number) {
    if (!phone) return;
    setRecipients(prev => prev.some(r => r.phone === phone) ? prev : [...prev, { phone, name, studentId }]);
  }
  function removeRecipient(phone: string) {
    setRecipients(prev => prev.filter(r => r.phone !== phone));
  }

  async function addWholeClass() {
    if (!classId) return;
    const res = await fetch(`/api/students?classId=${classId}&status=ACTIVE&limit=500`);
    const d = await res.json();
    const students: StudentRow[] = d.students || [];
    for (const s of students) {
      addRecipient(studentPhone(s), `${s.firstName} ${s.lastName} (prindi)`, s.id);
    }
  }

  async function searchFamily() {
    if (!familyQuery.trim()) return;
    setFamilySearching(true);
    setFamilySearched(false);
    setFamilyGroups([]);
    setSelectedFamily(null);
    const isPhone = /\d/.test(familyQuery);
    const param = isPhone ? `phone=${encodeURIComponent(familyQuery)}` : `name=${encodeURIComponent(familyQuery)}`;
    const res = await fetch(`/api/families?${param}`);
    const d = await res.json();
    setFamilySearching(false);
    setFamilySearched(true);
    if (!res.ok || !d.families?.length) return;
    type RawFamily = { parent: FamilyGroup["parent"]; children: (StudentRow & { status: string })[] };
    const groups: FamilyGroup[] = (d.families as RawFamily[])
      .map(f => ({ parent: f.parent, children: f.children.filter(c => c.status === "ACTIVE") }))
      .filter(f => f.children.length > 0);
    setFamilyGroups(groups);
    if (groups.length === 1) setSelectedFamily(groups[0]);
  }

  useEffect(() => {
    if (individualQuery.trim().length < 2) { setIndividualResults([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/students?search=${encodeURIComponent(individualQuery)}&status=ACTIVE&limit=20`);
      const d = await res.json();
      setIndividualResults(d.students || []);
      setShowIndividualSuggestions(true);
    }, 250);
    return () => clearTimeout(t);
  }, [individualQuery]);

  const segments = Math.ceil((message.length || 0) / 160) || 0;

  async function handleSend() {
    setError("");
    setResult(null);
    if (!recipients.length) { setError("Zgjidh të paktën një marrës."); return; }
    if (!message.trim()) { setError("Shkruaj mesazhin."); return; }
    setSending(true);
    const res = await fetch("/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipients: recipients.map(r => ({ phone: r.phone, name: r.name, studentId: r.studentId })), message }),
    });
    const d = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) { setError(d.error || "Dërgimi dështoi."); return; }
    setResult(d);
    setRecipients([]);
    setMessage("");
    loadHistory();
  }

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

  return (
    <>
      <Header title="Mesazhe SMS" />
      <div className="p-6 max-w-4xl mx-auto space-y-5 animate-fade-in">
        <div className="card p-5 space-y-4">
          <h2 className="section-title flex items-center gap-1.5"><MessageSquare className="w-4 h-4 text-primary-500" /> Kërko Marrësit</h2>

          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl w-fit">
            {([["class", "Sipas Klase"], ["family", "Familje"], ["individual", "Individual"], ["debt", "Me Borxh"]] as const).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setMode(key)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${mode === key ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"}`}
              >
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
              <button onClick={addWholeClass} disabled={!classId} className="btn-secondary text-sm">
                <GraduationCap className="w-4 h-4" /> Shto Klasën
              </button>
            </div>
          )}

          {mode === "family" && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={familyQuery}
                    onChange={e => setFamilyQuery(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && searchFamily()}
                    className="form-input pl-9"
                    placeholder="Kërko me telefon ose emrin e prindit..."
                  />
                </div>
                <button onClick={searchFamily} disabled={familySearching || !familyQuery.trim()} className="btn-secondary text-sm">
                  {familySearching ? "Duke kërkuar..." : "Kërko"}
                </button>
              </div>
              {familySearched && familyGroups.length === 0 && (
                <p className="text-sm text-amber-600">Asnjë familje s&apos;u gjet.</p>
              )}

              {familyGroups.length > 1 && !selectedFamily && (
                <div className="p-3 bg-amber-50 dark:bg-amber-900/10 rounded-xl space-y-2">
                  <p className="text-sm text-amber-700 dark:text-amber-400">
                    U gjetën {familyGroups.length} familje të ndryshme me këtë emër — zgjidh njërën:
                  </p>
                  <div className="space-y-1.5">
                    {familyGroups.map((g, i) => (
                      <button
                        key={i}
                        onClick={() => setSelectedFamily(g)}
                        className="w-full text-left px-3 py-2 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:border-primary-400 text-sm"
                      >
                        <span className="font-semibold">{g.parent?.name || "—"}</span>
                        {g.parent?.parentPhone && <span className="text-slate-400"> · {g.parent.parentPhone}</span>}
                        <span className="text-slate-400"> · {g.children.map(c => `${c.firstName} ${c.lastName}`).join(", ")}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {selectedFamily && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm text-slate-600 dark:text-slate-300">
                      <span className="font-semibold">{selectedFamily.parent?.name}</span>
                      {selectedFamily.parent?.parentPhone && <span className="text-slate-400"> · {selectedFamily.parent.parentPhone}</span>}
                    </p>
                    {familyGroups.length > 1 && (
                      <button onClick={() => setSelectedFamily(null)} className="text-xs text-primary-600 hover:text-primary-700 shrink-0">‹ Familje tjetër</button>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedFamily.children.map(c => (
                      <button
                        key={c.id}
                        onClick={() => addRecipient(studentPhone(c), `${c.firstName} ${c.lastName} (prindi)`, c.id)}
                        className="text-xs px-2.5 py-1 rounded-full bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-primary-400 hover:text-primary-600"
                      >
                        + {c.firstName} {c.lastName}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {mode === "individual" && (
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={individualQuery}
                onChange={e => setIndividualQuery(e.target.value)}
                onFocus={() => individualResults.length > 0 && setShowIndividualSuggestions(true)}
                onBlur={() => setTimeout(() => setShowIndividualSuggestions(false), 150)}
                className="form-input pl-9"
                placeholder="Kërko nxënësin me emër..."
              />
              {showIndividualSuggestions && individualResults.length > 0 && (
                <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-56 overflow-y-auto">
                  {individualResults.map(s => (
                    <button
                      key={s.id}
                      type="button"
                      onMouseDown={() => addRecipient(studentPhone(s), `${s.firstName} ${s.lastName} (prindi)`, s.id)}
                      className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between gap-2"
                    >
                      <span>{s.firstName} {s.lastName}</span>
                      <span className="text-xs text-slate-400">{s.class?.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {mode === "debt" && (
            <div className="space-y-2">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <select
                  value={debtCategory}
                  onChange={e => {
                    const newCat = e.target.value;
                    const wasFood = debtCategory === "Ushqimi";
                    const isFood  = newCat === "Ushqimi";
                    setDebtCategory(newCat);
                    if (isFood && !wasFood) {
                      const now = new Date().getMonth() + 1;
                      const bucket = PERIOD_BUCKETS.find(p => p.months.includes(now)) ?? PERIOD_BUCKETS[0];
                      setDebtMonth(String(bucket.canonicalMonth));
                    } else if (!isFood && wasFood) {
                      setDebtMonth(String(new Date().getMonth() + 1));
                    }
                  }}
                  className="form-input"
                >
                  {categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                </select>
                {debtCategory === "Ushqimi" ? (
                  <select value={debtMonth} onChange={e => setDebtMonth(e.target.value)} className="form-input">
                    <option value="0">Çdo periudhë</option>
                    {PERIOD_BUCKETS.map(p => <option key={p.canonicalMonth} value={p.canonicalMonth}>{p.label}</option>)}
                  </select>
                ) : (
                  <select value={debtMonth} onChange={e => setDebtMonth(e.target.value)} className="form-input">
                    <option value="0">Çdo muaj</option>
                    {MONTHS_SQ.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
                  </select>
                )}
                <input type="number" value={debtYear} onChange={e => setDebtYear(e.target.value)} className="form-input" placeholder="Viti" />
                <select value={debtClassId} onChange={e => setDebtClassId(e.target.value)} className="form-input">
                  <option value="">Çdo klasë</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <select value={debtFormat} onChange={e => setDebtFormat(e.target.value)} className="form-input">
                  <option value="">Çdo format pagese</option>
                  {Object.entries(PAYMENT_FORMAT_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                </select>
              </div>
              <div className="flex items-center flex-wrap gap-2">
                <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-lg flex-wrap">
                  {([["DEBT", "Të papaguar"], ["PARTIAL", "Pjesërisht"], ["PAID", "Paguar plotësisht"], ["ALL", "Të gjithë"]] as const).map(([key, label]) => (
                    <button
                      key={key}
                      onClick={() => setDebtStatus(key)}
                      className={`px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${debtStatus === key ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500"}`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <button
                  onClick={() => setDebtFormat(f => f === "TIMI_INVEST" ? "" : "TIMI_INVEST")}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition-all ${
                    debtFormat === "TIMI_INVEST"
                      ? "bg-violet-600 border-violet-600 text-white"
                      : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-500 hover:border-violet-300"
                  }`}
                >
                  Përmes Timi Invest
                </button>
                <button onClick={searchDebt} disabled={debtSearching || !debtCategory} className="btn-secondary text-sm ml-auto">
                  <Wallet className="w-4 h-4" /> {debtSearching ? "Duke kërkuar..." : "Kërko"}
                </button>
              </div>

              {debtSearched && debtResults.length === 0 && (
                <p className="text-sm text-amber-600">Asnjë nxënës s&apos;përputhet me këto kritere.</p>
              )}
              {debtResults.length > 0 && (
                <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-slate-600 dark:text-slate-300">{debtResults.length} nxënës të gjetur</p>
                    <button onClick={addAllDebtResults} className="text-xs text-primary-600 hover:text-primary-700 font-medium">+ Shto të gjithë</button>
                  </div>
                  <div className="space-y-1">
                    {debtResults.map(s => (
                      <button
                        key={s.id}
                        onClick={() => addRecipient(studentPhone(s), `${s.firstName} ${s.lastName} (prindi)`, s.id)}
                        className="w-full flex items-center justify-between gap-2 text-left px-2.5 py-1.5 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 hover:border-primary-400 text-xs"
                      >
                        <span className="text-slate-700 dark:text-slate-200 font-medium">
                          + {s.firstName} {s.lastName}{s.class && ` (${s.class.name})`}
                        </span>
                        <span className="flex items-center gap-1.5 shrink-0 text-slate-400">
                          <span className={s.format === "TIMI_INVEST" ? "text-violet-500 font-semibold" : ""}>{PAYMENT_FORMAT_LABELS[s.format] ?? s.format}</span>
                          {s.debtBalance > 0 && (
                            <span className="text-red-500 font-semibold">{s.debtBalance.toLocaleString("de-DE", { minimumFractionDigits: 2 })} €</span>
                          )}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Selected recipients */}
          {recipients.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" /> {recipients.length} marrës të zgjedhur
              </p>
              <div className="flex flex-wrap gap-1.5">
                {recipients.map(r => (
                  <span key={r.phone} className="text-xs pl-2.5 pr-1 py-1 rounded-full bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-400 flex items-center gap-1.5">
                    {r.name} <span className="text-primary-400">({r.phone})</span>
                    <button onClick={() => removeRecipient(r.phone)} className="hover:text-red-500"><X className="w-3 h-3" /></button>
                  </span>
                ))}
              </div>
            </div>
          )}

          <div>
            <label className="form-label">Mesazhi</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} className="form-input min-h-[100px] resize-none" placeholder="Shkruaj mesazhin..." />
            <p className="text-xs text-slate-400 mt-1">{message.length} karaktere · {segments || 0} segment{segments === 1 ? "" : "e"} SMS</p>
          </div>

          {error && <p className="text-sm text-red-500">{error}</p>}
          {result && (
            <p className="text-sm text-green-600">
              U dërgua te {result.sent} nga {result.total} marrës{result.failed > 0 && ` — ${result.failed} dështuan (${result.errors.join(", ")})`}
            </p>
          )}

          <button onClick={handleSend} disabled={sending || !recipients.length || !message.trim()} className="btn-primary">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? "Duke dërguar..." : `Dërgo SMS${recipients.length ? ` (${recipients.length})` : ""}`}
          </button>
        </div>

        {/* History */}
        <div className="card overflow-hidden">
          <div className="flex items-center gap-2 p-5 border-b border-slate-100 dark:border-slate-700">
            <History className="w-4 h-4 text-primary-500" />
            <h2 className="section-title">Historiku i Mesazheve</h2>
          </div>
          {loadingHistory ? (
            <p className="text-sm text-slate-400 text-center py-8">Duke ngarkuar...</p>
          ) : groupedHistory.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-8">Ende s&apos;është dërguar asnjë SMS.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {groupedHistory.map(g => {
                const first = g.rows[0];
                const sentCount = g.rows.filter(r => r.status === "SENT").length;
                const failedCount = g.rows.filter(r => r.status === "FAILED").length;
                return (
                  <div key={g.key} className="p-4">
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
    </>
  );
}
