"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { X, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import {
  buildSmsText, countSms, toSmsSafe, emailSubject as defaultSubject, EMAIL_INTRO, emailClosing, qtyLabel,
  type OrderTextContext,
} from "@/lib/supplierOrderText";

// "Pamja paraprake e porosisë" — SMS majtas, email djathtas (vetëm kanalet e
// zgjedhura), të dy të redaktueshëm. Përdoret nga "Për t'u porositur" dhe nga
// "Dërgo përsëri" te Porositë. Statusin e ndryshon serveri, vetëm pas suksesit.

export interface OrderLine {
  key: string;
  name: string;
  quantity: number;
  unit: string;
  materialId: number | null;
  customItemName: string | null;
  color: string | null;
  requestItemIds: number[];
}

export interface SupplierInfo {
  name: string; email: string; phone: string; schoolName: string; schoolPhone: string; adminName: string; adminEmail: string;
}

interface ChannelResult { ok: boolean; error: string | null }
interface SendResult {
  dispatchId: number; orderId: number | null; orderNumber: string | null; supplierName: string; orderedItems: number;
  sms: ChannelResult | null; email: ChannelResult | null; error?: string;
}

export default function OrderPreviewModal({ lines, supplier, channels, orderId, onClose, onSent }: {
  lines: OrderLine[];
  supplier: SupplierInfo;
  channels: { sms: boolean; email: boolean };
  orderId?: number;           // "Dërgo përsëri" — s'krijon porosi të re
  onClose: () => void;
  onSent: () => void;
}) {
  const ctx: OrderTextContext = useMemo(() => ({
    school: supplier.schoolName, schoolPhone: supplier.schoolPhone || "[numri i shkollës]", date: new Date(), adminName: supplier.adminName || "[Emri]",
  }), [supplier]);
  const textLines = lines.map(l => ({ name: l.name, quantity: l.quantity, unit: l.unit }));

  const [smsText, setSmsText] = useState(() => buildSmsText(textLines, ctx));
  const [subject, setSubject] = useState(() => defaultSubject(ctx));
  const [intro, setIntro] = useState(EMAIL_INTRO);
  const [closing, setClosing] = useState(() => emailClosing(ctx));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<SendResult | null>(null);
  const [retrying, setRetrying] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => { closeRef.current?.focus(); }, []);
  const sms = countSms(smsText);

  const sendLabel = channels.sms && channels.email ? "Dërgo me SMS dhe email" : channels.sms ? "Dërgo me SMS" : "Dërgo me email";

  async function send() {
    setBusy(true); setError("");
    try {
      const r = await fetch("/api/material-orders/send", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderId, channels,
          lines: lines.map(l => ({ materialId: l.materialId, customItemName: l.customItemName, name: l.name, color: l.color, unit: l.unit, quantity: l.quantity, requestItemIds: l.requestItemIds })),
          smsText, emailSubject: subject, emailIntro: intro, emailClosing: closing,
        }),
      });
      const d = await r.json().catch(() => ({}));
      if (d.dispatchId) {
        setResult(d);
        if (d.sms?.ok || d.email?.ok) onSent();
      } else {
        setError(d.error || "Dërgimi dështoi.");
      }
    } catch {
      setError("Gabim rrjeti — provo përsëri.");
    } finally {
      setBusy(false);
    }
  }

  async function retry(channel: "sms" | "email") {
    if (!result) return;
    setRetrying(true);
    try {
      const r = await fetch(`/api/material-orders/dispatch/${result.dispatchId}/retry`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channel }),
      });
      const d = await r.json().catch(() => ({}));
      setResult(res => res && { ...res, [channel]: { ok: !!d.ok, error: d.error ?? null } });
      if (d.ok) onSent();
    } finally {
      setRetrying(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}
      onKeyDown={e => { if (e.key === "Escape" && !busy) onClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="op-title"
        className="w-full max-w-4xl max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-slate-800 shadow-2xl animate-fade-in">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-slate-100 dark:border-slate-700">
          <h2 id="op-title" className="text-lg font-bold text-slate-900 dark:text-white">Pamja paraprake e porosisë</h2>
          <button ref={closeRef} type="button" onClick={onClose} disabled={busy} aria-label="Mbyll" className="p-1.5 rounded-lg text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-5 h-5" /></button>
        </div>

        {result ? (
          <ResultView result={result} channels={channels} resend={!!orderId} retrying={retrying} onRetry={retry} onBack={() => setResult(null)} onClose={onClose} />
        ) : (
          <>
            <div className={`overflow-y-auto p-5 sm:p-6 grid gap-6 ${channels.sms && channels.email ? "md:grid-cols-[minmax(0,0.85fr)_minmax(0,1fr)]" : ""}`}>
              {channels.sms && (
                <section aria-labelledby="op-sms">
                  <div className="flex items-baseline justify-between gap-2 mb-2">
                    <h3 id="op-sms" className="font-bold text-slate-900 dark:text-white">SMS</h3>
                    <span className="text-xs text-slate-500 dark:text-slate-400">te {supplier.phone}</span>
                  </div>
                  <div className="rounded-2xl bg-slate-100 dark:bg-slate-900/60 p-3">
                    <label htmlFor="op-sms-text" className="sr-only">Teksti i SMS-it</label>
                    <textarea id="op-sms-text" value={smsText} onChange={e => setSmsText(toSmsSafe(e.target.value))} spellCheck={false}
                      rows={Math.min(14, Math.max(6, smsText.split("\n").length + 1))}
                      className="w-full resize-y rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3 text-sm leading-relaxed text-slate-900 dark:text-slate-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-500" />
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2" aria-live="polite">
                    {sms.segments} SMS · pa ë/ç (zëvendësohen automatikisht) · {sms.chars} karaktere
                    {sms.unicode && <span className="text-amber-700 dark:text-amber-400"> · përmban shkronja speciale (70 karaktere/SMS)</span>}
                  </p>
                </section>
              )}

              {channels.email && (
                <section aria-labelledby="op-email">
                  <h3 id="op-email" className="font-bold text-slate-900 dark:text-white mb-2">Email</h3>
                  <div className="rounded-2xl border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <dl className="grid grid-cols-[88px_1fr] gap-x-3 gap-y-1.5 items-center px-4 py-3 bg-slate-50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-700 text-sm">
                      <dt className="text-slate-500 dark:text-slate-400">Për:</dt><dd className="text-slate-800 dark:text-slate-100 break-all">{supplier.email}</dd>
                      <dt className="text-slate-500 dark:text-slate-400">Përgjigju:</dt><dd className="text-slate-800 dark:text-slate-100 break-all">{supplier.adminEmail || "—"}</dd>
                      <dt className="text-slate-500 dark:text-slate-400"><label htmlFor="op-subject">Subjekti:</label></dt>
                      <dd><input id="op-subject" value={subject} onChange={e => setSubject(e.target.value)} className="form-input py-1 text-sm font-semibold" /></dd>
                    </dl>
                    <div className="p-4 space-y-3">
                      <label htmlFor="op-intro" className="sr-only">Hyrja e email-it</label>
                      <textarea id="op-intro" value={intro} onChange={e => setIntro(e.target.value)} rows={3}
                        className="w-full resize-y rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700 bg-transparent p-1.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-primary-500" />
                      <table className="w-full text-sm border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
                        <thead className="bg-slate-50 dark:bg-slate-900/50 text-xs text-slate-500 dark:text-slate-400">
                          <tr><th className="text-left px-3 py-2 w-10">Nr.</th><th className="text-left px-3 py-2">Artikulli</th><th className="text-right px-3 py-2">Sasia</th></tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                          {textLines.map((l, i) => (
                            <tr key={i}><td className="px-3 py-2 text-slate-500">{i + 1}</td><td className="px-3 py-2 text-slate-800 dark:text-slate-100">{l.name}</td><td className="px-3 py-2 text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">{qtyLabel(l)}</td></tr>
                          ))}
                        </tbody>
                      </table>
                      <label htmlFor="op-closing" className="sr-only">Mbyllja e email-it</label>
                      <textarea id="op-closing" value={closing} onChange={e => setClosing(e.target.value)} rows={5}
                        className="w-full resize-y rounded-lg border border-transparent hover:border-slate-200 dark:hover:border-slate-700 bg-transparent p-1.5 text-sm text-slate-800 dark:text-slate-100 focus:outline-none focus:border-slate-300 focus-visible:ring-2 focus-visible:ring-primary-500" />
                    </div>
                  </div>
                </section>
              )}
            </div>

            {error && <p role="alert" className="mx-5 sm:mx-6 mb-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-5 sm:px-6 py-4 border-t border-slate-100 dark:border-slate-700 bg-slate-50/60 dark:bg-slate-900/30 rounded-b-2xl">
              <button type="button" onClick={onClose} disabled={busy} className="btn-secondary justify-center">Anulo</button>
              <button type="button" onClick={send} disabled={busy} className="btn-primary justify-center">
                {busy && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} {sendLabel}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function ResultView({ result, channels, resend, retrying, onRetry, onBack, onClose }: {
  result: SendResult; channels: { sms: boolean; email: boolean }; resend: boolean; retrying: boolean;
  onRetry: (c: "sms" | "email") => void; onBack: () => void; onClose: () => void;
}) {
  const s = result.sms, e = result.email;
  const okList = [s?.ok && "SMS", e?.ok && "email"].filter(Boolean).join(" + ");
  const allOk = (!channels.sms || !!s?.ok) && (!channels.email || !!e?.ok);
  const noneOk = !s?.ok && !e?.ok;
  return (
    <div className="p-5 sm:p-6 space-y-4">
      {allOk ? (
        <p role="status" className="flex items-start gap-2.5 rounded-xl border border-green-200 dark:border-green-900 bg-green-50 dark:bg-green-950/30 px-4 py-3 text-sm text-green-800 dark:text-green-300">
          <CheckCircle2 className="w-5 h-5 shrink-0" aria-hidden />
          <span>
            {resend
              ? <>Porosia u ridërgua te {result.supplierName} ({okList}).</>
              : <>Porosia u dërgua te {result.supplierName} ({okList}). {result.orderedItems} {result.orderedItems === 1 ? "artikull kaloi" : "artikuj kaluan"} në Porositur.</>}
          </span>
        </p>
      ) : noneOk ? (
        <div role="alert" className="flex items-start gap-2.5 rounded-xl border border-red-200 dark:border-red-900 bg-red-50 dark:bg-red-950/30 px-4 py-3 text-sm text-red-800 dark:text-red-300">
          <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden />
          <div>
            <p className="font-semibold">Porosia nuk u dërgua. Artikujt mbeten te &quot;Për t&apos;u porositur&quot;.</p>
            {s && <p>SMS: {s.error}</p>}
            {e && <p>Email: {e.error}</p>}
          </div>
        </div>
      ) : (
        <div role="alert" className="rounded-xl border border-amber-200 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/30 px-4 py-3 text-sm text-amber-900 dark:text-amber-200 space-y-2">
          <p className="flex items-start gap-2.5">
            <AlertTriangle className="w-5 h-5 shrink-0" aria-hidden />
            <span>
              {e?.ok ? <>Email-i u dërgua, SMS-i dështoi: {s?.error}</> : <>SMS-i u dërgua, email-i dështoi: {e?.error}</>}
              {!resend && <> {result.orderedItems} {result.orderedItems === 1 ? "artikull kaloi" : "artikuj kaluan"} në Porositur.</>}
            </span>
          </p>
          <button type="button" onClick={() => onRetry(e?.ok ? "sms" : "email")} disabled={retrying} className="btn-secondary text-sm">
            {retrying && <Loader2 className="w-4 h-4 animate-spin" aria-hidden />} {e?.ok ? "Provo përsëri SMS-in" : "Provo përsëri email-in"}
          </button>
        </div>
      )}
      <div className="flex justify-end gap-2">
        {noneOk && <button type="button" onClick={onBack} className="btn-secondary">Provo përsëri</button>}
        <button type="button" onClick={onClose} className="btn-primary">Mbyll</button>
      </div>
    </div>
  );
}
