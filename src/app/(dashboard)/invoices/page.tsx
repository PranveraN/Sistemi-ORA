"use client";

import { useEffect, useState, useCallback } from "react";
import Header from "@/components/layout/Header";
import Link from "next/link";
import { formatCurrency, formatDate, getStatusColor, getStatusLabel } from "@/lib/utils";
import { Plus, Eye, CheckCircle, Loader2 } from "lucide-react";

interface Invoice {
  id: number;
  number: string;
  type: string;
  total: number;
  status: string;
  createdAt: string;
  dueDate: string | null;
  student: { id: number; firstName: string; lastName: string };
  items: { id: number }[];
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [markingPaid, setMarkingPaid] = useState<number | null>(null);

  const fetchInvoices = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ type, status, limit: "50" });
    const res = await fetch(`/api/invoices?${params}`);
    const data = await res.json();
    const sorted = (data.invoices || []).sort((a: Invoice, b: Invoice) =>
      a.student.firstName.localeCompare(b.student.firstName, "sq", { sensitivity: "base" }) ||
      a.student.lastName.localeCompare(b.student.lastName, "sq", { sensitivity: "base" })
    );
    setInvoices(sorted);
    setTotal(data.total);
    setLoading(false);
  }, [type, status]);

  useEffect(() => { fetchInvoices(); }, [fetchInvoices]);

  async function markPaid(inv: Invoice) {
    if (!confirm(`Shëno faturën ${inv.number} (${inv.student.firstName} ${inv.student.lastName}) si Paguar?`)) return;
    setMarkingPaid(inv.id);
    await fetch(`/api/invoices/${inv.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "PAID" }),
    });
    setMarkingPaid(null);
    fetchInvoices();
  }

  return (
    <>
      <Header title="Faturat" />
      <div className="p-6 space-y-4 animate-fade-in">

        <div className="flex items-center justify-between">
          <div className="flex gap-3">
            <select value={type} onChange={e => setType(e.target.value)} className="form-input w-40">
              <option value="">Të gjitha llojet</option>
              <option value="INVOICE">Faturë</option>
              <option value="PROFORMA">Profaturë</option>
              <option value="OFFER">Ofertë</option>
            </select>
            <select value={status} onChange={e => setStatus(e.target.value)} className="form-input w-40">
              <option value="">Të gjitha statuset</option>
              <option value="DRAFT">Draft</option>
              <option value="SENT">Dërguar</option>
              <option value="PAID">Paguar</option>
              <option value="CANCELLED">Anuluar</option>
            </select>
          </div>
          <Link href="/invoices/new" className="btn-primary">
            <Plus className="w-4 h-4" />
            Faturë e Re
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: "Gjithsej", value: total, color: "text-slate-900 dark:text-white" },
            { label: "Draft", value: invoices.filter(i => i.status === "DRAFT").length, color: "text-slate-500" },
            { label: "Paguar", value: invoices.filter(i => i.status === "PAID").length, color: "text-green-600" },
            { label: "Vlera totale", value: formatCurrency(invoices.reduce((s, i) => s + i.total, 0)), color: "text-primary-600" },
          ].map(s => (
            <div key={s.label} className="card p-4">
              <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-slate-400">{s.label}</p>
            </div>
          ))}
        </div>

        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="table-header">Numri</th>
                  <th className="table-header">Lloji</th>
                  <th className="table-header">Nxënësi</th>
                  <th className="table-header">Zërat</th>
                  <th className="table-header">Totali</th>
                  <th className="table-header">Afati</th>
                  <th className="table-header">Data</th>
                  <th className="table-header">Statusi</th>
                  <th className="table-header text-right">Veprime</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="table-cell text-center py-12 text-slate-400">
                      <svg className="animate-spin w-5 h-5 mx-auto" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                    </td>
                  </tr>
                ) : invoices.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="table-cell text-center py-12 text-slate-400">
                      Asnjë faturë nuk u gjet
                    </td>
                  </tr>
                ) : invoices.map(inv => (
                  <tr key={inv.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="table-cell font-mono text-sm font-medium text-slate-900 dark:text-white">
                      {inv.number}
                    </td>
                    <td className="table-cell">
                      <span className="bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2 py-0.5 rounded text-xs font-medium">
                        {getStatusLabel(inv.type)}
                      </span>
                    </td>
                    <td className="table-cell">
                      <Link href={`/students/${inv.student.id}`} className="text-primary-600 hover:underline font-medium">
                        {inv.student.firstName} {inv.student.lastName}
                      </Link>
                    </td>
                    <td className="table-cell text-slate-400">{inv.items.length} zëra</td>
                    <td className="table-cell font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(inv.total)}
                    </td>
                    <td className="table-cell text-slate-400 text-xs">
                      {inv.dueDate ? formatDate(inv.dueDate) : "—"}
                    </td>
                    <td className="table-cell text-slate-400 text-xs">
                      {formatDate(inv.createdAt)}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${getStatusColor(inv.status)}`}>
                        {getStatusLabel(inv.status)}
                      </span>
                    </td>
                    <td className="table-cell text-right">
                      <div className="flex items-center justify-end gap-1">
                        {inv.status !== "PAID" && inv.status !== "CANCELLED" && (
                          <button
                            onClick={() => markPaid(inv)}
                            disabled={markingPaid === inv.id}
                            title="Shëno si Paguar"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 transition-colors inline-flex disabled:opacity-50"
                          >
                            {markingPaid === inv.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          </button>
                        )}
                        <Link
                          href={`/invoices/${inv.id}`}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors inline-flex"
                        >
                          <Eye className="w-4 h-4" />
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </>
  );
}
