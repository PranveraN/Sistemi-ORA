"use client";

import { useMemo, useState } from "react";
import { X, Search, Send, Loader2, CheckCircle2 } from "lucide-react";
import { formatCurrency } from "@/lib/utils";

export interface TuitionGroupRow {
  studentId: number;
  name: string;
  phone: string;
  amount: number;
  type?: "FULL" | "PARTIAL";
}

interface Props {
  title: string;
  rows: TuitionGroupRow[];
  onClose: () => void;
}

const TYPE_LABEL: Record<string, string> = { FULL: "e plotë", PARTIAL: "me këste" };

export default function TuitionGroupModal({ title, rows, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [message, setMessage] = useState("Përshëndetje, {emri} ka ende borxh të papaguar. Ju lutem kontaktoni shkollën për rregullim. Faleminderit, Akademia Ora");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<{ sent: number; failed: number } | null>(null);
  const [error, setError] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(r => r.name.toLowerCase().includes(q));
  }, [rows, query]);

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const withPhone = rows.filter(r => r.phone.trim());

  async function sendGroupMessage() {
    if (!message.trim() || withPhone.length === 0) return;
    setSending(true);
    setError("");
    setResult(null);
    const res = await fetch("/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message: message.trim(),
        recipients: withPhone.map(r => ({ phone: r.phone, name: r.name, studentId: r.studentId })),
      }),
    });
    const d = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) { setError(d.error || "Dërgimi dështoi."); return; }
    setResult({ sent: d.sent ?? 0, failed: d.failed ?? 0 });
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-xl max-h-[90vh] flex flex-col animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">{title}</h3>
            <p className="text-xs text-slate-400 mt-0.5">{rows.length} nxënës — {formatCurrency(total)} gjithsej</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-4 border-b border-slate-100 dark:border-slate-700 shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder="Kërko nxënësin..." className="form-input pl-9 text-sm" />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-700/50">
          {filtered.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">Asnjë përputhje.</p>
          ) : filtered.map(r => (
            <div key={r.studentId} className="flex items-center justify-between px-5 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-slate-100 truncate">{r.name}</p>
                {!r.phone.trim() && <p className="text-[11px] text-amber-500">Pa numër telefoni</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {r.type && (
                  <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400">{TYPE_LABEL[r.type]}</span>
                )}
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">{formatCurrency(r.amount)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-slate-100 dark:border-slate-700 shrink-0 space-y-2">
          {result ? (
            <p className="text-sm text-green-600 font-medium flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4" /> {result.sent} SMS u dërguan{result.failed > 0 ? `, ${result.failed} dështuan` : ""}.</p>
          ) : (
            <>
              <label className="form-label">Mesazhi për të gjithë grupin ({withPhone.length} me telefon)</label>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                rows={3}
                className="form-input text-sm"
                placeholder="Shkruani mesazhin... {emri} zëvendësohet automatikisht për secilin."
              />
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button
                onClick={sendGroupMessage}
                disabled={sending || !message.trim() || withPhone.length === 0}
                className="btn-primary w-full justify-center"
              >
                {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {sending ? "Duke dërguar..." : `Dërgo te ${withPhone.length} marrës`}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
