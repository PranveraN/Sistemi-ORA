"use client";

import { useEffect, useState, useCallback } from "react";
import { formatCurrency, formatDate, MONTHS } from "@/lib/utils";
import { Plus, X, Save, Loader2, Trash2, Pencil } from "lucide-react";

interface Expense {
  id: number;
  type: string;
  amount: number;
  description: string | null;
  recipient: string | null;
  date: string;
  method: string | null;
  reference: string | null;
}

interface Props {
  categoryId: number | null;
  type: "EXPENSE" | "HANDOVER";
  month: number;
  year: number;
}

export default function ExpensesSection({ categoryId, type, month, year }: Props) {
  const [items, setItems]     = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal]     = useState(false);
  const [editItem, setEditItem] = useState<Expense | null>(null);

  const isHandover = type === "HANDOVER";
  const label      = isHandover ? "Dorezim Parash" : "Shpenzim";

  const fetchItems = useCallback(async () => {
    if (!categoryId) return;
    setLoading(true);
    const params = new URLSearchParams({
      categoryId: String(categoryId),
      type,
      month: String(month),
      year:  String(year),
    });
    const res = await fetch(`/api/expenses?${params}`);
    if (res.ok) setItems(await res.json());
    setLoading(false);
  }, [categoryId, type, month, year]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const total = items.reduce((s, e) => s + e.amount, 0);

  async function deleteItem(id: number) {
    if (!confirm("Fshi këtë regjistrim?")) return;
    await fetch(`/api/expenses/${id}`, { method: "DELETE" });
    await fetchItems();
  }

  function openAdd()             { setEditItem(null); setModal(true); }
  function openEdit(e: Expense)  { setEditItem(e);    setModal(true); }
  async function afterSave()     { setModal(false); await fetchItems(); }

  if (!categoryId) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-primary-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <div className="card p-4">
          <p className="text-xs text-slate-400 mb-1">
            {isHandover ? "Total Dorëzuar" : "Total Shpenzuar"}
          </p>
          <p className={`text-2xl font-bold ${isHandover ? "text-blue-600 dark:text-blue-400" : "text-red-500 dark:text-red-400"}`}>
            {formatCurrency(total)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-slate-400 mb-1">Regjistrime</p>
          <p className="text-2xl font-bold text-slate-700 dark:text-slate-200">{items.length}</p>
        </div>
        <div className="card p-4 hidden sm:block">
          <p className="text-xs text-slate-400 mb-1">Periudha</p>
          <p className="text-base font-semibold text-slate-600 dark:text-slate-300">
            {MONTHS[month - 1]} {year}
          </p>
        </div>
      </div>

      {/* Header row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500 dark:text-slate-400">
          {items.length === 0
            ? `Nuk ka ${label.toLowerCase()} për ${MONTHS[month - 1]} ${year}`
            : `${items.length} regjistrime`}
        </p>
        <button onClick={openAdd} className="btn-primary">
          <Plus className="w-4 h-4" />
          Shto {label}
        </button>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-slate-50 dark:bg-slate-800/50">
              <tr>
                <th className="table-header">#</th>
                <th className="table-header">Data</th>
                <th className="table-header">
                  {isHandover ? "Dorëzuar tek" : "Përshkrimi"}
                </th>
                <th className="table-header">Shuma</th>
                <th className="table-header">Mënyra</th>
                <th className="table-header">Referenca</th>
                <th className="table-header text-right">Veprime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center">
                    <Loader2 className="w-6 h-6 animate-spin text-primary-400 mx-auto" />
                  </td>
                </tr>
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-16 text-center text-slate-400 text-sm">
                    Nuk ka {label.toLowerCase()} të regjistruara
                  </td>
                </tr>
              ) : items.map((item, i) => (
                <tr key={item.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                  <td className="table-cell text-slate-400 text-xs">{i + 1}</td>
                  <td className="table-cell text-sm text-slate-600 dark:text-slate-300">
                    {formatDate(item.date)}
                  </td>
                  <td className="table-cell font-medium text-slate-800 dark:text-slate-200">
                    {isHandover ? (item.recipient || "—") : (item.description || "—")}
                  </td>
                  <td className={`table-cell font-bold ${isHandover ? "text-blue-600 dark:text-blue-400" : "text-red-600 dark:text-red-400"}`}>
                    {formatCurrency(item.amount)}
                  </td>
                  <td className="table-cell text-sm text-slate-500 dark:text-slate-400">
                    {item.method || "—"}
                  </td>
                  <td className="table-cell text-xs text-slate-400">
                    {item.reference || "—"}
                  </td>
                  <td className="table-cell text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        onClick={() => openEdit(item)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:text-slate-500 dark:hover:text-primary-400 transition-colors"
                        title="Modifiko"
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => deleteItem(item.id)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-slate-500 transition-colors"
                        title="Fshi"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {modal && (
        <ExpenseModal
          type={type}
          categoryId={categoryId}
          month={month}
          year={year}
          existing={editItem}
          onClose={() => setModal(false)}
          onSave={afterSave}
        />
      )}
    </div>
  );
}

/* ─── Modal ─────────────────────────────────────────────── */
function ExpenseModal({ type, categoryId, month, year, existing, onClose, onSave }: {
  type: string;
  categoryId: number;
  month: number;
  year: number;
  existing: Expense | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const isHandover = type === "HANDOVER";

  const [amount,      setAmount]      = useState(String(existing?.amount ?? ""));
  const [description, setDescription] = useState(existing?.description ?? "");
  const [recipient,   setRecipient]   = useState(existing?.recipient   ?? "");
  const [method,      setMethod]      = useState(existing?.method      ?? "CASH");
  const [reference,   setReference]   = useState(existing?.reference   ?? "");
  const [date, setDate] = useState(
    existing?.date
      ? new Date(existing.date).toISOString().split("T")[0]
      : new Date().toISOString().split("T")[0]
  );
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (!amount) return;
    setSaving(true);
    const payload = {
      categoryId,
      type,
      amount: parseFloat(amount),
      description,
      recipient,
      method,
      reference,
      date,
      month,
      year,
    };
    if (existing) {
      await fetch(`/api/expenses/${existing.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } else {
      await fetch("/api/expenses", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }
    setSaving(false);
    onSave();
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white">
            {existing ? "Modifiko" : "Shto"} {isHandover ? "Dorezim Parash" : "Shpenzim"}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 p-1">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Amount + Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Shuma (€) <span className="text-red-500">*</span></label>
              <input
                type="number"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                className="form-input"
                placeholder="0.00"
                min="0"
                step="0.01"
                autoFocus
              />
            </div>
            <div>
              <label className="form-label">Data</label>
              <input
                type="date"
                value={date}
                onChange={e => setDate(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          {/* Description / Recipient */}
          {isHandover ? (
            <div>
              <label className="form-label">Dorëzuar tek (personi/institucioni)</label>
              <input
                type="text"
                value={recipient}
                onChange={e => setRecipient(e.target.value)}
                className="form-input"
                placeholder="Emri i personit ose institucioni..."
              />
            </div>
          ) : (
            <div>
              <label className="form-label">Përshkrimi i shpenzimit</label>
              <input
                type="text"
                value={description}
                onChange={e => setDescription(e.target.value)}
                className="form-input"
                placeholder="Çfarë u shpenzua..."
              />
            </div>
          )}

          {/* Method + Reference */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Mënyra</label>
              <select value={method} onChange={e => setMethod(e.target.value)} className="form-input">
                <option value="CASH">Cash</option>
                <option value="BANK">Bankë</option>
                <option value="CARD">Kartelë</option>
                <option value="ONLINE">Online</option>
              </select>
            </div>
            <div>
              <label className="form-label">Referenca / Nr. fature</label>
              <input
                type="text"
                value={reference}
                onChange={e => setReference(e.target.value)}
                className="form-input"
                placeholder="Opsionale..."
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose} className="btn-secondary flex-1 justify-center">
            <X className="w-4 h-4" />
            Anulo
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !amount}
            className="btn-primary flex-1 justify-center"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Duke ruajtur..." : "Ruaj"}
          </button>
        </div>
      </div>
    </div>
  );
}
