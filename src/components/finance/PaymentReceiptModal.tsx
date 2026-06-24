"use client";

import { useEffect, useState } from "react";
import { X, Printer, Loader2 } from "lucide-react";
import { MONTHS } from "@/lib/utils";

interface ReceiptData {
  receiptNumber: string | null;
  paymentId: number;
  student: { name: string; parentName: string; class: string };
  category: string;
  invoiceNumber: string | null;
  finalAmount: number;
  paidAmount: number;
  previouslyPaid: number;
  totalPaid: number;
  balance: number;
  method: string | null;
  paidDate: string | null;
  month: number | null;
  year: number | null;
  description: string | null;
  registeredBy: string | null;
  createdAt: string;
}

interface Props {
  paymentId: number;
  onClose: () => void;
}

const SCHOOL = {
  name:    'Akademia Ora',
  address: "Përroi i njelmët, Prishtinë",
  phone:   "+383 46 505 055",
  email:   "shkollora@email.com",
  web:     "www.akademiaora.com",
};

function fmt(v: number) {
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function methodLabel(m: string | null) {
  if (m === "CASH")   return "Cash";
  if (m === "BANK")   return "Bankë";
  if (m === "CARD")   return "Kartelë";
  if (m === "ONLINE") return "Online";
  return m || "—";
}

function categoryLabel(c: string): string {
  if (c === "Librat & Shkollorja") return "Shkollimi";
  return c;
}

function periodLabel(month: number | null, year: number | null, description: string | null): string {
  if (description?.startsWith("KESTI_")) {
    const k = description.replace("KESTI_", "Kësti ");
    return year ? `${k} — ${year}` : k;
  }
  if (description?.startsWith("MUAJI_")) {
    const idx = parseInt(description.replace("MUAJI_", "")) - 1;
    return `Muaji ${MONTHS[idx] ?? ""} ${year ?? ""}`.trim();
  }
  if (month && year) return `${MONTHS[month - 1]} ${year}`;
  if (year) return String(year);
  return "";
}

function buildReceiptHTML(d: ReceiptData, copy: "prind" | "shkolla", origin: string): string {
  const period   = periodLabel(d.month, d.year, d.description);
  const dateStr  = d.paidDate
    ? new Date(d.paidDate).toLocaleDateString("sq-AL")
    : new Date(d.createdAt).toLocaleDateString("sq-AL");
  const timeStr  = new Date(d.createdAt).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" });
  const recNum   = d.receiptNumber || `#${d.paymentId}`;

  return `
<div class="receipt">
  <div class="receipt-header">
    <img src="${origin}/logo.png" class="school-logo-img" alt="Akademia Ora" onerror="this.style.display='none'"/>
    <div class="school-info">
      <div class="school-name">${SCHOOL.name}</div>
      <div class="school-sub">${SCHOOL.address} &bull; ${SCHOOL.phone}</div>
      <div class="school-sub">${SCHOOL.web}</div>
    </div>
    <div class="receipt-meta">
      <div class="receipt-title">DËSHMI PAGESE</div>
      <div class="receipt-num">${recNum}</div>
      <div class="receipt-date">${dateStr} ${timeStr}</div>
    </div>
  </div>

  <div class="divider"></div>

  <div class="info-grid">
    <div class="info-row"><span class="lbl">Nxënësi</span><span class="val bold">${d.student.name}</span></div>
    <div class="info-row"><span class="lbl">Prindi</span><span class="val">${d.student.parentName || "—"}</span></div>
    <div class="info-row"><span class="lbl">Klasa</span><span class="val">${d.student.class || "—"}</span></div>
    <div class="info-row"><span class="lbl">Kategoria</span><span class="val">${categoryLabel(d.category)}${period ? ` — ${period}` : ""}</span></div>
    ${d.invoiceNumber ? `<div class="info-row"><span class="lbl">Nr. Faturës</span><span class="val mono">${d.invoiceNumber}</span></div>` : ""}
    <div class="info-row"><span class="lbl">Mënyra</span><span class="val">${methodLabel(d.method)}</span></div>
  </div>

  <div class="amounts-box">
    <div class="amount-row"><span>Shuma totale e faturës</span><span>&euro; ${fmt(d.finalAmount)}</span></div>
    ${d.previouslyPaid > 0 ? `<div class="amount-row muted"><span>Paguar më parë</span><span>&euro; ${fmt(d.previouslyPaid)}</span></div>` : ""}
    <div class="amount-row current"><span>Kjo pagesë</span><span>&euro; ${fmt(d.paidAmount)}</span></div>
    <div class="divider-thin"></div>
    <div class="amount-row total"><span>Total paguar</span><span>&euro; ${fmt(d.totalPaid)}</span></div>
    <div class="amount-row ${d.balance > 0 ? "debt" : "paid"}">
      <span>Borxhi i mbetur</span>
      <span>${d.balance > 0 ? `&euro; ${fmt(d.balance)}` : "&#10003; Pa borxh"}</span>
    </div>
  </div>

  <div class="footer-grid">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-lbl">Nënshkrimi i prindit / nxënësit</div>
    </div>
    <div class="stamp-box">
      <div class="sig-line"></div>
      <div class="sig-lbl">Vula dhe nënshkrimi i shkollës</div>
    </div>
    ${d.registeredBy ? `<div class="registered-by">Regjistroi: ${d.registeredBy}</div>` : ""}
  </div>

  <div class="copy-label">${copy === "prind" ? "Kopja e Prindit / Nxënësit" : "Kopja e Shkollës — Arkiv"}</div>
</div>`;
}

export default function PaymentReceiptModal({ paymentId, onClose }: Props) {
  const [data, setData]       = useState<ReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/payments/${paymentId}/receipt`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Gabim");
        setData(d);
      })
      .catch(e => setError(e.message || "Gabim gjatë ngarkimit."))
      .finally(() => setLoading(false));
  }, [paymentId]);

  function handlePrint() {
    if (!data) return;
    const origin = window.location.origin;
    const html1 = buildReceiptHTML(data, "prind", origin);
    const html2 = buildReceiptHTML(data, "shkolla", origin);

    const win = window.open("", "_blank", "width=820,height=1200");
    if (!win) return;

    win.document.write(`<!DOCTYPE html><html lang="sq"><head>
<meta charset="UTF-8"/>
<title>Dëshmi Pagese ${data.receiptNumber || ""}</title>
<style>
@page { size: A4 portrait; margin: 8mm; }
* { margin:0; padding:0; box-sizing:border-box; }
html, body { height:100%; font-family: Arial, Helvetica, sans-serif; background:#fff; color:#000; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.page { width:100%; height:100%; display:flex; flex-direction:column; }
.receipt { flex:1 1 0; min-height:0; padding:7mm 13mm 5mm; overflow:hidden; }
.cut-line {
  flex:0 0 auto; border:none; border-top:1px dashed #888;
  margin:3mm 13mm; position:relative; text-align:center;
}
.cut-line::after {
  content:"✂"; position:absolute; top:-9px; left:50%;
  transform:translateX(-50%); background:#fff; padding:0 5px;
  font-size:13px; color:#aaa;
}
.receipt-header { display:flex; align-items:flex-start; gap:10px; margin-bottom:7px; }
.school-logo-img {
  height:40px; width:auto; object-fit:contain; flex-shrink:0;
}
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
.lbl { color:#64748b; white-space:nowrap; min-width:76px; }
.val { font-weight:600; color:#0f172a; }
.val.bold { font-weight:700; }
.val.mono { font-family:monospace; font-size:8.5px; }
.amounts-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:7px 10px; margin-bottom:7px; }
.amount-row { display:flex; justify-content:space-between; font-size:10px; padding:2px 0; }
.amount-row.muted { color:#94a3b8; }
.amount-row.current { font-weight:700; color:#1d4ed8; font-size:12px; border-top:1px solid #dbeafe; padding-top:5px; margin-top:2px; }
.amount-row.total { font-weight:700; color:#047857; font-size:11px; }
.amount-row.debt { font-weight:700; color:#dc2626; }
.amount-row.paid { font-weight:700; color:#059669; }
.footer-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:7px; }
.sig-line { border-top:1px solid #94a3b8; margin-bottom:3px; margin-top:16px; }
.sig-lbl { font-size:7.5px; color:#64748b; text-align:center; }
.registered-by { font-size:7.5px; color:#94a3b8; grid-column:1/-1; text-align:right; margin-top:3px; }
.copy-label {
  display:inline-block; margin-top:6px; font-size:7.5px; font-weight:700;
  color:#fff; background:#475569; padding:2px 7px; border-radius:3px;
  letter-spacing:.06em; text-transform:uppercase;
}
</style></head><body>
<div class="page">
  ${html1}
  <div class="cut-line"></div>
  ${html2}
</div>
<script>window.onload=()=>{window.print();}</script>
</body></html>`);
    win.document.close();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white">Dëshmi Pagese</h3>
            {data?.receiptNumber && (
              <p className="text-xs text-slate-400 font-mono mt-0.5">{data.receiptNumber}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          )}
          {error && <p className="text-red-500 text-sm text-center py-6">{error}</p>}
          {data && !loading && (
            <div className="space-y-4 text-sm">
              {/* Student info */}
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Nxënësi</p>
                  <p className="font-bold text-slate-800 dark:text-white">{data.student.name}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Klasa</p>
                  <p className="font-medium text-slate-700 dark:text-slate-200">{data.student.class || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Prindi</p>
                  <p className="font-medium text-slate-700 dark:text-slate-200">{data.student.parentName || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Kategoria</p>
                  <p className="font-medium text-slate-700 dark:text-slate-200">{categoryLabel(data.category)}</p>
                </div>
              </div>

              {/* Amounts */}
              <div className="space-y-2 p-4 border border-slate-200 dark:border-slate-700 rounded-xl">
                <div className="flex justify-between text-slate-600 dark:text-slate-300">
                  <span>Shuma totale e faturës</span>
                  <span className="font-semibold">{fmt(data.finalAmount)} €</span>
                </div>
                {data.previouslyPaid > 0 && (<>
                  <div className="flex justify-between text-slate-400 text-xs">
                    <span>Paguar më parë</span>
                    <span>{fmt(data.previouslyPaid)} €</span>
                  </div>
                  <div className="flex justify-between text-blue-600 dark:text-blue-400 font-bold text-base border-t border-slate-200 dark:border-slate-600 pt-2 mt-1">
                    <span>Kjo pagesë</span>
                    <span>{fmt(data.paidAmount)} €</span>
                  </div>
                </>)}
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-semibold border-t border-slate-200 dark:border-slate-600 pt-2 mt-1">
                  <span>Total paguar</span>
                  <span>{fmt(data.totalPaid)} €</span>
                </div>
                <div className={`flex justify-between font-bold ${data.balance > 0 ? "text-red-600 dark:text-red-400" : "text-emerald-600 dark:text-emerald-400"}`}>
                  <span>Borxhi i mbetur</span>
                  <span>{data.balance > 0 ? `${fmt(data.balance)} €` : "✓ Pa borxh"}</span>
                </div>
              </div>

              {/* Meta */}
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span>Mënyra: <span className="text-slate-600 dark:text-slate-300 font-medium">{methodLabel(data.method)}</span></span>
                {data.registeredBy && <span>Regjistroi: <span className="text-slate-600 dark:text-slate-300 font-medium">{data.registeredBy}</span></span>}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary">Mbyll</button>
          <button onClick={handlePrint} disabled={loading || !!error} className="btn-primary">
            <Printer className="w-4 h-4" />
            Printo Dëshminë (2 kopje)
          </button>
        </div>
      </div>
    </div>
  );
}
