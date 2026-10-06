"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Minus, Plus, XCircle, CheckCircle2, MoreHorizontal, Trash2, Loader2, Check,
  AlertTriangle, Clock, Paperclip, Link as LinkIcon, History, Save, ShoppingCart,
} from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { isPartialRequest } from "@/lib/materialConstants";
import { requestStatusUi, hasLiveDeadline } from "@/lib/materialStatusUi";
import StatusBadge from "../StatusBadge";
import { fmtD } from "../module/ui";
import { type MaterialRequestRow, type RequestItemRow, itemName, orderedQty, sentDate, isShortNotice, UNDECIDED } from "./types";

// Detajet e kërkesës (Materialet → Kërkesat): vija kohore, artikujt me
// gjendjen, lënda/arsyeja, lidhja me porosinë dhe veprimet sipas statusit.

interface HistoryEntry { id: number; fromStatus: string | null; toStatus: string; note: string | null; createdAt: string; changedBy: { name: string } }
type Decision = { included: boolean; qty: number };

const statusLabel = (s: string) => requestStatusUi(s).label;

/** Gjendja e një artikulli: Në pritje · Aprovuar · Porositur · Pranuar (pjesërisht) · Refuzuar. */
function itemState(it: RequestItemRow): { text: string; cls: string } {
  if (it.status === "REJECTED") return { text: "Refuzuar", cls: "text-red-700 dark:text-red-400" };
  if (it.status === "PENDING") return { text: "Në pritje", cls: "text-slate-500 dark:text-slate-400" };
  const approved = it.approvedQuantity ?? it.quantity;
  if (it.deliveredQuantity >= approved && approved > 0) return { text: "✓ Pranuar", cls: "text-green-700 dark:text-green-400" };
  if (it.deliveredQuantity > 0) return { text: `Pranuar ${it.deliveredQuantity}/${approved}`, cls: "text-orange-700 dark:text-orange-400" };
  if (orderedQty(it) > 0) return { text: "Porositur", cls: "text-orange-700 dark:text-orange-400" };
  return { text: "Aprovuar", cls: "text-violet-700 dark:text-violet-300" };
}

export default function RequestDetail({ request, leadDays, canAct, onUpdated, onDeleted }: {
  request: MaterialRequestRow;
  leadDays: number;
  canAct: boolean;
  onUpdated: () => void;
  onDeleted: () => void;
}) {
  const r = request;
  const editable = canAct && (UNDECIDED.has(r.status) || r.status === "APPROVED" || r.status === "PARTIALLY_APPROVED");
  const anyOrdered = r.items.some(it => orderedQty(it) > 0);

  const initialDecisions = useMemo(() => {
    const d: Record<number, Decision> = {};
    for (const it of r.items) d[it.id] = { included: it.status !== "REJECTED", qty: it.approvedQuantity ?? it.quantity };
    return d;
  }, [r]);
  const [decisions, setDecisions] = useState<Record<number, Decision>>(initialDecisions);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[] | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => { setDecisions(initialDecisions); setNote(""); setError(""); setRejecting(false); setRejectReason(""); }, [initialDecisions]);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/material-requests/${r.id}`).then(res => (res.ok ? res.json() : null)).then(d => {
      if (!cancelled) setHistory(d?.statusHistory ?? []);
    }).catch(() => !cancelled && setHistory([]));
    return () => { cancelled = true; };
  }, [r.id, r.status, r.items]);

  useEffect(() => {
    if (!menuOpen) return;
    const close = (e: MouseEvent) => { if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [menuOpen]);

  const selectedCount = r.items.filter(it => decisions[it.id]?.included).length;
  const dirty = r.items.some(it => {
    const d = decisions[it.id];
    if (!d) return false;
    if (it.status === "PENDING") return true;
    return d.included !== (it.status === "APPROVED") || (d.included && d.qty !== (it.approvedQuantity ?? it.quantity));
  });

  function setQty(it: RequestItemRow, qty: number) {
    const min = Math.max(1, orderedQty(it));
    setDecisions(d => ({ ...d, [it.id]: { ...d[it.id], qty: Math.min(it.quantity, Math.max(min, qty)) } }));
  }

  async function call(url: string, init: RequestInit, fallback: string): Promise<boolean> {
    setBusy(true); setError("");
    try {
      const res = await fetch(url, init);
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || fallback); return false; }
      return true;
    } catch { setError("Gabim rrjeti — provo përsëri."); return false; }
    finally { setBusy(false); }
  }

  async function saveDecisions() {
    const items = r.items.map(it => {
      const d = decisions[it.id];
      return d.included ? { id: it.id, status: "APPROVED", approvedQuantity: d.qty } : { id: it.id, status: "REJECTED" };
    });
    const ok = await call(`/api/material-requests/${r.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items, reviewNote: note.trim() || undefined }),
    }, "Ruajtja dështoi.");
    if (ok) onUpdated();
  }

  async function reject() {
    if (!rejectReason.trim()) { setError("Shkruaj arsyen e refuzimit."); return; }
    const ok = await call(`/api/material-requests/${r.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "REJECTED", reviewNote: rejectReason.trim() }),
    }, "Refuzimi dështoi.");
    if (ok) { setRejecting(false); onUpdated(); }
  }

  async function remove() {
    setMenuOpen(false);
    if (!confirm(`Fshi kërkesën e ${r.teacher.name}?`)) return;
    const ok = await call(`/api/material-requests/${r.id}`, { method: "DELETE" }, "Fshirja dështoi.");
    if (ok) onDeleted();
  }

  // ── Vija kohore: Dërguar → Aprovuar → Porositur → Dorëzuar (ose Dërguar → Refuzuar) ──
  const firstAt = (...statuses: string[]) => history?.find(h => statuses.includes(h.toStatus) && h.fromStatus !== h.toStatus)?.createdAt ?? null;
  const rank = { SUBMITTED: 0, UNDER_REVIEW: 0, APPROVED: 1, PARTIALLY_APPROVED: 1, ORDERED: 2, DELIVERED: 3 }[r.status as "SUBMITTED"] ?? 0;
  const steps = r.status === "REJECTED"
    ? [
        { label: "Dërguar", date: sentDate(r), done: true },
        { label: "Refuzuar", date: firstAt("REJECTED") ?? r.reviewedAt ?? null, done: true, rejected: true },
      ]
    : [
        { label: "Dërguar", date: sentDate(r), done: true },
        { label: "Aprovuar", date: firstAt("APPROVED", "PARTIALLY_APPROVED") ?? (rank >= 1 ? r.reviewedAt ?? null : null), done: rank >= 1 },
        { label: "Porositur", date: firstAt("ORDERED"), done: rank >= 2 },
        { label: "Dorëzuar", date: firstAt("DELIVERED") ?? r.deliveredAt ?? null, done: rank >= 3 },
      ];

  const partial = isPartialRequest(r.status, r.items);
  const live = hasLiveDeadline(r.status);
  const orders = useMemo(() => {
    const m = new Map<number, string>();
    for (const it of r.items) for (const l of it.orderLinks) m.set(l.orderItem.order.id, l.orderItem.order.orderNumber);
    return [...m.entries()];
  }, [r.items]);

  return (
    <section className="card p-5 sm:p-6 space-y-5" aria-labelledby="rd-title">
      {/* ── Koka ── */}
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="rd-title" className="text-xl font-extrabold text-slate-900 dark:text-white">{r.teacher.name}</h2>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">
            {r.class?.name ? `Klasa ${r.class.name} · ` : ""}dërguar më {fmtD(sentDate(r))} · {r.items.length} {r.items.length === 1 ? "artikull" : "artikuj"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={r.status} extra={partial ? "pjesërisht" : undefined} />
          <div className="relative" ref={menuRef}>
            <button type="button" onClick={() => setMenuOpen(v => !v)} aria-label="Më shumë veprime" aria-haspopup="menu" aria-expanded={menuOpen}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800"><MoreHorizontal className="w-5 h-5" /></button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 z-20 mt-1 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1">
                <button role="menuitem" type="button" disabled={anyOrdered || !canAct} onClick={remove}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 disabled:opacity-40"
                  title={anyOrdered ? "Kërkesa ka artikuj në porosi — s'mund të fshihet" : undefined}>
                  <Trash2 className="w-4 h-4" /> Fshi kërkesën
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Vija kohore ── */}
      <ol className="flex items-start overflow-x-auto pb-1" aria-label="Rrjedha e kërkesës">
        {steps.map((s, i) => (
          <li key={s.label} className="contents">
            <div className="flex flex-col items-center gap-1.5 min-w-[84px] shrink-0 text-center">
              <span className={`w-[30px] h-[30px] rounded-full flex items-center justify-center ${
                "rejected" in s && s.rejected ? "bg-red-600" : s.done ? "bg-green-700" : "bg-slate-200 dark:bg-slate-700"}`} aria-hidden>
                {"rejected" in s && s.rejected ? <XCircle className="w-4 h-4 text-white" /> : s.done ? <Check className="w-4 h-4 text-white" strokeWidth={3} /> : <span className="w-2 h-2 rounded-full bg-slate-400" />}
              </span>
              <span className={`text-[13px] font-bold ${s.done ? "text-slate-900 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}>{s.label}</span>
              <span className="text-xs text-slate-500 dark:text-slate-400">{s.done && s.date ? fmtD(s.date) : s.done ? "" : "—"}</span>
              <span className="sr-only">{s.done ? "i kryer" : "i pakryer"}</span>
            </div>
            {i < steps.length - 1 && <span className={`flex-1 min-w-[24px] h-0.5 mt-[15px] ${steps[i + 1].done ? ("rejected" in steps[i + 1] ? "bg-red-600" : "bg-green-700") : "bg-slate-200 dark:bg-slate-700"}`} aria-hidden />}
          </li>
        ))}
      </ol>
      {r.status === "REJECTED" && r.reviewNote && (
        <p className="text-sm text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2"><b>Arsyeja e refuzimit:</b> {r.reviewNote}</p>
      )}

      {live && r.priority === "URGENT" && r.urgencyReason && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span><b>Urgjente:</b> {r.urgencyReason}</span>
        </div>
      )}
      {live && isShortNotice(r, leadDays) && (
        <p className="text-xs text-orange-700 dark:text-orange-400 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> U dërgua me më pak se {leadDays} ditë afat, pa qenë urgjente.
        </p>
      )}

      {/* ── Artikujt ── */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full min-w-[460px] text-sm">
          <thead>
            <tr className="text-left text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60">
              <th className="px-3.5 py-2.5">ARTIKULLI</th>
              <th className="px-3.5 py-2.5 w-[150px]">SASIA</th>
              <th className="px-3.5 py-2.5 w-[130px]">GJENDJA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {r.items.map(it => {
              const d = decisions[it.id] ?? { included: true, qty: it.quantity };
              const ordered = orderedQty(it);
              const locked = !editable || ordered > 0;
              const st = itemState(it);
              return (
                <tr key={it.id} className={editable && !d.included ? "opacity-50" : ""}>
                  <td className="px-3.5 py-2.5 align-top">
                    <div className="flex items-start gap-2">
                      {editable && (
                        <input type="checkbox" checked={d.included} disabled={locked}
                          onChange={e => setDecisions(x => ({ ...x, [it.id]: { ...d, included: e.target.checked } }))}
                          aria-label={`Përfshi ${itemName(it)}`} className="mt-1 accent-primary-600" />
                      )}
                      <div className="min-w-0">
                        <b className="text-slate-900 dark:text-white">{itemName(it)}</b>
                        {it.color && <span className="ml-1.5 text-xs text-slate-500">{it.color}</span>}
                        {(it.customDescription || it.itemReason) && <p className="text-xs text-slate-500">{it.customDescription || it.itemReason}</p>}
                        <div className="flex gap-2">
                          {it.productLink && <a href={it.productLink} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 inline-flex items-center gap-1"><LinkIcon className="w-3 h-3" />Lidhja</a>}
                          {it.attachmentPath && <a href={`/api/material-requests/attachments/${it.attachmentPath}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 inline-flex items-center gap-1"><Paperclip className="w-3 h-3" />Bashkëngjitja</a>}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3.5 py-2.5 align-top whitespace-nowrap text-slate-700 dark:text-slate-200">
                    {editable && d.included && !locked ? (
                      <div className="flex items-center gap-1">
                        <button type="button" onClick={() => setQty(it, d.qty - 1)} disabled={d.qty <= Math.max(1, ordered)} aria-label={`Ul sasinë e ${itemName(it)}`}
                          className="w-6 h-6 rounded border border-slate-200 dark:border-slate-600 flex items-center justify-center disabled:opacity-30"><Minus className="w-3 h-3" /></button>
                        <span className="w-7 text-center font-semibold">{d.qty}</span>
                        <button type="button" onClick={() => setQty(it, d.qty + 1)} disabled={d.qty >= it.quantity} aria-label={`Rrit sasinë e ${itemName(it)}`}
                          className="w-6 h-6 rounded border border-slate-200 dark:border-slate-600 flex items-center justify-center disabled:opacity-30"><Plus className="w-3 h-3" /></button>
                        <span className="text-xs text-slate-500 ml-1">nga {it.quantity} {it.unit}</span>
                      </div>
                    ) : (
                      <>{it.approvedQuantity !== null && it.approvedQuantity !== it.quantity && it.status === "APPROVED" ? `${it.approvedQuantity} nga ${it.quantity}` : it.quantity} {it.unit}</>
                    )}
                  </td>
                  <td className={`px-3.5 py-2.5 align-top text-[13px] font-bold ${editable && !d.included ? "text-red-600" : st.cls}`}>
                    {editable && !d.included ? "Përjashtuar" : st.text}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* ── Lënda dhe arsyeja (nga formulari i mësueses) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
        <div className="rounded-[10px] bg-slate-50 dark:bg-slate-800/60 px-3.5 py-3">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Lënda</p>
          <p className="mt-1 text-slate-900 dark:text-white">{r.subject?.name ?? "—"}</p>
        </div>
        <div className="rounded-[10px] bg-slate-50 dark:bg-slate-800/60 px-3.5 py-3">
          <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Arsyeja</p>
          <p className="mt-1 text-slate-900 dark:text-white whitespace-pre-wrap">{r.reason || "—"}</p>
        </div>
        {r.originalText?.trim() && r.originalText.trim() !== r.reason?.trim() && (
          <div className="sm:col-span-2 rounded-[10px] bg-slate-50 dark:bg-slate-800/60 px-3.5 py-3">
            <p className="text-xs font-bold text-slate-500 dark:text-slate-400">Teksti i mësueses</p>
            <p className="mt-1 text-sm text-slate-800 dark:text-slate-100 whitespace-pre-wrap">{r.originalText}</p>
          </div>
        )}
      </div>
      {r.reviewNote && r.status !== "REJECTED" && !UNDECIDED.has(r.status) && (
        <p className="text-xs text-slate-500">Shënim{r.reviewedBy ? ` nga ${r.reviewedBy.name}` : ""}: <span className="italic">{r.reviewNote}</span></p>
      )}

      {/* ── Lidhja me porosinë ── */}
      {orders.map(([id, num]) => (
        <Link key={id} href={`/materialet/porosite/${id}`}
          className="inline-flex flex-wrap items-center gap-2 rounded-[10px] border border-slate-300 dark:border-slate-600 px-3.5 py-2.5 font-bold text-slate-900 dark:text-white hover:border-primary-400 mr-2">
          <ShoppingCart className="w-4 h-4 text-primary-600" aria-hidden /> Pjesë e porosisë {num}
          <span className="text-primary-700 dark:text-primary-300">– Hap te Porositë</span>
        </Link>
      ))}

      {/* ── Veprimet sipas statusit (asnjë për të dorëzuarat) ── */}
      {editable && (
        <section className="space-y-3 border-t border-slate-100 dark:border-slate-700 pt-4" aria-label="Veprimet">
          {rejecting ? (
            <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/50 space-y-2">
              <label className="form-label" htmlFor="reject-reason">Arsyeja e refuzimit (i dërgohet mësueses)</label>
              <textarea id="reject-reason" autoFocus value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2} className="form-input text-sm" />
              <div className="flex gap-2">
                <button type="button" onClick={() => setRejecting(false)} disabled={busy} className="btn-secondary text-sm">Anulo</button>
                <button type="button" onClick={reject} disabled={busy || !rejectReason.trim()} className="btn-primary text-sm !bg-red-600 hover:!bg-red-700">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Refuzo kërkesën
                </button>
              </div>
            </div>
          ) : (
            <>
              <input value={note} onChange={e => setNote(e.target.value)} className="form-input text-sm" placeholder="Shënim për mësuesen (opsional)" aria-label="Shënim për mësuesen" />
              <div className="flex items-center gap-2 flex-wrap">
                {!anyOrdered && (
                  <button type="button" onClick={() => { setRejecting(true); setError(""); }} disabled={busy} className="btn-secondary text-sm text-red-600">
                    <XCircle className="w-4 h-4" /> Refuzo
                  </button>
                )}
                {!UNDECIDED.has(r.status) && !dirty && (
                  <p className="text-xs text-slate-500">Artikujt e aprovuar janë te „Për t&apos;u porositur” — shtoji te porosia nga paneli djathtas.</p>
                )}
                <button type="button" onClick={saveDecisions} disabled={busy || selectedCount === 0 || !dirty} className="btn-primary text-sm ml-auto"
                  title={selectedCount === 0 ? "Zgjidh të paktën një artikull — ose refuzoje kërkesën" : undefined}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : UNDECIDED.has(r.status) ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {UNDECIDED.has(r.status) ? `Aprovo (${selectedCount} ${selectedCount === 1 ? "artikull" : "artikuj"})` : "Ruaj ndryshimet"}
                </button>
              </div>
            </>
          )}
        </section>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {/* ── Historiku i statuseve ── */}
      <section className="border-t border-slate-100 dark:border-slate-700 pt-3">
        <button type="button" onClick={() => setShowHistory(v => !v)} aria-expanded={showHistory} className="text-xs font-medium text-slate-500 hover:text-primary-600 inline-flex items-center gap-1.5">
          <History className="w-3.5 h-3.5" /> Historiku i statuseve{history ? ` (${history.length})` : ""}
        </button>
        {showHistory && (
          <ol className="mt-2 space-y-1.5 text-xs">
            {history === null ? <li className="text-slate-400">Duke ngarkuar...</li>
              : history.length === 0 ? <li className="text-slate-400">Pa histori.</li>
              : history.map(h => (
                <li key={h.id} className="text-slate-500">
                  <span className="text-slate-400">{formatDateTime(h.createdAt)}</span> · {h.changedBy.name}:{" "}
                  {h.fromStatus === h.toStatus ? <span>ndryshim artikujsh</span>
                    : <>{h.fromStatus ? `${statusLabel(h.fromStatus)} → ` : ""}<b className="text-slate-700 dark:text-slate-300">{statusLabel(h.toStatus)}</b></>}
                  {h.note && <span className="italic"> — {h.note}</span>}
                </li>
              ))}
          </ol>
        )}
      </section>
    </section>
  );
}
