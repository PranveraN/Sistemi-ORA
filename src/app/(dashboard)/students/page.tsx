"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Header from "@/components/layout/Header";
import Link from "next/link";
import { formatDate, getStatusColor, getStatusLabel, formatCurrency } from "@/lib/utils";
import {
  UserPlus, Search, ChevronLeft, ChevronRight,
  Eye, Edit, Users, AlertCircle, Upload, FileSignature, Trash2, Download, X, Plus,
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
  motherPhone: string | null;
  fatherPhone: string | null;
  motherEmail: string | null;
  fatherEmail: string | null;
  personalNumber: string | null;
  diaryNumber: string | null;
  kontrata: string | null;
  discountPct: number;
  status: string;
  enrollDate: string;
  class: { name: string; level: string } | null;
  totalPaid: number;
  timiInvest: { id: number; regularPrice: number; discountPct: number; manualDiscAmt: number } | null;
}

export default function StudentsPage() {
  const searchParams = useSearchParams();
  const classIdParam = searchParams.get("classId") || "";

  const [students, setStudents] = useState<Student[]>([]);
  const [total, setTotal] = useState(0);
  const [activeCount, setActiveCount] = useState(0);
  const [debtCount, setDebtCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("ACTIVE");
  const [classId, setClassId] = useState(classIdParam);
  const [classes, setClasses] = useState<Class[]>([]);
  const [page, setPage] = useState(1);
  const [tuitionPrice, setTuitionPrice] = useState<number>(2000);
  const [timiInvestEnabled, setTimiInvestEnabled] = useState(true);
  const limit = 20;

  /* Inline price editing */
  const [editingPriceId, setEditingPriceId] = useState<number | null>(null);
  const [editingPriceVal, setEditingPriceVal] = useState("");

  /* Timi Invest link modal */
  const [tiModal, setTiModal] = useState<{
    student: Student;
    price: string;
    saving: boolean;
  } | null>(null);

  function openTiModal(s: Student) {
    setTiModal({ student: s, price: s.timiInvest ? String(s.timiInvest.regularPrice) : "", saving: false });
  }

  async function saveTiLink() {
    if (!tiModal) return;
    const price = parseFloat(tiModal.price);
    if (isNaN(price) || price <= 0) return;
    setTiModal(m => m ? { ...m, saving: true } : null);
    const s = tiModal.student;

    if (s.timiInvest) {
      // Update existing TI record
      await fetch(`/api/timi-invest/students/${s.timiInvest.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ regularPrice: price }),
      });
    } else {
      // Create new TI record linked to this student
      await fetch("/api/timi-invest/students", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName:   s.firstName,
          lastName:    s.lastName,
          parentName:  s.parentName || "",
          parentPhone: s.parentPhone || "",
          regularPrice: price,
          studentId:   s.id,
        }),
      });
    }
    // Refresh row optimistically
    setStudents(prev => prev.map(x =>
      x.id === s.id
        ? { ...x, timiInvest: { id: x.timiInvest?.id ?? 0, regularPrice: price, discountPct: 0, manualDiscAmt: 0 } }
        : x
    ));
    setTiModal(null);
  }

  async function removeTiLink(s: Student) {
    if (!s.timiInvest) return;
    if (!confirm(`Hiq lidhjen Timi Invest për ${s.firstName} ${s.lastName}?`)) return;
    await fetch(`/api/timi-invest/students/${s.timiInvest.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ studentId: null }),
    });
    setStudents(prev => prev.map(x => x.id === s.id ? { ...x, timiInvest: null } : x));
  }

  function startEditPrice(s: Student) {
    const fp = Math.round(tuitionPrice * (1 - s.discountPct / 100));
    setEditingPriceId(s.id);
    setEditingPriceVal(String(fp));
  }

  async function commitEditPrice(s: Student) {
    setEditingPriceId(null);
    const newPrice = parseFloat(editingPriceVal);
    if (isNaN(newPrice) || newPrice <= 0) return;
    const newDisc = Math.max(0, Math.round((1 - newPrice / tuitionPrice) * 10000) / 100);
    setStudents(prev => prev.map(x => x.id === s.id ? { ...x, discountPct: newDisc } : x));
    await fetch(`/api/students/${s.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ discountPct: newDisc }),
    });
  }

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
    fetch("/api/settings")
      .then(r => r.json())
      .then(s => setTimiInvestEnabled(s.timiInvestEnabled !== "false"));
  }, []);

  const fetchStudents = useCallback(async (isFirst = false) => {
    if (isFirst) setLoading(true); else setRefreshing(true);
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
    setRefreshing(false);
  }, [search, status, page, classId]);


  const _firstRender = useRef(true);
  useEffect(() => {
    const isFirst = _firstRender.current;
    const delay = isFirst ? 0 : 300;
    _firstRender.current = false;
    const timer = setTimeout(() => fetchStudents(isFirst), delay);
    return () => clearTimeout(timer);
  }, [fetchStudents]);


  const totalPages = Math.ceil(total / limit);
  const finalPrice  = (s: Student) => Math.round(tuitionPrice * (1 - s.discountPct / 100));
  const totalPaid   = (s: Student) => s.totalPaid;
  const totalDebt   = (s: Student) => Math.max(0, finalPrice(s) - s.totalPaid);

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
        "Telefoni":       s.parentPhone || s.fatherPhone || s.motherPhone || "",
        "Email":          s.motherEmail || s.fatherEmail || "",
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
      { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 12 }, { wch: 10 },
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
      <div className="p-4 sm:p-6 space-y-4 animate-fade-in">

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
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <div className="card p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 flex-shrink-0 bg-blue-50 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-blue-600" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-slate-900 dark:text-white">{total}</p>
              <p className="text-xs text-slate-400 truncate">Gjithsej</p>
            </div>
          </div>
          <div className="card p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 flex-shrink-0 bg-green-50 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <Users className="w-4 h-4 text-green-600" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-slate-900 dark:text-white">{activeCount}</p>
              <p className="text-xs text-slate-400 truncate">Aktivë</p>
            </div>
          </div>
          <div className="card p-3 sm:p-4 flex items-center gap-2 sm:gap-3">
            <div className="w-9 h-9 flex-shrink-0 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
            <div className="min-w-0">
              <p className="text-lg font-bold text-slate-900 dark:text-white">{debtCount}</p>
              <p className="text-xs text-slate-400 truncate">Me borxhe</p>
            </div>
          </div>
        </div>

        {/* Banner Familja — shfaqet vetëm kur ka kërkim aktiv dhe rezultatet janë vëllezër/motra */}
        {(() => {
          if (!search.trim()) return null;   // ← fshih pa kërkim
          if (students.length < 2) return null;
          const phones = students.map(s => s.parentPhone).filter(Boolean);
          const freq = phones.reduce<Record<string, number>>((acc, p) => { acc[p!] = (acc[p!] ?? 0) + 1; return acc; }, {});
          const sharedPhone = Object.entries(freq).find(([, count]) => count >= 2)?.[0];
          if (!sharedPhone) return null;
          const siblings = students.filter(s => s.parentPhone === sharedPhone);
          return (
            <Link
              href={`/families?phone=${encodeURIComponent(sharedPhone)}`}
              className="flex items-center gap-3 px-4 py-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl hover:bg-primary-100 dark:hover:bg-primary-900/30 transition-colors"
            >
              <div className="w-9 h-9 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0">
                <Users className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-primary-800 dark:text-primary-300">
                  {siblings.length} vëllezër/motra të familjes {siblings[0]?.lastName}
                </p>
                <p className="text-xs text-primary-600 dark:text-primary-400">
                  Kliko për të parë profilin e plotë të familjes →
                </p>
              </div>
            </Link>
          );
        })()}

        {/* Table */}
        <div className={`card overflow-hidden transition-opacity duration-150 ${refreshing ? "opacity-60" : ""}`}>
          {refreshing && (
            <div className="flex items-center gap-2 px-5 py-2 border-b border-slate-100 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <svg className="animate-spin w-3.5 h-3.5 text-primary-500" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span className="text-xs text-slate-400">Duke rifreskuar...</span>
            </div>
          )}
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
                  {timiInvestEnabled && (
                    <th className="table-header">
                      <span className="inline-flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-violet-500 inline-block"></span>
                        Çmimi TI
                      </span>
                    </th>
                  )}
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
                    <td colSpan={12} className="table-cell text-center py-12 text-slate-400">
                      <svg className="animate-spin w-5 h-5 mx-auto mb-2" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Duke ngarkuar...
                    </td>
                  </tr>
                ) : students.length === 0 ? (
                  <tr>
                    <td colSpan={timiInvestEnabled ? 12 : 11} className="table-cell text-center py-12 text-slate-400">
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
                      {/* Çmimi Final — editueshëm inline */}
                      <td className="table-cell" onClick={() => editingPriceId !== s.id && startEditPrice(s)}>
                        {editingPriceId === s.id ? (
                          <input
                            type="number"
                            className="w-24 border border-primary-400 rounded-lg px-2 py-0.5 text-sm font-semibold text-slate-800 dark:text-slate-100 dark:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-primary-500"
                            value={editingPriceVal}
                            autoFocus
                            min={0}
                            onChange={e => setEditingPriceVal(e.target.value)}
                            onBlur={() => commitEditPrice(s)}
                            onKeyDown={e => { if (e.key === "Enter") commitEditPrice(s); if (e.key === "Escape") setEditingPriceId(null); }}
                            onClick={e => e.stopPropagation()}
                          />
                        ) : (
                          <div className="cursor-pointer group">
                            <div className="flex items-center gap-1">
                              <span className="font-semibold text-slate-800 dark:text-slate-100 text-sm group-hover:text-primary-600 transition-colors">
                                {formatCurrency(fp)}
                              </span>
                              {s.discountPct > 0 && (
                                <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 px-1.5 py-0.5 rounded-full">
                                  -{s.discountPct}%
                                </span>
                              )}
                            </div>
                            {s.discountPct > 0 && (
                              <p className="text-[10px] text-slate-400 line-through">{formatCurrency(tuitionPrice)}</p>
                            )}
                          </div>
                        )}
                      </td>
                      {/* Çmimi TI */}
                      {timiInvestEnabled && (
                        <td className="table-cell">
                          {s.timiInvest ? (
                            <div className="flex items-center gap-1">
                              <span className="font-semibold text-violet-600 dark:text-violet-400 text-sm">
                                {formatCurrency(s.timiInvest.regularPrice)}
                              </span>
                              <button
                                onClick={() => openTiModal(s)}
                                title="Modifiko çmimin TI"
                                className="p-0.5 rounded hover:bg-violet-50 dark:hover:bg-violet-900/20 text-violet-400 hover:text-violet-600 transition-colors"
                              >
                                <Edit className="w-3 h-3" />
                              </button>
                              <button
                                onClick={() => removeTiLink(s)}
                                title="Hiq lidhjen TI"
                                className="p-0.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-300 hover:text-red-500 transition-colors"
                              >
                                <X className="w-3 h-3" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => openTiModal(s)}
                              title="Lidh me Timi Invest"
                              className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full border border-dashed border-slate-300 dark:border-slate-600 text-slate-400 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
                            >
                              <Plus className="w-3 h-3" /> TI
                            </button>
                          )}
                        </td>
                      )}
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

      {/* ── Timi Invest Link Modal ─────────────────────────── */}
      {tiModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-200 dark:border-slate-700">
              <div>
                <h3 className="font-semibold text-slate-800 dark:text-white text-sm">
                  {tiModal.student.timiInvest ? "Modifiko Çmimin TI" : "Lidh me Timi Invest"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {tiModal.student.firstName} {tiModal.student.lastName}
                </p>
              </div>
              <button onClick={() => setTiModal(null)} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
                <X className="w-4 h-4 text-slate-400" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <div>
                <label className="form-label">Çmimi mujor TI (€)</label>
                <input
                  type="number"
                  className="form-input"
                  placeholder="p.sh. 150"
                  value={tiModal.price}
                  autoFocus
                  min={0}
                  onChange={e => setTiModal(m => m ? { ...m, price: e.target.value } : null)}
                  onKeyDown={e => { if (e.key === "Enter") saveTiLink(); if (e.key === "Escape") setTiModal(null); }}
                />
                <p className="text-xs text-slate-400 mt-1">
                  Ky çmim do të ruhet si "Çmim i Rregullt" te Timi Invest
                </p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => setTiModal(null)} className="btn-secondary flex-1 justify-center">
                  Anulo
                </button>
                <button
                  onClick={saveTiLink}
                  disabled={tiModal.saving || !tiModal.price}
                  className="btn-primary flex-1 justify-center disabled:opacity-50"
                >
                  {tiModal.saving ? "Duke ruajtur..." : "Ruaj"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
