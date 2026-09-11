"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  ChevronLeft, Plus, X, Save, Loader2, Search, Phone,
  MessageSquare, Wallet, CreditCard, StickyNote, Pencil, Trash2,
} from "lucide-react";

interface StudentOpt {
  id: number; firstName: string; lastName: string;
  class: { name: string } | null;
}
interface DebtRow {
  id: number;
  studentId: number | null;
  student: {
    id: number; firstName: string; lastName: string; status: string;
    class: { name: string } | null;
    parentPhone: string | null; fatherPhone: string | null; motherPhone: string | null;
  } | null;
  customerName: string;
  customerPhone: string | null;
  totalAmount: number; paidAmount: number; balance: number;
  status: string;
  saleDate: string;
  notes: string | null;
  itemsSummary: string | null;
}

function debtPhone(row: DebtRow): string | null {
  if (row.student) return row.student.parentPhone || row.student.fatherPhone || row.student.motherPhone || row.customerPhone;
  return row.customerPhone;
}

export default function UniformaBorxhetPage() {
  const [rows, setRows] = useState<DebtRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const fetchDebts = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/uniforms/debts");
    if (res.ok) {
      const d = await res.json();
      setRows(d.sales);
      setTotal(d.total);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchDebts(); }, [fetchDebts]);

  const [addOpen, setAddOpen] = useState(false);
  const [payRow,  setPayRow]  = useState<DebtRow | null>(null);
  const [editRow, setEditRow] = useState<DebtRow | null>(null);
  const [deleteRow, setDeleteRow] = useState<DebtRow | null>(null);
  const [deleting, setDeleting] = useState(false);

  async function confirmDeleteRow() {
    if (!deleteRow) return;
    setDeleting(true);
    await fetch(`/api/uniforms/sales/${deleteRow.id}`, { method: "DELETE" });
    setDeleting(false);
    setDeleteRow(null);
    fetchDebts();
  }

  return (
    <>
      <Header title="Borxhet e Uniformave" />
      <div className="p-6 max-w-5xl mx-auto space-y-5 animate-fade-in">
        <div className="flex items-center gap-3">
          <Link href="/uniforma" className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="flex-1">
            <h1 className="page-title">Borxhet e Uniformave</h1>
            <p className="text-sm text-slate-400 mt-0.5">Nxënës/klientë me borxh të mbetur — përfshirë borxhet e importuara nga vite të mëparshme</p>
          </div>
          <button onClick={() => setAddOpen(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Shto Borxh
          </button>
        </div>

        <div className="card p-5 flex items-center gap-4">
          <div className="w-11 h-11 rounded-xl bg-amber-50 dark:bg-amber-900/30 flex items-center justify-center flex-shrink-0">
            <Wallet className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-amber-600">{formatCurrency(total)}</p>
            <p className="text-sm text-slate-400">Borxh gjithsej · {rows.length} rreshta</p>
          </div>
        </div>

        <div className="card overflow-hidden">
          {loading ? (
            <div className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary-400 mx-auto" /></div>
          ) : rows.length === 0 ? (
            <p className="py-16 text-center text-slate-400 text-sm">Asnjë borxh i mbetur — të gjitha shitjet janë paguar plotësisht.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50">
                  <tr>
                    <th className="table-header">Nxënësi / Klienti</th>
                    <th className="table-header">Artikujt / Shënim</th>
                    <th className="table-header text-right">Shuma</th>
                    <th className="table-header text-right">Paguar</th>
                    <th className="table-header text-right">Borxhi</th>
                    <th className="table-header">Data</th>
                    <th className="table-header text-right">Veprime</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {rows.map(row => (
                    <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="table-cell">
                        {row.student ? (
                          <Link href={`/students/${row.student.id}`} className="font-semibold text-slate-900 dark:text-white hover:text-primary-600 dark:hover:text-primary-400">
                            {row.student.firstName} {row.student.lastName}
                          </Link>
                        ) : (
                          <span className="font-semibold text-slate-900 dark:text-white">{row.customerName}</span>
                        )}
                        {row.student?.class && (
                          <span className="ml-1.5 bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-1.5 py-0.5 rounded text-[10px] font-medium">
                            {row.student.class.name}
                          </span>
                        )}
                        {debtPhone(row) && (
                          <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                            <Phone className="w-3 h-3" /> {debtPhone(row)}
                          </p>
                        )}
                      </td>
                      <td className="table-cell text-slate-500 dark:text-slate-400 text-xs max-w-[220px]">
                        {row.itemsSummary || <span className="italic text-slate-400">Borxh i regjistruar</span>}
                        {row.notes && <p className="mt-0.5 flex items-start gap-1"><StickyNote className="w-3 h-3 mt-0.5 shrink-0 text-amber-400" />{row.notes}</p>}
                      </td>
                      <td className="table-cell text-right font-medium text-slate-700 dark:text-slate-200">{formatCurrency(row.totalAmount)}</td>
                      <td className="table-cell text-right text-green-600 dark:text-green-400">{formatCurrency(row.paidAmount)}</td>
                      <td className="table-cell text-right font-bold text-red-600 dark:text-red-400">{formatCurrency(row.balance)}</td>
                      <td className="table-cell text-slate-400 text-xs">{formatDate(row.saleDate)}</td>
                      <td className="table-cell">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => setPayRow(row)}
                            className="btn-secondary text-xs px-2.5 py-1.5"
                            title="Shto pagesë"
                          >
                            <CreditCard className="w-3.5 h-3.5" /> Pagesë
                          </button>
                          {row.student && (
                            <Link
                              href={`/students/${row.student.id}#sms`}
                              title="SMS te prindi"
                              className="p-1.5 rounded-lg text-slate-300 hover:text-violet-600 hover:bg-violet-50 dark:hover:bg-violet-900/20 dark:text-slate-500 dark:hover:text-violet-400 transition-colors"
                            >
                              <MessageSquare className="w-4 h-4" />
                            </Link>
                          )}
                          <button
                            onClick={() => setEditRow(row)}
                            title="Modifiko"
                            className="p-1.5 rounded-lg text-slate-300 hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 dark:text-slate-500 dark:hover:text-primary-400 transition-colors"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setDeleteRow(row)}
                            title="Fshi"
                            className="p-1.5 rounded-lg text-slate-300 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-slate-500 dark:hover:text-red-400 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {addOpen && (
        <AddDebtModal onClose={() => setAddOpen(false)} onSaved={() => { setAddOpen(false); fetchDebts(); }} />
      )}
      {payRow && (
        <PayDebtModal row={payRow} onClose={() => setPayRow(null)} onSaved={() => { setPayRow(null); fetchDebts(); }} />
      )}
      {editRow && (
        <EditDebtModal row={editRow} onClose={() => setEditRow(null)} onSaved={() => { setEditRow(null); fetchDebts(); }} />
      )}
      {deleteRow && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setDeleteRow(null)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Fshi këtë borxh?</h3>
            <p className="text-sm text-slate-400 mb-6">
              {deleteRow.student ? `${deleteRow.student.firstName} ${deleteRow.student.lastName}` : deleteRow.customerName} — {formatCurrency(deleteRow.balance)} borxh. Ky veprim nuk mund të kthehet.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteRow(null)} className="btn-ghost flex-1">Anulo</button>
              <button onClick={confirmDeleteRow} disabled={deleting} className="btn-danger flex-1 justify-center">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Fshi"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ═══════════════════════════════════════════════════════ */
function AddDebtModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [studentQuery, setStudentQuery] = useState("");
  const [studentOpts, setStudentOpts] = useState<StudentOpt[]>([]);
  const [selStudent, setSelStudent] = useState<StudentOpt | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [amount, setAmount] = useState("");
  const [paidAmount, setPaidAmount] = useState("0");
  const [method, setMethod] = useState("CASH");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (studentQuery.trim().length < 2) { setStudentOpts([]); return; }
    const t = setTimeout(async () => {
      const res = await fetch(`/api/students?search=${encodeURIComponent(studentQuery)}&status=ACTIVE&limit=10`);
      const d = await res.json();
      setStudentOpts(d.students || []);
    }, 250);
    return () => clearTimeout(t);
  }, [studentQuery]);

  const effectiveName = selStudent ? `${selStudent.firstName} ${selStudent.lastName}` : customerName.trim();

  async function handleSave() {
    setError("");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Shkruaj shumën e borxhit."); return; }
    if (!effectiveName) { setError("Zgjidh nxënësin ose shkruaj emrin."); return; }
    setSaving(true);
    const res = await fetch("/api/uniforms/sales", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        debtOnly: true,
        amount: amt,
        customerName: effectiveName,
        customerPhone: customerPhone || null,
        studentId: selStudent?.id ?? null,
        paidAmount: parseFloat(paidAmount || "0"),
        method,
        notes: notes || null,
      }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(d.error || "Gabim gjatë ruajtjes."); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wallet className="w-4 h-4 text-amber-500" /> Shto Borxh Uniforme
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}

          <div>
            <label className="form-label">Nxënësi (opsionale)</label>
            {selStudent ? (
              <div className="flex items-center justify-between p-2.5 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                <div>
                  <p className="text-sm font-semibold text-primary-800 dark:text-primary-300">{selStudent.firstName} {selStudent.lastName}</p>
                  {selStudent.class && <p className="text-xs text-slate-500">Klasa {selStudent.class.name}</p>}
                </div>
                <button onClick={() => setSelStudent(null)} className="text-slate-400 hover:text-red-500"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input
                  value={studentQuery}
                  onChange={e => setStudentQuery(e.target.value)}
                  className="form-input pl-9"
                  placeholder="Kërko nxënësin me emër..."
                />
                {studentOpts.length > 0 && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-48 overflow-y-auto">
                    {studentOpts.map(s => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => { setSelStudent(s); setStudentQuery(""); setStudentOpts([]); }}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center justify-between gap-2"
                      >
                        <span>{s.firstName} {s.lastName}</span>
                        <span className="text-xs text-slate-400">{s.class?.name}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {!selStudent && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Emri i klientit *</label>
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} className="form-input" placeholder="Nëse s'është nxënës i regjistruar" />
              </div>
              <div>
                <label className="form-label">Telefoni</label>
                <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="form-input" placeholder="04X XXX XXX" />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Shuma e borxhit (€) *</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="form-input" min="0" step="0.01" />
            </div>
            <div>
              <label className="form-label">Paguar tashmë (€)</label>
              <input type="number" value={paidAmount} onChange={e => setPaidAmount(e.target.value)} className="form-input" min="0" step="0.01" />
            </div>
          </div>

          {parseFloat(paidAmount || "0") > 0 && (
            <div>
              <label className="form-label">Mënyra e pagesës fillestare</label>
              <select value={method} onChange={e => setMethod(e.target.value)} className="form-input">
                <option value="CASH">Cash</option>
                <option value="BANK">Bankë</option>
                <option value="CARD">Kartelë</option>
                <option value="ONLINE">Online</option>
              </select>
            </div>
          )}

          <div>
            <label className="form-label">Shënim</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} className="form-input" placeholder='p.sh. "Borxh nga viti 2025-2026"' />
          </div>
        </div>

        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose} className="btn-ghost flex-1">Anulo</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Duke ruajtur..." : "Ruaj Borxhin"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
function PayDebtModal({ row, onClose, onSaved }: { row: DebtRow; onClose: () => void; onSaved: () => void }) {
  const [amount, setAmount] = useState(String(row.balance));
  const [method, setMethod] = useState("CASH");
  const [notes,  setNotes]  = useState("");
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState("");

  async function handleSave() {
    setError("");
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setError("Shkruaj shumën e pagesës."); return; }
    setSaving(true);
    const res = await fetch(`/api/uniforms/sales/${row.id}/payments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: amt, method, notes: notes || null }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(d.error || "Gabim gjatë ruajtjes."); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white">
            Pagesë — {row.student ? `${row.student.firstName} ${row.student.lastName}` : row.customerName}
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <p className="text-sm text-slate-500">Borxhi i mbetur: <span className="font-bold text-red-600">{formatCurrency(row.balance)}</span></p>
          <div>
            <label className="form-label">Shuma (€) *</label>
            <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="form-input" min="0" step="0.01" autoFocus />
          </div>
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
            <label className="form-label">Shënim (opsionale)</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} className="form-input" />
          </div>
        </div>
        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose} className="btn-ghost flex-1">Anulo</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Duke ruajtur..." : "Regjistro Pagesën"}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════ */
function EditDebtModal({ row, onClose, onSaved }: { row: DebtRow; onClose: () => void; onSaved: () => void }) {
  const hasRealItems = row.itemsSummary != null;
  const [customerName, setCustomerName] = useState(row.student ? `${row.student.firstName} ${row.student.lastName}` : row.customerName);
  const [customerPhone, setCustomerPhone] = useState(row.customerPhone || "");
  const [amount, setAmount] = useState(String(row.totalAmount));
  const [notes, setNotes] = useState(row.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSave() {
    setError("");
    if (!customerName.trim()) { setError("Emri mungon."); return; }
    if (!hasRealItems) {
      const amt = parseFloat(amount);
      if (!amt || amt <= 0) { setError("Shkruaj shumën e borxhit."); return; }
    }
    setSaving(true);
    const res = await fetch(`/api/uniforms/sales/${row.id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customerName: customerName.trim(),
        customerPhone: customerPhone || null,
        studentId: row.studentId,
        notes: notes || null,
        ...(hasRealItems ? {} : { amount: parseFloat(amount) }),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(d.error || "Gabim gjatë ruajtjes."); return; }
    onSaved();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Pencil className="w-4 h-4 text-primary-500" /> Modifiko Borxhin
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        <div className="p-5 space-y-4">
          {error && <p className="text-sm text-red-500">{error}</p>}
          {row.student ? (
            <div className="p-2.5 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
              <p className="text-sm font-semibold text-primary-800 dark:text-primary-300">{row.student.firstName} {row.student.lastName}</p>
              {row.student.class && <p className="text-xs text-slate-500">Klasa {row.student.class.name}</p>}
            </div>
          ) : (
            <div>
              <label className="form-label">Emri i klientit *</label>
              <input value={customerName} onChange={e => setCustomerName(e.target.value)} className="form-input" />
            </div>
          )}
          <div>
            <label className="form-label">Telefoni</label>
            <input value={customerPhone} onChange={e => setCustomerPhone(e.target.value)} className="form-input" placeholder="04X XXX XXX" />
          </div>
          {hasRealItems ? (
            <div>
              <label className="form-label">Shuma (€)</label>
              <input value={formatCurrency(row.totalAmount)} disabled className="form-input disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-500 disabled:cursor-not-allowed" />
              <p className="text-[11px] text-slate-400 mt-1">E llogaritur nga artikujt e shitjes — s'mund të ndryshohet drejtpërdrejt këtu.</p>
            </div>
          ) : (
            <div>
              <label className="form-label">Shuma e borxhit (€) *</label>
              <input type="number" value={amount} onChange={e => setAmount(e.target.value)} className="form-input" min="0" step="0.01" />
            </div>
          )}
          <div>
            <label className="form-label">Shënim</label>
            <input value={notes} onChange={e => setNotes(e.target.value)} className="form-input" placeholder='p.sh. "Borxh nga viti 2025-2026"' />
          </div>
        </div>
        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose} className="btn-ghost flex-1">Anulo</button>
          <button onClick={handleSave} disabled={saving} className="btn-primary flex-1 justify-center">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? "Duke ruajtur..." : "Ruaj Ndryshimet"}
          </button>
        </div>
      </div>
    </div>
  );
}
