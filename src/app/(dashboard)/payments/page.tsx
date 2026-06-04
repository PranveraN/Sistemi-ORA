"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Header from "@/components/layout/Header";
import Link from "next/link";
import { formatCurrency, formatDate, getStatusColor, getStatusLabel, MONTHS } from "@/lib/utils";
import { Plus, Search, ChevronLeft, ChevronRight, AlertCircle, CheckCircle, Clock } from "lucide-react";

interface Payment {
  id: number;
  amount: number;
  finalAmount: number;
  paidAmount: number;
  balance: number;
  status: string;
  method: string | null;
  dueDate: string;
  paidDate: string | null;
  month: number | null;
  year: number | null;
  description: string | null;
  student: { id: number; firstName: string; lastName: string };
  category: { name: string };
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const limit = 20;

  const fetch_ = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ search, status, page: String(page), limit: String(limit) });
    const res = await fetch(`/api/payments?${params}`);
    const data = await res.json();
    const sorted = (data.payments || []).sort((a: Payment, b: Payment) =>
      a.student.firstName.localeCompare(b.student.firstName, "sq", { sensitivity: "base" }) ||
      a.student.lastName.localeCompare(b.student.lastName, "sq", { sensitivity: "base" })
    );
    setPayments(sorted);
    setTotal(data.total);
    setLoading(false);
  }, [search, status, page]);

  const _firstRender = useRef(true);
  useEffect(() => {
    const delay = _firstRender.current ? 0 : 300;
    _firstRender.current = false;
    const t = setTimeout(fetch_, delay);
    return () => clearTimeout(t);
  }, [fetch_]);

  const totalPages = Math.ceil(total / limit);
  const overdueCount = payments.filter(p => p.status === "OVERDUE").length;
  const paidCount = payments.filter(p => p.status === "PAID").length;
  const pendingCount = payments.filter(p => p.status === "PENDING" || p.status === "PARTIAL").length;

  return (
    <>
      <Header title="Pagesat" />
      <div className="p-6 space-y-4 animate-fade-in">

        {/* Actions */}
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
          <div className="flex flex-1 gap-3 items-center w-full sm:max-w-xl">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                placeholder="Kërko nxënësin..."
                className="form-input pl-9"
              />
            </div>
            <select
              value={status}
              onChange={e => { setStatus(e.target.value); setPage(1); }}
              className="form-input w-40"
            >
              <option value="">Të gjitha</option>
              <option value="PENDING">Në pritje</option>
              <option value="PARTIAL">Pjesërisht</option>
              <option value="PAID">Paguar</option>
              <option value="OVERDUE">Vonuar</option>
            </select>
          </div>
          <Link href="/payments/new" className="btn-primary whitespace-nowrap">
            <Plus className="w-4 h-4" />
            Pagesë e Re
          </Link>
        </div>

        {/* Quick stats */}
        <div className="grid grid-cols-3 gap-3">
          <div className="card p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-green-50 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
              <CheckCircle className="w-4 h-4 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{paidCount}</p>
              <p className="text-xs text-slate-400">Paguar</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-yellow-50 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
              <Clock className="w-4 h-4 text-yellow-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{pendingCount}</p>
              <p className="text-xs text-slate-400">Në pritje</p>
            </div>
          </div>
          <div className="card p-4 flex items-center gap-3">
            <div className="w-9 h-9 bg-red-50 dark:bg-red-900/30 rounded-lg flex items-center justify-center">
              <AlertCircle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-slate-900 dark:text-white">{overdueCount}</p>
              <p className="text-xs text-slate-400">Vonuar</p>
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="table-header">Nxënësi</th>
                  <th className="table-header">Kategoria</th>
                  <th className="table-header">Muaji</th>
                  <th className="table-header">Shuma</th>
                  <th className="table-header">Paguar</th>
                  <th className="table-header">Borxhi</th>
                  <th className="table-header">Metoda</th>
                  <th className="table-header">Afati</th>
                  <th className="table-header">Statusi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="table-cell text-center py-12 text-slate-400">
                      <svg className="animate-spin w-5 h-5 mx-auto mb-2" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Duke ngarkuar...
                    </td>
                  </tr>
                ) : payments.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="table-cell text-center py-12 text-slate-400">
                      Asnjë pagesë nuk u gjet
                    </td>
                  </tr>
                ) : payments.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="table-cell">
                      <Link
                        href={`/students/${p.student.id}`}
                        className="font-medium text-primary-600 dark:text-primary-400 hover:underline"
                      >
                        {p.student.firstName} {p.student.lastName}
                      </Link>
                    </td>
                    <td className="table-cell text-slate-600 dark:text-slate-300">{p.category.name}</td>
                    <td className="table-cell text-slate-500 dark:text-slate-400 text-xs">
                      {p.month ? `${MONTHS[p.month - 1]} ${p.year}` : p.year || "—"}
                    </td>
                    <td className="table-cell font-medium text-slate-900 dark:text-white">
                      {formatCurrency(p.finalAmount)}
                    </td>
                    <td className="table-cell text-green-600 dark:text-green-400 font-medium">
                      {formatCurrency(p.paidAmount)}
                    </td>
                    <td className="table-cell">
                      {p.balance > 0 ? (
                        <span className="text-red-600 dark:text-red-400 font-semibold text-sm">
                          {formatCurrency(p.balance)}
                        </span>
                      ) : (
                        <span className="text-slate-300 dark:text-slate-600">—</span>
                      )}
                    </td>
                    <td className="table-cell text-slate-500 dark:text-slate-400">
                      {p.method ? getStatusLabel(p.method) : "—"}
                    </td>
                    <td className="table-cell text-slate-500 dark:text-slate-400 text-xs">
                      {formatDate(p.dueDate)}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${getStatusColor(p.status)}`}>
                        {getStatusLabel(p.status)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
              <p className="text-sm text-slate-500">
                {(page - 1) * limit + 1}–{Math.min(page * limit, total)} nga {total} pagesa
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-sm text-slate-600 dark:text-slate-300 px-2">{page} / {totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 disabled:opacity-40">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
