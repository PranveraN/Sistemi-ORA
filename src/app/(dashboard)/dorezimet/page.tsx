"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { Printer, ArrowRightLeft, Info, Loader2 } from "lucide-react";
import { formatCurrency, formatDate, MONTHS } from "@/lib/utils";
import { ACADEMIC_YEARS, DEFAULT_ACADEMIC_YEAR } from "@/lib/academicYear";
import ExportExcelButton from "@/components/ui/ExportExcelButton";
import { xlDate } from "@/lib/exportExcel";

// "Dorëzimet" — pasqyrë VETËM PËR SHIKIM e të gjitha dorëzimeve (Shkollimi,
// Ushqimi, Eshkollori…). Dorëzimet regjistrohen vetëm te skeda "Dorëzim parash"
// e çdo kategorie — që të llogariten në arkë dhe të mos regjistrohen dy herë.

interface Category { id: number; name: string }
interface Row {
  id: number; source: "TAB" | "OLD"; date: string; categoryId: number | null; categoryName: string;
  amount: number; recipient: string | null; description: string | null; method: string | null; reference: string | null;
}
// Forma që përdor dëshmia e printimit
interface Handover {
  id: number; amount: number; description: string | null; recipient: string | null;
  method: string; reference: string | null; handoverAt: string; category: { id: number; name: string } | null;
}

const METHOD_LABEL: Record<string, string> = { CASH: "Cash", BANK: "Bankë / Transfer", CARD: "Kartë", ONLINE: "Online" };
const TAB_LINK: Record<string, string> = { Shkollimi: "/shkollimi?tab=handover", Ushqimi: "/ushqimi", "Platforma Digjitale": "/eshkollori" };

function printHandoverReceipt(h: Handover) {
  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html lang="sq"><head><meta charset="UTF-8"/><title>Dëshmi Dorëzimi</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI',Arial,sans-serif; font-size:13px; color:#0f172a; padding:32px 24px; max-width:360px; }
h1 { font-size:18px; font-weight:700; }
.sub { color:#64748b; font-size:11px; }
hr { border:none; border-top:1px dashed #cbd5e1; margin:14px 0; }
.row { display:flex; justify-content:space-between; padding:4px 0; }
.label { color:#64748b; }
.amount { font-size:20px; font-weight:700; color:#0f172a; }
.sig-area { display:flex; justify-content:space-between; margin-top:32px; }
.sig-box { text-align:center; }
.sig-line { border-bottom:1px solid #0f172a; width:120px; margin-top:40px; }
</style></head><body>
<div style="text-align:center;margin-bottom:20px">
  <h1>Akademia Ora</h1>
  <p class="sub">Dëshmi Dorëzimi${h.category ? ` — ${h.category.name}` : ""}</p>
  <p class="sub">${new Date(h.handoverAt).toLocaleDateString("sq-AL", { dateStyle: "long" })}</p>
</div>
<hr/>
<div class="row"><span class="label">Data:</span><span>${formatDate(h.handoverAt)}</span></div>
${h.category ? `<div class="row"><span class="label">Kategoria:</span><span>${h.category.name}</span></div>` : ""}
${h.recipient ? `<div class="row"><span class="label">Marrësi:</span><span>${h.recipient}</span></div>` : ""}
<div class="row"><span class="label">Mënyra:</span><span>${METHOD_LABEL[h.method] ?? h.method}</span></div>
${h.reference ? `<div class="row"><span class="label">Referenca:</span><span>${h.reference}</span></div>` : ""}
${h.description ? `<div class="row"><span class="label">Shënim:</span><span>${h.description}</span></div>` : ""}
<hr/>
<div style="text-align:center;padding:16px 0">
  <p class="sub" style="margin-bottom:4px">SHUMA E DORËZUAR</p>
  <p class="amount">${formatCurrency(h.amount)}</p>
</div>
<hr/>
<div class="sig-area">
  <div class="sig-box"><div class="sig-line"></div><p class="sub" style="margin-top:6px">Dhënësi</p></div>
  <div class="sig-box"><div class="sig-line"></div><p class="sub" style="margin-top:6px">Marrësi</p></div>
</div>
</body></html>`);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 300);
}

const toHandover = (r: Row): Handover => ({
  id: r.id, amount: r.amount, description: r.description, recipient: r.recipient, method: r.method ?? "CASH",
  reference: r.reference, handoverAt: r.date, category: r.categoryId ? { id: r.categoryId, name: r.categoryName } : null,
});

export default function DorezimetPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryFilter, setCategoryFilter] = useState("");
  const [year, setYear] = useState(DEFAULT_ACADEMIC_YEAR);
  const [month, setMonth] = useState(0);
  const [rows, setRows] = useState<Row[]>([]);
  const [legacy, setLegacy] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/categories").then(r => r.json()).then(setCategories).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true); setError("");
    const p = new URLSearchParams({ year: String(year), yearType: "academic" });
    if (categoryFilter) p.set("categoryId", categoryFilter);
    // Muaji brenda vitit akademik: Shtator–Dhjetor = viti fillestar, Janar–Gusht = viti tjetër
    if (month > 0) { p.set("month", String(month)); p.set("year", String(month >= 9 ? year : year + 1)); p.set("yearType", "calendar"); }
    fetch(`/api/handovers?${p}`)
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Gabim"); setRows(d.rows); setLegacy(d.legacy); })
      .catch(e => setError(e instanceof Error ? e.message : "Dorëzimet s'u ngarkuan."))
      .finally(() => setLoading(false));
  }, [categoryFilter, year, month]);

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const byCategory = useMemo(() => {
    const m = new Map<string, { name: string; total: number; count: number }>();
    for (const r of rows) { const c = m.get(r.categoryName) ?? { name: r.categoryName, total: 0, count: 0 }; c.total += r.amount; c.count++; m.set(r.categoryName, c); }
    return [...m.values()].sort((a, b) => b.total - a.total);
  }, [rows]);
  const periodLabel = `${month > 0 ? `${MONTHS[month - 1]} ` : ""}${year}–${year + 1}`;

  const columns = [
    { header: "Data", value: (r: Row) => xlDate(r.date) },
    { header: "Kategoria", value: (r: Row) => r.categoryName },
    { header: "Dorëzuar tek", value: (r: Row) => r.recipient ?? "", width: 24 },
    { header: "Mënyra", value: (r: Row) => (r.method ? METHOD_LABEL[r.method] ?? r.method : "") },
    { header: "Referenca", value: (r: Row) => r.reference ?? "" },
    { header: "Shënim", value: (r: Row) => r.description ?? "", width: 30 },
    { header: "Shuma (€)", value: (r: Row) => r.amount },
  ];

  return (
    <>
      <Header title="Dorëzimet" />
      <div className="p-4 sm:p-6 space-y-5 animate-fade-in">
        <div className="flex flex-wrap items-center gap-3">
          <div>
            <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <ArrowRightLeft className="w-5 h-5 text-primary-500" /> Dorëzimet — të gjitha kategoritë
            </h1>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">Vetëm për shikim · {periodLabel}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 ml-auto">
            <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)} className="form-input w-48" aria-label="Kategoria">
              <option value="">Të gjitha kategoritë</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="form-input w-36" aria-label="Muaji">
              <option value={0}>Të gjithë muajt</option>
              {[9, 10, 11, 12, 1, 2, 3, 4, 5, 6, 7, 8].map(m => <option key={m} value={m}>{MONTHS[m - 1]}</option>)}
            </select>
            <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="form-input w-32" aria-label="Viti shkollor">
              {ACADEMIC_YEARS.map(y => <option key={y} value={y}>{y}–{y + 1}</option>)}
            </select>
            <ExportExcelButton<Row> fileName={`Dorezimet-${periodLabel}`} rows={rows} columns={columns} />
          </div>
        </div>

        <p className="flex items-start gap-2 rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 px-4 py-2.5 text-sm text-blue-900 dark:text-blue-200">
          <Info className="w-4 h-4 mt-0.5 shrink-0" aria-hidden />
          <span>
            Dorëzimet regjistrohen te skeda <b>&quot;Dorëzim parash&quot;</b> e çdo kategorie:{" "}
            <Link href="/shkollimi?tab=handover" className="underline font-semibold">Shkollimi</Link>,{" "}
            <Link href="/ushqimi" className="underline font-semibold">Ushqimi</Link>,{" "}
            <Link href="/eshkollori" className="underline font-semibold">Eshkollori</Link>. Këtu shihen të gjitha bashkë.
          </span>
        </p>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="card p-4">
            <p className="text-xs text-slate-500 dark:text-slate-400">Gjithsej i dorëzuar</p>
            <p className="text-2xl font-bold text-green-700 dark:text-green-400">{formatCurrency(total)}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{rows.length} dorëzime</p>
          </div>
          {byCategory.map(c => (
            <div key={c.name} className="card p-4">
              <p className="text-xs text-slate-500 dark:text-slate-400">{c.name}</p>
              <p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(c.total)}</p>
              <p className="text-xs text-slate-500 dark:text-slate-400">{c.count} dorëzime</p>
            </div>
          ))}
        </div>

        <div className="card overflow-x-auto">
          <table className="w-full min-w-[820px] text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60">
                <th className="px-4 py-2.5">Data</th><th className="px-4 py-2.5">Kategoria</th><th className="px-4 py-2.5 text-right">Shuma</th>
                <th className="px-4 py-2.5">Mënyra</th><th className="px-4 py-2.5">Dorëzuar tek</th><th className="px-4 py-2.5">Referenca</th>
                <th className="px-4 py-2.5">Shënim</th><th className="px-4 py-2.5"><span className="sr-only">Printo</span></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {error ? <tr><td colSpan={8} className="px-4 py-10 text-center text-red-600">{error}</td></tr>
                : loading ? <tr><td colSpan={8} className="px-4 py-10 text-center"><Loader2 className="w-5 h-5 animate-spin inline text-primary-400" /></td></tr>
                : rows.length === 0 ? <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-500">Nuk ka dorëzime për {periodLabel}.</td></tr>
                : rows.map(r => (
                  <tr key={`${r.source}${r.id}`} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40">
                    <td className="px-4 py-2.5 whitespace-nowrap">{formatDate(r.date)}</td>
                    <td className="px-4 py-2.5">
                      {TAB_LINK[r.categoryName]
                        ? <Link href={TAB_LINK[r.categoryName]} className="text-primary-700 dark:text-primary-300 hover:underline">{r.categoryName}</Link>
                        : r.categoryName}
                    </td>
                    <td className="px-4 py-2.5 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">{formatCurrency(r.amount)}</td>
                    <td className="px-4 py-2.5">{r.method ? METHOD_LABEL[r.method] ?? r.method : "—"}</td>
                    <td className="px-4 py-2.5">{r.recipient ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{r.reference ?? "—"}</td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{r.description ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right">
                      <button type="button" onClick={() => printHandoverReceipt(toHandover(r))} aria-label="Printo dëshminë e dorëzimit"
                        className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"><Printer className="w-4 h-4" /></button>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>

        {legacy.length > 0 && (
          <section className="card p-4 space-y-2">
            <h2 className="text-sm font-bold text-slate-700 dark:text-slate-200">Dorëzime të regjistruara dikur te kjo faqe ({legacy.length})</h2>
            <p className="text-xs text-slate-500">Këto s&apos;llogariten në arkë. Nëse janë dorëzime të vërteta, regjistrojini te skeda &quot;Dorëzim parash&quot; e kategorisë përkatëse.</p>
            <ul className="text-sm divide-y divide-slate-100 dark:divide-slate-700">
              {legacy.map(r => <li key={`O${r.id}`} className="py-1.5 flex justify-between gap-3"><span>{formatDate(r.date)} · {r.categoryName} · {r.recipient ?? "—"}</span><b>{formatCurrency(r.amount)}</b></li>)}
            </ul>
          </section>
        )}
      </div>
    </>
  );
}
