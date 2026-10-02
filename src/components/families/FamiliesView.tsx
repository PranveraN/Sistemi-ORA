"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Header from "@/components/layout/Header";
import YearPicker from "@/components/dashboard/YearPicker";
import { ACADEMIC_YEARS, DEFAULT_ACADEMIC_YEAR } from "@/lib/academicYear";
import { formatCurrency } from "@/lib/utils";
import { useModuleAccess } from "@/lib/useModuleAccess";
import { Search, Download, Plus, Users, AlertCircle, Loader2, Info } from "lucide-react";
import FamilyProfile, { initialsOf } from "./FamilyProfile";

interface Row {
  id: number; label: string; contactName: string | null; childCount: number; debt: number | null;
  children: { id: number; firstName: string; className: string | null; classId: number | null }[];
}
interface ListResponse {
  rows: Row[]; total: number; page: number; counts: { total: number; multi: number; debt: number };
  year: number; unlinked: number; showFinance: boolean;
}
interface ClassOpt { id: number; name: string }

const LIMIT = 30;

function useDebounced<T>(v: T, ms = 300) {
  const [d, setD] = useState(v);
  useEffect(() => { const t = setTimeout(() => setD(v), ms); return () => clearTimeout(t); }, [v, ms]);
  return d;
}

// "Familjet" — lista majtas, profili i familjes së zgjedhur djathtas (master-detail).
// Familja e zgjedhur është në URL (/families/:id). Në telefon: lista ose profili.
export default function FamiliesView({ selectedId }: { selectedId: number | null }) {
  const router = useRouter();
  const sp = useSearchParams();
  const { canAccess } = useModuleAccess();

  const [qInput, setQInput] = useState(sp.get("q") || sp.get("phone") || sp.get("name") || "");
  const q = useDebounced(qInput);
  const [filter, setFilter] = useState(sp.get("filter") || "all");
  const [classId, setClassId] = useState(sp.get("cl") || "");
  const [year, setYear] = useState(parseInt(sp.get("y") || "") || DEFAULT_ACADEMIC_YEAR);
  const [rows, setRows] = useState<Row[]>([]);
  const [meta, setMeta] = useState<Omit<ListResponse, "rows"> | null>(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [classes, setClasses] = useState<ClassOpt[]>([]);
  const [exporting, setExporting] = useState(false);

  const params = useMemo(() => {
    const p = new URLSearchParams({ year: String(year), filter, limit: String(LIMIT) });
    if (q.trim()) p.set("q", q.trim());
    if (classId) p.set("classId", classId);
    return p;
  }, [year, filter, q, classId]);

  const qs = useMemo(() => {
    const u = new URLSearchParams();
    if (q.trim()) u.set("q", q.trim());
    if (filter !== "all") u.set("filter", filter);
    if (classId) u.set("cl", classId);
    if (year !== DEFAULT_ACADEMIC_YEAR) u.set("y", String(year));
    const s = u.toString();
    return s ? `?${s}` : "";
  }, [q, filter, classId, year]);

  // Filtrat në URL (familja e zgjedhur mbetet në shteg)
  useEffect(() => {
    router.replace(`${selectedId ? `/families/${selectedId}` : "/families"}${qs}`, { scroll: false });
  }, [qs, selectedId, router]);

  const load = useCallback(async (pg: number, append: boolean) => {
    setError("");
    try {
      const p = new URLSearchParams(params);
      p.set("page", String(pg));
      const r = await fetch(`/api/families/list?${p}`);
      const d: ListResponse & { error?: string } = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Ngarkimi dështoi."); return; }
      setRows(prev => (append ? [...prev, ...d.rows] : d.rows));
      setMeta(d);
      setPage(pg);
    } catch { setError("Gabim rrjeti — provo përsëri."); }
    finally { setLoading(false); }
  }, [params]);
  useEffect(() => { load(1, false); }, [load]);

  // Kërkimi nga një faqe tjetër (?phone=) — hap direkt familjen e vetme të gjetur
  useEffect(() => {
    if (!selectedId && (sp.get("phone") || sp.get("name")) && rows.length === 1) router.replace(`/families/${rows[0].id}${qs}`);
  }, [rows, selectedId, sp, router, qs]);

  useEffect(() => {
    fetch("/api/classes").then(r => (r.ok ? r.json() : [])).then((c: ClassOpt[]) =>
      setClasses([...c].sort((a, b) => a.name.localeCompare(b.name, "sq", { numeric: true })))).catch(() => {});
  }, []);

  async function exportFamilies() {
    // Eksporti ekzistues (i pandryshuar) — i njëjti si "Exporto Familjet" te Nxënësit
    setExporting(true);
    try {
      const [{ default: XLSX }, catRes] = await Promise.all([import("xlsx").then(m => ({ default: m })), fetch("/api/categories")]);
      const cats: { name: string; defaultAmount: number }[] = catRes.ok ? await catRes.json() : [];
      const base = cats.find(c => c.name === "Shkollimi")?.defaultAmount ?? 2000;
      const res = await fetch(`/api/reports/families?basePrice=${base}`);
      const { families } = await res.json();
      type Child = { firstName: string; lastName: string; class: string; discountPct: number; finalPrice: number; paid: number; debt: number };
      type Fam = { lastName: string; fatherName: string | null; motherName: string | null; phone: string; childCount: number; children: Child[]; totalFinalPrice: number; totalPaid: number; totalDebt: number };
      const out: (string | number)[][] = [["FAMILJA", "FËMIJA", "KLASA", "ZBRITJA", "ÇMIMI FINAL", "PAGUAR", "BORXHI"]];
      for (const f of families as Fam[]) {
        out.push([`Familja ${f.lastName}${f.phone ? ` — ${f.phone}` : ""}`, [f.fatherName, f.motherName].filter(Boolean).join(" & ") || "—", "", "", "", "", ""]);
        for (const c of f.children) out.push(["", `${c.firstName} ${c.lastName}`, c.class, c.discountPct > 0 ? `-${c.discountPct}%` : "", c.finalPrice, c.paid, c.debt]);
        out.push(["", "TOTAL FAMILJA", "", "", f.totalFinalPrice, f.totalPaid, f.totalDebt]);
        out.push(["", "", "", "", "", "", ""]);
      }
      const ws = XLSX.utils.aoa_to_sheet(out);
      ws["!cols"] = [{ wch: 36 }, { wch: 22 }, { wch: 8 }, { wch: 8 }, { wch: 14 }, { wch: 12 }, { wch: 12 }];
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Familjet");
      XLSX.writeFile(wb, `Familjet-${new Date().toISOString().split("T")[0]}.xlsx`);
    } catch { alert("Eksporti dështoi."); }
    finally { setExporting(false); }
  }

  const select = (id: number) => router.push(`/families/${id}${qs}`);
  const showFinance = meta?.showFinance ?? false;
  const chip = (active: boolean) => `px-2.5 py-1 rounded-lg text-xs font-medium border ${active ? "bg-primary-600 border-primary-600 text-white" : "bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 hover:border-primary-300"}`;

  return (
    <>
      <Header title="Familjet" />
      <div className="p-4 sm:p-6 space-y-4 animate-fade-in">
        {/* ── Koka ── */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900 dark:text-white">Familjet</h1>
            <YearPicker years={ACADEMIC_YEARS} year={year} yearType="academic" onSelect={y => setYear(y)} />
          </div>
          <div className="flex gap-2">
            {canAccess("/students") && (
              <button onClick={exportFamilies} disabled={exporting} className="btn-secondary"><Download className="w-4 h-4" /> Eksporto familjet</button>
            )}
            {canAccess("/students") && <Link href="/students/new" className="btn-primary"><Plus className="w-4 h-4" /> Shto familje</Link>}
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-stretch">
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input value={qInput} onChange={e => setQInput(e.target.value)} className="form-input pl-11 py-3 text-base"
              placeholder="Kërko prind, fëmijë ose numër telefoni…" aria-label="Kërko familjen" />
          </div>
          <div className="card px-4 py-2 flex items-center gap-3 min-w-[120px]">
            <Users className="w-4 h-4 text-primary-500" />
            <div><p className="text-lg font-bold leading-tight">{meta?.counts.total ?? "—"}</p><p className="text-[11px] text-slate-400">Familje</p></div>
          </div>
          <button type="button" onClick={() => setFilter(f => (f === "multi" ? "all" : "multi"))} aria-pressed={filter === "multi"}
            className={`card px-4 py-2 flex items-center gap-3 min-w-[120px] text-left border-2 ${filter === "multi" ? "border-primary-500" : "border-transparent"}`}>
            <Users className="w-4 h-4 text-blue-500" />
            <div><p className="text-lg font-bold leading-tight">{meta?.counts.multi ?? "—"}</p><p className="text-[11px] text-slate-400">Me 2+ fëmijë</p></div>
          </button>
          {showFinance && (
            <button type="button" onClick={() => setFilter(f => (f === "debt" ? "all" : "debt"))} aria-pressed={filter === "debt"}
              className={`card px-4 py-2 flex items-center gap-3 min-w-[120px] text-left border-2 ${filter === "debt" ? "border-primary-500" : "border-transparent"}`}>
              <AlertCircle className="w-4 h-4 text-red-500" />
              <div><p className="text-lg font-bold leading-tight text-red-600">{meta?.counts.debt ?? "—"}</p><p className="text-[11px] text-slate-400">Me borxh</p></div>
            </button>
          )}
        </div>

        {(meta?.unlinked ?? 0) > 0 && (
          <p className="text-xs text-orange-600 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" />
            {meta!.unlinked} nxënës aktivë s&apos;janë lidhur ende me familje — Super Admin: "Lidh nxënësit me familjet" te paneli i Super Admin.</p>
        )}

        <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
          {/* ── Lista ── */}
          <div className={`card overflow-hidden flex flex-col ${selectedId ? "hidden lg:flex" : ""}`}>
            <div className="flex flex-wrap items-center gap-1.5 p-3 border-b border-slate-100 dark:border-slate-700">
              <button className={chip(filter === "all")} onClick={() => setFilter("all")}>Të gjitha</button>
              {showFinance && <button className={chip(filter === "debt")} onClick={() => setFilter("debt")}>Me borxh</button>}
              <button className={chip(filter === "multi")} onClick={() => setFilter("multi")}>2+ fëmijë</button>
              <select value={classId} onChange={e => setClassId(e.target.value)} className="ml-auto text-xs px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800" aria-label="Klasa">
                <option value="">Klasa</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="flex-1 overflow-y-auto max-h-[calc(100vh-280px)] divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <div className="p-8 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>
              ) : error ? (
                <p className="p-6 text-sm text-red-500">{error}</p>
              ) : rows.length === 0 ? (
                <p className="p-6 text-sm text-slate-400 text-center">Asnjë familje me këto kritere.</p>
              ) : rows.map(r => {
                const active = r.id === selectedId;
                return (
                  <button key={r.id} onClick={() => select(r.id)} aria-current={active ? "true" : undefined}
                    className={`w-full text-left px-3 py-2.5 flex items-center gap-3 border-l-4 transition-colors ${active ? "bg-primary-50 dark:bg-primary-900/20 border-primary-600" : "border-transparent hover:bg-slate-50 dark:hover:bg-slate-800/40"}`}>
                    <span className="w-9 h-9 rounded-lg bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-bold text-sm flex items-center justify-center shrink-0">{initialsOf(r.label)}</span>
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-slate-900 dark:text-white truncate">Familja {r.label}</span>
                      {r.contactName && <span className="block text-xs text-slate-500 truncate">{r.contactName}</span>}
                      <span className="block text-[11px] text-slate-400 truncate">{r.children.map(c => `${c.firstName}${c.className ? ` ${c.className}` : ""}`).join(" · ")}</span>
                    </span>
                    {r.debt != null && (
                      r.debt > 0.005
                        ? <span className="text-xs font-semibold text-red-600 shrink-0">{formatCurrency(r.debt)}</span>
                        : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-400 shrink-0">Paguar</span>
                    )}
                  </button>
                );
              })}
            </div>
            {meta && rows.length < meta.total && (
              <button onClick={() => load(page + 1, true)} className="m-3 btn-secondary text-sm justify-center">Më shumë ({meta.total - rows.length})</button>
            )}
          </div>

          {/* ── Profili ── */}
          <div className={selectedId ? "" : "hidden lg:block"}>
            {selectedId ? (
              <FamilyProfile key={selectedId} familyId={selectedId} year={year} onBack={() => router.push(`/families${qs}`)} onChanged={() => load(1, false)} />
            ) : (
              <div className="card p-8 text-center space-y-2">
                <Users className="w-10 h-10 text-primary-300 mx-auto" />
                <p className="font-semibold text-slate-700 dark:text-slate-200">{meta?.counts.total ?? 0} familje · {meta?.counts.multi ?? 0} me 2+ fëmijë{showFinance ? ` · ${meta?.counts.debt ?? 0} me borxh` : ""}</p>
                <p className="text-sm text-slate-400">Zgjidh një familje nga lista për të parë profilin e plotë.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
