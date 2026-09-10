"use client";

import { useState } from "react";
import { X, Send, Loader2, Mail, AlertTriangle } from "lucide-react";

interface Props {
  invoiceId: number;
  invoiceNumber: string;
  defaultEmail: string | null;
  onClose: () => void;
  onSent: () => void;
}

// Ripërdoret te lista e faturave DHE te vetë fatura — email-i i zgjidhur
// automatikisht (babai/nëna) shfaqet gjithmonë i para-mbushur, por i
// editueshëm, që stafi ta verifikojë/korrigjojë para se të dërgojë realisht.
export default function EmailInvoiceModal({ invoiceId, invoiceNumber, defaultEmail, onClose, onSent }: Props) {
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");

  async function handleSend() {
    setError("");
    if (!email.trim() || !email.includes("@")) { setError("Shkruaj një email të vlefshëm."); return; }
    setSending(true);
    const res = await fetch(`/api/invoices/${invoiceId}/email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email.trim() }),
    });
    const d = await res.json().catch(() => ({}));
    setSending(false);
    if (!res.ok) { setError(d.error || "Dërgimi dështoi."); return; }
    onSent();
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Mail className="w-4 h-4 text-primary-500" /> Dërgo #{invoiceNumber} me Email
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-3">
          {!defaultEmail && (
            <div className="flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-900/20 rounded-lg text-xs text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5" />
              S'u gjet email i regjistruar për prindin — shkruaje manualisht më poshtë.
            </div>
          )}
          <div>
            <label className="form-label">Email i prindit — verifikoje para se të dërgosh</label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="form-input"
              placeholder="prindi@email.com"
              autoFocus
            />
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
        </div>

        <div className="flex gap-3 p-5 pt-0">
          <button onClick={onClose} className="btn-ghost flex-1">Anulo</button>
          <button onClick={handleSend} disabled={sending} className="btn-primary flex-1 justify-center">
            {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            {sending ? "Duke dërguar..." : "Dërgo"}
          </button>
        </div>
      </div>
    </div>
  );
}
