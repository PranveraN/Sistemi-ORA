"use client";

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { askDeleteReason, reasonHeaders } from "@/lib/auditReason";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/layout/Header";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  UserPlus, Search, ChevronLeft, ChevronRight, Eye, Edit, Users, Upload, FileSignature,
  Trash2, Download, X, MessageSquare, Wallet, AlertCircle, CheckCircle2, CreditCard, FilterX,
} from "lucide-react";
import * as XLSX from "xlsx";
import { ACADEMIC_YEARS, CALENDAR_YEARS, DEFAULT_ACADEMIC_YEAR, type YearType } from "@/lib/academicYear";
import YearPicker from "@/components/dashboard/YearPicker";
import { useModuleAccess } from "@/lib/useModuleAccess";
import { STATUS_COLORS } from "@/lib/smsStatus";
import { STUDENT_PAY_STATUSES, type StudentPayStatus } from "@/lib/studentTableStatus";
import StudentHistoryPanel, { EVENT_META } from "@/components/students/StudentHistoryPanel";

interface Class { id: number; name: string; level: string }

interface Row {
  id: number;
  firstName: string;
  lastName: string;
  personalNumber: string | null;
  status: string;
  classId: number | null;
  className: string | null;
  parentName: string | null;
  phone: string | null;
  discountPct: number;
  kontrata: string | null;
  hasContract: boolean;
  hasPlan: boolean;
  paid: number;
  finalPrice: number;
  originalPrice: number;
  balance: number;
  payStatus: StudentPayStatus;
  timiInvest: { id: number; regularPrice: number } | null;
  lastEvent: { type: string; title: string; at: string | null } | null;
  _export?: {
    fatherName: string | null; fatherPhone: string | null; fatherEmail: string | null;
    motherName: string | null; motherPhone: string | null; motherEmail: string | null;
    parentName: string | null; parentPhone: string | null; address: string | null;
  };
}

interface TableResponse {
  rows: Row[];
  total: number;
  counts: { all: number; paid: number; debt: number; ti: number };
  defaultAmount: number;
  historyTypes: string[];
}

type SortKey = "name" | "parent" | "pay" | "debt" | "history";

const PAY_LABEL: Record<StudentPayStatus, string> = Object.fromEntries(
  STUDENT_PAY_STATUSES.map(s => [s.key, s.label]),
) as Record<StudentPayStatus, string>;

const LIMIT = 20;

/** Vlerë me vonesë (debounce) për fushat e tekstit */
function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export default function StudentsPage() {
  const sp = useSearchParams();
  const router = useRouter();
  const { canAccess } = useModuleAccess();

  /* ── Gjendja — e lexuar nga URL-ja (rifreskimi/ndarja e linkut e ruan) ── */
  const [yearType, setYearType] = useState<YearType>(sp.get("yt") === "calendar" ? "calendar" : "academic");
  const [year, setYear] = useState(parseInt(sp.get("y") || "") || DEFAULT_ACADEMIC_YEAR);
  const [searchInput, setSearchInput] = useState(sp.get("q") || "");
  const [status, setStatus] = useState(sp.get("st") === "all" ? "" : (sp.get("st") || "ACTIVE"));
  const [classId, setClassId] = useState(sp.get("cl") || sp.get("classId") || "");
  const [card, setCard] = useState(sp.get("card") || "all");
  const [fStudentInput, setFStudentInput] = useState(sp.get("fs") || "");
  const [fParentInput, setFParentInput] = useState(sp.get("fp") || "");
  const [fPay, setFPay] = useState(sp.get("pay") || "");
  const [fDebt, setFDebt] = useState(sp.get("debt") || "");
  const [fContract, setFContract] = useState(sp.get("ct") || "");
  const [fHist, setFHist] = useState(sp.get("hist") || "");
  const [sort, setSort] = useState<SortKey>((sp.get("sort") as SortKey) || "name");
  const [dir, setDir] = useState<"asc" | "desc">(sp.get("dir") === "desc" ? "desc" : "asc");
  const [page, setPage] = useState(parseInt(sp.get("page") || "1") || 1);

  const search = useDebounced(searchInput);
  const fStudent = useDebounced(fStudentInput);
  const fParent = useDebounced(fParentInput);

  const [classes, setClasses] = useState<Class[]>([]);
  const [data, setData] = useState<TableResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [historyFor, setHistoryFor] = useState<number | null>(null);
  const [exporting, setExporting] = useState(false);

  /* Editimi i çmimit me klikim (ndryshon zbritjen) — si më parë */
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [editingPriceVal, setEditingPriceVal] = useState("");

  // Çdo ndryshim filtri kthen në faqen 1
  const resetPage = () => setPage(1);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) { firstRun.current = false; return; }
    setPage(1);
  }, [search, fStudent, fParent]);

  /* ── Parametrat e filtrave (të njëjtët për listën, URL-në dhe eksportin) ── */
  const filterParams = useMemo(() => {
    const p = new URLSearchParams({ year: String(year), yearType });
    if (search.trim()) p.set("search", search.trim());
    if (status) p.set("status", status);
    if (classId) p.set("classId", classId);
    if (card !== "all") p.set("card", card);
    if (fStudent.trim()) p.set("fStudent", fStudent.trim());
    if (fParent.trim()) p.set("fParent", fParent.trim());
    if (fPay) p.set("fPay", fPay);
    if (fDebt) p.set("fDebt", fDebt);
    if (fContract) p.set("fContract", fContract);
    if (fHist) p.set("fHist", fHist);
    p.set("sort", sort);
    p.set("dir", dir);
    return p;
  }, [year, yearType, search, status, classId, card, fStudent, fParent, fPay, fDebt, fContract, fHist, sort, dir]);

  // Sinkronizimi me URL-në
  useEffect(() => {
    const u = new URLSearchParams();
    if (yearType !== "academic") u.set("yt", yearType);
    if (year !== DEFAULT_ACADEMIC_YEAR) u.set("y", String(year));
    if (search.trim()) u.set("q", search.trim());
    if (status !== "ACTIVE") u.set("st", status || "all");
    if (classId) u.set("cl", classId);
    if (card !== "all") u.set("card", card);
    if (fStudent.trim()) u.set("fs", fStudent.trim());
    if (fParent.trim()) u.set("fp", fParent.trim());
    if (fPay) u.set("pay", fPay);
    if (fDebt) u.set("debt", fDebt);
    if (fContract) u.set("ct", fContract);
    if (fHist) u.set("hist", fHist);
    if (sort !== "name") u.set("sort", sort);
    if (dir !== "asc") u.set("dir", dir);
    if (page > 1) u.set("page", String(page));
    const qs = u.toString();
    router.replace(qs ? `/students?${qs}` : "/students", { scroll: false });
  }, [router, yearType, year, search, status, classId, card, fStudent, fParent, fPay, fDebt, fContract, fHist, sort, dir, page]);

  const fetchRows = useCallback(async () => {
    setRefreshing(true);
    setLoadError("");
    try {
      const p = new URLSearchParams(filterParams);
      p.set("page", String(page));
      p.set("limit", String(LIMIT));
      const res = await fetch(`/api/students/table?${p}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setLoadError(d.error || "Ngarkimi i nxënësve dështoi."); return; }
      setData(d);
    } catch {
      setLoadError("Gabim rrjeti — provo përsëri.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [filterParams, page]);

  useEffect(() => { fetchRows(); }, [fetchRows]);

  useEffect(() => {
    fetch("/api/classes").then(r => r.ok ? r.json() : []).then((classData: Class[]) => {
      setClasses([...classData].sort((a, b) => {
        const na = parseInt(a.name), nb = parseInt(b.name);
        if (na !== nb) return na - nb;
        return a.name.localeCompare(b.name, "sq");
      }));
    }).catch(() => {});
  }, []);

  function switchYearType(yt: YearType) {
    setYearType(yt);
    const yrs = yt === "academic" ? ACADEMIC_YEARS : CALENDAR_YEARS;
    if (!yrs.includes(year)) setYear(yrs[yrs.length - 2] ?? yrs[0]);
    resetPage();
  }

  function toggleSort(key: SortKey) {
    if (sort === key) setDir(d => (d === "asc" ? "desc" : "asc"));
    else { setSort(key); setDir(key === "debt" ? "desc" : "asc"); } // Borxhi: më i madhi i pari
    resetPage();
  }

  const tableFiltersActive = !!(fStudentInput || fParentInput || fPay || fDebt || fContract || fHist || card !== "all");
  function clearTableFilters() {
    setFStudentInput(""); setFParentInput(""); setFPay(""); setFDebt(""); setFContract(""); setFHist(""); setCard("all");
    resetPage();
  }

  const rows = data?.rows ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / LIMIT));
  const defaultAmount = data?.defaultAmount ?? 0;

  /* ── Zgjedhja në grup ── */
  const pageIds = rows.map(r => r.id);
  const allPageSelected = pageIds.length > 0 && pageIds.every(id => selected.has(id));
  function togglePageSelection() {
    setSelected(prev => {
      const next = new Set(prev);
      if (allPageSelected) pageIds.forEach(id => next.delete(id)); else pageIds.forEach(id => next.add(id));
      return next;
    });
  }
  function toggleRow(id: number) {
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  /* ── Editimi i çmimit (zbritja) ── */
  function startEditPrice(r: Row) {
    setEditingPriceId(r.id);
    setEditingPriceVal(String(Math.round(r.finalPrice)));
  }
  async function commitEditPrice(r: Row) {
    setEditingPriceId(null);
    const newPrice = parseFloat(editingPriceVal);
    if (isNaN(newPrice) || newPrice <= 0 || !defaultAmount || newPrice === Math.round(r.finalPrice)) return;
    const newDisc = Math.max(0, Math.round((1 - newPrice / defaultAmount) * 10000) / 100);
    try {
      const res = await fetch(`/api/students/${r.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discountPct: newDisc }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || "Ndryshimi i çmimit dështoi.");
      }
    } catch {
      alert("Gabim rrjeti — provo përsëri.");
    }
    fetchRows();
  }

  async function handleDelete(r: Row) {
    const reason = askDeleteReason(
      `Fshi përgjithmonë "${r.firstName} ${r.lastName}"?\n\nKJO VEPRIM NUK MUND TË KTHEHET — fshihen edhe të gjitha pagesat dhe faturat.`
    );
    if (!reason) return;
    try {
      const res = await fetch(`/api/students/${r.id}?permanent=true`, { method: "DELETE", headers: reasonHeaders(reason) });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        alert(d.error || `Fshirja dështoi (gabim ${res.status})`);
        return;
      }
    } catch {
      alert("Gabim rrjeti — provo përsëri.");
      return;
    }
    setSelected(prev => { const n = new Set(prev); n.delete(r.id); return n; });
    fetchRows();
  }

  /* ── Eksportet ── */
  async function exportRows(onlyIds?: number[]) {
    setExporting(true);
    try {
      const p = onlyIds
        ? new URLSearchParams({ year: String(year), yearType, ids: onlyIds.join(","), sort, dir })
        : new URLSearchParams(filterParams);
      p.set("export", "1");
      const res = await fetch(`/api/students/table?${p}`);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { alert(d.error || "Eksporti dështoi."); return; }
      const list: Row[] = d.rows || [];
      const out = list.map((r, i) => {
        const e = r._export;
        const hasParentSplit = !!(e?.fatherName || e?.motherName);
        return {
          "#": i + 1,
          "Emri": r.firstName,
          "Mbiemri": r.lastName,
          "Klasa": r.className ?? "",
          "Nr. Personal": r.personalNumber ?? "",
          "Emri i Babait": e?.fatherName ?? "",
          "Telefoni i Babait": e?.fatherPhone ?? "",
          "Email i Babait": e?.fatherEmail ?? "",
          "Emri i Nënës": e?.motherName ?? "",
          "Telefoni i Nënës": e?.motherPhone ?? "",
          "Email i Nënës": e?.motherEmail ?? "",
          "Prindi (i përgjithshëm)": hasParentSplit ? "" : (e?.parentName ?? ""),
          "Telefoni (i përgjithshëm)": hasParentSplit ? "" : (e?.parentPhone ?? ""),
          "Adresa": e?.address ?? "",
          "Çmimi Bazë (€)": r.originalPrice,
          "Zbritja (%)": r.discountPct,
          "Çmimi Final (€)": r.finalPrice,
          "Paguar (€)": r.paid,
          "Borxhi (€)": r.balance,
          "Statusi i pagesës": PAY_LABEL[r.payStatus],
          "Kontrata": r.kontrata ?? "",
          "Statusi": r.status === "ACTIVE" ? "Aktiv" : "Joaktiv",
          "Ngjarja e fundit": r.lastEvent ? `${r.lastEvent.title}${r.lastEvent.at ? ` · ${formatDate(r.lastEvent.at)}` : ""}` : "",
        };
      });
      const ws = XLSX.utils.json_to_sheet(out);
      ws["!cols"] = [
        { wch: 4 }, { wch: 16 }, { wch: 18 }, { wch: 8 }, { wch: 15 },
        { wch: 18 }, { wch: 14 }, { wch: 22 }, { wch: 18 }, { wch: 14 }, { wch: 22 },
        { wch: 18 }, { wch: 16 }, { wch: 24 },
        { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 16 }, { wch: 14 }, { wch: 10 }, { wch: 30 },
      ];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Nxënësit");
      const today = new Date().toISOString().split("T")[0];
      XLSX.writeFile(wb, onlyIds ? `Nxenesit-te-zgjedhur-${today}.xlsx` : `Nxenesit-Cmime-Borxhe-${today}.xlsx`);
    } catch {
      alert("Gabim rrjeti — provo përsëri.");
    } finally {
      setExporting(false);
    }
  }

  async function handleExportFamilies() {
    const res = await fetch(`/api/reports/families?basePrice=${defaultAmount || 2000}`);
    const { families } = await res.json();

    type Child = { firstName: string; lastName: string; class: string; discountPct: number; finalPrice: number; paid: number; debt: number };
    type Family = { lastName: string; fatherName: string | null; motherName: string | null; phone: string; childCount: number; children: Child[]; totalFinalPrice: number; totalPaid: number; totalDebt: number };

    const out: (string | number)[][] = [];
    out.push(["FAMILJA", "FËMIJA", "KLASA", "ZBRITJA", "ÇMIMI FINAL", "PAGUAR", "BORXHI"]);
    for (const fam of families as Family[]) {
      const parentInfo = [fam.fatherName, fam.motherName].filter(Boolean).join(" & ") || "—";
      const famLabel = `Familja ${fam.lastName}${fam.phone ? ` — ${fam.phone}` : ""}`;
      out.push([famLabel, parentInfo, "", "", "", "", ""]);
      for (const c of fam.children) {
        out.push(["", `${c.firstName} ${c.lastName}`, c.class, c.discountPct > 0 ? `-${c.discountPct}%` : "", c.finalPrice, c.paid, c.debt]);
      }
      out.push(["", "TOTAL FAMILJA", "", "", fam.totalFinalPrice, fam.totalPaid, fam.totalDebt]);
      out.push(["", "", "", "", "", "", ""]);
    }
    const ws = XLSX.utils.aoa_to_sheet(out);
    ws["!cols"] = [{ wch: 36 }, { wch: 22 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Familjet");
    const summary: (string | number)[][] = [
      ["Familje gjithsej", families.length],
      ["Nxënës gjithsej", (families as Family[]).reduce((s: number, f: Family) => s + f.childCount, 0)],
      ["Familje me 2+ fëmijë", (families as Family[]).filter((f: Family) => f.childCount >= 2).length],
      ["", ""],
      ["Borxhi total", (families as Family[]).reduce((s: number, f: Family) => s + f.totalDebt, 0)],
      ["Paguar total", (families as Family[]).reduce((s: number, f: Family) => s + f.totalPaid, 0)],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(summary);
    ws2["!cols"] = [{ wch: 22 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Permbledhje");
    const today = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Familjet-${today}.xlsx`);
  }

  function sendSmsToSelected() {
    router.push(`/sms?students=${Array.from(selected).join(",")}`);
  }

  /* ── Pjesë të vogla UI ── */
  const periodLabel = yearType === "academic" ? `${year}–${year + 1}` : String(year);
  const cards: { key: string; label: string; value: number; icon: typeof Users; tone: string }[] = [
    { key: "all",  label: "Të gjithë",         value: data?.counts.all ?? 0,  icon: Users,        tone: "text-primary-600 bg-primary-50 dark:bg-primary-900/30" },
    { key: "paid", label: "Paguar plotësisht", value: data?.counts.paid ?? 0, icon: CheckCircle2, tone: "text-green-600 bg-green-50 dark:bg-green-900/30" },
    { key: "debt", label: "Me borxh",          value: data?.counts.debt ?? 0, icon: AlertCircle,  tone: "text-red-600 bg-red-50 dark:bg-red-900/30" },
    { key: "ti",   label: "Timi Invest",       value: data?.counts.ti ?? 0,   icon: CreditCard,   tone: "text-blue-600 bg-blue-50 dark:bg-blue-900/30" },
  ];

  const sortIcon = (key: SortKey) => sort !== key ? "↕" : dir === "asc" ? "↑" : "↓";
  const ariaSort = (key: SortKey) => sort !== key ? "none" as const : dir === "asc" ? "ascending" as const : "descending" as const;
  const SortHeader = ({ k, label, className = "" }: { k: SortKey; label: string; className?: string }) => (
    <th className={`table-header ${className}`} aria-sort={ariaSort(k)}>
      <button type="button" onClick={() => toggleSort(k)} className="inline-flex items-center gap-1 hover:text-primary-600">
        {label} <span className="text-slate-400 text-[11px]">{sortIcon(k)}</span>
      </button>
    </th>
  );

  // Banner i familjes — kur kërkimi gjen vëllezër/motra me të njëjtin telefon
  const siblingBanner = (() => {
    if (!search.trim() || rows.length < 2) return null;
    const freq = rows.reduce<Record<string, number>>((acc, r) => { if (r.phone) acc[r.phone] = (acc[r.phone] ?? 0) + 1; return acc; }, {});
    const sharedPhone = Object.entries(freq).find(([, c]) => c >= 2)?.[0];
    if (!sharedPhone) return null;
    const sib = rows.filter(r => r.phone === sharedPhone);
    return (
      <Link href={`/families?phone=${encodeURIComponent(sharedPhone)}`}
        className="flex items-center gap-3 px-4 py-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors">
        <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
          <Users className="w-5 h-5 text-primary-600 dark:text-primary-400" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-primary-800 dark:text-primary-300">{sib.length} vëllezër/motra të familjes {sib[0]?.lastName}</p>
          <p className="text-xs text-primary-600 dark:text-primary-400">Kliko për të parë profilin e plotë të familjes →</p>
        </div>
      </Link>
    );
  })();

  const filterInput = "w-full text-xs px-2 py-1 rounded-md border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 font-normal normal-case tracking-normal text-slate-700 dark:text-slate-200";

  return (
    <>
      <Header title="Nxënësit" />
      <div className="p-4 sm:p-6 space-y-4 animate-fade-in">

        {/* ── 1. Koka: periudha (pa ndryshim) ── */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 text-sm font-medium">
            {([["calendar", "📅 Kalendarik"], ["academic", "🎓 Akademik"]] as [YearType, string][]).map(([yt, lbl]) => (
              <button key={yt} onClick={() => switchYearType(yt)}
                className={`px-4 py-2 transition-colors ${yearType === yt ? "bg-primary-600 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                {lbl}
              </button>
            ))}
          </div>
          <YearPicker years={yearType === "academic" ? ACADEMIC_YEARS : CALENDAR_YEARS} year={year} yearType={yearType}
            onSelect={y => { setYear(y); resetPage(); }} />
        </div>

        {/* ── Shiriti i filtrave dhe butonave (pa ndryshim) ── */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-1 gap-3 items-center w-full sm:max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
                placeholder="Kërko emër, nr.personal, telefon..." className="form-input pl-9" />
            </div>
            <select value={status} onChange={e => { setStatus(e.target.value); resetPage(); }} className="form-input w-36">
              <option value="">Të gjithë</option>
              <option value="ACTIVE">Aktivë</option>
              <option value="INACTIVE">Joaktivë</option>
            </select>
            <select value={classId} onChange={e => { setClassId(e.target.value); resetPage(); }} className="form-input w-36">
              <option value="">Të gjitha klasat</option>
              {classes.map(c => <option key={c.id} value={String(c.id)}>{c.name}</option>)}
            </select>
          </div>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleExportFamilies} className="btn-secondary whitespace-nowrap">
              <Download className="w-4 h-4" /> Exporto Familjet
            </button>
            <button onClick={() => exportRows()} disabled={exporting} className="btn-secondary whitespace-nowrap" title="Eksporton listën sipas filtrave aktivë">
              <Download className="w-4 h-4" /> Exporto Excel
            </button>
            <Link href="/students/import" className="btn-secondary whitespace-nowrap">
              <Upload className="w-4 h-4" /> Import Liste
            </Link>
            <Link href="/students/new" className="btn-primary whitespace-nowrap">
              <UserPlus className="w-4 h-4" /> Regjistro Nxënës
            </Link>
          </div>
        </div>

        {/* ── 2. Kartat-filtra ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
          {cards.map(c => {
            const Icon = c.icon;
            const active = card === c.key;
            return (
              <button key={c.key} type="button" onClick={() => { setCard(c.key); resetPage(); }} aria-pressed={active}
                className={`card p-3 sm:p-4 flex items-center gap-3 text-left transition-all border-2 ${
                  active ? "border-primary-500 ring-2 ring-primary-100 dark:ring-primary-900/40" : "border-transparent hover:border-slate-200 dark:hover:border-slate-600"
                }`}>
                <div className={`w-9 h-9 flex-shrink-0 rounded-lg flex items-center justify-center ${c.tone}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-lg font-bold text-slate-900 dark:text-white">{c.value}</p>
                  <p className="text-xs text-slate-400 truncate">{c.label} · {periodLabel}</p>
                </div>
              </button>
            );
          })}
        </div>

        {siblingBanner}

        {/* ── 6. Shiriti i zgjedhjes në grup ── */}
        {selected.size > 0 && (
          <div className="flex flex-wrap items-center gap-2 px-4 py-2.5 rounded-xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800">
            <span className="text-sm font-semibold text-primary-800 dark:text-primary-300">{selected.size} të zgjedhur</span>
            <div className="flex gap-2 ml-auto">
              {canAccess("/sms") && (
                <button onClick={sendSmsToSelected} className="btn-primary text-sm">
                  <MessageSquare className="w-4 h-4" /> Dërgo SMS
                </button>
              )}
              <button onClick={() => exportRows(Array.from(selected))} disabled={exporting} className="btn-secondary text-sm">
                <Download className="w-4 h-4" /> Eksporto
              </button>
              <button onClick={() => setSelected(new Set())} className="btn-secondary text-sm">Anulo</button>
            </div>
          </div>
        )}

        {/* ── 3. Tabela ── */}
        <div className={`card overflow-hidden transition-opacity duration-150 ${refreshing && !loading ? "opacity-60" : ""}`}>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="table-header w-8">
                    <input type="checkbox" checked={allPageSelected} onChange={togglePageSelection}
                      aria-label="Zgjidh të gjithë nxënësit e kësaj faqeje" title="Zgjidh gjithë faqen" />
                  </th>
                  <SortHeader k="name" label="Nxënësi" />
                  <SortHeader k="parent" label="Prindi" />
                  <SortHeader k="pay" label="Pagesa e shkollimit" />
                  <SortHeader k="debt" label="Borxhi" />
                  <th className="table-header">Kontrata</th>
                  <SortHeader k="history" label="Historiku" />
                  <th className="table-header text-right">Veprime</th>
                </tr>
                {/* Rreshti i filtrave të kolonave */}
                <tr className="border-t border-slate-100 dark:border-slate-700">
                  <th className="px-3 py-1.5" />
                  <th className="px-3 py-1.5">
                    <input value={fStudentInput} onChange={e => setFStudentInput(e.target.value)} className={filterInput}
                      placeholder="Emër, klasë, nr. personal" aria-label="Filtro sipas nxënësit" />
                  </th>
                  <th className="px-3 py-1.5">
                    <input value={fParentInput} onChange={e => setFParentInput(e.target.value)} className={filterInput}
                      placeholder="Emër ose telefon" aria-label="Filtro sipas prindit" />
                  </th>
                  <th className="px-3 py-1.5">
                    <select value={fPay} onChange={e => { setFPay(e.target.value); resetPage(); }} className={filterInput} aria-label="Filtro sipas pagesës">
                      <option value="">Të gjitha</option>
                      <option value="none">Asnjë pagesë</option>
                      <option value="partial">Pjesërisht</option>
                      <option value="full">E plotë</option>
                      <option value="discount">Me zbritje</option>
                    </select>
                  </th>
                  <th className="px-3 py-1.5">
                    <select value={fDebt} onChange={e => { setFDebt(e.target.value); resetPage(); }} className={filterInput} aria-label="Filtro sipas borxhit">
                      <option value="">Të gjitha</option>
                      {STUDENT_PAY_STATUSES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
                    </select>
                  </th>
                  <th className="px-3 py-1.5">
                    <select value={fContract} onChange={e => { setFContract(e.target.value); resetPage(); }} className={filterInput} aria-label="Filtro sipas kontratës">
                      <option value="">Të gjitha</option>
                      <option value="yes">Ka kontratë</option>
                      <option value="no">Pa kontratë</option>
                    </select>
                  </th>
                  <th className="px-3 py-1.5">
                    <select value={fHist} onChange={e => { setFHist(e.target.value); resetPage(); }} className={filterInput} aria-label="Filtro sipas ngjarjes së fundit">
                      <option value="">Të gjitha</option>
                      {(data?.historyTypes ?? []).map(t => <option key={t} value={t}>{EVENT_META[t]?.label ?? t}</option>)}
                      <option value="NONE">Pa ngjarje</option>
                    </select>
                  </th>
                  <th className="px-3 py-1.5 text-right">
                    {tableFiltersActive && (
                      <button onClick={clearTableFilters} className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 font-medium normal-case tracking-normal whitespace-nowrap">
                        <FilterX className="w-3.5 h-3.5" /> Pastro filtrat
                      </button>
                    )}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {loading ? (
                  <tr><td colSpan={8} className="table-cell text-center py-12 text-slate-400">Duke ngarkuar...</td></tr>
                ) : loadError ? (
                  <tr><td colSpan={8} className="table-cell text-center py-12 text-red-500">{loadError}</td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={8} className="table-cell text-center py-12 text-slate-400">Asnjë nxënës nuk u gjet</td></tr>
                ) : rows.map(r => {
                  const pct = r.finalPrice > 0 ? Math.min(100, Math.round((r.paid / r.finalPrice) * 100)) : (r.balance <= 0 && r.hasPlan ? 100 : 0);
                  const colors = STATUS_COLORS[r.payStatus];
                  const editable = !r.hasPlan && !r.timiInvest && defaultAmount > 0;
                  return (
                    <tr key={r.id} className={`hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors ${selected.has(r.id) ? "bg-primary-50/40 dark:bg-primary-900/10" : ""}`}>
                      <td className="table-cell">
                        <input type="checkbox" checked={selected.has(r.id)} onChange={() => toggleRow(r.id)}
                          aria-label={`Zgjidh ${r.firstName} ${r.lastName}`} />
                      </td>
                      {/* Nxënësi */}
                      <td className="table-cell">
                        <div className="flex items-center gap-1.5">
                          <Link href={`/students/${r.id}`} className="font-semibold text-slate-900 dark:text-white hover:text-primary-600">
                            {r.firstName} {r.lastName}
                          </Link>
                          {r.status !== "ACTIVE" && (
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">Joaktiv</span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-400">
                          {r.className && (
                            <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-1.5 py-0.5 rounded text-[10px] font-medium">{r.className}</span>
                          )}
                          {r.personalNumber && <span>{r.personalNumber}</span>}
                        </div>
                      </td>
                      {/* Prindi */}
                      <td className="table-cell">
                        <p className="text-sm text-slate-700 dark:text-slate-200">{r.parentName || "—"}</p>
                        {r.phone && <p className="text-xs text-slate-400">{r.phone}</p>}
                      </td>
                      {/* Pagesa e shkollimit */}
                      <td className="table-cell min-w-[170px]">
                        {editingPriceId === r.id ? (
                          <input type="number" min={0} autoFocus value={editingPriceVal}
                            onChange={e => setEditingPriceVal(e.target.value)}
                            onBlur={() => commitEditPrice(r)}
                            onKeyDown={e => { if (e.key === "Enter") commitEditPrice(r); if (e.key === "Escape") setEditingPriceId(null); }}
                            className="w-24 border border-primary-400 rounded-lg px-2 py-0.5 text-sm font-semibold dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            aria-label="Çmimi final i ri" />
                        ) : (
                          <div className="flex items-center gap-1.5" title={`Çmimi origjinal: ${formatCurrency(r.originalPrice)}`}>
                            <span className="text-sm text-slate-700 dark:text-slate-200">
                              {formatCurrency(r.paid)} /{" "}
                              {editable ? (
                                <button type="button" onClick={() => startEditPrice(r)} className="font-semibold hover:text-primary-600 underline decoration-dotted underline-offset-2"
                                  title="Kliko për të ndryshuar çmimin final (zbritjen)">
                                  {formatCurrency(r.finalPrice)}
                                </button>
                              ) : <span className="font-semibold">{formatCurrency(r.finalPrice)}</span>}
                            </span>
                            {r.discountPct > 0 && (
                              <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">-{r.discountPct}%</span>
                            )}
                          </div>
                        )}
                        <div className="mt-1 h-1.5 w-full rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
                          <div className={`h-full rounded-full ${pct >= 100 ? "bg-green-500" : "bg-primary-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </td>
                      {/* Borxhi */}
                      <td className="table-cell">
                        {r.balance > 0.005
                          ? <p className="text-sm font-semibold text-red-600">{formatCurrency(r.balance)}</p>
                          : <p className="text-sm text-slate-300">—</p>}
                        <span className={`inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${colors?.chip ?? ""}`}>
                          {PAY_LABEL[r.payStatus]}
                        </span>
                      </td>
                      {/* Kontrata */}
                      <td className="table-cell">
                        {canAccess("/sekretaria") ? (
                          <Link href={`/sekretaria/kontratat-nxenesve?studentId=${r.id}`}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:text-blue-400 transition-colors"
                            title={r.kontrata ? `Kontrata: ${r.kontrata}` : "Kontrata"}>
                            <FileSignature className="w-3.5 h-3.5" /> Kontratë
                          </Link>
                        ) : (
                          <span className="text-xs text-slate-400">{r.kontrata || "—"}</span>
                        )}
                      </td>
                      {/* Historiku */}
                      <td className="table-cell">
                        <button type="button" onClick={() => setHistoryFor(r.id)}
                          className="text-left text-xs px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 max-w-[190px]"
                          title="Hap historikun" aria-label={`Historiku i ${r.firstName} ${r.lastName}`}>
                          {r.lastEvent ? (
                            <>
                              <span className="block truncate font-medium">{r.lastEvent.title}</span>
                              {r.lastEvent.at && <span className="text-slate-400">{formatDate(r.lastEvent.at)}</span>}
                            </>
                          ) : <span className="text-slate-400">Shiko historikun</span>}
                        </button>
                      </td>
                      {/* Veprime */}
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/students/${r.id}`} title="Shiko profilin" aria-label="Shiko profilin"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link href={`/students/${r.id}/edit`} title="Modifiko" aria-label="Modifiko"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button onClick={() => handleDelete(r)} title="Fshi nxënësin" aria-label="Fshi nxënësin"
                            className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Faqosja */}
          {total > 0 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
              <p className="text-sm text-slate-500">
                Duke shfaqur {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, total)} nga {total} nxënës
              </p>
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                    aria-label="Faqja e mëparshme" title="Faqja e mëparshme"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors">
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                  <span className="text-sm text-slate-600 dark:text-slate-300 px-2">{page} / {totalPages}</span>
                  <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page >= totalPages}
                    aria-label="Faqja tjetër" title="Faqja tjetër"
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
        <p className="text-xs text-slate-400 flex items-center gap-1.5">
          <Wallet className="w-3.5 h-3.5" />
          Pagesa dhe borxhi i shkollimit për vitin {periodLabel}. Çmimi origjinal shfaqet duke kaluar miun mbi shumë.
          Lidhja me Timi Invest bëhet te profili i nxënësit.
        </p>
      </div>

      {historyFor !== null && (
        <StudentHistoryPanel studentId={historyFor} onClose={() => setHistoryFor(null)} />
      )}
    </>
  );
}
