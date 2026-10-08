"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { X, Loader2, ExternalLink } from "lucide-react";
import HistoryList, { type HistoryEntry } from "./HistoryList";
import { SEV_LABEL, SEV_CLASS, STATUS_LABEL, STATUS_CLASS, STATUSES, MODULE_LABEL, euro, fmtDateTime, fmtValue } from "./labels";

// Detajet e një gjetjeje: dëshmia, lidhja te rekordi, historiku i tij, komentet
// dhe ndryshimi i statusit (me koment të detyrueshëm).

interface Detail {
  finding: {
    id: number; ruleCode: string; severity: string; module: string; status: string; title: string; description: string | null;
    amountCents: number | null; entityType: string | null; entityId: number | null; createdAt: string; lastSeenAt: string | null;
    evidence: Record<string, unknown> | null;
  };
  rule: { name: string; description: string } | null;
  link: { href: string; label: string } | null;
  comments: { id: number; userName: string | null; text: string; statusFrom: string | null; statusTo: string | null; createdAt: string }[];
  history: HistoryEntry[];
}

export default function FindingDetail({ id, onClose, onChanged }: { id: number; onClose: () => void; onChanged: () => void }) {
  const [d, setD] = useState<Detail | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setError("");
    const r = await fetch(`/api/auditimi/gjetjet/${id}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error || "S'u ngarkua."); return; }
    setD(j);
    setStatus(j.finding.status);
  }
  useEffect(() => { load(); }, [id]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (comment.trim().length < 3) { setError("Shkruani një koment (të paktën 3 shenja)."); return; }
    setSaving(true); setError("");
    const r = await fetch(`/api/auditimi/gjetjet/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, comment }) });
    const j = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) { setError(j.error || "Ruajtja dështoi."); return; }
    setComment("");
    await load();
    onChanged();
  }

  const f = d?.finding;
  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-start sm:items-center justify-center p-2 sm:p-4" role="dialog" aria-modal="true" aria-labelledby="gjetja-titulli">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-3xl max-h-[95vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-200 dark:border-slate-700">
          <div className="min-w-0">
            <h2 id="gjetja-titulli" className="font-semibold text-slate-900 dark:text-white">{f?.title ?? "Gjetja"}</h2>
            {f && (
              <div className="flex flex-wrap gap-1.5 mt-1.5 text-[11px]">
                <span className={`px-1.5 py-0.5 rounded font-semibold ${SEV_CLASS[f.severity]}`}>{SEV_LABEL[f.severity] ?? f.severity}</span>
                <span className={`px-1.5 py-0.5 rounded font-semibold ${STATUS_CLASS[f.status]}`}>{STATUS_LABEL[f.status] ?? f.status}</span>
                <span className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">{f.ruleCode} · {MODULE_LABEL[f.module] ?? f.module}</span>
              </div>
            )}
          </div>
          <button type="button" onClick={onClose} aria-label="Mbyll" className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-y-auto px-5 py-4 space-y-5 text-sm">
          {!d && !error && <Loader2 className="w-5 h-5 animate-spin text-primary-400" aria-label="Duke ngarkuar" />}
          {error && <p role="alert" className="text-red-600">{error}</p>}
          {f && (
            <>
              <section className="space-y-1.5">
                {f.description && <p className="text-slate-700 dark:text-slate-200">{f.description}</p>}
                {d.rule && <p className="text-xs text-slate-500">Rregulli: <b>{d.rule.name}</b> — {d.rule.description}</p>}
                <p className="text-xs text-slate-500">
                  Shuma: <b>{euro(f.amountCents)}</b> · Gjetur më {fmtDateTime(f.createdAt)}{f.lastSeenAt && <> · Parë së fundi {fmtDateTime(f.lastSeenAt)}</>}
                </p>
                {d.link && (
                  <Link href={d.link.href} className="inline-flex items-center gap-1 text-primary-700 dark:text-primary-300 hover:underline font-medium">
                    <ExternalLink className="w-4 h-4" aria-hidden /> {d.link.label}
                  </Link>
                )}
              </section>

              {f.evidence && Object.keys(f.evidence).length > 0 && (
                <section>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1.5">Dëshmia</h3>
                  <table className="w-full text-xs">
                    <tbody>
                      {Object.entries(f.evidence).map(([k, v]) => (
                        <tr key={k} className="border-t border-slate-100 dark:border-slate-800 align-top">
                          <td className="py-1 pr-3 text-slate-500 whitespace-nowrap">{k}</td>
                          <td className="py-1 text-slate-800 dark:text-slate-200 break-all">
                            {v && typeof v === "object" ? <pre className="whitespace-pre-wrap font-mono text-[11px]">{JSON.stringify(v, null, 1)}</pre> : fmtValue(k, v)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {f.entityType && f.entityId && (
                <section>
                  <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1.5">Historiku i ndryshimeve të rekordit</h3>
                  <HistoryList entries={d.history} />
                </section>
              )}

              <section>
                <h3 className="font-semibold text-slate-800 dark:text-slate-100 mb-1.5">Komentet dhe statusi</h3>
                {d.comments.length === 0 && <p className="text-xs text-slate-500 mb-2">Ende pa komente.</p>}
                <ul className="space-y-2 mb-3">
                  {d.comments.map(c => (
                    <li key={c.id} className="rounded-lg bg-slate-50 dark:bg-slate-800/60 px-3 py-2">
                      <p className="text-xs text-slate-500">{c.userName ?? "—"} · {fmtDateTime(c.createdAt)}
                        {c.statusFrom !== c.statusTo && <> · {STATUS_LABEL[c.statusFrom ?? ""] ?? c.statusFrom} → <b>{STATUS_LABEL[c.statusTo ?? ""] ?? c.statusTo}</b></>}
                      </p>
                      <p className="text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{c.text}</p>
                    </li>
                  ))}
                </ul>
                <div className="grid sm:grid-cols-3 gap-2">
                  <div>
                    <label htmlFor="gjetja-statusi" className="form-label">Statusi</label>
                    <select id="gjetja-statusi" className="form-input" value={status} onChange={e => setStatus(e.target.value)}>
                      {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                    </select>
                  </div>
                  <div className="sm:col-span-2">
                    <label htmlFor="gjetja-komenti" className="form-label">Komenti (i detyrueshëm)</label>
                    <textarea id="gjetja-komenti" className="form-input min-h-[70px]" value={comment} onChange={e => setComment(e.target.value)} maxLength={2000}
                      placeholder="P.sh. U kontrollua me prindin — pagesa është e saktë." />
                  </div>
                </div>
                <div className="flex justify-end mt-2">
                  <button type="button" onClick={save} disabled={saving} className="btn-primary">
                    {saving && <Loader2 className="w-4 h-4 animate-spin" />} {status !== f.status ? "Ruaj statusin dhe komentin" : "Shto komentin"}
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
