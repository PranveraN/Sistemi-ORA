"use client";

import { useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { askDeleteReason, reasonHeaders } from "@/lib/auditReason";
import Header from "@/components/layout/Header";
import Link from "next/link";
import { formatCurrency, formatDate, MONTHS } from "@/lib/utils";
import { PERIOD_BUCKETS } from "@/lib/food-periods";
import {
  type PlanState, type UshqimiPlan, type Kest, type Shujta, type ShujtaState,
  planForPeriod, kesteMujore, kaVonese, afatiAktual, kesteTeMbuluara, periudhaEParePaFilluar, isMujorAnywhere,
  shujtaForPeriod, shujtaSuffix, SHUJTA_LABEL,
} from "@/lib/ushqimiPlan";
import { CYCLES, getCycle, isGrade1 } from "@/lib/school-cycles";
import { ACADEMIC_YEARS, CALENDAR_YEARS, DEFAULT_ACADEMIC_YEAR, type YearType } from "@/lib/academicYear";
import { BADGE_CSS, buildBadgeCardHTML } from "@/lib/badge-html";
import * as XLSX from "xlsx";
import {
  Search, CheckCircle, AlertCircle, Plus, X, Save,
  Users, Loader2, Printer, Calculator, ChevronDown, ChevronUp, Info,
  TrendingUp, TrendingDown, ArrowLeftRight, Phone, BarChart3, Download, FileUp, IdCard, Trash2, Receipt, Send, Bot,
  Wallet, CalendarDays,
} from "lucide-react";
import InvoicePrintModal from "@/components/finance/InvoicePrintModal";
import ExpensesSection from "@/components/finance/ExpensesSection";
import PaymentReceiptModal from "@/components/finance/PaymentReceiptModal";
import StudentBadgeModal from "@/components/students/StudentBadgeModal";
import NotificationPreviewModal, { type NotificationRecipient } from "@/components/notifications/NotificationPreviewModal";
import { buildObligationMessage, deriveObligationStatus, type Obligation } from "@/lib/notificationTemplates";
import FamilyPaymentModal from "@/components/finance/FamilyPaymentModal";
import FamilyReceiptPrintModal from "@/components/finance/FamilyReceiptPrintModal";

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
  note: string | null;
  receiptNumber: string | null; month: number; year: number;
}
interface Class { id: number; name: string; level: string; }

interface StudentRow {
  id: number; firstName: string; lastName: string;
  parentPhone: string | null;
  parentName: string | null;
  class: { id: number; name: string } | null;
  payment: Payment | null;
  installments: Payment[];
  status: string;
  inactiveDate: string | null;
}

interface CashStats {
  totalRevenue: number;
  handedOver: number;
  totalExpenses: number;
  totalInvestments: number;
  // Vetëm cash hyn në arkë (shih /api/category-payments → stats.cashSimple)
  cashSimple?: { cash: number; bank: number; expensesCash: number };
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

// Statusi/shuma REALE e nxënësit për tërë vitin — mbledh vetëm periudhat me
// detyrim real (jashtë Ndërprerë/Falas, të cilat s'llogariten as si borxh as
// si pagesë, njësoj si te tabela dhe skeda Raport). E domosdoshme sepse
// `s.payment` (i llogaritur nga API-ja e përgjithshme category-payments) s'e
// njeh fare këtë konventë — për një nxënës me periudha VETËM Falas/Ndërprerë,
// `s.payment.status` del "Vonuar" (paidAmount=0 literalisht, edhe pse s'ka
// asnjë detyrim real), duke shtrembëruar kartelat "Paguar"/"Vonuar" etj.
// `mujorVonese` (opsionale): për periudhat me plan Mujor kthen true/false sipas
// afatit të KËSTIT (kësti i tetorit s'është me vonesë para 31.10); null = Dymujor
// (vlen rregulli i vjetër, i pandryshuar).
function computeRealPaymentInfo(installments: Payment[], mujorVonese?: (periodIdx: number, p: Payment) => boolean | null): { status: string; paidAmount: number; balance: number } {
  let finalAmount = 0, paidAmount = 0, anyBilled = false, anyOverdue = false, anyMujorOverdue = false;
  const now = new Date();
  PERIOD_BUCKETS.forEach((period, i) => {
    const p = findPeriodPayment(installments, period.months);
    if (!p) return;
    if (p.description === SKIPPED_MARKER || p.description === FREE_MARKER) return;
    anyBilled = true;
    finalAmount += p.finalAmount;
    paidAmount  += p.paidAmount;
    const mv = mujorVonese?.(i, p) ?? null;
    if (mv !== null) { if (mv) anyMujorOverdue = true; }
    else if (new Date(p.dueDate) < now && p.paidAmount === 0) anyOverdue = true;
  });
  const balance = Math.max(0, finalAmount - paidAmount);
  let status: string;
  if (!anyBilled) status = "PENDING";
  else if (finalAmount > 0 && paidAmount >= finalAmount) status = "PAID";
  else if (anyMujorOverdue) status = "OVERDUE";
  else if (paidAmount > 0) status = "PARTIAL";
  else if (anyOverdue) status = "OVERDUE";
  else status = "PENDING";
  return { status, paidAmount, balance };
}

function exportUshqimiGridExcel(students: StudentRow[], year: number) {
  const rows = students.map((s, i) => {
    const periodValues = PERIOD_BUCKETS.map(period => {
      const payment = findPeriodPayment(s.installments, period.months);
      if (!payment) return "";
      if (payment.description === SKIPPED_MARKER) return "Ndërprerë";
      if (payment.method === "BANK") return `Bankë (${payment.finalAmount})`;
      if (payment.method === "KOMPENSIM") return `Kompensim (${payment.finalAmount})`;
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

function buildBadgeSheetHTML(students: StudentRow[]): string {
  const cards = students
    .map(s => buildBadgeCardHTML({ id: s.id, firstName: s.firstName, lastName: s.lastName, className: s.class?.name || "" }))
    .join("");
  return `<!DOCTYPE html><html lang="sq"><head><meta charset="UTF-8"/>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#fff; }
.sheet { display:grid; grid-template-columns: repeat(2, 90mm); grid-auto-rows: 55mm; gap: 4mm; padding: 10mm; justify-content:center; }
${BADGE_CSS}
</style></head><body><div class="sheet">${cards}</div></body></html>`;
}

// Shkarkon bexhet si PDF — ndan një "canvas" të vetëm, potencialisht shumë
// të gjatë (shumë nxënës), në aq faqe A4 sa duhen, njësoj si mekanizmi i
// përdorur tashmë për profaturat e TIMI Invest (shih TimiInvestModal.tsx).
async function downloadClassBadgesPDF(students: StudentRow[], className: string) {
  if (students.length === 0) return;
  const html = buildBadgeSheetHTML(students);

  const iframe = document.createElement("iframe");
  iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:800px;height:1200px;border:none;";
  document.body.appendChild(iframe);
  iframe.contentDocument!.open();
  iframe.contentDocument!.write(html);
  iframe.contentDocument!.close();

  await new Promise(r => setTimeout(r, 400));

  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import("jspdf"),
    import("html2canvas"),
  ]);

  const canvas = await html2canvas(iframe.contentDocument!.body, {
    scale: 2,
    useCORS: true,
    width: 800,
    backgroundColor: "#ffffff",
  });

  document.body.removeChild(iframe);

  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const pdfW = pdf.internal.pageSize.getWidth();
  const pdfH = pdf.internal.pageSize.getHeight();
  const imgW = pdfW;
  // Sa piksela të canvas-it i përgjigjen lartësisë së një faqeje A4, në
  // shkallën e imazhit të plotë.
  const pageCanvasHeight = Math.floor((pdfH * canvas.width) / imgW);

  let renderedHeight = 0;
  let page = 0;
  while (renderedHeight < canvas.height) {
    const sliceHeight = Math.min(pageCanvasHeight, canvas.height - renderedHeight);
    const pageCanvas = document.createElement("canvas");
    pageCanvas.width = canvas.width;
    pageCanvas.height = sliceHeight;
    const ctx = pageCanvas.getContext("2d")!;
    ctx.drawImage(canvas, 0, renderedHeight, canvas.width, sliceHeight, 0, 0, canvas.width, sliceHeight);

    if (page > 0) pdf.addPage();
    const sliceImgH = (sliceHeight * imgW) / canvas.width;
    pdf.addImage(pageCanvas.toDataURL("image/png"), "PNG", 0, 0, imgW, sliceImgH);

    renderedHeight += sliceHeight;
    page++;
  }

  pdf.save(`Bexhet-${(className || "te-gjithe").replace(/\s+/g, "-")}.pdf`);
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

// Kolonat e ditëve: të gjithë · Klasa e parë · "Zbritje e paparashikueshme"
type DayCol = "days" | "klasaDays" | "zbritjeDays";

// Një periudhë me më pak ditë se kalendari (shih rastetKalendari te faqja)
interface RastKalendari {
  s: StudentRow; i: number; p: Payment;
  ditet: number; kal: number; rate: number; detRi: number;
  calYear: number; split: [number, number] | null;
}

interface Period {
  name: string;
  days: number;
  klasaDays: number;
  zbritjeDays: number;
  // Kalendari: ditët e mësimit për secilin nga dy muajt e periudhës (p.sh. days [22, 20]).
  // Kur janë plotësuar të dy, totali i kolonës = shuma e tyre.
  muaj?: Record<DayCol, (number | null)[]>;
}

// Ndarja mujore e një kolone, vetëm kur janë plotësuar të dy muajt.
function splitOf(p: Period | undefined, col: DayCol): [number, number] | null {
  const a = p?.muaj?.[col]?.[0], b = p?.muaj?.[col]?.[1];
  return a != null && b != null ? [a, b] : null;
}

// Ndryshon ditët e një muaji; totali i periudhës rillogaritet kur të dy muajt kanë vlerë.
function withMonthDays(p: Period, col: DayCol, idx: 0 | 1, v: number | null): Period {
  const base = p.muaj ?? { days: [null, null], klasaDays: [null, null], zbritjeDays: [null, null] };
  const muaj = { days: [...base.days], klasaDays: [...base.klasaDays], zbritjeDays: [...base.zbritjeDays] };
  muaj[col][idx] = v;
  const a = muaj[col][0], b = muaj[col][1];
  return { ...p, muaj, ...(a != null && b != null ? { [col]: a + b } : {}) };
}

// Kolona e ditëve që vlen për nxënësin, e vendosur te `days` (dhe te `muaj.days`):
// "Zbritje" për të shënuarit (kur > 0), Klasa e parë për klasat 1, përndryshe të gjithë.
function periodsForTrack(periods: Period[], tagged: boolean, grade1: boolean): Period[] {
  return periods.map(p => {
    const col: DayCol = tagged && p.zbritjeDays > 0 ? "zbritjeDays" : grade1 ? "klasaDays" : "days";
    if (col === "days") return p;
    return { ...p, days: p[col], muaj: p.muaj ? { ...p.muaj, days: p.muaj[col] } : undefined };
  });
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
  const [month, setMonth]   = useState(now.getMonth() + 1);
  const [year, setYear]     = useState(DEFAULT_ACADEMIC_YEAR);
  const [yearType, setYearType] = useState<YearType>("academic");
  const [search, setSearch]   = useState("");
  const [classId, setClassId] = useState("");
  const [cycleFilter, setCycleFilter] = useState("");
  const [classes, setClasses] = useState<Class[]>([]);
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [yearCashStats, setYearCashStats] = useState<CashStats | null>(null);
  const [loading, setLoading]   = useState(true);
  const [badgePdfLoading, setBadgePdfLoading] = useState(false);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  // Rreshtat e zgjedhur ruhen edhe kur ndërrohet filtri i klasës — që të zgjidhen
  // nxënës nga klasa të ndryshme (p.sh. bexhe për një nga 1A, një nga 4B, një nga 7A)
  const [selectedRows, setSelectedRows] = useState<Map<number, StudentRow>>(new Map());
  const [notifyRecipients, setNotifyRecipients] = useState<NotificationRecipient[] | null>(null);

  function toggleSelect(row: StudentRow) {
    const id = row.id;
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
    setSelectedRows(prev => {
      const next = new Map(prev);
      next.has(id) ? next.delete(id) : next.set(id, row);
      return next;
    });
  }
  function clearSelection() { setSelected(new Set()); setSelectedRows(new Map()); }

  // Shënimi i nxënësve (p.sh. "Zbritje e paparashikueshme") për vitin e zgjedhur
  const [tags, setTags] = useState<Map<number, string>>(new Map());
  const [tagBusy, setTagBusy] = useState(false);
  // Plani i pagesës së ushqimit (Dymujor/Mujor) për vitin e zgjedhur
  const [planet, setPlanet] = useState<Map<number, PlanState>>(new Map());
  // Shujtat (Mëngjes + Drekë / vetëm mëngjes / vetëm drekë) për vitin e zgjedhur
  const [shujtat, setShujtat] = useState<Map<number, ShujtaState>>(new Map());

  useEffect(() => {
    fetch("/api/classes").then(r => r.json()).then((data: Class[]) => {
      setClasses([...data].sort((a, b) => {
        const na = parseInt(a.name), nb = parseInt(b.name);
        if (na !== nb) return na - nb;
        return a.name.localeCompare(b.name);
      }));
    });
  }, []);

  // Pricing config — çmimi (price2Meals) ruhet si parazgjedhje e sistemit (tabela
  // Setting), jo vetëm në state të faqes — përndryshe çdo rifreskim/rihapje e
  // kthente te 4€ i fiksuar, edhe pse stafi e kishte ndryshuar në 4.5€ (shih
  // handleSavePrice2Meals më poshtë, e vetmja mënyrë që e ruan realisht).
  const [price2Meals,   setPrice2Meals]   = useState(4);
  const [price2MealsSaved, setPrice2MealsSaved] = useState(4);
  const [savingPrice,   setSavingPrice]   = useState(false);
  // Klasa e parë ka çmim tjetër (zakonisht më i ulët) se pjesa tjetër e shkollës.
  const [price2MealsG1,      setPrice2MealsG1]      = useState(4);
  const [price2MealsG1Saved, setPrice2MealsG1Saved] = useState(4);
  const [savingPriceG1,      setSavingPriceG1]      = useState(false);
  // Vetëm mëngjes / vetëm drekë (€/ditë), për të gjithë dhe për Klasën e Parë.
  // Bosh = s'është caktuar → 3/8 dhe 5/8 e çmimit të plotë (si e tregonte Kalkulatori më parë).
  type CmimetShujta = { m: string; d: string; mG1: string; dG1: string };
  const [cmimetShujta, setCmimetShujta] = useState<CmimetShujta>({ m: "", d: "", mG1: "", dG1: "" });
  const [cmimetShujtaSaved, setCmimetShujtaSaved] = useState<string>(JSON.stringify({ m: "", d: "", mG1: "", dG1: "" }));
  const [savingShujta, setSavingShujta] = useState(false);
  const [workingDays,   setWorkingDays]   = useState(20);
  const [monthsPerYear, setMonthsPerYear] = useState(10);
  const [periods,       setPeriods]       = useState<Period[]>(DEFAULT_PERIODS);
  // Ditët e ruajtura për vitin e zgjedhur (për të ditur nëse ka ndryshime pa ruajtur)
  const [periodsSaved,  setPeriodsSaved]  = useState<string>(JSON.stringify(DEFAULT_PERIODS));
  const [periodsFromYear, setPeriodsFromYear] = useState<boolean>(false);
  const [savingPeriods, setSavingPeriods] = useState(false);
  const [showCalc,      setShowCalc]      = useState(true);
  const [showManual,    setShowManual]    = useState(false);

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(s => {
      const v = parseFloat(s.ushqimiPrice2Meals);
      if (!isNaN(v) && v > 0) { setPrice2Meals(v); setPrice2MealsSaved(v); }
      const v1 = parseFloat(s.ushqimiPrice2MealsGrade1);
      if (!isNaN(v1) && v1 > 0) { setPrice2MealsG1(v1); setPrice2MealsG1Saved(v1); }
      const cs = { m: s.ushqimiPriceMengjes ?? "", d: s.ushqimiPriceDreke ?? "", mG1: s.ushqimiPriceMengjesGrade1 ?? "", dG1: s.ushqimiPriceDrekeGrade1 ?? "" };
      setCmimetShujta(cs); setCmimetShujtaSaved(JSON.stringify(cs));
    });
  }, []);

  // Ditët e Kalkulatorit ruhen për çdo vit shkollor; viti pa ditë të ruajtura nis nga parazgjedhja
  useEffect(() => {
    if (!year) return;
    let cancelled = false;
    fetch(`/api/ushqimi/periods?year=${year}`).then(r => (r.ok ? r.json() : null)).then(d => {
      if (cancelled) return;
      const p: Period[] = Array.isArray(d?.periods) && d.periods.length === DEFAULT_PERIODS.length ? d.periods : DEFAULT_PERIODS;
      setPeriods(p); setPeriodsSaved(JSON.stringify(p)); setPeriodsFromYear(Array.isArray(d?.periods));
    }).catch(() => {});
    fetch(`/api/ushqimi/tags?year=${year}`).then(r => (r.ok ? r.json() : [])).then((rows: { studentId: number; label: string }[]) => {
      if (!cancelled) setTags(new Map(rows.map(t => [t.studentId, t.label])));
    }).catch(() => {});
    fetch(`/api/ushqimi/plani?year=${year}`).then(r => (r.ok ? r.json() : {})).then((m: Record<string, PlanState>) => {
      if (!cancelled) setPlanet(new Map(Object.entries(m).map(([k, v]) => [parseInt(k), v])));
    }).catch(() => {});
    fetch(`/api/ushqimi/shujtat?year=${year}`).then(r => (r.ok ? r.json() : {})).then((m: Record<string, ShujtaState>) => {
      if (!cancelled) setShujtat(new Map(Object.entries(m).map(([k, v]) => [parseInt(k), v])));
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [year]);

  async function handleSavePeriods() {
    setSavingPeriods(true);
    const res = await fetch("/api/ushqimi/periods", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year, periods }) });
    setSavingPeriods(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Ruajtja dështoi."); return; }
    setPeriodsSaved(JSON.stringify(periods)); setPeriodsFromYear(true);
  }

  async function applyTag(ids: number[]) {
    const label = window.prompt("Teksti i shënimit për nxënësit e zgjedhur:", "Zbritje e paparashikueshme");
    if (!label || !label.trim()) return;
    setTagBusy(true);
    const res = await fetch("/api/ushqimi/tags", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year, studentIds: ids, label: label.trim() }) });
    setTagBusy(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Ruajtja dështoi."); return; }
    setTags(prev => { const n = new Map(prev); ids.forEach(id => n.set(id, label.trim())); return n; });
  }
  async function removeTag(ids: number[]) {
    if (!confirm(`Hiq shënimin për ${ids.length} nxënës?`)) return;
    setTagBusy(true);
    const res = await fetch("/api/ushqimi/tags", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year, studentIds: ids }) });
    setTagBusy(false);
    if (!res.ok) { alert("Heqja dështoi."); return; }
    setTags(prev => { const n = new Map(prev); ids.forEach(id => n.delete(id)); return n; });
  }
  // Për nxënësit e shënuar: ditët e kolonës "Zbritje e paparashikueshme" (kur janë > 0);
  // për Klasën e parë: kolona "Klasa e parë" (fillojnë më vonë → më pak ditë).
  function periodsFor(student: { id: number; class?: { name: string } | null }): Period[] {
    return periodsForTrack(periods, tags.has(student.id), isGrade1(student.class?.name));
  }

  // Ruan planin (Dymujor/Mujor) nga periudha `nga` e tutje; periudhat para saj s'preken.
  async function ruajPlanin(studentId: number, plan: UshqimiPlan, nga: number): Promise<boolean> {
    const res = await fetch("/api/ushqimi/plani", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year, studentId, plan, nga }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Ruajtja e planit dështoi."); return false; }
    const st: PlanState = await res.json();
    setPlanet(prev => new Map(prev).set(studentId, st));
    return true;
  }

  async function ruajShujtat(studentId: number, shujta: Shujta, nga: number): Promise<boolean> {
    const res = await fetch("/api/ushqimi/shujtat", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ year, studentId, shujta, nga }) });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Ruajtja e shujtave dështoi."); return false; }
    const st: ShujtaState = await res.json();
    setShujtat(prev => new Map(prev).set(studentId, st));
    return true;
  }

  // Butoni te rreshti: ndryshon planin vetëm për periudhat që s'kanë filluar ende.
  async function nderroPlaninNgaRreshti(s: StudentRow) {
    const nga = periudhaEParePaFilluar(PERIOD_BUCKETS.map(p => p.months), effectiveYear);
    const tani = planForPeriod(planet.get(s.id), Math.min(nga, PERIOD_BUCKETS.length - 1));
    const iRi: UshqimiPlan = tani === "MUJOR" ? "DYMUJOR" : "MUJOR";
    if (nga >= PERIOD_BUCKETS.length) {
      alert("Të gjitha periudhat e këtij viti kanë filluar. Plani për një periudhë të filluar ndryshohet nga dritarja e pagesës së asaj periudhe.");
      return;
    }
    if (!confirm(`${s.firstName} ${s.lastName}: kalo në plan ${iRi === "MUJOR" ? "MUJOR (pagesë çdo muaj, me dy këste)" : "DYMUJOR"} nga ${PERIOD_BUCKETS[nga].label} e tutje?\n\nPeriudhat që kanë filluar mbeten siç janë. Pagesat dhe detyrimet s'ndryshojnë.`)) return;
    await ruajPlanin(s.id, iRi, nga);
  }

  // Këstet mujore të një periudhe (vetëm kur plani i asaj periudhe është Mujor) — llogaritje
  // vetëm për shfaqje/vonesa; detyrimi mbetet një rresht i vetëm.
  function kesteFor(s: { id: number; class?: { name: string } | null }, i: number, p: Payment | null | undefined): Kest[] | null {
    if (!p || p.description === SKIPPED_MARKER || p.description === FREE_MARKER) return null;
    if (planForPeriod(planet.get(s.id), i) !== "MUJOR") return null;
    const m = (p.description || "").match(/^(\d+)\s*ditë/);
    const rate = cmimiPer(s, i) || 1;
    const days = m ? parseInt(m[1]) : Math.round(p.finalAmount / rate);
    return kesteMujore({
      months: PERIOD_BUCKETS[i].months as [number, number],
      calYear: periodCalYear(PERIOD_BUCKETS[i].canonicalMonth),
      split: splitOf(periodsFor(s)[i], "days"),
      days, finalAmount: p.finalAmount, paidAmount: p.paidAmount,
    });
  }
  // Rastet ku ditët e shënuara të një periudhe janë më pak se kalendari (p.sh. prind
  // mujor i regjistruar vetëm për një muaj) — vetëm lexim; ndreqen vetëm të zgjedhurat.
  function rastetKalendari(): RastKalendari[] {
    const out: RastKalendari[] = [];
    for (const s of yearStudents) {
      const tp = periodsFor(s);
      PERIOD_BUCKETS.forEach((period, i) => {
        const p = findPeriodPayment(s.installments, period.months);
        if (!p || p.description === SKIPPED_MARKER || p.description === FREE_MARKER) return;
        // Çmimi i shënuar te periudha (nëse ka), përndryshe ai i shujtave të nxënësit
        const mc = (p.description || "").match(/^\d+\s*ditë\s*×\s*([\d.,]+)/);
        const rate = mc ? parseFloat(mc[1].replace(/\./g, "").replace(",", ".")) : cmimiPer(s, i);
        const m = (p.description || "").match(/^(\d+)\s*ditë/);
        const ditet = m ? parseInt(m[1]) : Math.round(p.finalAmount / (rate || 1));
        const kal = tp[i]?.days ?? 0;
        if (!kal || ditet >= kal) return;
        out.push({ s, i, p, ditet, kal, rate, detRi: Math.round(kal * rate * 100) / 100, calYear: periodCalYear(period.canonicalMonth), split: splitOf(tp[i], "days") });
      });
    }
    return out;
  }
  const [rastetOpen, setRastetOpen] = useState(false);

  async function ndreqRastet(rastet: RastKalendari[]) {
    const cats = await fetch("/api/categories").then(r => r.json()).catch(() => []);
    const catId = (cats as { name: string; id: number }[]).find(c => c.name === "Ushqimi")?.id;
    if (!catId) { alert("Kategoria Ushqimi s'u gjet."); return; }
    const ymdL = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const deshtuan: string[] = [];
    for (const r of rastet) {
      const period = PERIOD_BUCKETS[r.i];
      const keste = kesteMujore({ months: period.months as [number, number], calYear: r.calYear, split: r.split, days: r.kal, finalAmount: r.detRi, paidAmount: r.p.paidAmount });
      const res = await fetch(`/api/payments/${r.p.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: r.s.id, categoryId: catId,
          amount: r.detRi, discount: 0, discountType: null, scholarship: 0,
          finalAmount: r.detRi, paidAmount: r.p.paidAmount,
          method: r.p.method ?? "CASH",
          dueDate: ymdL(afatiAktual(keste)),
          paidDate: r.p.paidAmount > 0 && r.p.paidDate ? new Date(r.p.paidDate).toISOString().split("T")[0] : null,
          month: period.canonicalMonth, year: r.calYear,
          description: `${r.kal} ditë × ${formatCurrency(r.rate)} — ${period.label} ${r.calYear}${shujtaSuffix(shujtaForPeriod(shujtat.get(r.s.id), r.i))}`,
          note: `${r.p.note ? `${r.p.note} · ` : ""}Ndrequr nga kalendari (${r.ditet} → ${r.kal} ditë), plan Mujor`,
        }),
      });
      if (!res.ok || !(await ruajPlanin(r.s.id, "MUJOR", r.i))) deshtuan.push(`${r.s.firstName} ${r.s.lastName}`);
    }
    await fetchYearData();
    alert(deshtuan.length ? `U ndreqën ${rastet.length - deshtuan.length}; dështuan: ${deshtuan.join(", ")}` : `U ndreqën ${rastet.length} raste.`);
  }

  const mujorVoneseFor = (s: StudentRow) => (i: number, p: Payment) => {
    const k = kesteFor(s, i, p);
    return k ? kaVonese(k) : null;
  };

  async function handleSavePrice2Meals() {
    setSavingPrice(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ushqimiPrice2Meals: String(price2Meals) }),
    });
    setSavingPrice(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Ruajtja dështoi.");
      return;
    }
    setPrice2MealsSaved(price2Meals);
  }

  async function handleSavePrice2MealsG1() {
    setSavingPriceG1(true);
    const res = await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ushqimiPrice2MealsGrade1: String(price2MealsG1) }),
    });
    setSavingPriceG1(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      alert(d.error || "Ruajtja dështoi.");
      return;
    }
    setPrice2MealsG1Saved(price2MealsG1);
  }

  // Norma e saktë sipas klasës — përdoret kudo që llogaritet shuma e parazgjedhur
  // e një pagese ushqimi, që nxënësit e Klasës së Parë të mos marrin gabimisht
  // normën e përgjithshme.
  function priceRateForClass(className: string | null | undefined) {
    return isGrade1(className) ? price2MealsG1 : price2Meals;
  }

  // Çmimi/ditë për secilën zgjedhje shujtash, sipas klasës (Klasa 1 ka çmimet e veta)
  function cmimetPerKlase(className: string | null | undefined): Record<Shujta, number> {
    const g1 = isGrade1(className);
    const full = g1 ? price2MealsG1 : price2Meals;
    const numOr = (v: string, f: number) => { const n = parseFloat(v); return isNaN(n) || n <= 0 ? f : n; };
    const r2 = (n: number) => Math.round(n * 100) / 100;
    return {
      TE_DYJA: full,
      MENGJES: numOr(g1 ? cmimetShujta.mG1 : cmimetShujta.m, r2(full * 3 / 8)),
      DREKE: numOr(g1 ? cmimetShujta.dG1 : cmimetShujta.d, r2(full * 5 / 8)),
    };
  }
  // Çmimi/ditë që vlen për nxënësin në periudhën `i` (sipas shujtave të zgjedhura)
  function cmimiPer(s: { id: number; class?: { name: string } | null }, i: number) {
    return cmimetPerKlase(s.class?.name)[shujtaForPeriod(shujtat.get(s.id), i)];
  }
  async function ruajCmimetShujta() {
    setSavingShujta(true);
    const res = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      ushqimiPriceMengjes: cmimetShujta.m, ushqimiPriceDreke: cmimetShujta.d,
      ushqimiPriceMengjesGrade1: cmimetShujta.mG1, ushqimiPriceDrekeGrade1: cmimetShujta.dG1,
    }) });
    setSavingShujta(false);
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Ruajtja dështoi."); return; }
    setCmimetShujtaSaved(JSON.stringify(cmimetShujta));
  }

  // Tab + category ID
  const [tab,        setTab]        = useState<Tab>("income");
  const [categoryId, setCategoryId] = useState<number | null>(null);

  // View mode
  const [showOnlyEnrolled, setShowOnlyEnrolled] = useState(true);
  const [onlyCurrent, setOnlyCurrent] = useState(false);

  // Year-wide data for the income grid (5 periods at once, independent of `month`)
  const [yearStudents, setYearStudents] = useState<StudentRow[]>([]);
  const [yearLoading,  setYearLoading]  = useState(true);

  // Modals
  const [payModal, setPayModal] = useState<{ student: StudentRow; month: number; existingPayment: Payment | null } | null>(null);
  const [printModal,       setPrintModal]        = useState<StudentRow | null>(null);
  const [receiptPaymentId, setReceiptPaymentId] = useState<number | null>(null);
  // Rreshta shtesë te kuponi (plani Mujor: "Pagesë për: Tetor 2026 — 80 €", "Mbetet nga periudha …")
  const [receiptShtese, setReceiptShtese] = useState<string[] | undefined>();
  const [statFilter,  setStatFilter]  = useState<StatFilter | null>(null);
  const [enrollModal, setEnrollModal] = useState(false);
  const [calcModal,   setCalcModal]   = useState<StudentRow | null>(null);
  const [badgeModal,  setBadgeModal]  = useState<StudentRow | null>(null);
  const [calcAmount,  setCalcAmount]  = useState<number | undefined>();
  const [familyModalOpen, setFamilyModalOpen] = useState(false);
  const [familyReceiptPrintId, setFamilyReceiptPrintId] = useState<number | null>(null);

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

  // Stats (year-wide, across all 5 periods) — bazuar te statusi REAL (shih
  // computeRealPaymentInfo), jo te `s.payment.status` i papërpunuar, që
  // nxënësit "Falas"/"Ndërprerë" të mos numërohen gabimisht si "Vonuar".
  const enrolled    = yearStudents.filter(s => s.installments.length > 0).length;
  const notEnrolled = yearStudents.length - enrolled;
  // "Aktualisht" (vetëm filtër shikimi — s'ndryshon asnjë të dhënë): nxënësi që e ka
  // ushqimin në periudhën aktuale. Shihet periudha aktuale (ose, nëse s'është krijuar
  // ende, periudha e fundit para saj); nëse ajo është "Ndërprerë", s'numërohet.
  // "Falas" numërohet (nxënësi e ndjek). "Me ushqim" mbetet numri i tërë vitit.
  const currentPeriodIdx = (() => {
    const now = new Date();
    const m = now.getMonth() + 1;
    const byMonth = PERIOD_BUCKETS.findIndex(p => p.months.includes(m));
    const idxNow = byMonth >= 0 ? byMonth : PERIOD_BUCKETS.length - 1; // Korrik/Gusht → Maj/Qershor
    if (yearType !== "academic") return idxNow;
    const currentAY = m >= 9 ? now.getFullYear() : now.getFullYear() - 1;
    if (effectiveYear < currentAY) return PERIOD_BUCKETS.length - 1;
    if (effectiveYear > currentAY) return 0;
    return idxNow;
  })();
  const isCurrentlyEating = (s: StudentRow) => {
    if (s.installments.length === 0) return false;
    for (let i = currentPeriodIdx; i >= 0; i--) {
      const p = findPeriodPayment(s.installments, PERIOD_BUCKETS[i].months);
      if (p) return p.description !== SKIPPED_MARKER;
    }
    return false;
  };
  const currentlyEating = yearStudents.filter(isCurrentlyEating).length;
  const realInfoById = new Map(yearStudents.map(s => [s.id, computeRealPaymentInfo(s.installments, mujorVoneseFor(s))]));
  const rastetKal = yearType === "academic" ? rastetKalendari() : [];
  const paid    = yearStudents.filter(s => realInfoById.get(s.id)?.status === "PAID").length;
  const overdue = yearStudents.filter(s => realInfoById.get(s.id)?.status === "OVERDUE").length;
  const pending = yearStudents.filter(s => realInfoById.get(s.id)?.status === "PENDING").length;
  const totalRevenue = yearStudents.reduce((s, r) => s + (realInfoById.get(r.id)?.paidAmount || 0), 0);
  const totalDebt    = yearStudents.reduce((s, r) => s + (realInfoById.get(r.id)?.balance   || 0), 0);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ category: "Ushqimi", search });
    if (month > 0) params.set("month", String(month));
    if (resolvedYear  > 0) {
      params.set("year",  String(resolvedYear));
      // "Të gjitha muajt" + vit akademik → kapërcen dy vite kalendarike (Shtator–Gusht),
      // njësoj si te Shkollimi — përndryshe pagesat/dorëzimet/shpenzimet e Janar–Gusht
      // bien jashtë filtrit kur shihet "Të gjitha".
      if (!(month > 0) && yearType === "academic") params.set("yearType", "academic");
    }
    const res = await fetch(`/api/category-payments?${params}`);
    if (res.ok) {
      const d = await res.json();
      // /api/category-payments kthen edhe nxënësit JOAKTIVË (për borxhin e
      // vjetër) — KPI-të e sipërme (Gjithsej/Paguar/Vonuar/Të Hyra/Borxhe)
      // duhet të numërojnë VETËM nxënësit aktivë, njësoj si grafiku i
      // periudhave (yearStudents) më poshtë, përndryshe numri del i fryrë.
      setStudents((d.students as StudentRow[]).filter(s => s.status === "ACTIVE"));
      if (d.category?.id) setCategoryId(d.category.id);
    }
    setLoading(false);
  }, [month, resolvedYear, yearType, search]);

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
      // /api/category-payments kthen edhe nxënësit JOAKTIVË (për t'i shfaqur në
      // fund të CategoryPaymentPage) — këtu, në Ushqimi, "Të gjithë"/"Me ushqim"/
      // "pa ushqim" duhet të numërojnë VETËM nxënësit aktivë, përndryshe numrat
      // dalin të fryrë (përfshihen edhe ata që kanë lëshuar shkollën).
      setYearStudents((d.students as StudentRow[]).filter(s => s.status === "ACTIVE"));
      setYearCashStats(d.stats ? { totalRevenue: d.stats.totalRevenue, handedOver: d.stats.handedOver, totalExpenses: d.stats.totalExpenses, totalInvestments: d.stats.totalInvestments, cashSimple: d.stats.cashSimple } : null);
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
    const reason = askDeleteReason(warning);
    if (!reason) return;

    const results = await Promise.all(payments.map(p => fetch(`/api/payments/${p.id}`, { method: "DELETE", headers: reasonHeaders(reason) })));
    if (results.some(r => !r.ok)) {
      alert("Disa nga periudhat nuk u fshinë (gabim serveri) — provo përsëri.");
    }
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

    const trackPeriods = periodsFor(s);
    const results = await Promise.all(missing.map(({ period, i }) => {
      // Çmimi sipas klasës dhe shujtave të nxënësit për atë periudhë
      const rate = cmimiPer(s, i);
      const days = trackPeriods[i]?.days ?? workingDays;
      const finalAmount = Math.round(days * rate * 100) / 100;
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
          description: `${days} ditë × ${formatCurrency(rate)} — ${period.label} ${calYear}${shujtaSuffix(shujtaForPeriod(shujtat.get(s.id), i))}`,
        }),
      });
    }));
    if (results.some(r => !r.ok)) {
      alert(`Disa periudha nuk u faturuan dot për ${s.firstName} ${s.lastName} — provo përsëri.`);
    }
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
    return order.indexOf(realInfoById.get(a.id)?.status || "PENDING") - order.indexOf(realInfoById.get(b.id)?.status || "PENDING");
  });

  const byEnrollment = onlyCurrent
    ? sorted.filter(isCurrentlyEating)
    : showOnlyEnrolled ? sorted.filter(s => s.installments.length > 0) : sorted;
  const displayed = cycleFilter ? byEnrollment.filter(s => getCycle(s.class?.name) === cycleFilter) : byEnrollment;

  // Njoftimet për Ushqimin mblidhen për TËRË vitin (5 periudhat), jo për një
  // periudhë të vetme — njësoj si vetë tabela e shfaq "Paguar"/"Borxhi" si
  // kolona të mbledhura, jo periudhë-për-periudhë (shih computeRealPaymentInfo
  // më lart, të cilit i shtohen këtu dueDate/paidDate/receiptNumber që s'i kthen).
  function computeFoodObligation(installments: Payment[], schoolYearLabel: string | null): Obligation {
    let finalAmount = 0, paidAmount = 0;
    let dueDate: string | null = null;
    let paidDateOut: string | null = null;
    let receiptNumber: string | null = null;
    for (const period of PERIOD_BUCKETS) {
      const p = findPeriodPayment(installments, period.months);
      if (!p || p.description === SKIPPED_MARKER || p.description === FREE_MARKER) continue;
      finalAmount += p.finalAmount;
      paidAmount += p.paidAmount;
      if (p.balance > 0 && (!dueDate || new Date(p.dueDate) < new Date(dueDate))) dueDate = p.dueDate;
      if (p.paidDate) paidDateOut = p.paidDate;
      if (p.receiptNumber) receiptNumber = p.receiptNumber;
    }
    return {
      category: "Ushqimi", frequency: "ANNUAL", periodLabel: null, schoolYearLabel,
      totalAmount: finalAmount, paidAmount, balance: Math.max(0, finalAmount - paidAmount),
      dueDate, paidDate: paidDateOut, receiptNumber,
    };
  }

  // Nxënësi mujor: kësti i parë i papaguar që ka kaluar afatin ose skadon brenda `diteParaAfatit` ditëve.
  function kestiPerKujtese(s: StudentRow, diteParaAfatit: number): Kest | null {
    const kufiri = new Date(); kufiri.setDate(kufiri.getDate() + diteParaAfatit);
    for (let i = 0; i < PERIOD_BUCKETS.length; i++) {
      const k = kesteFor(s, i, findPeriodPayment(s.installments, PERIOD_BUCKETS[i].months));
      const x = k?.find(z => z.statusi !== "PAGUAR");
      if (x && x.afati <= kufiri) return x;
    }
    return null;
  }
  function mesazhKesti(s: StudentRow, k: Kest) {
    const mbetja = formatCurrency(k.shuma - k.paguar).replace(/\s*€$/, "");
    return `I nderuar prind, ju kujtojmë këstin e ushqimit për ${s.firstName} ${s.lastName}${s.class ? ` (${s.class.name})` : ""} — ${MONTHS[k.muaji - 1]} ${k.vit}: ${mbetja} €, me afat ${formatDate(k.afati.toISOString())}. Faleminderit! Akademia Ora`;
  }

  // Kujtesa për këstet mujore që skadojnë brenda 5 ditëve (ose kanë skaduar) — kalon te
  // pamja paraprake e njoftimeve; asgjë s'dërgohet pa u konfirmuar aty.
  function generateMonthlyReminders() {
    const recipients: NotificationRecipient[] = [];
    for (const s of displayed) {
      if (s.status !== "ACTIVE" || !s.parentPhone) continue;
      const k = kestiPerKujtese(s, 5);
      if (k) recipients.push({ phone: s.parentPhone, name: `${s.firstName} ${s.lastName} (prindi)`, studentId: s.id, message: mesazhKesti(s, k) });
    }
    if (!recipients.length) { window.alert("Asnjë nxënës mujor s'ka këst që skadon brenda 5 ditëve (ose të vonuar)."); return; }
    setNotifyRecipients(recipients);
  }

  function generateNotificationsFor(rows: StudentRow[]) {
    const schoolYearLabel = yearType === "academic" ? `${effectiveYear}–${effectiveYear + 1}` : null;
    const recipients: NotificationRecipient[] = [];
    let skipped = 0;
    for (const s of rows) {
      if (!s.parentPhone) continue;
      // Nxënësi mujor me këst që skadon/ka skaduar → kujtesë për KËSTIN (dymujorët si më parë)
      const kesti = kestiPerKujtese(s, 5);
      if (kesti) {
        recipients.push({ phone: s.parentPhone, name: `${s.firstName} ${s.lastName} (prindi)`, studentId: s.id, message: mesazhKesti(s, kesti) });
        continue;
      }
      const obligation = computeFoodObligation(s.installments, schoolYearLabel);
      if (obligation.totalAmount <= 0) { skipped++; continue; }
      const msg = buildObligationMessage({ firstName: s.firstName, lastName: s.lastName, className: s.class?.name ?? null }, obligation);
      if (!msg) { skipped++; continue; }
      recipients.push({ phone: s.parentPhone, name: `${s.firstName} ${s.lastName} (prindi)`, studentId: s.id, message: msg });
    }
    if (!recipients.length) {
      window.alert(skipped > 0
        ? "Nxënësit e zgjedhur s'kanë detyrim të papaguar në ushqim (ose s'janë ende të regjistruar)."
        : "Asnjë nga nxënësit e zgjedhur s'ka numër telefoni të regjistruar.");
      return;
    }
    setNotifyRecipients(recipients);
  }

  function generateAutoNotifications() {
    const schoolYearLabel = yearType === "academic" ? `${effectiveYear}–${effectiveYear + 1}` : null;
    const candidates = displayed.filter(s =>
      s.status === "ACTIVE" && s.installments.length > 0 &&
      deriveObligationStatus(computeFoodObligation(s.installments, schoolYearLabel)) !== "PAID"
    );
    generateNotificationsFor(candidates);
  }

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
          <ExpensesSection categoryId={categoryId} type="EXPENSE" month={month} year={resolvedYear} yearType={yearType} />
        )}

        {/* ── HANDOVER TAB ── */}
        {tab === "handover" && (
          <ExpensesSection categoryId={categoryId} type="HANDOVER" month={month} year={resolvedYear} yearType={yearType} />
        )}

        {/* ── REPORT TAB ── */}
        {tab === "report" && (() => {
          const periodStats = PERIOD_BUCKETS.map(() => ({ started: 0, interrupted: 0, free: 0, billed: 0, paid: 0, debt: 0 }));
          const interruptedIds = new Set<number>();
          const freeIds = new Set<number>();
          let paidBank = 0, paidCash = 0, paidKomp = 0;

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
                else if (payment.method === "KOMPENSIM") paidKomp += payment.paidAmount;
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
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4">
                <div className="card p-4">
                  <p className="text-xs text-slate-400 mb-1">Nxënës me ushqim</p>
                  <p className="text-xl font-bold text-slate-800 dark:text-white">{enrolled}</p>
                  <p className="text-xs text-slate-400 mt-1">{interruptedIds.size} kanë ndërprerë ndonjëherë</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-slate-400 mb-1">Paguar gjithsej</p>
                  <p className="text-xl font-bold text-green-600">{formatCurrency(totalPaidR)}</p>
                  <p className="text-xs text-slate-400 mt-1">Bankë {formatCurrency(paidBank)} · Cash {formatCurrency(paidCash)}{paidKomp > 0 ? ` · Kompensim ${formatCurrency(paidKomp)}` : ""}</p>
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
                <div className="card p-4">
                  <p className="text-xs text-slate-400 mb-1">Shpenzimet</p>
                  <p className="text-xl font-bold text-orange-600">{formatCurrency(yearCashStats?.totalExpenses ?? 0)}</p>
                  <p className="text-xs text-slate-400 mt-1">gjatë {yearType === "academic" ? `${effectiveYear}–${effectiveYear + 1}` : effectiveYear}</p>
                </div>
                <div className="card p-4">
                  <p className="text-xs text-slate-400 mb-1">Dorëzimet</p>
                  <p className="text-xl font-bold text-blue-600">{formatCurrency(yearCashStats?.handedOver ?? 0)}</p>
                  <p className="text-xs text-slate-400 mt-1">gjatë {yearType === "academic" ? `${effectiveYear}–${effectiveYear + 1}` : effectiveYear}</p>
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

        {/* Pasqyra e Arkës — sa u mor, sa u dorëzua, sa u shpenzua, sa mbeti në dorë
            (i NJËJTI vit/vit-akademik si skeda "Raport" — jo muaji i fshehur i
            "Të Hyra", që më parë e bënte "Sa kam marrë" të mos përputhej me
            "Paguar gjithsej" të Raportit). */}
        {yearCashStats && (() => {
          // Në arkë = hyrjet CASH − dorëzimet − shpenzimet CASH (pagesat me bankë s'kalojnë nga arka)
          const cs = yearCashStats.cashSimple;
          const cashOnHand = Math.round(((cs?.cash ?? yearCashStats.totalRevenue) - yearCashStats.handedOver - (cs?.expensesCash ?? yearCashStats.totalExpenses) - yearCashStats.totalInvestments) * 100) / 100;
          return (
            <div className="card p-4 border-2 border-primary-100 dark:border-primary-900/40">
              <p className="text-xs font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">Pasqyra e Arkës</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-green-50 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-4.5 h-4.5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Sa kam marrë</p>
                    <p className="text-lg font-bold text-green-600 dark:text-green-400">{formatCurrency(yearCashStats.totalRevenue)}</p>
                    {cs && <p className="text-[11px] text-slate-500">Cash {formatCurrency(cs.cash)} · Bankë {formatCurrency(cs.bank)}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
                    <ArrowLeftRight className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Sa kam dorëzuar</p>
                    <p className="text-lg font-bold text-blue-600 dark:text-blue-400">{formatCurrency(yearCashStats.handedOver)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-full bg-orange-50 dark:bg-orange-900/30 flex items-center justify-center shrink-0">
                    <TrendingDown className="w-4.5 h-4.5 text-orange-600 dark:text-orange-400" />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Sa kam shpenzuar</p>
                    <p className="text-lg font-bold text-orange-600 dark:text-orange-400">{formatCurrency(yearCashStats.totalExpenses)}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${cashOnHand < 0 ? "bg-red-50 dark:bg-red-900/30" : "bg-amber-50 dark:bg-amber-900/30"}`}>
                    <Wallet className={`w-4.5 h-4.5 ${cashOnHand < 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`} />
                  </div>
                  <div>
                    <p className="text-xs text-slate-400">Sa kam në arkë</p>
                    <p className={`text-lg font-bold ${cashOnHand < 0 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>{formatCurrency(cashOnHand)}</p>
                    {cashOnHand < 0 && <p className="text-[11px] text-red-500 mt-0.5">⚠ Ka dalë më shumë se ç&apos;është marrë</p>}
                  </div>
                </div>
              </div>
            </div>
          );
        })()}

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
                {price2Meals !== price2MealsSaved && (
                  <button
                    onClick={handleSavePrice2Meals}
                    disabled={savingPrice}
                    className="btn-primary text-sm pb-2.5"
                    title="Ruaje si çmimin e ri të parazgjedhur — përndryshe kthehet te i vjetri kur rihapet faqja"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingPrice ? "Duke ruajtur..." : `Ruaj si parazgjedhje (${formatCurrency(price2MealsSaved)} → ${formatCurrency(price2Meals)})`}
                  </button>
                )}
                <div className="flex items-center gap-1.5 text-xs text-slate-400 pb-2">
                  <Info className="w-3.5 h-3.5" />
                  Vetëm mëngjes: {formatCurrency(cmimetPerKlase(null).MENGJES)}/ditë · Vetëm drekë: {formatCurrency(cmimetPerKlase(null).DREKE)}/ditë
                </div>
              </div>

              {/* Çmimi i veçantë për Klasën e Parë */}
              <div className="px-5 pb-3 flex flex-wrap items-end gap-4">
                <div>
                  <label className="form-label">Çmimi 2 shujta / ditë — Klasa e Parë (€)</label>
                  <input type="number" value={price2MealsG1}
                    onChange={e => setPrice2MealsG1(parseFloat(e.target.value) || 0)}
                    className="form-input w-36" min="0" step="0.5" />
                </div>
                {price2MealsG1 !== price2MealsG1Saved && (
                  <button
                    onClick={handleSavePrice2MealsG1}
                    disabled={savingPriceG1}
                    className="btn-primary text-sm pb-2.5"
                    title="Ruaje si çmimin e ri të parazgjedhur për Klasën e Parë"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {savingPriceG1 ? "Duke ruajtur..." : `Ruaj si parazgjedhje (${formatCurrency(price2MealsG1Saved)} → ${formatCurrency(price2MealsG1)})`}
                  </button>
                )}
                <div className="flex items-center gap-1.5 text-xs text-slate-400 pb-2">
                  <Info className="w-3.5 h-3.5" />
                  Zbatohet automatikisht për nxënësit e klasave &quot;1A&quot;, &quot;1B&quot;, etj. — pjesa tjetër e shkollës vazhdon me çmimin e përgjithshëm më sipër.
                </div>
              </div>

              {/* Vetëm mëngjes / vetëm drekë — 4 çmimet (bashkë me 2 më sipër = 6) */}
              <div className="px-5 pb-3">
                <div className="rounded-xl border border-teal-100 dark:border-teal-900/50 p-3 space-y-2">
                  <p className="text-xs font-bold text-teal-800 dark:text-teal-300">Vetëm mëngjes / vetëm drekë (€ për ditë)</p>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {([
                      ["m", "Vetëm mëngjes", cmimetPerKlase(null).MENGJES],
                      ["d", "Vetëm drekë", cmimetPerKlase(null).DREKE],
                      ["mG1", "Vetëm mëngjes — Klasa 1", cmimetPerKlase("1").MENGJES],
                      ["dG1", "Vetëm drekë — Klasa 1", cmimetPerKlase("1").DREKE],
                    ] as [keyof CmimetShujta, string, number][]).map(([k, label, vlera]) => (
                      <label key={k} className="block">
                        <span className="text-[11px] text-slate-500">{label}</span>
                        <input type="number" min="0" step="0.05" value={cmimetShujta[k]} placeholder={String(vlera)}
                          onChange={e => setCmimetShujta(prev => ({ ...prev, [k]: e.target.value }))}
                          className="form-input w-full" />
                      </label>
                    ))}
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-400">
                    <span>Bosh = 3/8 (mëngjes) dhe 5/8 (drekë) e çmimit të plotë. Vlen vetëm për periudhat e reja ose kur ruhet periudha.</span>
                    {JSON.stringify(cmimetShujta) !== cmimetShujtaSaved && (
                      <button onClick={ruajCmimetShujta} disabled={savingShujta} className="btn-primary text-xs">
                        <Save className="w-3.5 h-3.5" /> {savingShujta ? "Duke ruajtur..." : "Ruaj çmimet e shujtave"}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Ruajtja e ditëve për vitin */}
              <div className="px-5 pb-2 flex flex-wrap items-center gap-3 text-xs">
                <span className="text-slate-500 dark:text-slate-400">
                  Ditët për vitin <b>{year > 0 ? `${year}–${year + 1}` : "—"}</b>{periodsFromYear ? " (të ruajtura)" : " (parazgjedhje — s'janë ruajtur ende për këtë vit)"}
                </span>
                {year > 0 && (JSON.stringify(periods) !== periodsSaved || !periodsFromYear) && (
                  <button onClick={handleSavePeriods} disabled={savingPeriods} className="btn-primary text-xs">
                    <Save className="w-3.5 h-3.5" /> {savingPeriods ? "Duke ruajtur..." : `Ruaj ditët për ${year}–${year + 1}`}
                  </button>
                )}
                <span className="text-slate-400">Kolona &quot;Zbritje e paparashikueshme&quot; përdoret për nxënësit e shënuar me të.</span>
              </div>

              {/* Kalendari: ditët e mësimit sipas muajit — totali i periudhës = shuma e dy muajve */}
              <div id="ditet-e-mesimit" className="px-5 pb-4">
                <div className="rounded-xl border border-indigo-100 dark:border-indigo-900/50 overflow-hidden">
                  <div className="px-3 py-2 bg-indigo-50 dark:bg-indigo-900/20 flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs font-bold text-indigo-800 dark:text-indigo-300 flex items-center gap-1.5">
                      <CalendarDays className="w-3.5 h-3.5" /> Ditët e mësimit sipas muajit — {year > 0 ? `${year}–${year + 1}` : "—"}
                    </p>
                    <p className="text-[11px] text-indigo-600/80 dark:text-indigo-300/70">
                      Plotësohet një herë në vit. Ditët e periudhës = shuma e dy muajve; dritarja e pagesës i merr vetë.
                    </p>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[11px] text-slate-500 dark:text-slate-400 border-b border-slate-100 dark:border-slate-700">
                          <th className="text-left px-3 py-1.5 font-semibold">Muaji</th>
                          <th className="px-3 py-1.5 font-semibold text-center">Të gjithë</th>
                          <th className="px-3 py-1.5 font-semibold text-center">Klasa e parë</th>
                          <th className="px-3 py-1.5 font-semibold text-center">Zbritje e paparashikueshme</th>
                        </tr>
                      </thead>
                      <tbody>
                        {periods.map((p, i) => (PERIOD_BUCKETS[i]?.months ?? []).map((m, k) => (
                          <tr key={`${p.name}-${m}`} className={`${k === 1 ? "border-b border-slate-200 dark:border-slate-700" : ""}`}>
                            <td className="px-3 py-1 text-slate-700 dark:text-slate-200">
                              {MONTHS[m - 1]}
                              {k === 0 && <span className="ml-1.5 text-[10px] text-slate-400">({p.name})</span>}
                            </td>
                            {(["days", "klasaDays", "zbritjeDays"] as DayCol[]).map(col => {
                              const v = p.muaj?.[col]?.[k];
                              const sp = splitOf(p, col);
                              return (
                                <td key={col} className="px-3 py-1 text-center">
                                  <div className="flex items-center justify-center gap-1.5">
                                    <input type="number" value={v ?? ""} placeholder="—"
                                      onChange={e => {
                                        const raw = e.target.value;
                                        const val = raw === "" ? null : Math.max(0, Math.min(31, parseInt(raw) || 0));
                                        setPeriods(prev => prev.map((x, j) => j === i ? withMonthDays(x, col, k as 0 | 1, val) : x));
                                      }}
                                      className="w-14 text-center border border-slate-200 dark:border-slate-600 rounded-lg px-1.5 py-0.5 text-sm bg-white dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-400"
                                      min="0" max="31" />
                                    {k === 1 && (
                                      <span className={`text-[11px] w-14 text-left ${sp ? "text-indigo-600 dark:text-indigo-300 font-semibold" : "text-slate-300"}`}>
                                        {sp ? `= ${sp[0] + sp[1]}` : `(${p[col]})`}
                                      </span>
                                    )}
                                  </div>
                                </td>
                              );
                            })}
                          </tr>
                        )))}
                      </tbody>
                    </table>
                  </div>
                  <p className="px-3 py-1.5 text-[11px] text-slate-400 border-t border-slate-100 dark:border-slate-700">
                    Kolona &quot;Zbritje&quot;: lëre bosh (ose 0) kur s&apos;ka zbritje në atë periudhë. Pa kalendar të plotësuar, vlen totali i vjetër (në kllapa). Mos harro &quot;Ruaj ditët&quot; më sipër.
                  </p>
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
                      <th className="px-3 py-2 text-xs font-bold text-slate-700 dark:text-slate-300 text-center">Zbritje e paparashikueshme</th>
                    </tr>
                  </thead>
                  <tbody>
                    {periods.map((p, i) => {
                      const total2   = p.days * price2Meals;
                      const mengjesi = p.days * cmimetPerKlase(null).MENGJES;
                      const dreka    = p.days * cmimetPerKlase(null).DREKE;
                      const klasa    = p.klasaDays * price2MealsG1;
                      const zbritje  = p.zbritjeDays * price2Meals;
                      return (
                        <tr key={p.name} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="px-3 py-2.5">
                            <span className="font-medium text-slate-700 dark:text-slate-200">{p.name}</span>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <input type="number" value={p.days}
                              readOnly={!!splitOf(p, "days")}
                              title={splitOf(p, "days") ? `Nga kalendari: ${splitOf(p, "days")!.join(" + ")}` : undefined}
                              onChange={e => setPeriods(prev => prev.map((x, j) => j === i ? { ...x, days: parseInt(e.target.value) || 0 } : x))}
                              className={`w-14 text-center border border-slate-200 dark:border-slate-600 rounded-lg px-1.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${splitOf(p, "days") ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300" : "bg-white dark:bg-slate-700"}`}
                              min="0" max="60" />
                          </td>
                          <td className="px-3 py-2.5 text-center text-slate-500">{price2Meals}€</td>
                          <td className="px-3 py-2.5 text-center font-bold text-primary-600 dark:text-primary-400">{formatCurrency(total2)}</td>
                          <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">{formatCurrency(mengjesi)}</td>
                          <td className="px-3 py-2.5 text-center text-slate-600 dark:text-slate-300">{formatCurrency(dreka)}</td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <input type="number" value={p.klasaDays}
                                readOnly={!!splitOf(p, "klasaDays")}
                                title={splitOf(p, "klasaDays") ? `Nga kalendari: ${splitOf(p, "klasaDays")!.join(" + ")}` : undefined}
                                onChange={e => setPeriods(prev => prev.map((x, j) => j === i ? { ...x, klasaDays: parseInt(e.target.value) || 0 } : x))}
                                className={`w-14 text-center border border-slate-200 dark:border-slate-600 rounded-lg px-1.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${splitOf(p, "klasaDays") ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300" : "bg-white dark:bg-slate-700"}`}
                                min="0" max="60" />
                              <span className="font-bold text-primary-600 dark:text-primary-400 text-sm w-16 text-left">{formatCurrency(klasa)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-2.5 text-center">
                            <div className="flex items-center justify-center gap-1.5">
                              <input type="number" value={p.zbritjeDays}
                                readOnly={!!splitOf(p, "zbritjeDays")}
                                title={splitOf(p, "zbritjeDays") ? `Nga kalendari: ${splitOf(p, "zbritjeDays")!.join(" + ")}` : undefined}
                                onChange={e => setPeriods(prev => prev.map((x, j) => j === i ? { ...x, zbritjeDays: parseInt(e.target.value) || 0 } : x))}
                                className={`w-14 text-center border border-slate-200 dark:border-slate-600 rounded-lg px-1.5 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 ${splitOf(p, "zbritjeDays") ? "bg-indigo-50 dark:bg-indigo-900/20 text-indigo-700 dark:text-indigo-300" : "bg-white dark:bg-slate-700"}`}
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
                          <td className="px-3 py-2.5 text-center text-slate-700 dark:text-slate-200">{formatCurrency(totalDays * cmimetPerKlase(null).MENGJES)}</td>
                          <td className="px-3 py-2.5 text-center text-slate-700 dark:text-slate-200">{formatCurrency(totalDays * cmimetPerKlase(null).DREKE)}</td>
                          <td className="px-3 py-2.5 text-center text-primary-700 dark:text-primary-300">{formatCurrency(totalKlasa * price2MealsG1)}</td>
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
                onClick={() => { setShowOnlyEnrolled(true); setOnlyCurrent(false); }}
                title="Të gjithë nxënësit që kanë pasur ushqim këtë vit (edhe ata që kanë ndërprerë)"
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${showOnlyEnrolled && !onlyCurrent ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Me ushqim <span className="ml-1 text-xs font-bold text-primary-600">{enrolled}</span>
              </button>
              <button
                onClick={() => { setShowOnlyEnrolled(true); setOnlyCurrent(true); }}
                title={`Vetëm ata që e kanë ushqimin në periudhën ${PERIOD_BUCKETS[currentPeriodIdx].label} (pa të ndërprerët)`}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${onlyCurrent ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
              >
                Aktualisht <span className="ml-1 text-xs font-bold text-emerald-600">{currentlyEating}</span>
              </button>
              <button
                onClick={() => { setShowOnlyEnrolled(false); setOnlyCurrent(false); }}
                className={`px-3 py-1.5 rounded-lg font-medium transition-all ${!showOnlyEnrolled && !onlyCurrent ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
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

            {/* Pagesë e Përbashkët — 2+ fëmijë të së njëjtës familje njëherësh */}
            <button onClick={() => setFamilyModalOpen(true)} className="btn-secondary text-sm"
              title="Regjistro dhe printo një dëshmi pagese për 2+ fëmijë të së njëjtës familje njëherësh">
              <Users className="w-4 h-4" />
              Pagesë e Përbashkët
            </button>

            {/* Printo Bexhet — per klasen e filtruar aktualisht */}
            <button onClick={() => printClassBadges(displayed, selectedClassName)} className="btn-secondary text-sm" disabled={displayed.length === 0}>
              <IdCard className="w-4 h-4" />
              Printo Bexhet {classId && <span className="ml-1 text-xs text-slate-400">({selectedClassName})</span>}
            </button>

            {/* Shkarko Bexhet si PDF — e njëjta listë, njësoj si printimi */}
            <button
              onClick={async () => {
                setBadgePdfLoading(true);
                try { await downloadClassBadgesPDF(displayed, selectedClassName); }
                finally { setBadgePdfLoading(false); }
              }}
              className="btn-secondary text-sm"
              disabled={displayed.length === 0 || badgePdfLoading}
            >
              {badgePdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
              {badgePdfLoading ? "Duke gjeneruar..." : "Shkarko PDF"}
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
          <button onClick={generateAutoNotifications} className="btn-secondary text-sm shrink-0">
            <Bot className="w-4 h-4" /> Gjenero automatikisht
          </button>
          {rastetKal.length > 0 && (
            <button onClick={() => setRastetOpen(true)} className="btn-secondary text-sm shrink-0" title="Periudha me më pak ditë se kalendari (p.sh. prind mujor i regjistruar vetëm për një muaj)">
              <AlertCircle className="w-4 h-4 text-amber-500" /> Rastet nga kalendari ({rastetKal.length})
            </button>
          )}
          {[...planet.values()].some(isMujorAnywhere) && (
            <button onClick={generateMonthlyReminders} className="btn-secondary text-sm shrink-0" title="Nxënësit mujorë me këst që skadon brenda 5 ditëve ose të vonuar">
              <CalendarDays className="w-4 h-4 text-violet-500" /> Kujtesa mujore
            </button>
          )}
          {enrolled > 0 && (
            <div className="flex-1 h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden flex min-w-24 max-w-48">
              <div className="bg-green-500 h-full" style={{ width: `${(paid    / enrolled) * 100}%` }} />
              <div className="bg-red-400 h-full"   style={{ width: `${(overdue / enrolled) * 100}%` }} />
              <div className="bg-slate-200 dark:bg-slate-600 h-full" style={{ width: `${(pending / enrolled) * 100}%` }} />
            </div>
          )}
        </div>

        {selected.size > 0 && (
          <div className="card p-3 flex flex-wrap items-center gap-2 bg-primary-50 dark:bg-primary-900/10 border-primary-200 dark:border-primary-800">
            <span className="text-sm text-primary-700 dark:text-primary-300 font-medium">
              {selected.size} nxënës të zgjedhur
              {new Set([...selectedRows.values()].map(r => r.class?.name ?? "")).size > 1 && <span className="font-normal text-xs"> (nga klasa të ndryshme)</span>}
            </span>
            <div className="flex flex-wrap gap-2 ml-auto">
              <button onClick={() => printClassBadges([...selectedRows.values()], "Të zgjedhurit")} className="btn-secondary text-sm">
                <IdCard className="w-4 h-4" /> Printo bexhet ({selected.size})
              </button>
              <button onClick={async () => { setBadgePdfLoading(true); try { await downloadClassBadgesPDF([...selectedRows.values()], "te-zgjedhurit"); } finally { setBadgePdfLoading(false); } }}
                disabled={badgePdfLoading} className="btn-secondary text-sm">
                {badgePdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />} PDF bexhet
              </button>
              <button onClick={() => applyTag([...selected])} disabled={tagBusy || !year} className="btn-secondary text-sm" title="Shëno nxënësit e zgjedhur për këtë vit (p.sh. Zbritje e paparashikueshme)">
                <span className="w-2.5 h-2.5 rounded-full bg-amber-500" aria-hidden /> Shëno
              </button>
              {[...selected].some(id => tags.has(id)) && (
                <button onClick={() => removeTag([...selected].filter(id => tags.has(id)))} disabled={tagBusy} className="btn-secondary text-sm">Hiq shënimin</button>
              )}
              <button
                onClick={() => generateNotificationsFor([...selectedRows.values()])}
                className="btn-secondary text-sm"
              >
                <Send className="w-4 h-4" /> Gjenero njoftime ({selected.size})
              </button>
              <button onClick={clearSelection} className="text-slate-400 hover:text-slate-600" aria-label="Pastro zgjedhjen">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* ── Student Table — 5 periudha, si Excel-i i zyrës ── */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="table-header w-8"></th>
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
                  <tr><td colSpan={10} className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary-400 mx-auto" /></td></tr>
                ) : sorted.length === 0 ? (
                  <tr><td colSpan={10} className="py-16 text-center text-slate-400 text-sm">Asnjë nxënës nuk u gjet</td></tr>
                ) : displayed.map((s, i) => {
                  const rowPeriods = PERIOD_BUCKETS.map(period => ({
                    period,
                    payment: findPeriodPayment(s.installments, period.months),
                  }));
                  const hasMissingPeriods = rowPeriods.some(rp => !rp.payment);
                  const hasAnyPayment = rowPeriods.some(rp => rp.payment);
                  const totalPlan = rowPeriods.reduce((sum, rp) => sum + (rp.payment?.finalAmount || 0), 0);
                  const totalPaid = rowPeriods.reduce((sum, rp) => sum + (rp.payment?.paidAmount  || 0), 0);
                  const totalDebtRow = rowPeriods.reduce((sum, rp) => sum + (rp.payment?.balance   || 0), 0);
                  const rowKeste = rowPeriods.map((rp, pi) => kesteFor(s, pi, rp.payment));
                  const anyOverdue = rowPeriods.some((rp, pi) => rowKeste[pi] ? kaVonese(rowKeste[pi]!) : rp.payment?.status === "OVERDUE");
                  const mujor = isMujorAnywhere(planet.get(s.id));
                  return (
                    <tr key={s.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${anyOverdue ? "bg-red-50/40 dark:bg-red-900/10" : ""}`}>
                      <td className="table-cell">
                        <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s)} className="rounded accent-primary-600" aria-label={`Zgjidh ${s.firstName} ${s.lastName}`} />
                      </td>
                      <td className="table-cell text-slate-400 text-xs">{i + 1}</td>
                      <td className="table-cell">
                        <Link href={`/students/${s.id}`} className="font-semibold text-slate-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400">
                          {s.firstName} {s.lastName}
                        </Link>
                        {s.parentName && (
                          <span className="text-xs text-slate-400 font-normal"> ({s.parentName})</span>
                        )}
                        {mujor && (
                          <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300" title="Plani i pagesës: Mujor (dy këste për periudhë)">
                            Mujor
                          </span>
                        )}
                        {(() => {
                          const sh = shujtaForPeriod(shujtat.get(s.id), currentPeriodIdx);
                          return sh !== "TE_DYJA" && (
                            <span className="ml-1.5 inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300" title={`${SHUJTA_LABEL[sh]} (periudha aktuale)`}>
                              {sh === "MENGJES" ? "Mëngjes" : "Drekë"}
                            </span>
                          );
                        })()}
                        {tags.has(s.id) && (
                          <span className="ml-1.5 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300" title="Përdor ditët e kolonës 'Zbritje e paparashikueshme'">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden />{tags.get(s.id)}
                          </span>
                        )}
                      </td>
                      <td className="table-cell">
                        {s.class
                          ? <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded text-xs font-medium">{s.class.name}</span>
                          : <span className="text-slate-300">—</span>}
                      </td>
                      <td className="table-cell font-semibold">
                        {totalPlan > 0 ? formatCurrency(totalPlan) : <span className="text-slate-300">—</span>}
                      </td>
                      {rowPeriods.map(({ period, payment }, pi) => {
                        const keste = rowKeste[pi];
                        const kestVonuar = keste?.find(k => k.statusi === "ME_VONESE");
                        const kestRradhes = keste?.find(k => k.statusi !== "PAGUAR");
                        const skipped = payment?.description === SKIPPED_MARKER;
                        const free    = payment?.description === FREE_MARKER;
                        // E paguar pjesërisht: tregohet edhe sa mbetet (me të kuqe) — "Bankë" vetëm e fshihte borxhin
                        const mbetet  = payment && !skipped && !free && payment.paidAmount > 0 ? Math.max(0, Math.round((payment.finalAmount - payment.paidAmount) * 100) / 100) : 0;
                        return (
                          <td key={period.label} className="table-cell text-center p-0">
                            <button
                              type="button"
                              onClick={() => setPayModal({ student: s, month: period.canonicalMonth, existingPayment: payment })}
                              title={payment?.note || undefined}
                              className={`w-full h-full px-2 py-2.5 text-xs font-medium transition-colors ${
                                skipped
                                  ? "bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 italic hover:bg-slate-200"
                                  : free
                                  ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 hover:bg-blue-100"
                                  : payment?.method === "BANK"
                                  ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 hover:bg-amber-100"
                                  : payment?.method === "KOMPENSIM"
                                  ? "bg-teal-50 dark:bg-teal-900/20 text-teal-700 dark:text-teal-400 hover:bg-teal-100"
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
                                : payment?.method === "KOMPENSIM"
                                ? "Kompensim"
                                : payment
                                ? formatCurrency(payment.finalAmount)
                                : "—"}
                              {mbetet > 0.005 && <span className="block text-[11px] font-bold text-red-600 dark:text-red-400">mbetet {formatCurrency(mbetet)}</span>}
                              {keste && (
                                <span className={`block text-[10px] font-semibold ${kestVonuar ? "text-red-600 dark:text-red-400" : "text-violet-600 dark:text-violet-300"}`}>
                                  {kestVonuar
                                    ? `${MONTHS[kestVonuar.muaji - 1]}: me vonesë`
                                    : kestRradhes ? `Mujor · ${MONTHS[kestRradhes.muaji - 1]} ${formatCurrency(kestRradhes.shuma - kestRradhes.paguar)}` : "Mujor · paguar"}
                                </span>
                              )}
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
                            onClick={() => nderroPlaninNgaRreshti(s)}
                            title={`Plani i pagesës: ${mujor ? "Mujor" : "Dymujor"} — kliko për ta ndryshuar (vlen për periudhat që s'kanë filluar)`}
                            className={`p-1.5 rounded-lg transition-colors ${mujor ? "text-violet-500 hover:text-violet-700 hover:bg-violet-50 dark:hover:bg-violet-900/20" : "text-slate-300 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 dark:text-slate-500"}`}
                          >
                            <CalendarDays className="w-4 h-4" />
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
                          <button
                            onClick={() => generateNotificationsFor([s])}
                            title="Gjenero njoftim"
                            className="p-1.5 rounded-lg text-slate-300 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:text-slate-500 dark:hover:text-blue-400 transition-colors"
                          >
                            <Send className="w-4 h-4" />
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
                          {hasAnyPayment && (
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
          prices={calcPrices(priceRateForClass(payModal.student.class?.name), workingDays, monthsPerYear)}
          workingDays={workingDays}
          periods={periodsFor(payModal.student)}
          tagLabel={tags.get(payModal.student.id)}
          periodCalYear={periodCalYear}
          overrideAmount={calcAmount}
          planFor={i => planForPeriod(planet.get(payModal.student.id), i)}
          onPlanChange={(plan, i) => ruajPlanin(payModal.student.id, plan, i)}
          cmimet={cmimetPerKlase(payModal.student.class?.name)}
          shujtaFor={i => shujtaForPeriod(shujtat.get(payModal.student.id), i)}
          onShujtaChange={(sh, i) => ruajShujtat(payModal.student.id, sh, i)}
          onClose={() => { setPayModal(null); setCalcAmount(undefined); }}
          onSave={async (result) => {
            setPayModal(null); setCalcAmount(undefined); await fetchYearData();
            setReceiptShtese(result?.shtese);
            if (result?.paymentId) setReceiptPaymentId(result.paymentId);
            if (result?.familyReceiptId) setFamilyReceiptPrintId(result.familyReceiptId);
          }}
        />
      )}
      {calcModal && (
        <UshqimiCalcModal
          student={calcModal}
          price2Meals={priceRateForClass(calcModal.class?.name)}
          periods={periodsFor(calcModal)}
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
      {rastetOpen && (
        <RastetKalendariModal
          rastet={rastetKal}
          onClose={() => setRastetOpen(false)}
          onApply={async sel => { await ndreqRastet(sel); setRastetOpen(false); }}
        />
      )}
      {receiptPaymentId && (
        <PaymentReceiptModal
          paymentId={receiptPaymentId}
          shtese={receiptShtese}
          onClose={() => { setReceiptPaymentId(null); setReceiptShtese(undefined); }}
        />
      )}
      {statFilter && (
        <StatListModal
          filter={statFilter}
          students={yearStudents}
          onClose={() => setStatFilter(null)}
          mujorVoneseFor={mujorVoneseFor}
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
      {notifyRecipients && (
        <NotificationPreviewModal
          recipients={notifyRecipients}
          onClose={() => setNotifyRecipients(null)}
          onSent={clearSelection}
        />
      )}
      {familyModalOpen && categoryId && (
        <FamilyPaymentModal
          categoryId={categoryId}
          categoryName="Ushqimi"
          isMonthly={true}
          defaultMonth={PERIOD_BUCKETS.find(p => p.months.includes(now.getMonth() + 1))?.canonicalMonth ?? PERIOD_BUCKETS[0].canonicalMonth}
          schoolYearStart={effectiveYear}
          periodOptions={PERIOD_BUCKETS.map(p => ({ label: p.label, canonicalMonth: p.canonicalMonth }))}
          computeDefaultAmount={(_discountPct, month, className) => {
            const idx = PERIOD_BUCKETS.findIndex(p => p.canonicalMonth === month);
            const days = idx >= 0 ? (periods[idx]?.days ?? workingDays) : workingDays;
            return Math.round(days * priceRateForClass(className) * 100) / 100;
          }}
          onClose={() => setFamilyModalOpen(false)}
          onSaved={(id) => { setFamilyModalOpen(false); setFamilyReceiptPrintId(id); fetchYearData(); }}
        />
      )}
      {familyReceiptPrintId && (
        <FamilyReceiptPrintModal
          familyReceiptId={familyReceiptPrintId}
          onClose={() => setFamilyReceiptPrintId(null)}
        />
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════ */
/*  Payment Modal — specialized for meals                 */
/* ═══════════════════════════════════════════════════════ */
// Gjendja e një periudhe për skedat dhe kartën (vetëm lexim/llogaritje).
type PeriodStatusKey = "PAGUAR" | "PJESERISHT" | "PA_PAGUAR" | "ME_VONESE" | "NDERPRERE" | "FALAS";
const PERIOD_STATUS_UI: Record<PeriodStatusKey, { label: string; cls: string }> = {
  PAGUAR:     { label: "Paguar",     cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  PJESERISHT: { label: "Pjesërisht", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  PA_PAGUAR:  { label: "Pa paguar",  cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300" },
  ME_VONESE:  { label: "Me vonesë",  cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  NDERPRERE:  { label: "Ndërprerë",  cls: "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
  FALAS:      { label: "Falas",      cls: "bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300" },
};

function periodStatus(p: Payment | null, finalAmount: number, keste: Kest[] | null, defaultDue: Date): { key: PeriodStatusKey; afati: Date | null } {
  if (p?.description === SKIPPED_MARKER) return { key: "NDERPRERE", afati: null };
  if (p?.description === FREE_MARKER) return { key: "FALAS", afati: null };
  const paid = p?.paidAmount ?? 0;
  if (p && finalAmount > 0 && paid >= finalAmount - 0.005) return { key: "PAGUAR", afati: null };
  if (keste) {
    const vonuar = keste.find(k => k.statusi === "ME_VONESE");
    if (vonuar) return { key: "ME_VONESE", afati: vonuar.afati };
    return { key: paid > 0.005 ? "PJESERISHT" : "PA_PAGUAR", afati: afatiAktual(keste) };
  }
  const due = p ? new Date(p.dueDate) : defaultDue;
  // I njëjti rregull si tabela: "me vonesë" kur afati ka kaluar dhe s'është paguar asgjë
  if (due < new Date() && paid === 0) return { key: "ME_VONESE", afati: due };
  return { key: paid > 0.005 ? "PJESERISHT" : "PA_PAGUAR", afati: due };
}

const fmtDMY = (d: Date) => `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}`;
const parseDMY = (s: string): string | null => {
  const m = s.trim().match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/);
  if (!m) return null;
  const d = new Date(parseInt(m[3]), parseInt(m[2]) - 1, parseInt(m[1]));
  if (d.getDate() !== parseInt(m[1]) || d.getMonth() !== parseInt(m[2]) - 1) return null;
  return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
};
const ymdLocal = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

const METODAT: { value: string; label: string; title?: string }[] = [
  { value: "CASH", label: "💶 Cash" },
  { value: "BANK", label: "🏦 Bankë" },
  { value: "CARD", label: "💳 Kartelë" },
  { value: "ONLINE", label: "🌐 Online" },
  { value: "KOMPENSIM", label: "🤝 Kompensim", title: "E paguar me kompensim — nxënësi s'ka borxh, por paratë s'hyjnë as në arkë, as në bankë." },
];

/* Dritarja "Pagesa e ushqimit": skedat e 5 periudhave + paneli i periudhës aktive.
   Paneli rihapet (key) për çdo skedë, që gjendja e formularit të nisë nga e para. */
function UshqimiPayModal({ student, existingPayment, month, prices, workingDays, periods, periodCalYear, onClose, onSave, overrideAmount, tagLabel, planFor, onPlanChange, cmimet, shujtaFor, onShujtaChange }: {
  student: StudentRow; existingPayment: Payment | null; month: number; year: number;
  tagLabel?: string;
  prices: Record<string, number>; workingDays: number; periods: Period[];
  periodCalYear: (canonicalMonth: number) => number;
  overrideAmount?: number;
  // Plani (Dymujor/Mujor) i periudhës `i`; ndryshimi vlen nga ajo periudhë e tutje.
  planFor: (periodIdx: number) => UshqimiPlan;
  onPlanChange: (plan: UshqimiPlan, periodIdx: number) => Promise<boolean>;
  // Çmimi/ditë për secilën zgjedhje shujtash (sipas klasës) dhe zgjedhja e periudhës `i`
  cmimet: Record<Shujta, number>;
  shujtaFor: (periodIdx: number) => Shujta;
  onShujtaChange: (shujta: Shujta, periodIdx: number) => Promise<boolean>;
  onClose: () => void; onSave: (result?: { paymentId?: number; familyReceiptId?: number; shtese?: string[] }) => void;
}) {
  const [activeMonth, setActiveMonth] = useState(month);
  const [shujtaOverride, setShujtaOverride] = useState<Map<number, Shujta>>(new Map());
  const shujtaAt = (i: number): Shujta => {
    let best = -1; let v: Shujta | null = null;
    shujtaOverride.forEach((s, k) => { if (k <= i && k > best) { best = k; v = s; } });
    return v ?? shujtaFor(i);
  };
  // Plani i ndryshuar këtu (pa pritur rifreskimin e faqes)
  const [planOverride, setPlanOverride] = useState<Map<number, UshqimiPlan>>(new Map());
  const planAt = (i: number): UshqimiPlan => {
    let best = -1; let v: UshqimiPlan | null = null;
    planOverride.forEach((pl, k) => { if (k <= i && k > best) { best = k; v = pl; } });
    return v ?? planFor(i);
  };

  const summaries = PERIOD_BUCKETS.map((period, i) => {
    const p = month === period.canonicalMonth && existingPayment ? existingPayment : findPeriodPayment(student.installments, period.months);
    const calYear = periodCalYear(period.canonicalMonth);
    const days = periods[i]?.days ?? workingDays;
    const amount = p ? p.finalAmount : Math.round(days * cmimet[shujtaAt(i)] * 100) / 100;
    const m = (p?.description || "").match(/^(\d+)\s*ditë/);
    const pDays = m ? parseInt(m[1]) : (cmimet[shujtaAt(i)] > 0 ? Math.round(amount / cmimet[shujtaAt(i)]) : days);
    const keste = p && p.description !== SKIPPED_MARKER && p.description !== FREE_MARKER && planAt(i) === "MUJOR"
      ? kesteMujore({ months: period.months as [number, number], calYear, split: splitOf(periods[i], "days"), days: pDays, finalAmount: p.finalAmount, paidAmount: p.paidAmount })
      : null;
    return { period, p, amount, status: periodStatus(p, amount, keste, new Date(calYear, period.canonicalMonth - 1, 5)) };
  });
  const activeIdx = Math.max(0, PERIOD_BUCKETS.findIndex(p => p.canonicalMonth === activeMonth));
  const active = summaries[activeIdx];

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-[460px] animate-fade-in overflow-y-auto max-h-[94vh]" onClick={e => e.stopPropagation()}>
        <UshqimiPayPanel
          key={activeMonth}
          student={student}
          existingPayment={active.p}
          month={activeMonth}
          year={periodCalYear(activeMonth)}
          prices={prices} workingDays={workingDays} periods={periods} periodCalYear={periodCalYear}
          overrideAmount={activeMonth === month ? overrideAmount : undefined}
          tagLabel={tagLabel}
          planFillestar={planAt(activeIdx)}
          onPlanChange={async pl => { const ok = await onPlanChange(pl, activeIdx); if (ok) setPlanOverride(prev => new Map(prev).set(activeIdx, pl)); return ok; }}
          cmimet={cmimet}
          shujtaFillestare={shujtaAt(activeIdx)}
          cmimiPeriudhe={i => cmimet[shujtaAt(i)]}
          shujtaPeriudhe={shujtaAt}
          onShujtaChange={async sh => { const ok = await onShujtaChange(sh, activeIdx); if (ok) setShujtaOverride(prev => new Map(prev).set(activeIdx, sh)); return ok; }}
          onClose={onClose} onSave={onSave}
          tabs={
            <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1" role="tablist">
              {summaries.map(({ period, amount, status }) => {
                const on = period.canonicalMonth === activeMonth;
                const short = period.label.split("/").map(x => x.slice(0, 3)).join("/");
                return (
                  <button key={period.label} type="button" role="tab" aria-selected={on}
                    onClick={() => setActiveMonth(period.canonicalMonth)}
                    className={`relative shrink-0 min-w-[74px] px-2 py-1.5 rounded-lg border text-center transition-colors ${on
                      ? "border-violet-500 bg-violet-50 dark:bg-violet-900/30 text-violet-700 dark:text-violet-200"
                      : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-violet-300"}`}>
                    <span className="block text-xs font-semibold">{short}</span>
                    <span className="block text-[11px]">
                      {status.key === "NDERPRERE" ? "Ndërprerë" : status.key === "FALAS" ? "Falas" : formatCurrency(amount)}
                    </span>
                    {status.key === "PAGUAR" && <span className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-emerald-500 text-white text-[10px] leading-4" aria-label="Paguar">✓</span>}
                    {status.key === "ME_VONESE" && <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-red-500" aria-label="Me vonesë" />}
                  </button>
                );
              })}
            </div>
          }
        />
      </div>
    </div>
  );
}

function UshqimiPayPanel({ student, existingPayment, month, year, workingDays, periods, periodCalYear, onClose, onSave, overrideAmount, tagLabel, planFillestar = "DYMUJOR", onPlanChange, tabs, cmimet, shujtaFillestare, cmimiPeriudhe, shujtaPeriudhe, onShujtaChange }: {
  student: StudentRow; existingPayment: Payment | null; month: number; year: number;
  tagLabel?: string;
  prices: Record<string, number>; workingDays: number; periods: Period[];
  periodCalYear: (canonicalMonth: number) => number;
  overrideAmount?: number;
  planFillestar?: UshqimiPlan;
  onPlanChange?: (plan: UshqimiPlan) => Promise<boolean>;
  onClose: () => void; onSave: (result?: { paymentId?: number; familyReceiptId?: number; shtese?: string[] }) => void;
  tabs: ReactNode;
  cmimet: Record<Shujta, number>;
  shujtaFillestare: Shujta;
  cmimiPeriudhe: (periodIdx: number) => number;
  shujtaPeriudhe: (periodIdx: number) => Shujta;
  onShujtaChange: (shujta: Shujta) => Promise<boolean>;
}) {
  const existing = existingPayment;
  const isCalc = overrideAmount != null;
  const periodIndex = PERIOD_BUCKETS.findIndex(p => p.canonicalMonth === month);
  const bucket = periodIndex >= 0 ? PERIOD_BUCKETS[periodIndex] : null;
  const periodDays = periodIndex >= 0 ? (periods[periodIndex]?.days ?? workingDays) : workingDays;

  // "Vetëm njëri muaj" (rast i rrallë) — tani brenda "Ndrysho"
  type SubPeriod = "full" | "first" | "second";
  const initialSubPeriod: SubPeriod =
    bucket && existing && existing.month === bucket.months[1] ? "second" : "full";
  const [subPeriod, setSubPeriod] = useState<SubPeriod>(initialSubPeriod);

  const ditetNgaPershkrimi = (existing?.description || "").match(/^(\d+)\s*ditë/);
  const [days, setDays] = useState(
    ditetNgaPershkrimi && existing && existing.finalAmount > 0 ? parseInt(ditetNgaPershkrimi[1])
    : existing && existing.finalAmount > 0 && cmimet[shujtaFillestare] > 0
      ? Math.max(1, Math.round(existing.finalAmount / cmimet[shujtaFillestare]))
      : periodDays
  );
  // Kalendari (Kalkulatori → Ditët e mësimit sipas muajit)
  const calSplit = periodIndex >= 0 ? splitOf(periods[periodIndex], "days") : null;
  function calendarDays(sp: SubPeriod) {
    if (sp === "full") return periodDays;
    if (calSplit) return sp === "first" ? calSplit[0] : calSplit[1];
    return Math.round(periodDays / 2);
  }
  function handleSubPeriodChange(sp: SubPeriod) {
    setSubPeriod(sp);
    setDays(calendarDays(sp));
  }
  // Periudhë "Ndërprerë"/"Falas" (shuma 0) → çmimi parazgjedhur, jo 0 € / ditë.
  const [pricePerDay, setPricePerDay] = useState(
    existing && existing.finalAmount > 0 && days > 0 ? Math.round((existing.finalAmount / days) * 100) / 100 : cmimet[shujtaFillestare]
  );
  // Shujtat (Mëngjes + Drekë / vetëm mëngjes / vetëm drekë) — ruhet menjëherë, vlen nga kjo periudhë e tutje.
  const [shujta, setShujta] = useState<Shujta>(shujtaFillestare);
  // Ndërrim në mes të periudhës: X ditë me një zgjedhje + Y ditë me tjetrën (kërkon shënim)
  const [perzier, setPerzier] = useState(false);
  const [perzA, setPerzA] = useState<{ dite: number; sh: Shujta }>({ dite: 0, sh: "TE_DYJA" });
  const [perzB, setPerzB] = useState<{ dite: number; sh: Shujta }>({ dite: 0, sh: "DREKE" });
  const [method, setMethod] = useState(existing?.method ?? "CASH");
  // Afati s'është më fushë: ruhet ai ekzistues (ose parazgjedhja e vjetër, dita 5 e muajit të parë)
  const dueDate = existing?.dueDate
    ? new Date(existing.dueDate).toISOString().split("T")[0]
    : new Date(year, month - 1, 5).toISOString().split("T")[0];
  const [paidDateTxt, setPaidDateTxt] = useState(fmtDMY(new Date()));
  const [note, setNote] = useState(existing?.note ?? "");
  const [noteOpen, setNoteOpen] = useState(!!existing?.note);
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [extraOpen, setExtraOpen] = useState(false);
  const [print, setPrint] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [shumaError, setShumaError] = useState("");

  const finalAmount = isCalc ? (overrideAmount ?? 0)
    : perzier ? Math.round((perzA.dite * cmimet[perzA.sh] + perzB.dite * cmimet[perzB.sh]) * 100) / 100
    : Math.round(days * pricePerDay * 100) / 100;
  const paidBefore = existing?.paidAmount ?? 0;
  const remaining = Math.max(0, Math.round((finalAmount - paidBefore) * 100) / 100);

  // Plani i pagesës (Dymujor/Mujor) — ruhet menjëherë kur ndryshohet
  const [plan, setPlan] = useState<UshqimiPlan>(planFillestar);
  const [planBusy, setPlanBusy] = useState(false);
  async function zgjidhPlanin(p: UshqimiPlan) {
    if (p === plan) return;
    if (onPlanChange) {
      setPlanBusy(true);
      const ok = await onPlanChange(p);
      setPlanBusy(false);
      if (!ok) return;
    }
    setPlan(p);
    if (p === "MUJOR" && subPeriod !== "full") { setSubPeriod("full"); setDays(calendarDays("full")); }
  }
  const mujorAktiv = plan === "MUJOR" && !isCalc && !!bucket && subPeriod === "full";
  async function zgjidhShujten(s: Shujta) {
    if (s === shujta) return;
    setPlanBusy(true);
    const ok = await onShujtaChange(s);
    setPlanBusy(false);
    if (!ok) return;
    setShujta(s);
    setPricePerDay(cmimet[s]);
    if (shumaChip === "full") { const rem = Math.max(0, Math.round((days * cmimet[s] - paidBefore) * 100) / 100); setShuma(rem > 0 ? String(rem) : ""); }
  }

  // PAGESA E RE: shuma që paguhet tani (parazgjedhje: sa mbetet) → paguar total = më parë + tani.
  // "Korrigjo totalin" (menyja ⋯) lejon të shkruhet direkt totali i paguar, si më parë.
  const [shuma, setShuma] = useState(remaining > 0 ? String(remaining) : "");
  const [shumaChip, setShumaChip] = useState<"full" | "m1" | "m2" | null>(remaining > 0 ? "full" : null);
  const [korrigjoTotalin, setKorrigjoTotalin] = useState(false);
  const [totalKorrigjim, setTotalKorrigjim] = useState(String(paidBefore));
  const shumaNum = Math.max(0, parseFloat(shuma.replace(",", ".") || "0") || 0);
  const paid = korrigjoTotalin
    ? Math.max(0, parseFloat(totalKorrigjim.replace(",", ".") || "0") || 0)
    : Math.round((paidBefore + shumaNum) * 100) / 100;

  const kesteArgs = bucket ? { months: bucket.months as [number, number], calYear: year, split: calSplit, days, finalAmount } : null;
  const kesteTani = mujorAktiv && kesteArgs ? kesteMujore({ ...kesteArgs, paidAmount: paidBefore }) : null;
  const kesteMePagesen = mujorAktiv && kesteArgs ? kesteMujore({ ...kesteArgs, paidAmount: paid }) : null;
  const kestiRradhes = kesteTani?.find(k => k.statusi !== "PAGUAR");

  const effectiveMonth = !bucket || subPeriod === "full" ? month
    : subPeriod === "first" ? bucket.months[0] : bucket.months[1];
  const periodLabel = subPeriod === "full"
    ? (bucket?.label ?? MONTHS[month - 1])
    : MONTHS[effectiveMonth - 1];
  const shLbl = (s: Shujta) => s === "TE_DYJA" ? "mëngjes+drekë" : s === "MENGJES" ? "vetëm mëngjes" : "vetëm drekë";
  const description = isCalc
    ? `${periodLabel} ${year}`
    : perzier
      ? `${perzA.dite + perzB.dite} ditë (${perzA.dite} × ${formatCurrency(cmimet[perzA.sh])} ${shLbl(perzA.sh)} + ${perzB.dite} × ${formatCurrency(cmimet[perzB.sh])} ${shLbl(perzB.sh)}) — ${periodLabel} ${year}`
      : `${days} ditë × ${formatCurrency(pricePerDay)} — ${periodLabel} ${year}${shujtaSuffix(shujta)}`;

  // Ditët ndryshe nga kalendari, ose ndërrim shujtash në mes të periudhës = rast i veçantë → arsyeja e detyrueshme.
  const daysManual = !isCalc && (perzier || days !== calendarDays(subPeriod));
  useEffect(() => { if (perzier) setDays(perzA.dite + perzB.dite); }, [perzier, perzA.dite, perzB.dite]);
  useEffect(() => { if (daysManual) setNoteOpen(true); }, [daysManual]);

  const isSkipped = existing?.description === SKIPPED_MARKER;
  const isFree    = existing?.description === FREE_MARKER;
  const status = periodStatus(existing, finalAmount, kesteTani, new Date(dueDate));
  const fullyPaid = !!existing && finalAmount > 0 && paidBefore >= finalAmount - 0.005;

  // Butonat e muajve: ditët e muajit (kalendari) × çmimi
  const monthDays: [number, number] = calSplit ?? [Math.ceil(days / 2), Math.floor(days / 2)];
  const monthAmt = (k: 0 | 1) => perzier
    ? Math.round((k === 0 ? perzA.dite * cmimet[perzA.sh] : perzB.dite * cmimet[perzB.sh]) * 100) / 100
    : Math.round(monthDays[k] * pricePerDay * 100) / 100;
  // "E plotë" e zgjedhur → shuma ndjek gjithmonë sa mbetet (kur ndryshojnë ditët, çmimi ose shujtat)
  useEffect(() => { if (shumaChip === "full") setShuma(remaining > 0 ? String(remaining) : ""); }, [remaining, shumaChip]);

  async function handleSave(withPrint: boolean, paidTotal: number) {
    if (daysManual && !note.trim()) {
      setNoteOpen(true);
      setSaveError(perzier ? 'Ndërrimi i shujtave në mes të periudhës kërkon arsyen te "Shënim".' : `Ditët (${days}) ndryshojnë nga kalendari (${calendarDays(subPeriod)}). Shkruaj arsyen te "Shënim".`);
      return;
    }
    const paidDate = parseDMY(paidDateTxt);
    if (paidTotal > 0 && !paidDate) { setSaveError("Data e pagesës s'është e saktë (dd.mm.yyyy)."); return; }
    setSaving(true);
    setSaveError("");
    const kesteRuajtje = mujorAktiv && kesteArgs ? kesteMujore({ ...kesteArgs, paidAmount: paidTotal }) : null;
    // Për Mujor: afati i periudhës = afati i këstit të parë të papaguar → vonesa sipas këstit
    const payload = {
      studentId: student.id,
      categoryId: 2,
      amount: finalAmount,
      discount: 0, discountType: null, scholarship: 0,
      finalAmount,
      paidAmount: paidTotal,
      method,
      dueDate: kesteRuajtje ? ymdLocal(afatiAktual(kesteRuajtje)) : dueDate,
      paidDate: paidTotal > 0 ? (paidTotal > paidBefore + 0.005 || !existing?.paidDate ? paidDate : new Date(existing.paidDate).toISOString().split("T")[0]) : null,
      month: effectiveMonth, year,
      description,
      note: note || null,
    };

    try {
      const catRes = await fetch("/api/categories");
      const cats = await catRes.json();
      const cat = cats.find((c: { name: string; id: number }) => c.name === "Ushqimi");
      if (cat) payload.categoryId = cat.id;

      let receiptPaymentId: number | undefined;
      let ok: boolean;
      if (existing) {
        const r = await fetch(`/api/payments/${existing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        ok = r.ok;
        if (r.ok && paidTotal > 0) receiptPaymentId = existing.id;
        if (!r.ok) { const d = await r.json().catch(() => ({})); setSaveError(d.error || `Ruajtja dështoi (gabim ${r.status})`); }
      } else {
        const r = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        ok = r.ok;
        if (r.ok && paidTotal > 0) receiptPaymentId = (await r.json()).id;
        if (!r.ok) { const d = await r.json().catch(() => ({})); setSaveError(d.error || `Ruajtja dështoi (gabim ${r.status})`); }
      }
      setSaving(false);
      if (!ok) return;
      // Kuponi i nxënësit mujor: cilin këst mbuloi kjo pagesë dhe sa mbetet nga periudha
      const shtese = kesteRuajtje && paidTotal > paidBefore + 0.005
        ? [
            ...kesteTeMbuluara(kesteRuajtje, paidBefore, paidTotal).map(k =>
              `Pagesë për: ${MONTHS[k.muaji - 1]} ${k.vit} — ${formatCurrency(k.shuma)}${k.plotesisht ? "" : " (pjesërisht)"}`),
            `Mbetet nga periudha ${bucket?.label ?? ""} ${year}: ${formatCurrency(Math.max(0, finalAmount - paidTotal))}`,
          ]
        : undefined;
      onSave(withPrint && receiptPaymentId ? { paymentId: receiptPaymentId, shtese } : undefined);
    } catch {
      setSaving(false);
      setSaveError("Gabim rrjeti — provo përsëri.");
    }
  }

  async function markAs(marker: string) {
    const emri = marker === SKIPPED_MARKER ? "Ndërprerë" : "Falas";
    if (!confirm(`Shëno ${bucket?.label ?? ""} ${year} si "${emri}" për ${student.firstName} ${student.lastName}? Periudha s'ngarkohet më (0 €). Mund të rikthehet më vonë.`)) return;
    setSaving(true);
    setSaveError("");
    const payload: Record<string, unknown> = {
      studentId: student.id, categoryId: 2,
      amount: 0, discount: 0, discountType: null, scholarship: 0,
      finalAmount: 0, paidAmount: 0,
      method, dueDate, paidDate: null,
      month, year,
      description: marker,
    };
    try {
      if (!existing) {
        const catRes = await fetch("/api/categories");
        const cats = await catRes.json();
        const cat = cats.find((c: { name: string; id: number }) => c.name === "Ushqimi");
        if (cat) payload.categoryId = cat.id;
      }
      const r = existing
        ? await fetch(`/api/payments/${existing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      setSaving(false);
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setSaveError(d.error || `Veprimi dështoi (gabim ${r.status})`);
        return;
      }
    } catch {
      setSaving(false);
      setSaveError("Gabim rrjeti — provo përsëri.");
      return;
    }
    onSave(undefined);
  }

  // Rifillo pas ndërprerjes: periudha kthehet normale me ditët dhe çmimin
  // parazgjedhur (pa pagesë ende) — vetëm kjo periudhë; të tjerat s'preken.
  async function rifillo() {
    if (!existing) return;
    const d = periodDays;
    const cmimi = cmimet[shujta];
    const shumaR = Math.round(d * cmimi * 100) / 100;
    const label = bucket?.label ?? MONTHS[month - 1];
    if (!confirm(`Rifillo ushqimin për ${student.firstName} ${student.lastName} — ${label} ${year}: ${d} ditë × ${formatCurrency(cmimi)} = ${formatCurrency(shumaR)} (pa pagesë ende). Vazhdo?`)) return;
    setSaving(true);
    setSaveError("");
    try {
      const cats = await fetch("/api/categories").then(x => x.json()).catch(() => []);
      const catId = (cats as { name: string; id: number }[]).find(c => c.name === "Ushqimi")?.id ?? 2;
      const r = await fetch(`/api/payments/${existing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          studentId: student.id, categoryId: catId,
          amount: shumaR, discount: 0, discountType: null, scholarship: 0,
          finalAmount: shumaR, paidAmount: 0,
          method, dueDate, paidDate: null,
          month, year,
          description: `${d} ditë × ${formatCurrency(cmimi)} — ${label} ${year}${shujtaSuffix(shujta)}`,
          note: note || null,
        }),
      });
      setSaving(false);
      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        setSaveError(e.error || `Rifillimi dështoi (gabim ${r.status})`);
        return;
      }
    } catch {
      setSaving(false);
      setSaveError("Gabim rrjeti — provo përsëri.");
      return;
    }
    onSave(undefined);
  }

  // "Paguaj edhe periudha të tjera" — e njëjta logjikë si "Paguaj disa periudha njëherësh":
  // periudhat e zgjedhura mbyllen plotësisht; Ndërprerë/Falas dhe të paguarat s'preken.
  function computeYearPlan() {
    const items = PERIOD_BUCKETS.map((period, i) => {
      const ex = findPeriodPayment(student.installments, period.months);
      const calYear = periodCalYear(period.canonicalMonth);
      if (ex && (ex.description === SKIPPED_MARKER || ex.description === FREE_MARKER)) {
        return { period, index: i, existing: ex, finalAmount: 0, remaining: 0, calYear };
      }
      const d = periods[i]?.days ?? workingDays;
      const fa = ex ? ex.finalAmount : Math.round(d * cmimiPeriudhe(i) * 100) / 100;
      const rem = ex ? Math.max(0, ex.finalAmount - ex.paidAmount) : fa;
      return { period, index: i, existing: ex, finalAmount: fa, remaining: rem, calYear };
    });
    return { items, total: items.reduce((sum, it) => sum + it.remaining, 0) };
  }
  const yearPlan = computeYearPlan();
  const [selectedExtra, setSelectedExtra] = useState<Set<number>>(new Set());
  const extraItems = yearPlan.items.filter(it => it.index !== periodIndex && selectedExtra.has(it.index) && it.remaining > 0);
  const extraTotal = Math.round(extraItems.reduce((s, it) => s + it.remaining, 0) * 100) / 100;
  function toggleExtra(i: number) {
    setSelectedExtra(prev => { const n = new Set(prev); if (n.has(i)) n.delete(i); else n.add(i); return n; });
  }

  async function payItems(items: typeof yearPlan.items, withPrint: boolean) {
    const allSelected = items.length === PERIOD_BUCKETS.length;
    const total = items.reduce((s, it) => s + it.remaining, 0);
    const label = allSelected ? "krejt vitin" : `${items.length} periudha`;
    if (!confirm(`Do të shënohen si paguar plotësisht ${label} për ${student.firstName} ${student.lastName} — gjithsej ${formatCurrency(total)}. Vazhdo?`)) return;
    const paidDate = parseDMY(paidDateTxt);
    if (!paidDate) { setSaveError("Data e pagesës s'është e saktë (dd.mm.yyyy)."); return; }

    setSaving(true);
    setSaveError("");
    const cats = await fetch("/api/categories").then(r => r.json());
    const catId = cats.find((c: { name: string; id: number }) => c.name === "Ushqimi")?.id ?? 2;
    const toPay = items.filter(it => it.remaining > 0);
    const desc = (it: (typeof items)[number]) => it.existing?.description ?? `${periods[it.index]?.days ?? workingDays} ditë × ${formatCurrency(cmimiPeriudhe(it.index))} — ${it.period.label} ${it.calYear}${shujtaSuffix(shujtaPeriudhe(it.index))}`;
    const due = (it: (typeof items)[number]) => it.existing?.dueDate
      ? new Date(it.existing.dueDate).toISOString().split("T")[0]
      : new Date(it.calYear, it.period.canonicalMonth - 1, 5).toISOString().split("T")[0];

    // 2+ periudha → një "Dëshmi Pagese" e përbashkët (FamilyReceipt), si më parë
    if (toPay.length >= 2) {
      const res = await fetch("/api/family-receipts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          parentName: `${student.firstName} ${student.lastName}${student.class ? ` (${student.class.name})` : ""}`,
          parentPhone: student.parentPhone || null,
          method,
          children: toPay.map(it => ({
            studentId: student.id, categoryId: catId,
            amount: it.finalAmount, discount: 0, discountType: null, scholarship: 0,
            paidAmount: it.finalAmount, method, dueDate: due(it), paidDate,
            month: it.period.canonicalMonth, year: it.calYear,
            description: desc(it), note: note || it.existing?.note || null,
          })),
        }),
      });
      setSaving(false);
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        setSaveError(d.error || `Pagesa dështoi (gabim ${res.status})`);
        return;
      }
      const { id } = await res.json();
      onSave(withPrint ? { familyReceiptId: id } : undefined);
      return;
    }

    let receiptPaymentId: number | undefined;
    let failed = false;
    for (const it of toPay) {
      const payload = {
        studentId: student.id, categoryId: catId,
        amount: it.finalAmount, discount: 0, discountType: null, scholarship: 0,
        finalAmount: it.finalAmount, paidAmount: it.finalAmount,
        method, dueDate: due(it), paidDate,
        month: it.period.canonicalMonth, year: it.calYear,
        description: desc(it), note: note || it.existing?.note || null,
      };
      if (it.existing) {
        const r = await fetch(`/api/payments/${it.existing.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (r.ok) receiptPaymentId = it.existing.id; else failed = true;
      } else {
        const r = await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        if (r.ok) receiptPaymentId = (await r.json()).id; else failed = true;
      }
    }
    setSaving(false);
    if (failed) {
      setSaveError("Disa nga periudhat nuk u ruajtën (gabim serveri) — kontrollo dhe provo përsëri.");
      return;
    }
    onSave(withPrint && receiptPaymentId ? { paymentId: receiptPaymentId } : undefined);
  }

  // Butoni i vetëm kryesor
  const totalButon = Math.round(((korrigjoTotalin ? 0 : shumaNum) + extraTotal) * 100) / 100;
  async function ruaj() {
    setShumaError("");
    if (korrigjoTotalin) { await handleSave(print, paid); return; }
    if (extraItems.length) {
      const current = yearPlan.items[periodIndex];
      const obligimNdryshoi = !!existing && Math.abs(existing.finalAmount - finalAmount) > 0.005;
      if (shumaNum > 0.005) {
        if (Math.abs(shumaNum - remaining) > 0.005) { setShumaError(`Kur paguhen disa periudha njëherësh, kjo periudhë paguhet e plotë (${formatCurrency(remaining)}) ose lëre 0.`); return; }
        if (obligimNdryshoi || !existing && Math.abs(current.finalAmount - finalAmount) > 0.005) { setShumaError("Ruaj së pari ndryshimin e ditëve/çmimit (Ndrysho → Ruaj ndryshimet)."); return; }
        await payItems([current, ...extraItems], print);
      } else {
        await payItems(extraItems, print);
      }
      return;
    }
    if (shumaNum <= 0.005) { setShumaError("Shkruaj shumën"); return; }
    await handleSave(print, paid);
  }

  const initials = `${student.firstName.trim()[0] ?? ""}${student.lastName.trim()[0] ?? ""}`.toUpperCase();
  const st = PERIOD_STATUS_UI[status.key];
  const mbetet = Math.max(0, finalAmount - paidBefore);

  return (
    <>
      {/* 1. KOKA */}
      <div className="flex items-start gap-3 px-5 pt-5 pb-3">
        <div className="w-10 h-10 shrink-0 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-200 flex items-center justify-center text-sm font-bold">{initials}</div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-slate-900 dark:text-white truncate">{student.firstName} {student.lastName}</h3>
          <p className="text-xs text-slate-400">{student.class ? `Klasa ${student.class.name} · ` : ""}Pagesa e ushqimit</p>
          {tagLabel && (
            <p className="mt-1 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden />{tagLabel}
            </p>
          )}
        </div>
        <div className="relative">
          <button type="button" onClick={() => setMenuOpen(v => !v)} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700" aria-label="Më shumë">⋯</button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-10 w-56 rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 shadow-lg py-1 text-sm" onMouseLeave={() => setMenuOpen(false)}>
              <button type="button" disabled={saving} onClick={() => { setMenuOpen(false); markAs(SKIPPED_MARKER); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700">
                {isSkipped ? "Ndërprerë (rifresko)" : "Shëno si Ndërprerë"}
              </button>
              <button type="button" disabled={saving} onClick={() => { setMenuOpen(false); markAs(FREE_MARKER); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-sky-700 dark:text-sky-300">
                {isFree ? "Falas (rifresko)" : "Shëno si Falas"}
              </button>
              {existing && !isSkipped && !isFree && (
                <button type="button" onClick={() => { setMenuOpen(false); setKorrigjoTotalin(true); setTotalKorrigjim(String(paidBefore)); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-700 text-slate-500">
                  Korrigjo totalin e paguar
                </button>
              )}
            </div>
          )}
        </div>
        <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600" aria-label="Mbyll"><X className="w-5 h-5" /></button>
      </div>

      <div className="px-5 pb-4 space-y-4">
        {/* 2. SKEDAT E PERIUDHAVE */}
        {tabs}

        {/* 3. KARTA E GJENDJES SË PERIUDHËS */}
        <div className="rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-700 p-4 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="font-bold text-slate-800 dark:text-slate-100">{periodLabel} {year}</p>
            <span className={`px-2 py-0.5 rounded-full text-[11px] font-semibold ${st.cls}`}>
              {st.label}{status.afati && status.key !== "PAGUAR" ? ` · afati ${fmtDMY(status.afati).slice(0, 5)}` : ""}
            </span>
          </div>

          {isCalc ? (
            <div className="flex items-center justify-between p-2.5 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
              <span className="flex items-center gap-2 text-amber-700 dark:text-amber-400 text-sm font-medium"><Calculator className="w-4 h-4" /> Shumë nga Kalkulatori</span>
              <span className="font-black text-amber-600">{formatCurrency(overrideAmount ?? 0)}</span>
            </div>
          ) : null}

          <div className="grid grid-cols-3 gap-2">
            <div><p className="text-[11px] text-slate-400">Detyrimi</p><p className="text-lg font-bold text-slate-900 dark:text-white">{formatCurrency(finalAmount)}</p></div>
            <div><p className="text-[11px] text-slate-400">Paguar</p><p className="text-lg font-bold text-emerald-600">{formatCurrency(paidBefore)}</p></div>
            <div><p className="text-[11px] text-slate-400">Mbetet</p><p className={`text-lg font-bold ${mbetet > 0.005 ? "text-red-600" : "text-slate-400"}`}>{formatCurrency(mbetet)}</p></div>
          </div>

          {!isCalc && (
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span>
                {perzier
                  ? <>📅 {perzA.dite} × {formatCurrency(cmimet[perzA.sh])} ({shLbl(perzA.sh)}) + {perzB.dite} × {formatCurrency(cmimet[perzB.sh])} ({shLbl(perzB.sh)})</>
                  : <>📅 {days} ditë{subPeriod === "full" && calSplit ? ` (${calSplit[0]} + ${calSplit[1]})` : subPeriod !== "full" ? ` (vetëm ${MONTHS[effectiveMonth - 1]})` : ""} × {formatCurrency(pricePerDay)}{shujta !== "TE_DYJA" ? ` · ${shLbl(shujta)}` : ""}</>}
                {daysManual ? <span className="text-amber-600"> · ndryshuar me dorë</span> : null}
              </span>
              <button type="button" onClick={() => setEditOpen(v => !v)} className="text-violet-600 dark:text-violet-300 font-medium hover:underline">✎ {editOpen ? "Mbyll" : "Ndrysho"}</button>
            </div>
          )}

          {editOpen && !isCalc && (
            <div className="space-y-2 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 p-3">
              {bucket && (
                <label className="block">
                  <span className="text-[11px] text-slate-500">Periudha</span>
                  <select value={subPeriod} onChange={e => handleSubPeriodChange(e.target.value as SubPeriod)} className="form-input rounded-lg py-1.5 text-sm">
                    <option value="full">{bucket.label} (të dy muajt)</option>
                    <option value="first" disabled={plan === "MUJOR"}>Vetëm {MONTHS[bucket.months[0] - 1]}</option>
                    <option value="second" disabled={plan === "MUJOR"}>Vetëm {MONTHS[bucket.months[1] - 1]}</option>
                  </select>
                </label>
              )}
              <div className="grid grid-cols-2 gap-2">
                <label className="block">
                  <span className="text-[11px] text-slate-500">Ditët</span>
                  <input type="number" value={days} min="0" readOnly={perzier} onChange={e => setDays(parseInt(e.target.value) || 0)}
                    className={`form-input rounded-lg py-1.5 text-sm ${daysManual ? "border-amber-400" : ""}`} />
                </label>
                <label className="block">
                  <span className="text-[11px] text-slate-500">Çmimi / ditë (€)</span>
                  <input type="number" value={pricePerDay} min="0" step="0.01" onChange={e => setPricePerDay(parseFloat(e.target.value) || 0)}
                    className="form-input rounded-lg py-1.5 text-sm" />
                </label>
              </div>
              {daysManual ? (
                <p className="text-[11px] text-amber-700 dark:text-amber-400">
                  Kalendari: {calendarDays(subPeriod)} ditë — shënimi është i detyrueshëm.
                  <button type="button" onClick={() => setDays(calendarDays(subPeriod))} className="ml-1 underline">Kthe {calendarDays(subPeriod)}</button>
                </p>
              ) : calSplit && <p className="text-[11px] text-indigo-600 dark:text-indigo-300">Nga kalendari: {calSplit[0]} + {calSplit[1]} ditë</p>}
              {/* Ndërrim shujtash në mes të periudhës: pjesa e parë me një zgjedhje, pjesa tjetër me tjetrën */}
              <label className="flex items-center gap-2 text-xs text-slate-600 dark:text-slate-300 pt-1">
                <input type="checkbox" checked={perzier} className="accent-teal-600" onChange={e => {
                  const on = e.target.checked;
                  setPerzier(on);
                  if (on) {
                    const a = calSplit ? calSplit[0] : Math.ceil(days / 2);
                    setPerzA({ dite: a, sh: shujta });
                    setPerzB({ dite: Math.max(0, days - a), sh: shujta === "TE_DYJA" ? "DREKE" : "TE_DYJA" });
                  } else { setDays(calendarDays(subPeriod)); }
                }} />
                Shujtat ndryshuan gjatë periudhës
              </label>
              {perzier && (
                <div className="space-y-1.5">
                  {([[perzA, setPerzA, "Pjesa e parë"], [perzB, setPerzB, "Pjesa e dytë"]] as [typeof perzA, typeof setPerzA, string][]).map(([v, set, lbl]) => (
                    <div key={lbl} className="grid grid-cols-[1fr_70px_1.4fr] items-center gap-2">
                      <span className="text-[11px] text-slate-500">{lbl}</span>
                      <input type="number" min="0" value={v.dite} onChange={e => set({ ...v, dite: parseInt(e.target.value) || 0 })} className="form-input rounded-lg py-1 text-sm" aria-label={`${lbl}: ditë`} />
                      <select value={v.sh} onChange={e => set({ ...v, sh: e.target.value as Shujta })} className="form-input rounded-lg py-1 text-xs" aria-label={`${lbl}: shujtat`}>
                        {(["TE_DYJA", "MENGJES", "DREKE"] as Shujta[]).map(s => <option key={s} value={s}>{SHUJTA_LABEL[s]} · {formatCurrency(cmimet[s])}</option>)}
                      </select>
                    </div>
                  ))}
                  <p className="text-[11px] text-teal-700 dark:text-teal-300">= {perzA.dite + perzB.dite} ditë, {formatCurrency(finalAmount)} · shënimi është i detyrueshëm. Për periudhat e ardhshme zgjidh shujtat me butonat më poshtë.</p>
                </div>
              )}
              <button type="button" disabled={saving} onClick={() => handleSave(false, paidBefore)} className="btn-secondary text-xs w-full justify-center">
                <Save className="w-3.5 h-3.5" /> Ruaj ndryshimet (pa pagesë)
              </button>
            </div>
          )}

          {bucket && !isSkipped && !isFree && !isCalc && (
            <div className="grid grid-cols-2 gap-1 p-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600">
              {(["DYMUJOR", "MUJOR"] as UshqimiPlan[]).map(p => (
                <button key={p} type="button" disabled={planBusy} onClick={() => zgjidhPlanin(p)}
                  className={`py-1.5 rounded-md text-sm font-semibold transition-colors ${plan === p ? "bg-violet-600 text-white" : "text-slate-500 hover:text-violet-600"}`}>
                  {p === "MUJOR" ? "Mujor" : "Dymujor"}
                </button>
              ))}
            </div>
          )}

          {/* Periudhë e ruajtur me çmim tjetër nga zgjedhja aktuale e shujtave — s'ndryshohet vetë, vetëm me klikim */}
          {existing && !isSkipped && !isFree && !isCalc && !perzier && !(existing.description || "").includes("(")
            && existing.finalAmount > 0 && Math.abs(pricePerDay - cmimet[shujta]) > 0.005 && (
            <div className="flex items-center justify-between gap-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
              <span>Ruajtur me {formatCurrency(pricePerDay)}/ditë; zgjedhja tani: {SHUJTA_LABEL[shujta]} {formatCurrency(cmimet[shujta])}.</span>
              <button type="button" onClick={() => {
                setPricePerDay(cmimet[shujta]);
                if (shumaChip === "full") { const rem = Math.max(0, Math.round((days * cmimet[shujta] - paidBefore) * 100) / 100); setShuma(rem > 0 ? String(rem) : ""); }
              }} className="shrink-0 font-semibold underline">Përditëso çmimin</button>
            </div>
          )}

          {bucket && !isSkipped && !isFree && !isCalc && !perzier && (
            <div className="grid grid-cols-3 gap-1 p-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-600" title="Shujtat — çmimi/ditë merret nga Kalkulatori">
              {(["TE_DYJA", "MENGJES", "DREKE"] as Shujta[]).map(s => (
                <button key={s} type="button" disabled={planBusy} onClick={() => zgjidhShujten(s)}
                  className={`py-1.5 rounded-md text-xs font-semibold transition-colors ${shujta === s ? "bg-teal-600 text-white" : "text-slate-500 hover:text-teal-600"}`}>
                  {s === "TE_DYJA" ? "Mëngjes + Drekë" : s === "MENGJES" ? "Mëngjes" : "Drekë"}
                  <span className={`block text-[10px] font-normal ${shujta === s ? "text-teal-100" : "text-slate-400"}`}>{formatCurrency(cmimet[s])}/ditë</span>
                </button>
              ))}
            </div>
          )}

          {kesteTani && (
            <div className="rounded-lg border border-violet-200 dark:border-violet-800 overflow-hidden bg-white dark:bg-slate-800">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-[10px] text-slate-500 bg-violet-50 dark:bg-violet-900/20">
                    <th className="text-left px-2.5 py-1 font-semibold">Muaji</th>
                    <th className="px-1.5 py-1 font-semibold text-center">Ditë</th>
                    <th className="px-1.5 py-1 font-semibold text-right">Shuma</th>
                    <th className="px-1.5 py-1 font-semibold text-center">Afati</th>
                    <th className="px-2.5 py-1 font-semibold text-right">Statusi</th>
                  </tr>
                </thead>
                <tbody>
                  {kesteTani.map(k => (
                    <tr key={k.muaji} className="border-t border-slate-100 dark:border-slate-700">
                      <td className="px-2.5 py-1.5 font-medium text-slate-800 dark:text-slate-100">{MONTHS[k.muaji - 1]}</td>
                      <td className="px-1.5 py-1.5 text-center">{k.dite}</td>
                      <td className="px-1.5 py-1.5 text-right">{formatCurrency(k.shuma)}</td>
                      <td className="px-1.5 py-1.5 text-center text-slate-500">{fmtDMY(k.afati).slice(0, 5)}</td>
                      <td className="px-2.5 py-1.5 text-right">
                        <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${
                          k.statusi === "PAGUAR" ? PERIOD_STATUS_UI.PAGUAR.cls
                          : k.statusi === "ME_VONESE" ? PERIOD_STATUS_UI.ME_VONESE.cls
                          : k.statusi === "PJESERISHT" ? PERIOD_STATUS_UI.PJESERISHT.cls
                          : PERIOD_STATUS_UI.PA_PAGUAR.cls}`}>
                          {k.statusi === "PAGUAR" ? "✓ Paguar" : k.statusi === "ME_VONESE" ? "Me vonesë" : k.statusi === "PJESERISHT" ? `Pjesërisht ${formatCurrency(k.paguar)}` : "Pa paguar"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="px-2.5 py-1 text-[10px] text-violet-700 dark:text-violet-300 border-t border-violet-100 dark:border-violet-900/40">
                Pagesa mbyll automatikisht këstin e parë të papaguar{kestiRradhes ? ` (${MONTHS[kestiRradhes.muaji - 1]})` : ""}.
              </p>
            </div>
          )}

          {isSkipped && (
            <div className="text-xs text-slate-600 dark:text-slate-300 space-y-2">
              <p>Kjo periudhë është <strong>Ndërprerë</strong> (nxënësi s&apos;e ndoqi).</p>
              <button onClick={rifillo} disabled={saving} className="w-full btn-primary justify-center bg-emerald-600 hover:bg-emerald-700 text-sm">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Rifillo ushqimin — {periodDays} ditë × {formatCurrency(cmimet[shujta])}
              </button>
            </div>
          )}
          {isFree && (
            <p className="text-xs text-sky-700 dark:text-sky-300">Kjo periudhë është <strong>Falas</strong> (e ndjek pa pagesë). Për ta rikthyer normale: ✎ Ndrysho → Ruaj ndryshimet.</p>
          )}
        </div>

        {/* 4. PAGESA E RE */}
        {!isSkipped && !isFree && (
          <div className="space-y-3">
            <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">{korrigjoTotalin ? "Korrigjim i totalit të paguar" : "Pagesa e re"}</p>

            {korrigjoTotalin ? (
              <div>
                <label className="text-xs text-slate-500">Total i paguar (në vend të {formatCurrency(paidBefore)})</label>
                <div className="relative">
                  <input type="number" value={totalKorrigjim} onChange={e => setTotalKorrigjim(e.target.value)} min="0" step="0.01"
                    className="w-full rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2.5 pr-8 text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-400" />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
                </div>
                <button type="button" onClick={() => setKorrigjoTotalin(false)} className="text-xs text-slate-400 underline mt-1">Anulo korrigjimin</button>
              </div>
            ) : (
              <div>
                <label className="text-xs text-slate-500">Shuma</label>
                <div className="relative">
                  <input type="number" inputMode="decimal" value={shuma} min="0" step="0.01" placeholder="0,00"
                    onChange={e => { setShuma(e.target.value); setShumaChip(null); setShumaError(""); }}
                    className={`w-full rounded-lg border bg-white dark:bg-slate-900 px-3 py-2.5 pr-8 text-xl font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-400 ${shumaError ? "border-red-400" : "border-slate-200 dark:border-slate-600"}`} />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">€</span>
                </div>
                {shumaError && <p className="text-xs text-red-600 mt-1">{shumaError}</p>}
                {!fullyPaid && remaining > 0 && (
                  <div className="grid grid-cols-3 gap-1.5 mt-2">
                    {([
                      ["full", `E plotë · ${formatCurrency(remaining)}`, remaining],
                      ...(bucket ? [
                        ["m1", `${MONTHS[bucket.months[0] - 1]} · ${formatCurrency(monthAmt(0))}`, monthAmt(0)],
                        ["m2", `${MONTHS[bucket.months[1] - 1]} · ${formatCurrency(monthAmt(1))}`, monthAmt(1)],
                      ] : []),
                    ] as ["full" | "m1" | "m2", string, number][]).map(([k, label, v]) => (
                      <button key={k} type="button" onClick={() => { setShuma(String(v)); setShumaChip(k); setShumaError(""); }}
                        className={`px-1.5 py-1.5 rounded-lg border text-[11px] font-medium truncate transition-colors ${shumaChip === k
                          ? "border-emerald-400 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300"
                          : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-emerald-300"}`}>
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Mënyra</label>
                <div className="flex flex-wrap gap-1.5 mt-0.5">
                  {METODAT.map(m => (
                    <button key={m.value} type="button" title={m.title} onClick={() => setMethod(m.value)}
                      className={`px-2 py-1.5 rounded-lg border text-xs font-medium transition-colors ${method === m.value
                        ? "border-blue-400 bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300"
                        : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-blue-300"}`}>
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-slate-500">Data e pagesës</label>
                <input type="text" value={paidDateTxt} onChange={e => setPaidDateTxt(e.target.value)} placeholder="dd.mm.yyyy"
                  className={`w-full mt-0.5 rounded-lg border bg-white dark:bg-slate-900 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${parseDMY(paidDateTxt) ? "border-slate-200 dark:border-slate-600" : "border-red-400"}`} />
              </div>
            </div>

            {noteOpen ? (
              <div>
                <label className="text-xs text-slate-500">
                  {daysManual ? <>Shënim — arsyeja e ditëve <span className="text-red-500">*</span></> : "Shënim"}
                </label>
                <input type="text" value={note} onChange={e => setNote(e.target.value)}
                  className={`w-full rounded-lg border bg-white dark:bg-slate-900 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 ${daysManual && !note.trim() ? "border-amber-400" : "border-slate-200 dark:border-slate-600"}`}
                  placeholder={daysManual ? 'p.sh. "Nxënës i ri nga 15 shtatori"' : 'p.sh. "Borxh i vjetër" ose sqarim tjetër'} />
              </div>
            ) : (
              <button type="button" onClick={() => setNoteOpen(true)} className="text-xs text-violet-600 dark:text-violet-300 font-medium hover:underline">＋ Shto shënim</button>
            )}

            {yearPlan.items.some(it => it.index !== periodIndex && it.remaining > 0) && !korrigjoTotalin && (
              <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600">
                <button type="button" onClick={() => setExtraOpen(v => !v)} className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-600 dark:text-slate-300">
                  <span>▤ Paguaj edhe periudha të tjera{extraItems.length ? ` (${extraItems.length} · ${formatCurrency(extraTotal)})` : ""}</span>
                  {extraOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>
                {extraOpen && (
                  <div className="px-3 pb-3 space-y-2">
                    <div className="flex items-center justify-end gap-3 text-xs">
                      <button type="button" onClick={() => setSelectedExtra(new Set(yearPlan.items.filter(it => it.index !== periodIndex && it.remaining > 0).map(it => it.index)))} className="text-primary-600 hover:underline">Zgjidh të gjitha</button>
                      <button type="button" onClick={() => setSelectedExtra(new Set())} className="text-slate-400 hover:underline">Pastro</button>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {yearPlan.items.filter(it => it.index !== periodIndex).map(it => (
                        <label key={it.index}
                          className={`flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-xs cursor-pointer border ${
                            it.remaining <= 0
                              ? "border-slate-100 dark:border-slate-700 text-slate-300 dark:text-slate-600 cursor-not-allowed"
                              : selectedExtra.has(it.index)
                                ? "border-emerald-400 bg-emerald-50 dark:bg-emerald-900/20 text-emerald-700 dark:text-emerald-400"
                                : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"}`}>
                          <input type="checkbox" className="accent-emerald-600" checked={selectedExtra.has(it.index)} disabled={it.remaining <= 0} onChange={() => toggleExtra(it.index)} />
                          <span className="flex-1">{it.period.label}</span>
                          {it.remaining > 0 && <span className="font-semibold">{formatCurrency(it.remaining)}</span>}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {saveError && <p className="text-sm text-red-600 bg-red-50 dark:bg-red-900/20 rounded-lg px-3 py-2">{saveError}</p>}
      </div>

      {/* 5. FUNDI */}
      <div className="flex items-center gap-2 px-5 py-4 border-t border-slate-100 dark:border-slate-700">
        <label className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300 mr-auto cursor-pointer">
          <input type="checkbox" checked={print} onChange={e => setPrint(e.target.checked)} className="accent-violet-600" />
          Printo dëshminë
        </label>
        <button onClick={onClose} className="btn-secondary">Anulo</button>
        {!isSkipped && !isFree && (
          <button onClick={ruaj} disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors disabled:opacity-60">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
            {korrigjoTotalin ? "Ruaj korrigjimin" : `Ruaj pagesën · ${formatCurrency(totalButon)}`}
          </button>
        )}
      </div>
    </>
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
/*  Rastet nga kalendari — ndreqen vetëm të shënuarat       */
/* ═══════════════════════════════════════════════════════ */
function RastetKalendariModal({ rastet, onClose, onApply }: {
  rastet: RastKalendari[];
  onClose: () => void;
  onApply: (sel: RastKalendari[]) => Promise<void>;
}) {
  const key = (r: RastKalendari) => `${r.p.id}`;
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const zgjedhur = rastet.filter(r => sel.has(key(r)));
  async function apliko() {
    if (!zgjedhur.length) return;
    if (!confirm(`Ndreq ${zgjedhur.length} raste?\n\nPër secilin: ditët bëhen sa kalendari, detyrimi rillogaritet, pagesat ekzistuese mbeten dhe shpërndahen te këstet, nxënësi kalon në plan Mujor nga ajo periudhë. Ndryshimi ruhet te historia e pagesës.`)) return;
    setBusy(true);
    await onApply(zgjedhur);
    setBusy(false);
  }
  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Rastet nga kalendari</h3>
            <p className="text-xs text-slate-400 mt-0.5">Periudha me më pak ditë se kalendari. Shëno vetëm ato që i miraton — të tjerat s&apos;preken.</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-auto flex-1">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900 text-[11px] text-slate-500">
              <tr>
                <th className="px-3 py-2">
                  <input type="checkbox" checked={sel.size === rastet.length && rastet.length > 0}
                    onChange={e => setSel(e.target.checked ? new Set(rastet.map(key)) : new Set())} aria-label="Zgjidh të gjitha" />
                </th>
                <th className="text-left px-2 py-2">Nxënësi</th>
                <th className="text-left px-2 py-2">Periudha</th>
                <th className="px-2 py-2 text-center">Ditë (shënuar → kalendari)</th>
                <th className="px-2 py-2 text-right">Detyrimi</th>
                <th className="px-3 py-2 text-right">Paguar</th>
              </tr>
            </thead>
            <tbody>
              {rastet.map(r => (
                <tr key={key(r)} className="border-t border-slate-100 dark:border-slate-700">
                  <td className="px-3 py-1.5 text-center">
                    <input type="checkbox" checked={sel.has(key(r))}
                      onChange={() => setSel(prev => { const n = new Set(prev); if (n.has(key(r))) n.delete(key(r)); else n.add(key(r)); return n; })} />
                  </td>
                  <td className="px-2 py-1.5">{r.s.firstName} {r.s.lastName} <span className="text-xs text-slate-400">{r.s.class?.name}</span></td>
                  <td className="px-2 py-1.5 text-xs">{PERIOD_BUCKETS[r.i].label} {r.calYear}</td>
                  <td className="px-2 py-1.5 text-center">{r.ditet} → <b>{r.kal}</b></td>
                  <td className="px-2 py-1.5 text-right">{formatCurrency(r.p.finalAmount)} → <b>{formatCurrency(r.detRi)}</b></td>
                  <td className="px-3 py-1.5 text-right">{formatCurrency(r.p.paidAmount)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="p-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between gap-3">
          <span className="text-xs text-slate-500">{zgjedhur.length} të zgjedhura</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn-secondary">Anulo</button>
            <button onClick={apliko} disabled={busy || !zgjedhur.length} className="btn-primary">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />} Ndreq rastet e zgjedhura
            </button>
          </div>
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

function StatListModal({ filter, students, onClose, mujorVoneseFor }: {
  filter: StatFilter;
  students: StudentRow[];
  onClose: () => void;
  mujorVoneseFor?: (s: StudentRow) => (periodIdx: number, p: Payment) => boolean | null;
}) {
  const withInfo = students.map(s => ({ s, info: computeRealPaymentInfo(s.installments, mujorVoneseFor?.(s)) }));
  const filtered = withInfo.filter(({ info }) => {
    if (filter === "all")     return true;
    if (filter === "paid")    return info.status === "PAID";
    if (filter === "overdue") return info.status === "OVERDUE";
    if (filter === "pending") return info.status === "PENDING";
    if (filter === "revenue") return info.paidAmount > 0;
    if (filter === "debt")    return info.balance > 0;
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
              {filtered.map(({ s, info }, i) => {
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
                    {(filter === "revenue" || filter === "debt") && (
                      <span className={`text-sm font-bold flex-shrink-0 ${filter === "debt" ? "text-red-500" : "text-green-600"}`}>
                        {filter === "revenue"
                          ? formatCurrency(info.paidAmount)
                          : formatCurrency(info.balance)}
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
