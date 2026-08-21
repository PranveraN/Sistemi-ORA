"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Header from "@/components/layout/Header";
import Link from "next/link";
import { formatCurrency, formatDate, MONTHS } from "@/lib/utils";
import { PERIOD_BUCKETS } from "@/lib/food-periods";
import { CYCLES, getCycle } from "@/lib/school-cycles";
import { ACADEMIC_YEARS, CALENDAR_YEARS, type YearType } from "@/lib/academicYear";
import { BADGE_CSS, buildBadgeCardHTML } from "@/lib/badge-html";
import * as XLSX from "xlsx";
import {
  Search, CheckCircle, AlertCircle, Plus, X, Save,
  Users, Loader2, Printer, Calculator, ChevronDown, ChevronUp, Info,
  TrendingUp, TrendingDown, ArrowLeftRight, Phone, BarChart3, Download, FileUp, IdCard, Trash2, Receipt,
} from "lucide-react";
import InvoicePrintModal from "@/components/finance/InvoicePrintModal";
import ExpensesSection from "@/components/finance/ExpensesSection";
import PaymentReceiptModal from "@/components/finance/PaymentReceiptModal";
import StudentBadgeModal from "@/components/students/StudentBadgeModal";

type Tab = "income" | "expense" | "handover" | "report";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "income",   label: "Të Hyra",       icon: <TrendingUp     className="w-4 h-4" /> },
  { key: "expense",  label: "Shpenzime",      icon: <TrendingDown   className="w-4 h-4" /> },
  { key: "handover", label: "Dorezim Parash", icon: <ArrowLeftRight className="w-4 h-4" /> },
  { key: "report",   label: "Raport",         icon: <BarChart3      className="w-4 h-4" /> },
];

function exportUshqimiExcel(students: StudentRow[], month: number, year: number) {
  const wb = XLSX.utils.book_new();
  const today = formatDate(new Date());
  const periudha = month > 0 && year > 0
    ? `${MONTHS[month - 1]} ${year}`
    : year > 0 ? String(year) : "Të gjitha";

  const totalBilled    = students.reduce((s, r) => s + (r.payment?.finalAmount || 0), 0);
  const totalCollected = students.reduce((s, r) => s + (r.payment?.paidAmount  || 0), 0);
  const totalDebt      = students.reduce((s, r) => s + (r.payment?.balance     || 0), 0);
  const paid    = students.filter(s => s.payment?.status === "PAID").length;
  const overdue = students.filter(s => s.payment?.status === "OVERDUE").length;
  const pending = students.filter(s => !s.payment || s.payment.status === "PENDING").length;

  // Sheet 1: Permbledhje
  const summary = [
    ["RAPORTI FINANCIAR — USHQIMI", "", today],
    ["Periudha:", periudha],
    [],
    ["PASQYRA", ""],
    ["Faturuar totale",   totalBilled],
    ["E arkëtuar",        totalCollected],
    ["(-) Borxhe",        totalDebt],
    [],
    ["STATUSI I NXËNËSVE", ""],
    ["Gjithsej nxënës",  students.length],
    ["Paguar",           paid],
    ["Vonuar",           overdue],
    ["Pa pagesë",        pending],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summary);
  ws1["!cols"] = [{ wch: 24 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Përmbledhje");

  // Sheet 2: Lista nxënësve
  const rows = [
    ["#", "Emri", "Mbiemri", "Klasa", "Telefoni", "Faturuar (€)", "Paguar (€)", "Borxhi (€)", "Statusi"],
    ...students.map((s, i) => [
      i + 1,
      s.firstName,
      s.lastName,
      s.class?.name ?? "",
      s.parentPhone ?? "",
      s.payment?.finalAmount ?? 0,
      s.payment?.paidAmount  ?? 0,
      s.payment?.balance     ?? 0,
      s.payment?.status === "PAID"    ? "Paguar"
        : s.payment?.status === "OVERDUE" ? "Vonuar"
        : s.payment?.status === "PARTIAL" ? "Pjesërisht"
        : "Pa pagesë",
    ]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(rows);
  ws2["!cols"] = [{ wch: 4 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 14 }, { wch: 13 }, { wch: 13 }, { wch: 12 }, { wch: 13 }];
  XLSX.utils.book_append_sheet(wb, ws2, "Lista nxënësve");

  XLSX.writeFile(wb, `Raporti-Ushqimi-${periudha.replace(/\s/g, "-")}-${today.replace(/\//g, "-")}.xlsx`);
}

/* ─── Types ────────────────────────────────────────────── */
interface Payment {
  id: number; amount: number; finalAmount: number; paidAmount: number;
  balance: number; discount: number; discountType: string | null;
  scholarship: number; method: string | null; paidDate: string | null;
  dueDate: string; status: string; description: string | null;
  receiptNumber: string | null; month: number; year: number;
}
interface Class { id: number; name: string; level: string; }

interface StudentRow {
  id: number; firstName: string; lastName: string;
  parentPhone: string | null;
  class: { id: number; name: string } | null;
  payment: Payment | null;
  installments: Payment[];
  status: string;
  inactiveDate: string | null;
}

function findPeriodPayment(installments: Payment[], months: number[]): Payment | null {
  const matches = installments.filter(p => months.includes(p.month));
  if (!matches.length) return null;
  if (matches.length === 1) return matches[0];
  const finalAmount = matches.reduce((s, p) => s + p.finalAmount, 0);
  const paidAmount  = matches.reduce((s, p) => s + p.paidAmount, 0);
  return { ...matches[0], finalAmount, paidAmount, balance: Math.max(0, finalAmount - paidAmount) };
}

// Marks a single period as "not attending" for one student, independent of the
// student's overall Active/Inactive status — so a student can pause food service
// for one period and resume the next, which a single student-level status can't represent.
const SKIPPED_MARKER = "Ndërprerë";
// Nxenesi e ndjek periudhen por s'paguan (falas) — s'duhet te numerohet as
// te te hyrat e ushqimit as te borxhi, ndaj perdoret finalAmount:0 njesoj si
// SKIPPED_MARKER, thjesht me etikete/ngjyre te ndryshme ne tabele.
const FREE_MARKER = "Falas";

function exportUshqimiGridExcel(students: StudentRow[], year: number) {
  const rows = students.map((s, i) => {
    const periodValues = PERIOD_BUCKETS.map(period => {
      const payment = findPeriodPayment(s.installments, period.months);
      if (!payment) return "";
      if (payment.description === SKIPPED_MARKER) return "Ndërprerë";
      if (payment.method === "BANK") return `Bankë (${payment.finalAmount})`;
      return payment.finalAmount;
    });
    const totalPlan = PERIOD_BUCKETS.reduce((sum, period) => {
      const p = findPeriodPayment(s.installments, period.months);
      return sum + (p?.finalAmount || 0);
    }, 0);
    const totalPaid = PERIOD_BUCKETS.reduce((sum, period) => {
      const p = findPeriodPayment(s.installments, period.months);
      return sum + (p?.paidAmount || 0);
    }, 0);
    const totalDebt = PERIOD_BUCKETS.reduce((sum, period) => {
      const p = findPeriodPayment(s.installments, period.months);
      return sum + (p?.balance || 0);
    }, 0);
    return {
      "#":         i + 1,
      "Emri":      s.firstName,
      "Mbiemri":   s.lastName,
      "Klasa":     s.class?.name ?? "",
      "Telefoni":  s.parentPhone ?? "",
      "Ushqimi":   totalPlan,
      [PERIOD_BUCKETS[0].label]: periodValues[0],
      [PERIOD_BUCKETS[1].label]: periodValues[1],
      [PERIOD_BUCKETS[2].label]: periodValues[2],
      [PERIOD_BUCKETS[3].label]: periodValues[3],
      [PERIOD_BUCKETS[4].label]: periodValues[4],
      "Paguar":    totalPaid,
      "Borxhi":    totalDebt,
    };
  });

  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = [
    { wch: 4 }, { wch: 14 }, { wch: 14 }, { wch: 8 }, { wch: 14 }, { wch: 10 },
    { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 14 }, { wch: 10 }, { wch: 10 },
  ];
  const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
  for (let c = range.s.c; c <= range.e.c; c++) {
    const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
    if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: "E2E8F0" } } };
  }

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ushqimi");
  const today = new Date().toISOString().split("T")[0];
  XLSX.writeFile(wb, `Ushqimi-${year}-${today}.xlsx`);
}

function printClassBadges(students: StudentRow[], className: string) {
  const cards = students
    .map(s => buildBadgeCardHTML({ id: s.id, firstName: s.firstName, lastName: s.lastName, className: s.class?.name || "" }))
    .join("");
  const win = window.open("", "_blank", "width=900,height=1200");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html lang="sq"><head>
<meta charset="UTF-8"/>
<title>Bexhet — ${className || "Të gjithë"}</title>
<style>
@page { size: A4 portrait; margin: 10mm; }
* { margin:0; padding:0; box-sizing:border-box; }
html, body { -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.sheet { display:grid; grid-template-columns: repeat(2, 90mm); grid-auto-rows: 55mm; gap: 4mm; justify-content:center; }
${BADGE_CSS}
</style>
</head><body>
<div class="sheet">${cards}</div>
<script>window.onload = () => setTimeout(() => window.print(), 300);</script>
</body></html>`);
  win.document.close();
}

type StatFilter = "all" | "paid" | "overdue" | "pending" | "revenue" | "debt";

interface Period {
  name: string;
  days: number;
  klasaDays: number;
  zbritjeDays: number;
}

const DEFAULT_PERIODS: Period[] = [
  { name: "Shtator/Tetor",  days: 42, klasaDays: 37, zbritjeDays: 0  },
  { name: "Nëntor/Dhjetor", days: 37, klasaDays: 37, zbritjeDays: 0  },
  { name: "Janar/Shkurt",   days: 36, klasaDays: 36, zbritjeDays: 27 },
  { name: "Mars/Prill",     days: 37, klasaDays: 37, zbritjeDays: 23 },
  { name: "Maj/Qershor",    days: 32, klasaDays: 32, zbritjeDays: 0  },
];

const MEAL_PLANS = [
  { value: "1_shujtë_ditë",   label: "1 shujtë / ditë"    },
  { value: "2_shujta_ditë",   label: "2 shujta / ditë"    },
  { value: "1_shujtë_muaj",   label: "1 shujtë / muaj"    },
  { value: "2_shujta_muaj",   label: "2 shujta / muaj"    },
  { value: "2_muaj_1s",       label: "2 muaj – 1 shujtë"  },
  { value: "2_muaj_2s",       label: "2 muaj – 2 shujta"  },
  { value: "dite_specifike",  label: "Ditë specifike"     },
  { value: "periudhe",        label: "Periudhë e lirë"    },
];

/* ─── Pricing calculator ───────────────────────────────── */
function calcPrices(price2Meals: number, workingDays: number, monthsPerYear: number) {
  const per1 = price2Meals / 2;
  const per2 = price2Meals;
  return {
    "1_shujtë_ditë":  per1,
    "2_shujta_ditë":  per2,
    "1_shujtë_muaj":  per1 * workingDays,
    "2_shujta_muaj":  per2 * workingDays,
    "2_muaj_1s":      per1 * workingDays * 2,
    "2_muaj_2s":      per2 * workingDays * 2,
    "dite_specifike": per2,
    "periudhe":       per2 * workingDays,
    "1_shujtë_vit":   per1 * workingDays * monthsPerYear,
    "2_shujta_vit":   per2 * workingDays * monthsPerYear,
  };
}

/* ═══════════════════════════════════════════════════════ */
export default function UshqimiPage() {
  const now = new Date();
  // Gushti llogaritet tashmë si fillim i vitit të ri akademik (jo Shtatori) — shih
  // CategoryPaymentPage.tsx për shpjegimin e plotë.
  const currentAcademicStart = now.getMonth() + 1 >= 8 ? now.getFullYear() : now.getFullYear() - 1;
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [year, setYear]     = useState(currentAcademicStart);
  const [yearType, setYearType] = useState<YearType>("academic");
  const [search, setSearch]   = useState("");
  const [classId, setClassId] = useState("");
  const [cycleFilter, setCycleFilter] = useState("");
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    fetch("/api/classes").then(r => r.json()).then((data: Class[]) => {
      setClasses([...data].sort((a, b) => {
        const na = parseInt(a.name), nb = parseInt(b.name);
        if (na !== nb) return na - nb;
        return a.name.localeCompare(b.name);
      }));
    });
  }, []);

  // Pricing config
  const [price2Meals,   setPrice2Meals]   = useState(4);
  const [workingDays,   setWorkingDays]   = useState(20);
  const [monthsPerYear, setMonthsPerYear] = useState(10);
  const [periods,       setPeriods]       = useState<Period[]>(DEFAULT_PERIODS);
  const [showCalc,      setShowCalc]      = useState(true);
  const [showManual,    setShowManual]    = useState(false);

  // Tab + category ID
  const [tab,        setTab]        = useState<Tab>("income");
  const [categoryId, setCategoryId] = useState<number | null>(null);

  // View mode
  const [showOnlyEnrolled, setShowOnlyEnrolled] = useState(true);

  // Year-wide data for the income grid (5 periods at once, independent of `month`)
  const [yearStudents, setYearStudents] = useState<StudentRow[]>([]);
  const [yearLoading,  setYearLoading]  = useState(true);

  // Modals
  const [payModal, setPayModal] = useState<{ student: StudentRow; month: number; existingPayment: Payment | null } | null>(null);
  const [printModal,       setPrintModal]        = useState<StudentRow | null>(null);
  const [receiptPaymentId, setReceiptPaymentId] = useState<number | null>(null);
  const [statFilter,  setStatFilter]  = useState<StatFilter | null>(null);
  const [enrollModal, setEnrollModal] = useState(false);
  const [calcModal,   setCalcModal]   = useState<StudentRow | null>(null);
  const [badgeModal,  setBadgeModal]  = useState<StudentRow | null>(null);
  const [calcAmount,  setCalcAmount]  = useState<number | undefined>();

  const prices = calcPrices(price2Meals, workingDays, monthsPerYear);
  // Same fallback as fetchYearData — keeps period-bucket dates consistent with what was fetched.
  const effectiveYear = year > 0 ? year : new Date().getFullYear();
  // Viti kalendarik konkret për një muaj specifik (p.sh. Muaji/Shpenzime tab) — Shtator–Dhjetor
  // bien te effectiveYear, Janar–Gusht te effectiveYear+1, kur jemi në Vit Akademik.
  const resolvedYear = yearType === "academic"
    ? (month > 0 ? (month >= 9 ? effectiveYear : effectiveYear + 1) : effectiveYear)
    : effectiveYear;
  // Viti kalendarik i saktë për një periudhë ushqimi (Shtator/Tetor..Maj/Qershor) — përdoret
  // nga grafiku me 5 periudha, ku Janar/Shkurt–Maj/Qershor i takojnë vitit shkollor pasardhës.
  function periodCalYear(canonicalMonth: number) {
    if (yearType !== "academic") return effectiveYear;
    return canonicalMonth >= 9 ? effectiveYear : effectiveYear + 1;
  }
  const selectedClassName = classes.find(c => String(c.id) === classId)?.name || "Të gjitha klasat";

  // Stats (year-wide, across all 5 periods)
  const enrolled    = yearStudents.filter(s => s.installments.length > 0).length;
  const notEnrolled = yearStudents.length - enrolled;
  const paid    = yearStudents.filter(s => s.payment?.status === "PAID").length;
  const overdue = yearStudents.filter(s => s.payment?.status === "OVERDUE").length;
  const pending = yearStudents.filter(s => !s.payment || s.payment.status === "PENDING").length;
  const totalRevenue = yearStudents.reduce((s, r) => s + (r.payment?.paidAmount || 0), 0);
  const totalDebt    = yearStudents.reduce((s, r) => s + (r.payment?.balance   || 0), 0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ category: "Ushqimi", search });
    if (month > 0) params.set("month", String(month));
    if (resolvedYear  > 0) params.set("year",  String(resolvedYear));
    const res = await fetch(`/api/category-payments?${params}`);
    if (res.ok) {
      const d = await res.json();
      setStudents(d.students);
      if (d.category?.id) setCategoryId(d.category.id);
    }
    setLoading(false);
  }, [month, resolvedYear, search]);

  const fetchYearData = useCallback(async () => {
    setYearLoading(true);
    // The 5-period grid always needs one concrete year (bucketing by calendar month
    // only makes sense within a single year) — "Të gjitha" falls back to this year.
    const effectiveYear = year > 0 ? year : new Date().getFullYear();
    const params = new URLSearchParams({ category: "Ushqimi", search, year: String(effectiveYear) });
    // Vit akademik → periudhat Janar/Shkurt..Maj/Qershor bien te viti pasardhës (2 vite kalendarike gjithsej)
    if (yearType === "academic") params.set("yearType", "academic");
    if (classId) params.set("classId", classId);
    const res = await fetch(`/api/category-payments?${params}`);
    if (res.ok) {
      const d = await res.json();
      setYearStudents(d.students);
      if (d.category?.id) setCategoryId(d.category.id);
    }
    setYearLoading(false);
  }, [year, yearType, search, classId]);

  async function handleRemoveFromUshqimi(s: StudentRow) {
    const payments = PERIOD_BUCKETS
      .map(period => findPeriodPayment(s.installments, period.months))
      .filter((p): p is Payment => p !== null);
    if (!payments.length) return;

    const totalPaid = payments.reduce((sum, p) => sum + p.paidAmount, 0);
    const warning = totalPaid > 0
      ? `${s.firstName} ${s.lastName} ka ${formatCurrency(totalPaid)} të paguara për ushqimin këtë vit. Fshirja heq krejt historikun e pagesave të ushqimit për të (të gjitha periudhat). Vazhdo?`
      : `Hiq ${s.firstName} ${s.lastName} nga ushqimi (${effectiveYear})?`;
    if (!confirm(warning)) return;

    await Promise.all(payments.map(p => fetch(`/api/payments/${p.id}`, { method: "DELETE" })));
    fetchYearData();
  }

  // Faturon automatikisht periudhat qe s'kane ende pagese, duke perdorur
  // çmimet e Kalkulatorit — perdoret kur shtohet nxenes i ri, dhe si
  // veprim manual per nxenesit ekzistues qe kane vetem disa periudha te faturuara.
  async function billMissingPeriods(s: StudentRow) {
    const catRes = await fetch("/api/categories");
    const cats = await catRes.json();
    const cat = cats.find((c: { name: string; id: number }) => c.name === "Ushqimi");
    if (!cat?.id) return;

    const missing = PERIOD_BUCKETS
      .map((period, i) => ({ period, i }))
      .filter(({ period }) => !findPeriodPayment(s.installments, period.months));
    if (!missing.length) return;

    await Promise.all(missing.map(({ period, i }) => {
      const days = periods[i]?.days ?? workingDays;
      const finalAmount = Math.round(days * price2Meals * 100) / 100;
      const calYear = periodCalYear(period.canonicalMonth);
      const dueDate = new Date(calYear, period.canonicalMonth - 1, 5).toISOString().split("T")[0];
      return fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: s.id, categoryId: cat.id,
          amount: finalAmount, discount: 0, discountType: null, scholarship: 0,
          finalAmount, paidAmount: 0,
          method: "CASH",
          dueDate,
          month: period.canonicalMonth, year: calYear,
          description: `${days} ditë × ${formatCurrency(price2Meals)} — ${period.label} ${calYear}`,
        }),
      });
    }));
    fetchYearData();
  }

  const _firstRender = useRef(true);
  useEffect(() => {
    const delay = _firstRender.current ? 0 : 300;
    _firstRender.current = false;
    const t = setTimeout(fetchData, delay);
    return () => clearTimeout(t);
  }, [fetchData]);

  const _yearFirstRender = useRef(true);
  useEffect(() => {
    const delay = _yearFirstRender.current ? 0 : 300;
    _yearFirstRender.current = false;
    const t = setTimeout(fetchYearData, delay);
    return () => clearTimeout(t);
  }, [fetchYearData]);

  const sorted = [...yearStudents].sort((a, b) => {
    const order = ["OVERDUE", "PARTIAL", "PENDING", "PAID"];
    return order.indexOf(a.payment?.status || "PENDING") - order.indexOf(b.payment?.status || "PENDING");
  });

  const byEnrollment = showOnlyEnrolled ? sorted.filter(s => s.installments.length > 0) : sorted;
  const displayed = cycleFilter ? byEnrollment.filter(s => getCycle(s.class?.name) === cycleFilter) : byEnrollment;

  return (
    <>
      <Header title="Ushqimi" />
      <div className="p-6 space-y-4 animate-fade-in">

        {/* ── Tab bar + Month/Year ── */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t.key
                    ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                    : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                }`}
              >
                {t.icon}
                {t.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 text-xs font-semibold flex-shrink-0">
              {([["academic", "🎓 Akademik"], ["calendar", "📅 Kalendarik"]] as [YearType, string][]).map(([yt, lbl]) => (
                <button
                  key={yt}
                  onClick={() => setYearType(yt)}
                  className={`px-2.5 py-2 transition-colors ${
                    yearType === yt
                      ? "bg-primary-600 text-white"
                      : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                  }`}
                >
                  {lbl}
                </button>
              ))}
            </div>
            {tab !== "income" && (
              <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="form-input w-36">
                <option value={0}>Të gjitha</option>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
            )}
            <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="form-input w-28">
              <option value={0}>Të gjitha</option>
              {(yearType === "academic" ? ACADEMIC_YEARS : CALENDAR_YEARS).map(y => (
                <option key={y} value={y}>{yearType === "academic" ? `${y}–${y + 1}` : y}</option>
              ))}
            </select>
          </div>
        </div>

        {/* ── EXPENSE TAB ── */}
        {tab === "expense" && (
          <ExpensesSection categoryId={categoryId} type="EXPENSE" month={month} year={resolvedYear} />
        )}

        {/* ── HANDOVER TAB ── */}
        {tab === "handover" && (
          <ExpensesSection categoryId={categoryId} type="HANDOVER" month={month} year={resolvedYear} />
        )}

        {/* ── REPORT TAB ── */}
        {tab === "report" && (() => {
          const periodStats = PERIOD_BUCKETS.map(() => ({ started: 0, interrupted: 0, free: 0, billed: 0, paid: 0, debt: 0 }));
          const interruptedIds = new Set<number>();
          const freeIds = new Set<number>();
          let paidBank = 0, paidCash = 0;

          for (const s of yearStudents) {
            let prevReal = false;
            PERIOD_BUCKETS.forEach((period, i) => {
              const payment = findPeriodPayment(s.installments, period.months);
              const isSkip = payment?.description === SKIPPED_MARKER;
              const isFree = payment?.description === FREE_MARKER;
              const isReal = !!payment && !isSkip && !isFree;

              if (isSkip) { periodStats[i].interrupted++; interruptedIds.add(s.id); }
              if (isFree) { periodStats[i].free++; freeIds.add(s.id); }
              if (isReal && !prevReal) periodStats[i].started++;

              if (payment) {
                periodStats[i].billed += payment.finalAmount;
                periodStats[i].paid   += payment.paidAmount;
                periodStats[i].debt   += payment.balance;
                if (payment.method === "BANK") paidBank += payment.paidAmount;
                else paidCash += payment.paidAmount;
              }
              prevReal = isReal;
            });
          }

          const totalPaidR   = periodStats.reduce((s, p) => s + p.paid,   0);
          const totalDebtR   = periodStats.reduce((s, p) => s + p.debt,   0);
          const totalBilledR = periodStats.reduce((s, p) => s + p.billed, 0);

          return (
            <div className="space-y-4 animate-fade-in">
              {/* Export button */}
              <div className="flex justify-end">
                <button onClick={() => exportUshqimiGridExcel(yearStudents, effectiveYear)} className="btn-ghost">
                  <Download className="w-4 h-4" /> Exporto Excel
                </button>
              </div>

              {/* KPI cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="card p-4">
                  <p className="text-xs text-slate-400 mb-1">Nxënës me ushqim</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-white">{enrolled}</p>
                  <p className="text-xs text-slate-400 mt-1">{interruptedIds.size} kanë ndërprerë ndonjëherë</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-slate-400 mb-1">Paguar gjithsej</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaidR)}</p>
                  <p className="text-xs text-slate-400 mt-1">Bankë {formatCurrency(paidBank)} · Cash {formatCurrency(paidCash)}</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-slate-400 mb-1">Borxhe</p>
                  <p className="text-xl font-bold text-red-500">{formatCurrency(totalDebtR)}</p>
                  <p className="text-xs text-slate-400 mt-1">nga {formatCurrency(totalBilledR)} faturuar</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-slate-400 mb-1">Marrin falas</p>
                  <p className="text-xl font-bold text-blue-500">{freeIds.size}</p>
                  <p className="text-xs text-slate-400 mt-1">nxënës, s'ndikojnë te të hyrat</p>
                </div>
              </div>

              {/* Per-period breakdown */}
              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                      <tr>
                        <th className="table-header">Periudha</th>
                        <th className="table-header text-center">Filluan</th>
                        <th className="table-header text-center">Ndërprenë</th>
                        <th className="table-header text-center">Falas</th>
                        <th className="table-header text-right">Faturuar</th>
                        <th className="table-header text-right">Paguar</th>
                        <th className="table-header text-right">Borxh</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {PERIOD_BUCKETS.map((period, i) => (
                        <tr key={period.label}>
                          <td className="table-cell font-medium">{period.label}</td>
                          <td className="table-cell text-center text-green-600 font-semibold">{periodStats[i].started || "—"}</td>
                          <td className="table-cell text-center text-slate-400">{periodStats[i].interrupted || "—"}</td>
                          <td className="table-cell text-center text-blue-500">{periodStats[i].free || "—"}</td>
                          <td className="table-cell text-right">{formatCurrency(periodStats[i].billed)}</td>
                          <td className="table-cell text-right text-green-600">{formatCurrency(periodStats[i].paid)}</td>
                          <td className="table-cell text-right text-red-500 font-semibold">{formatCurrency(periodStats[i].debt)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          );
        })()}

        {/* ── INCOME TAB content starts here ── */}
        {tab === "income" && <>

        {/* ── Pricing Calculator ── */}
        <div className="card overflow-hidden">
          <button
            onClick={() => setShowCalc(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
          >
            <div className="flex items-center gap-2 text-slate-700 dark:text-slate-200 font-semibold text-sm">
              <Calculator className="w-4 h-4 text-primary-500" />
              Kalkulatori i Çmimeve
            </div>
            {showCalc ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>

          {showCalc && (
            <div className="border-t border-slate-100 dark:border-slate-700">
              {/* Price input */}
              <div className="px-5 pt-4 pb-3 flex flex-wrap items-end gap-4">
                <div>
                  <label className="form-label">Çmimi 2 shujta / ditë (€)</label>
                  <input type="number" value={price2Meals}
                    onChange={e => setPrice2Meals(parseFloat(e.target.value) || 0)}
                    className="form-input w-36" min="0" step="0.5" />
                </div>
                <div className="flex items-center gap-1.5 text-xs text-slate-400 pb-2">
                  <Info className="w-3.5 h-3.5" />
                  Mengjesi: {formatCurrency(price2Meals * 3/8)}/ditë · Dreka: {formatCurrency(price2Meals * 5/8)}/ditë
                </div>
              </div>

              {/* Periods table */}
              <div className="overflow-x-auto px-5 pb-4">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr className="bg-green-100 dark:bg-green-900/30">
                      <th className="text-left px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300">Muaji</th>
                      <th className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 text-center">Ditë pune</th>
                      <th className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 text-center">Çmimi</th>
                      <th className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 text-center">Çmimi / 2 muaj</th>
                      <th className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 text-center">Vetëm Mengjesi</th>
                      <th className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 text-center">Vetëm Dreka</th>
                      <th className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 text-center">Klasa e parë</th>
                      <th className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 text-center">Zbritje e paparishikueshme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((p, i) => {
                      const total2   = p.days * price2Meals;
                      const mengjesi = p.days * price2Meals * 3/8;
                      const dreka    = p.days * price2Meals * 5/8;
                      const klasa    = p.klasaDays * price2Meals;
                      const zbritje  = p.zbritjeDays * price2Meals;
                      return (
                        <tr key={p.name} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="px-3 py-2.5">
                            <span className="font-medium text-slate-700 dark:text-slate-200">{p.name}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <input type="number" value={p.days}
                              onChange={e => setPeriods(prev => prev.map((x, j) => j === i ? { ...x, days: parseInt(e.target.value) || 0 } : x))}
                              className="w-14 text-center border border-slate-200 dark:border-slate-600 rounded-lg px-1.5 py-1 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                              min="0" max="60" />
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-500">{price2Meals}€</td>
                          <td className="px-3 py-2.5 text-center font-bold text-primary-600 dark:text-primary-400">{formatCurrency(total2)}</td>
                          <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">{formatCurrency(mengjesi)}</td>
                          <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">{formatCurrency(dreka)}</td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <input type="number" value={p.klasaDays}
                                onChange={e => setPeriods(prev => prev.map((x, j) => j === i ? { ...x, klasaDays: parseInt(e.target.value) || 0 } : x))}
                                className="w-14 text-center border border-slate-200 dark:border-slate-600 rounded-lg px-1.5 py-1 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                min="0" max="60" />
                              <span className="font-bold text-primary-600 dark:text-primary-400 text-sm w-16 text-left">{formatCurrency(klasa)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <input type="number" value={p.zbritjeDays}
                                onChange={e => setPeriods(prev => prev.map((x, j) => j === i ? { ...x, zbritjeDays: parseInt(e.target.value) || 0 } : x))}
                                className="w-14 text-center border border-slate-200 dark:border-slate-600 rounded-lg px-1.5 py-1 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                                min="0" max="60" />
                              <span className="font-bold text-slate-600 dark:text-slate-300 text-sm w-16 text-left">
                                {p.zbritjeDays > 0 ? formatCurrency(zbritje) : "—"}
                              </span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    {(() => {
                      const totalDays    = periods.reduce((s, p) => s + p.days, 0);
                      const totalKlasa   = periods.reduce((s, p) => s + p.klasaDays, 0);
                      const totalZbritje = periods.reduce((s, p) => s + p.zbritjeDays, 0);
                      return (
                        <tr className="bg-green-50 dark:bg-green-900/20 font-bold border-t-2 border-green-200 dark:border-green-800">
                          <td className="px-3 py-2.5 text-slate-700 dark:text-slate-200">Totali</td>
                          <td className="px-3 py-2.5 text-center text-slate-700 dark:text-slate-200">{totalDays}</td>
                          <td className="px-3 py-2.5 text-center text-slate-500">{price2Meals}€</td>
                          <td className="px-3 py-2.5 text-center text-primary-700 dark:text-primary-300">{formatCurrency(totalDays * price2Meals)}</td>
                          <td className="px-3 py-2.5 text-center text-slate-700 dark:text-slate-200">{formatCurrency(totalDays * price2Meals * 3/8)}</td>
                          <td className="px-3 py-2.5 text-center text-slate-700 dark:text-slate-200">{formatCurrency(totalDays * price2Meals * 5/8)}</td>
                          <td className="px-3 py-2.5 text-center text-primary-700 dark:text-primary-300">{formatCurrency(totalKlasa * price2Meals)}</td>
                          <td className="px-3 py-2.5 text-center text-slate-700 dark:text-slate-200">{formatCurrency(totalZbritje * price2Meals)}</td>
                        </tr>
                      );
                    })()}
                  </tfoot>
                </table>
              </div>

              {/* Manual calculator (collapsible) */}
              <div className="border-t border-slate-100 dark:border-slate-700">
                <button onClick={() => setShowManual(v => !v)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm text-slate-500 dark:text-slate-400">
                  <span className="font-medium">Kalkulator Manual</span>
                  {showManual ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {showManual && (
                  <div className="px-5 pb-5 space-y-4">
                    <div className="flex flex-wrap items-end gap-4">
                      <div>
                        <label className="form-label">Ditë pune / muaj</label>
                        <input type="number" value={workingDays} onChange={e => setWorkingDays(parseInt(e.target.value) || 20)}
                          className="form-input w-28" min="1" max="31" />
                      </div>
                      <div>
                        <label className="form-label">Muaj / vit</label>
                        <input type="number" value={monthsPerYear} onChange={e => setMonthsPerYear(parseInt(e.target.value) || 10)}
                          className="form-input w-28" min="1" max="12" />
                      </div>
                      <div className="flex items-center gap-1.5 text-xs text-slate-400 pb-2">
                        <Info className="w-3.5 h-3.5" />
                        Ndryshimi i çmimit nuk ndikon pagesat ekzistuese
                      </div>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                      {MEAL_PLANS.filter(p => p.value !== "dite_specifike" && p.value !== "periudhe").map(plan => (
                        <div key={plan.value} className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                          <p className="text-[10px] text-slate-400 mb-1 leading-tight">{plan.label}</p>
                          <p className="text-base font-bold text-primary-600 dark:text-primary-400">
                            {formatCurrency(prices[plan.value as keyof typeof prices] || 0)}
                          </p>
                        </div>
                      ))}
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-slate-400 mb-1 leading-tight">Ditë specifike (× n ditë)</p>
                        <p className="text-base font-bold text-slate-500">{formatCurrency(price2Meals)}/ditë</p>
                      </div>
                      <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-slate-400 mb-1 leading-tight">Periudhë (× n muaj)</p>
                        <p className="text-base font-bold text-slate-500">{formatCurrency(price2Meals * workingDays)}/muaj</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-primary-500 mb-1 leading-tight font-medium">1 shujtë / vit ({monthsPerYear} muaj × {workingDays} ditë)</p>
                        <p className="text-lg font-bold text-primary-700 dark:text-primary-300">{formatCurrency(prices["1_shujtë_vit"])}</p>
                      </div>
                      <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl p-3 text-center">
                        <p className="text-[10px] text-primary-500 mb-1 leading-tight font-medium">2 shujta / vit ({monthsPerYear} muaj × {workingDays} ditë)</p>
                        <p className="text-lg font-bold text-primary-700 dark:text-primary-300">{formatCurrency(prices["2_shujta_vit"])}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Stats ── */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          <button onClick={() => setStatFilter("all")}
            className="card p-3 flex items-center gap-2 hover:ring-2 hover:ring-slate-300 dark:hover:ring-slate-600 transition-all text-left">
            <Users className="w-8 h-8 text-slate-300 dark:text-slate-600 flex-shrink-0" />
            <div><p className="text-xl font-bold text-slate-800 dark:text-white">{students.length}</p><p className="text-xs text-slate-400">Gjithsej</p></div>
          </button>
          <button onClick={() => setStatFilter("paid")}
            className="card p-3 flex items-center gap-2 hover:ring-2 hover:ring-green-300 dark:hover:ring-green-700 transition-all text-left">
            <CheckCircle className="w-8 h-8 text-green-400 flex-shrink-0" />
            <div><p className="text-xl font-bold text-green-600">{paid}</p><p className="text-xs text-slate-400">Paguar</p></div>
          </button>
          <button onClick={() => setStatFilter("overdue")}
            className="card p-3 flex items-center gap-2 hover:ring-2 hover:ring-red-300 dark:hover:ring-red-700 transition-all text-left">
            <AlertCircle className="w-8 h-8 text-red-400 flex-shrink-0" />
            <div><p className="text-xl font-bold text-red-500">{overdue}</p><p className="text-xs text-slate-400">Vonuar</p></div>
          </button>
          <button onClick={() => setStatFilter("revenue")}
            className="card p-3 hover:ring-2 hover:ring-green-300 dark:hover:ring-green-700 transition-all text-left">
            <p className="text-xs text-slate-400">Të Hyra</p>
            <p className="text-lg font-bold text-green-600 mt-0.5">{formatCurrency(totalRevenue)}</p>
          </button>
          <button onClick={() => setStatFilter("debt")}
            className="card p-3 hover:ring-2 hover:ring-red-300 dark:hover:ring-red-700 transition-all text-left">
            <p className="text-xs text-slate-400">Borxhe</p>
            <p className="text-lg font-bold text-red-500 mt-0.5">{formatCurrency(totalDebt)}</p>
          </button>
        </div>

        {/* ── Enrollment control panel ── */}
        <div className="card p-4 space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            {/* View toggle */}
            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 text-sm">
              <button
                onClick={() => setShowOnlyEnrolled(true)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${showOnlyEnrolled ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Me ushqim <span className="ml-1 text-xs font-bold text-primary-600">{enrolled}</span>
              </button>
              <button
                onClick={() => setShowOnlyEnrolled(false)}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${!showOnlyEnrolled ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Të gjithë <span className="ml-1 text-xs font-bold text-slate-400">{yearStudents.length}</span>
              </button>
            </div>

            {/* Shto nxënës */}
            <button
              onClick={() => setEnrollModal(true)}
              className="btn-primary text-sm"
              disabled={notEnrolled === 0}
            >
              <Plus className="w-4 h-4" />
              Shto nxënës {notEnrolled > 0 && <span className="ml-1 bg-white/20 rounded px-1.5 py-0.5 text-xs">{notEnrolled} pa ushqim</span>}
            </button>

            {/* Filtri i klasës */}
            <select value={classId} onChange={e => setClassId(e.target.value)} className="form-input w-36 text-sm">
              <option value="">Të gjitha klasat</option>
              {classes.map(c => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>

            {/* Filtri i ciklit */}
            <select value={cycleFilter} onChange={e => setCycleFilter(e.target.value)} className="form-input w-44 text-sm">
              <option value="">Të gjitha ciklet</option>
              {CYCLES.map(c => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>

            {/* Import Excel */}
            <Link href={`/ushqimi/import`} className="btn-secondary text-sm">
              <FileUp className="w-4 h-4" />
              Import Excel
            </Link>

            {/* Exporto Excel */}
            <button onClick={() => exportUshqimiGridExcel(displayed, effectiveYear)} className="btn-secondary text-sm">
              <Download className="w-4 h-4" />
              Exporto Excel
            </button>

            {/* Printo Bexhet — per klasen e filtruar aktualisht */}
            <button onClick={() => printClassBadges(displayed, selectedClassName)} className="btn-secondary text-sm" disabled={displayed.length === 0}>
              <IdCard className="w-4 h-4" />
              Printo Bexhet {classId && <span className="ml-1 text-xs text-slate-400">({selectedClassName})</span>}
            </button>
          </div>
        </div>

        {/* ── Filters ── */}
        <div className="flex flex-wrap gap-3 items-center">
          <div className="relative flex-1 min-w-48 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Kërko nxënësin..." className="form-input pl-9" />
          </div>
          {enrolled > 0 && (
            <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex min-w-24 max-w-48">
              <div className="bg-green-500 h-full" style={{ width: `${(paid    / enrolled) * 100}%` }} />
              <div className="bg-red-400 h-full"   style={{ width: `${(overdue / enrolled) * 100}%` }} />
              <div className="bg-slate-200 dark:bg-slate-600 h-full" style={{ width: `${(pending / enrolled) * 100}%` }} />
            </div>
          )}
        </div>

        {/* ── Student Table — 5 periudha, si Excel-i i zyrës ── */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="table-header w-8">#</th>
                  <th className="table-header">Nxënësi</th>
                  <th className="table-header">Klasa</th>
                  <th className="table-header">Ushqimi</th>
                  {PERIOD_BUCKETS.map(period => (
                    <th key={period.label} className="table-header text-center whitespace-nowrap">{period.label}</th>
                  ))}
                  <th className="table-header">Paguar</th>
                  <th className="table-header">Borxhi</th>
                  <th className="table-header text-right">Veprime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {yearLoading ? (
                  <tr><td colSpan={9} className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary-400 mx-auto" /></td></tr>
                ) : sorted.length === 0 ? (
                  <tr><td colSpan={9} className="py-16 text-center text-slate-400 text-sm">Asnjë nxënës nuk u gjet</td></tr>
                ) : displayed.map((s, i) => {
                  const rowPeriods = PERIOD_BUCKETS.map(period => ({
                    period,
                    payment: findPeriodPayment(s.installments, period.months),
                  }));
                  const hasMissingPeriods = rowPeriods.some(rp => !rp.payment);
                  const totalPlan = rowPeriods.reduce((sum, rp) => sum + (rp.payment?.finalAmount || 0), 0);
                  const totalPaid = rowPeriods.reduce((sum, rp) => sum + (rp.payment?.paidAmount  || 0), 0);
                  const totalDebtRow = rowPeriods.reduce((sum, rp) => sum + (rp.payment?.balance   || 0), 0);
                  const anyOverdue = rowPeriods.some(rp => rp.payment?.status === "OVERDUE");
                  return (
                    <tr key={s.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${anyOverdue ? "bg-red-50/40 dark:bg-red-900/10" : ""}`}>
                      <td className="table-cell text-slate-400 text-xs">{i + 1}</td>
                      <td className="table-cell">
                        <Link href={`/students/${s.id}`} className="font-semibold text-slate-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400">
                          {s.firstName} {s.lastName}
                        </Link>
                      </td>
                      <td className="table-cell">
                        {s.class
                          ? <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded text-xs font-medium">{s.class.name}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="table-cell font-semibold">
                        {totalPlan > 0 ? formatCurrency(totalPlan) : <span className="text-slate-300">—</span>}
                      </td>
                      {rowPeriods.map(({ period, payment }) => {
                        const skipped = payment?.description === SKIPPED_MARKER;
                        const free    = payment?.description === FREE_MARKER;
                        return (
                          <td key={period.label} className="table-cell text-center p-0">
                            <button
                              type="button"
                              onClick={() => setPayModal({ student: s, month: period.canonicalMonth, existingPayment: payment })}
                              className={`w-full h-full px-2 py-2.5 text-xs font-medium transition-colors ${
                                skipped
                                  ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 italic hover:bg-slate-200"
                                  : free
                                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100"
                                  : payment?.method === "BANK"
                                  ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100"
                                  : payment && payment.balance > 0
                                  ? "text-red-600 dark:text-red-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-700"
                                  : "text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"
                              }`}
                            >
                              {skipped
                                ? "Ndërprerë"
                                : free
                                ? "Falas"
                                : payment?.method === "BANK"
                                ? "Bankë"
                                : payment
                                ? formatCurrency(payment.finalAmount)
                                : "—"}
                            </button>
                          </td>
                        );
                      })}
                      <td className="table-cell text-green-600 dark:text-green-400 font-medium">
                        {totalPaid > 0 ? formatCurrency(totalPaid) : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="table-cell">
                        {totalDebtRow > 0
                          ? <span className="text-red-600 dark:text-red-400 font-bold">{formatCurrency(totalDebtRow)}</span>
                          : totalPlan > 0
                          ? <span className="text-green-500 text-xs">✓</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="table-cell text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setCalcModal(s)}
                            title="Kalkulator i Ushqimit"
                            className="p-1.5 rounded-lg text-amber-400 hover:text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors"
                          >
                            <Calculator className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setPrintModal(s)}
                            title="Gjenero faturë"
                            className="p-1.5 rounded-lg text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:text-slate-500 dark:hover:text-primary-400 transition-colors"
                          >
                            <Printer className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setBadgeModal(s)}
                            title="Bexhi i nxënësit"
                            className="p-1.5 rounded-lg text-slate-300 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 dark:text-slate-500 dark:hover:text-violet-400 transition-colors"
                          >
                            <IdCard className="w-4 h-4" />
                          </button>
                          {hasMissingPeriods && (
                            <button
                              onClick={() => billMissingPeriods(s)}
                              title="Gjenero periudhat e mbetura (sipas Kalkulatorit)"
                              className="p-1.5 rounded-lg text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:text-slate-500 dark:hover:text-primary-400 transition-colors"
                            >
                              <Receipt className="w-4 h-4" />
                            </button>
                          )}
                          {totalPlan > 0 && (
                            <button
                              onClick={() => handleRemoveFromUshqimi(s)}
                              title="Hiq nga ushqimi"
                              className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-slate-500 dark:hover:text-red-400 transition-colors"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="text-xs text-slate-400 px-4 py-2.5 border-t border-slate-100 dark:border-slate-700">
            Kliko mbi një qelizë periudhe për të shtuar ose ndryshuar pagesën e asaj periudhe.
          </p>
        </div>

        </>}
      </div>

      {/* ── Modals ── */}
      {payModal && (
        <UshqimiPayModal
          student={payModal.student}
          existingPayment={payModal.existingPayment}
          month={payModal.month} year={periodCalYear(payModal.month)}
          prices={prices}
          workingDays={workingDays}
          periods={periods}
          overrideAmount={calcAmount}
          onClose={() => { setPayModal(null); setCalcAmount(undefined); }}
          onSave={async (rid) => { setPayModal(null); setCalcAmount(undefined); await fetchYearData(); if (rid) setReceiptPaymentId(rid); }}
        />
      )}
      {calcModal && (
        <UshqimiCalcModal
          student={calcModal}
          price2Meals={price2Meals}
          periods={periods}
          onClose={() => setCalcModal(null)}
          onApply={(s, amount, canonicalMonth) => {
            setCalcModal(null);
            setCalcAmount(amount);
            setPayModal({ student: s, month: canonicalMonth, existingPayment: findPeriodPayment(s.installments, PERIOD_BUCKETS.find(p => p.canonicalMonth === canonicalMonth)!.months) });
          }}
        />
      )}
      {printModal && (
        <InvoicePrintModal
          student={printModal}
          payment={printModal.payment}
          categoryName="Ushqimi"
          month={month} year={resolvedYear}
          onClose={() => setPrintModal(null)}
        />
      )}
      {receiptPaymentId && (
        <PaymentReceiptModal
          paymentId={receiptPaymentId}
          onClose={() => setReceiptPaymentId(null)}
        />
      )}
      {statFilter && (
        <StatListModal
          filter={statFilter}
          students={yearStudents}
          onClose={() => setStatFilter(null)}
        />
      )}
      {enrollModal && (
        <EnrollModal
          notEnrolled={yearStudents.filter(s => s.installments.length === 0)}
          onEnroll={(s) => { setEnrollModal(false); billMissingPeriods(s); }}
          onClose={() => setEnrollModal(false)}
        />
      )}
      {badgeModal && (
        <StudentBadgeModal
          student={badgeModal}
          onClose={() => setBadgeModal(null)}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  Payment Modal — specialized for meals                 */
/* ═══════════════════════════════════════════════════════ */
function UshqimiPayModal({ student, existingPayment, month, year, prices, workingDays, periods, onClose, onSave, overrideAmount }: {
  student: StudentRow; existingPayment: Payment | null; month: number; year: number;
  prices: Record<string, number>; workingDays: number; periods: Period[];
  overrideAmount?: number;
  onClose: () => void; onSave: (receiptPaymentId?: number) => void;
}) {
  const existing = existingPayment;
  const isCalc = overrideAmount != null;
  // Ditët parazgjedhur duhet të përputhen me periudhën reale (Kalkulatori i Çmimeve),
  // jo me vlerën gjenerike "Ditë pune/muaj" — përndryshe të dyja vendet tregojnë numra të ndryshëm.
  const periodIndex = PERIOD_BUCKETS.findIndex(p => p.canonicalMonth === month);
  const periodDays = periodIndex >= 0 ? (periods[periodIndex]?.days ?? workingDays) : workingDays;
  const [days, setDays] = useState(
    existing && existing.finalAmount > 0 && prices["2_shujta_ditë"] > 0
      ? Math.max(1, Math.round(existing.finalAmount / prices["2_shujta_ditë"]))
      : periodDays
  );
  const [pricePerDay, setPricePerDay] = useState(
    existing && days > 0 ? Math.round((existing.finalAmount / days) * 100) / 100 : prices["2_shujta_ditë"]
  );
  const [paidAmount,  setPaidAmount]  = useState(String(existing?.paidAmount ?? ""));
  const [method,      setMethod]      = useState(existing?.method ?? "CASH");
  const [dueDate,     setDueDate]     = useState(
    existing?.dueDate
      ? new Date(existing.dueDate).toISOString().split("T")[0]
      : new Date(year, month - 1, 5).toISOString().split("T")[0]
  );
  const [paidDate, setPaidDate] = useState(
    existing?.paidDate
      ? new Date(existing.paidDate).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [saving, setSaving] = useState(false);

  const finalAmount = isCalc ? (overrideAmount ?? 0) : Math.round(days * pricePerDay * 100) / 100;
  const paid = parseFloat(paidAmount || "0");
  const balance = Math.max(0, finalAmount - paid);

  const periodLabel = PERIOD_BUCKETS.find(p => p.canonicalMonth === month)?.label || MONTHS[month - 1];
  const description = isCalc
    ? `${periodLabel} ${year}`
    : `${days} ditë × ${formatCurrency(pricePerDay)} — ${periodLabel} ${year}`;

  async function handleSave(withPrint = false) {
    setSaving(true);
    const payload = {
      studentId: student.id,
      categoryId: 2,
      amount: finalAmount,
      discount: 0, discountType: null, scholarship: 0,
      finalAmount,
      paidAmount: paid,
      method,
      dueDate,
      paidDate: paid > 0 ? paidDate : null,
      month, year,
      description,
    };

    const catRes = await fetch("/api/categories");
    const cats = await catRes.json();
    const cat = cats.find((c: { name: string; id: number }) => c.name === "Ushqimi");
    if (cat) payload.categoryId = cat.id;

    let receiptPaymentId: number | undefined;

    if (existing) {
      const r = await fetch(`/api/payments/${existing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (r.ok && paid > 0) receiptPaymentId = existing.id;
    } else {
      const r = await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (r.ok && paid > 0) {
        const created = await r.json();
        receiptPaymentId = created.id;
      }
    }
    setSaving(false);
    onSave(withPrint ? receiptPaymentId : undefined);
  }

  const isSkipped = existing?.description === SKIPPED_MARKER;
  const isFree    = existing?.description === FREE_MARKER;

  async function markAs(marker: string) {
    setSaving(true);
    const payload: Record<string, unknown> = {
      studentId: student.id, categoryId: 2,
      amount: 0, discount: 0, discountType: null, scholarship: 0,
      finalAmount: 0, paidAmount: 0,
      method, dueDate, paidDate: null,
      month, year,
      description: marker,
    };
    if (!existing) {
      const catRes = await fetch("/api/categories");
      const cats = await catRes.json();
      const cat = cats.find((c: { name: string; id: number }) => c.name === "Ushqimi");
      if (cat) payload.categoryId = cat.id;
    }
    if (existing) {
      await fetch(`/api/payments/${existing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/payments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    onSave(undefined);
  }

  const markSkipped = () => markAs(SKIPPED_MARKER);
  const markFree    = () => markAs(FREE_MARKER);

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in overflow-y-auto max-h-[92vh]" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Pagesa Ushqimit</h3>
            <p className="text-sm text-slate-400 mt-0.5">
              {student.firstName} {student.lastName}
              {student.class && <span> • Klasa {student.class.name}</span>}
              {" • "}{MONTHS[month - 1]} {year}
            </p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {/* Calculator override notice */}
          {isCalc ? (
            <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
              <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium">
                <Calculator className="w-4 h-4" />
                Shumë e llogaritur nga Kalkulatori
              </div>
              <span className="text-lg font-black text-amber-600">{formatCurrency(overrideAmount ?? 0)}</span>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Numri i ditëve <span className="text-red-500">*</span></label>
                <input type="number" value={days}
                  onChange={e => setDays(parseInt(e.target.value) || 0)}
                  className="form-input" min="0" />
              </div>
              <div>
                <label className="form-label">Çmimi / ditë (€) <span className="text-red-500">*</span></label>
                <input type="number" value={pricePerDay}
                  onChange={e => setPricePerDay(parseFloat(e.target.value) || 0)}
                  className="form-input" min="0" step="0.01" />
              </div>
            </div>
          )}

          {/* Summary */}
          <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-xl px-4 py-3 flex items-center justify-between">
            <span className="text-sm text-primary-700 dark:text-primary-300 font-medium">{description}</span>
            <span className="text-lg font-black text-primary-600 dark:text-primary-400">{formatCurrency(finalAmount)}</span>
          </div>

          {/* Payment fields */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Paguar (€)</label>
              <input type="number" value={paidAmount}
                onChange={e => setPaidAmount(e.target.value)}
                className="form-input" placeholder="0.00" min="0" step="0.01" />
            </div>
            <div>
              <label className="form-label">Mënyra</label>
              <select value={method} onChange={e => setMethod(e.target.value)} className="form-input">
                <option value="CASH">Cash</option>
                <option value="BANK">Bankë</option>
                <option value="CARD">Kartelë</option>
                <option value="ONLINE">Online</option>
              </select>
            </div>
            <div>
              <label className="form-label">Afati i Pagesës</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="form-input" />
            </div>
            <div>
              <label className="form-label">Data e Pagesës</label>
              <input type="date" value={paidDate} onChange={e => setPaidDate(e.target.value)} className="form-input" />
            </div>
          </div>

          {/* Balance */}
          {balance > 0 && paid > 0 && (
            <div className="flex items-center justify-between p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl text-sm">
              <span className="text-amber-700 dark:text-amber-400">Borxh i mbetur:</span>
              <span className="font-bold text-amber-700 dark:text-amber-400">{formatCurrency(balance)}</span>
            </div>
          )}

          {/* Quick pay */}
          {finalAmount > 0 && paid < finalAmount && (
            <button
              type="button"
              onClick={() => setPaidAmount(String(finalAmount))}
              className="w-full py-2 rounded-xl border-2 border-dashed border-green-300 dark:border-green-700 text-green-600 dark:text-green-400 text-sm font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors flex items-center justify-center gap-2"
            >
              <CheckCircle className="w-4 h-4" />
              Shëno si paguar plotësisht ({formatCurrency(finalAmount)})
            </button>
          )}
        </div>

        {isSkipped && (
          <div className="mx-5 mb-3 p-3 bg-slate-100 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-xl text-sm text-slate-600 dark:text-slate-300">
            Kjo periudhë është shënuar si <strong>Ndërprerë</strong> (nxënësi s&apos;e ndoqi). Plotëso ditë/çmim dhe ruaj për ta rikthyer si periudhë normale.
          </div>
        )}
        {isFree && (
          <div className="mx-5 mb-3 p-3 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl text-sm text-blue-700 dark:text-blue-300">
            Kjo periudhë është shënuar si <strong>Falas</strong> (nxënësi e ndjek pa pagesë). Plotëso ditë/çmim dhe ruaj për ta rikthyer si periudhë normale.
          </div>
        )}

        {/* Footer */}
        <div className="flex flex-wrap gap-2 p-5 pt-0">
          <button onClick={onClose} className="btn-secondary"><X className="w-4 h-4" />Anulo</button>
          <button
            onClick={markSkipped}
            disabled={saving}
            title="Nxënësi nuk e ndoqi këtë periudhë — s'ngarkohet asnjë shumë, mund të rikthehet më vonë"
            className="btn-secondary text-slate-500"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
            {isSkipped ? "Ndërprerë (rifresko)" : "Shëno si Ndërprerë"}
          </button>
          <button
            onClick={markFree}
            disabled={saving}
            title="Nxënësi e ndjek këtë periudhë pa pagesë — s'numërohet te të hyrat as te borxhi"
            className="btn-secondary text-blue-500"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {isFree ? "Falas (rifresko)" : "Shëno si Falas"}
          </button>
          <button onClick={() => { handleSave(false); }} disabled={saving || finalAmount === 0} className="btn-secondary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Duke ruajtur..." : "Ruaj"}
          </button>
          <button
            onClick={() => { handleSave(true); }}
            disabled={saving || finalAmount === 0 || paid <= 0}
            className="btn-primary flex-1 justify-center whitespace-nowrap"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
            Ruaj &amp; Printo Dëshminë
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  Enroll modal — pick students to add to food service  */
/* ═══════════════════════════════════════════════════════ */
function EnrollModal({ notEnrolled, onEnroll, onClose }: {
  notEnrolled: StudentRow[];
  onEnroll: (s: StudentRow) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = notEnrolled
    .filter(s =>
      `${s.firstName} ${s.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      (s.class?.name || "").toLowerCase().includes(search.toLowerCase())
    )
    .sort((a, b) =>
      a.firstName.localeCompare(b.firstName, "sq", { sensitivity: "base" }) ||
      a.lastName.localeCompare(b.lastName, "sq", { sensitivity: "base" })
    );

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Shto nxënës në ushqim</h3>
            <p className="text-xs text-slate-400 mt-0.5">{notEnrolled.length} nxënës pa ushqim — kliko për të shtuar</p>
          </div>
          <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              autoFocus
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Kërko emrin ose klasën..."
              className="form-input pl-9 w-full"
            />
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-12">Asnjë nxënës u gjet</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map(s => (
                <li key={s.id}>
                  <button
                    onClick={() => onEnroll(s)}
                    className="w-full flex items-center gap-3 px-5 py-3 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors text-left"
                  >
                    <div className="flex-1">
                      <p className="font-medium text-slate-800 dark:text-slate-100 text-sm">
                        {s.firstName} {s.lastName}
                      </p>
                      {s.parentPhone && <p className="text-xs text-slate-400">{s.parentPhone}</p>}
                    </div>
                    {s.class && (
                      <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded text-xs font-medium flex-shrink-0">
                        {s.class.name}
                      </span>
                    )}
                    <Plus className="w-4 h-4 text-primary-500 flex-shrink-0" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  Stat list modal                                       */
/* ═══════════════════════════════════════════════════════ */
const FILTER_CONFIG: Record<StatFilter, { label: string; color: string }> = {
  all:     { label: "Të gjithë nxënësit",       color: "text-slate-700 dark:text-slate-200" },
  paid:    { label: "Nxënës me pagesë",          color: "text-green-600" },
  overdue: { label: "Nxënës me pagesë vonuar",   color: "text-red-500" },
  pending: { label: "Nxënës pa pagesë",          color: "text-slate-500" },
  revenue: { label: "Nxënës me pagesa aktive",   color: "text-green-600" },
  debt:    { label: "Nxënës me borxh",           color: "text-red-500" },
};

function StatListModal({ filter, students, onClose }: {
  filter: StatFilter;
  students: StudentRow[];
  onClose: () => void;
}) {
  const filtered = students.filter(s => {
    if (filter === "all")     return true;
    if (filter === "paid")    return s.payment?.status === "PAID";
    if (filter === "overdue") return s.payment?.status === "OVERDUE";
    if (filter === "pending") return !s.payment || s.payment.status === "PENDING";
    if (filter === "revenue") return (s.payment?.paidAmount ?? 0) > 0;
    if (filter === "debt")    return (s.payment?.balance ?? 0) > 0;
    return false;
  });

  const cfg = FILTER_CONFIG[filter];

  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700 flex-shrink-0">
          <div>
            <h3 className={`font-bold text-base ${cfg.color}`}>{cfg.label}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{filtered.length} nxënës</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        {/* List */}
        <div className="overflow-y-auto flex-1">
          {filtered.length === 0 ? (
            <p className="text-center text-slate-400 text-sm py-12">Asnjë nxënës</p>
          ) : (
            <ul className="divide-y divide-slate-100 dark:divide-slate-800">
              {filtered.map((s, i) => {
                const phoneProminent = filter === "overdue" || filter === "debt";
                return (
                  <li key={s.id} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                    <span className="text-xs text-slate-300 dark:text-slate-600 w-5 flex-shrink-0 text-right">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-slate-800 dark:text-slate-100 text-sm truncate">
                        {s.firstName} {s.lastName}
                        {s.class && (
                          <span className="ml-2 text-xs font-normal text-primary-500 dark:text-primary-400">{s.class.name}</span>
                        )}
                      </p>
                      {phoneProminent && (
                        s.parentPhone ? (
                          <a href={`tel:${s.parentPhone}`}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-primary-600 dark:text-primary-400 hover:underline mt-0.5"
                            onClick={e => e.stopPropagation()}>
                            <Phone className="w-3 h-3" />
                            {s.parentPhone}
                          </a>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-300 dark:text-slate-600 mt-0.5">
                            <Phone className="w-3 h-3" /> Pa numër
                          </span>
                        )
                      )}
                    </div>
                    {(filter === "revenue" || filter === "debt") && s.payment && (
                      <span className={`text-sm font-bold flex-shrink-0 ${filter === "debt" ? "text-red-500" : "text-green-600"}`}>
                        {filter === "revenue"
                          ? formatCurrency(s.payment.paidAmount)
                          : formatCurrency(s.payment.balance)}
                      </span>
                    )}
                    {!phoneProminent && (
                      s.parentPhone ? (
                        <a href={`tel:${s.parentPhone}`}
                          className="text-sm font-medium text-primary-600 dark:text-primary-400 hover:underline flex-shrink-0"
                          onClick={e => e.stopPropagation()}>
                          {s.parentPhone}
                        </a>
                      ) : (
                        <span className="text-xs text-slate-300 dark:text-slate-600 flex-shrink-0">—</span>
                      )
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════ */
/*  Ushqimi Fee Calculator Modal                              */
/* ═══════════════════════════════════════════════════════════ */
const USHQIMI_PERIODS = ["Shtator/Tetor", "Nëntor/Dhjetor", "Janar/Shkurt", "Mars/Prill", "Maj/Qershor"];

function UshqimiCalcModal({ student, price2Meals, periods, onClose, onApply }: {
  student: StudentRow;
  price2Meals: number;
  periods: Period[];
  onClose: () => void;
  onApply: (student: StudentRow, amount: number, canonicalMonth: number) => void;
}) {
  const [mealsPerDay, setMealsPerDay] = useState<1 | 2>(2);
  const [selected, setSelected] = useState<boolean[]>(Array(5).fill(true));
  const [daysAttended, setDaysAttended] = useState<number[]>(periods.map(p => p.days));

  const pricePerDay = mealsPerDay === 1 ? price2Meals / 2 : price2Meals;
  const calculatedAmount = selected.reduce(
    (total, sel, i) => sel ? total + daysAttended[i] * pricePerDay : total,
    0
  );

  function togglePeriod(i: number) {
    setSelected(prev => prev.map((v, j) => j === i ? !v : v));
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-lg animate-fade-in overflow-y-auto max-h-[92vh]"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Calculator className="w-5 h-5 text-amber-500" />
              Kalkulator i Ushqimit
            </h3>
            <p className="text-sm text-slate-400 mt-0.5">
              {student.firstName} {student.lastName}
              {student.class && <span> • Klasa {student.class.name}</span>}
            </p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Meal type */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Lloji i vaktit</p>
            <div className="flex gap-2">
              {([1, 2] as const).map(n => (
                <button
                  key={n}
                  onClick={() => setMealsPerDay(n)}
                  className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                    mealsPerDay === n
                      ? "border-amber-500 bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300"
                      : "border-slate-200 dark:border-slate-600 text-slate-500 dark:text-slate-400"
                  }`}
                >
                  {n === 1 ? "1 shujtë / ditë" : "2 shujta / ditë"}
                  <span className="block text-xs font-bold mt-0.5 opacity-70">
                    {formatCurrency(n === 1 ? price2Meals / 2 : price2Meals)}/ditë
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Period grid */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Periudhat e ndjekura</p>
              <div className="flex gap-2">
                <button onClick={() => setSelected(Array(5).fill(true))} className="text-xs text-primary-600 hover:underline">Të gjitha</button>
                <button onClick={() => setSelected(Array(5).fill(false))} className="text-xs text-slate-400 hover:underline">Asnjë</button>
              </div>
            </div>
            <div className="space-y-2">
              {USHQIMI_PERIODS.map((label, i) => (
                <div
                  key={i}
                  className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${
                    selected[i]
                      ? "border-amber-400 bg-amber-50 dark:bg-amber-900/10"
                      : "border-slate-200 dark:border-slate-700 opacity-60"
                  }`}
                >
                  <button
                    onClick={() => togglePeriod(i)}
                    className={`w-5 h-5 rounded-md flex-shrink-0 flex items-center justify-center border-2 transition-all ${
                      selected[i]
                        ? "bg-amber-500 border-amber-500 text-white"
                        : "border-slate-300 dark:border-slate-600"
                    }`}
                  >
                    {selected[i] && <span className="text-xs font-bold">✓</span>}
                  </button>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-200 flex-1">{label}</span>
                  <div className="flex items-center gap-1.5">
                    <input
                      type="number"
                      value={daysAttended[i]}
                      onChange={e => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setDaysAttended(prev => prev.map((d, j) => j === i ? val : d));
                      }}
                      disabled={!selected[i]}
                      className="w-14 text-center border border-slate-200 dark:border-slate-600 rounded-lg px-1.5 py-1 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-40"
                      min="0"
                      max="60"
                    />
                    <span className="text-xs text-slate-400">ditë</span>
                    <span className="text-xs font-semibold text-amber-600 w-16 text-right">
                      {selected[i] ? formatCurrency(daysAttended[i] * pricePerDay) : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Result */}
          <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-500">Çmimi / ditë</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(pricePerDay)}</span>
            </div>
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-500">Ditë gjithsej</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {selected.reduce((t, s, i) => s ? t + daysAttended[i] : t, 0)} ditë
              </span>
            </div>
            <div className="flex items-center justify-between border-t border-amber-200 dark:border-amber-700 pt-2 mt-2">
              <span className="font-bold text-slate-800 dark:text-white">Total për t&apos;u paguar</span>
              <span className="text-xl font-bold text-amber-600">{formatCurrency(calculatedAmount)}</span>
            </div>
          </div>
        </div>

        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">Anulo</button>
          <button
            onClick={() => {
              const firstSelected = selected.findIndex(Boolean);
              const canonicalMonth = PERIOD_BUCKETS[firstSelected >= 0 ? firstSelected : 0].canonicalMonth;
              onApply(student, Math.round(calculatedAmount * 100) / 100, canonicalMonth);
            }}
            disabled={calculatedAmount <= 0}
            className="btn-primary flex-1 justify-center"
          >
            <Calculator className="w-4 h-4" />
            Apliko si Pagesë
          </button>
        </div>
      </div>
    </div>
  );
}
