"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/layout/Header";
import Link from "next/link";
import { formatDate, getStatusColor, getStatusLabel, formatCurrency } from "@/lib/utils";
import {
  UserPlus, Search, ChevronLeft, ChevronRight,
  Eye, Edit, Users, AlertCircle, Upload, FileSignature, Trash2, Download,
} from "lucide-react";
import * as XLSX from "xlsx";


interface Class {
  id: number;
  name: string;
  level: string;
}

interface Student {
  id: number;
  firstName: string;
  lastName: string;
  parentName: string | null;
  parentPhone: string | null;
  personalNumber: string | null;
  diaryNumber: string | null;
  kontrata: string | null;
  discountPct: number;
  status: string;
  enrollDate: string;
  class: { name: string; level: string } | null;
  payments: { balance: number; paidAmount: number }[];
}

export default function StudentsPage() {
  const searchParams = useSearchParams();
  const classIdParam = searchParams.get("classId") || "";

  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [debtCount, setDebtCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [classId, setClassId] = useState(classIdParam);
  const [classes, setClasses] = useState<Class[]>([]);
  const [page, setPage] = useState(1);
  const [tuitionPrice, setTuitionPrice] = useState<number>(2000);
  const limit = 20;

  useEffect(() => {
    Promise.all([
      fetch("/api/classes").then(r => r.json()),
      fetch("/api/categories").then(r => r.json()),
    ]).then(([classData, catData]) => {
      setClasses([...classData].sort((a: Class, b: Class) => {
        const na = parseInt(a.name), nb = parseInt(b.name);
        if (na !== nb) return na - nb;
        return a.name.localeCompare(b.name);
      }));
      const shkollimi = (catData as { name: string; defaultAmount: number }[]).find(c => c.name === "Shkollimi");
      if (shkollimi?.defaultAmount) setTuitionPrice(shkollimi.defaultAmount);
    });
  }, []);

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({
      search, status, page: String(page), limit: String(limit),
    });
    if (classId) params.set("classId", classId);
    const res = await fetch(`/api/students?${params}`);
    const data = await res.json();
    const sorted = (data.students || []).sort((a: Student, b: Student) =>
      a.firstName.localeCompare(b.firstName, "sq", { sensitivity: "base" }) ||
      a.lastName.localeCompare(b.lastName, "sq", { sensitivity: "base" })
    );
    setStudents(sorted);
    setTotal(data.total);
    setActiveCount(data.activeCount ?? 0);
    setDebtCount(data.debtCount ?? 0);
    setLoading(false);
  }, [search, status, page, classId]);


  const _firstRender = useRef(true);
  useEffect(() => {
    const delay = _firstRender.current ? 0 : 300;
    _firstRender.current = false;
    const timer = setTimeout(fetchStudents, delay);
    return () => clearTimeout(timer);
  }, [fetchStudents]);


  const totalPages = Math.ceil(total / limit);
  const finalPrice  = (s: Student) => Math.round(tuitionPrice * (1 - s.discountPct / 100));
  const totalPaid   = (s: Student) => s.payments.reduce((sum, p) => sum + p.paidAmount, 0);
  const totalDebt   = (s: Student) => Math.max(0, finalPrice(s) - totalPaid(s));

  async function handleExportFamilies() {
    const res = await fetch(`/api/reports/families?basePrice=${tuitionPrice}`);
    const { families } = await res.json();

    type Child = { firstName: string; lastName: string; class: string; discountPct: number; finalPrice: number; paid: number; debt: number };
    type Family = { lastName: string; fatherName: string | null; motherName: string | null; phone: string; childCount: number; children: Child[]; totalFinalPrice: number; totalPaid: number; totalDebt: number };

    const rows: (string | number)[][] = [];

    // Header kryesor
    rows.push(["FAMILJA", "FËMIJA", "KLASA", "ZBRITJA", "ÇMIMI FINAL", "PAGUAR", "BORXHI"]);

    for (const fam of families as Family[]) {
      const parentInfo = [fam.fatherName, fam.motherName].filter(Boolean).join(" & ") || "—";
      const famLabel = `Familja ${fam.lastName}${fam.phone ? ` — ${fam.phone}` : ""}`;

      // Rreshti i familjes (header)
      rows.push([famLabel, parentInfo, "", "", "", "", ""]);

      // Fëmijët
      for (const c of fam.children) {
        rows.push([
          "",
          `${c.firstName} ${c.lastName}`,
          c.class,
          c.discountPct > 0 ? `-${c.discountPct}%` : "",
          c.finalPrice,
          c.paid,
          c.debt,
        ]);
      }

      // Total familjes
      rows.push(["", "TOTAL FAMILJA", "", "", fam.totalFinalPrice, fam.totalPaid, fam.totalDebt]);
      // Ndarës bosh
      rows.push(["", "", "", "", "", "", ""]);
    }

    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [
      { wch: 36 }, { wch: 22 }, { wch: 8 }, { wch: 8 },
      { wch: 14 }, { wch: 12 }, { wch: 12 },
    ];

    // Stil header kryesor
    for (let c = 0; c < 7; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
      if (cell) cell.s = { font: { bold: true } };
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Familjet");

    // Sheet 2: Përmbledhje
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

  async function handleExport() {
    // Merr TË GJITHË nxënësit me filtrat aktualë (pa paginim)
    const params = new URLSearchParams({ search, status, limit: "2000" });
    if (classId) params.set("classId", classId);
    const res = await fetch(`/api/students?${params}`);
    const data = await res.json();
    const all: Student[] = (data.students || []).sort((a: Student, b: Student) =>
      a.lastName.localeCompare(b.lastName, "sq") || a.firstName.localeCompare(b.firstName, "sq")
    );

    const rows = all.map((s, i) => {
      const fp   = finalPrice(s);
      const paid = totalPaid(s);
      const debt = Math.max(0, fp - paid);
      return {
        "#":              i + 1,
        "Emri":           s.firstName,
        "Mbiemri":        s.lastName,
        "Klasa":          s.class?.name ?? "",
        "Nr. Personal":   s.personalNumber ?? "",
        "Çmimi Bazë (€)": tuitionPrice,
        "Zbritja (%)":    s.discountPct,
        "Çmimi Final (€)":fp,
        "Paguar (€)":     paid,
        "Borxhi (€)":     debt,
        "Statusi":        s.status === "ACTIVE" ? "Aktiv" : "Joaktiv",
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [
      { wch: 4 }, { wch: 16 }, { wch: 18 }, { wch: 8 }, { wch: 15 },
      { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
    ];

    // Stil header (bold)
    const range = XLSX.utils.decode_range(ws["!ref"] ?? "A1");
    for (let c = range.s.c; c <= range.e.c; c++) {
      const cell = ws[XLSX.utils.encode_cell({ r: 0, c })];
      if (cell) cell.s = { font: { bold: true }, fill: { fgColor: { rgb: "E2E8F0" } } };
    }

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Nxënësit");
    const today = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Nxenesit-Cmime-Borxhe-${today}.xlsx`);
  }

  async function handleDelete(s: Student) {
    const ok = window.confirm(
      `Fshi përgjithmonë "${s.firstName} ${s.lastName}"?\n\nKJO VEPRIM NUK MUND TË KTHEHET — fshihen edhe të gjitha pagesat dhe faturat.`
    );
    if (!ok) return;
    await fetch(`/api/students/${s.id}?permanent=true`, { method: "DELETE" });
    fetchStudents();
  }

  return (
    <>
      <Header title="Nxënësit" />
      <div className="p-6 space-y-4 animate-fade-in">

        {/* Actions bar */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-1 gap-3 items-center w-full sm:max-w-xl">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                placeholder="Kërko emër, nr.personal, telefon..."
                className="form-input pl-9"
              />
            </div>
            {/* Status filter */}
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1); }}
              className="form-input w-36"
            >
              <option value="">Të gjithë</option>
              <option value="ACTIVE">Aktivë</option>
              <option value="INACTIVE">Joaktivë</option>
            </select>
            {/* Class filter */}
            <select
              value={classId}
              onChange={(e) => { setClassId(e.target.value); setPage(1); }}
              className="form-input w-36"
            >
              <option value="">Të gjitha klasat</option>
              {classes.map(c => (
                <option key={c.id} value={String(c.id)}>{c.name}</option>
              ))}
            </select>
          </div>

          <div className="flex gap-2">
            <button onClick={handleExportFamilies} className="btn-secondary whitespace-nowrap">
              <Download className="w-4 h-4" />
              Exporto Familjet
            </button>
            <button onClick={handleExport} className="btn-secondary whitespace-nowrap">
              <Download className="w-4 h-4" />
              Exporto Excel
            </button>
            <Link href="/students/import" className="btn-secondary whitespace-nowrap">
              <Upload className="w-4 h-4" />
              Import Liste
            </Link>
            <Link href="/students/new" className="btn-primary whitespace-nowrap">
              <UserPlus className="w-4 h-4" />
              Regjistro Nxënës
            </Link>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{total}</p>
              <p className="text-xs text-slate-400">Gjithsej</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-green-50 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{activeCount}</p>
              <p className="text-xs text-slate-400">Aktivë</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{debtCount}</p>
              <p className="text-xs text-slate-400">Me borxhe</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="table-header">Nxënësi</th>
                  <th className="table-header">Prindi / Telefoni</th>
                  <th className="table-header">Nr. Personal</th>
                  <th className="table-header">Klasa</th>
                  <th className="table-header">Kontrata</th>
                  <th className="table-header">Çmimi Final</th>
                  <th className="table-header">Paguar</th>
                  <th className="table-header">Borxhi</th>
                  <th className="table-header">Statusi</th>
                  <th className="table-header">Regjistruar</th>
                  <th className="table-header text-right">Veprime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {loading ? (
                  <tr>
                    <td colSpan={11} className="table-cell text-center py-12 text-slate-400">
                      <svg className="animate-spin w-5 h-5 mx-auto mb-2" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Duke ngarkuar...
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={11} className="table-cell text-center py-12 text-slate-400">
                      Asnjë nxënës nuk u gjet
                    </td>
                  </tr>
                ) : students.map((s) => {
                  const fp   = finalPrice(s);
                  const paid = totalPaid(s);
                  const debt = totalDebt(s);
                  return (
                    <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="table-cell">
                        <div>
                          <p className="font-semibold text-slate-900 dark:text-white">
                            {s.firstName} {s.lastName}
                          </p>
                          {s.diaryNumber && (
                            <p className="text-xs text-slate-400">Ditar #{s.diaryNumber}</p>
                          )}
                        </div>
                      </td>
                      <td className="table-cell">
                        <div>
                          <p className="text-slate-700 dark:text-slate-300">{s.parentName}</p>
                          <p className="text-xs text-slate-400">{s.parentPhone}</p>
                        </div>
                      </td>
                      <td className="table-cell text-slate-500 dark:text-slate-400 font-mono text-xs">
                        {s.personalNumber}
                      </td>
                      <td className="table-cell">
                        {s.class ? (
                          <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded text-xs font-medium">
                            {s.class.name}
                          </span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <Link
                          href={`/sekretaria/kontratat-nxenesve?studentId=${s.id}`}
                          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/20 dark:text-blue-400 transition-colors"
                        >
                          <FileSignature className="w-3.5 h-3.5" />
                          Kontratë
                        </Link>
                      </td>
                      {/* Çmimi Final */}
                      <td className="table-cell">
                        <div>
                          <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm">
                            {formatCurrency(fp)}
                          </span>
                          {s.discountPct > 0 && (
                            <span className="ml-1.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                              -{s.discountPct}%
                            </span>
                          )}
                        </div>
                        {s.discountPct > 0 && (
                          <p className="text-[10px] text-slate-400 line-through">{formatCurrency(tuitionPrice)}</p>
                        )}
                      </td>
                      {/* Paguar */}
                      <td className="table-cell">
                        {paid > 0
                          ? <span className="text-emerald-600 dark:text-emerald-400 font-medium text-sm">{formatCurrency(paid)}</span>
                          : <span className="text-slate-300 dark:text-slate-600 text-xs">—</span>}
                      </td>
                      {/* Borxhi */}
                      <td className="table-cell">
                        {debt > 0 ? (
                          <span className="text-red-600 dark:text-red-400 font-semibold text-sm">
                            {formatCurrency(debt)}
                          </span>
                        ) : paid > 0 ? (
                          <span className="text-emerald-600 dark:text-emerald-400 text-xs font-medium">✓ Paguar</span>
                        ) : (
                          <span className="text-amber-500 dark:text-amber-400 text-xs font-medium">— Pritet</span>
                        )}
                      </td>
                      <td className="table-cell">
                        <span className={`badge ${getStatusColor(s.status)}`}>
                          {getStatusLabel(s.status)}
                        </span>
                      </td>
                      <td className="table-cell text-slate-500 dark:text-slate-400 text-xs">
                        {formatDate(s.enrollDate)}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1 justify-end">
                          <Link
                            href={`/students/${s.id}`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors"
                            title="Shiko profilin"
                          >
                            <Eye className="w-4 h-4" />
                          </Link>
                          <Link
                            href={`/students/${s.id}/edit`}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors"
                            title="Modifiko"
                          >
                            <Edit className="w-4 h-4" />
                          </Link>
                          <button
                            onClick={() => handleDelete(s)}
                            className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                            title="Fshi nxënësin"
                          >
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
              <p className="text-sm text-slate-500">
                Duke shfaqur {(page - 1) * limit + 1}–{Math.min(page * limit, total)} nga {total} nxënës
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                  disabled={page === 1}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-600 dark:text-slate-300 px-2">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                  disabled={page === totalPages}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40 transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
