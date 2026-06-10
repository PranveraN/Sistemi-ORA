"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import Link from "next/link";
import { ChevronLeft, Save, X } from "lucide-react";
import { MONTHS } from "@/lib/utils";

interface Student { id: number; firstName: string; lastName: string; class: { name: string } | null }
interface Category { id: number; name: string; type: string }

function PaymentForm() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const preStudentId = searchParams.get("studentId") || "";

  const [students, setStudents] = useState<Student[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    studentId: preStudentId,
    categoryId: "",
    amount: "",
    discount: "0",
    discountType: "fixed",
    scholarship: "0",
    paidAmount: "",
    method: "CASH",
    dueDate: new Date().toISOString().split("T")[0],
    paidDate: new Date().toISOString().split("T")[0],
    month: String(new Date().getMonth() + 1),
    year: String(new Date().getFullYear()),
    description: "",
  });

  useEffect(() => {
    Promise.all([
      fetch("/api/students?limit=2000&status=ACTIVE").then(r => r.json()),
      fetch("/api/categories").then(r => r.json()),
    ]).then(([s, c]) => {
      setStudents(
        [...(s.students || [])].sort((a: Student, b: Student) =>
          a.lastName.localeCompare(b.lastName, "sq", { sensitivity: "base" }) ||
          a.firstName.localeCompare(b.firstName, "sq", { sensitivity: "base" })
        )
      );
      setCategories(c);
    });
  }, []);

  function set(field: string, value: string) {
    setForm(f => ({ ...f, [field]: value }));
  }

  const amount = parseFloat(form.amount || "0");
  const discount = parseFloat(form.discount || "0");
  const scholarship = parseFloat(form.scholarship || "0");
  const discountAmt = form.discountType === "percentage" ? (amount * discount) / 100 : discount;
  const finalAmount = Math.max(0, amount - discountAmt - scholarship);
  const balance = Math.max(0, finalAmount - parseFloat(form.paidAmount || "0"));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const res = await fetch("/api/payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    setLoading(false);

    if (res.ok) {
      const studentId = form.studentId;
      router.push(studentId ? `/students/${studentId}` : "/payments");
      router.refresh();
    } else {
      setError("Ndodhi një gabim. Provoni sërish.");
    }
  }

  return (
    <>
      <Header />
      <div className="p-6 max-w-2xl mx-auto animate-fade-in">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/payments" className="text-slate-400 hover:text-slate-600">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="page-title">Pagesë e Re</h1>
            <p className="text-sm text-slate-400 mt-0.5">Shto një pagesë të re për nxënësin</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {error && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
          )}

          {/* Student & Category */}
          <div className="card p-5 space-y-4">
            <h3 className="section-title">Nxënësi & Kategoria</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Nxënësi <span className="text-red-500">*</span></label>
                <select
                  value={form.studentId}
                  onChange={e => set("studentId", e.target.value)}
                  className="form-input"
                  required
                >
                  <option value="">— Zgjidh nxënësin —</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.firstName} {s.lastName}{s.class ? ` — Kl. ${s.class.name}` : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Kategoria <span className="text-red-500">*</span></label>
                <select
                  value={form.categoryId}
                  onChange={e => set("categoryId", e.target.value)}
                  className="form-input"
                  required
                >
                  <option value="">— Zgjidh kategorinë —</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Muaji</label>
                <select value={form.month} onChange={e => set("month", e.target.value)} className="form-input">
                  {MONTHS.map((m, i) => (
                    <option key={i} value={i + 1}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="form-label">Viti</label>
                <input
                  type="number"
                  value={form.year}
                  onChange={e => set("year", e.target.value)}
                  className="form-input"
                  min="2020" max="2030"
                />
              </div>
            </div>
          </div>

          {/* Amount */}
          <div className="card p-5 space-y-4">
            <h3 className="section-title">Shuma & Zbritjet</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Shuma (€) <span className="text-red-500">*</span></label>
                <input
                  type="number"
                  value={form.amount}
                  onChange={e => set("amount", e.target.value)}
                  className="form-input"
                  placeholder="0"
                  min="0"
                  required
                />
              </div>
              <div>
                <label className="form-label">Lloji i Zbritjes</label>
                <select value={form.discountType} onChange={e => set("discountType", e.target.value)} className="form-input">
                  <option value="fixed">Shumë fikse (€)</option>
                  <option value="percentage">Përqindje (%)</option>
                </select>
              </div>
              <div>
                <label className="form-label">Zbritja</label>
                <input
                  type="number"
                  value={form.discount}
                  onChange={e => set("discount", e.target.value)}
                  className="form-input"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="form-label">Bursa (€)</label>
                <input
                  type="number"
                  value={form.scholarship}
                  onChange={e => set("scholarship", e.target.value)}
                  className="form-input"
                  placeholder="0"
                  min="0"
                />
              </div>
            </div>

            {/* Summary */}
            <div className="bg-slate-50 dark:bg-slate-800 rounded-xl p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Shuma origjinale:</span>
                <span className="font-medium">{amount.toLocaleString()} €</span>
              </div>
              {discountAmt > 0 && (
                <div className="flex justify-between text-sm text-green-600">
                  <span>Zbritja:</span>
                  <span>- {discountAmt.toLocaleString()} €</span>
                </div>
              )}
              {scholarship > 0 && (
                <div className="flex justify-between text-sm text-blue-600">
                  <span>Bursa:</span>
                  <span>- {scholarship.toLocaleString()} €</span>
                </div>
              )}
              <div className="flex justify-between text-base font-bold border-t border-slate-200 dark:border-slate-600 pt-2">
                <span>Shuma finale:</span>
                <span className="text-primary-600">{finalAmount.toLocaleString()} €</span>
              </div>
            </div>
          </div>

          {/* Payment */}
          <div className="card p-5 space-y-4">
            <h3 className="section-title">Detajet e Pagesës</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">Shuma e Paguar (€)</label>
                <input
                  type="number"
                  value={form.paidAmount}
                  onChange={e => set("paidAmount", e.target.value)}
                  className="form-input"
                  placeholder="0"
                  min="0"
                />
              </div>
              <div>
                <label className="form-label">Mënyra e Pagesës</label>
                <select value={form.method} onChange={e => set("method", e.target.value)} className="form-input">
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bankë</option>
                  <option value="CARD">Kartelë</option>
                  <option value="ONLINE">Online</option>
                </select>
              </div>
              <div>
                <label className="form-label">Afati i Pagesës</label>
                <input
                  type="date"
                  value={form.dueDate}
                  onChange={e => set("dueDate", e.target.value)}
                  className="form-input"
                  required
                />
              </div>
              <div>
                <label className="form-label">Data e Pagesës</label>
                <input
                  type="date"
                  value={form.paidDate}
                  onChange={e => set("paidDate", e.target.value)}
                  className="form-input"
                />
              </div>
              <div className="md:col-span-2">
                <label className="form-label">Përshkrimi</label>
                <input
                  type="text"
                  value={form.description}
                  onChange={e => set("description", e.target.value)}
                  className="form-input"
                  placeholder="Shënime shtesë..."
                />
              </div>
            </div>

            {balance > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
                <p className="text-sm text-red-700 dark:text-red-400 font-medium">
                  Borxhi i mbetur: {balance.toLocaleString()} €
                </p>
              </div>
            )}
          </div>

          <div className="flex items-center justify-end gap-3">
            <button type="button" onClick={() => router.back()} className="btn-secondary">
              <X className="w-4 h-4" />
              Anulo
            </button>
            <button type="submit" disabled={loading} className="btn-primary">
              <Save className="w-4 h-4" />
              {loading ? "Duke ruajtur..." : "Ruaj Pagesën"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export default function NewPaymentPage() {
  return (
    <Suspense>
      <PaymentForm />
    </Suspense>
  );
}
