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

function printReceipt(sale: Sale) {
  const win = window.open("", "_blank", "width=400,height=700");
  if (!win) return;
  const itemRows = sale.items.map(item =>
    `<tr>
      <td style="padding:4px 0">${item.product.name}</td>
      <td style="text-align:right;padding:4px 0">${item.quantity}×${formatCurrency(item.sellPrice)}</td>
      <td style="text-align:right;padding:4px 0;font-weight:600">${formatCurrency(item.total)}</td>
    </tr>`
  ).join("");
  const payRows = sale.payments.map(p =>
    `<tr>
      <td style="padding:2px 0">${new Date(p.paidAt).toLocaleDateString("sq-AL")} · ${METHOD_LABEL[p.method] ?? p.method}</td>
      <td style="text-align:right;padding:2px 0;color:#16a34a;font-weight:600">${formatCurrency(p.amount)}</td>
    </tr>`
  ).join("");
  win.document.write(`<!DOCTYPE html><html lang="sq"><head><meta charset="UTF-8"/><title>Dëftesë #${sale.id}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI',Arial,sans-serif; font-size:13px; color:#0f172a; padding:32px 24px; max-width:360px; }
h1 { font-size:18px; font-weight:700; }
.sub { color:#64748b; font-size:11px; }
hr { border:none; border-top:1px dashed #cbd5e1; margin:14px 0; }
table { width:100%; border-collapse:collapse; }
.total-row { font-weight:700; font-size:15px; }
.paid-row { color:#16a34a; font-weight:600; }
.debt-row { color:#dc2626; font-weight:700; }
.footer { color:#94a3b8; font-size:11px; text-align:center; margin-top:24px; }
@media print { body { padding:16px; } }
</style></head><body>
<div style="text-align:center;margin-bottom:20px">
  <h1>Akademia Ora</h1>
  <p class="sub">Dëftesë Pagese — Uniforma</p>
  <p class="sub">#${sale.id} · ${new Date(sale.saleDate).toLocaleDateString("sq-AL", { dateStyle: "long" })}</p>
</div>
<div style="margin-bottom:12px">
  <strong>${sale.customerName}</strong>
  ${sale.customerPhone ? `<br><span class="sub">${sale.customerPhone}</span>` : ""}
</div>
<hr/>
<table>
  <thead><tr><th style="text-align:left;color:#64748b;font-size:11px;padding-bottom:6px">Artikulli</th><th style="text-align:right;color:#64748b;font-size:11px">Sasi</th><th style="text-align:right;color:#64748b;font-size:11px">Total</th></tr></thead>
  <tbody>${itemRows}</tbody>
</table>
<hr/>
<table>
  <tr class="total-row"><td>TOTALI</td><td style="text-align:right">${formatCurrency(sale.totalAmount)}</td></tr>
  ${payRows ? `<tr><td colspan="2" style="padding-top:8px;font-size:11px;color:#64748b">Pagesat:</td></tr>${payRows}` : ""}
  <tr class="paid-row" style="border-top:1px dashed #cbd5e1;margin-top:4px"><td style="padding-top:8px">E paguar</td><td style="text-align:right;padding-top:8px">${formatCurrency(sale.paidAmount)}</td></tr>
  ${sale.balance > 0 ? `<tr class="debt-row"><td>Borxhi</td><td style="text-align:right">${formatCurrency(sale.balance)}</td></tr>` : ""}
</table>
<div class="footer" style="margin-top:20px"><hr style="margin-bottom:12px"/>Faleminderit! · Akademia Ora, Prishtinë</div>
</body></html>`);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 300);
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
