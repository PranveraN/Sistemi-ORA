"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import Link from "next/link";
import { ChevronLeft, Save, Plus, Trash2, X } from "lucide-react";

interface Student { id: number; firstName: string; lastName: string }
interface InvoiceItem { description: string; quantity: number; unitPrice: number; total: number }

function InvoiceForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preStudentId = searchParams.get("studentId") || "";

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    studentId: preStudentId,
    type: "INVOICE",
    vatRate: "0",
    dueDate: "",
    notes: "",
  });

  const [items, setItems] = useState<InvoiceItem[]>([
    { description: "", quantity: 1, unitPrice: 0, total: 0 },
  ]);

  useEffect(() => {
    fetch("/api/students?limit=200").then(r => r.json()).then(d => setStudents(d.students));
  }, []);

  function setField(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  function updateItem(i: number, field: keyof InvoiceItem, value: string | number) {
    setItems(items => items.map((item, idx) => {
      if (idx !== i) return item;
      const updated = { ...item, [field]: value };
      updated.total = updated.quantity * updated.unitPrice;
      return updated;
    }));
  }

  function addItem() {
    setItems(i => [...i, { description: "", quantity: 1, unitPrice: 0, total: 0 }]);
  }

  function removeItem(i: number) {
    if (items.length === 1) return;
    setItems(items => items.filter((_, idx) => idx !== i));
  }

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const vatRate = parseFloat(form.vatRate || "0");
  const vatAmount = (subtotal * vatRate) / 100;
  const total = subtotal + vatAmount;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/invoices", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, items }),
    });

    setLoading(false);

    if (res.ok) {
      const inv = await res.json();
      router.push(`/invoices/${inv.id}`);
    } else {
      setError("Ndodhi një gabim. Provoni sërish.");
    }
  }

  return (
    <>
      <Header />
      <div className="p-6 max-w-3xl mx-auto animate-fade-in">
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
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {/* Header */}
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
                <select
                  value={form.studentId}
                  onChange={e => setField("studentId", e.target.value)}
                  className="form-input"
                  required
                >
                  <option value="">— Zgjidh nxënësin —</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.firstName} {s.lastName}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Afati i Pagesës</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => setField("dueDate", e.target.value)}
                  className="form-input"
                />
              </div>
              <div>
                <label className="form-label">TVSH (%)</label>
                <input
                  type="number"
                  value={form.vatRate}
                  onChange={e => setField("vatRate", e.target.value)}
                  className="form-input"
                  min="0" max="100"
                />
              </div>
            </div>
          </div>

          {/* Items */}
          <div className="card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="section-title">Zërat e Faturës</h3>
              <button type="button" onClick={addItem} className="btn-secondary text-xs">
                <Plus className="w-3.5 h-3.5" />
                Shto Zë
              </button>
            </div>

            <div className="space-y-2">
              <div className="grid grid-cols-12 gap-2 text-xs font-semibold text-slate-400 uppercase tracking-wider px-2">
                <div className="col-span-5">Përshkrimi</div>
                <div className="col-span-2 text-right">Sasi</div>
                <div className="col-span-2 text-right">Çmimi (Lekë)</div>
                <div className="col-span-2 text-right">Totali</div>
                <div className="col-span-1" />
              </div>

              {items.map((item, i) => (
                <div key={i} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-5">
                    <input
                      type="text"
                      value={item.description}
                      onChange={e => updateItem(i, "description", e.target.value)}
                      className="form-input"
                      placeholder="Shkollimi mujor, Ushqimi..."
                      required
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={e => updateItem(i, "quantity", parseFloat(e.target.value) || 1)}
                      className="form-input text-right"
                      min="1"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={item.unitPrice}
                      onChange={e => updateItem(i, "unitPrice", parseFloat(e.target.value) || 0)}
                      className="form-input text-right"
                      min="0"
                    />
                  </div>
                  <div className="col-span-2 text-right">
                    <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                      {item.total.toLocaleString()}
                    </span>
                  </div>
                  <div className="col-span-1 flex justify-end">
                    <button
                      type="button"
                      onClick={() => removeItem(i)}
                      className="p-1 text-slate-300 hover:text-red-500 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Totals */}
            <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-2">
              <div className="flex justify-end">
                <div className="w-64 space-y-2">
                  <div className="flex justify-between text-sm text-slate-500">
                    <span>Nëntotali:</span>
                    <span>{subtotal.toLocaleString()} Lekë</span>
                  </div>
                  {vatRate > 0 && (
                    <div className="flex justify-between text-sm text-slate-500">
                      <span>TVSH ({vatRate}%):</span>
                      <span>{vatAmount.toLocaleString()} Lekë</span>
                    </div>
                  )}
                  <div className="flex justify-between text-base font-bold border-t border-slate-200 dark:border-slate-600 pt-2">
                    <span>TOTALI:</span>
                    <span className="text-primary-600">{total.toLocaleString()} Lekë</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="card p-5">
            <label className="form-label">Shënime</label>
            <textarea
              value={form.notes}
              onChange={e => setField("notes", e.target.value)}
              className="form-input min-h-[80px] resize-none"
              placeholder="Shënime shtesë për faturën..."
            />
          </div>

          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => router.back()} className="btn-secondary">
              <X className="w-4 h-4" />
              Anulo
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
