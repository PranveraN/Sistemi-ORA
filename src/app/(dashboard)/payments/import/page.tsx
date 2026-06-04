"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import Header from "@/components/layout/Header";
import Link from "next/link";
import { formatCurrency, MONTHS } from "@/lib/utils";
import {
  ChevronLeft, Download, Upload, CheckCircle, AlertCircle,
  FileSpreadsheet, X, Loader2, Users, Info, Search,
} from "lucide-react";

interface Category { id: number; name: string }

interface ParsedRow {
  firstName: string;
  lastName: string;
  parentName: string;
  phone: string;
  tuitionPrice: number;    // Çmimi i shkollimit
  discount: number;        // Zbritja
  finalAmount: number;     // Çmimi për pagesë (auto = tuitionPrice - discount)
  paidAmount: number;      // Paguar
  debt: number;            // Borxhi (auto = finalAmount - paidAmount)
  method: string;          // Bankë/Cash
  previousDebt: number;    // Detyrime paraprake
  comment: string;         // Koment
  _matched: boolean;
  _matchedName: string;
  _matchedId: number | null;
  _warn: string;
}

const METHOD_MAP: Record<string, string> = {
  cash: "CASH", "kesh": "CASH", "para": "CASH",
  bank: "BANK", "bankë": "BANK", "banke": "BANK", "banka": "BANK", "transfer": "BANK",
  card: "CARD", "kartelë": "CARD", "kartele": "CARD",
  online: "ONLINE",
};

export default function ImportPaymentsPage() {
  const now = new Date();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<"config" | "preview" | "done">("config");

  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number>(0);
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear]   = useState(now.getFullYear());
  const [isMonthly, setIsMonthly] = useState(true);

  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [search, setSearch] = useState("");
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null);

  useEffect(() => {
    fetch("/api/categories")
      .then(r => r.json())
      .then((cats: Category[]) => {
        setCategories(cats);
        const shkollimi = cats.find((c: Category) => c.name === "Shkollimi");
        if (shkollimi) setCategoryId(shkollimi.id);
        else if (cats.length > 0) setCategoryId(cats[0].id);
      });
  }, []);

  // ── Download template ──────────────────────────────────
  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const headers = [
      "Emri", "Mbiemri", "Prindi", "Telefoni",
      "Çmimi i shkollimit", "Zbritja", "Çmimi për pagesë",
      "Paguar", "Borxhi", "Bankë/Cash", "Detyrime paraprake", "Koment",
    ];
    const example = [
      "Ardit", "Berisha", "Agron Berisha", "383491234567",
      "2000", "100", "1900",
      "1900", "0", "Cash", "", "",
    ];
    const example2 = [
      "Lira", "Kelmendi", "Vjosa Kelmendi", "383449876543",
      "2000", "300", "1700",
      "0", "1700", "Bankë", "", "",
    ];
    const ws = XLSX.utils.aoa_to_sheet([headers, example, example2]);
    ws["!cols"] = headers.map((_, i) => ({ wch: i < 2 ? 12 : i < 4 ? 20 : 16 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Pagesat");
    XLSX.writeFile(wb, "Template-Shkollimi-Akademia-Ora.xlsx");
  }

  // ── Parse + match ──────────────────────────────────────
  async function parseAndMatch(file: File) {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    if (!raw.length) return;

    // Flexible header mapping
    const headerMap: Record<string, string> = {};
    for (const key of Object.keys(raw[0])) {
      const n = key.toLowerCase().trim()
        .replace(/ë/g, "e").replace(/ç/g, "c").replace(/ë/g, "e");
      const orig = key.toLowerCase().trim();

      if ((orig === "emri" || n === "emri") && !orig.includes("mbiemri")) headerMap[key] = "firstName";
      else if (orig.includes("mbiemri") || n.includes("mbiemri")) headerMap[key] = "lastName";
      else if (orig.includes("prindi") || orig.includes("prind") || orig === "prindi") headerMap[key] = "parentName";
      else if (orig.includes("telefon")) headerMap[key] = "phone";
      else if (orig.includes("cmimi i shkollimit") || orig.includes("çmimi i shkollimit") || orig.includes("shkollimit")) headerMap[key] = "tuitionPrice";
      else if (orig.includes("zbritj") || orig.includes("discount")) headerMap[key] = "discount";
      else if (orig.includes("cmimi per pagese") || orig.includes("çmimi për pagesë") || orig.includes("per pagese") || orig.includes("final")) headerMap[key] = "finalAmount";
      else if (orig.includes("paguar") || orig.includes("paid")) headerMap[key] = "paidAmount";
      else if (orig === "borxhi" || orig.includes("borxh") || orig.includes("debt")) headerMap[key] = "debt";
      else if (orig.includes("banke") || orig.includes("bankë") || orig.includes("bank") || (orig.includes("cash") && !orig.includes("çmim"))) headerMap[key] = "method";
      else if (orig.includes("detyrime") || orig.includes("paraprake") || orig.includes("previous")) headerMap[key] = "previousDebt";
      else if (orig.includes("koment") || orig.includes("comment") || orig.includes("shenim")) headerMap[key] = "comment";
    }

    // Fetch students
    const studRes = await fetch("/api/students?limit=10000");
    const studData = await studRes.json();
    const allStudents: { id: number; firstName: string; lastName: string; personalNumber: string }[] =
      studData.students || [];

    const parsed: ParsedRow[] = raw.map(row => {
      const m: Record<string, string> = {};
      for (const [origKey, mappedKey] of Object.entries(headerMap)) {
        const val = row[origKey];
        if (val instanceof Date) {
          m[mappedKey] = `${val.getDate().toString().padStart(2,"0")}/${(val.getMonth()+1).toString().padStart(2,"0")}/${val.getFullYear()}`;
        } else {
          m[mappedKey] = String(val ?? "").trim();
        }
      }

      const fn = (m.firstName || "").trim();
      const ln = (m.lastName  || "").trim();
      if (!fn && !ln) return null;

      const tuitionPrice = parseFloat(m.tuitionPrice || "0") || 0;
      const discount     = parseFloat(m.discount     || "0") || 0;
      // Auto-calc: finalAmount = tuitionPrice - discount (if not provided)
      const rawFinal     = parseFloat(m.finalAmount  || "0") || 0;
      const finalAmount  = rawFinal > 0 ? rawFinal : Math.max(0, tuitionPrice - discount);
      const paidAmount   = parseFloat(m.paidAmount   || "0") || 0;
      // Auto-calc: debt = finalAmount - paidAmount
      const rawDebt      = parseFloat(m.debt         || "0") || 0;
      const debt         = rawDebt > 0 ? rawDebt : Math.max(0, finalAmount - paidAmount);
      const previousDebt = parseFloat(m.previousDebt || "0") || 0;
      const methodRaw    = (m.method || "").toLowerCase().trim();
      const method       = METHOD_MAP[methodRaw] || (methodRaw ? "CASH" : "");

      // Match by firstName + lastName
      const matched = allStudents.find(
        s => s.firstName.toLowerCase() === fn.toLowerCase() && s.lastName.toLowerCase() === ln.toLowerCase()
      ) || allStudents.find(
        s => s.lastName.toLowerCase() === fn.toLowerCase() && s.firstName.toLowerCase() === ln.toLowerCase()
      );

      return {
        firstName: fn,
        lastName: ln,
        parentName: m.parentName || "",
        phone: m.phone || "",
        tuitionPrice,
        discount,
        finalAmount,
        paidAmount,
        debt,
        method,
        previousDebt,
        comment: m.comment || "",
        _matched: !!matched,
        _matchedName: matched ? `${matched.firstName} ${matched.lastName}` : "",
        _matchedId: matched?.id ?? null,
        _warn: !matched ? "Nxënësi nuk u gjet në sistem" : "",
      };
    }).filter(Boolean) as ParsedRow[];

    setRows(parsed);
    setFileName(file.name);
    setSearch("");
    setStep("preview");
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseAndMatch(file);
  }, [categoryId]);

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseAndMatch(file);
  }

  // ── Import ─────────────────────────────────────────────
  async function handleImport() {
    const toImport = rows.filter(r => r._matched);
    if (!toImport.length) return;
    setImporting(true);

    const res = await fetch("/api/payments/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId,
        month: isMonthly ? month : undefined,
        year,
        rows: toImport.map(r => ({
          firstName:   r.firstName,
          lastName:    r.lastName,
          amount:      r.tuitionPrice || r.finalAmount,
          discount:    r.discount,
          discountType: "fixed",
          scholarship: 0,
          finalAmount: r.finalAmount,
          paidAmount:  r.paidAmount,
          method:      r.method || "CASH",
          description: r.comment || undefined,
        })),
      }),
    });

    setResult(await res.json());
    setImporting(false);
    setStep("done");
  }

  const matched   = rows.filter(r =>  r._matched).length;
  const unmatched = rows.filter(r => !r._matched).length;
  const selectedCat = categories.find(c => c.id === categoryId);

  const filteredRows = rows.filter(r => {
    if (!search) return true;
    const q = search.toLowerCase();
    return `${r.firstName} ${r.lastName}`.toLowerCase().includes(q) ||
           `${r.lastName} ${r.firstName}`.toLowerCase().includes(q) ||
           r.parentName.toLowerCase().includes(q);
  });

  return (
    <>
      <Header title="Import Pagesa" backHref="/payments" />
      <div className="p-6 max-w-6xl mx-auto space-y-5 animate-fade-in">

        {/* Back */}
        <div className="flex items-center gap-3">
          <Link href="/shkollimi" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="page-title">Import Lista nga Excel</h1>
            <p className="text-sm text-slate-400 mt-0.5">Importo listën e nxënësve me çmimet dhe pagesat nga skedari Excel</p>
          </div>
        </div>

        {/* Steps */}
        <div className="flex items-center gap-2 text-sm">
          {[
            { n: 1, label: "Konfiguro & Ngarko", key: "config"  },
            { n: 2, label: "Kontrollo & Konfirmo", key: "preview" },
            { n: 3, label: "Import i kryer",    key: "done"    },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === s.key || (step === "preview" && s.n === 1) || (step === "done")
                  ? "bg-primary-600 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-400"
              }`}>{s.n}</div>
              <span className={step === s.key ? "font-medium text-slate-800 dark:text-white" : "text-slate-400"}>
                {s.label}
              </span>
              {i < 2 && <div className="w-8 h-px bg-slate-200 dark:bg-slate-700 mx-1" />}
            </div>
          ))}
        </div>

        {/* ── STEP 1: Config ── */}
        {step === "config" && (
          <div className="space-y-4">
            <div className="card p-5 space-y-4">
              <h2 className="section-title">1. Zgjidh Kategorinë dhe Periudhën</h2>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                <div>
                  <label className="form-label">Kategoria *</label>
                  <select value={categoryId} onChange={e => setCategoryId(parseInt(e.target.value))} className="form-input">
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">Periudha</label>
                  <select value={isMonthly ? "monthly" : "annual"} onChange={e => setIsMonthly(e.target.value === "monthly")} className="form-input">
                    <option value="monthly">Mujore</option>
                    <option value="annual">Vjetore</option>
                  </select>
                </div>
                {isMonthly && (
                  <div>
                    <label className="form-label">Muaji</label>
                    <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="form-input">
                      {MONTHS.map((m, i) => <option key={i} value={i+1}>{m}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label className="form-label">Viti</label>
                  <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="form-input">
                    {[2023,2024,2025,2026,2027].map(y => <option key={y} value={y}>{y}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Template */}
            <div className="card p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-white text-sm">Shkarko Template Excel</p>
                  <p className="text-xs text-slate-400">Formati: Emri, Mbiemri, Prindi, Telefoni, Çmimi i shkollimit, Zbritja...</p>
                </div>
              </div>
              <button onClick={downloadTemplate} className="btn-secondary">
                <Download className="w-4 h-4" />
                Shkarko Template
              </button>
            </div>

            {/* Column guide */}
            <div className="card p-5">
              <div className="flex items-center gap-2 mb-3">
                <Info className="w-4 h-4 text-slate-400" />
                <p className="text-sm font-semibold text-slate-700 dark:text-slate-200">Kolonat e pranuara nga Excel:</p>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                {[
                  { col: "Emri",                  note: "emri i nxënësit",         req: true  },
                  { col: "Mbiemri",               note: "mbiemri i nxënësit",      req: true  },
                  { col: "Prindi",                note: "emri i prindit",           req: false },
                  { col: "Telefoni",              note: "numri i telefonit",        req: false },
                  { col: "Çmimi i shkollimit",    note: "çmimi standard",          req: true  },
                  { col: "Zbritja",               note: "shuma e zbritjes (€)",    req: false },
                  { col: "Çmimi për pagesë",      note: "auto = Çmimi − Zbritja", req: false },
                  { col: "Paguar",                note: "shuma e paguar",           req: false },
                  { col: "Borxhi",                note: "auto = Çm.pagesë − Paguar", req: false },
                  { col: "Bankë/Cash",            note: "mënyra e pagesës",        req: false },
                  { col: "Detyrime paraprake",    note: "borxhi nga periudha para", req: false },
                  { col: "Koment",                note: "shënime shtesë",           req: false },
                ].map(item => (
                  <div key={item.col} className="flex items-start gap-1.5 p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 mt-1 ${item.req ? "bg-primary-500" : "bg-slate-300"}`} />
                    <div>
                      <p className="font-medium text-slate-700 dark:text-slate-300">{item.col}</p>
                      <p className="text-slate-400 text-[10px]">{item.note}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Drop zone */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`card p-12 flex flex-col items-center justify-center gap-4 cursor-pointer border-2 border-dashed transition-all ${
                dragging
                  ? "border-primary-400 bg-primary-50 dark:bg-primary-900/20"
                  : "border-slate-200 dark:border-slate-600 hover:border-primary-300 hover:bg-slate-50 dark:hover:bg-slate-800/50"
              }`}
            >
              <div className="w-14 h-14 bg-primary-50 dark:bg-primary-900/30 rounded-2xl flex items-center justify-center">
                <Upload className={`w-7 h-7 ${dragging ? "text-primary-500" : "text-primary-400"}`} />
              </div>
              <div className="text-center">
                <p className="font-semibold text-slate-700 dark:text-slate-200">
                  {dragging ? "Lësho skedarin këtu" : "Zvarrit ose kliko për të ngarkuar"}
                </p>
                <p className="text-sm text-slate-400 mt-1">Excel me listën e shkollimit (.xlsx, .xls, .csv)</p>
              </div>
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileInput} className="hidden" />
            </div>
          </div>
        )}

        {/* ── STEP 2: Preview ── */}
        {step === "preview" && (
          <div className="space-y-4">
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-4">
              <div className="card p-4 flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-slate-400" />
                <div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{rows.length}</p>
                  <p className="text-xs text-slate-400">Rreshta totale</p>
                </div>
              </div>
              <div className="card p-4 flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-xl font-bold text-green-600">{matched}</p>
                  <p className="text-xs text-slate-400">Nxënës të gjetur</p>
                </div>
              </div>
              <div className="card p-4 flex items-center gap-3">
                <AlertCircle className="w-8 h-8 text-amber-400" />
                <div>
                  <p className="text-xl font-bold text-amber-500">{unmatched}</p>
                  <p className="text-xs text-slate-400">Pa përputhje</p>
                </div>
              </div>
              <div className="card p-4 flex items-center gap-3">
                <div className="w-8 h-8 bg-red-50 dark:bg-red-900/20 rounded-full flex items-center justify-center">
                  <span className="text-red-600 font-bold text-xs">€</span>
                </div>
                <div>
                  <p className="text-xl font-bold text-red-600">
                    {formatCurrency(rows.reduce((s, r) => s + r.debt, 0))}
                  </p>
                  <p className="text-xs text-slate-400">Borxh total</p>
                </div>
              </div>
            </div>

            {/* Info + search */}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <FileSpreadsheet className="w-4 h-4 text-green-500" />
                <span className="font-medium">{fileName}</span>
                <span>•</span>
                <span className="font-semibold text-slate-700 dark:text-slate-200">{selectedCat?.name}</span>
                {isMonthly && <span>• {MONTHS[month-1]} {year}</span>}
                {!isMonthly && <span>• {year}</span>}
              </div>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                    placeholder="Kërko nxënës..."
                    className="form-input pl-8 py-1.5 text-sm w-52"
                  />
                </div>
                <button
                  onClick={() => { setRows([]); setFileName(""); setStep("config"); }}
                  className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"
                >
                  <X className="w-3.5 h-3.5" />
                  Ndrysho
                </button>
              </div>
            </div>

            {unmatched > 0 && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-xl">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {unmatched} rreshta nuk u lidh me asnjë nxënës — do të kalohen gjatë importit
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                  Sigurohu që emri dhe mbiemri përputhet saktë me nxënësin në sistem.
                </p>
              </div>
            )}

            {/* Table */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto max-h-[520px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0 z-10">
                    <tr>
                      <th className="table-header w-8">#</th>
                      <th className="table-header">Emri</th>
                      <th className="table-header">Mbiemri</th>
                      <th className="table-header">Prindi</th>
                      <th className="table-header">Telefoni</th>
                      <th className="table-header text-right">Çmimi shkollimit</th>
                      <th className="table-header text-right">Zbritja</th>
                      <th className="table-header text-right bg-yellow-50 dark:bg-yellow-900/20">Çmimi për pagesë</th>
                      <th className="table-header text-right">Paguar</th>
                      <th className="table-header text-right">Borxhi</th>
                      <th className="table-header">Bankë/Cash</th>
                      <th className="table-header text-right">Det. paraprake</th>
                      <th className="table-header">Koment</th>
                      <th className="table-header">Statusi</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {filteredRows.map((r, i) => {
                      const isPaid    = r.paidAmount >= r.finalAmount && r.finalAmount > 0;
                      const isPartial = r.paidAmount > 0 && !isPaid;
                      const statusLabel = isPaid ? "Paguar" : isPartial ? "Pjesërisht" : "Pa pagesë";
                      const statusColor = isPaid
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : isPartial
                        ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                        : "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400";

                      return (
                        <tr key={i} className={`transition-colors ${
                          !r._matched
                            ? "bg-red-50/60 dark:bg-red-900/10"
                            : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                        }`}>
                          <td className="table-cell text-slate-400 text-xs">{i+1}</td>
                          <td className="table-cell">
                            <div className="flex items-center gap-1.5">
                              {r._matched
                                ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                : <span title={r._warn}><AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" /></span>
                              }
                              <span className="font-medium text-slate-800 dark:text-slate-200">{r.firstName}</span>
                            </div>
                          </td>
                          <td className="table-cell font-medium text-slate-800 dark:text-slate-200">{r.lastName}</td>
                          <td className="table-cell text-slate-500 text-xs">{r.parentName || <span className="text-slate-300">—</span>}</td>
                          <td className="table-cell text-slate-500 text-xs font-mono">{r.phone || <span className="text-slate-300">—</span>}</td>
                          <td className="table-cell text-right text-slate-600 dark:text-slate-300">
                            {r.tuitionPrice > 0 ? formatCurrency(r.tuitionPrice) : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="table-cell text-right">
                            {r.discount > 0
                              ? <span className="text-green-600 font-medium">-{formatCurrency(r.discount)}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="table-cell text-right bg-yellow-50/50 dark:bg-yellow-900/10">
                            <span className="font-bold text-primary-700 dark:text-primary-400">
                              {r.finalAmount > 0 ? formatCurrency(r.finalAmount) : <span className="text-slate-300">—</span>}
                            </span>
                          </td>
                          <td className="table-cell text-right">
                            {r.paidAmount > 0
                              ? <span className="text-green-600 font-medium">{formatCurrency(r.paidAmount)}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="table-cell text-right">
                            {r.debt > 0
                              ? <span className="text-red-600 font-semibold">{formatCurrency(r.debt)}</span>
                              : r.finalAmount > 0
                              ? <span className="text-green-600 text-xs">✓ 0</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="table-cell text-xs text-slate-500">{r.method || <span className="text-slate-300">—</span>}</td>
                          <td className="table-cell text-right">
                            {r.previousDebt > 0
                              ? <span className="text-orange-600 text-xs">{formatCurrency(r.previousDebt)}</span>
                              : <span className="text-slate-300">—</span>}
                          </td>
                          <td className="table-cell text-xs text-slate-400 max-w-[100px] truncate">{r.comment || <span className="text-slate-300">—</span>}</td>
                          <td className="table-cell">
                            <span className={`badge text-xs ${statusColor}`}>{statusLabel}</span>
                          </td>
                        </tr>
                      );
                    })}
                    {filteredRows.length === 0 && (
                      <tr>
                        <td colSpan={14} className="table-cell text-center py-8 text-slate-400">
                          {search ? "Asnjë nxënës nuk u gjet me këtë kërkim" : "Lista është bosh"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {search && (
                <div className="px-4 py-2 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-400">
                  Duke shfaqur {filteredRows.length} nga {rows.length} rreshta
                </div>
              )}
            </div>

            {/* Totals summary */}
            <div className="card p-4 grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-slate-400 mb-1">Total Çmimi për pagesë</p>
                <p className="text-lg font-bold text-primary-600">{formatCurrency(rows.reduce((s,r) => s + r.finalAmount, 0))}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Total Paguar</p>
                <p className="text-lg font-bold text-green-600">{formatCurrency(rows.reduce((s,r) => s + r.paidAmount, 0))}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 mb-1">Total Borxhi</p>
                <p className="text-lg font-bold text-red-600">{formatCurrency(rows.reduce((s,r) => s + r.debt, 0))}</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <button onClick={() => { setRows([]); setFileName(""); setStep("config"); }} className="btn-secondary">
                <X className="w-4 h-4" />
                Anulo
              </button>
              <button
                onClick={handleImport}
                disabled={importing || matched === 0}
                className="btn-primary"
              >
                {importing
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Duke importuar...</>
                  : <><Upload className="w-4 h-4" />Importo {matched} Pagesa</>
                }
              </button>
            </div>
          </div>
        )}

        {/* ── STEP 3: Done ── */}
        {step === "done" && result && (
          <div className="card p-10 flex flex-col items-center text-center gap-5">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Import i Kryer!</h2>
              <p className="text-slate-400 text-sm">Pagesat u importuan me sukses në sistem</p>
            </div>

            <div className="grid grid-cols-3 gap-4 w-full max-w-md">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <p className="text-3xl font-bold text-green-600">{result.created}</p>
                <p className="text-sm text-green-700 dark:text-green-400 mt-1">Të reja</p>
              </div>
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-xl">
                <p className="text-3xl font-bold text-blue-600">{result.updated}</p>
                <p className="text-sm text-blue-700 dark:text-blue-400 mt-1">Përditësuar</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <p className="text-3xl font-bold text-slate-500">{result.skipped}</p>
                <p className="text-sm text-slate-500 mt-1">Kapërcyer</p>
              </div>
            </div>

            {result.errors.length > 0 && (
              <div className="w-full max-w-md p-4 bg-amber-50 dark:bg-amber-900/20 rounded-xl text-left">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400 mb-2">
                  Pa përputhje ({result.errors.length}):
                </p>
                <div className="max-h-40 overflow-y-auto space-y-1">
                  {result.errors.map((e, i) => (
                    <p key={i} className="text-xs text-amber-600 dark:text-amber-500">• {e}</p>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => { setRows([]); setFileName(""); setResult(null); setStep("config"); }}
                className="btn-secondary"
              >
                <Upload className="w-4 h-4" />
                Import tjetër
              </button>
              <Link href="/shkollimi" className="btn-primary">
                <Users className="w-4 h-4" />
                Shiko Pagesat
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
