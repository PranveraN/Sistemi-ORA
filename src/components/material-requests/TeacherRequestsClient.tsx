"use client";

import { useState, useEffect, useCallback } from "react";
import { Send, Loader2, Clock, CheckCircle, XCircle, Package, Plus, X } from "lucide-react";

interface MaterialRequestRow {
  id: number;
  item: string;
  quantity: number;
  subjectOrClass: string | null;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reviewNote: string | null;
  createdAt: string;
  reviewedBy: { name: string } | null;
}

const STATUS_LABEL: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  PENDING:  { label: "Në pritje",  color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: <Clock className="w-3.5 h-3.5" /> },
  APPROVED: { label: "Aprovuar",   color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400", icon: <CheckCircle className="w-3.5 h-3.5" /> },
  REJECTED: { label: "Refuzuar",   color: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: <XCircle className="w-3.5 h-3.5" /> },
};

export default function TeacherRequestsClient() {
  const [requests, setRequests] = useState<MaterialRequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [ok, setOk] = useState(false);

  const [items, setItems] = useState([{ item: "", quantity: "1" }]);
  const [subjectOrClass, setSubjectOrClass] = useState("");
  const [reason, setReason] = useState("");

  const loadRequests = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/material-requests");
    if (res.ok) setRequests(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { loadRequests(); }, [loadRequests]);

  function setItemField(idx: number, field: "item" | "quantity", val: string) {
    setItems(list => list.map((r, i) => i === idx ? { ...r, [field]: val } : r));
  }
  function addItemRow() {
    setItems(list => [...list, { item: "", quantity: "1" }]);
  }
  function removeItemRow(idx: number) {
    setItems(list => list.filter((_, i) => i !== idx));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk(false);

    const validItems = items.filter(r => r.item.trim());
    if (!validItems.length || !reason.trim()) {
      setError("Plotëso të paktën një artikull dhe arsyen.");
      return;
    }

    setSubmitting(true);
    const res = await fetch("/api/material-requests", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items: validItems, subjectOrClass, reason }),
    });
    setSubmitting(false);

    if (!res.ok) {
      const d = await res.json();
      setError(d.error || "Diçka shkoi keq.");
      return;
    }

    setItems([{ item: "", quantity: "1" }]);
    setSubjectOrClass("");
    setReason("");
    setOk(true);
    loadRequests();
  }

  return (
    <div className="space-y-5">
      {/* Form */}
      <div className="card p-5">
        <h2 className="font-semibold text-slate-800 dark:text-white mb-4 flex items-center gap-2">
          <Package className="w-4 h-4 text-primary-500" />
          Kërkesë e Re për Material
        </h2>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>
        )}
        {ok && (
          <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
            Kërkesa u dërgua me sukses!
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="space-y-2">
            {items.map((row, idx) => (
              <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1fr_auto_auto] gap-2 items-end">
                <div>
                  {idx === 0 && <label className="form-label">Artikulli *</label>}
                  <input
                    type="text"
                    value={row.item}
                    onChange={e => setItemField(idx, "item", e.target.value)}
                    className="form-input"
                    placeholder="p.sh. Fletore A4, Markera..."
                    required={idx === 0}
                  />
                </div>
                <div className="w-full sm:w-24">
                  {idx === 0 && <label className="form-label">Sasia</label>}
                  <input
                    type="number"
                    min={1}
                    value={row.quantity}
                    onChange={e => setItemField(idx, "quantity", e.target.value)}
                    className="form-input"
                  />
                </div>
                {items.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeItemRow(idx)}
                    className="p-2.5 text-slate-400 hover:text-red-500 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20"
                    title="Hiq këtë artikull"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={addItemRow}
              className="flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <Plus className="w-4 h-4" />
              Shto Artikull
            </button>
          </div>

          <div>
            <label className="form-label">Lënda/Klasa (opsionale)</label>
            <input
              type="text"
              value={subjectOrClass}
              onChange={e => setSubjectOrClass(e.target.value)}
              className="form-input"
              placeholder="p.sh. Matematikë, Klasa 5A"
            />
          </div>

          <div>
            <label className="form-label">Arsyeja *</label>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              className="form-input"
              rows={3}
              placeholder="Përse nevojitet ky material?"
              required
            />
          </div>

          <button type="submit" disabled={submitting} className="btn-primary w-full sm:w-auto">
            {submitting
              ? <><Loader2 className="w-4 h-4 animate-spin" />Duke dërguar...</>
              : <><Send className="w-4 h-4" />Dërgo Kërkesën</>
            }
          </button>
        </form>
      </div>

      {/* History */}
      <div className="card p-5">
        <h2 className="font-semibold text-slate-800 dark:text-white mb-4">Kërkesat e Mia</h2>

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-6">Duke ngarkuar...</p>
        ) : requests.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-6">Ende s&apos;ke bërë asnjë kërkesë.</p>
        ) : (
          <div className="space-y-3">
            {requests.map(r => {
              const st = STATUS_LABEL[r.status];
              return (
                <div key={r.id} className="border border-slate-200 dark:border-slate-700 rounded-xl p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-slate-800 dark:text-white">
                        {r.item} <span className="text-slate-400 text-sm">× {r.quantity}</span>
                      </p>
                      {r.subjectOrClass && (
                        <p className="text-xs text-slate-400 mt-0.5">{r.subjectOrClass}</p>
                      )}
                      <p className="text-sm text-slate-500 mt-1.5">{r.reason}</p>
                    </div>
                    <span className={`shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold ${st.color}`}>
                      {st.icon}
                      {st.label}
                    </span>
                  </div>
                  {r.status !== "PENDING" && r.reviewNote && (
                    <div className="mt-3 pt-3 border-t border-slate-100 dark:border-slate-700 text-xs text-slate-500">
                      <span className="font-medium">Shënim nga menaxhmenti:</span> {r.reviewNote}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
