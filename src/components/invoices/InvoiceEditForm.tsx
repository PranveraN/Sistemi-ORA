"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Save, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface InvoiceItem {
  id: number;
  description: string;
  quantity: number;
  regularPrice: number;
  discountPct: number;
  unitPrice: number;
  total: number;
}

interface Invoice {
  id: number;
  number: string;
  vatRate: number;
  status: string;
  student: { id: number; firstName: string; lastName: string; parentName: string };
  items: InvoiceItem[];
}

export default function InvoiceEditForm({ invoice }: { invoice: Invoice }) {
  const router = useRouter();
  const [parentName, setParentName] = useState(invoice.student.parentName || "");
  const [items, setItems] = useState(invoice.items.map(it => ({ ...it })));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function updateItem(id: number, patch: Partial<InvoiceItem>) {
    setItems(list => list.map(it => it.id === id ? { ...it, ...patch } : it));
  }

  const computed = useMemo(() => items.map(it => {
    const unitPrice = Math.round(it.regularPrice * (1 - it.discountPct / 100) * 100) / 100;
    const total = Math.round(unitPrice * it.quantity * 100) / 100;
    return { ...it, unitPrice, total };
  }), [items]);

  const subtotal = Math.round(computed.reduce((s, it) => s + it.total, 0) * 100) / 100;
  const vatAmount = Math.round(subtotal * (invoice.vatRate / 100) * 100) / 100;
  const total = Math.round((subtotal + vatAmount) * 100) / 100;

  async function handleSave() {
    setSaving(true);
    setError("");
    const res = await fetch(`/api/invoices/${invoice.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parentName,
        items: computed.map(it => ({ id: it.id, description: it.description, quantity: it.quantity, regularPrice: it.regularPrice, discountPct: it.discountPct })),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(d.error || "Ruajtja dështoi."); return; }
    router.push(`/invoices/${invoice.id}`);
    router.refresh();
  }

  if (invoice.status === "PAID" || invoice.status === "CANCELLED") {
    return (
      <div className="p-6 max-w-2xl mx-auto">
        <p className="text-sm text-slate-500">Kjo faturë është {invoice.status === "PAID" ? "e paguar" : "e anuluar"} — s'mund të modifikohet.</p>
        <Link href={`/invoices/${invoice.id}`} className="text-primary-600 hover:underline text-sm mt-2 inline-block">Kthehu te fatura</Link>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-5 animate-fade-in">
      <Link href={`/invoices/${invoice.id}`} className="text-sm text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 w-fit">
        <ArrowLeft className="w-4 h-4" /> Kthehu te fatura {invoice.number}
      </Link>

      <div className="card p-5 space-y-3">
        <label className="form-label">Emri i Prindit</label>
        <input value={parentName} onChange={e => setParentName(e.target.value)} className="form-input max-w-sm" />
        <p className="text-[11px] text-slate-400">Ndryshimi këtu përditëson emrin e prindit kudo në sistem për {invoice.student.firstName} {invoice.student.lastName} (jo vetëm në këtë faturë).</p>
      </div>

      <div className="card overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700">
          <h2 className="font-semibold text-sm text-slate-700 dark:text-slate-200">Zërat e Faturës</h2>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-700">
          {computed.map(it => (
            <div key={it.id} className="p-4 grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
              <div className="col-span-2 md:col-span-2">
                <label className="form-label text-xs">Përshkrimi</label>
                <input value={it.description} onChange={e => updateItem(it.id, { description: e.target.value })} className="form-input text-sm" />
              </div>
              <div>
                <label className="form-label text-xs">Sasia</label>
                <input type="number" min={0} step="1" value={it.quantity} onChange={e => updateItem(it.id, { quantity: parseFloat(e.target.value) || 0 })} className="form-input text-sm" />
              </div>
              <div>
                <label className="form-label text-xs">Çmimi (€)</label>
                <input type="number" min={0} step="0.01" value={it.regularPrice} onChange={e => updateItem(it.id, { regularPrice: parseFloat(e.target.value) || 0 })} className="form-input text-sm" />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <label className="form-label text-xs">Zbritje (%)</label>
                  <input type="number" min={0} max={100} step="any" value={it.discountPct} onChange={e => updateItem(it.id, { discountPct: parseFloat(e.target.value) || 0 })} className="form-input text-sm" />
                </div>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200 pb-2 whitespace-nowrap">{formatCurrency(it.total)}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 flex flex-col items-end gap-1 text-sm">
          <div className="flex justify-between w-56"><span className="text-slate-400">Nëntotali</span><span>{formatCurrency(subtotal)}</span></div>
          {invoice.vatRate > 0 && (
            <div className="flex justify-between w-56"><span className="text-slate-400">TVSH ({invoice.vatRate}%)</span><span>{formatCurrency(vatAmount)}</span></div>
          )}
          <div className="flex justify-between w-56 font-bold text-slate-900 dark:text-white"><span>Totali</span><span>{formatCurrency(total)}</span></div>
        </div>
      </div>

      {error && <p className="text-sm text-red-500">{error}</p>}

      <div className="flex gap-2">
        <Link href={`/invoices/${invoice.id}`} className="btn-secondary">Anulo</Link>
        <button onClick={handleSave} disabled={saving} className="btn-primary">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {saving ? "Duke ruajtur..." : "Ruaj Ndryshimet"}
        </button>
      </div>
    </div>
  );
}
