"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import * as XLSX from "xlsx";
import {
  ChevronLeft, Plus, X, Sparkles, CheckCircle, Trash2, Download, Loader2, Package,
} from "lucide-react";

interface Product { id: number; name: string; buyPrice: number; stock: number; stockAlert: number; active: boolean }
interface OrderItem { id: number; productId: number; quantity: number; buyPrice: number; total: number; product: { name: string } }
interface Order {
  id: number; orderNumber: string; supplier: string | null; status: string;
  orderDate: string; receivedDate: string | null; notes: string | null; items: OrderItem[];
}

const STATUS_LABELS: Record<string, string> = { ORDERED: "Porositur", RECEIVED: "Mbërriti", CANCELLED: "Anuluar" };
const STATUS_COLORS: Record<string, string> = {
  ORDERED:   "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  RECEIVED:  "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  CANCELLED: "bg-slate-100 dark:bg-slate-700 text-slate-500",
};

export default function PorositePage() {
  const [orders, setOrders]     = useState<Order[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving]     = useState(false);
  const [busyId, setBusyId]     = useState<number | null>(null);

  const [supplier, setSupplier] = useState("");
  const [items, setItems] = useState<{ productId: string; quantity: string; buyPrice: string }[]>([]);

  const fetchOrders = useCallback(async () => {
    const r = await fetch("/api/uniforms/orders");
    if (r.ok) setOrders(await r.json());
  }, []);

  useEffect(() => {
    Promise.all([
      fetch("/api/uniforms/orders").then(r => r.json()),
      fetch("/api/uniforms/products").then(r => r.json()),
    ]).then(([o, p]) => { setOrders(o); setProducts(p); setLoading(false); });
  }, []);

  function openForm() {
    setSupplier("");
    setItems([{ productId: "", quantity: "1", buyPrice: "" }]);
    setShowForm(true);
  }

  function recommend() {
    const low = products.filter(p => p.active && p.stock <= p.stockAlert);
    if (low.length === 0) { alert("Asnjë produkt s'është nën pragun e stokut aktualisht."); return; }
    setItems(low.map(p => ({
      productId: String(p.id),
      quantity: String(Math.max(1, p.stockAlert * 2 - p.stock)),
      buyPrice: String(p.buyPrice),
    })));
  }

  function addItem() { setItems(prev => [...prev, { productId: "", quantity: "1", buyPrice: "" }]); }
  function removeItem(i: number) { setItems(prev => prev.filter((_, idx) => idx !== i)); }
  function setItem(i: number, field: "productId" | "quantity" | "buyPrice", val: string) {
    setItems(prev => prev.map((it, idx) => {
      if (idx !== i) return it;
      const next = { ...it, [field]: val };
      if (field === "productId") {
        const p = products.find(pr => String(pr.id) === val);
        if (p) next.buyPrice = String(p.buyPrice);
      }
      return next;
    }));
  }

  const total = items.reduce((s, it) => s + (parseFloat(it.quantity) || 0) * (parseFloat(it.buyPrice) || 0), 0);

  async function saveOrder() {
    const valid = items.filter(it => it.productId && parseFloat(it.quantity) > 0);
    if (valid.length === 0) { alert("Shto të paktën një artikull me sasi."); return; }
    setSaving(true);
    const r = await fetch("/api/uniforms/orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        supplier: supplier || null,
        items: valid.map(it => ({
          productId: parseInt(it.productId),
          quantity: parseInt(it.quantity),
          buyPrice: parseFloat(it.buyPrice) || 0,
        })),
      }),
    });
    setSaving(false);
    if (r.ok) { setShowForm(false); fetchOrders(); }
    else { const d = await r.json().catch(() => ({})); alert(d.error || "Gabim gjatë ruajtjes."); }
  }

  async function markReceived(order: Order) {
    if (!confirm(`Shëno porosinë ${order.orderNumber} si "Mbërriti"? Stoku i produkteve do të rritet automatikisht.`)) return;
    setBusyId(order.id);
    await fetch(`/api/uniforms/orders/${order.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "RECEIVED" }),
    });
    setBusyId(null);
    fetchOrders();
    fetch("/api/uniforms/products").then(r => r.json()).then(setProducts);
  }

  async function deleteOrder(order: Order) {
    if (!confirm(`Fshi porosinë ${order.orderNumber}?`)) return;
    setBusyId(order.id);
    const r = await fetch(`/api/uniforms/orders/${order.id}`, { method: "DELETE" });
    setBusyId(null);
    if (r.ok) fetchOrders();
    else { const d = await r.json().catch(() => ({})); alert(d.error || "Gabim gjatë fshirjes."); }
  }

  function exportExcel() {
    const rows = orders.flatMap(o => o.items.map(it => ({
      "Nr. Porosisë": o.orderNumber,
      "Furnitori":    o.supplier || "",
      "Data":         formatDate(o.orderDate),
      "Statusi":      STATUS_LABELS[o.status] || o.status,
      "Produkti":     it.product.name,
      "Sasia":        it.quantity,
      "Çmimi (€)":    it.buyPrice,
      "Totali (€)":   it.total,
    })));
    const ws = XLSX.utils.json_to_sheet(rows);
    ws["!cols"] = [{ wch: 14 }, { wch: 16 }, { wch: 12 }, { wch: 12 }, { wch: 20 }, { wch: 8 }, { wch: 10 }, { wch: 10 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Porositë");
    XLSX.writeFile(wb, `Porosite-Uniforma-${new Date().toISOString().split("T")[0]}.xlsx`);
  }

  return (
    <div className="p-6 space-y-4 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/uniforma" className="text-slate-400 hover:text-slate-600"><ChevronLeft className="w-5 h-5" /></Link>
        <div className="flex-1">
          <h1 className="page-title">Porositë</h1>
          <p className="text-sm text-slate-400 mt-0.5">Historiku i porosive te furnitorët, dhe rimbushja e stokut</p>
        </div>
        <button onClick={exportExcel} className="btn-secondary" disabled={orders.length === 0}>
          <Download className="w-4 h-4" /> Exporto Excel
        </button>
        <button onClick={openForm} className="btn-primary">
          <Plus className="w-4 h-4" /> Porosi e Re
        </button>
      </div>

      {showForm && (
        <div className="card p-5 space-y-4 border-2 border-primary-200 dark:border-primary-800">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-slate-900 dark:text-white">Porosi e Re</h3>
            <button onClick={() => setShowForm(false)} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
          </div>

          <div className="flex items-end gap-3 flex-wrap">
            <div>
              <label className="form-label">Furnitori</label>
              <input value={supplier} onChange={e => setSupplier(e.target.value)} className="form-input w-56" placeholder="Emri i furnitorit..." />
            </div>
            <button onClick={recommend} className="btn-secondary text-amber-600 border-amber-200 hover:bg-amber-50">
              <Sparkles className="w-4 h-4" /> Rekomando automatikisht (stok i ulët)
            </button>
          </div>

          <div className="space-y-2">
            {items.map((it, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-center">
                <select value={it.productId} onChange={e => setItem(i, "productId", e.target.value)} className="form-input col-span-6">
                  <option value="">— Zgjidh produktin —</option>
                  {products.filter(p => p.active).map(p => (
                    <option key={p.id} value={p.id}>{p.name} (stok: {p.stock})</option>
                  ))}
                </select>
                <input type="number" min="1" value={it.quantity} onChange={e => setItem(i, "quantity", e.target.value)}
                  className="form-input col-span-2 text-right" placeholder="Sasia" />
                <input type="number" min="0" step="0.01" value={it.buyPrice} onChange={e => setItem(i, "buyPrice", e.target.value)}
                  className="form-input col-span-2 text-right" placeholder="Çmimi" />
                <span className="col-span-1 text-sm text-right text-slate-500">
                  {formatCurrency((parseFloat(it.quantity) || 0) * (parseFloat(it.buyPrice) || 0))}
                </span>
                <button onClick={() => removeItem(i)} className="col-span-1 text-slate-300 hover:text-red-500 flex justify-end">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>

          <button onClick={addItem} className="btn-secondary text-sm"><Plus className="w-3.5 h-3.5" /> Shto artikull</button>

          <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-slate-700">
            <span className="text-sm text-slate-500">Vlera totale e porosisë</span>
            <span className="text-lg font-bold text-primary-600">{formatCurrency(total)}</span>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="btn-secondary">Anulo</button>
            <button onClick={saveOrder} disabled={saving} className="btn-primary">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              Ruaj Porosinë
            </button>
          </div>
        </div>
      )}

      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="table-header">Numri</th>
                <th className="table-header">Furnitori</th>
                <th className="table-header">Data</th>
                <th className="table-header">Artikuj</th>
                <th className="table-header text-right">Vlera</th>
                <th className="table-header">Statusi</th>
                <th className="table-header text-right">Veprime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr><td colSpan={7} className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary-400 mx-auto" /></td></tr>
              ) : orders.length === 0 ? (
                <tr><td colSpan={7} className="py-16 text-center text-slate-400 text-sm">
                  <Package className="w-8 h-8 opacity-20 mx-auto mb-2" />Asnjë porosi ende.
                </td></tr>
              ) : orders.map(o => {
                const value = o.items.reduce((s, it) => s + it.total, 0);
                return (
                  <tr key={o.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="table-cell font-mono text-sm font-medium">{o.orderNumber}</td>
                    <td className="table-cell text-slate-600 dark:text-slate-300">{o.supplier || "—"}</td>
                    <td className="table-cell text-slate-400 text-xs">{formatDate(o.orderDate)}</td>
                    <td className="table-cell text-slate-400 text-xs">{o.items.length} artikuj</td>
                    <td className="table-cell text-right font-semibold">{formatCurrency(value)}</td>
                    <td className="table-cell">
                      <span className={`badge ${STATUS_COLORS[o.status] || ""}`}>{STATUS_LABELS[o.status] || o.status}</span>
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        {o.status === "ORDERED" && (
                          <button onClick={() => markReceived(o)} disabled={busyId === o.id}
                            className="btn-secondary text-xs text-green-600 border-green-200 hover:bg-green-50">
                            {busyId === o.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle className="w-3.5 h-3.5" />}
                            Mbërriti
                          </button>
                        )}
                        {o.status !== "RECEIVED" && (
                          <button onClick={() => deleteOrder(o)} disabled={busyId === o.id}
                            className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
