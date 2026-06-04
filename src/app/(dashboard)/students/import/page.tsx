"use client";

import { useState, useRef, useCallback } from "react";
import Header from "@/components/layout/Header";
import Link from "next/link";
import {
  ChevronLeft, Download, Upload, CheckCircle,
  AlertCircle, FileSpreadsheet, X, Loader2, Eye
} from "lucide-react";

interface ParsedStudent {
  firstName: string;
  lastName: string;
  personalNumber: string;
  birthDate: string;
  klasa: string;
  diaryNumber: string;
  address: string;
  // Nëna
  motherName: string;
  motherBirth: string;
  motherProf: string;
  motherPhone: string;
  motherEmail: string;
  // Baba
  fatherName: string;
  fatherBirth: string;
  fatherProf: string;
  fatherPhone: string;
  fatherEmail: string;
  status: string;
  _valid: boolean;
  _error: string;
}

const COLUMNS: { key: string; label: string; required: boolean; group: string }[] = [
  // Nxënësi
  { key: "firstName",      label: "Emri",               required: true,  group: "Nxënësi" },
  { key: "lastName",       label: "Mbiemri",            required: true,  group: "Nxënësi" },
  { key: "personalNumber", label: "Nr. Personal",       required: false, group: "Nxënësi" },
  { key: "birthDate",      label: "Datëlindja",         required: false, group: "Nxënësi" },
  { key: "klasa",          label: "Klasa",              required: false, group: "Nxënësi" },
  { key: "diaryNumber",    label: "Nr. Ditarit",        required: false, group: "Nxënësi" },
  { key: "address",        label: "Adresa",             required: false, group: "Nxënësi" },
  { key: "status",         label: "Statusi",            required: false, group: "Nxënësi" },
  // Nëna
  { key: "motherName",     label: "Emri i Nënës",       required: false, group: "Nëna" },
  { key: "motherBirth",    label: "Datëlindja (Nënë)",  required: false, group: "Nëna" },
  { key: "motherProf",     label: "Profesioni (Nënë)",  required: false, group: "Nëna" },
  { key: "motherPhone",    label: "Tel. Nëna",          required: false, group: "Nëna" },
  { key: "motherEmail",    label: "Email Nëna",         required: false, group: "Nëna" },
  // Baba
  { key: "fatherName",     label: "Emri i Babës",       required: false, group: "Baba" },
  { key: "fatherBirth",    label: "Datëlindja (Babë)",  required: false, group: "Baba" },
  { key: "fatherProf",     label: "Profesioni (Babë)",  required: false, group: "Baba" },
  { key: "fatherPhone",    label: "Tel. Baba",          required: false, group: "Baba" },
  { key: "fatherEmail",    label: "Email Baba",         required: false, group: "Baba" },
];

const GROUPS = ["Nxënësi", "Nëna", "Baba"];
const GROUP_COLORS: Record<string, string> = {
  "Nxënësi": "bg-primary-50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300",
  "Nëna":    "bg-pink-50 dark:bg-pink-900/20 text-pink-700 dark:text-pink-300",
  "Baba":    "bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300",
};

export default function ImportStudentsPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging]   = useState(false);
  const [fileName, setFileName]   = useState("");
  const [students, setStudents]   = useState<ParsedStudent[]>([]);
  const [importing, setImporting] = useState(false);
  const [result, setResult]       = useState<{ created: number; skipped: number; errors: string[] } | null>(null);
  const [step, setStep]           = useState<"upload" | "preview" | "done">("upload");

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const wb = XLSX.utils.book_new();

    // Sheet 1: Template me shembull
    const header  = COLUMNS.map(c => c.label);
    const example = [
      // Nxënësi
      "Ardit", "Berisha", "1001234567890", "15/03/2015", "2A", "001",
      "Rr. Nëna Tereze 22, Prishtinë", "Aktiv",
      // Nëna
      "Fatmire Berisha", "10/03/1985", "Ekonomiste", "044 111 222", "fatmire@email.com",
      // Baba
      "Agim Berisha", "05/06/1982", "Inxhinier", "044 333 444", "agim@email.com",
    ];

    const ws = XLSX.utils.aoa_to_sheet([header, example]);
    ws["!cols"] = COLUMNS.map(c => ({
      wch: c.key.includes("Email") || c.key === "address" ? 28
         : c.key === "personalNumber" ? 18
         : c.key.includes("Name") || c.key.includes("name") ? 20
         : 16
    }));
    XLSX.utils.book_append_sheet(wb, ws, "Nxënësit");

    // Sheet 2: Udhëzime
    const guide = [
      ["UDHËZIME PËR PLOTËSIM"],
      [],
      ["Fusha", "Përshkrimi", "Formati / Shembull"],
      ["Emri", "Emri i nxënësit", "Ardit"],
      ["Mbiemri", "Mbiemri i nxënësit", "Berisha"],
      ["Nr. Personal", "Numri personal 13-shifror (opsional — gjenerohet auto)", "1001234567890"],
      ["Datëlindja", "Data e lindjes së nxënësit", "15/03/2015 ose 2015-03-15"],
      ["Klasa", "Emri i klasës (duhet të ekzistojë)", "2A, 3B, etj."],
      ["Nr. Ditarit", "Numri i ditarit (opsional)", "001"],
      ["Adresa", "Adresa e familjes", "Rr. Nëna Tereze 22, Prishtinë"],
      ["Statusi", "Aktiv ose Joaktiv", "Aktiv"],
      [],
      ["Emri i Nënës", "Emri dhe mbiemri i nënës", "Fatmire Berisha"],
      ["Datëlindja (Nënë)", "Data e lindjes së nënës", "10/03/1985"],
      ["Profesioni (Nënë)", "Profesioni i nënës", "Ekonomiste"],
      ["Tel. Nëna", "Numri i telefonit të nënës", "044 111 222"],
      ["Email Nëna", "Email i nënës", "fatmire@email.com"],
      [],
      ["Emri i Babës", "Emri dhe mbiemri i babës", "Agim Berisha"],
      ["Datëlindja (Babë)", "Data e lindjes së babës", "05/06/1982"],
      ["Profesioni (Babë)", "Profesioni i babës", "Inxhinier"],
      ["Tel. Baba", "Numri i telefonit të babës", "044 333 444"],
      ["Email Baba", "Email i babës", "agim@email.com"],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(guide);
    ws2["!cols"] = [{ wch: 22 }, { wch: 40 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Udhëzime");

    XLSX.writeFile(wb, "Template-Nxenesit-Akademia-Ora.xlsx");
  }

  async function parseFile(file: File) {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array", cellDates: true });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

    const headerMap: Record<string, string> = {};
    if (raw.length > 0) {
      const firstKeys = Object.keys(raw[0]);

      // 1. Exact match me emrat e kolonave (template)
      for (const col of COLUMNS) {
        const match = firstKeys.find(k => k.trim() === col.label);
        if (match) headerMap[match] = col.key;
      }

      // 2. Fuzzy fallback për skedarë jo-template
      for (const key of firstKeys) {
        if (headerMap[key]) continue;
        const n = key.toLowerCase().trim();
        if      (n === "emri" || n === "first name" || n === "firstname")    headerMap[key] = "firstName";
        else if (n === "mbiemri" || n === "last name" || n === "lastname")   headerMap[key] = "lastName";
        else if (n.includes("nr. personal") || n.includes("personal"))      headerMap[key] = "personalNumber";
        else if ((n.includes("datë") || n.includes("date")) && !n.includes("nënë") && !n.includes("babë")) headerMap[key] = "birthDate";
        else if (n.includes("klas"))                                         headerMap[key] = "klasa";
        else if (n.includes("ditar"))                                        headerMap[key] = "diaryNumber";
        else if (n.includes("adres"))                                        headerMap[key] = "address";
        else if (n.includes("status"))                                       headerMap[key] = "status";
        else if ((n.includes("nënë") || n.includes("nene")) && n.includes("emri")) headerMap[key] = "motherName";
        else if ((n.includes("nënë") || n.includes("nene")) && (n.includes("datë") || n.includes("lindje"))) headerMap[key] = "motherBirth";
        else if ((n.includes("nënë") || n.includes("nene")) && n.includes("profes")) headerMap[key] = "motherProf";
        else if ((n.includes("nënë") || n.includes("nene")) && (n.includes("tel") || n.includes("phone"))) headerMap[key] = "motherPhone";
        else if ((n.includes("nënë") || n.includes("nene")) && n.includes("email")) headerMap[key] = "motherEmail";
        else if ((n.includes("babë") || n.includes("baba")) && n.includes("emri")) headerMap[key] = "fatherName";
        else if ((n.includes("babë") || n.includes("baba")) && (n.includes("datë") || n.includes("lindje"))) headerMap[key] = "fatherBirth";
        else if ((n.includes("babë") || n.includes("baba")) && n.includes("profes")) headerMap[key] = "fatherProf";
        else if ((n.includes("babë") || n.includes("baba")) && (n.includes("tel") || n.includes("phone"))) headerMap[key] = "fatherPhone";
        else if ((n.includes("babë") || n.includes("baba")) && n.includes("email")) headerMap[key] = "fatherEmail";
      }
    }

    function cellStr(row: Record<string, unknown>, field: string): string {
      const origKey = Object.keys(headerMap).find(k => headerMap[k] === field);
      if (!origKey) return "";
      const val = row[origKey];
      if (val instanceof Date) {
        const d = val.getDate().toString().padStart(2, "0");
        const m = (val.getMonth() + 1).toString().padStart(2, "0");
        return `${d}/${m}/${val.getFullYear()}`;
      }
      return String(val ?? "").trim();
    }

    const parsed: ParsedStudent[] = raw.map((row) => {
      const firstName      = cellStr(row, "firstName");
      const lastName       = cellStr(row, "lastName");
      const hasName        = !!(firstName || lastName);
      const warnings: string[] = [];
      if (!firstName)  warnings.push("Emri mungon");
      if (!lastName)   warnings.push("Mbiemri mungon");
      if (!cellStr(row, "personalNumber")) warnings.push("Nr. Personal mungon — gjenerohet auto");

      return {
        firstName,
        lastName,
        personalNumber: cellStr(row, "personalNumber"),
        birthDate:      cellStr(row, "birthDate"),
        klasa:          cellStr(row, "klasa"),
        diaryNumber:    cellStr(row, "diaryNumber"),
        address:        cellStr(row, "address"),
        status:         cellStr(row, "status") || "Aktiv",
        motherName:     cellStr(row, "motherName"),
        motherBirth:    cellStr(row, "motherBirth"),
        motherProf:     cellStr(row, "motherProf"),
        motherPhone:    cellStr(row, "motherPhone"),
        motherEmail:    cellStr(row, "motherEmail"),
        fatherName:     cellStr(row, "fatherName"),
        fatherBirth:    cellStr(row, "fatherBirth"),
        fatherProf:     cellStr(row, "fatherProf"),
        fatherPhone:    cellStr(row, "fatherPhone"),
        fatherEmail:    cellStr(row, "fatherEmail"),
        _valid: hasName,
        _error: warnings.join(", "),
      };
    }).filter(s => s.firstName || s.lastName || s.personalNumber);

    setStudents(parsed);
    setFileName(file.name);
    setStep("preview");
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseFile(file);
  }

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file && (file.name.endsWith(".xlsx") || file.name.endsWith(".xls") || file.name.endsWith(".csv"))) {
      parseFile(file);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function handleImport() {
    const toImport = students.filter(s => s._valid);
    if (!toImport.length) return;
    setImporting(true);
    const res = await fetch("/api/students/import", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ students: toImport }),
    });
    const data = await res.json();
    setResult(data);
    setImporting(false);
    setStep("done");
  }

  const validCount   = students.filter(s =>  s._valid).length;
  const warningCount = students.filter(s => !s._valid).length;

  return (
    <>
      <Header />
      <div className="p-6 max-w-5xl mx-auto animate-fade-in space-y-5">

        <div className="flex items-center gap-3">
          <Link href="/students" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="page-title">Import i Listës së Nxënësve</h1>
            <p className="text-sm text-slate-400 mt-0.5">Ngarko skedarin Excel me të dhënat e nxënësve dhe prindëve</p>
          </div>
        </div>

        {/* Hapat */}
        <div className="flex items-center gap-2 text-sm">
          {[
            { n: 1, label: "Ngarko skedarin",     active: step === "upload"  },
            { n: 2, label: "Kontrollo të dhënat", active: step === "preview" },
            { n: 3, label: "Import i kryer",       active: step === "done"   },
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
            <div className="card p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-green-50 dark:bg-green-900/30 rounded-xl flex items-center justify-center">
                  <FileSpreadsheet className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <p className="font-semibold text-slate-800 dark:text-white text-sm">Hapi 1: Shkarko templatein</p>
                  <p className="text-xs text-slate-400">Plotëso skedarin me të dhënat e nxënësit, nënës dhe babës</p>
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
              className={`card p-12 flex flex-col items-center justify-center gap-4 cursor-pointer transition-all border-2 border-dashed ${
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
                  {dragging ? "Lësho skedarin këtu" : "Zvarrit skedarin ose kliko për të ngarkuar"}
                </p>
                <p className="text-sm text-slate-400 mt-1">Mbështet: .xlsx, .xls, .csv</p>
              </div>
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" onChange={handleFileInput} className="hidden" />
            </div>

            {/* Kolonat sipas grupeve */}
            <div className="card p-5">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
                <Eye className="w-4 h-4 text-slate-400" />
                Kolonat e pranuara — {COLUMNS.length} gjithsej
              </p>
              <div className="space-y-3">
                {GROUPS.map(group => (
                  <div key={group}>
                    <p className={`text-xs font-bold uppercase tracking-wider mb-2 px-2 py-1 rounded-md w-fit ${GROUP_COLORS[group]}`}>
                      {group}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                      {COLUMNS.filter(c => c.group === group).map(col => (
                        <div key={col.key} className="flex items-center gap-2 text-xs p-2 rounded-lg bg-slate-50 dark:bg-slate-800">
                          <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${col.required ? "bg-red-500" : "bg-slate-300"}`} />
                          <span className="text-slate-600 dark:text-slate-300">{col.label}</span>
                          {col.required && <span className="text-red-400 ml-auto">*</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-400 mt-4">
                <span className="text-red-500 font-medium">*</span> Fushat e detyrueshme •
                Datat në formatin: <span className="font-mono">DD/MM/YYYY</span> •
                Statusi: <span className="font-mono">Aktiv</span> ose <span className="font-mono">Joaktiv</span>
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: Preview */}
        {step === "preview" && (
          <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
              <div className="card p-4 flex items-center gap-3">
                <FileSpreadsheet className="w-8 h-8 text-slate-400" />
                <div>
                  <p className="text-xl font-bold text-slate-900 dark:text-white">{students.length}</p>
                  <p className="text-xs text-slate-400">Rreshta totale</p>
                </div>
              </div>
              <div className="card p-4 flex items-center gap-3">
                <CheckCircle className="w-8 h-8 text-green-500" />
                <div>
                  <p className="text-xl font-bold text-green-600">{validCount}</p>
                  <p className="text-xs text-slate-400">Gati për import</p>
                </div>
              </div>
              <div className="card p-4 flex items-center gap-3">
                <AlertCircle className="w-8 h-8 text-amber-400" />
                <div>
                  <p className="text-xl font-bold text-amber-500">{warningCount}</p>
                  <p className="text-xs text-slate-400">Me të dhëna jo të plota</p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm text-slate-500">
                <FileSpreadsheet className="w-4 h-4 text-green-500" />
                <span className="font-medium">{fileName}</span>
                <span>• {students.length} rreshta</span>
              </div>
              <button
                onClick={() => { setStudents([]); setFileName(""); setStep("upload"); }}
                className="text-xs text-slate-400 hover:text-red-500 flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                Ndrysho skedarin
              </button>
            </div>

            <div className="card overflow-hidden">
              <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                    <tr>
                      <th className="table-header w-8">#</th>
                      <th className="table-header">Emri</th>
                      <th className="table-header">Mbiemri</th>
                      <th className="table-header">Nr. Personal</th>
                      <th className="table-header">Datëlindja</th>
                      <th className="table-header">Klasa</th>
                      <th className="table-header text-pink-600">Nëna</th>
                      <th className="table-header text-pink-600">Tel. Nëna</th>
                      <th className="table-header text-blue-600">Baba</th>
                      <th className="table-header text-blue-600">Tel. Baba</th>
                      <th className="table-header">Adresa</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {students.map((s, i) => (
                      <tr
                        key={i}
                        className={`transition-colors ${
                          s._valid && !s._error
                            ? "hover:bg-slate-50 dark:hover:bg-slate-800/30"
                            : s._valid && s._error
                            ? "bg-amber-50/50 dark:bg-amber-900/5 hover:bg-amber-50 dark:hover:bg-amber-900/10"
                            : "bg-red-50 dark:bg-red-900/10"
                        }`}
                      >
                        <td className="table-cell text-slate-400">{i + 1}</td>
                        <td className="table-cell font-medium text-slate-900 dark:text-white">
                          <div className="flex items-center gap-1.5">
                            {s._valid && !s._error
                              ? <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                              : <span title={s._error}><AlertCircle className="w-3.5 h-3.5 text-amber-400 flex-shrink-0" /></span>}
                            {s.firstName || <span className="text-red-400 italic">mungon</span>}
                          </div>
                        </td>
                        <td className="table-cell">{s.lastName || <span className="text-red-400 italic">mungon</span>}</td>
                        <td className="table-cell font-mono text-xs text-slate-500">
                          {s.personalNumber || <span className="text-amber-400 italic">auto</span>}
                        </td>
                        <td className="table-cell text-xs text-slate-500">{s.birthDate || "—"}</td>
                        <td className="table-cell">
                          {s.klasa
                            ? <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded text-xs font-medium">{s.klasa}</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="table-cell text-xs text-slate-500">
                          {s.motherName
                            ? <span className="text-pink-600 dark:text-pink-400">{s.motherName}</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="table-cell text-xs text-slate-500">{s.motherPhone || "—"}</td>
                        <td className="table-cell text-xs text-slate-500">
                          {s.fatherName
                            ? <span className="text-blue-600 dark:text-blue-400">{s.fatherName}</span>
                            : <span className="text-slate-300">—</span>}
                        </td>
                        <td className="table-cell text-xs text-slate-500">{s.fatherPhone || "—"}</td>
                        <td className="table-cell text-xs text-slate-400 max-w-[160px] truncate">{s.address || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {warningCount > 0 && (
              <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl">
                <p className="text-sm font-medium text-amber-700 dark:text-amber-400 flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {warningCount} nxënës me të dhëna jo të plota — do importohen po ashtu
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                  Fushat që mungojnë mund të plotësohen manualisht më vonë.
                </p>
              </div>
            )}

            <div className="flex items-center justify-end gap-3">
              <button onClick={() => { setStudents([]); setFileName(""); setStep("upload"); }} className="btn-secondary">
                <X className="w-4 h-4" />Anulo
              </button>
              <button onClick={handleImport} disabled={importing || validCount === 0} className="btn-primary">
                {importing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" />Duke importuar...</>
                ) : (
                  <><Upload className="w-4 h-4" />Importo {validCount} Nxënës</>
                )}
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
              <p className="text-slate-400 text-sm">Lista e nxënësve u importua me sukses</p>
            </div>
            <div className="grid grid-cols-2 gap-4 w-full max-w-sm">
              <div className="p-4 bg-green-50 dark:bg-green-900/20 rounded-xl">
                <p className="text-3xl font-bold text-green-600">{result.created}</p>
                <p className="text-sm text-green-700 dark:text-green-400 mt-1">Nxënës të shtuar</p>
              </div>
              <div className="p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <p className="text-3xl font-bold text-slate-500">{result.skipped}</p>
                <p className="text-sm text-slate-500 mt-1">U kapërcyen</p>
              </div>
            </div>
            {result.errors.length > 0 && (
              <div className="w-full p-4 bg-red-50 dark:bg-red-900/20 rounded-xl text-left">
                <p className="text-sm font-medium text-red-700 dark:text-red-400 mb-2">Gabime:</p>
                {result.errors.map((e, i) => <p key={i} className="text-xs text-red-600 dark:text-red-400">• {e}</p>)}
              </div>
            )}
            <div className="flex gap-3">
              <button onClick={() => { setStudents([]); setFileName(""); setResult(null); setStep("upload"); }} className="btn-secondary">
                <Upload className="w-4 h-4" />Import tjetër
              </button>
              <Link href="/students" className="btn-primary">
                <CheckCircle className="w-4 h-4" />Shiko Nxënësit
              </Link>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
