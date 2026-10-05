"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingCart, Truck, Sparkles, CalendarClock, Loader2, X, CheckCircle } from "lucide-react";
import type { PendingItem } from "./types";

interface Group {
  key: string;
  materialId: number | null;
  customItemName: string | null;
  name: string;
  color: string | null;
  unit: string;
  supplierId: number | null;
  total: number;
  requestIds: Set<number>;
  items: PendingItem[];
}
interface Supplier { id: number; emri: string }

/** I njëjti artikull i katalogut (me të njëjtën ngjyrë dhe njësi) nga disa kërkesa = një rresht. */
function groupItems(items: PendingItem[]): Group[] {
  const map = new Map<string, Group>();
  for (const it of items) {
    const key = it.isCustom ? `custom-${it.requestItemId}` : `mat-${it.materialId}-${it.color ?? ""}-${it.unit}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key, materialId: it.isCustom ? null : it.materialId, customItemName: it.isCustom ? it.materialName : null,
        name: it.materialName ?? "Artikull", color: it.color, unit: it.unit, supplierId: it.supplierId,
        total: 0, requestIds: new Set(), items: [],
      };
      map.set(key, g);
    }
    g.total += it.remaining;
    g.requestIds.add(it.requestId);
    g.items.push(it);
  }
  return [...map.values()].sort((a, b) => b.requestIds.size - a.requestIds.size || a.name.localeCompare(b.name));
}

export default function OrderQueue({ pending, newItemsCount, dueSoon, shortNotice, leadDays, canAct, onOrdered }: {
  pending: PendingItem[];
  newItemsCount: number;
  dueSoon: number;
  shortNotice: number;
  leadDays: number;
  canAct: boolean;
  onOrdered: () => void;
}) {
  const groups = useMemo(() => groupItems(pending), [pending]);
  const [open, setOpen] = useState(false);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [expected, setExpected] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [created, setCreated] = useState<string | null>(null);

  function openDialog() {
    const ids = [...new Set(groups.map(g => g.supplierId).filter(Boolean))];
    setSupplierId(ids.length === 1 ? (ids[0] as number) : null);
    setSupplierQuery(""); setSuppliers([]); setExpected(""); setNotes(""); setError(""); setCreated(null);
    setOpen(true);
  }

  async function searchSuppliers(q: string) {
    setSupplierQuery(q); setSupplierId(null);
    if (q.trim().length < 2) { setSuppliers([]); return; }
    const res = await fetch(`/api/sipartner?q=${encodeURIComponent(q.trim())}`);
    if (res.ok) setSuppliers(((await res.json()) as Supplier[]).filter(s => s.id).slice(0, 8));
  }

  async function createOrder() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/material-orders", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          supplierId: supplierId || undefined,
          expectedDeliveryDate: expected || undefined,
          notes: notes.trim() || undefined,
          lines: groups.map(g => ({
            materialId: g.materialId ?? undefined,
            customItemName: g.customItemName ?? undefined,
            color: g.color ?? undefined,
            unit: g.unit,
            contributions: g.items.map(it => ({ requestItemId: it.requestItemId, quantity: it.remaining })),
          })),
        }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "Krijimi i porosisë dështoi."); return; }
      setCreated(d.orderNumber);
      onOrdered();
    } catch { setError("Gabim rrjeti — provo përsëri."); }
    finally { setBusy(false); }
  }

  const requestCount = new Set(pending.map(p => p.requestId)).size;

  return (
    <div className="space-y-4">
      <div className="card p-4">
        <h3 className="font-semibold text-sm text-slate-800 dark:text-white flex items-center gap-2 mb-3">
          <ShoppingCart className="w-4 h-4 text-primary-500" /> Për t&apos;u porositur
        </h3>
        {groups.length === 0 ? (
          <p className="text-xs text-slate-400">Asnjë artikull i aprovuar në pritje të porosisë.</p>
        ) : (
          <>
            <ul className="space-y-2 max-h-72 overflow-y-auto">
              {groups.map(g => (
                <li key={g.key} className="flex items-start justify-between gap-2 text-sm">
                  <div className="min-w-0">
                    <p className="text-slate-800 dark:text-slate-100 truncate">{g.name}{g.color ? ` · ${g.color}` : ""}</p>
                    <p className="text-[11px] text-slate-400">nga {g.requestIds.size} {g.requestIds.size === 1 ? "kërkesë" : "kërkesa"}</p>
                  </div>
                  <span className="font-semibold text-slate-700 dark:text-slate-200 whitespace-nowrap">{g.total} {g.unit}</span>
                </li>
              ))}
            </ul>
            <button onClick={openDialog} disabled={!canAct} className="btn-primary text-sm w-full mt-3 justify-center">
              <Truck className="w-4 h-4" /> Krijo porosi te furnitori
            </button>
            <p className="text-[11px] text-slate-400 mt-2 text-center">{groups.length} rreshta nga {requestCount} kërkesa</p>
          </>
        )}
      </div>

      {newItemsCount > 0 && (
        <Link href="/materiale?review=pending" className="card p-4 flex items-center gap-3 hover:border-primary-300 border border-transparent transition-colors">
          <Sparkles className="w-5 h-5 text-primary-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-white">{newItemsCount} artikuj të rinj pa rishikuar</p>
            <p className="text-xs text-primary-600">Rishiko në katalog →</p>
          </div>
        </Link>
      )}

      <div className="card p-4">
        <h3 className="font-semibold text-sm text-slate-800 dark:text-white flex items-center gap-2 mb-2">
          <CalendarClock className="w-4 h-4 text-primary-500" /> Afatet
        </h3>
        <p className="text-sm text-slate-600 dark:text-slate-300"><b>{dueSoon}</b> kërkesa duhen brenda {leadDays} ditëve</p>
        <p className="text-sm text-slate-600 dark:text-slate-300"><b>{shortNotice}</b> të dërguara me më pak se {leadDays} ditë afat</p>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !busy && setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Krijo porosi te furnitori" className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white">Krijo porosi te furnitori</h3>
              <button onClick={() => setOpen(false)} disabled={busy} aria-label="Mbyll" className="text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
            </div>
            {created ? (
              <div className="p-5 space-y-3 text-center">
                <CheckCircle className="w-10 h-10 text-green-500 mx-auto" />
                <p className="text-sm">U krijua porosia <b>{created}</b>. Kërkesat kaluan në &quot;Porositur&quot;.</p>
                <p className="text-xs text-slate-500">Konfirmoje dhe shëno pranimin te moduli Porositë.</p>
                <div className="flex justify-center gap-2">
                  <button onClick={() => setOpen(false)} className="btn-secondary text-sm">Mbyll</button>
                  <Link href="/materiale/porosite" className="btn-primary text-sm">Hap Porositë</Link>
                </div>
              </div>
            ) : (
              <>
                <div className="p-5 space-y-3">
                  <ul className="text-sm space-y-1 max-h-40 overflow-y-auto p-3 rounded-lg bg-slate-50 dark:bg-slate-900/40">
                    {groups.map(g => <li key={g.key} className="flex justify-between gap-2"><span className="truncate">{g.name}{g.color ? ` · ${g.color}` : ""}</span><b className="whitespace-nowrap">{g.total} {g.unit}</b></li>)}
                  </ul>
                  <div className="relative">
                    <label className="form-label" htmlFor="supplier">Furnitori (opsional)</label>
                    <input id="supplier" value={supplierQuery} onChange={e => searchSuppliers(e.target.value)} className="form-input text-sm"
                      placeholder={supplierId ? "Furnitori i caktuar te katalogu — kërko për ta ndryshuar" : "Kërko furnitorin..."} />
                    {suppliers.length > 0 && !supplierId && (
                      <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg">
                        {suppliers.map(s => (
                          <button key={s.id} onClick={() => { setSupplierId(s.id); setSupplierQuery(s.emri); setSuppliers([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700">{s.emri}</button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="form-label" htmlFor="expected">Data e pritur e dorëzimit (opsionale)</label>
                    <input id="expected" type="date" value={expected} onChange={e => setExpected(e.target.value)} className="form-input text-sm" />
                  </div>
                  <div>
                    <label className="form-label" htmlFor="order-notes">Shënime (opsionale)</label>
                    <textarea id="order-notes" value={notes} onChange={e => setNotes(e.target.value)} rows={2} className="form-input text-sm" />
                  </div>
                  <p className="text-xs text-slate-500">Porosia përfshin të gjithë artikujt e listës. Për çmime ose për të zgjedhur vetëm disa artikuj, përdor &quot;Krijo Porosi të Re&quot; te Porositë.</p>
                  {error && <p className="text-sm text-red-500">{error}</p>}
                </div>
                <div className="flex justify-end gap-2 p-5 pt-0">
                  <button onClick={() => setOpen(false)} disabled={busy} className="btn-secondary">Anulo</button>
                  <button onClick={createOrder} disabled={busy} className="btn-primary">{busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Truck className="w-4 h-4" />} Krijo porosinë</button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
