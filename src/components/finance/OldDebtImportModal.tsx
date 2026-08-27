"use client";

import { useState } from "react";
import { X, Upload, FileSpreadsheet, Download, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { DEFAULT_ACADEMIC_YEAR } from "@/lib/academicYear";

interface Props {
  categoryId: number;
  onClose: () => void;
  onImported: () => void;
}

interface ParsedRow {
  firstName: string;
  lastName: string;
  amount: number;
  note: string;
  _matchedId: number | null;
  _matchedName: string;
}

export default function OldDebtImportModal({ categoryId, onClose, onImported }: Props) {
  const [step, setStep] = useState<"upload" | "preview" | "done">("upload");
  const [year, setYear] = useState(DEFAULT_ACADEMIC_YEAR - 1);
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<{ created: number; updated: number; skipped: number; errors: string[] } | null>(null);

  async function downloadTemplate() {
    const XLSX = await import("xlsx");
    const headers = ["Emri", "Mbiemri", "Shuma e Borxhit", "Koment"];
    const example = ["Ardit", "Berisha", "50", "Borxh i vjetër nga viti 2024-2025"];
    const ws = XLSX.utils.aoa_to_sheet([headers, example]);
    ws["!cols"] = [{ wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 30 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Borxhi i vjetër");
    XLSX.writeFile(wb, "Template-Borxhi-i-Vjeter.xlsx");
  }

  async function parseAndMatch(file: File) {
    const XLSX = await import("xlsx");
    const buffer = await file.arrayBuffer();
    const wb = XLSX.read(buffer, { type: "array" });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });
    if (!raw.length) return;

    const headerMap: Record<string, string> = {};
    for (const key of Object.keys(raw[0])) {
      const orig = key.toLowerCase().trim();
      if (orig === "emri" || (orig.includes("emri") && !orig.includes("mbiemri"))) headerMap[key] = "firstName";
      else if (orig.includes("mbiemri")) headerMap[key] = "lastName";
      else if (orig.includes("borxh") || orig.includes("shuma") || orig.includes("debt")) headerMap[key] = "amount";
      else if (orig.includes("koment") || orig.includes("shenim") || orig.includes("comment")) headerMap[key] = "note";
    }

    const studRes = await fetch("/api/students?limit=10000");
    const studData = await studRes.json();
    const allStudents: { id: number; firstName: string; lastName: string; personalNumber: string | null }[] =
      studData.students || [];

    const parsed: ParsedRow[] = raw.map(row => {
      const m: Record<string, string> = {};
      for (const [origKey, mappedKey] of Object.entries(headerMap)) {
        m[mappedKey] = String(row[origKey] ?? "").trim();
      }
      const fn = m.firstName || "";
      const ln = m.lastName || "";
      if (!fn && !ln) return null;

      const amount = parseFloat(m.amount || "0") || 0;

      const matched = allStudents.find(
        s => s.firstName.toLowerCase() === fn.toLowerCase() && s.lastName.toLowerCase() === ln.toLowerCase()
      ) || allStudents.find(
        s => s.lastName.toLowerCase() === fn.toLowerCase() && s.firstName.toLowerCase() === ln.toLowerCase()
      );

      return {
        firstName: fn,
        lastName: ln,
        amount,
        note: m.note || "",
        _matchedId: matched?.id ?? null,
        _matchedName: matched ? `${matched.firstName} ${matched.lastName}` : "",
      };
    }).filter(Boolean) as ParsedRow[];

    setRows(parsed);
    setFileName(file.name);
    setStep("preview");
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) parseAndMatch(file);
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) parseAndMatch(file);
  }

  async function handleImport() {
    const toImport = rows.filter(r => r._matchedId && r.amount > 0);
    if (!toImport.length) return;
    setImporting(true);
    const res = await fetch("/api/category-payments/old-debt", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        categoryId,
        year,
        rows: toImport.map(r => ({ studentId: r._matchedId, amount: r.amount, note: r.note || undefined })),
      }),
    });
    setResult(await res.json());
    setImporting(false);
    setStep("done");
  }

  const matched = rows.filter(r => r._matchedId && r.amount > 0).length;
  const unmatched = rows.length - matched;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl w-full max-w-2xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-800 dark:text-white">Importo Borxhin e Vjetër</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-4">
          {step === "upload" && (
            <>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Ngarko një listë Excel me emrat e nxënësve që kanë borxh nga një vit i mëparshëm dhe shumën.
                Borxhi do të shfaqet si shënim pranë emrit të secilit dhe do të shlyhet automatikisht kur regjistrohet një pagesë kundrejt tij.
              </p>

              <div className="flex items-center gap-2">
                <label className="text-sm text-slate-600 dark:text-slate-300 font-medium">Viti i borxhit:</label>
                <input
                  type="number"
                  value={year}
                  onChange={e => setYear(parseInt(e.target.value) || year)}
                  className="form-input w-28 text-sm"
                />
                <span className="text-xs text-slate-400">(p.sh. {year} = viti akademik {year}-{year + 1})</span>
              </div>

              <button onClick={downloadTemplate} className="btn-secondary text-sm">
                <Download className="w-4 h-4" />
                Shkarko Shabllonin
              </button>

              <div
                onDragOver={e => { e.preventDefault(); setDragging(true); }}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-colors ${
                  dragging ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20" : "border-slate-200 dark:border-slate-600"
                }`}
              >
                <Upload className="w-8 h-8 mx-auto text-slate-300 mb-2" />
                <p className="text-sm text-slate-500 dark:text-slate-400 mb-2">Tërhiq skedarin Excel këtu, ose</p>
                <label className="btn-secondary text-sm inline-flex cursor-pointer">
                  <FileSpreadsheet className="w-4 h-4" />
                  Zgjidh Skedarin
                  <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileInput} />
                </label>
              </div>
            </>
          )}

          {step === "preview" && (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500 dark:text-slate-400">{fileName}</span>
                <span>
                  <span className="text-emerald-600 font-medium">{matched} u përputhën</span>
                  {unmatched > 0 && <span className="text-red-500 font-medium ml-2">{unmatched} pa u gjetur</span>}
                </span>
              </div>

              <div className="border border-slate-100 dark:border-slate-700 rounded-lg overflow-hidden max-h-80 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-700/50 sticky top-0">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Nxënësi</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Borxhi</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 dark:text-slate-400">Statusi</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, i) => (
                      <tr key={i} className="border-t border-slate-50 dark:border-slate-700/50">
                        <td className="px-3 py-2 text-slate-700 dark:text-slate-200">{r.firstName} {r.lastName}</td>
                        <td className="px-3 py-2 text-right font-medium">{formatCurrency(r.amount)}</td>
                        <td className="px-3 py-2">
                          {r._matchedId ? (
                            <span className="inline-flex items-center gap-1 text-emerald-600 text-xs">
                              <CheckCircle className="w-3.5 h-3.5" /> U gjet
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-red-500 text-xs">
                              <AlertCircle className="w-3.5 h-3.5" /> Nuk u gjet
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          {step === "done" && result && (
            <div className="text-center py-4 space-y-3">
              <CheckCircle className="w-10 h-10 text-emerald-500 mx-auto" />
              <p className="font-semibold text-slate-800 dark:text-white">Importi u krye</p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                {result.created} të reja, {result.updated} të përditësuara, {result.skipped} të kaluara
              </p>
              {result.errors.length > 0 && (
                <div className="text-left text-xs text-red-500 bg-red-50 dark:bg-red-900/20 rounded-lg p-3 max-h-32 overflow-y-auto">
                  {result.errors.map((e, i) => <p key={i}>{e}</p>)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 dark:border-slate-700">
          {step === "upload" && (
            <button onClick={onClose} className="btn-secondary text-sm">Anulo</button>
          )}
          {step === "preview" && (
            <>
              <button onClick={() => setStep("upload")} className="btn-secondary text-sm">Kthehu</button>
              <button onClick={handleImport} disabled={!matched || importing} className="btn-primary text-sm disabled:opacity-50">
                {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Importo {matched} nxënës
              </button>
            </>
          )}
          {step === "done" && (
            <button onClick={() => { onImported(); onClose(); }} className="btn-primary text-sm">Mbyll</button>
          )}
        </div>
      </div>
    </div>
  );
}
