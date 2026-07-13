"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import Link from "next/link";
import { ChevronLeft, Save, Plus, Trash2, X } from "lucide-react";

interface Student { id: number; firstName: string; lastName: string }
interface InvoiceItem {
  description: string;
  quantity: number;
  regularPrice: number;
  discountPct: number;
  unitPrice: number;   // auto: regularPrice * (1 - discountPct/100)
  total: number;       // auto: quantity * unitPrice
}

function calcItem(item: InvoiceItem): InvoiceItem {
  const unit  = item.regularPrice > 0
    ? Math.round(item.regularPrice * (1 - item.discountPct / 100) * 100) / 100
    : item.unitPrice;
  return { ...item, unitPrice: unit, total: Math.round(item.quantity * unit * 100) / 100 };
}

function fmt(v: number) {
  return new Intl.NumberFormat("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
}

function InvoiceForm() {
  const searchParams  = useSearchParams();
  const router        = useRouter();
  const preStudentId  = searchParams.get("studentId") || "";

  const [students, setStudents] = useState<Student[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState("");

  const [form, setForm] = useState({
    studentId: preStudentId,
    type:      "INVOICE",
    vatRate:   "0",
    dueDate:   "",
    notes:     "",
  });

  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "", quantity: 1, regularPrice: 0, discountPct: 0, unitPrice: 0, total: 0 },
  ]);

  useEffect(() => {
    fetch("/api/students?limit=2000&status=ACTIVE").then(r => r.json()).then(d =>
      setStudents([...(d.students || [])].sort((a: Student, b: Student) =>
        a.lastName.localeCompare(b.lastName, "sq", { sensitivity: "base" }) ||
        a.firstName.localeCompare(b.firstName, "sq", { sensitivity: "base" })
      ))
    );
  }, []);

  function setField(field: string, value: string) { setForm(f => ({ ...f, [field]: value })); }

  function updateItem(i: number, field: keyof InvoiceItem, value: string | number) {
    setItems(prev => prev.map((item, idx) => {
      if (idx !== i) return item;
      return calcItem({ ...item, [field]: value });
    }));
  }

  function addItem() {
    setItems(p => [...p, { description: "", quantity: 1, regularPrice: 0, discountPct: 0, unitPrice: 0, total: 0 }]);
  }

  function removeItem(i: number) { if (items.length > 1) setItems(p => p.filter((_, idx) => idx !== i)); }

  const subtotal  = items.reduce((s, i) => s + i.total, 0);
  const vatRate   = parseFloat(form.vatRate || "0");
  const vatAmount = (subtotal * vatRate) / 100;
  const total     = subtotal + vatAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true); setError("");
    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, items }),
    });
    setLoading(false);
    if (res.ok) { const inv = await res.json(); router.push(`/invoices/${inv.id}`); }
    else setError("Ndodhi një gabim. Provoni sërish.");
  }

  return (
    <>
      <Header />
      <div className="p-6 max-w-4xl mx-auto animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/invoices" className="text-slate-400 hover:text-slate-600">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="page-title">Faturë e Re</h1>
            <p className="text-sm text-slate-400 mt-0.5">Krijo faturë, profaturë ose ofertë</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

          {/* Header info */}
          <div className="card p-5 space-y-4">
            <h3 className="section-title">Informacioni i Faturës</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">Lloji <span className="text-red-500">*</span></label>
                <select value={form.type} onChange={e => setField("type", e.target.value)} className="form-input">
                  <option value="INVOICE">Faturë</option>
                  <option value="PROFORMA">Profaturë</option>
                  <option value="OFFER">Ofertë</option>
                </select>
              </div>
              <div className="md:col-span-2">
                <label className="form-label">Nxënësi <span className="text-red-500">*</span></label>
                <select value={form.studentId} onChange={e => setField("studentId", e.target.value)} className="form-input" required>
                  <option value="">— Zgjidh nxënësin —</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Afati i Pagesës</label>
                <input type="date" value={form.dueDate} onChange={e => setField("dueDate", e.target.value)} className="form-input" />
              </div>
              <div>
                <label className="form-label">TVSH (%)</label>
                <input type="number" value={form.vatRate} onChange={e => setField("vatRate", e.target.value)} className="form-input" min="0" max="100" />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">Zërat e Faturës</h3>
              <button type="button" onClick={addItem} className="btn-secondary text-xs">
                <Plus className="w-3.5 h-3.5" /> Shto Zë
              </button>
            </div>

            {/* Column headers */}
            <div className="grid grid-cols-12 gap-2 text-[10px] font-semibold text-slate-400 uppercase tracking-wider px-2 mb-1">
              <div className="col-span-4">Përshkrimi</div>
              <div className="col-span-1 text-right">Sasi</div>
              <div className="col-span-2 text-right">Çm. Rregullt (€)</div>
              <div className="col-span-2 text-right">Zbritja (%)</div>
              <div className="col-span-2 text-right">Çm. Final / Totali</div>
              <div className="col-span-1" />
            </div>

            <div className="space-y-2">
              {items.map((item, i) => {
                const discAmt = item.regularPrice > 0 ? Math.round(item.regularPrice * (item.discountPct / 100) * 100) / 100 : 0;
                return (
                  <div key={i} className="grid grid-cols-12 gap-2 items-start">
                    {/* Përshkrimi */}
                    <div className="col-span-4">
                      <input
                        type="text"
                        value={item.description}
                        onChange={e => updateItem(i, "description", e.target.value)}
                        className="form-input"
                        placeholder="Shkollimi, Ushqimi..."
                        required
                      />
                    </div>

                    {/* Sasia */}
                    <div className="col-span-1">
                      <input
                        type="number" min="1" step="0.5"
                        value={item.quantity}
                        onChange={e => updateItem(i, "quantity", parseFloat(e.target.value) || 1)}
                        className="form-input text-right"
                      />
                    </div>

                    {/* Çmimi i Rregullt */}
                    <div className="col-span-2">
                      <input
                        type="number" min="0" step="0.01"
                        value={item.regularPrice || ""}
                        onChange={e => updateItem(i, "regularPrice", parseFloat(e.target.value) || 0)}
                        className="form-input text-right"
                        placeholder="0.00"
                      />
                    </div>

                    {/* Zbritja % */}
                    <div className="col-span-2">
                      <input
                        type="number" min="0" max="100" step="0.5"
                        value={item.discountPct || ""}
                        onChange={e => updateItem(i, "discountPct", parseFloat(e.target.value) || 0)}
                        className="form-input text-right"
                        placeholder="0"
                      />
                      {discAmt > 0 && (
                        <p className="text-[10px] text-green-600 text-right mt-0.5">− {fmt(discAmt)} €</p>
                      )}
                    </div>

                    {/* Çmimi final + totali */}
                    <div className="col-span-2 text-right pt-2">
                      {item.regularPrice > 0 && item.discountPct > 0 && (
                        <p className="text-[10px] text-slate-400 line-through">{fmt(item.regularPrice)} €</p>
                      )}
                      <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{fmt(item.unitPrice)} €</p>
                      {item.quantity > 1 && (
                        <p className="text-[10px] text-primary-600 font-bold">= {fmt(item.total)} €</p>
                      )}
                    </div>

                    {/* Fshi */}
                    <div className="col-span-1 flex justify-end pt-2">
                      <button type="button" onClick={() => removeItem(i)} className="p-1 text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Totals */}
            <div className="mt-5 pt-4 border-t border-slate-100 dark:border-slate-700 flex justify-end">
              <div className="w-64 space-y-2">
                {items.some(i => i.discountPct > 0) && (
                  <div className="flex justify-between text-xs text-slate-400">
                    <span>Çmimi pa zbritje:</span>
                    <span>{fmt(items.reduce((s, i) => s + i.regularPrice * i.quantity, 0))} €</span>
                  </div>
                )}
                {items.some(i => i.discountPct > 0) && (
                  <div className="flex justify-between text-xs text-green-600">
                    <span>Zbritja totale:</span>
                    <span>− {fmt(items.reduce((s, i) => s + Math.round(i.regularPrice * (i.discountPct / 100) * i.quantity * 100) / 100, 0))} €</span>
                  </div>
                )}
                <div className="flex justify-between text-sm text-slate-500">
                  <span>Nëntotali:</span><span>{fmt(subtotal)} €</span>
                </div>
                {vatRate > 0 && (
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>TVSH ({vatRate}%):</span><span>{fmt(vatAmount)} €</span>
                  </div>
                )}
                <div className="flex justify-between text-base font-bold border-t border-slate-200 dark:border-slate-600 pt-2">
                  <span>TOTALI:</span>
                  <span className="text-primary-600">{fmt(total)} €</span>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="card p-5">
            <label className="form-label">Shënime</label>
            <textarea value={form.notes} onChange={e => setField("notes", e.target.value)}
              className="form-input min-h-[80px] resize-none" placeholder="Shënime shtesë për faturën..." />
          </div>

          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => router.back()} className="btn-secondary">
              <X className="w-4 h-4" /> Anulo
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              <Save className="w-4 h-4" />
              {loading ? "Duke krijuar..." : "Krijo Faturën"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export default function NewInvoicePage() {
  return <Suspense><InvoiceForm /></Suspense>;
}
