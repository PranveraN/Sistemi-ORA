"use client";

import { useState } from "react";
import { X, Send, Loader2, Check, Mail } from "lucide-react";
import { htmlPageToPdfBase64 } from "@/lib/htmlToPdf";
import { PrintBrandingFields, applyPrintBranding, loadPrintBranding, savePrintBranding, type PrintBranding } from "@/lib/printBranding";

// "Dërgo me email" për dokumentet e Sekretarisë: shkruan email-in → dokumenti
// (i njëjti si te "Printo") bëhet PDF dhe dërgohet si bashkëngjitje.
export default function EmailDocumentModal({ defaultTo, defaultSubject, defaultMessage, filename, label, getHtml, onClose, onSent }: {
  defaultTo: string; defaultSubject: string; defaultMessage: string; filename: string; label: string;
  getHtml: () => string; onClose: () => void; onSent?: (to: string) => void;
}) {
  const [to, setTo] = useState(defaultTo);
  const [subject, setSubject] = useState(defaultSubject);
  const [message, setMessage] = useState(defaultMessage);
  const [step, setStep] = useState<"" | "pdf" | "send">("");
  const [error, setError] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const [branding, setBranding] = useState<PrintBranding>(loadPrintBranding);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!to.trim()) { setError("Shkruani email-in."); return; }
    setError("");
    try {
      setStep("pdf");
      savePrintBranding(branding);
      const pdfBase64 = await htmlPageToPdfBase64(applyPrintBranding(getHtml(), branding));
      setStep("send");
      const r = await fetch("/api/sekretaria/email-document", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to, subject, message, filename, pdfBase64, label }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Dërgimi dështoi."); return; }
      setDone(d.failed ? `U dërgua te ${d.sent}; dështoi: ${(d.errors ?? []).join("; ")}` : `U dërgua te ${to.trim()}`);
      onSent?.(to.trim());
    } catch {
      setError("PDF-ja s'u krijua ose rrjeti dështoi — provo përsëri.");
    } finally {
      setStep("");
    }
  }

  const busy = step !== "";
  return (
    <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <form onSubmit={send} role="dialog" aria-modal="true" aria-labelledby="em-title" className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-800 shadow-2xl">
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h3 id="em-title" className="font-bold text-slate-900 dark:text-white flex items-center gap-2"><Mail className="w-4 h-4 text-primary-600" /> Dërgo me email</h3>
            <p className="text-xs text-slate-500 mt-0.5">{label} — si PDF ({filename}.pdf)</p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Mbyll" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>
        {done ? (
          <div className="p-5 space-y-4">
            <p className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400 font-medium"><Check className="w-5 h-5" /> {done}</p>
            <button type="button" onClick={onClose} className="btn-primary w-full justify-center">Mbyll</button>
          </div>
        ) : (
          <div className="p-5 space-y-3">
            <label className="block">
              <span className="form-label">Email-i i marrësit</span>
              <input type="text" inputMode="email" autoFocus className="form-input" value={to} onChange={e => setTo(e.target.value)} placeholder="emri@shembull.com (disa: me presje)" />
            </label>
            <label className="block">
              <span className="form-label">Subjekti</span>
              <input className="form-input" value={subject} onChange={e => setSubject(e.target.value)} />
            </label>
            <label className="block">
              <span className="form-label">Mesazhi</span>
              <textarea className="form-input" rows={4} value={message} onChange={e => setMessage(e.target.value)} />
            </label>
            <PrintBrandingFields value={branding} onChange={setBranding} />
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <button type="submit" disabled={busy} className="btn-primary w-full justify-center">
              {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {step === "pdf" ? "Duke krijuar PDF-në…" : step === "send" ? "Duke dërguar…" : "Dërgo"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
