"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import type { ReactNode } from "react";
import {
  X, Plus, Trash2, Printer, Users, FileText,
  Edit2, Check, History, ArrowLeft, Eye, Download,
  FileCheck, ArrowRightLeft, Search,
} from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

/* ─── Types ─────────────────────────────────────────────── */
interface TimiStudent {
  id: number;
  firstName: string;
  lastName: string;
  parentName: string;
  parentPhone: string;
  regularPrice: number;
  discountPct: number;
  manualDiscAmt: number;
  active: boolean;
  notes: string | null;
  studentId: number | null;
}

interface ProfatureItem {
  name: string;
  regularPrice: number;
  discountPct: number;
  manualDiscAmt?: number;
  finalAmount: number;
}

interface TimiInvoice {
  id: number;
  number: string;
  seq: number;
  month: number;
  year: number;
  parentName: string;
  date: string;
  items: string;
  totalAmount: number;
  timiDiscPct: number;
  timiDiscAmt: number;
  finalAmount: number;
  notes: string | null;
  schoolYear: string | null;
  regularInvoiceId: number | null;
  createdAt: string;
}

/* ─── School constants ───────────────────────────────────── */
const SCHOOL = {
  name:    'Shkolla "Akademia Ora"',
  contact: "Lekë Matrënga",
  phone:   "38346505055",
  address: "Përroi i njelmët",
  city:    "Prishtinë",
  email:   "shkollora@email.com",
  web:     "www.akademiaora.com",
  bank:    "BKT:197189792703129I",
};

function fmt(v: number) {
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}
function fmtDate(d: string) {
  return formatDate(d);
}

/* ─── Profaturë HTML builder ─────────────────────────────── */
function buildProfatureHTML(inv: {
  number: string;
  parentName: string;
  date: string;
  items: ProfatureItem[];
  totalAmount: number;
  timiDiscPct: number;
  timiDiscAmt: number;
  finalAmount: number;
  notes?: string;
  schoolYear?: string;
  origin?: string;
}) {
  const rows = Array.from({ length: 5 }, (_, i) => inv.items[i] || null);
  const dateStr = formatDate(inv.date);

  const itemRows = rows.map((item, i) => {
    if (!item) return `
      <tr>
        <td class="unit">${i + 1}</td>
        <td class="name"></td>
        <td class="price"></td>
        <td class="disc"></td>
        <td class="pay"></td>
      </tr>`;
    const discParts: string[] = [];
    if (item.discountPct > 0) discParts.push(`${item.discountPct}%`);
    if ((item.manualDiscAmt || 0) > 0) discParts.push(`&minus;&euro;${fmt(item.manualDiscAmt!)}`);
    return `
      <tr>
        <td class="unit">${i + 1}</td>
        <td class="name bold">${item.name}</td>
        <td class="price">&euro; ${fmt(item.regularPrice)}</td>
        <td class="disc" style="font-size:10px">${discParts.join("<br/>")}</td>
        <td class="pay bold">&euro;&nbsp;${fmt(item.finalAmount)}</td>
      </tr>`;
  }).join("");

  return `<!DOCTYPE html><html lang="sq"><head><meta charset="UTF-8"/>
<title>Profaturë ${inv.number}</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#000;padding:20px 40px;max-width:960px;margin:0 auto}
.top-bar{background:#B8860B;color:#fff;text-align:center;padding:6px 10px;font-size:13px;font-weight:bold;letter-spacing:.05em;margin-bottom:16px;border-radius:2px}
.school-block{margin-bottom:14px}
.school-block h2{font-size:15px;font-weight:bold;margin-bottom:8px}
.school-info{display:grid;grid-template-columns:160px 1fr;row-gap:2px;font-size:11px}
.school-info .lbl{color:#555}
.client-tbl{width:100%;border-collapse:collapse;margin-bottom:12px}
.client-tbl td{border:1px solid #aaa;padding:4px 8px}
.client-tbl .lbl-cell{background:#FFFACD;font-weight:600;width:90px}
.main-tbl{width:100%;border-collapse:collapse;margin-bottom:0}
.main-tbl th{background:#D4A000;color:#fff;border:1px solid #999;padding:5px 6px;text-align:left;font-size:10px;font-weight:700}
.main-tbl th.r{text-align:right}
.main-tbl td{border:1px solid #bbb;padding:5px 6px;font-size:11px;height:22px}
.main-tbl td.unit{text-align:center;width:36px}
.main-tbl td.name{width:auto}
.main-tbl td.price{text-align:right;width:100px}
.main-tbl td.disc{text-align:center;width:60px}
.main-tbl td.pay{text-align:right;width:100px}
.main-tbl td.bold{font-weight:700}
.bottom-section{display:grid;grid-template-columns:1fr 220px;gap:12px;margin-top:0;border-top:1px solid #bbb}
.notes-side{padding:8px 0}
.notes-lbl{font-size:10px;color:#666;margin-bottom:4px;font-weight:600}
.notes-content{font-size:11px;min-height:40px}
.timi-side{}
.timi-hdr{background:#FFFACD;border:1px solid #bbb;border-bottom:none;padding:5px 10px;font-style:italic;font-weight:600;font-size:11px;text-align:center}
.timi-rows{border:1px solid #bbb}
.timi-row{display:flex;justify-content:space-between;padding:4px 10px;border-bottom:1px solid #eee;font-size:11px}
.timi-row:last-child{border-bottom:none}
.timi-row .v{font-weight:600}
.total-box{background:#FFFF00;border:2px solid #999;margin-top:6px;padding:8px 12px;display:flex;flex-direction:column;align-items:center;gap:2px}
.total-box .lbl{font-size:11px;font-weight:700;letter-spacing:.08em}
.total-box .sym{font-size:14px;font-weight:700}
.total-box .amt{font-size:24px;font-weight:900;letter-spacing:.02em}
.disclaimer{font-size:8px;color:#666;font-style:italic;margin-top:10px;line-height:1.5;border-top:1px dashed #ddd;padding-top:8px}
.school-year-note{font-size:10px;color:#333;margin-top:6px;line-height:1.5}
.sigs{display:flex;justify-content:space-between;margin-top:36px;padding-top:6px}
.sig{text-align:center;min-width:160px}
.sig .line{border-bottom:1px solid #333;margin-top:40px;margin-bottom:4px}
.sig .lbl{font-size:10px;color:#555;font-weight:600}
@media print{body{padding:12px 30px;max-width:100%}}
</style></head><body>
<div class="top-bar">Profatur&euml; nr: ${inv.number}</div>

<div class="school-block">
  <div style="display:flex;align-items:center;gap:12px;margin-bottom:8px">
    <img src="${inv.origin || ''}/logo.png" alt="Akademia Ora"
         style="height:48px;width:auto;object-fit:contain" onerror="this.style.display='none'"/>
    <h2 style="margin:0">${SCHOOL.name}</h2>
  </div>
  <div class="school-info">
    <span class="lbl">${SCHOOL.contact}</span><span>${SCHOOL.phone}</span>
    <span class="lbl">P&euml;rroi i njelmët</span><span>${SCHOOL.email}</span>
    <span class="lbl">${SCHOOL.city}</span><span>${SCHOOL.web}</span>
    <span class="lbl">Numri xhirollogar&euml;s&euml;</span><span>${SCHOOL.bank}</span>
  </div>
</div>

<table class="client-tbl">
  <tr><td class="lbl-cell">Prindi</td><td>${inv.parentName}</td></tr>
  <tr><td class="lbl-cell">Data</td><td>${dateStr}</td></tr>
</table>

<table class="main-tbl">
  <thead>
    <tr>
      <th style="width:36px">Nj&euml;si</th>
      <th>Emri</th>
      <th class="r" style="width:110px">&#199;mimi i rregullt</th>
      <th style="width:60px;text-align:center">Zbritje</th>
      <th class="r" style="width:110px">P&euml;r pages&euml;</th>
    </tr>
  </thead>
  <tbody>${itemRows}</tbody>
</table>

<div class="bottom-section">
  <div class="notes-side">
    <div class="notes-lbl">Sh&euml;nim:</div>
    <div class="notes-content">${inv.notes || ""}</div>
    ${inv.schoolYear ? `<div class="school-year-note">Profatur&euml; p&euml;r shkollim p&euml;r vitin ${inv.schoolYear}<br/>K&euml; profatur&euml; vlen vet&euml;m p&euml;r Timi Invest</div>` : ""}
  </div>
  <div class="timi-side">
    <div class="timi-hdr">Per TIMI INVEST</div>
    <div class="timi-rows">
      <div class="timi-row"><span>Shuma</span><span class="v">&euro;&nbsp;${fmt(inv.totalAmount)}</span></div>
      <div class="timi-row"><span>Zbritje</span><span class="v">${inv.timiDiscPct}%</span></div>
    </div>
    <div class="total-box">
      <div class="lbl">TOTALI</div>
      <div class="sym">&euro;</div>
      <div class="amt">${fmt(inv.finalAmount)}</div>
    </div>
  </div>
</div>

<div class="disclaimer">Kjo profatur&euml; &euml;sht&euml; e vlefshme vet&euml;m p&euml;r Timi Invest.</div>

<div class="sigs">
  <div class="sig"><div class="line"></div><div class="lbl">P&euml;rgatiti:</div></div>
  <div class="sig"><div class="line"></div><div class="lbl">Pranoi:</div></div>
</div>
</body></html>`;
}

/* ════════════════════════════════════════════════════════════
   MAIN COMPONENT
════════════════════════════════════════════════════════════ */
type View = "list" | "invoices" | "create";

export default function TimiInvestModal({ onClose }: { onClose: () => void }) {
  const mouseDownOnBackdrop = useRef(false);
  const [view, setView] = useState<View>("list");
  const [students, setStudents] = useState<TimiStudent[]>([]);
  const [invoices, setInvoices] = useState<TimiInvoice[]>([]);
  const [loading, setLoading] = useState(true);

  /* Kerkim ne listat (Nxenesit / Faturat) */
  const [studentListQuery, setStudentListQuery] = useState("");
  const [invoiceListQuery, setInvoiceListQuery] = useState("");

  /* Student form state */
  const [showStudentForm, setShowStudentForm] = useState(false);
  const [editStudent, setEditStudent] = useState<TimiStudent | null>(null);
  const [studentForm, setStudentForm] = useState({
    firstName: "", lastName: "", parentName: "", parentPhone: "",
    regularPrice: "2000", discountPct: "0", manualDiscAmt: "0", notes: "",
    linkedStudentId: "",
  });

  /* Student picker (search from existing students) */
  interface StudentSuggestion { id: number; firstName: string; lastName: string; parentName: string; parentPhone: string; }
  const [studentSearch, setStudentSearch] = useState("");
  const [studentSuggestions, setStudentSuggestions] = useState<StudentSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  /* Create profaturë state */
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const TIMI_DISC_PCT = 4.66;
  const [profForm, setProfForm] = useState({
    parentName: "", date: new Date().toISOString().slice(0, 10),
    notes: "", schoolYear: `${new Date().getFullYear()}-${new Date().getFullYear() + 1}`,
  });

  /* Parent autocomplete for multi-child invoices */
  const [parentSuggestions, setParentSuggestions] = useState<{ name: string; ids: number[] }[]>([]);
  const [showParentSugg, setShowParentSugg] = useState(false);

  function handleParentNameChange(value: string) {
    setProfForm(f => ({ ...f, parentName: value }));
    if (!value.trim()) { setShowParentSugg(false); return; }
    const groups: Record<string, number[]> = {};
    for (const s of students.filter(s => s.active)) {
      if (!s.parentName.toLowerCase().includes(value.toLowerCase())) continue;
      if (!groups[s.parentName]) groups[s.parentName] = [];
      groups[s.parentName].push(s.id);
    }
    const sugg = Object.entries(groups).map(([name, ids]) => ({ name, ids }));
    setParentSuggestions(sugg);
    setShowParentSugg(sugg.length > 0);
  }

  function selectParentSugg(name: string, ids: number[]) {
    setProfForm(f => ({ ...f, parentName: name }));
    setSelectedIds(new Set(ids.slice(0, 5)));
    setShowParentSugg(false);
  }

  /* Fetch */
  const fetchStudents = useCallback(async () => {
    try {
      const r = await fetch("/api/timi-invest/students");
      if (r.ok) {
        const data = await r.json();
        setStudents(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  }, []);
  const fetchInvoices = useCallback(async () => {
    try {
      const r = await fetch("/api/timi-invest/invoices");
      if (r.ok) {
        const data = await r.json();
        setInvoices(Array.isArray(data) ? data : []);
      }
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchStudents(); }, [fetchStudents]);
  useEffect(() => { if (view === "invoices") fetchInvoices(); }, [view, fetchInvoices]);

  /* Live student search from main student list */
  useEffect(() => {
    if (studentSearch.length < 2) { setStudentSuggestions([]); setShowSuggestions(false); return; }
    const t = setTimeout(async () => {
      try {
        const r = await fetch(`/api/students?search=${encodeURIComponent(studentSearch)}&status=ACTIVE&limit=8`);
        if (r.ok) {
          const data = await r.json();
          setStudentSuggestions(data.students || []);
          setShowSuggestions(true);
        }
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [studentSearch]);

  function pickStudentFromSystem(s: { id: number; firstName: string; lastName: string; parentName: string; parentPhone: string }) {
    setStudentForm(prev => ({ ...prev, firstName: s.firstName, lastName: s.lastName, parentName: s.parentName, parentPhone: s.parentPhone, linkedStudentId: String(s.id) }));
    setStudentSearch(`${s.firstName} ${s.lastName}`);
    setShowSuggestions(false);
  }

  /* ── Student CRUD ── */
  function openStudentForm(s?: TimiStudent) {
    if (s) {
      setEditStudent(s);
      setStudentForm({ firstName: s.firstName, lastName: s.lastName, parentName: s.parentName, parentPhone: s.parentPhone, regularPrice: String(s.regularPrice), discountPct: String(s.discountPct), manualDiscAmt: String(s.manualDiscAmt ?? 0), notes: s.notes || "", linkedStudentId: s.studentId ? String(s.studentId) : "" });
      setStudentSearch(`${s.firstName} ${s.lastName}`);
    } else {
      setEditStudent(null);
      setStudentForm({ firstName: "", lastName: "", parentName: "", parentPhone: "", regularPrice: "2000", discountPct: "0", manualDiscAmt: "0", notes: "", linkedStudentId: "" });
      setStudentSearch("");
    }
    setShowSuggestions(false);
    setShowStudentForm(true);
  }

  async function saveStudent() {
    const method = editStudent ? "PUT" : "POST";
    const url    = editStudent ? `/api/timi-invest/students/${editStudent.id}` : "/api/timi-invest/students";
    await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify({
      ...studentForm,
      regularPrice:    parseFloat(studentForm.regularPrice),
      discountPct:     parseFloat(studentForm.discountPct),
      studentId:       studentForm.linkedStudentId ? parseInt(studentForm.linkedStudentId) : null,
    }) });
    setShowStudentForm(false);
    fetchStudents();
  }

  /* Student detail overlay */
  const [detailStudent, setDetailStudent] = useState<TimiStudent | null>(null);

  /* Quick print profaturë for a single student — saves to DB for a real number */
  async function quickPrint(s: TimiStudent) {
    const priceAfterDisc = Math.max(0, s.regularPrice * (1 - s.discountPct / 100) - (s.manualDiscAmt || 0));
    const timiPct  = 4.66;
    const timiAmt  = Math.round(priceAfterDisc * timiPct) / 100;
    const total    = Math.round((priceAfterDisc - timiAmt) * 100) / 100;
    const items    = [{ name: `${s.firstName} ${s.lastName}`, regularPrice: s.regularPrice, discountPct: s.discountPct, manualDiscAmt: s.manualDiscAmt || 0, finalAmount: priceAfterDisc }];
    const body     = {
      parentName:     s.parentName || `${s.firstName} ${s.lastName}`,
      date:           new Date().toISOString().slice(0, 10),
      timiDiscPct:    timiPct,
      items,
      totalAmount:    priceAfterDisc,
      timiDiscAmt:    timiAmt,
      finalAmount:    total,
      notes:          s.notes || null,
      schoolYear:     null,
      timiStudentIds: [s.id],
    };
    const r   = await fetch("/api/timi-invest/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const inv = await r.json();
    fetchInvoices();
    printInvoice(inv);
  }

  function exportExcel() {
    import("xlsx").then(XLSX => {
      const TIMI_PCT = 4.66;
      const rows = students.map(s => {
        const afterDisc = Math.max(0, s.regularPrice * (1 - s.discountPct / 100) - (s.manualDiscAmt || 0));
        const timiAmt   = Math.round(afterDisc * TIMI_PCT) / 100;
        const total     = Math.round((afterDisc - timiAmt) * 100) / 100;
        return {
          "Emri":               `${s.firstName} ${s.lastName}`,
          "Prindi":             s.parentName,
          "Telefoni":           s.parentPhone,
          "Çmimi i rregullt":   s.regularPrice,
          "Zbritje shkollore %": s.discountPct,
          "Zbritje manuale €":  s.manualDiscAmt || 0,
          "Pas zbritjeve":      afterDisc,
          "Zbritje TIMI 4.66%": timiAmt,
          "TOTALI":             total,
          "Shënim":             s.notes || "",
        };
      });
      const ws = XLSX.utils.json_to_sheet(rows);
      ws["!cols"] = [20,22,16,18,18,16,18,14,24].map(w => ({ wch: w }));
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "TIMI INVEST");
      XLSX.writeFile(wb, `TIMI-INVEST-Nxenesit-${new Date().toISOString().slice(0,10)}.xlsx`);
    });
  }

  async function deleteStudent(id: number) {
    if (!confirm("Fshi nxënësin nga lista TIMI INVEST?")) return;
    await fetch(`/api/timi-invest/students/${id}`, { method: "DELETE" });
    fetchStudents();
  }

  /* ── Profaturë ── */
  const selectedStudents = students.filter(s => selectedIds.has(s.id));
  const items: ProfatureItem[] = selectedStudents.map(s => ({
    name: `${s.firstName} ${s.lastName}`,
    regularPrice: s.regularPrice,
    discountPct: s.discountPct,
    manualDiscAmt: s.manualDiscAmt || 0,
    finalAmount: Math.max(0, s.regularPrice * (1 - s.discountPct / 100) - (s.manualDiscAmt || 0)),
  }));
  const totalAmount = items.reduce((s, i) => s + i.finalAmount, 0);
  const timiDiscPct = TIMI_DISC_PCT;
  const timiDiscAmt = Math.round(totalAmount * timiDiscPct) / 100;
  const finalAmount = Math.round((totalAmount - timiDiscAmt) * 100) / 100;

  function toggleStudent(id: number) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  async function saveProfature() {
    if (!profForm.parentName.trim() || selectedIds.size === 0) {
      alert("Plotëso emrin e prindit dhe zgjidh të paktën një nxënës.");
      return;
    }
    const body = { ...profForm, timiDiscPct: TIMI_DISC_PCT, items, totalAmount, timiDiscAmt, finalAmount, timiStudentIds: [...selectedIds] };
    const r = await fetch("/api/timi-invest/invoices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const inv = await r.json();
    fetchInvoices();
    printInvoice(inv);
    setView("invoices");
    setSelectedIds(new Set());
  }

  function printInvoice(inv: TimiInvoice) {
    const parsedItems: ProfatureItem[] = JSON.parse(inv.items || "[]");
    const html = buildProfatureHTML({
      number: inv.number,
      parentName: inv.parentName,
      date: inv.date,
      items: parsedItems,
      totalAmount: inv.totalAmount,
      timiDiscPct: inv.timiDiscPct,
      timiDiscAmt: inv.timiDiscAmt,
      finalAmount: inv.finalAmount,
      notes: inv.notes || undefined,
      schoolYear: inv.schoolYear || undefined,
      origin: window.location.origin,
    });
    const win = window.open("", "_blank", "width=800,height=960");
    if (!win) return;
    win.document.write(html);
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
  }

  async function downloadPDF(inv: TimiInvoice) {
    const parsedItems: ProfatureItem[] = JSON.parse(inv.items || "[]");
    const html = buildProfatureHTML({
      number: inv.number,
      parentName: inv.parentName,
      date: inv.date,
      items: parsedItems,
      totalAmount: inv.totalAmount,
      timiDiscPct: inv.timiDiscPct,
      timiDiscAmt: inv.timiDiscAmt,
      finalAmount: inv.finalAmount,
      notes: inv.notes || undefined,
      schoolYear: inv.schoolYear || undefined,
      origin: window.location.origin,
    });

    const iframe = document.createElement("iframe");
    iframe.style.cssText = "position:fixed;left:-9999px;top:0;width:980px;height:1400px;border:none;";
    document.body.appendChild(iframe);
    iframe.contentDocument!.open();
    iframe.contentDocument!.write(html);
    iframe.contentDocument!.close();

    await new Promise(r => setTimeout(r, 600));

    const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
      import("jspdf"),
      import("html2canvas"),
    ]);

    const canvas = await html2canvas(iframe.contentDocument!.body, {
      scale: 2,
      useCORS: true,
      width: 980,
      backgroundColor: "#ffffff",
    });

    document.body.removeChild(iframe);

    const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height * pdfW) / canvas.width;
    pdf.addImage(canvas.toDataURL("image/png"), "PNG", 0, 0, pdfW, pdfH);
    pdf.save(`Profature-${inv.number}.pdf`);
  }

  async function deleteInvoice(id: number) {
    if (!confirm("Fshi këtë profaturë?")) return;
    await fetch(`/api/timi-invest/invoices/${id}`, { method: "DELETE" });
    fetchInvoices();
  }

  const [converting, setConverting] = useState<number | null>(null);

  async function convertToInvoice(inv: TimiInvoice) {
    if (!confirm(`Konverto profaturën ${inv.number} në faturë të rregullt me numër serik? Ky veprim krijon një dokument zyrtar të ri.`)) return;
    setConverting(inv.id);
    try {
      const r = await fetch(`/api/timi-invest/invoices/${inv.id}/convert`, { method: "POST" });
      const data = await r.json();
      if (!r.ok) { alert(data.error || "Gabim gjatë konvertimit"); return; }
      fetchInvoices();
      window.open(`/invoices/${data.id}`, "_blank");
    } catch {
      alert("Gabim rrjeti.");
    } finally {
      setConverting(null);
    }
  }

  const filteredStudents = studentListQuery.trim()
    ? students.filter(s => {
        const q = studentListQuery.trim().toLowerCase();
        return `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)
          || s.parentName.toLowerCase().includes(q)
          || (s.parentPhone || "").toLowerCase().includes(q);
      })
    : students;

  const filteredInvoices = invoiceListQuery.trim()
    ? invoices.filter(inv => {
        const q = invoiceListQuery.trim().toLowerCase();
        return inv.number.toLowerCase().includes(q)
          || inv.parentName.toLowerCase().includes(q)
          || inv.items.toLowerCase().includes(q);
      })
    : invoices;

  /* ════════════════════ RENDER ════════════════════ */
  return (
    <>
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
      onMouseDown={(e) => { mouseDownOnBackdrop.current = e.target === e.currentTarget; }}
      onClick={(e) => { if (mouseDownOnBackdrop.current && e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[92vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0 bg-amber-50 dark:bg-amber-900/10 rounded-t-2xl">
          <div className="w-10 h-10 rounded-xl bg-amber-500 flex items-center justify-center flex-shrink-0">
            <span className="text-white font-black text-xs leading-none text-center">TIMI<br/>INV</span>
          </div>
          <div className="flex-1">
            <p className="text-[10px] font-semibold tracking-widest text-amber-600 dark:text-amber-400 uppercase">Sistemi i Financimit</p>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">TIMI INVEST</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4 text-slate-400" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-center gap-1 px-4 pt-3 pb-0 flex-shrink-0">
          {([["list","Nxënësit",<Users className="w-3.5 h-3.5" key="u"/>],["invoices","Faturat",<History className="w-3.5 h-3.5" key="h"/>],["create","Krijo Profaturë",<FileText className="w-3.5 h-3.5" key="f"/>]] as [View, string, ReactNode][]).map(([v, label, icon]) => (
            <button key={v} onClick={() => setView(v)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-t-lg text-sm font-medium border-b-2 transition-all ${
                view === v
                  ? "border-amber-500 text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10"
                  : "border-transparent text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
              }`}>
              {icon}{label}
              {v === "invoices" && invoices.length > 0 && (
                <span className="bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                  {invoices.length}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="overflow-y-auto flex-1 p-5">

          {/* ════ VIEW: STUDENT LIST ════ */}
          {view === "list" && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="relative flex-1 min-w-48 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={studentListQuery}
                    onChange={e => setStudentListQuery(e.target.value)}
                    placeholder="Kërko nxënësin ose prindin..."
                    className="form-input pl-9"
                  />
                </div>
                <div className="flex gap-2">
                {students.length > 0 && (
                  <button onClick={exportExcel} className="btn-secondary flex items-center gap-1.5">
                    <Download className="w-4 h-4 text-green-600" />
                    <span className="text-green-700 dark:text-green-400 font-medium">Eksporto Excel</span>
                  </button>
                )}
                <button onClick={() => openStudentForm()} className="btn-primary bg-amber-500 hover:bg-amber-600 border-amber-500 text-white">
                  <Plus className="w-4 h-4" /> Shto Nxënës
                </button>
                </div>
              </div>

              {/* Student form inline */}
              {showStudentForm && (
                <div className="border-2 border-amber-300 rounded-xl p-4 bg-amber-50/50 dark:bg-amber-900/10 space-y-3">
                  <p className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
                    {editStudent ? "Ndrysho të dhënat" : "Nxënës i ri"}
                  </p>

                  {/* Search from existing students */}
                  <div className="relative">
                      <label className="form-label">
                        Kërko nga nxënësit e regjistruar
                        {studentForm.linkedStudentId
                          ? <span className="text-emerald-600 dark:text-emerald-400 font-semibold"> — i lidhur ✓</span>
                          : <span className="text-red-500 font-semibold"> — s&apos;është i lidhur ende</span>}
                      </label>
                      <input
                        className="form-input"
                        placeholder="Shkruaj emrin e nxënësit..."
                        value={studentSearch}
                        onChange={e => setStudentSearch(e.target.value)}
                        onFocus={() => studentSuggestions.length > 0 && setShowSuggestions(true)}
                        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                        autoComplete="off"
                      />
                      {showSuggestions && studentSuggestions.length > 0 && (
                        <div className="absolute z-20 top-full left-0 right-0 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-xl mt-1 overflow-hidden">
                          {studentSuggestions.map(s => (
                            <button key={s.id} type="button"
                              onMouseDown={() => pickStudentFromSystem(s)}
                              className="w-full text-left px-4 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 text-sm transition-colors border-b border-slate-100 dark:border-slate-700 last:border-0 flex items-center justify-between gap-3">
                              <span className="font-semibold text-slate-800 dark:text-slate-100">{s.firstName} {s.lastName}</span>
                              <span className="text-slate-400 text-xs truncate">{s.parentName} · {s.parentPhone}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="form-label">Emri</label>
                      <input className="form-input" placeholder="Emri" value={studentForm.firstName} onChange={e => setStudentForm({ ...studentForm, firstName: e.target.value })} />
                    </div>
                    <div>
                      <label className="form-label">Mbiemri</label>
                      <input className="form-input" placeholder="Mbiemri" value={studentForm.lastName} onChange={e => setStudentForm({ ...studentForm, lastName: e.target.value })} />
                    </div>
                    <div>
                      <label className="form-label">Emri i prindit</label>
                      <input className="form-input" placeholder="Emri i plotë" value={studentForm.parentName} onChange={e => setStudentForm({ ...studentForm, parentName: e.target.value })} />
                    </div>
                    <div>
                      <label className="form-label">Tel. i prindit</label>
                      <input className="form-input" placeholder="+383..." value={studentForm.parentPhone} onChange={e => setStudentForm({ ...studentForm, parentPhone: e.target.value })} />
                    </div>
                    <div>
                      <label className="form-label">Çmimi i rregullt (€)
                        <span className="font-normal text-slate-400 ml-1">— çmimi pa asnjë zbritje</span>
                      </label>
                      <input type="number" className="form-input" value={studentForm.regularPrice} onChange={e => setStudentForm({ ...studentForm, regularPrice: e.target.value })} />
                    </div>
                    <div>
                      <label className="form-label">Zbritje shkollore (%)
                        <span className="font-normal text-slate-400 ml-1">— p.sh. 20% vëllazëri</span>
                      </label>
                      <input type="number" className="form-input" min="0" max="100" value={studentForm.discountPct} onChange={e => setStudentForm({ ...studentForm, discountPct: e.target.value })} />
                    </div>
                    <div>
                      <label className="form-label">Zbritje manuale (€)
                        <span className="font-normal text-slate-400 ml-1">— shumë fikse shtesë</span>
                      </label>
                      <input type="number" className="form-input" min="0" value={studentForm.manualDiscAmt} onChange={e => setStudentForm({ ...studentForm, manualDiscAmt: e.target.value })} />
                    </div>
                  </div>
                  <div>
                    <label className="form-label">Shënim</label>
                    <input className="form-input" placeholder="Shënim opsional" value={studentForm.notes} onChange={e => setStudentForm({ ...studentForm, notes: e.target.value })} />
                  </div>
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setShowStudentForm(false)} className="btn-secondary">Anulo</button>
                    <button onClick={saveStudent} className="btn-primary bg-amber-500 hover:bg-amber-600 border-amber-500">
                      <Check className="w-4 h-4" /> Ruaj
                    </button>
                  </div>
                </div>
              )}

              {/* Students table */}
              {loading ? (
                <div className="text-center py-10 text-slate-400">Duke ngarkuar...</div>
              ) : students.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Users className="w-10 h-10 opacity-20 mb-3" />
                  <p className="text-sm">Nuk ka nxënës të regjistruar për TIMI INVEST.</p>
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Search className="w-10 h-10 opacity-20 mb-3" />
                  <p className="text-sm">Asnjë përputhje për &quot;{studentListQuery}&quot;.</p>
                </div>
              ) : (
                <div className="card">
                  <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className="bg-amber-50 dark:bg-amber-900/10">
                      <tr>
                        <th className="table-header text-amber-700 dark:text-amber-400">Nxënësi</th>
                        <th className="table-header text-amber-700 dark:text-amber-400">Prindi</th>
                        <th className="table-header text-amber-700 dark:text-amber-400">Telefoni</th>
                        <th className="table-header text-right text-amber-700 dark:text-amber-400">Çmimi</th>
                        <th className="table-header text-center text-amber-700 dark:text-amber-400">Zbritje</th>
                        <th className="table-header text-right text-amber-700 dark:text-amber-400">Për pagesë</th>
                        <th className="table-header w-[116px]"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {filteredStudents.map(s => {
                        const final = Math.max(0, s.regularPrice * (1 - s.discountPct / 100) - (s.manualDiscAmt || 0));
                        return (
                          <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="table-cell font-semibold text-slate-900 dark:text-white">
                              {s.firstName} {s.lastName}
                            </td>
                            <td className="table-cell text-slate-600 dark:text-slate-300">{s.parentName}</td>
                            <td className="table-cell text-slate-500 dark:text-slate-400 text-xs">{s.parentPhone}</td>
                            <td className="table-cell text-right text-slate-500 text-xs">{formatCurrency(s.regularPrice)}</td>
                            <td className="table-cell text-center">
                              {s.discountPct > 0
                                ? <span className="badge bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs">−{s.discountPct}%</span>
                                : <span className="text-slate-300 text-xs">—</span>
                              }
                            </td>
                            <td className="table-cell text-right font-bold text-slate-800 dark:text-slate-100">{formatCurrency(final)}</td>
                            <td className="table-cell w-[116px]">
                              <div className="flex gap-0.5 justify-end">
                                <button onClick={() => setDetailStudent(s)} title="Shiko detajet"
                                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors">
                                  <Eye className="w-3.5 h-3.5 text-blue-400" />
                                </button>
                                <button onClick={() => quickPrint(s)} title="Printo profaturën"
                                  className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 transition-colors">
                                  <Printer className="w-3.5 h-3.5 text-amber-500" />
                                </button>
                                <button onClick={() => openStudentForm(s)} title="Ndrysho" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors">
                                  <Edit2 className="w-3.5 h-3.5 text-slate-400" />
                                </button>
                                <button onClick={() => deleteStudent(s.id)} title="Fshi" className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="bg-slate-50 dark:bg-slate-800/50">
                      <tr>
                        <td colSpan={5} className="table-cell font-semibold text-slate-600 dark:text-slate-300">
                          Gjithsej {students.length} nxënës
                        </td>
                        <td className="table-cell text-right font-black text-amber-600 dark:text-amber-400">
                          {formatCurrency(students.reduce((s, x) => s + Math.max(0, x.regularPrice * (1 - x.discountPct / 100) - (x.manualDiscAmt || 0)), 0))}
                        </td>
                        <td />
                      </tr>
                    </tfoot>
                  </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ════ VIEW: INVOICES ════ */}
          {view === "invoices" && (
            <div className="space-y-4">
              {invoices.length > 0 && (
                <div className="relative flex-1 min-w-48 max-w-xs">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={invoiceListQuery}
                    onChange={e => setInvoiceListQuery(e.target.value)}
                    placeholder="Kërko sipas nr., prindit ose fëmijës..."
                    className="form-input pl-9"
                  />
                </div>
              )}
              {invoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <FileText className="w-10 h-10 opacity-20 mb-3" />
                  <p className="text-sm">Nuk ka profatura të ruajtura.</p>
                  <button onClick={() => setView("create")} className="btn-primary mt-4 bg-amber-500 hover:bg-amber-600 border-amber-500">
                    <Plus className="w-4 h-4" /> Krijo profaturën e parë
                  </button>
                </div>
              ) : filteredInvoices.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 text-slate-400">
                  <Search className="w-10 h-10 opacity-20 mb-3" />
                  <p className="text-sm">Asnjë përputhje për &quot;{invoiceListQuery}&quot;.</p>
                </div>
              ) : (
                <div className="card overflow-hidden">
                  <table className="w-full">
                    <thead className="bg-amber-50 dark:bg-amber-900/10">
                      <tr>
                        <th className="table-header text-amber-700 dark:text-amber-400">Nr. Profaturës</th>
                        <th className="table-header text-amber-700 dark:text-amber-400">Prindi</th>
                        <th className="table-header text-amber-700 dark:text-amber-400">Nxënësit</th>
                        <th className="table-header text-amber-700 dark:text-amber-400">Data</th>
                        <th className="table-header text-right text-amber-700 dark:text-amber-400">Totali</th>
                        <th className="table-header"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {filteredInvoices.map(inv => {
                        const parsedItems: ProfatureItem[] = (() => { try { return JSON.parse(inv.items); } catch { return []; } })();
                        return (
                          <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                            <td className="table-cell">
                              <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-sm">{inv.number}</span>
                            </td>
                            <td className="table-cell font-medium text-slate-800 dark:text-slate-100">{inv.parentName}</td>
                            <td className="table-cell">
                              <div className="flex flex-wrap gap-1">
                                {parsedItems.map((it, i) => (
                                  <span key={i} className="badge bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-[10px]">{it.name}</span>
                                ))}
                              </div>
                            </td>
                            <td className="table-cell text-slate-400 text-xs whitespace-nowrap">{fmtDate(inv.date)}</td>
                            <td className="table-cell text-right font-black text-slate-900 dark:text-white whitespace-nowrap">
                              {formatCurrency(inv.finalAmount)}
                            </td>
                            <td className="table-cell">
                              <div className="flex gap-1 justify-end items-center">
                                {inv.regularInvoiceId ? (
                                  <a href={`/invoices/${inv.regularInvoiceId}`} target="_blank" rel="noopener noreferrer"
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-900/50 transition-colors" title="Shiko faturën e rregullt">
                                    <FileCheck className="w-3.5 h-3.5" /> Fatura e Rregullt
                                  </a>
                                ) : (
                                  <button onClick={() => convertToInvoice(inv)} disabled={converting === inv.id}
                                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition-colors disabled:opacity-50" title="Konverto në faturë të rregullt">
                                    <ArrowRightLeft className="w-3.5 h-3.5" /> {converting === inv.id ? "Duke konvertuar..." : "Konverto"}
                                  </button>
                                )}
                                <button onClick={() => printInvoice(inv)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-amber-50 dark:hover:bg-amber-900/30 text-amber-500 transition-colors" title="Printo">
                                  <Printer className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => downloadPDF(inv)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-500 transition-colors" title="Shkarko PDF">
                                  <Download className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => deleteInvoice(inv.id)}
                                  className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-300 hover:text-red-400 transition-colors" title="Fshi">
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ════ VIEW: CREATE PROFATURE ════ */}
          {view === "create" && (
            <div className="space-y-5">
              {/* Form */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="relative">
                  <label className="form-label">Emri i prindit <span className="text-red-500">*</span></label>
                  <input
                    className="form-input"
                    placeholder="Shkruaj emrin e prindit..."
                    value={profForm.parentName}
                    onChange={e => handleParentNameChange(e.target.value)}
                    onFocus={() => profForm.parentName.trim() && setShowParentSugg(parentSuggestions.length > 0)}
                    onBlur={() => setTimeout(() => setShowParentSugg(false), 150)}
                    autoComplete="off"
                  />
                  {showParentSugg && parentSuggestions.length > 0 && (
                    <ul className="absolute z-30 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-700 rounded-xl shadow-xl overflow-hidden">
                      {parentSuggestions.map((p, i) => (
                        <li key={i}>
                          <button type="button" onMouseDown={() => selectParentSugg(p.name, p.ids)}
                            className="w-full text-left px-4 py-2.5 hover:bg-amber-50 dark:hover:bg-amber-900/20 transition-colors flex items-center justify-between gap-3">
                            <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{p.name}</span>
                            <span className="text-xs bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-300 px-2 py-0.5 rounded-full font-medium flex-shrink-0">
                              {p.ids.length} {p.ids.length === 1 ? "fëmijë" : "fëmijë"}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <label className="form-label">Data e profaturës</label>
                  <input type="date" className="form-input" value={profForm.date} onChange={e => setProfForm({ ...profForm, date: e.target.value })} />
                </div>
                <div>
                  <label className="form-label">Viti shkollor</label>
                  <input className="form-input" placeholder="p.sh. 2026-2027" value={profForm.schoolYear} onChange={e => setProfForm({ ...profForm, schoolYear: e.target.value })} />
                </div>
                <div className="sm:col-span-2">
                  <label className="form-label">Shënim</label>
                  <textarea className="form-input resize-none" rows={2} placeholder="Shënim opsional..." value={profForm.notes} onChange={e => setProfForm({ ...profForm, notes: e.target.value })} />
                </div>
              </div>

              {/* Student selection */}
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-3">
                  Zgjidh nxënësit <span className="text-slate-300">(max 5)</span>
                </p>
                {loading ? (
                  <div className="text-center py-8 text-slate-400 text-sm border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
                    Duke ngarkuar nxënësit...
                  </div>
                ) : students.filter(s => s.active).length === 0 ? (
                  <div className="flex flex-col items-center py-8 text-slate-400 text-sm border border-dashed border-slate-200 dark:border-slate-700 rounded-xl gap-3">
                    <Users className="w-8 h-8 opacity-20" />
                    <p>Nuk ka nxënës të regjistruar për TIMI INVEST.</p>
                    <button onClick={() => setView("list")} className="btn-secondary text-xs">
                      <Plus className="w-3.5 h-3.5" /> Shto nxënës
                    </button>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {students.filter(s => s.active).map(s => {
                      const final = s.regularPrice * (1 - s.discountPct / 100);
                      const checked = selectedIds.has(s.id);
                      const disabled = !checked && selectedIds.size >= 5;
                      return (
                        <label key={s.id} className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                          checked ? "border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-900/10" :
                          disabled ? "border-slate-100 dark:border-slate-800 opacity-40 cursor-not-allowed" :
                          "border-slate-200 dark:border-slate-700 hover:border-amber-200 dark:hover:border-amber-800"
                        }`}>
                          <input type="checkbox" checked={checked} disabled={disabled}
                            onChange={() => !disabled && toggleStudent(s.id)}
                            className="rounded accent-amber-500" />
                          <div className="flex-1">
                            <p className="font-semibold text-sm text-slate-800 dark:text-slate-100">{s.firstName} {s.lastName}</p>
                            <p className="text-xs text-slate-400">{s.parentName} · {s.parentPhone}</p>
                          </div>
                          <div className="text-right">
                            {s.discountPct > 0 && <p className="text-xs text-slate-400 line-through">{formatCurrency(s.regularPrice)}</p>}
                            <p className="font-bold text-sm text-slate-800 dark:text-slate-100">{formatCurrency(final)}</p>
                            {s.discountPct > 0 && <p className="text-[10px] text-green-600">−{s.discountPct}%</p>}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Total preview */}
              {selectedIds.size > 0 && (
                <div className="border border-amber-200 dark:border-amber-800 rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-amber-50 dark:bg-amber-900/10 flex items-center justify-between">
                    <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">Llogaritja — Per TIMI INVEST</span>
                    <span className="text-xs text-slate-500">{selectedIds.size} nxënës</span>
                  </div>
                  <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {/* Hapi 1 & 2: per-student breakdown */}
                    {items.map((it, i) => (
                      <div key={i} className="px-4 py-2.5 text-sm">
                        <div className="flex justify-between items-start">
                          <span className="font-semibold text-slate-700 dark:text-slate-200">{it.name}</span>
                          <div className="text-right">
                            {it.discountPct > 0 ? (
                              <>
                                <span className="text-slate-400 line-through text-xs mr-2">{formatCurrency(it.regularPrice)}</span>
                                <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(it.finalAmount)}</span>
                                <p className="text-[11px] text-green-600">zbritje shkollore −{it.discountPct}%</p>
                              </>
                            ) : (
                              <span className="font-bold text-slate-800 dark:text-slate-100">{formatCurrency(it.finalAmount)}</span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    {/* Hapi 3: TIMI discount applied ONCE on the sum after school discounts */}
                    <div className="flex justify-between px-4 py-2 text-sm bg-slate-50 dark:bg-slate-800/30">
                      <span className="text-slate-500">Shuma pas zbritjeve shkollore</span>
                      <span className="font-semibold">{formatCurrency(totalAmount)}</span>
                    </div>
                    <div className="flex justify-between px-4 py-2 text-sm text-red-500">
                      <span>Zbritja TIMI INVEST ({timiDiscPct}%) — aplikohet 1 herë</span>
                      <span className="font-semibold">−{formatCurrency(timiDiscAmt)}</span>
                    </div>
                    <div className="flex justify-between items-center px-4 py-3 bg-amber-50 dark:bg-amber-900/10">
                      <span className="font-bold text-slate-800 dark:text-slate-100">TOTALI FINAL</span>
                      <span className="text-xl font-black text-amber-600 dark:text-amber-400">{formatCurrency(finalAmount)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {view === "create" && (
          <div className="flex items-center gap-3 px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0 bg-slate-50 dark:bg-slate-800/30 rounded-b-2xl">
            <button onClick={() => setView("list")} className="btn-secondary">
              <ArrowLeft className="w-4 h-4" /> Kthehu
            </button>
            <div className="flex-1" />
            <button
              onClick={saveProfature}
              disabled={!profForm.parentName.trim() || selectedIds.size === 0}
              className="btn-primary bg-amber-500 hover:bg-amber-600 border-amber-500 disabled:opacity-40 disabled:cursor-not-allowed">
              <Printer className="w-4 h-4" /> Ruaj &amp; Printo Profaturën
            </button>
          </div>
        )}
      </div>
    </div>

    {/* ── Student detail overlay ── */}
    {detailStudent && (
      <div className="fixed inset-0 z-[60] bg-black/40 backdrop-blur-sm flex items-center justify-center p-4"
        onClick={() => setDetailStudent(null)}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 space-y-4"
          onClick={e => e.stopPropagation()}>
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white text-lg">
              {detailStudent.firstName} {detailStudent.lastName}
            </h3>
            <button onClick={() => setDetailStudent(null)}
              className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
              <span className="text-slate-500">Prindi</span>
              <span className="font-medium text-slate-800 dark:text-slate-100">{detailStudent.parentName}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
              <span className="text-slate-500">Telefoni</span>
              <span className="font-medium text-slate-800 dark:text-slate-100">{detailStudent.parentPhone}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
              <span className="text-slate-500">Çmimi i rregullt</span>
              <span className="font-medium text-slate-800 dark:text-slate-100">{formatCurrency(detailStudent.regularPrice)}</span>
            </div>
            {detailStudent.discountPct > 0 && (
              <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
                <span className="text-slate-500">Zbritje shkollore</span>
                <span className="font-medium text-green-600">−{detailStudent.discountPct}%</span>
              </div>
            )}
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
              <span className="text-slate-500">Pas zbritjes shkollore</span>
              <span className="font-semibold text-slate-800 dark:text-slate-100">
                {formatCurrency(detailStudent.regularPrice * (1 - detailStudent.discountPct / 100))}
              </span>
            </div>
            <div className="flex justify-between py-2 border-b border-slate-100 dark:border-slate-700">
              <span className="text-slate-500">Zbritja TIMI (4.66%)</span>
              <span className="font-medium text-red-500">
                {(() => {
                  const base = detailStudent.regularPrice * (1 - detailStudent.discountPct / 100);
                  return `−${formatCurrency(Math.round(base * 4.66) / 100)}`;
                })()}
              </span>
            </div>
            <div className="flex justify-between py-2.5 bg-amber-50 dark:bg-amber-900/10 rounded-xl px-3">
              <span className="font-bold text-slate-700 dark:text-slate-200">TOTALI FINAL</span>
              <span className="font-black text-amber-600 dark:text-amber-400 text-base">
                {(() => {
                  const base    = detailStudent.regularPrice * (1 - detailStudent.discountPct / 100);
                  const timiAmt = Math.round(base * 4.66) / 100;
                  return formatCurrency(Math.round((base - timiAmt) * 100) / 100);
                })()}
              </span>
            </div>
            {detailStudent.notes && (
              <div className="py-2 text-slate-400 text-xs italic">{detailStudent.notes}</div>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button onClick={() => { setDetailStudent(null); quickPrint(detailStudent); }}
              className="btn-primary bg-amber-500 hover:bg-amber-600 border-amber-500 flex-1">
              <Printer className="w-4 h-4" /> Printo Profaturën
            </button>
            <button onClick={() => setDetailStudent(null)} className="btn-secondary">Mbyll</button>
          </div>
        </div>
      </div>
    )}
    </>
  );
}
