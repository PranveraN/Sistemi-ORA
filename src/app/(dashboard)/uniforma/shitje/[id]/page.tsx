"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Plus, CreditCard, Package, Calendar, Phone, User } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface SaleItem {
  id: number;
  quantity: number;
  size: string | null;
  sellPrice: number;
  buyPrice: number;
  total: number;
  profit: number;
  product: { name: string };
}

interface Payment {
  id: number;
  amount: number;
  method: string;
  notes: string | null;
  paidAt: string;
}

interface Sale {
  id: number;
  customerName: string;
  customerPhone: string | null;
  totalAmount: number;
  totalCost: number;
  profit: number;
  paidAmount: number;
  balance: number;
  status: string;
  saleDate: string;
  notes: string | null;
  items: SaleItem[];
  payments: Payment[];
}

const STATUS_MAP: Record<string, { label: string; cls: string }> = {
  PAID:    { label: "Paguar",     cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  PARTIAL: { label: "Pjesërisht", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  PENDING: { label: "Pa pagesë",  cls: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-400" },
};

const METHOD_LABEL: Record<string, string> = { CASH: "Cash", BANK: "Bankë", CARD: "Kartë" };

function buildUniformReceiptHTML(sale: Sale, copy: "prind" | "shkolla"): string {
  const dateStr = new Date(sale.saleDate).toLocaleDateString("sq-AL");
  const itemRows = sale.items.map(item =>
    `<tr>
      <td class="td">${item.product.name}${item.size ? ` <span class="size">${item.size}</span>` : ""}</td>
      <td class="td-r">${item.quantity} × ${formatCurrency(item.sellPrice)}</td>
      <td class="td-r bold">${formatCurrency(item.total)}</td>
    </tr>`
  ).join("");
  const payRows = sale.payments.map(p =>
    `<div class="pay-row">
      <span>${new Date(p.paidAt).toLocaleDateString("sq-AL")} · ${METHOD_LABEL[p.method] ?? p.method}${p.notes ? ` · ${p.notes}` : ""}</span>
      <span class="green bold">${formatCurrency(p.amount)}</span>
    </div>`
  ).join("");

  return `
<div class="receipt">
  <div class="header">
    <div class="logo">AO</div>
    <div class="school-info">
      <div class="school-name">Akademia Ora</div>
      <div class="school-sub">Uniforma &bull; Dëftesë Pagese</div>
    </div>
    <div class="meta">
      <div class="meta-title">DËFTESË</div>
      <div class="meta-num">#${sale.id}</div>
      <div class="meta-date">${dateStr}</div>
    </div>
  </div>

  <div class="divider"></div>

  <div class="customer">
    <span class="lbl">Klienti</span>
    <span class="bold">${sale.customerName}</span>
    ${sale.customerPhone ? `<span class="sub">${sale.customerPhone}</span>` : ""}
  </div>

  <div class="divider"></div>

  <table class="items-table">
    <thead>
      <tr>
        <th class="th">Artikulli</th>
        <th class="th-r">Sasi × Çmimi</th>
        <th class="th-r">Total</th>
      </tr>
    </thead>
    <tbody>${itemRows}</tbody>
  </table>

  <div class="amounts-box">
    <div class="amount-row total-row"><span>TOTALI</span><span>${formatCurrency(sale.totalAmount)}</span></div>
    ${sale.payments.length > 0 ? `<div class="divider-thin"></div><div class="pays-label">Pagesat:</div>${payRows}` : ""}
    <div class="divider-thin"></div>
    <div class="amount-row paid-row"><span>E paguar</span><span>${formatCurrency(sale.paidAmount)}</span></div>
    ${sale.balance > 0 ? `<div class="amount-row debt-row"><span>Borxhi i mbetur</span><span>${formatCurrency(sale.balance)}</span></div>` : `<div class="amount-row paid-row"><span>Borxhi i mbetur</span><span>&#10003; Pa borxh</span></div>`}
  </div>

  <div class="footer-grid">
    <div class="sig-box"><div class="sig-line"></div><div class="sig-lbl">Nënshkrimi i klientit</div></div>
    <div class="sig-box"><div class="sig-line"></div><div class="sig-lbl">Vula dhe nënshkrimi i shkollës</div></div>
  </div>

  <div class="copy-label">${copy === "prind" ? "Kopja e Klientit" : "Kopja e Shkollës — Arkiv"}</div>
</div>`;
}

function printReceipt(sale: Sale) {
  const win = window.open("", "_blank", "width=820,height=1200");
  if (!win) return;
  const html1 = buildUniformReceiptHTML(sale, "prind");
  const html2 = buildUniformReceiptHTML(sale, "shkolla");
  win.document.write(`<!DOCTYPE html><html lang="sq"><head>
<meta charset="UTF-8"/>
<title>Dëftesë #${sale.id}</title>
<style>
@page { size: A4 portrait; margin: 8mm; }
* { margin:0; padding:0; box-sizing:border-box; }
html, body { height:100%; font-family:Arial,Helvetica,sans-serif; background:#fff; color:#000; -webkit-print-color-adjust:exact; print-color-adjust:exact; }
.page { width:100%; height:100%; display:flex; flex-direction:column; }
.receipt { flex:1 1 0; min-height:0; padding:9mm 13mm 7mm; overflow:hidden; }
.cut-line { flex:0 0 auto; border:none; border-top:1px dashed #888; margin:3mm 13mm; position:relative; text-align:center; }
.cut-line::after { content:"✂"; position:absolute; top:-9px; left:50%; transform:translateX(-50%); background:#fff; padding:0 5px; font-size:13px; color:#aaa; }
.header { display:flex; align-items:flex-start; gap:10px; margin-bottom:6px; }
.logo { width:36px; height:36px; background:#7c3aed; border-radius:8px; display:flex; align-items:center; justify-content:center; color:#fff; font-weight:900; font-size:13px; flex-shrink:0; }
.school-info { flex:1; }
.school-name { font-size:14px; font-weight:800; color:#4c1d95; }
.school-sub { font-size:8.5px; color:#64748b; margin-top:1px; }
.meta { text-align:right; }
.meta-title { font-size:12px; font-weight:800; letter-spacing:.06em; color:#4c1d95; text-transform:uppercase; }
.meta-num { font-size:10px; font-family:monospace; color:#475569; margin-top:2px; }
.meta-date { font-size:8.5px; color:#94a3b8; margin-top:1px; }
.divider { border:none; border-top:2px solid #e2e8f0; margin:5px 0; }
.divider-thin { border:none; border-top:1px solid #e2e8f0; margin:3px 0; }
.customer { display:flex; gap:8px; align-items:baseline; flex-wrap:wrap; font-size:10px; margin-bottom:5px; }
.lbl { color:#64748b; }
.bold { font-weight:700; color:#0f172a; }
.sub { color:#64748b; font-size:8.5px; }
.green { color:#047857; }
.items-table { width:100%; border-collapse:collapse; font-size:9.5px; margin-bottom:7px; }
.th { text-align:left; color:#64748b; font-size:8px; padding-bottom:4px; font-weight:600; text-transform:uppercase; }
.th-r { text-align:right; color:#64748b; font-size:8px; padding-bottom:4px; font-weight:600; text-transform:uppercase; }
.td { padding:2px 0; color:#0f172a; }
.td-r { text-align:right; padding:2px 0; color:#475569; }
.size { display:inline-block; background:#ede9fe; color:#6d28d9; border-radius:3px; padding:0 4px; font-size:8px; font-weight:700; margin-left:3px; }
.amounts-box { background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:7px 10px; margin-bottom:7px; }
.amount-row { display:flex; justify-content:space-between; font-size:10px; padding:2px 0; }
.total-row { font-weight:800; font-size:12px; color:#0f172a; }
.paid-row { font-weight:700; color:#047857; }
.debt-row { font-weight:700; color:#dc2626; }
.pays-label { font-size:8px; color:#94a3b8; margin:2px 0; }
.pay-row { display:flex; justify-content:space-between; font-size:9px; color:#64748b; padding:1px 0; }
.footer-grid { display:grid; grid-template-columns:1fr 1fr; gap:8px; margin-top:10px; }
.sig-box { }
.sig-line { border-top:1px solid #94a3b8; margin-bottom:3px; margin-top:16px; }
.sig-lbl { font-size:7.5px; color:#64748b; text-align:center; }
.copy-label { display:inline-block; margin-top:6px; font-size:7.5px; font-weight:700; color:#fff; background:#7c3aed; padding:2px 7px; border-radius:3px; letter-spacing:.06em; text-transform:uppercase; }
</style></head><body>
<div class="page">
  ${html1}
  <div class="cut-line"></div>
  ${html2}
</div>
<script>window.onload=()=>{window.print();}<\/script>
</body></html>`);
  win.document.close();
}

export default function SaleDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [sale, setSale] = useState<Sale | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPayModal, setShowPayModal] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("CASH");
  const [payNotes, setPayNotes] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    fetch(`/api/uniforms/sales/${id}`)
      .then(r => r.json())
      .then(setSale)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [id]);

  const addPayment = async () => {
    if (!sale) return;
    setSaving(true);
    await fetch(`/api/uniforms/sales/${sale.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: parseFloat(payAmount),
        method: payMethod,
        notes: payNotes.trim() || null,
        paidAt: payDate,
      }),
    });
    setSaving(false);
    setShowPayModal(false);
    setPayAmount(""); setPayNotes("");
    load();
  };

  if (loading) return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
    </div>
  );
  if (!sale) return <div className="p-6 text-slate-400">Shitja nuk u gjet.</div>;

  const st = STATUS_MAP[sale.status] ?? STATUS_MAP.PENDING;

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
            <ArrowLeft className="w-5 h-5 text-slate-500" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Shitja #{sale.id}</h1>
            <p className="text-sm text-slate-400 mt-0.5">{new Date(sale.saleDate).toLocaleDateString("sq-AL", { dateStyle: "long" })}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => printReceipt(sale)} className="btn-ghost">
            <Printer className="w-4 h-4" /> Printo Dëftesë
          </button>
          {sale.status !== "PAID" && (
            <button onClick={() => setShowPayModal(true)} className="btn-primary">
              <Plus className="w-4 h-4" /> Shto Pagesë
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: items + payments */}
        <div className="lg:col-span-2 space-y-4">
          {/* Items */}
          <div className="card p-5">
            <h2 className="font-semibold text-slate-800 dark:text-white mb-4 text-sm flex items-center gap-2">
              <Package className="w-4 h-4 text-purple-500" /> Artikujt e shitur
            </h2>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800">
                  <th className="text-left py-2 text-xs text-slate-400 font-semibold uppercase">Produkti</th>
                  <th className="text-center py-2 text-xs text-slate-400 font-semibold uppercase">Nr./Madhësia</th>
                  <th className="text-right py-2 text-xs text-slate-400 font-semibold uppercase">Çmimi</th>
                  <th className="text-right py-2 text-xs text-slate-400 font-semibold uppercase">Sasi</th>
                  <th className="text-right py-2 text-xs text-slate-400 font-semibold uppercase">Totali</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {sale.items.map(item => (
                  <tr key={item.id}>
                    <td className="py-3 font-medium text-slate-800 dark:text-slate-200">{item.product.name}</td>
                    <td className="py-3 text-center">
                      {item.size
                        ? <span className="inline-block px-2.5 py-1 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-lg font-bold text-xs">{item.size}</span>
                        : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="py-3 text-right text-slate-500">{formatCurrency(item.sellPrice)}</td>
                    <td className="py-3 text-right text-slate-500">{item.quantity}</td>
                    <td className="py-3 text-right font-semibold text-slate-800 dark:text-slate-200">{formatCurrency(item.total)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t border-slate-200 dark:border-slate-700">
                  <td colSpan={3} className="py-3 font-bold text-slate-700 dark:text-slate-200">Totali</td>
                  <td className="py-3 text-right font-bold text-lg text-slate-900 dark:text-white">{formatCurrency(sale.totalAmount)}</td>
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Payments */}
          <div className="card p-5">
            <h2 className="font-semibold text-slate-800 dark:text-white mb-4 text-sm flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-green-500" /> Pagesat ({sale.payments.length})
            </h2>
            {sale.payments.length === 0 ? (
              <p className="text-sm text-slate-400 py-4 text-center">Nuk ka pagesa të regjistruara</p>
            ) : (
              <div className="space-y-2">
                {sale.payments.map(p => (
                  <div key={p.id} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-slate-800 rounded-xl">
                    <div>
                      <p className="font-medium text-slate-800 dark:text-slate-200 text-sm">{formatCurrency(p.amount)}</p>
                      <p className="text-xs text-slate-400">
                        {new Date(p.paidAt).toLocaleDateString("sq-AL")} · {METHOD_LABEL[p.method] ?? p.method}
                        {p.notes && ` · ${p.notes}`}
                      </p>
                    </div>
                    <span className="badge bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs">E regjistruar</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right: summary */}
        <div className="space-y-4">
          <div className="card p-5 space-y-3">
            <h2 className="font-semibold text-slate-800 dark:text-white text-sm">Klienti</h2>
            <div className="flex items-center gap-2 text-sm">
              <User className="w-4 h-4 text-slate-400" />
              <span className="text-slate-700 dark:text-slate-200 font-medium">{sale.customerName}</span>
            </div>
            {sale.customerPhone && (
              <div className="flex items-center gap-2 text-sm">
                <Phone className="w-4 h-4 text-slate-400" />
                <span className="text-slate-500">{sale.customerPhone}</span>
              </div>
            )}
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="w-4 h-4 text-slate-400" />
              <span className="text-slate-500">{new Date(sale.saleDate).toLocaleDateString("sq-AL")}</span>
            </div>
          </div>

          <div className="card p-5 space-y-3">
            <h2 className="font-semibold text-slate-800 dark:text-white text-sm">Statusi</h2>
            <span className={`badge ${st.cls} text-sm`}>{st.label}</span>
            <div className="space-y-2 pt-2">
              {[
                { l: "Totali",   v: formatCurrency(sale.totalAmount), cls: "font-bold text-slate-800 dark:text-slate-200" },
                { l: "E paguar", v: formatCurrency(sale.paidAmount),  cls: "text-green-600" },
                { l: "Borxhi",   v: formatCurrency(sale.balance),     cls: "text-amber-600 font-semibold" },
                { l: "Fitimi",   v: formatCurrency(sale.profit),      cls: "text-primary-600" },
              ].map(r => (
                <div key={r.l} className="flex justify-between text-sm">
                  <span className="text-slate-400">{r.l}</span>
                  <span className={r.cls}>{r.v}</span>
                </div>
              ))}
            </div>
          </div>

          {sale.notes && (
            <div className="card p-4">
              <p className="text-xs font-semibold text-slate-400 mb-1">Shënim</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{sale.notes}</p>
            </div>
          )}
        </div>
      </div>

      {/* Payment modal */}
      {showPayModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm">
            <div className="p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="font-semibold text-slate-900 dark:text-white">Shto Pagesë</h2>
              <p className="text-xs text-slate-400 mt-0.5">Mbetja: {formatCurrency(sale.balance)}</p>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="label">Shuma (€) *</label>
                <input className="input" type="number" step="0.01" placeholder="0.00" value={payAmount}
                  onChange={e => setPayAmount(e.target.value)} />
              </div>
              <div>
                <label className="label">Mënyra</label>
                <select className="input" value={payMethod} onChange={e => setPayMethod(e.target.value)}>
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bankë / Transfer</option>
                  <option value="CARD">Kartë</option>
                </select>
              </div>
              <div>
                <label className="label">Data</label>
                <input className="input" type="date" value={payDate} onChange={e => setPayDate(e.target.value)} />
              </div>
              <div>
                <label className="label">Shënim</label>
                <input className="input" placeholder="opsional" value={payNotes}
                  onChange={e => setPayNotes(e.target.value)} />
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setShowPayModal(false)} className="btn-ghost flex-1">Anulo</button>
              <button onClick={addPayment} disabled={saving || !payAmount} className="btn-primary flex-1">
                {saving ? "Duke ruajtur..." : "Shto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
