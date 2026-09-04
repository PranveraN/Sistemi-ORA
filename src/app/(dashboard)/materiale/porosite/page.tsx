"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Header from "@/components/layout/Header";
import { formatDate } from "@/lib/utils";
import {
  Plus, X, Loader2, Package, Truck, CheckCircle, XCircle, Trash2,
  Search, ClipboardList,
} from "lucide-react";

/* ─── Types ───────────────────────────────────────────────── */
interface PendingItem {
  requestItemId: number;
  requestId: number;
  teacherName: string;
  priority: string | null;
  isCustom: boolean;
  materialId: number | null;
  materialName: string;
  supplierId: number | null;
  unit: string;
  color: string | null;
  approvedQuantity: number;
  alreadyOrdered: number;
  remaining: number;
}

interface OrderItem {
  id: number;
  materialId: number | null;
  material: { id: number; name: string } | null;
  customItemName: string | null;
  color: string | null;
  unit: string;
  quantity: number;
  unitPrice: number | null;
  totalPrice: number | null;
  receivedQuantity: number;
  requestLinks: { requestItem: { id: number; color: string | null; request: { id: number; teacher: { name: string } } } }[];
}

interface Order {
  id: number;
  orderNumber: string;
  status: string;
  supplier: { id: number; emri: string } | null;
  orderDate: string;
  expectedDeliveryDate: string | null;
  receivedDate: string | null;
  notes: string | null;
  totalItems: number;
  totalQuantity: number;
  estimatedCost: number;
  actualCost: number;
  createdBy: { name: string };
  items: OrderItem[];
}

interface Sipartner { id: number; emri: string }

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  PENDING:  { label: "Në përgatitje", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  ORDERED:  { label: "Porositur",     color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  PARTIALLY_RECEIVED: { label: "Pranuar Pjesërisht", color: "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400" },
  RECEIVED: { label: "Mbërriti",      color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  CANCELLED:{ label: "Anuluar",       color: "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-400" },
};

interface LineGroup {
  key: string;
  materialId: number | null;
  customItemName: string | null;
  materialName: string;
  color: string | null;
  unit: string;
  supplierId: number | null;
  contributions: PendingItem[];
}

interface LineState { checked: Record<number, boolean>; quantity: Record<number, number>; unitPrice: string }

export default function MaterialOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pendingItems, setPendingItems] = useState<PendingItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<number | null>(null);
  const [receivingId, setReceivingId] = useState<number | null>(null);
  const [receiveQty, setReceiveQty] = useState<Record<number, string>>({});
  const [receiveNote, setReceiveNote] = useState<Record<number, string>>({});
  const [receiveSaving, setReceiveSaving] = useState(false);
  const [receiveError, setReceiveError] = useState("");

  const [showBuilder, setShowBuilder] = useState(false);
  const [lineStates, setLineStates] = useState<Record<string, LineState>>({});
  const [supplierId, setSupplierId] = useState<number | null>(null);
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierSuggestions, setSupplierSuggestions] = useState<Sipartner[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [expectedDeliveryDate, setExpectedDeliveryDate] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const [oRes, pRes] = await Promise.all([
      fetch("/api/material-orders"),
      fetch("/api/material-orders/pending-items"),
    ]);
    if (oRes.ok) setOrders(await oRes.json());
    if (pRes.ok) setPendingItems(await pRes.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const groups = useMemo<LineGroup[]>(() => {
    const map = new Map<string, LineGroup>();
    for (const it of pendingItems) {
      const key = it.isCustom ? `custom-${it.requestItemId}` : `mat-${it.materialId}-${it.color ?? ""}`;
      if (!map.has(key)) {
        map.set(key, {
          key, materialId: it.materialId, customItemName: it.isCustom ? it.materialName : null,
          materialName: it.materialName, color: it.color, unit: it.unit, supplierId: it.supplierId,
          contributions: [],
        });
      }
      map.get(key)!.contributions.push(it);
    }
    return [...map.values()];
  }, [pendingItems]);

  function openBuilder() {
    const initial: Record<string, LineState> = {};
    for (const g of groups) {
      const checked: Record<number, boolean> = {};
      const quantity: Record<number, number> = {};
      for (const c of g.contributions) { checked[c.requestItemId] = true; quantity[c.requestItemId] = c.remaining; }
      initial[g.key] = { checked, quantity, unitPrice: "" };
    }
    setLineStates(initial);
    const supplierGroups = [...new Set(groups.map(g => g.supplierId).filter(Boolean))];
    if (supplierGroups.length === 1) {
      const sp = groups.find(g => g.supplierId === supplierGroups[0]);
      if (sp) { setSupplierId(supplierGroups[0] as number); }
    } else {
      setSupplierId(null);
    }
    setSupplierQuery("");
    setExpectedDeliveryDate("");
    setNotes("");
    setError("");
    setShowBuilder(true);
  }

  function toggleContribution(groupKey: string, requestItemId: number) {
    setLineStates(s => ({
      ...s,
      [groupKey]: { ...s[groupKey], checked: { ...s[groupKey].checked, [requestItemId]: !s[groupKey].checked[requestItemId] } },
    }));
  }
  function setContributionQty(groupKey: string, requestItemId: number, qty: number) {
    setLineStates(s => ({ ...s, [groupKey]: { ...s[groupKey], quantity: { ...s[groupKey].quantity, [requestItemId]: qty } } }));
  }
  function setLineUnitPrice(groupKey: string, price: string) {
    setLineStates(s => ({ ...s, [groupKey]: { ...s[groupKey], unitPrice: price } }));
  }

  async function fetchSuppliers(q: string) {
    setSupplierQuery(q);
    setSupplierId(null);
    if (!q || q.length < 2) { setSupplierSuggestions([]); setShowSuggestions(false); return; }
    const res = await fetch(`/api/sipartner?q=${encodeURIComponent(q)}`);
    if (res.ok) {
      const data: Sipartner[] = await res.json();
      const withId = data.filter(sp => sp.id);
      setSupplierSuggestions(withId);
      setShowSuggestions(withId.length > 0);
    }
  }
  function selectSupplier(sp: Sipartner) {
    setSupplierId(sp.id);
    setSupplierQuery(sp.emri);
    setSupplierSuggestions([]);
    setShowSuggestions(false);
  }

  const builderLines = useMemo(() => {
    return groups
      .map(g => {
        const state = lineStates[g.key];
        if (!state) return null;
        const contributions = g.contributions
          .filter(c => state.checked[c.requestItemId] && (state.quantity[c.requestItemId] ?? 0) > 0)
          .map(c => ({ requestItemId: c.requestItemId, quantity: Math.min(state.quantity[c.requestItemId], c.remaining) }));
        if (!contributions.length) return null;
        const quantity = contributions.reduce((s, c) => s + c.quantity, 0);
        const unitPrice = state.unitPrice ? parseFloat(state.unitPrice) : null;
        return { group: g, contributions, quantity, unitPrice, lineTotal: unitPrice ? Math.round(quantity * unitPrice * 100) / 100 : null };
      })
      .filter((l): l is NonNullable<typeof l> => l !== null);
  }, [groups, lineStates]);

  const builderTotal = builderLines.reduce((s, l) => s + (l.lineTotal ?? 0), 0);

  async function submitOrder() {
    if (!builderLines.length) {
      setError("Zgjidh të paktën një artikull për porosi.");
      return;
    }
    setSaving(true);
    setError("");
    const payload = {
      supplierId: supplierId || undefined,
      expectedDeliveryDate: expectedDeliveryDate || undefined,
      notes: notes || undefined,
      lines: builderLines.map(l => ({
        materialId: l.group.materialId ?? undefined,
        customItemName: l.group.customItemName ?? undefined,
        color: l.group.color ?? undefined,
        unit: l.group.unit,
        unitPrice: l.unitPrice ?? undefined,
        contributions: l.contributions,
      })),
    };
    const res = await fetch("/api/material-orders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const d = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) { setError(d.error || "Diçka shkoi keq."); return; }
    setShowBuilder(false);
    load();
  }

  async function transitionOrder(id: number, status: "ORDERED" | "CANCELLED") {
    setActingId(id);
    await fetch(`/api/material-orders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    setActingId(null);
    load();
  }

  async function deleteOrder(id: number, orderNumber: string) {
    if (!confirm(`Fshi porosinë ${orderNumber}? Artikujt e saj rikthehen si "gati për porosi".`)) return;
    setActingId(id);
    const res = await fetch(`/api/material-orders/${id}`, { method: "DELETE" });
    if (!res.ok) { const d = await res.json().catch(() => ({})); alert(d.error || "Gabim"); }
    setActingId(null);
    load();
  }

  function openReceive(o: Order) {
    const qty: Record<number, string> = {};
    for (const it of o.items) {
      const remaining = it.quantity - it.receivedQuantity;
      if (remaining > 0) qty[it.id] = String(remaining);
    }
    setReceiveQty(qty);
    setReceiveNote({});
    setReceiveError("");
    setReceivingId(o.id);
  }

  async function submitReceive(orderId: number) {
    const items = Object.entries(receiveQty)
      .map(([orderItemId, qty]) => ({ orderItemId: Number(orderItemId), quantity: parseInt(qty) || 0, note: receiveNote[Number(orderItemId)] || undefined }))
      .filter(it => it.quantity > 0);
    if (!items.length) { setReceiveError("Shkruaj të paktën një sasi për të pranuar."); return; }
    setReceiveSaving(true);
    setReceiveError("");
    const res = await fetch(`/api/material-orders/${orderId}/receive`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ items }),
    });
    const d = await res.json().catch(() => ({}));
    setReceiveSaving(false);
    if (!res.ok) { setReceiveError(d.error || "Gabim"); return; }
    setReceivingId(null);
    load();
  }

  return (
    <>
      <Header title="Porositë e Materialeve" />
      <div className="p-6 max-w-5xl mx-auto space-y-5 animate-fade-in">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <p className="text-sm text-slate-500">
            {pendingItems.length > 0
              ? `${pendingItems.length} artikuj të aprovuar gati për porosi`
              : "Asnjë artikull i aprovuar në pritje të porosisë"}
          </p>
          <button onClick={openBuilder} disabled={!groups.length} className="btn-primary text-sm">
            <Plus className="w-4 h-4" />
            Krijo Porosi të Re
          </button>
        </div>

        {loading ? (
          <p className="text-sm text-slate-400 text-center py-10">Duke ngarkuar...</p>
        ) : orders.length === 0 ? (
          <div className="card p-10 text-center">
            <Truck className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-400 text-sm">Asnjë porosi ende.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map(o => {
              const st = STATUS_LABEL[o.status] ?? { label: o.status, color: "bg-slate-100 text-slate-600" };
              return (
                <div key={o.id} className="card p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-slate-900 dark:text-white">{o.orderNumber}</p>
                        {o.supplier && <span className="text-sm text-slate-500">{o.supplier.emri}</span>}
                      </div>
                      <p className="text-xs text-slate-400 mt-1">
                        {o.totalItems} rreshta · {o.totalQuantity} copë{o.estimatedCost > 0 && ` · ~${o.estimatedCost.toFixed(2)}€`} · {o.createdBy.name} · {formatDate(o.orderDate)}
                      </p>
                    </div>
                    <span className={`shrink-0 px-2 py-1 rounded-full text-xs font-semibold ${st.color}`}>{st.label}</span>
                  </div>

                  <div className="mt-3 space-y-1.5">
                    {o.items.map(it => (
                      <div key={it.id} className="flex items-center justify-between gap-2 text-sm p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                        <span className="text-slate-700 dark:text-slate-200">
                          {it.material?.name || it.customItemName}
                          {it.color && <span className="text-purple-600 dark:text-purple-400"> ({it.color})</span>}
                          <span className="text-slate-400 text-xs ml-1.5">
                            {[...new Set(it.requestLinks.map(l => l.requestItem.request.teacher.name))].join(", ")}
                          </span>
                        </span>
                        <span className="text-slate-500 shrink-0">
                          {it.receivedQuantity > 0 && (
                            <span className={`mr-1.5 ${it.receivedQuantity >= it.quantity ? "text-green-600 dark:text-green-400" : "text-teal-600 dark:text-teal-400"}`}>
                              pranuar {it.receivedQuantity}/
                            </span>
                          )}
                          {it.quantity} {it.unit}{it.unitPrice !== null && ` × ${it.unitPrice}€ = ${it.totalPrice}€`}
                        </span>
                      </div>
                    ))}
                  </div>

                  {o.notes && <p className="text-xs text-slate-400 mt-2 italic">{o.notes}</p>}

                  {receivingId !== o.id && (
                    <div className="flex items-center gap-2 mt-4 pt-4 border-t border-slate-100 dark:border-slate-700">
                      {o.status === "PENDING" && (
                        <>
                          <button onClick={() => transitionOrder(o.id, "ORDERED")} disabled={actingId === o.id} className="btn-primary text-sm">
                            {actingId === o.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                            Shëno si Porositur
                          </button>
                          <button onClick={() => deleteOrder(o.id, o.orderNumber)} disabled={actingId === o.id} className="btn-secondary text-sm text-red-600">
                            <Trash2 className="w-4 h-4" /> Fshi
                          </button>
                        </>
                      )}
                      {(o.status === "ORDERED" || o.status === "PARTIALLY_RECEIVED") && (
                        <>
                          <button onClick={() => openReceive(o)} className="btn-primary text-sm">
                            <Package className="w-4 h-4" /> Prano
                          </button>
                          {o.status === "ORDERED" && (
                            <button onClick={() => transitionOrder(o.id, "CANCELLED")} disabled={actingId === o.id} className="btn-secondary text-sm text-red-600">
                              <XCircle className="w-4 h-4" /> Anulo
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {receivingId === o.id && (
                    <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 space-y-3">
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Sa u pranua nga secili rresht?</p>
                      {o.items.filter(it => it.quantity - it.receivedQuantity > 0).map(it => {
                        const remaining = it.quantity - it.receivedQuantity;
                        return (
                          <div key={it.id} className="flex items-center gap-2 flex-wrap p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg">
                            <span className="text-sm text-slate-700 dark:text-slate-200 flex-1 min-w-[140px]">
                              {it.material?.name || it.customItemName}{it.color && ` (${it.color})`}
                              <span className="text-slate-400 text-xs"> — mbetur {remaining} {it.unit}</span>
                            </span>
                            <input
                              type="number" min={0} max={remaining}
                              value={receiveQty[it.id] ?? ""}
                              onChange={e => setReceiveQty(q => ({ ...q, [it.id]: e.target.value }))}
                              className="form-input w-20 text-sm"
                            />
                            <input
                              value={receiveNote[it.id] ?? ""}
                              onChange={e => setReceiveNote(n => ({ ...n, [it.id]: e.target.value }))}
                              className="form-input flex-1 min-w-[120px] text-sm"
                              placeholder="Shënim (opsionale)"
                            />
                          </div>
                        );
                      })}
                      {receiveError && <p className="text-sm text-red-500">{receiveError}</p>}
                      <div className="flex items-center gap-2">
                        <button onClick={() => setReceivingId(null)} disabled={receiveSaving} className="btn-secondary text-sm">Anulo</button>
                        <button onClick={() => submitReceive(o.id)} disabled={receiveSaving} className="btn-primary text-sm">
                          {receiveSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
                          Ruaj Pranimin
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {showBuilder && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => !saving && setShowBuilder(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <ClipboardList className="w-4 h-4 text-primary-500" /> Porosi e Re
              </h3>
              <button onClick={() => !saving && setShowBuilder(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"><X className="w-5 h-5" /></button>
            </div>

            <div className="p-5 space-y-4">
              {error && <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">{error}</div>}

              <div className="space-y-3">
                {groups.map(g => {
                  const state = lineStates[g.key];
                  if (!state) return null;
                  return (
                    <div key={g.key} className="border border-slate-200 dark:border-slate-700 rounded-xl p-3">
                      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
                        <p className="font-semibold text-slate-800 dark:text-white text-sm">
                          {g.materialName}{g.color && <span className="text-purple-600 dark:text-purple-400 font-normal"> ({g.color})</span>}
                        </p>
                        <div className="relative w-28">
                          <input
                            type="number" min="0" step="0.01"
                            value={state.unitPrice}
                            onChange={e => setLineUnitPrice(g.key, e.target.value)}
                            className="form-input text-sm pr-6"
                            placeholder="Çmimi/njësi"
                          />
                          <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">€</span>
                        </div>
                      </div>
                      <div className="space-y-1">
                        {g.contributions.map(c => (
                          <label key={c.requestItemId} className="flex items-center gap-2 text-sm py-1">
                            <input type="checkbox" checked={state.checked[c.requestItemId] ?? false} onChange={() => toggleContribution(g.key, c.requestItemId)} className="rounded" />
                            <span className="flex-1 text-slate-600 dark:text-slate-300">
                              {c.teacherName} <span className="text-slate-400 text-xs">(mbetur {c.remaining} {c.unit})</span>
                            </span>
                            <input
                              type="number" min={1} max={c.remaining}
                              value={state.quantity[c.requestItemId] ?? c.remaining}
                              onChange={e => setContributionQty(g.key, c.requestItemId, Math.min(c.remaining, Math.max(1, parseInt(e.target.value) || 1)))}
                              disabled={!state.checked[c.requestItemId]}
                              className="form-input w-16 text-sm py-1 disabled:opacity-40"
                            />
                          </label>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="relative">
                <label className="form-label">Furnitori (opsionale)</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    value={supplierQuery} onChange={e => fetchSuppliers(e.target.value)}
                    onFocus={() => supplierSuggestions.length > 0 && setShowSuggestions(true)}
                    onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                    className="form-input pl-9" placeholder="Kërko furnitor..."
                  />
                </div>
                {showSuggestions && (
                  <div className="absolute z-10 mt-1 w-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {supplierSuggestions.map(sp => (
                      <button key={sp.id} type="button" onClick={() => selectSupplier(sp)} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700">{sp.emri}</button>
                    ))}
                  </div>
                )}
                {supplierId && <p className="text-xs text-green-600 dark:text-green-400 mt-1">✓ Zgjedhur</p>}
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Data e pritur e dorëzimit</label>
                  <input type="date" value={expectedDeliveryDate} onChange={e => setExpectedDeliveryDate(e.target.value)} className="form-input" />
                </div>
                <div>
                  <label className="form-label">Shënim (opsionale)</label>
                  <input value={notes} onChange={e => setNotes(e.target.value)} className="form-input" />
                </div>
              </div>

              {builderTotal > 0 && (
                <p className="text-sm text-slate-600 dark:text-slate-300 text-right">
                  Kosto e vlerësuar: <span className="font-bold">{builderTotal.toFixed(2)}€</span>
                </p>
              )}
            </div>

            <div className="flex justify-end gap-2 p-5 pt-0">
              <button onClick={() => setShowBuilder(false)} disabled={saving} className="btn-secondary disabled:opacity-50">Anulo</button>
              <button onClick={submitOrder} disabled={saving || !builderLines.length} className="btn-primary disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Package className="w-4 h-4" />}
                Krijo Porosinë
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
