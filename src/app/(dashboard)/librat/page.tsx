"use client";

import React, { useEffect, useState, useCallback } from "react";
import Header from "@/components/layout/Header";
import {
  BookOpen, Plus, Search, X, Printer, Trash2, Loader2, Package, TrendingUp, ShoppingCart, AlertCircle,
  TrendingDown, ArrowRightLeft, BarChart3, Download, Wallet, Medal, Users, CheckCircle,
} from "lucide-react";
import { formatCurrency, formatDate, MONTHS } from "@/lib/utils";
import { ACADEMIC_YEARS, CALENDAR_YEARS, DEFAULT_ACADEMIC_YEAR, getDateRange, type YearType } from "@/lib/academicYear";
import * as XLSX from "xlsx";
import FamilyReceiptPrintModal from "@/components/finance/FamilyReceiptPrintModal";

/* ── Types ─────────────────────────────────────────────── */
interface Product {
  id: number; name: string; description: string | null;
  buyPrice: number; sellPrice: number; stock: number; active: boolean;
}
interface SaleItem {
  id: number; productId: number; productName: string;
  quantity: number; buyPrice: number; sellPrice: number; total: number; profit: number;
}
interface Payment { id: number; amount: number; method: string; paidAt: string; }
interface Sale {
  id: number; studentId: number | null; studentName: string; studentClass: string | null;
  totalAmount: number; paidAmount: number; balance: number; profit: number;
  status: string; receiptNumber: string | null; saleDate: string; notes: string | null;
  itemCount?: number; items?: SaleItem[]; payments?: Payment[];
}
interface Student { id: number; firstName: string; lastName: string; class: { name: string } | null; }

interface Handover {
  id: number; amount: number; description: string | null; recipient: string | null;
  method: string; reference: string | null; handoverAt: string;
}
interface ProductSale { name: string; qty: number; revenue: number; cost: number; profit: number; }
interface Stats {
  totalRevenue: number; totalCost: number; totalProfit: number;
  totalCollected: number; totalDebt: number;
  totalHandedOver: number; remainingProfit: number;
  stockValue: number; totalItems: number;
  lowStock: { name: string; stock: number }[];
  salesCount: number; paidCount: number; partialCount: number; pendingCount: number;
  productSales: ProductSale[];
}

/* ── Helpers ────────────────────────────────────────────── */
function fmt(v: number) {
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}
function statusLabel(s: string) {
  return s === "PAID" ? "Paguar" : s === "PARTIAL" ? "Pjesërisht" : "Pa paguar";
}
function statusColor(s: string) {
  return s === "PAID"
    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    : s === "PARTIAL"
    ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";
}
function methodLabel(m: string) {
  return m === "CASH" ? "Cash" : m === "BANK" ? "Bankë" : m === "CARD" ? "Kartelë" : m;
}

/* ── Receipt print ──────────────────────────────────────── */
function buildBookReceiptHTML(sale: Sale, copy: "prind" | "shkolla", origin: string): string {
  const dateStr = formatDate(sale.saleDate);
  const recNum  = sale.receiptNumber || `#${sale.id}`;
  const itemRows = (sale.items || []).map(it => `
    <tr>
      <td>${it.productName}</td>
      <td class="center">${it.quantity}</td>
      <td class="right">${fmt(it.sellPrice)} &euro;</td>
      <td class="right bold">${fmt(it.total)} &euro;</td>
    </tr>`).join("");

  return `
<div class="receipt">
  <div class="receipt-header">
    <img src="${origin}/logo.png" class="school-logo-img" alt="Akademia Ora" onerror="this.style.display='none'"/>
    <div class="school-info">
      <div class="school-name">Akademia Ora</div>
      <div class="school-sub">Shkollë Private &bull; Prishtinë</div>
      <div class="school-sub">+383 46 505 055</div>
    </div>
    <div class="receipt-meta">
      <div class="receipt-title">FLETËPAGESË</div>
      <div class="receipt-num">${recNum}</div>
      <div class="receipt-date">${dateStr}</div>
    </div>
  </div>

  <div class="divider"></div>

  <div class="info-grid">
    <div class="info-row"><span class="lbl">Nxënësi</span><span class="val bold">${sale.studentName}</span></div>
    <div class="info-row"><span class="lbl">Klasa</span><span class="val">${sale.studentClass || "—"}</span></div>
    <div class="info-row"><span class="lbl">Kategoria</span><span class="val">Librat e Anglishtes</span></div>
  </div>

  <div class="divider"></div>

  <table>
    <thead><tr><th>Libri</th><th class="center">Sasia</th><th class="right">Çmimi</th><th class="right">Totali</th></tr></thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="amounts-box">
    <div class="amount-row"><span>Shuma totale</span><span>&euro; ${fmt(sale.totalAmount)}</span></div>
    <div class="amount-row current"><span>Paguar</span><span>&euro; ${fmt(sale.paidAmount)}</span></div>
    <div class="divider-thin"></div>
    <div class="amount-row ${sale.balance > 0 ? "debt" : "paid"}">
      <span>Borxhi i mbetur</span>
      <span>${sale.balance > 0 ? `&euro; ${fmt(sale.balance)}` : "&#10003; Pa borxh"}</span>
    </div>
  </div>

  <div class="footer-grid">
    <div class="sig-box"><div class="sig-line"></div><div class="sig-lbl">Nënshkrimi i nxënësit / prindit</div></div>
    <div class="sig-box"><div class="sig-line"></div><div class="sig-lbl">Vula dhe nënshkrimi i shkollës</div></div>
  </div>

  <div class="copy-label">${copy === "prind" ? "Kopja e Prindit / Nxënësit" : "Kopja e Shkollës — Arkiv"}</div>
</div>`;
}

function printReceipt(sale: Sale) {
  const origin = window.location.origin;
  const html1  = buildBookReceiptHTML(sale, "prind",   origin);
  const html2  = buildBookReceiptHTML(sale, "shkolla", origin);

  const w = window.open("", "_blank", "width=820,height=1200");
  if (!w) return;

  w.document.write(`<!DOCTYPE html><html lang="sq"><head>
<meta charset="UTF-8"/>
<title>Fletëpagesë ${sale.receiptNumber || ""}</title>
<style>
@page { size: A4 portrait; margin: 8mm; }
* { margin:0; padding:0; box-sizing:border-box; }
html, body { height:100%; font-family:Arial,Helvetica,sans-serif; background:#fff; color:#000; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.page { width:100%; height:100%; display:flex; flex-direction:column; }
.receipt { flex:1 1 0; min-height:0; padding:9mm 13mm 7mm; overflow:hidden; }
.cut-line { flex:0 0 auto; border:none; border-top:1px dashed #888; margin:3mm 13mm; position:relative; text-align:center; }
.cut-line::after { content:"✂"; position:absolute; top:-9px; left:50%; transform:translateX(-50%); background:#fff; padding:0 5px; font-size:13px; color:#aaa; }
.receipt-header { display:flex; align-items:flex-start; gap:10px; margin-bottom:7px; }
.school-logo-img { height:40px; width:auto; object-fit:contain; flex-shrink:0; }
.school-info { flex:1; }
.school-name { font-size:14px; font-weight:800; color:#1e3a8a; }
.school-sub { font-size:8.5px; color:#64748b; margin-top:1px; }
.receipt-meta { text-align:right; }
.receipt-title { font-size:12px; font-weight:800; letter-spacing:.06em; color:#1e3a8a; text-transform:uppercase; }
.receipt-num { font-size:10px; font-family:monospace; color:#475569; margin-top:2px; }
.receipt-date { font-size:8.5px; color:#94a3b8; margin-top:1px; }
.divider { border:none; border-top:2px solid #e2e8f0; margin:5px 0; }
.divider-thin { border:none; border-top:1px solid #e2e8f0; margin:3px 0; }
.info-grid { display:grid; grid-template-columns:1fr 1fr; gap:2px 14px; margin-bottom:7px; }
.info-row { display:flex; gap:5px; align-items:baseline; font-size:9.5px; }
.lbl { color:#64748b; white-space:nowrap; min-width:70px; }
.val { font-weight:600; color:#0f172a; }
.val.bold { font-weight:700; }
table { width:100%; border-collapse:collapse; margin:6px 0; font-size:10px; }
thead tr { background:#1e3a8a; color:#fff; }
th { padding:4px 6px; font-weight:600; text-align:left; }
td { padding:3px 6px; border-bottom:1px solid #e2e8f0; }
.center { text-align:center; } .right { text-align:right; } .bold { font-weight:700; }
.amounts-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:7px 10px; margin:6px 0; }
.amount-row { display:flex; justify-content:space-between; font-size:10px; padding:2px 0; }
.amount-row.current { font-weight:700; color:#1d4ed8; font-size:12px; border-top:1px solid #dbeafe; padding-top:5px; margin-top:2px; }
.amount-row.debt { font-weight:700; color:#dc2626; }
.amount-row.paid { font-weight:700; color:#059669; }
.footer-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:7px; }
.sig-line { border-top:1px solid #94a3b8; margin-bottom:3px; margin-top:16px; }
.sig-lbl { font-size:7.5px; color:#64748b; text-align:center; }
.copy-label { display:inline-block; margin-top:6px; font-size:7.5px; font-weight:700; color:#fff; background:#475569; padding:2px 7px; border-radius:3px; letter-spacing:.06em; text-transform:uppercase; }
</style></head><body>
<div class="page">
  ${html1}
  <div class="cut-line"></div>
  ${html2}
</div>
<script>window.onload=()=>window.print()</script>
</body></html>`);
  w.document.close();
}

const HANDOVER_METHOD_LABEL: Record<string, string> = { CASH: "Cash", BANK: "Bankë / Transfer", CARD: "Kartë" };

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
  <p class="sub">Dëshmi Dorëzimi — Librat e Anglishtes</p>
  <p class="sub">${formatDate(h.handoverAt)}</p>
</div>
<hr/>
<div class="row"><span class="label">Data:</span><span>${formatDate(h.handoverAt)}</span></div>
${h.recipient ? `<div class="row"><span class="label">Marrësi:</span><span>${h.recipient}</span></div>` : ""}
<div class="row"><span class="label">Mënyra:</span><span>${HANDOVER_METHOD_LABEL[h.method] ?? h.method}</span></div>
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

function exportLibratReport(stats: Stats, periodLabel: string) {
  const wb = XLSX.utils.book_new();
  const today = formatDate(new Date());

  const summary = [
    ["RAPORTI FINANCIAR — LIBRAT E ANGLISHTES", "", today],
    ["Periudha:", periodLabel],
    [],
    ["PASQYRA E TË ARDHURAVE", ""],
    ["Shitje totale", stats.totalRevenue],
    ["(-) Kosto totale", stats.totalCost],
    ["= Fitim bruto", stats.totalProfit],
    [],
    ["ARKËTIMI", ""],
    ["E arkëtuar", stats.totalCollected],
    ["(-) Borxhet", stats.totalDebt],
    ["(-) Dorëzuar", stats.totalHandedOver],
    ["= Mbetja", stats.remainingProfit],
    [],
    ["STOKU", ""],
    ["Cope totale", stats.totalItems],
    ["Vlera stokut", stats.stockValue],
    [],
    ["SHITJET", ""],
    ["Gjithsej shitje", stats.salesCount],
    ["Paguar", stats.paidCount],
    ["Pjesërisht", stats.partialCount],
    ["Pa pagesë", stats.pendingCount],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summary);
  ws1["!cols"] = [{ wch: 28 }, { wch: 16 }];
  XLSX.utils.book_append_sheet(wb, ws1, "Pasqyra");

  if (stats.productSales.length > 0) {
    const totQty = stats.productSales.reduce((s, p) => s + p.qty, 0);
    const totRev = stats.productSales.reduce((s, p) => s + p.revenue, 0);
    const totPro = stats.productSales.reduce((s, p) => s + p.profit, 0);
    const rows = [
      ["Libri", "Sasia", "Shitje (€)", "Fitimi (€)", "Marzha (%)"],
      ...stats.productSales.map(p => [
        p.name, p.qty, p.revenue, p.profit,
        p.revenue > 0 ? `${(p.profit / p.revenue * 100).toFixed(1)}%` : "0.0%",
      ]),
      ["TOTALI", totQty, totRev, totPro, totRev > 0 ? `${(totPro / totRev * 100).toFixed(1)}%` : "0.0%"],
    ];
    const ws2 = XLSX.utils.aoa_to_sheet(rows);
    ws2["!cols"] = [{ wch: 26 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws2, "Sipas Librit");
  }

  if (stats.lowStock.length > 0) {
    const rows = [
      ["Libri", "Stoku (cope)"],
      ...stats.lowStock.map(p => [p.name, p.stock]),
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(rows);
    ws3["!cols"] = [{ wch: 28 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws3, "Stok i ulët");
  }

  XLSX.writeFile(wb, `Raporti-Librat-${today.replace(/\./g, "-")}.xlsx`);
}

/* ════════════════════════════════════════════════════════ */
export default function LibratPage() {
  const [tab, setTab] = useState<"shitjet" | "produktet" | "raport" | "dorezim">("shitjet");

  /* ── Periudha (Vit Akademik / Kalendarik + Muaj + Vit) ── */
  const [yearType, setYearType] = useState<YearType>("academic");
  const [month, setMonth] = useState(0); // 0 = "Të gjitha"
  const [year, setYear]   = useState(DEFAULT_ACADEMIC_YEAR);

  function dateRange(): { from?: string; to?: string } {
    if (year <= 0) return {};
    if (month > 0) {
      const calYear = yearType === "academic" ? (month >= 9 ? year : year + 1) : year;
      const start = new Date(calYear, month - 1, 1);
      const end   = new Date(calYear, month, 0, 23, 59, 59);
      return { from: start.toISOString(), to: end.toISOString() };
    }
    const { start, end } = getDateRange(year, yearType);
    return { from: start.toISOString(), to: end.toISOString() };
  }

  function periodLabel(): string {
    if (year <= 0) return "Të gjitha";
    if (month > 0) {
      const calYear = yearType === "academic" ? (month >= 9 ? year : year + 1) : year;
      return `${MONTHS[month - 1]} ${calYear}`;
    }
    return yearType === "academic" ? `${year}–${year + 1}` : String(year);
  }

  /* ── Products state ── */
  const [products, setProducts] = useState<Product[]>([]);
  const [prodLoading, setProdLoading] = useState(true);
  const [prodModal, setProdModal] = useState(false);
  const [editProd, setEditProd] = useState<Product | null>(null);
  const [prodForm, setProdForm] = useState({ name: "", description: "", buyPrice: "", sellPrice: "", stock: "0" });

  /* ── Sales state ── */
  const [sales, setSales] = useState<Sale[]>([]);
  const [salesLoading, setSalesLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [newSaleModal, setNewSaleModal] = useState(false);
  const [detailSale, setDetailSale] = useState<Sale | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  /* ── Pagesë e përbashkët (familje) ── */
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [batchModal, setBatchModal] = useState(false);
  const [batchSaving, setBatchSaving] = useState(false);
  const [batchError, setBatchError] = useState<string | null>(null);
  const [batchParentName, setBatchParentName] = useState("");
  const [batchParentPhone, setBatchParentPhone] = useState("");
  const [batchMethod, setBatchMethod] = useState("CASH");
  const [familyReceiptPrintId, setFamilyReceiptPrintId] = useState<number | null>(null);

  /* ── Stats ── */
  const totalRevenue = sales.reduce((s, x) => s + x.paidAmount, 0);
  const totalDebt    = sales.reduce((s, x) => s + x.balance, 0);
  const totalProfit  = sales.reduce((s, x) => s + x.profit, 0);

  const fetchProducts = useCallback(async () => {
    setProdLoading(true);
    const r = await fetch("/api/librat/products");
    if (r.ok) setProducts(await r.json());
    setProdLoading(false);
  }, []);

  const fetchSales = useCallback(async () => {
    setSalesLoading(true);
    const { from, to } = dateRange();
    const p = new URLSearchParams({ search, limit: "100" });
    if (statusFilter) p.set("status", statusFilter);
    if (from) p.set("from", from);
    if (to)   p.set("to", to);
    const r = await fetch(`/api/librat/sales?${p}`);
    if (r.ok) setSales((await r.json()).sales);
    setSalesLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, statusFilter, month, year, yearType]);

  /* ── Raport state ── */
  const [stats, setStats] = useState<Stats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    const { from, to } = dateRange();
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to)   p.set("to", to);
    const r = await fetch(`/api/librat/stats?${p}`);
    if (r.ok) setStats(await r.json());
    setStatsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, yearType]);

  /* ── Dorëzim Parash state ── */
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [handoversLoading, setHandoversLoading] = useState(true);
  const [handoverModal, setHandoverModal] = useState(false);
  const [handoverForm, setHandoverForm] = useState({
    amount: "", description: "", recipient: "", method: "CASH", reference: "",
    handoverAt: new Date().toISOString().split("T")[0],
  });
  const [savingHandover, setSavingHandover] = useState(false);

  const fetchHandovers = useCallback(async () => {
    setHandoversLoading(true);
    const { from, to } = dateRange();
    const p = new URLSearchParams();
    if (from) p.set("from", from);
    if (to)   p.set("to", to);
    const r = await fetch(`/api/librat/handovers?${p}`);
    if (r.ok) setHandovers(await r.json());
    setHandoversLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [month, year, yearType]);

  async function saveHandover() {
    setSavingHandover(true);
    await fetch("/api/librat/handovers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: parseFloat(handoverForm.amount),
        description: handoverForm.description.trim() || null,
        recipient: handoverForm.recipient.trim() || null,
        method: handoverForm.method,
        reference: handoverForm.reference.trim() || null,
        handoverAt: handoverForm.handoverAt,
      }),
    });
    setSavingHandover(false);
    setHandoverModal(false);
    setHandoverForm({ amount: "", description: "", recipient: "", method: "CASH", reference: "", handoverAt: new Date().toISOString().split("T")[0] });
    fetchHandovers();
  }

  async function deleteHandover(id: number) {
    if (!confirm("Fshi këtë dorëzim?")) return;
    await fetch(`/api/librat/handovers/${id}`, { method: "DELETE" });
    fetchHandovers();
  }

  useEffect(() => { fetchProducts(); }, [fetchProducts]);
  useEffect(() => {
    const t = setTimeout(fetchSales, 300);
    return () => clearTimeout(t);
  }, [fetchSales]);
  useEffect(() => { if (tab === "raport") fetchStats(); }, [tab, fetchStats]);
  useEffect(() => { if (tab === "dorezim") fetchHandovers(); }, [tab, fetchHandovers]);

  async function openDetail(sale: Sale) {
    setDetailLoading(true);
    setDetailSale(sale);
    const r = await fetch(`/api/librat/sales/${sale.id}`);
    if (r.ok) setDetailSale(await r.json());
    setDetailLoading(false);
  }

  async function deleteSale(id: number) {
    if (!confirm("Fshi këtë shitje? Stoku do të rikthehet.")) return;
    await fetch(`/api/librat/sales/${id}`, { method: "DELETE" });
    setDetailSale(null);
    fetchSales();
  }

  function toggleSelect(id: number) {
    setSelected(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function openBatchModal() {
    const first = sales.find(s => selected.has(s.id));
    setBatchParentName(first?.studentName || "");
    setBatchParentPhone("");
    setBatchMethod("CASH");
    setBatchError(null);
    setBatchModal(true);
  }

  async function submitBatch() {
    setBatchSaving(true);
    setBatchError(null);
    const res = await fetch("/api/family-receipts/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentName: batchParentName,
        parentPhone: batchParentPhone,
        method: batchMethod,
        bookSaleIds: [...selected],
      }),
    });
    setBatchSaving(false);
    if (!res.ok) {
      const d = await res.json().catch(() => ({}));
      setBatchError(d.error || "Gabim gjatë ruajtjes.");
      return;
    }
    const d = await res.json();
    setBatchModal(false);
    setSelected(new Set());
    setFamilyReceiptPrintId(d.id);
    fetchSales();
  }

  const selectedSales = sales.filter(s => selected.has(s.id));
  const selectedTotal = selectedSales.reduce((sum, s) => sum + s.paidAmount, 0);

  async function saveProd() {
    const body = { ...prodForm };
    if (editProd) {
      await fetch(`/api/librat/products/${editProd.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    } else {
      await fetch("/api/librat/products", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    }
    setProdModal(false); setEditProd(null); setProdForm({ name: "", description: "", buyPrice: "", sellPrice: "", stock: "0" });
    fetchProducts();
  }

  async function deleteProd(id: number) {
    if (!confirm("Çaktivizo këtë produkt?")) return;
    await fetch(`/api/librat/products/${id}`, { method: "DELETE" });
    fetchProducts();
  }

  return (
    <>
      <Header title="Librat e Anglishtes" />
      <div className="p-6 space-y-5 animate-fade-in">

        {/* KPI cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="card p-3">
            <div className="flex items-center gap-2 mb-1">
              <div className="w-7 h-7 rounded-lg bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center">
                <ShoppingCart className="w-4 h-4 text-blue-600 dark:text-blue-400" />
              </div>
              <span className="text-xs text-slate-400">Shitje</span>
            </div>
            <p className="text-xl font-bold text-blue-600 dark:text-blue-400">{sales.length}</p>
          </div>
          <div className="card p-3">
            <p className="text-xs text-slate-400 mb-0.5">Të Hyra</p>
            <p className="text-lg font-bold text-green-600">{fmt(totalRevenue)} €</p>
          </div>
          <div className="card p-3">
            <p className="text-xs text-slate-400 mb-0.5">Borxhe</p>
            <p className="text-lg font-bold text-red-500">{fmt(totalDebt)} €</p>
          </div>
          <div className="card p-3">
            <div className="flex items-center gap-1 mb-0.5">
              <TrendingUp className="w-3 h-3 text-emerald-500" />
              <p className="text-xs text-slate-400">Fitimi</p>
            </div>
            <p className="text-lg font-bold text-emerald-600">{fmt(totalProfit)} €</p>
          </div>
        </div>

        {/* Tabs + Filtri i periudhës */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
            {(["shitjet", "produktet", "raport", "dorezim"] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  tab === t ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}>
                {t === "shitjet" && <ShoppingCart className="w-4 h-4" />}
                {t === "produktet" && <BookOpen className="w-4 h-4" />}
                {t === "raport" && <BarChart3 className="w-4 h-4" />}
                {t === "dorezim" && <ArrowRightLeft className="w-4 h-4" />}
                {t === "shitjet" ? "Shitjet" : t === "produktet" ? "Produktet" : t === "raport" ? "Raport" : "Dorëzim Parash"}
              </button>
            ))}
          </div>

          {tab !== "produktet" && (
            <div className="flex items-center gap-2 sm:ml-auto">
              <div className="flex rounded-lg overflow-hidden border border-slate-200 dark:border-slate-600 text-xs font-semibold flex-shrink-0">
                {([["academic", "🎓 Akademik"], ["calendar", "📅 Kalendarik"]] as [YearType, string][]).map(([yt, lbl]) => (
                  <button
                    key={yt}
                    onClick={() => setYearType(yt)}
                    className={`px-2.5 py-2 transition-colors ${
                      yearType === yt
                        ? "bg-primary-600 text-white"
                        : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700"
                    }`}
                  >
                    {lbl}
                  </button>
                ))}
              </div>
              <select value={month} onChange={e => setMonth(parseInt(e.target.value))} className="form-input w-36">
                <option value={0}>Të gjitha</option>
                {MONTHS.map((m, i) => <option key={i} value={i + 1}>{m}</option>)}
              </select>
              <select value={year} onChange={e => setYear(parseInt(e.target.value))} className="form-input w-28">
                <option value={0}>Të gjitha</option>
                {(yearType === "academic" ? ACADEMIC_YEARS : CALENDAR_YEARS).map(y => (
                  <option key={y} value={y}>{yearType === "academic" ? `${y}–${y + 1}` : y}</option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* ── SHITJET TAB ── */}
        {tab === "shitjet" && (
          <>
            <div className="flex flex-wrap gap-3 items-center">
              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Kërko nxënësin..." className="form-input pl-9" />
              </div>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} className="form-input w-36">
                <option value="">Të gjitha</option>
                <option value="PAID">Paguar</option>
                <option value="PARTIAL">Pjesërisht</option>
                <option value="PENDING">Pa paguar</option>
              </select>
              <button onClick={() => setNewSaleModal(true)} className="btn-primary ml-auto">
                <Plus className="w-4 h-4" />Shitje e re
              </button>
            </div>

            {selected.size >= 2 && (
              <div className="flex items-center justify-between p-3 bg-primary-50 dark:bg-primary-900/20 border border-primary-200 dark:border-primary-800 rounded-xl">
                <span className="text-sm text-primary-700 dark:text-primary-300 font-medium">{selected.size} shitje të zgjedhura — {fmt(selectedTotal)} €</span>
                <button onClick={openBatchModal} className="btn-primary text-sm">
                  <Users className="w-4 h-4" /> Bashko në Pagesë Familjare
                </button>
              </div>
            )}

            <div className="card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="table-header"></th>
                      <th className="table-header">#</th>
                      <th className="table-header">Nr. Faturës</th>
                      <th className="table-header">Nxënësi</th>
                      <th className="table-header">Klasa</th>
                      <th className="table-header">Libra</th>
                      <th className="table-header">Totali</th>
                      <th className="table-header">Paguar</th>
                      <th className="table-header">Borxhi</th>
                      <th className="table-header">Statusi</th>
                      <th className="table-header">Data</th>
                      <th className="table-header w-20">Veprime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {salesLoading ? (
                      <tr><td colSpan={12} className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary-400 mx-auto" /></td></tr>
                    ) : sales.length === 0 ? (
                      <tr><td colSpan={12} className="py-16 text-center text-slate-400 text-sm">Asnjë shitje</td></tr>
                    ) : sales.map((sale, i) => (
                      <tr key={sale.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors cursor-pointer" onClick={() => openDetail(sale)}>
                        <td className="table-cell" onClick={e => e.stopPropagation()}>
                          <input type="checkbox" checked={selected.has(sale.id)} onChange={() => toggleSelect(sale.id)} className="rounded accent-primary-600" />
                        </td>
                        <td className="table-cell text-slate-400 text-xs">{i + 1}</td>
                        <td className="table-cell font-mono text-xs text-slate-500">{sale.receiptNumber || `#${sale.id}`}</td>
                        <td className="table-cell font-semibold text-slate-800 dark:text-white">{sale.studentName}</td>
                        <td className="table-cell">
                          {sale.studentClass && (
                            <span className="bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-0.5 rounded text-xs font-medium">{sale.studentClass}</span>
                          )}
                        </td>
                        <td className="table-cell text-slate-500 text-sm">{sale.itemCount || "—"}</td>
                        <td className="table-cell font-medium text-slate-800 dark:text-slate-200">{fmt(sale.totalAmount)} €</td>
                        <td className="table-cell text-green-600 dark:text-green-400 font-medium">{fmt(sale.paidAmount)} €</td>
                        <td className="table-cell">
                          {sale.balance > 0 ? (
                            <span className="text-red-600 dark:text-red-400 font-semibold">{fmt(sale.balance)} €</span>
                          ) : (
                            <span className="text-green-500 text-xs">✓ Pa borxh</span>
                          )}
                        </td>
                        <td className="table-cell"><span className={`badge ${statusColor(sale.status)}`}>{statusLabel(sale.status)}</span></td>
                        <td className="table-cell text-slate-400 text-xs">{formatDate(sale.saleDate)}</td>
                        <td className="table-cell" onClick={e => e.stopPropagation()}>
                          <div className="flex items-center gap-1">
                            <button onClick={() => openDetail(sale)} title="Shiko detajet" className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                              <Printer className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteSale(sale.id)} title="Fshi" className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )}

        {/* ── PRODUKTET TAB ── */}
        {tab === "produktet" && (
          <>
            <div className="flex justify-end">
              <button onClick={() => { setEditProd(null); setProdForm({ name: "", description: "", buyPrice: "", sellPrice: "", stock: "0" }); setProdModal(true); }} className="btn-primary">
                <Plus className="w-4 h-4" />Shto Libër / Produkt
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {prodLoading ? (
                <div className="col-span-3 py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary-400 mx-auto" /></div>
              ) : products.length === 0 ? (
                <div className="col-span-3 py-16 text-center text-slate-400">Asnjë produkt i shtuar</div>
              ) : products.map(prod => (
                <div key={prod.id} className="card p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-blue-50 dark:bg-blue-900/30 flex items-center justify-center flex-shrink-0">
                      <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => { setEditProd(prod); setProdForm({ name: prod.name, description: prod.description||"", buyPrice: String(prod.buyPrice), sellPrice: String(prod.sellPrice), stock: String(prod.stock) }); setProdModal(true); }}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                        <Plus className="w-4 h-4" />
                      </button>
                      <button onClick={() => deleteProd(prod.id)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                  <h3 className="font-semibold text-slate-800 dark:text-white mb-1">{prod.name}</h3>
                  {prod.description && <p className="text-xs text-slate-400 mb-2">{prod.description}</p>}
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Çmimi i blerjes</span>
                      <span className="font-medium text-red-500">{fmt(prod.buyPrice)} €</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Çmimi i shitjes</span>
                      <span className="font-bold text-green-600">{fmt(prod.sellPrice)} €</span>
                    </div>
                    <div className="flex justify-between text-xs border-t border-slate-100 dark:border-slate-700 pt-1">
                      <span className="text-slate-400">Fitimi / copë</span>
                      <span className="font-medium text-emerald-600">{fmt(prod.sellPrice - prod.buyPrice)} €</span>
                    </div>
                  </div>
                  <div className={`mt-3 flex items-center gap-1.5 text-xs font-medium ${prod.stock <= 5 ? "text-amber-600" : "text-slate-500"}`}>
                    <Package className="w-3.5 h-3.5" />
                    Stoku: {prod.stock} copë
                    {prod.stock <= 5 && <AlertCircle className="w-3.5 h-3.5 text-amber-500" />}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── RAPORT TAB ── */}
        {tab === "raport" && (
          statsLoading || !stats ? (
            <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary-400" /></div>
          ) : (() => {
            const profitMargin = stats.totalRevenue > 0 ? (stats.totalProfit / stats.totalRevenue * 100).toFixed(1) : "0.0";
            return (
              <div className="space-y-4 animate-fade-in">
                <div className="flex items-center justify-between">
                  <p className="text-sm text-slate-400">Periudha: <span className="font-semibold text-slate-600 dark:text-slate-300">{periodLabel()}</span></p>
                  <button onClick={() => exportLibratReport(stats, periodLabel())} className="btn-ghost">
                    <Download className="w-4 h-4" /> Exporto Excel
                  </button>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                  {[
                    { icon: ShoppingCart, label: "Shitje",      value: formatCurrency(stats.totalRevenue),    sub: `${stats.salesCount} transaksione`, color: "text-blue-600",    bg: "bg-blue-50 dark:bg-blue-900/30" },
                    { icon: TrendingUp,   label: "Fitim bruto", value: formatCurrency(stats.totalProfit),     sub: `Marzha ${profitMargin}%`,           color: "text-green-600",   bg: "bg-green-50 dark:bg-green-900/30" },
                    { icon: Wallet,       label: "E arkëtuar",  value: formatCurrency(stats.totalCollected),  sub: `Borxh: ${formatCurrency(stats.totalDebt)}`, color: "text-primary-600", bg: "bg-primary-50 dark:bg-primary-900/30" },
                    { icon: ArrowRightLeft, label: "Mbetja",    value: formatCurrency(stats.remainingProfit), sub: `Dorëzuar: ${formatCurrency(stats.totalHandedOver)}`, color: "text-orange-600", bg: "bg-orange-50 dark:bg-orange-900/30" },
                  ].map(k => (
                    <div key={k.label} className="card p-5">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 ${k.bg}`}>
                        <k.icon className={`w-5 h-5 ${k.color}`} />
                      </div>
                      <p className={`text-xl font-bold ${k.color}`}>{k.value}</p>
                      <p className="text-sm font-medium text-slate-700 dark:text-slate-200 mt-0.5">{k.label}</p>
                      <p className="text-xs text-slate-400 mt-1">{k.sub}</p>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  <div className="card p-5">
                    <h2 className="font-semibold text-slate-800 dark:text-white mb-3 text-sm flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-blue-500" /> Statusi i shitjeve
                    </h2>
                    <div className="space-y-3">
                      {[
                        { label: "Paguar",     count: stats.paidCount,    bar: "bg-green-500", pct: stats.salesCount ? stats.paidCount / stats.salesCount * 100 : 0 },
                        { label: "Pjesërisht", count: stats.partialCount, bar: "bg-blue-400",  pct: stats.salesCount ? stats.partialCount / stats.salesCount * 100 : 0 },
                        { label: "Pa pagesë",  count: stats.pendingCount, bar: "bg-slate-300", pct: stats.salesCount ? stats.pendingCount / stats.salesCount * 100 : 0 },
                      ].map(s => (
                        <div key={s.label} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-500">{s.label}</span>
                            <span className="font-bold text-slate-700 dark:text-slate-300">{s.count} ({s.pct.toFixed(0)}%)</span>
                          </div>
                          <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                            <div className={`h-full ${s.bar} rounded-full transition-all`} style={{ width: `${s.pct}%` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="card p-5">
                    <h2 className="font-semibold text-slate-800 dark:text-white mb-3 text-sm flex items-center gap-2">
                      <Package className="w-4 h-4 text-purple-500" /> Stoku
                    </h2>
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                        <p className="text-xs text-slate-400">Cope totale</p>
                        <p className="text-xl font-bold text-slate-800 dark:text-white">{stats.totalItems}</p>
                      </div>
                      <div className="p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                        <p className="text-xs text-slate-400">Vlera stokut</p>
                        <p className="text-lg font-bold text-primary-600">{formatCurrency(stats.stockValue)}</p>
                      </div>
                    </div>
                    {stats.lowStock.length > 0 ? (
                      <div>
                        <p className="text-xs font-semibold text-amber-600 mb-2">Stok i ulët ({stats.lowStock.length})</p>
                        <div className="space-y-1">
                          {stats.lowStock.slice(0, 5).map(p => (
                            <div key={p.name} className="flex justify-between text-xs">
                              <span className="text-slate-500 truncate">{p.name}</span>
                              <span className="text-amber-600 font-bold ml-2">{p.stock} cope</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-green-600 flex items-center gap-1.5">
                        <span className="w-2 h-2 bg-green-500 rounded-full" /> Stok i mjaftueshëm
                      </p>
                    )}
                  </div>
                </div>

                {stats.productSales.length > 0 && (
                  <div className="card overflow-hidden">
                    <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-700">
                      <h2 className="font-semibold text-slate-800 dark:text-white text-sm flex items-center gap-2">
                        <Medal className="w-4 h-4 text-amber-500" /> Shitjet sipas Librit
                      </h2>
                      <span className="text-xs text-slate-400">{stats.productSales.length} libra</span>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            <th className="px-5 py-3 text-left">Libri</th>
                            <th className="px-5 py-3 text-right">Sasia</th>
                            <th className="px-5 py-3 text-right">Shitje</th>
                            <th className="px-5 py-3 text-right">Fitimi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {stats.productSales.map(p => (
                            <tr key={p.name}>
                              <td className="px-5 py-2.5 font-medium text-slate-800 dark:text-white">{p.name}</td>
                              <td className="px-5 py-2.5 text-right text-slate-600 dark:text-slate-300">{p.qty}</td>
                              <td className="px-5 py-2.5 text-right font-semibold text-slate-800 dark:text-white">{formatCurrency(p.revenue)}</td>
                              <td className="px-5 py-2.5 text-right text-emerald-600 font-medium">{formatCurrency(p.profit)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })()
        )}

        {/* ── DORËZIM PARASH TAB ── */}
        {tab === "dorezim" && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <p className="text-sm text-slate-400">Periudha: <span className="font-semibold text-slate-600 dark:text-slate-300">{periodLabel()}</span></p>
              <button onClick={() => setHandoverModal(true)} className="btn-primary">
                <Plus className="w-4 h-4" /> Regjistro Dorëzim
              </button>
            </div>

            <div className="card p-5 flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
                <ArrowRightLeft className="w-6 h-6 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-slate-400">Gjithsej i dorëzuar</p>
                <p className="text-2xl font-bold text-green-600">{formatCurrency(handovers.reduce((s, h) => s + h.amount, 0))}</p>
              </div>
              <div className="ml-auto text-right">
                <p className="text-xs text-slate-400">Rekordet</p>
                <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{handovers.length}</p>
              </div>
            </div>

            {handoversLoading ? (
              <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary-400" /></div>
            ) : (
              <div className="card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 dark:border-slate-700">
                      {["Data", "Shuma", "Mënyra", "Marrësi", "Referenca", "Shënim", ""].map(h => (
                        <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {handovers.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center">
                          <ArrowRightLeft className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                          <p className="text-slate-400">Nuk ka dorëzime të regjistruara për këtë periudhë</p>
                        </td>
                      </tr>
                    )}
                    {handovers.map(h => (
                      <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(h.handoverAt)}</td>
                        <td className="px-4 py-3 font-bold text-green-600">{formatCurrency(h.amount)}</td>
                        <td className="px-4 py-3">
                          <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                            {HANDOVER_METHOD_LABEL[h.method] ?? h.method}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{h.recipient ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-400 font-mono text-xs">{h.reference ?? "—"}</td>
                        <td className="px-4 py-3 text-slate-400 max-w-[160px] truncate">{h.description ?? "—"}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            <button onClick={() => printHandoverReceipt(h)}
                              className="p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-500 transition-colors"
                              title="Printo dëshmi">
                              <Printer className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteHandover(h.id)}
                              className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-400 transition-colors">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Handover Modal ── */}
      {handoverModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setHandoverModal(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-white">Regjistro Dorëzim</h3>
              <button onClick={() => setHandoverModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Shuma (€) <span className="text-red-500">*</span></label>
                  <input type="number" step="0.01" placeholder="0.00" value={handoverForm.amount}
                    onChange={e => setHandoverForm(f => ({ ...f, amount: e.target.value }))} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Data</label>
                  <input type="date" value={handoverForm.handoverAt}
                    onChange={e => setHandoverForm(f => ({ ...f, handoverAt: e.target.value }))} className="form-input" />
                </div>
              </div>
              <div>
                <label className="form-label">Mënyra</label>
                <select value={handoverForm.method} onChange={e => setHandoverForm(f => ({ ...f, method: e.target.value }))} className="form-input">
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bankë / Transfer</option>
                  <option value="CARD">Kartë</option>
                </select>
              </div>
              <div>
                <label className="form-label">Marrësi</label>
                <input placeholder="p.sh. Drejtori" value={handoverForm.recipient}
                  onChange={e => setHandoverForm(f => ({ ...f, recipient: e.target.value }))} className="form-input" />
              </div>
              <div>
                <label className="form-label">Referenca / Nr. fature</label>
                <input placeholder="Opsional" value={handoverForm.reference}
                  onChange={e => setHandoverForm(f => ({ ...f, reference: e.target.value }))} className="form-input" />
              </div>
              <div>
                <label className="form-label">Shënim</label>
                <input placeholder="Opsional" value={handoverForm.description}
                  onChange={e => setHandoverForm(f => ({ ...f, description: e.target.value }))} className="form-input" />
              </div>
            </div>
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button onClick={() => setHandoverModal(false)} className="btn-secondary">Anulo</button>
              <button onClick={saveHandover} disabled={savingHandover || !handoverForm.amount} className="btn-primary">
                {savingHandover ? "Duke ruajtur..." : "Ruaj"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Product Modal ── */}
      {prodModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setProdModal(false)}>
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
              <h3 className="font-bold text-slate-800 dark:text-white">{editProd ? "Modifiko Produktin" : "Shto Libër / Produkt"}</h3>
              <button onClick={() => setProdModal(false)}><X className="w-4 h-4 text-slate-400" /></button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="form-label">Emri <span className="text-red-500">*</span></label>
                <input value={prodForm.name} onChange={e => setProdForm(f => ({ ...f, name: e.target.value }))} className="form-input" placeholder="p.sh. English for Albania B1" />
              </div>
              <div>
                <label className="form-label">Përshkrim</label>
                <input value={prodForm.description} onChange={e => setProdForm(f => ({ ...f, description: e.target.value }))} className="form-input" placeholder="Opsional" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Çmimi i blerjes (€)</label>
                  <input type="number" min="0" step="0.01" value={prodForm.buyPrice} onChange={e => setProdForm(f => ({ ...f, buyPrice: e.target.value }))} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Çmimi i shitjes (€)</label>
                  <input type="number" min="0" step="0.01" value={prodForm.sellPrice} onChange={e => setProdForm(f => ({ ...f, sellPrice: e.target.value }))} className="form-input" />
                </div>
              </div>
              <div>
                <label className="form-label">Stoku fillestar</label>
                <input type="number" min="0" value={prodForm.stock} onChange={e => setProdForm(f => ({ ...f, stock: e.target.value }))} className="form-input" />
              </div>
              {prodForm.buyPrice && prodForm.sellPrice && (
                <div className="flex justify-between p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-lg text-sm">
                  <span className="text-slate-500">Fitimi / copë:</span>
                  <span className="font-bold text-emerald-600">{fmt(parseFloat(prodForm.sellPrice||"0") - parseFloat(prodForm.buyPrice||"0"))} €</span>
                </div>
              )}
            </div>
            <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
              <button onClick={() => setProdModal(false)} className="btn-secondary">Anulo</button>
              <button onClick={saveProd} disabled={!prodForm.name || !prodForm.buyPrice || !prodForm.sellPrice} className="btn-primary">Ruaj</button>
            </div>
          </div>
        </div>
      )}

      {/* ── New Sale Modal ── */}
      {newSaleModal && (
        <NewSaleModal
          products={products}
          onClose={() => setNewSaleModal(false)}
          onSave={() => { setNewSaleModal(false); fetchSales(); }}
        />
      )}

      {/* ── Detail Modal ── */}
      {detailSale && (
        <SaleDetailModal
          sale={detailSale}
          loading={detailLoading}
          onClose={() => setDetailSale(null)}
          onPrint={() => printReceipt(detailSale)}
          onDelete={() => deleteSale(detailSale.id)}
          onPayment={async (amount, method) => {
            await fetch(`/api/librat/sales/${detailSale.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ addPayment: amount, method }) });
            const r = await fetch(`/api/librat/sales/${detailSale.id}`);
            if (r.ok) setDetailSale(await r.json());
            fetchSales();
          }}
        />
      )}

      {/* ── Pagesë e Përbashkët (familje) ── */}
      {batchModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setBatchModal(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Users className="w-4 h-4 text-primary-500" /> Dëshmi Pagese e Përbashkët
              </h3>
              <button onClick={() => setBatchModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <div className="space-y-1.5">
                {selectedSales.map(s => (
                  <div key={s.id} className="flex justify-between text-sm text-slate-600 dark:text-slate-300">
                    <span>{s.studentName}</span>
                    <span className="font-semibold">{fmt(s.paidAmount)} €</span>
                  </div>
                ))}
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold border-t border-slate-200 dark:border-slate-600 pt-2 mt-1">
                  <span>TOTALI</span>
                  <span>{fmt(selectedTotal)} €</span>
                </div>
              </div>
              <div>
                <label className="form-label">Emri i prindit</label>
                <input className="form-input" value={batchParentName} onChange={e => setBatchParentName(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Telefoni</label>
                <input className="form-input" value={batchParentPhone} onChange={e => setBatchParentPhone(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Mënyra</label>
                <select className="form-input" value={batchMethod} onChange={e => setBatchMethod(e.target.value)}>
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bankë</option>
                  <option value="CARD">Kartelë</option>
                </select>
              </div>
              {batchError && <p className="text-sm text-red-500">{batchError}</p>}
            </div>
            <div className="flex justify-end gap-2 p-5 pt-0">
              <button onClick={() => setBatchModal(false)} className="btn-secondary">Anulo</button>
              <button onClick={submitBatch} disabled={batchSaving} className="btn-primary disabled:opacity-50">
                {batchSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                Regjistro & Printo
              </button>
            </div>
          </div>
        </div>
      )}

      {familyReceiptPrintId && (
        <FamilyReceiptPrintModal
          familyReceiptId={familyReceiptPrintId}
          onClose={() => setFamilyReceiptPrintId(null)}
        />
      )}
    </>
  );
}

/* ── New Sale Modal ─────────────────────────────────────── */
function NewSaleModal({ products, onClose, onSave }: { products: Product[]; onClose: () => void; onSave: () => void }) {
  const [studentSearch, setStudentSearch] = useState("");
  const [students, setStudents] = useState<Student[]>([]);
  const [selStudent, setSelStudent] = useState<Student | null>(null);
  const [items, setItems] = useState<{ productId: number; quantity: number; sellPrice: number }[]>([]);
  const [paidAmount, setPaidAmount] = useState("");
  const [method, setMethod] = useState("CASH");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!studentSearch || studentSearch.length < 2) { setStudents([]); return; }
    const t = setTimeout(async () => {
      const r = await fetch(`/api/students?search=${encodeURIComponent(studentSearch)}&limit=10`);
      if (r.ok) {
        const d = await r.json();
        setStudents(Array.isArray(d) ? d : d.students || []);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [studentSearch]);

  function addItem(prod: Product) {
    setItems(prev => {
      const ex = prev.find(i => i.productId === prod.id);
      if (ex) return prev.map(i => i.productId === prod.id ? { ...i, quantity: i.quantity + 1 } : i);
      return [...prev, { productId: prod.id, quantity: 1, sellPrice: prod.sellPrice }];
    });
  }
  function removeItem(productId: number) { setItems(prev => prev.filter(i => i.productId !== productId)); }
  function setQty(productId: number, qty: number) {
    if (qty <= 0) return removeItem(productId);
    setItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i));
  }

  const totalAmount = items.reduce((s, i) => s + i.sellPrice * i.quantity, 0);
  const paid = parseFloat(paidAmount || "0");

  async function handleSave() {
    if (!selStudent || items.length === 0) return;
    setSaving(true);
    await fetch("/api/librat/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        studentId: selStudent.id,
        studentName: `${selStudent.firstName} ${selStudent.lastName}`,
        studentClass: selStudent.class?.name || null,
        items, paidAmount: paid, method, notes,
      }),
    });
    setSaving(false);
    onSave();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 z-10">
          <h3 className="font-bold text-slate-800 dark:text-white">Shitje e re — Librat e Anglishtes</h3>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="p-6 space-y-5">

          {/* Nxënësi */}
          <div>
            <label className="form-label">Nxënësi <span className="text-red-500">*</span></label>
            {selStudent ? (
              <div className="flex items-center justify-between p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl border border-primary-200 dark:border-primary-800">
                <div>
                  <p className="font-semibold text-primary-800 dark:text-primary-300">{selStudent.firstName} {selStudent.lastName}</p>
                  {selStudent.class && <p className="text-xs text-slate-500">Klasa {selStudent.class.name}</p>}
                </div>
                <button onClick={() => { setSelStudent(null); setStudentSearch(""); }} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input autoFocus value={studentSearch} onChange={e => setStudentSearch(e.target.value)}
                  placeholder="Kërko emrin e nxënësit..." className="form-input pl-9" />
                {students.length > 0 && (
                  <div className="absolute z-20 left-0 right-0 mt-1 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg overflow-hidden">
                    {students.map(s => (
                      <button key={s.id} onClick={() => { setSelStudent(s); setStudents([]); setStudentSearch(""); }}
                        className="w-full flex items-center justify-between px-4 py-2.5 hover:bg-primary-50 dark:hover:bg-primary-900/20 text-left text-sm transition-colors">
                        <span className="font-medium text-slate-800 dark:text-white">{s.firstName} {s.lastName}</span>
                        {s.class && <span className="text-xs text-slate-400 bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded">{s.class.name}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Produktet */}
          <div>
            <label className="form-label mb-2">Librat / Produktet <span className="text-red-500">*</span></label>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {products.map(prod => (
                <button key={prod.id} onClick={() => addItem(prod)} disabled={prod.stock === 0}
                  className="flex items-center justify-between p-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/10 transition-all text-left disabled:opacity-40 disabled:cursor-not-allowed">
                  <div>
                    <p className="text-sm font-medium text-slate-800 dark:text-white leading-tight">{prod.name}</p>
                    <p className="text-xs text-green-600 font-semibold">{fmt(prod.sellPrice)} €</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400">Stoku</p>
                    <p className={`text-xs font-bold ${prod.stock <= 5 ? "text-amber-500" : "text-slate-600 dark:text-slate-300"}`}>{prod.stock}</p>
                  </div>
                </button>
              ))}
            </div>

            {/* Cart items */}
            {items.length > 0 && (
              <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-slate-500 text-xs">Libri</th>
                      <th className="text-center px-3 py-2 font-medium text-slate-500 text-xs">Sasia</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-500 text-xs">Çmimi</th>
                      <th className="text-right px-3 py-2 font-medium text-slate-500 text-xs">Totali</th>
                      <th className="w-8"></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {items.map(item => {
                      const prod = products.find(p => p.id === item.productId);
                      return (
                        <tr key={item.productId}>
                          <td className="px-3 py-2 font-medium text-slate-800 dark:text-white">{prod?.name}</td>
                          <td className="px-3 py-2 text-center">
                            <input type="number" min="1" max={prod?.stock} value={item.quantity}
                              onChange={e => setQty(item.productId, parseInt(e.target.value))}
                              className="w-16 text-center form-input py-1 text-sm" />
                          </td>
                          <td className="px-3 py-2 text-right text-slate-600 dark:text-slate-300">{fmt(item.sellPrice)} €</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-800 dark:text-white">{fmt(item.sellPrice * item.quantity)} €</td>
                          <td className="px-3 py-2"><button onClick={() => removeItem(item.productId)} className="text-slate-300 hover:text-red-500"><X className="w-3.5 h-3.5" /></button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <td colSpan={3} className="px-3 py-2 text-right font-bold text-slate-700 dark:text-slate-200">Totali:</td>
                      <td className="px-3 py-2 text-right font-bold text-primary-600 dark:text-primary-400">{fmt(totalAmount)} €</td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </div>

          {/* Pagesa */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Paguar (€)</label>
              <input type="number" min="0" max={totalAmount} step="0.01" value={paidAmount}
                onChange={e => setPaidAmount(e.target.value)} className="form-input" placeholder="0.00" />
            </div>
            <div>
              <label className="form-label">Mënyra</label>
              <select value={method} onChange={e => setMethod(e.target.value)} className="form-input">
                <option value="CASH">Cash</option>
                <option value="BANK">Bankë</option>
                <option value="CARD">Kartelë</option>
                <option value="ONLINE">Online</option>
              </select>
            </div>
          </div>
          {totalAmount > 0 && (
            <button onClick={() => setPaidAmount(String(totalAmount))}
              className="w-full py-2 rounded-lg border-2 border-dashed border-green-300 dark:border-green-700 text-green-600 text-sm font-medium hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors">
              ✓ Paguar plotësisht ({fmt(totalAmount)} €)
            </button>
          )}
          <div>
            <label className="form-label">Shënime</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} className="form-input" placeholder="Opsional" />
          </div>

          {/* Summary */}
          {totalAmount > 0 && (
            <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-900/50 rounded-xl text-xs">
              <div><p className="text-slate-400 mb-0.5">Totali</p><p className="font-bold text-primary-600">{fmt(totalAmount)} €</p></div>
              <div><p className="text-slate-400 mb-0.5">Paguar</p><p className="font-bold text-green-600">{fmt(paid)} €</p></div>
              <div><p className="text-slate-400 mb-0.5">Borxhi</p><p className={`font-bold ${Math.max(0, totalAmount - paid) > 0 ? "text-red-500" : "text-green-500"}`}>{fmt(Math.max(0, totalAmount - paid))} €</p></div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Anulo</button>
          <button onClick={handleSave} disabled={!selStudent || items.length === 0 || saving} className="btn-primary">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <><BookOpen className="w-4 h-4" />Ruaj & Gjenero Fletëpagesë</>}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ── Sale Detail Modal ─────────────────────────────────── */
function SaleDetailModal({ sale, loading, onClose, onPrint, onDelete, onPayment }: {
  sale: Sale; loading: boolean; onClose: () => void;
  onPrint: () => void; onDelete: () => void;
  onPayment: (amount: number, method: string) => void;
}) {
  const [payAmt, setPayAmt] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [paying, setPaying] = useState(false);

  async function doPayment() {
    const amt = parseFloat(payAmt);
    if (!amt || amt <= 0) return;
    setPaying(true);
    await onPayment(amt, payMethod);
    setPaying(false);
    setPayAmt("");
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white">Detajet e Shitjes</h3>
            <p className="text-xs text-slate-400 font-mono mt-0.5">{sale.receiptNumber || `#${sale.id}`}</p>
          </div>
          <button onClick={onClose}><X className="w-4 h-4 text-slate-400" /></button>
        </div>

        <div className="p-6 space-y-4">
          {loading ? (
            <div className="py-8 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary-400 mx-auto" /></div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl text-sm">
                <div><p className="text-xs text-slate-400 mb-0.5">Nxënësi</p><p className="font-bold text-slate-800 dark:text-white">{sale.studentName}</p></div>
                <div><p className="text-xs text-slate-400 mb-0.5">Klasa</p><p className="font-medium text-slate-700 dark:text-slate-200">{sale.studentClass || "—"}</p></div>
                <div><p className="text-xs text-slate-400 mb-0.5">Statusi</p><span className={`badge ${statusColor(sale.status)}`}>{statusLabel(sale.status)}</span></div>
                <div><p className="text-xs text-slate-400 mb-0.5">Data</p><p className="text-slate-600 dark:text-slate-300 text-xs">{formatDate(sale.saleDate)}</p></div>
              </div>

              {/* Items */}
              {sale.items && sale.items.length > 0 && (
                <div className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                  <table className="w-full text-xs">
                    <thead className="bg-slate-50 dark:bg-slate-800/50">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium text-slate-500">Libri</th>
                        <th className="text-center px-3 py-2 font-medium text-slate-500">Sasia</th>
                        <th className="text-right px-3 py-2 font-medium text-slate-500">Blerje</th>
                        <th className="text-right px-3 py-2 font-medium text-slate-500">Shitje</th>
                        <th className="text-right px-3 py-2 font-medium text-slate-500">Totali</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                      {sale.items.map(item => (
                        <tr key={item.id}>
                          <td className="px-3 py-2 font-medium text-slate-800 dark:text-white">{item.productName}</td>
                          <td className="px-3 py-2 text-center text-slate-600 dark:text-slate-300">{item.quantity}</td>
                          <td className="px-3 py-2 text-right text-red-500">{fmt(item.buyPrice)} €</td>
                          <td className="px-3 py-2 text-right text-green-600">{fmt(item.sellPrice)} €</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-800 dark:text-white">{fmt(item.total)} €</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* Financiare */}
              <div className="space-y-2 p-4 border border-slate-200 dark:border-slate-700 rounded-xl text-sm">
                <div className="flex justify-between text-slate-600 dark:text-slate-300"><span>Totali</span><span className="font-semibold">{fmt(sale.totalAmount)} €</span></div>
                <div className="flex justify-between text-green-600 dark:text-green-400 font-semibold border-t border-slate-100 dark:border-slate-700 pt-2">
                  <span>Paguar</span><span>{fmt(sale.paidAmount)} €</span>
                </div>
                <div className={`flex justify-between font-bold ${sale.balance > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  <span>Borxhi</span><span>{sale.balance > 0 ? `${fmt(sale.balance)} €` : "✓ Pa borxh"}</span>
                </div>
                <div className="flex justify-between text-slate-400 text-xs pt-1"><span>Fitimi</span><span>{fmt(sale.profit)} €</span></div>
              </div>

              {/* Pagesë shtesë */}
              {sale.balance > 0 && (
                <div className="p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl space-y-3">
                  <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">Regjistro pagesë</p>
                  <div className="flex gap-2">
                    <input type="number" min="0" max={sale.balance} step="0.01" value={payAmt}
                      onChange={e => setPayAmt(e.target.value)} placeholder={`Max ${fmt(sale.balance)} €`}
                      className="form-input flex-1 text-sm" />
                    <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="form-input w-28 text-sm">
                      <option value="CASH">Cash</option>
                      <option value="BANK">Bankë</option>
                      <option value="CARD">Kartelë</option>
                    </select>
                    <button onClick={doPayment} disabled={paying || !payAmt} className="btn-primary text-sm px-3">
                      {paying ? <Loader2 className="w-4 h-4 animate-spin" /> : "Paguaj"}
                    </button>
                  </div>
                  <button onClick={() => setPayAmt(String(sale.balance))}
                    className="text-xs text-amber-700 dark:text-amber-400 hover:underline">
                    Paguaj gjithë borxhin ({fmt(sale.balance)} €)
                  </button>
                </div>
              )}

              {/* Historiku i pagesave */}
              {sale.payments && sale.payments.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Historiku i pagesave</p>
                  <div className="space-y-1.5">
                    {sale.payments.map(p => (
                      <div key={p.id} className="flex justify-between items-center text-sm p-2 bg-slate-50 dark:bg-slate-800 rounded-lg">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400">{formatDate(p.paidAt)}</span>
                          <span className="text-xs text-slate-500">{methodLabel(p.method)}</span>
                        </div>
                        <span className="font-semibold text-green-600">{fmt(p.amount)} €</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex items-center gap-3">
          <button onClick={onDelete} className="text-red-500 hover:text-red-700 text-sm flex items-center gap-1 hover:bg-red-50 dark:hover:bg-red-900/20 px-2 py-1.5 rounded-lg transition-colors">
            <Trash2 className="w-4 h-4" />Fshi
          </button>
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="btn-secondary">Mbyll</button>
            <button onClick={onPrint} className="btn-primary">
              <Printer className="w-4 h-4" />Printo Fletëpagesë
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
