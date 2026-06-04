"use client";

import { useState, useRef, useCallback } from "react";
import Header from "@/components/layout/Header";
import Link from "next/link";
import {
  ChevronLeft, Download, Upload, CheckCircle, AlertCircle,
  FileSpreadsheet, X, Loader2,
} from "lucide-react";
import { MONTHS } from "@/lib/utils";

interface ParsedRecord {
  firstName: string;
  lastName: string;
  klasa: string;
  plan: string;
  amount: string;
  paidAmount: string;
  method: string;
  _valid: boolean;
  _error: string;
}

const COLUMNS = [
  { key: "firstName",  label: "Emri",       required: true  },
  { key: "lastName",   label: "Mbiemri",    required: true  },
  { key: "klasa",      label: "Klasa",      required: false },
  { key: "plan",       label: "Plani",      required: false },
  { key: "amount",     label: "Shuma (€)",  required: true  },
  { key: "paidAmount", label: "Paguar (€)", required: false },
  { key: "method",     label: "Mënyra",     required: false },
];

const now = new Date();

export default function UshqimiImportPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging,   setDragging]   = useState(false);
  const [fileName,   setFileName]   = useState("");
  const [records,    setRecords]    = useState<ParsedRecord[]>([]);
  const [month,      setMonth]      = useState(now.getMonth() + 1);
  const [year,       setYear]       = useState(now.getFullYear());
  const [importing,  setImporting]  = useState(false);
  const [result,     setResult]     = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null);
  const [step,       setStep]       = useState<"upload" | "preview" | "done">("upload");

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const header  = COLUMNS.map(c => c.label);
    const example = [
      ["Ardit", "Berisha",  "2A", "2 shujta / muaj", "80", "80", "Cash"],
      ["Fjolla", "Krasniqi", "3B", "1 shujtë / muaj", "40", "0",  "Cash"],
      ["Mirlind", "Ahmeti",  "5A", "2 shujta / muaj", "80", "40", "Bank"],
    ];
    const ws = XLSX.utils.aoa_to_sheet([header, ...example]);
    ws["!cols"] = COLUMNS.map(c => ({
      wch: c.key === "plan" ? 22 : c.key === "method" ? 10 : 14
    }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Ushqimi");

    // Instructions sheet
    const guide = [
      ["UDHËZIME"],
      [],
      ["Fusha", "Përshkrimi", "Shembull"],
      ["Emri", "Emri i nxënësit (duhet të ekzistojë)", "Ardit"],
      ["Mbiemri", "Mbiemri i nxënësit", "Berisha"],
      ["Klasa", "Emri i klasës (opsional, ndihmon match-un)", "2A"],
      ["Plani", "Lloji i planit ushqimor", "2 shujta / muaj"],
      ["Shuma (€)", "Shuma totale e muajit", "80"],
      ["Paguar (€)", "Shuma e paguar deri tani (0 nëse jo)", "80"],
      ["Mënyra", "Cash / Bank / Card / Online", "Cash"],
      [],
      ["SHËNIM:", "Emri dhe Mbiemri duhet të përputhet saktë me databazën."],
      ["", "Klasa ndihmon kur ka dy nxënës me të njëjtin emër."],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(guide);
    ws2["!cols"] = [{ wch: 14 }, { wch: 44 }, { wch: 20 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Udhëzime");

    XLSX.writeFile(wb, `Template-Ushqimi-${MONTHS[month - 1]}-${year}.xlsx`);
  }

  async function parseFile(file: File) {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

    const headerMap: Record<string, string> = {};
    if (raw.length > 0) {
      for (const key of Object.keys(raw[0])) {
        const n = key.toLowerCase().trim();
        if      (n === "emri" || n === "first name" || n === "firstname") headerMap[key] = "firstName";
        else if (n === "mbiemri" || n === "last name" || n === "lastname") headerMap[key] = "lastName";
        else if (n.includes("klas"))                                        headerMap[key] = "klasa";
        else if (n.includes("plan"))                                        headerMap[key] = "plan";
        else if (n.includes("paguar") || n.includes("paid"))               headerMap[key] = "paidAmount";
        else if (n.includes("shuma") || n.includes("amount") || n.includes("çmimi") || n.includes("cmimi")) headerMap[key] = "amount";
        else if (n.includes("mënyr") || n.includes("method") || n.includes("menyr")) headerMap[key] = "method";
      }
    }

    const parsed: ParsedRecord[] = raw.map(row => {
      const get = (field: string) => {
        const k = Object.keys(headerMap).find(k => headerMap[k] === field);
        return k ? String(row[k] ?? "").trim() : "";
      };
      const firstName = get("firstName");
      const lastName  = get("lastName");
      const amount    = get("amount");
      const warnings: string[] = [];
      if (!firstName) warnings.push("Emri mungon");
      if (!lastName)  warnings.push("Mbiemri mungon");
      if (!amount || isNaN(parseFloat(amount))) warnings.push("Shuma mungon ose e pavlefshme");

      return {
        firstName,
        lastName,
        klasa:      get("klasa"),
        plan:       get("plan"),
        amount,
        paidAmount: get("paidAmount") || "0",
        method:     get("method") || "Cash",
        _valid:     !!(firstName && lastName && amount && !isNaN(parseFloat(amount))),
        _error:     warnings.join(", "),
      };
    }).filter(r => r.firstName || r.lastName || r.amount);

    setRecords(parsed);
    setFileName(file.name);
    setStep("preview");
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseFile(file);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleImport() {
    const toImport = records.filter(r => r._valid);
    if (!toImport.length) return;
    setImporting(true);
    const res = await fetch("/api/ushqimi/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ records: toImport, month, year }),
    });
    const data = await res.json();
    setResult(data);
    setImporting(false);
    setStep("done");
  }

  const validCount   = records.filter(r =>  r._valid).length;
  const invalidCount = records.filter(r => !r._valid).length;

  return (
    <>
      <Header />
      <div className="p-6 max-w-4xl mx-auto animate-fade-in space-y-5">

        <div className="flex items-center gap-3">
          <Link href="/ushqimi" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="page-title">Import Lista Ushqimit</h1>
            <p className="text-sm text-slate-400 mt-0.5">Ngarko Excel me fëmijët dhe çmimet — sistemi i gjeneron pagesat automatikisht</p>
          </div>
        </div>

        {/* Hapat */}
        <div className="flex items-center gap-2 text-sm">
          {[
            { n: 1, label: "Ngarko",   active: step === "upload"  },
            { n: 2, label: "Kontrollo", active: step === "preview" },
            { n: 3, label: "Kryer",    active: step === "done"    },
          ].map((s, i) => (
            <div key={s.n} className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step === "done" || (step === "preview" && s.n === 1) || s.active
                  ? "bg-primary-600 text-white"
                  : "bg-slate-100 dark:bg-slate-700 text-slate-400"
              }`}>{s.n}</div>
              <span className={s.active ? "font-medium text-slate-800 dark:text-white" : "text-slate-400"}>{s.label}</span>
              {i < 2 && <div className="w-8 h-px bg-slate-200 dark:bg-slate-700 mx-1" />}
            </div>
          ))}
        </div>

        {/* STEP 1: Upload */}
        {step === "upload" && (
          <div className="space-y-4">
            {/* Month/Year selector */}
            <div className="card p-4 flex items-center gap-4">
              <p className="text-sm font-medium text-slate-700 dark:text-slate-200">Muaji / Viti:</p>
              <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="form-input w-36">
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="form-input w-24">
                {[2024, 2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
              </select>
            </div>

            {/* Template download */}
            <div className="card p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-white text-sm">Hapi 1: Shkarko templatein</p>
                  <p className="text-xs text-slate-400">Plotëso me emrat e fëmijëve dhe çmimet për {MONTHS[month - 1]} {year}</p>
                </div>
              </div>
              <button onClick={downloadTemplate} className="btn-secondary">
                <Download className="w-4 h-4" />
                Shkarko Template
              </button>
            </div>

            {/* Drag & Drop */}
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true); }}
              onDragLeave={() => setDragging(false)}
              onDrop={handleDrop}
              onClick={() => inputRef.current?.click()}
              className={`card p-12 flex flex-col items-center gap-4 cursor-pointer transition-all border-2 border-dashed ${
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
                  {dragging ? "Lësho skedarin këtu" : "Zvarrit Excel ose kliko për të ngarkuar"}
                </p>
                <p className="text-sm text-slate-400 mt-1">Mbështet: .xlsx, .xls</p>
              </div>
              <input ref={inputRef} type="file" accept=".xlsx,.xls"
                onChange={e => { const f = e.target.files?.[0]; if (f) parseFile(f); }}
                className="hidden" />
            </div>

            {/* Column guide */}
            <div className="card p-4">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-3">Kolonat e pranuara:</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {COLUMNS.map(col => (
                  <div key={col.key} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                    <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${col.required ? "bg-red-500" : "bg-slate-300"}`} />
                    <span className="text-slate-600 dark:text-slate-300">{col.label}</span>
                    {col.required && <span className="text-red-400 ml-auto">*</span>}
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-3">
                <span className="text-red-500">*</span> Fushat e detyrueshme •
                Nëse nxënësi ekziston tashmë, pagesa <strong>përditësohet</strong>
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            {/* Month/Year display */}
            <div className="flex items-center gap-3 text-sm text-slate-500 dark:text-slate-400">
              <span className="font-medium">Muaji:</span>
              <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 px-3 py-1 rounded-lg font-semibold">
                {MONTHS[month - 1]} {year}
              </span>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4">
              <div className="card p-4 flex items-center gap-3">
                <FileSpreadsheet className="w-7 h-7 text-slate-400" />
                <div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{records.length}</p>
                  <p className="text-xs text-slate-400">Rreshta totale</p>
                </div>
              </div>
              <div className="card p-4 flex items-center gap-3">
                <CheckCircle className="w-7 h-7 text-green-500" />
                <div>
                  <p className="text-xl font-bold text-green-600">{validCount}</p>
                  <p className="text-xs text-slate-400">Gati për import</p>
                </div>
              </div>
              <div className="card p-4 flex items-center gap-3">
                <AlertCircle className="w-7 h-7 text-red-400" />
                <div>
                  <p className="text-xl font-bold text-red-500">{invalidCount}</p>
                  <p className="text-xs text-slate-400">Me gabime</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <FileSpreadsheet className="w-4 h-4 text-green-500" />
                <span className="font-medium">{fileName}</span>
              </div>
              <button onClick={() => { setRecords([]); setFileName(""); setStep("upload"); }}
                className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1">
                <X className="w-3.5 h-3.5" /> Ndrysho skedarin
              </button>
            </div>

            {/* Preview table */}
            <div className="card overflow-hidden">
              <div className="overflow-x-auto max-h-[420px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                    <tr>
                      <th className="table-header w-8">#</th>
                      <th className="table-header">Emri</th>
                      <th className="table-header">Mbiemri</th>
                      <th className="table-header">Klasa</th>
                      <th className="table-header">Plani</th>
                      <th className="table-header text-right">Shuma</th>
                      <th className="table-header text-right">Paguar</th>
                      <th className="table-header">Mënyra</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {records.map((r, i) => (
                      <tr key={i} className={r._valid ? "hover:bg-slate-50 dark:hover:bg-slate-800/30" : "bg-red-50 dark:bg-red-900/10"}>
                        <td className="table-cell text-slate-400">{i + 1}</td>
                        <td className="table-cell font-medium">
                          <div className="flex items-center gap-1.5">
                            {r._valid
                              ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                              : <span title={r._error}><AlertCircle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" /></span>}
                            {r.firstName || <span className="text-red-400 italic">mungon</span>}
                          </div>
                        </td>
                        <td className="table-cell">{r.lastName || <span className="text-red-400 italic">mungon</span>}</td>
                        <td className="table-cell">
                          {r.klasa
                            ? <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded text-xs font-medium">{r.klasa}</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="table-cell text-xs text-slate-500">{r.plan || "—"}</td>
                        <td className="table-cell text-right font-semibold text-slate-800 dark:text-slate-200">
                          {r.amount ? `${r.amount} €` : <span className="text-red-400">?</span>}
                        </td>
                        <td className="table-cell text-right">
                          {parseFloat(r.paidAmount || "0") > 0
                            ? <span className="text-green-600 font-medium">{r.paidAmount} €</span>
                            : <span className="text-slate-300">0 €</span>}
                        </td>
                        <td className="table-cell text-xs text-slate-500">{r.method || "Cash"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {invalidCount > 0 && (
              <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
                <p className="text-sm font-medium text-red-700 dark:text-red-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {invalidCount} rreshta me gabime — nuk do importohen
                </p>
                <p className="text-xs text-red-600 dark:text-red-500 mt-1">
                  Kontrollo që emrat dhe shumat të jenë plotësuar saktë.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button onClick={() => { setRecords([]); setFileName(""); setStep("upload"); }} className="btn-secondary">
                <X className="w-4 h-4" />Anulo
              </button>
              <button onClick={handleImport} disabled={importing || validCount === 0} className="btn-primary">
                {importing
                  ? <><Loader2 className="w-4 h-4 animate-spin" />Duke importuar...</>
                  : <><Upload className="w-4 h-4" />Importo {validCount} fëmijë — {MONTHS[month - 1]} {year}</>}
              </button>
            </div>
          </div>
        )}

        {/* STEP 3: Done */}
        {step === "done" && result && (
          <div className="card p-10 flex flex-col items-center text-center gap-5">
            <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center">
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-900 dark:text-white mb-1">Import i Kryer!</h2>
              <p className="text-slate-400 text-sm">Lista e ushqimit për {MONTHS[month - 1]} {year} u ngarkua</p>
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
              <div className="w-full p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-left">
                <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">
                  {result.errors.length} nxënës nuk u gjetën në bazë të të dhënave:
                </p>
                {result.errors.map((e, i) => <p key={i} className="text-xs text-red-600 dark:text-red-400">• {e}</p>)}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setRecords([]); setFileName(""); setResult(null); setStep("upload"); }} className="btn-secondary">
                <Upload className="w-4 h-4" />Import tjetër
              </button>
              <Link href="/ushqimi" className="btn-primary">
                <CheckCircle className="w-4 h-4" />Shiko Ushqimin
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
