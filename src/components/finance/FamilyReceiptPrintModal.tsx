"use client";

import { useEffect, useState } from "react";
import { X, Printer, Loader2 } from "lucide-react";
import { MONTHS, USHQIMI_PERIOD_LABELS, formatDate } from "@/lib/utils";

interface ChildPayment {
  id: number;
  finalAmount: number;
  paidAmount: number;
  balance: number;
  status: string;
  description: string | null;
  month: number | null;
  year: number | null;
  receiptNumber: string | null;
  student: { id: number; firstName: string; lastName: string; class: { name: string } | null };
  category: { name: string };
}

interface Sale {
  id: number;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  customerName?: string;   // UniSale
  studentName?: string;    // BookSale
}

interface FamilyReceiptData {
  id: number;
  receiptNumber: string;
  parentName: string | null;
  parentPhone: string | null;
  method: string | null;
  totalAmount: number;
  paidDate: string;
  createdAt: string;
  payments: ChildPayment[];
  uniSales: Sale[];
  bookSales: Sale[];
}

interface Line { key: string; name: string; service: string; amount: number }

function buildLines(d: FamilyReceiptData): Line[] {
  return [
    ...d.payments.map(p => ({
      key: `p${p.id}`,
      name: `${p.student.firstName} ${p.student.lastName}${p.student.class ? ` (${p.student.class.name})` : ""}`,
      service: `${categoryLabel(p.category.name)}${periodLabel(p) ? ` — ${periodLabel(p)}` : ""}`,
      amount: p.paidAmount,
    })),
    ...d.uniSales.map(s => ({ key: `u${s.id}`, name: s.customerName || "—", service: "Uniforma", amount: s.paidAmount })),
    ...d.bookSales.map(s => ({ key: `b${s.id}`, name: s.studentName || "—", service: "Librat e Anglishtes", amount: s.paidAmount })),
  ];
}

interface Props {
  familyReceiptId: number;
  onClose: () => void;
}

const SCHOOL = {
  name:    'Akademia Ora',
  address: "Përroi i njelmët, Prishtinë",
  phone:   "+383 46 505 055",
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
  return c;
}

function periodLabel(p: ChildPayment): string {
  if (p.category.name === "Ushqimi" && p.month && USHQIMI_PERIOD_LABELS[p.month]) {
    return p.year ? `${USHQIMI_PERIOD_LABELS[p.month]} ${p.year}` : USHQIMI_PERIOD_LABELS[p.month];
  }
  if (p.month && p.year) return `${MONTHS[p.month - 1]} ${p.year}`;
  if (p.year) return String(p.year);
  return "";
}

function buildReceiptHTML(d: FamilyReceiptData, copy: "prind" | "shkolla", origin: string): string {
  const dateStr = formatDate(d.paidDate || d.createdAt);
  const timeStr = new Date(d.createdAt).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" });

  const rows = buildLines(d).map(l => `
    <tr>
      <td>${l.name}</td>
      <td>${l.service}</td>
      <td class="r">&euro; ${fmt(l.amount)}</td>
    </tr>`).join("");

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
      <div class="receipt-title">DËSHMI PAGESE — FAMILJE</div>
      <div class="receipt-num">${d.receiptNumber}</div>
      <div class="receipt-date">${dateStr} ${timeStr}</div>
    </div>
  </div>

  <div class="divider"></div>

  <div class="info-grid">
    <div class="info-row"><span class="lbl">Prindi</span><span class="val bold">${d.parentName || "—"}</span></div>
    <div class="info-row"><span class="lbl">Telefoni</span><span class="val">${d.parentPhone || "—"}</span></div>
    <div class="info-row"><span class="lbl">Mënyra</span><span class="val">${methodLabel(d.method)}</span></div>
    <div class="info-row"><span class="lbl">Rreshta</span><span class="val">${buildLines(d).length}</span></div>
  </div>

  <table class="items">
    <thead><tr><th>Fëmija</th><th>Shërbimi</th><th class="r">Shuma</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>

  <div class="amounts-box">
    <div class="amount-row total"><span>TOTALI I PAGUAR</span><span>&euro; ${fmt(d.totalAmount)}</span></div>
  </div>

  <div class="footer-grid">
    <div class="sig-box">
      <div class="sig-line"></div>
      <div class="sig-lbl">Nënshkrimi i prindit</div>
    </div>
    <div class="stamp-box">
      <div class="sig-line"></div>
      <div class="sig-lbl">Vula dhe nënshkrimi i shkollës</div>
    </div>
  </div>

  <div class="copy-label">${copy === "prind" ? "Kopja e Prindit" : "Kopja e Shkollës — Arkiv"}</div>
</div>`;
}

export default function FamilyReceiptPrintModal({ familyReceiptId, onClose }: Props) {
  const [data, setData]       = useState<FamilyReceiptData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/family-receipts/${familyReceiptId}`)
      .then(async r => {
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Gabim");
        setData(d);
      })
      .catch(e => setError(e.message || "Gabim gjatë ngarkimit."))
      .finally(() => setLoading(false));
  }, [familyReceiptId]);

  function handlePrint() {
    if (!data) return;
    const origin = window.location.origin;
    const html1 = buildReceiptHTML(data, "prind", origin);
    const html2 = buildReceiptHTML(data, "shkolla", origin);

    const win = window.open("", "_blank", "width=820,height=1200");
    if (!win) return;

    win.document.write(`<!DOCTYPE html><html lang="sq"><head>
<meta charset="UTF-8"/>
<title>Dëshmi Pagese ${data.receiptNumber}</title>
<style>
@page { size: A4 portrait; margin: 8mm; }
* { margin:0; padding:0; box-sizing:border-box; }
html, body { height:100%; font-family: Arial, Helvetica, sans-serif; background:#fff; color:#000; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.page { width:100%; height:100%; display:flex; flex-direction:column; }
.receipt { flex:1 1 0; min-height:0; padding:9mm 13mm 7mm; overflow:hidden; }
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
.school-logo-img { height:40px; width:auto; object-fit:contain; flex-shrink:0; }
.school-info { flex:1; }
.school-name { font-size:14px; font-weight:800; color:#1e3a8a; }
.school-sub { font-size:8.5px; color:#64748b; margin-top:1px; }
.receipt-meta { text-align:right; }
.receipt-title { font-size:12px; font-weight:800; letter-spacing:.06em; color:#1e3a8a; text-transform:uppercase; }
.receipt-num { font-size:10px; font-family:monospace; color:#475569; margin-top:2px; }
.receipt-date { font-size:8.5px; color:#94a3b8; margin-top:1px; }
.divider { border:none; border-top:2px solid #e2e8f0; margin:5px 0; }
.info-grid { display:grid; grid-template-columns:1fr 1fr; gap:2px 14px; margin-bottom:7px; }
.info-row { display:flex; gap:5px; align-items:baseline; font-size:9.5px; }
.lbl { color:#64748b; white-space:nowrap; min-width:60px; }
.val { font-weight:600; color:#0f172a; }
.val.bold { font-weight:700; }
.muted { color:#94a3b8; font-size:8.5px; }
.items { width:100%; border-collapse:collapse; margin-bottom:7px; font-size:9.5px; }
.items th { text-align:left; color:#64748b; font-weight:600; border-bottom:1px solid #e2e8f0; padding:3px 4px; }
.items th.r, .items td.r { text-align:right; }
.items td { padding:3px 4px; border-bottom:1px solid #f1f5f9; color:#0f172a; }
.amounts-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:7px 10px; margin-bottom:7px; }
.amount-row { display:flex; justify-content:space-between; font-size:10px; padding:2px 0; }
.amount-row.total { font-weight:700; color:#047857; font-size:13px; }
.footer-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:7px; }
.sig-line { border-top:1px solid #94a3b8; margin-bottom:3px; margin-top:16px; }
.sig-lbl { font-size:7.5px; color:#64748b; text-align:center; }
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

        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700">
          <div>
            <h3 className="font-bold text-slate-800 dark:text-white">Dëshmi Pagese — Familje</h3>
            {data?.receiptNumber && (
              <p className="text-xs text-slate-400 font-mono mt-0.5">{data.receiptNumber}</p>
            )}
          </div>
          <button onClick={onClose} className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary-500" />
            </div>
          )}
          {error && <p className="text-red-500 text-sm text-center py-6">{error}</p>}
          {data && !loading && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-3 p-4 bg-slate-50 dark:bg-slate-800 rounded-xl">
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Prindi</p>
                  <p className="font-bold text-slate-800 dark:text-white">{data.parentName || "—"}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 mb-0.5">Telefoni</p>
                  <p className="font-medium text-slate-700 dark:text-slate-200">{data.parentPhone || "—"}</p>
                </div>
              </div>

              <div className="space-y-1.5 p-4 border border-slate-200 dark:border-slate-700 rounded-xl">
                {buildLines(data).map(l => (
                  <div key={l.key} className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>{l.name} — {l.service}</span>
                    <span className="font-semibold">{fmt(l.amount)} €</span>
                  </div>
                ))}
                <div className="flex justify-between text-emerald-600 dark:text-emerald-400 font-bold text-base border-t border-slate-200 dark:border-slate-600 pt-2 mt-1">
                  <span>TOTALI</span>
                  <span>{fmt(data.totalAmount)} €</span>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-400">
                <span>Mënyra: <span className="text-slate-600 dark:text-slate-300 font-medium">{methodLabel(data.method)}</span></span>
              </div>
            </div>
          )}
        </div>

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
