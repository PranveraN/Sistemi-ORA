"use client";

import { useMemo, useState } from "react";
import { X, Send, Loader2, AlertTriangle, PhoneOff, CheckCircle } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { countSegments } from "@/lib/smsSegments";
import type { MessageType } from "@/lib/smsStatus";

export interface ReviewRow {
  key: string;
  phone: string;
  /** "Arta Krasniqi" ose "Arta (5A) dhe Blerim (3B)" kur është një SMS për familje */
  names: string;
  classes: string;
  studentId: number;
  /** Të gjithë fëmijët e përfshirë (për historikun e secilit) */
  studentIds: number[];
  statusLabel: string;
  paymentStatus: string | null;
  message: string;
  /** Data e SMS-it të fundit për këtë lloj në 3 ditët e fundit, nëse ka */
  recentAt: string | null;
}

export interface SkippedRow {
  key: string;
  names: string;
  classes: string;
  reason: string;
}

// Rishikimi para dërgimit — lista e plotë e marrësve me mesazhin e
// personalizuar për secilin; dërgimi bëhet VETËM pas konfirmimit këtu.
// Marrësit që kanë marrë SMS për të njëjtin lloj në 3 ditët e fundit
// shënohen me paralajmërim dhe mbeten të pazgjedhur si parazgjedhje.
export default function SmsReviewModal({
  rows, skipped, type, windowDays, onClose, onSent,
}: {
  rows: ReviewRow[];
  skipped: SkippedRow[];
  type: MessageType;
  windowDays: number;
  onClose: () => void;
  onSent: () => void;
}) {
  const [checked, setChecked] = useState<Set<string>>(() => new Set(rows.filter(r => !r.recentAt).map(r => r.key)));
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ sent: number; failed: number; total: number; errors: string[] } | null>(null);

  const selected = rows.filter(r => checked.has(r.key));
  const totalSegments = useMemo(
    () => selected.reduce((s, r) => s + countSegments(r.message).segments, 0),
    [selected],
  );
  const recentCount = rows.filter(r => r.recentAt).length;

  function toggle(key: string) {
    setChecked(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }
  function toggleAll() {
    setChecked(prev => prev.size === rows.length ? new Set() : new Set(rows.map(r => r.key)));
  }

  async function send() {
    if (!selected.length) return;
    setError("");
    setSending(true);
    try {
      const res = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "",
          messageType: type,
          recipients: selected.map(r => ({
            phone: r.phone,
            name: `${r.names} (prindi)`,
            studentId: r.studentId,
            studentIds: r.studentIds,
            message: r.message,
            paymentStatus: r.paymentStatus,
          })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "Dërgimi dështoi."); return; }
      setResult(d);
      onSent();
    } catch {
      setError("Gabim rrjeti — provo përsëri.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={() => !sending && onClose()}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 className="section-title">Rishiko dhe dërgo</h2>
            <p className="text-xs text-slate-400 mt-0.5">
              {selected.length} nga {rows.length} marrës të zgjedhur · {totalSegments} SMS gjithsej
            </p>
          </div>
          <button onClick={onClose} disabled={sending} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        {result ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
            <p className="text-sm text-slate-700 dark:text-slate-200">
              U dërgua te {result.sent} nga {result.total} marrës
              {result.failed > 0 && <span className="text-red-500"> — {result.failed} dështuan ({result.errors.join(", ")})</span>}
            </p>
            <button onClick={onClose} className="btn-primary">Mbyll</button>
          </div>
        ) : (
          <>
            <div className="overflow-y-auto flex-1">
              {recentCount > 0 && (
                <div className="mx-5 mt-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400 text-xs flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>
                    {recentCount} marrës kanë marrë SMS për këtë lloj pagese në {windowDays} ditët e fundit — janë lënë të pazgjedhur.
                    Zgjidhi me dorë nëse dëshiron t&apos;u dërgosh përsëri.
                  </span>
                </div>
              )}
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                  <tr>
                    <th className="px-3 py-2 w-8">
                      <input type="checkbox" checked={checked.size === rows.length && rows.length > 0} onChange={toggleAll} />
                    </th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Nxënësi / Klasa</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Telefoni</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Statusi</th>
                    <th className="text-left px-3 py-2 text-xs font-semibold text-slate-500 uppercase">Mesazhi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {rows.map(r => (
                    <tr key={r.key} className={`align-top ${checked.has(r.key) ? "" : "opacity-60"}`}>
                      <td className="px-3 py-2">
                        <input type="checkbox" checked={checked.has(r.key)} onChange={() => toggle(r.key)} />
                      </td>
                      <td className="px-3 py-2">
                        <p className="font-medium text-slate-800 dark:text-slate-100">{r.names}</p>
                        <p className="text-xs text-slate-400">{r.classes || "—"}</p>
                        {r.recentAt && (
                          <p className="text-xs text-amber-600 flex items-center gap-1 mt-0.5">
                            <AlertTriangle className="w-3 h-3" /> SMS më {formatDateTime(r.recentAt)}
                          </p>
                        )}
                      </td>
                      <td className="px-3 py-2 text-slate-500 whitespace-nowrap">{r.phone}</td>
                      <td className="px-3 py-2 text-xs text-slate-500">{r.statusLabel}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-300 max-w-sm">
                        {r.message}
                        <span className="block text-slate-400 mt-0.5">{countSegments(r.message).segments} segment(e)</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {skipped.length > 0 && (
                <div className="m-5 p-3 rounded-xl bg-slate-50 dark:bg-slate-800/50">
                  <p className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mb-1.5">
                    <PhoneOff className="w-3.5 h-3.5" /> Anashkaluar — {skipped.length} pa numër ose me numër të pavlefshëm
                  </p>
                  <div className="space-y-0.5">
                    {skipped.map(s => (
                      <p key={s.key} className="text-xs text-slate-500">
                        {s.names}{s.classes && ` (${s.classes})`} — <span className="text-red-500">{s.reason}</span>
                      </p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between gap-3 p-5 border-t border-slate-100 dark:border-slate-700">
              {error ? <p className="text-sm text-red-500">{error}</p> : <span />}
              <div className="flex gap-2">
                <button onClick={onClose} disabled={sending} className="btn-secondary">Anulo</button>
                <button onClick={send} disabled={sending || !selected.length} className="btn-primary">
                  {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  {sending ? "Duke dërguar..." : `Dërgo te ${selected.length} marrës`}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
