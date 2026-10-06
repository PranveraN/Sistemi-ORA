"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Minus, Plus, XCircle, ShoppingCart, MoreHorizontal, Trash2, Loader2,
  AlertTriangle, Clock, Paperclip, Link as LinkIcon, History, Save,
} from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { PRIORITY_MAP, REQUEST_STATUS_MAP, isPartialRequest } from "@/lib/materialConstants";
import {
  type MaterialRequestRow, type RequestItemRow, itemName, orderedQty, sentDate, deadlineBadge, isShortNotice, UNDECIDED,
} from "./types";

interface HistoryEntry { id: number; fromStatus: string | null; toStatus: string; note: string | null; createdAt: string; changedBy: { name: string } }
type Decision = { included: boolean; qty: number };

const statusLabel = (s: string) => REQUEST_STATUS_MAP[s]?.label ?? s;
const isNewItem = (it: RequestItemRow) => it.isCustom || it.matchType === "new" || it.material?.reviewStatus === "pending";

/** Teksti i mësuesit me artikujt e përputhur (vjollcë) dhe të rinjtë (vija të ndërprera). */
function HighlightedText({ text, items }: { text: string; items: RequestItemRow[] }) {
  const parts = useMemo(() => {
    const lower = text.toLowerCase();
    const ranges: { start: number; end: number; isNew: boolean }[] = [];
    for (const it of items) {
      const src = it.sourceText?.trim();
      if (!src) continue;
      let from = 0;
      while (from < lower.length) {
        const idx = lower.indexOf(src.toLowerCase(), from);
        if (idx < 0) break;
        const end = idx + src.length;
        if (!ranges.some(r => idx < r.end && end > r.start)) { ranges.push({ start: idx, end, isNew: isNewItem(it) }); break; }
        from = idx + 1;
      }
    }
    ranges.sort((a, b) => a.start - b.start);
    const out: { text: string; kind: "plain" | "match" | "new" }[] = [];
    let pos = 0;
    for (const r of ranges) {
      if (r.start > pos) out.push({ text: text.slice(pos, r.start), kind: "plain" });
      out.push({ text: text.slice(r.start, r.end), kind: r.isNew ? "new" : "match" });
      pos = r.end;
    }
    if (pos < text.length) out.push({ text: text.slice(pos), kind: "plain" });
    return out;
  }, [text, items]);

  return (
    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-200 whitespace-pre-wrap">
      {parts.map((p, i) =>
        p.kind === "plain" ? <span key={i}>{p.text}</span>
          : p.kind === "match"
            ? <mark key={i} className="bg-primary-100 dark:bg-primary-900/40 text-primary-800 dark:text-primary-200 rounded px-0.5">{p.text}</mark>
            : <mark key={i} className="bg-transparent border border-dashed border-primary-400 text-primary-700 dark:text-primary-300 rounded px-0.5" title="Artikull i ri — pa rishikuar në katalog">{p.text}</mark>
      )}
    </p>
  );
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
    for (const it of r.items) {
      d[it.id] = { included: it.status !== "REJECTED", qty: it.approvedQuantity ?? it.quantity };
    }
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

  // Historiku i statuseve (kush dhe kur) — nga detaji i kërkesës
  useEffect(() => {
    let cancelled = false;
    setHistory(null);
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

  const st = REQUEST_STATUS_MAP[r.status] ?? { label: r.status, color: "bg-slate-100 text-slate-600" };
  const partial = isPartialRequest(r.status, r.items);
  const dl = deadlineBadge(r.dateNeeded);
  const pr = PRIORITY_MAP[r.priority ?? "NORMAL"] ?? PRIORITY_MAP.NORMAL;

  return (
    <div className="card p-5 space-y-5">
      {/* ── Koka ── */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">{r.teacher.name}</h2>
          <p className="text-sm text-slate-500">
            {[r.class?.name, r.subject?.name].filter(Boolean).join(" · ") || "Pa klasë/lëndë"} · dërguar {formatDate(sentDate(r))}
          </p>
          <div className="flex items-center gap-1.5 flex-wrap mt-2 text-xs">
            <span className={`px-2 py-0.5 rounded-full font-medium ${pr.color}`}>{pr.label}</span>
            {dl && <span className={`px-2 py-0.5 rounded-full font-medium ${dl.cls}`}>{dl.text}</span>}
            <span className={`px-2 py-0.5 rounded-full font-semibold ${st.color}`}>
              {r.status === "PARTIALLY_APPROVED" ? "Aprovuar" : st.label}{partial ? " · Pjesërisht" : ""}
            </span>
          </div>
        </div>
        <div className="relative" ref={menuRef}>
          <button onClick={() => setMenuOpen(v => !v)} aria-label="Më shumë veprime" title="Më shumë veprime" aria-haspopup="menu" aria-expanded={menuOpen}
            className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800">
            <MoreHorizontal className="w-5 h-5" />
          </button>
          {menuOpen && (
            <div role="menu" className="absolute right-0 z-20 mt-1 w-60 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1">
              <button role="menuitem" disabled={anyOrdered || !canAct} onClick={remove}
                className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 flex items-center gap-2 disabled:opacity-40"
                title={anyOrdered ? "Kërkesa ka artikuj në porosi — s'mund të fshihet" : undefined}>
                <Trash2 className="w-4 h-4" /> Fshi kërkesën
              </button>
            </div>
          )}
        </div>
      </div>

      {r.priority === "URGENT" && r.urgencyReason && (
        <div className="p-3 rounded-lg bg-red-50 dark:bg-red-900/20 text-sm text-red-700 dark:text-red-300 flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /><span><b>Arsyeja e urgjencës:</b> {r.urgencyReason}</span>
        </div>
      )}
      {isShortNotice(r, leadDays) && (
        <p className="text-xs text-orange-600 dark:text-orange-400 flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5" /> U dërgua me më pak se {leadDays} ditë afat, pa qenë urgjente.
        </p>
      )}
      {(r.sentAt || r.sentSmsAt) && (
        <p className="text-xs text-green-600">
          {r.sentAt && <>Dërguar te {r.sentToEmail}. </>}{r.sentSmsAt && <>SMS te {r.sentToPhone}.</>}
        </p>
      )}

      {/* ── Teksti i mësuesit ── */}
      <section>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Teksti i mësuesit</h3>
        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 space-y-1.5">
          {r.originalText?.trim()
            ? <HighlightedText text={r.originalText} items={r.items} />
            : <p className="text-sm text-slate-700 dark:text-slate-200">{r.reason}</p>}
          {r.comment && <p className="text-xs text-slate-500 italic">{r.comment}</p>}
        </div>
      </section>

      {/* ── Artikujt ── */}
      <section>
        <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Artikujt</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-400 border-b border-slate-100 dark:border-slate-700">
                <th className="py-2 w-8"><span className="sr-only">Përfshirë</span></th>
                <th className="py-2">Artikulli</th>
                <th className="py-2 text-center">Kërkuar</th>
                <th className="py-2 text-center">Aprovuar</th>
                <th className="py-2">Gjendja</th>
              </tr>
            </thead>
            <tbody>
              {r.items.map(it => {
                const d = decisions[it.id] ?? { included: true, qty: it.quantity };
                const ordered = orderedQty(it);
                const locked = !editable || ordered > 0;
                const orders = [...new Set(it.orderLinks.map(l => l.orderItem.order.orderNumber))];
                return (
                  <tr key={it.id} className={`border-b border-slate-50 dark:border-slate-800 ${!d.included ? "opacity-50" : ""}`}>
                    <td className="py-2 align-top">
                      <input type="checkbox" checked={d.included} disabled={locked}
                        onChange={e => setDecisions(x => ({ ...x, [it.id]: { ...d, included: e.target.checked } }))}
                        aria-label={`Përfshi ${itemName(it)}`} className="mt-1" />
                    </td>
                    <td className="py-2 align-top">
                      <span className="font-medium text-slate-800 dark:text-slate-100">{itemName(it)}</span>
                      {isNewItem(it) && <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full border border-dashed border-primary-400 text-primary-700 dark:text-primary-300">I ri</span>}
                      {it.color && <span className="ml-1.5 text-xs text-slate-400">{it.color}</span>}
                      {(it.customDescription || it.itemReason) && <p className="text-xs text-slate-400">{it.customDescription || it.itemReason}</p>}
                      <div className="flex gap-2">
                        {it.productLink && <a href={it.productLink} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 inline-flex items-center gap-1"><LinkIcon className="w-3 h-3" />Lidhja</a>}
                        {it.attachmentPath && <a href={`/api/material-requests/attachments/${it.attachmentPath}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 inline-flex items-center gap-1"><Paperclip className="w-3 h-3" />Bashkëngjitja</a>}
                      </div>
                    </td>
                    <td className="py-2 align-top text-center text-slate-500 whitespace-nowrap">{it.quantity} {it.unit}</td>
                    <td className="py-2 align-top">
                      {d.included ? (
                        <div className="flex items-center justify-center gap-1">
                          <button onClick={() => setQty(it, d.qty - 1)} disabled={locked || d.qty <= Math.max(1, ordered)} aria-label="Ul sasinë" title="Ul sasinë"
                            className="w-6 h-6 rounded border border-slate-200 dark:border-slate-600 flex items-center justify-center disabled:opacity-30"><Minus className="w-3 h-3" /></button>
                          <span className="w-8 text-center font-semibold">{d.qty}</span>
                          <button onClick={() => setQty(it, d.qty + 1)} disabled={locked || d.qty >= it.quantity} aria-label="Rrit sasinë" title="Rrit sasinë"
                            className="w-6 h-6 rounded border border-slate-200 dark:border-slate-600 flex items-center justify-center disabled:opacity-30"><Plus className="w-3 h-3" /></button>
                        </div>
                      ) : <p className="text-center text-xs text-red-500">përjashtuar</p>}
                    </td>
                    <td className="py-2 align-top text-xs text-slate-500">
                      {orders.length > 0 ? <>Porosia {orders.join(", ")}{it.deliveredQuantity > 0 && <> · ardhur {it.deliveredQuantity}</>}</>
                        : it.status === "PENDING" ? "Pa vendim" : it.status === "APPROVED" ? "Për t'u porositur" : "Refuzuar"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {r.reviewNote && !UNDECIDED.has(r.status) && (
          <p className="text-xs text-slate-500 mt-2">Shënim{r.reviewedBy ? ` nga ${r.reviewedBy.name}` : ""}: <span className="italic">{r.reviewNote}</span></p>
        )}
      </section>

      {/* ── Veprimet ── */}
      {editable && (
        <section className="space-y-3 pt-1">
          {rejecting ? (
            <div className="p-3 rounded-lg border border-red-200 dark:border-red-900/50 space-y-2">
              <label className="form-label" htmlFor="reject-reason">Arsyeja e refuzimit (i dërgohet mësuesit)</label>
              <textarea id="reject-reason" autoFocus value={rejectReason} onChange={e => setRejectReason(e.target.value)} rows={2} className="form-input text-sm" />
              <div className="flex gap-2">
                <button onClick={() => setRejecting(false)} disabled={busy} className="btn-secondary text-sm">Anulo</button>
                <button onClick={reject} disabled={busy || !rejectReason.trim()} className="btn-primary text-sm !bg-red-600 hover:!bg-red-700">
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Refuzo kërkesën
                </button>
              </div>
            </div>
          ) : (
            <>
              <input value={note} onChange={e => setNote(e.target.value)} className="form-input text-sm" placeholder="Shënim për mësuesin (opsional)" aria-label="Shënim për mësuesin" />
              <div className="flex items-center gap-2 flex-wrap">
                {!anyOrdered && (
                  <button onClick={() => { setRejecting(true); setError(""); }} disabled={busy} className="btn-secondary text-sm text-red-600">
                    <XCircle className="w-4 h-4" /> Refuzo
                  </button>
                )}
                <button onClick={saveDecisions} disabled={busy || selectedCount === 0 || !dirty} className="btn-primary text-sm ml-auto"
                  title={selectedCount === 0 ? "Zgjidh të paktën një artikull — ose refuzoje kërkesën" : undefined}>
                  {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : UNDECIDED.has(r.status) ? <ShoppingCart className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                  {UNDECIDED.has(r.status) ? `Shto në porosi (${selectedCount} artikuj)` : `Ruaj ndryshimet (${selectedCount} artikuj)`}
                </button>
              </div>
            </>
          )}
        </section>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}

      {/* ── Historiku i statuseve ── */}
      <section className="border-t border-slate-100 dark:border-slate-700 pt-3">
        <button onClick={() => setShowHistory(v => !v)} aria-expanded={showHistory} className="text-xs font-medium text-slate-500 hover:text-primary-600 inline-flex items-center gap-1.5">
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

    </div>
  );
}
