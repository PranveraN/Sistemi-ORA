"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Check, GitMerge, Trash2, Link2, EyeOff, Plus, Sparkles } from "lucide-react";
import { formatDate } from "@/lib/utils";

interface Source { text: string; quantity: number; teacher: string; className: string | null; date: string; requestId: number }
interface Similar { id: number; name: string; percent: number }
interface PendingItem { id: number; name: string; unit: string; usedIn: number; inOrders: number; sources: Source[]; suggestedName: string; similar: Similar | null }
interface TextPart { id: number; name: string; quantity: number; unit: string; text: string; teacher: string; className: string | null; date: string; requestId: number; suggestedName: string; similar: Similar | null }
interface Data { categories: { id: number; name: string }[]; items: PendingItem[]; textParts: TextPart[] }
interface CatalogOpt { id: number; name: string }

// "Për rishikim" te Katalogu: artikujt e rinj nga teksti i mësuesve (aprovo /
// bashko / fshij) dhe pjesët e tekstit pa artikull (krijo / lidh / injoro).
export default function MaterialReviewSection({ onChanged }: { onChanged: (count: number) => void }) {
  const [data, setData] = useState<Data | null>(null);
  const [catalog, setCatalog] = useState<CatalogOpt[]>([]);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    const [r, c] = await Promise.all([fetch("/api/materials/review"), fetch("/api/materials")]);
    const d = await r.json().catch(() => null);
    if (!r.ok || !d) { setError(d?.error || "Ngarkimi dështoi."); return; }
    setData(d);
    onChanged(d.items.length + d.textParts.length);
    if (c.ok) setCatalog(((await c.json()) as { id: number; name: string; reviewStatus?: string; active?: boolean }[]).filter(m => m.reviewStatus !== "pending" && m.active !== false).map(m => ({ id: m.id, name: m.name })));
  }, [onChanged]);
  useEffect(() => { load(); }, [load]);

  if (error) return <p className="text-sm text-red-600">{error}</p>;
  if (!data) return <p className="text-sm text-slate-400">Duke ngarkuar...</p>;
  if (!data.items.length && !data.textParts.length) {
    return <div className="card p-8 text-center text-sm text-slate-500"><Check className="w-8 h-8 text-green-500 mx-auto mb-2" />Asnjë artikull për rishikim.</div>;
  }

  return (
    <div className="space-y-4">
      {data.items.length > 0 && <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Artikuj të rinj ({data.items.length})</h3>}
      {data.items.map(it => <ReviewCard key={`m${it.id}`} kind="item" row={it} categories={data.categories} catalog={catalog} onDone={load} />)}
      {data.textParts.length > 0 && <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 pt-2">Pjesë teksti pa artikull ({data.textParts.length})</h3>}
      {data.textParts.map(t => <ReviewCard key={`t${t.id}`} kind="text" row={t} categories={data.categories} catalog={catalog} onDone={load} />)}
    </div>
  );
}

function ReviewCard({ kind, row, categories, catalog, onDone }: {
  kind: "item" | "text";
  row: PendingItem | TextPart;
  categories: { id: number; name: string }[];
  catalog: CatalogOpt[];
  onDone: () => void;
}) {
  const [name, setName] = useState(row.suggestedName);
  const [categoryId, setCategoryId] = useState("");
  const [mergeTarget, setMergeTarget] = useState(row.similar ? String(row.similar.id) : "");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function act(action: string, extra: Record<string, unknown> = {}) {
    setBusy(action); setError("");
    try {
      const r = await fetch("/api/materials/review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, id: row.id, ...extra }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Veprimi dështoi."); return; }
      onDone();
    } catch { setError("Gabim rrjeti — provo përsëri."); }
    finally { setBusy(null); }
  }

  const sources: Source[] = kind === "item" ? (row as PendingItem).sources : [{ text: (row as TextPart).text, quantity: (row as TextPart).quantity, teacher: (row as TextPart).teacher, className: (row as TextPart).className, date: (row as TextPart).date, requestId: (row as TextPart).requestId }];
  const usedIn = kind === "item" ? (row as PendingItem).usedIn : 1;
  const target = catalog.find(c => String(c.id) === mergeTarget);

  return (
    <div className="card p-4 space-y-3">
      <div>
        <p className="text-xs text-slate-400 mb-1">Teksti origjinal i mësuesit</p>
        {sources.map((s, i) => (
          <p key={i} className="text-sm text-slate-700 dark:text-slate-200">
            &ldquo;<span className="text-primary-700 dark:text-primary-300 border-b border-dashed border-primary-400">{s.text}</span>&rdquo;
            <span className="text-xs text-slate-400"> — {s.teacher}{s.className ? ` · ${s.className}` : ""} · {formatDate(s.date)} · × {s.quantity}</span>
          </p>
        ))}
        {kind === "item" && usedIn > sources.length && <p className="text-xs text-slate-400">+ {usedIn - sources.length} kërkesa të tjera</p>}
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="form-label" htmlFor={`n-${kind}-${row.id}`}>Emri i saktë (sugjerim)</label>
          <input id={`n-${kind}-${row.id}`} value={name} onChange={e => setName(e.target.value)} className="form-input" />
        </div>
        <div>
          <label className="form-label" htmlFor={`c-${kind}-${row.id}`}>Kategoria</label>
          <select id={`c-${kind}-${row.id}`} value={categoryId} onChange={e => setCategoryId(e.target.value)} className="form-input">
            <option value="">Zgjidh…</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <div>
        <p className="form-label">Ngjashëm në katalog</p>
        <div className="flex flex-wrap items-center gap-2">
          {row.similar && <span className="text-xs px-2 py-1 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300"><Sparkles className="w-3 h-3 inline" /> {row.similar.name} · {row.similar.percent}%</span>}
          <select value={mergeTarget} onChange={e => setMergeTarget(e.target.value)} className="form-input w-auto max-w-full text-sm" aria-label="Artikulli me të cilin bashkohet">
            <option value="">{row.similar ? "Zgjidh tjetër…" : "Zgjidh artikullin…"}</option>
            {catalog.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex flex-wrap gap-2 pt-1">
        {kind === "item" ? (
          <>
            <button onClick={() => act("approve", { name, categoryId })} disabled={!!busy || !categoryId || name.trim().length < 2} className="btn-primary text-sm"
              title={!categoryId ? "Zgjidh kategorinë" : undefined}>{busy === "approve" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />} Aprovo si artikull të ri</button>
            <button onClick={() => act("merge", { targetId: mergeTarget })} disabled={!!busy || !mergeTarget} className="btn-secondary text-sm">
              {busy === "merge" ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitMerge className="w-4 h-4" />} Bashko me &ldquo;{target?.name ?? "…"}&rdquo;
            </button>
            <button onClick={() => { if (confirm("Ta fshij këtë artikull?")) act("delete"); }} disabled={!!busy || usedIn > 0} className="btn-secondary text-sm text-red-600"
              title={usedIn > 0 ? "Përdoret në kërkesa — bashkoje në vend që ta fshish" : undefined}><Trash2 className="w-4 h-4" /> Fshij</button>
          </>
        ) : (
          <>
            <button onClick={() => act("createFromText", { name, categoryId })} disabled={!!busy || !categoryId || name.trim().length < 2} className="btn-primary text-sm">{busy === "createFromText" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />} Krijo artikull</button>
            <button onClick={() => act("linkText", { targetId: mergeTarget })} disabled={!!busy || !mergeTarget} className="btn-secondary text-sm"><Link2 className="w-4 h-4" /> Lidh me &ldquo;{target?.name ?? "…"}&rdquo;</button>
            <button onClick={() => act("ignoreText")} disabled={!!busy} className="btn-secondary text-sm"><EyeOff className="w-4 h-4" /> Injoro</button>
          </>
        )}
      </div>
    </div>
  );
}
