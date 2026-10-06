"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as XLSX from "xlsx";
import { Loader2, Send, Printer, CheckCircle2, Trash2, XCircle } from "lucide-react";
import { orderStatusUi } from "@/lib/materialStatusUi";
import { normalizeSearch } from "@/lib/utils";
import StatusBadge from "../StatusBadge";
import OrderPreviewModal, { type OrderLine, type SupplierInfo } from "../admin/OrderPreviewModal";
import OrderBuilderModal from "./OrderBuilderModal";
import { EmptyRow, ListPanel, ListRow, SplitLayout, StatCard, fmtD } from "./ui";
import { type ModuleData, type OrderRow, orderItemName, orderSupplier } from "./types";

// Materialet → Porositë: kartelat, lista e porosive dhe detajet me pranimin e mallit.

const OPEN_ORDER = new Set(["ORDERED", "PARTIALLY_RECEIVED"]);

export default function OrdersTab({ data, selectedId }: { data: ModuleData; selectedId: number | null }) {
  const router = useRouter();
  const { orders, ordersError, pending, loading, reload, setExporter, canAct } = data;
  const [search, setSearch] = useState("");
  const [builder, setBuilder] = useState(false);
  const [supplier, setSupplier] = useState<SupplierInfo | null>(null);

  useEffect(() => {
    fetch("/api/material-orders/supplier").then(r => (r.ok ? r.json() : null)).then(setSupplier).catch(() => {});
  }, []);

  const visible = useMemo(() => {
    const q = normalizeSearch(search.trim());
    return q ? orders.filter(o => normalizeSearch([o.orderNumber, orderSupplier(o), ...o.items.map(orderItemName)].join(" ")).includes(q)) : orders;
  }, [orders, search]);
  const selected = orders.find(o => o.id === selectedId) ?? (selectedId ? null : visible[0] ?? null);

  const now = new Date();
  const inTransit = orders.filter(o => OPEN_ORDER.has(o.status)).length;
  const deliveredThisMonth = orders.filter(o => o.status === "RECEIVED" && o.receivedDate
    && new Date(o.receivedDate).getMonth() === now.getMonth() && new Date(o.receivedDate).getFullYear() === now.getFullYear()).length;

  useEffect(() => {
    setExporter(() => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ["Porosia", "Data", "Furnitori", "Artikuj", "Sasia", "Statusi"],
        ...visible.map(o => [o.orderNumber, fmtD(o.orderDate), orderSupplier(o), o.items.length, o.totalQuantity, orderStatusUi(o.status).label]),
      ]), "Porositë");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ["Porosia", "Artikulli", "Kërkuar nga", "Porositur", "Pranuar", "Njësia"],
        ...visible.flatMap(o => o.items.map(it => [o.orderNumber, orderItemName(it), [...new Set(it.requestLinks.map(l => l.requestItem.request.teacher.name))].join(", "), it.quantity, it.receivedQuantity, it.unit])),
      ]), "Artikujt");
      XLSX.writeFile(wb, `Porosite-Materiale-${fmtD(new Date()).replace(/\//g, "-")}.xlsx`);
    });
    return () => setExporter(null);
  }, [visible, setExporter]);

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <StatCard label="Për t'u porositur" value={`${pending.length} ${pending.length === 1 ? "artikull" : "artikuj"}`} sub="nga kërkesat e aprovuara" />
        <StatCard label="Porosi në pritje" value={inTransit} sub="dërguar, ende pa mbërritur" />
        <StatCard label="Porosi të dorëzuara" value={deliveredThisMonth} sub="këtë muaj" />
        <div className="card p-4 flex flex-col justify-center gap-1.5">
          <button type="button" onClick={() => setBuilder(true)} disabled={!pending.length || !canAct} className="btn-primary justify-center h-[42px]">
            + Krijo porosi të re
          </button>
          {!pending.length && <p className="text-[12.5px] text-slate-500 dark:text-slate-400 text-center">Aktivizohet kur ka artikuj të aprovuar</p>}
        </div>
      </div>

      <SplitLayout
        list={
          <ListPanel search={search} onSearch={setSearch} label="Kërko porosinë" placeholder="Kërko numrin e porosisë ose artikullin…">
            {ordersError ? <EmptyRow text={ordersError} />
              : loading ? <EmptyRow text="Duke ngarkuar…" />
              : visible.length === 0 ? <EmptyRow text={orders.length ? "Asnjë porosi nuk përputhet me kërkimin." : "Ende s'ka porosi. Kur aprovon kërkesat, krijo porosinë e parë nga „Për t'u porositur”."} />
              : visible.map(o => (
                <ListRow key={o.id} href={`/materialet/porosite/${o.id}`} active={selected?.id === o.id}>
                  <div className="flex justify-between gap-2"><b className="text-sm text-slate-900 dark:text-white">{o.orderNumber}</b><span className="text-xs text-slate-500">{fmtD(o.orderDate)}</span></div>
                  <p className="text-[13px] text-slate-600 dark:text-slate-300 mt-1">{orderSupplier(o)} · {o.items.length} artikuj · {o.totalQuantity} copë</p>
                  <div className="mt-1.5"><StatusBadge kind="order" status={o.status} /></div>
                </ListRow>
              ))}
          </ListPanel>
        }
        detail={selected
          ? <OrderDetail key={selected.id} order={selected} supplier={supplier} canAct={canAct} reload={reload}
              onDeleted={() => { router.replace("/materialet/porosite", { scroll: false }); reload(); }} />
          : <div className="card p-10 text-center text-sm text-slate-500">{loading ? "Duke ngarkuar…" : "Ende s'ka porosi. Kur aprovon kërkesat, krijo porosinë e parë nga „Për t'u porositur”."}</div>}
      />

      {builder && (
        <OrderBuilderModal pending={pending} onClose={() => setBuilder(false)}
          onCreated={id => { setBuilder(false); reload(); router.push(`/materialet/porosite/${id}`, { scroll: false }); }} />
      )}
    </div>
  );
}

function OrderDetail({ order: o, supplier, canAct, reload, onDeleted }: {
  order: OrderRow; supplier: SupplierInfo | null; canAct: boolean; reload: () => Promise<void>; onDeleted: () => void;
}) {
  const [qty, setQty] = useState<Record<number, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [resend, setResend] = useState(false);
  const open = OPEN_ORDER.has(o.status);
  const done = o.items.filter(it => it.receivedQuantity >= it.quantity).length;
  const lastOk = o.dispatches?.find(d => d.smsStatus === "SENT" || d.emailStatus === "SENT");
  const via = lastOk ? [lastOk.smsStatus === "SENT" && "SMS", lastOk.emailStatus === "SENT" && "email"].filter(Boolean).join(" + ") : null;

  async function post(url: string, body: unknown, key: string, method = "POST") {
    setBusy(key); setError("");
    try {
      const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Veprimi dështoi."); return false; }
      await reload();
      return true;
    } catch { setError("Gabim rrjeti — provo përsëri."); return false; }
    finally { setBusy(null); }
  }

  const receive = (items: { orderItemId: number; quantity: number }[], key: string) =>
    items.length ? post(`/api/material-orders/${o.id}/receive`, { items }, key) : Promise.resolve(false);

  function printOrder() {
    const w = window.open("", "_blank", "width=800,height=900");
    if (!w) return;
    const rows = o.items.map((it, i) => `<tr><td>${i + 1}</td><td>${orderItemName(it).replace(/</g, "&lt;")}</td><td style="text-align:right">${it.quantity} ${it.unit}</td><td style="text-align:right">${it.receivedQuantity} ${it.unit}</td></tr>`).join("");
    w.document.write(`<!doctype html><html lang="sq"><head><meta charset="utf-8"><title>${o.orderNumber}</title><style>body{font-family:Arial,sans-serif;padding:24px;color:#111}table{border-collapse:collapse;width:100%;margin-top:16px}td,th{border-bottom:1px solid #ddd;padding:8px;text-align:left}</style></head><body><h1>Porosia ${o.orderNumber}</h1><p>${orderSupplier(o)} · ${fmtD(o.orderDate)} · ${orderStatusUi(o.status).label}</p><table><thead><tr><th>Nr.</th><th>Artikulli</th><th style="text-align:right">Porositur</th><th style="text-align:right">Pranuar</th></tr></thead><tbody>${rows}</tbody></table></body></html>`);
    w.document.close();
    w.focus();
    w.print();
  }

  const resendLines: OrderLine[] = o.items.map(it => ({
    key: String(it.id), name: orderItemName(it), quantity: it.quantity, unit: it.unit,
    materialId: it.materialId, customItemName: it.customItemName, color: it.color, requestItemIds: [],
  }));

  return (
    <section className="card p-5 sm:p-6 space-y-5" aria-labelledby="od-title">
      <div className="flex flex-wrap justify-between items-start gap-3">
        <div className="min-w-0">
          <h2 id="od-title" className="text-xl font-extrabold text-slate-900 dark:text-white">{o.orderNumber}</h2>
          <p className="text-[13px] text-slate-500 dark:text-slate-400 mt-1">
            Krijuar nga {o.createdBy.name} më {fmtD(o.orderDate)}{via ? ` · dërguar te ${orderSupplier(o)} me ${via}` : o.supplier ? ` · ${o.supplier.emri}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge kind="order" status={o.status} />
          {supplier && (supplier.email || supplier.phone) && o.status !== "CANCELLED" && canAct && (
            <button type="button" onClick={() => setResend(true)} className="btn-secondary text-sm"><Send className="w-4 h-4" /> Dërgo përsëri</button>
          )}
          <button type="button" onClick={printOrder} className="btn-secondary text-sm"><Printer className="w-4 h-4" /> Printo</button>
        </div>
      </div>

      {o.status !== "CANCELLED" && (
        <div className="space-y-1.5">
          <div className="flex justify-between text-[13px]"><b className="text-slate-800 dark:text-slate-100">Pranimi i mallit</b>
            <span className={`font-bold ${done === o.items.length ? "text-green-700 dark:text-green-400" : "text-slate-600 dark:text-slate-300"}`}>{done} nga {o.items.length} artikuj të pranuar</span></div>
          <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-700 overflow-hidden" role="progressbar" aria-valuemin={0} aria-valuemax={o.items.length} aria-valuenow={done} aria-label="Pranimi i mallit">
            <div className="h-full bg-green-700 rounded-full" style={{ width: `${o.items.length ? (done / o.items.length) * 100 : 0}%` }} />
          </div>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-x-auto">
        <table className="w-full min-w-[680px] text-sm">
          <thead>
            <tr className="text-left text-xs font-bold text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60">
              <th className="px-4 py-2.5">ARTIKULLI</th><th className="px-4 py-2.5">KËRKUAR NGA</th>
              <th className="px-4 py-2.5 w-[100px]">POROSITUR</th><th className="px-4 py-2.5 w-[190px]">PRANUAR</th><th className="px-4 py-2.5 w-[120px]">GJENDJA</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
            {o.items.map(it => {
              const rem = it.quantity - it.receivedQuantity;
              const people = new Map<number, string>();
              for (const l of it.requestLinks) people.set(l.requestItem.request.id, l.requestItem.request.teacher.name);
              const state = o.status === "CANCELLED" ? { t: "Anuluar", c: "text-slate-500" }
                : rem <= 0 ? { t: "✓ Pranuar", c: "text-green-700 dark:text-green-400" }
                : it.receivedQuantity > 0 ? { t: `Pjesërisht`, c: "text-orange-700 dark:text-orange-400" }
                : { t: "Në pritje", c: "text-slate-500 dark:text-slate-400" };
              return (
                <tr key={it.id}>
                  <td className="px-4 py-3 font-bold text-slate-900 dark:text-white">{orderItemName(it)}</td>
                  <td className="px-4 py-3 text-[13px]">
                    {people.size ? [...people.entries()].map(([rid, name], i) => (
                      <span key={rid}>{i > 0 && ", "}<Link href={`/materialet/kerkesat/${rid}`} className="text-primary-700 dark:text-primary-300 hover:underline">{name}</Link></span>
                    )) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">{it.quantity} {it.unit}</td>
                  <td className="px-4 py-3">
                    {open && rem > 0 && canAct ? (
                      <div className="flex items-center gap-1.5">
                        <input type="number" min={1} max={rem} value={qty[it.id] ?? String(rem)} onChange={e => setQty(q => ({ ...q, [it.id]: e.target.value }))}
                          aria-label={`Sasia e pranuar e ${orderItemName(it)}`} className="form-input w-16 py-1 text-sm" />
                        <button type="button" disabled={!!busy}
                          onClick={() => receive([{ orderItemId: it.id, quantity: Math.min(rem, Math.max(1, parseInt(qty[it.id] ?? String(rem)) || 0)) }], `r${it.id}`)}
                          className="text-xs font-bold text-primary-700 dark:text-primary-300 hover:underline whitespace-nowrap disabled:opacity-50">
                          {busy === `r${it.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin inline" /> : "Shëno të pranuar"}
                        </button>
                        {it.receivedQuantity > 0 && <span className="text-xs text-slate-500">({it.receivedQuantity} ardhur)</span>}
                      </div>
                    ) : <span className="whitespace-nowrap">{it.receivedQuantity} {it.unit}</span>}
                  </td>
                  <td className={`px-4 py-3 text-[13px] font-bold ${state.c}`}>{state.t}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {canAct && (
        <div className="flex flex-wrap gap-2">
          {open && o.items.some(it => it.receivedQuantity < it.quantity) && (
            <button type="button" disabled={!!busy} className="btn-primary text-sm"
              onClick={() => receive(o.items.filter(it => it.receivedQuantity < it.quantity).map(it => ({ orderItemId: it.id, quantity: it.quantity - it.receivedQuantity })), "all")}>
              {busy === "all" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Shëno të gjitha të pranuara
            </button>
          )}
          {o.status === "PENDING" && (
            <>
              <button type="button" disabled={!!busy} onClick={() => post(`/api/material-orders/${o.id}`, { status: "ORDERED" }, "ordered", "PATCH")} className="btn-primary text-sm">
                <CheckCircle2 className="w-4 h-4" /> Shëno si porositur
              </button>
              <button type="button" disabled={!!busy} className="btn-secondary text-sm text-red-600"
                onClick={async () => { if (confirm(`Fshi porosinë ${o.orderNumber}? Artikujt rikthehen te „Për t'u porositur”.`) && await post(`/api/material-orders/${o.id}`, undefined, "del", "DELETE")) onDeleted(); }}>
                <Trash2 className="w-4 h-4" /> Fshi
              </button>
            </>
          )}
          {o.status === "ORDERED" && o.items.every(it => it.receivedQuantity === 0) && (
            <button type="button" disabled={!!busy} className="btn-secondary text-sm text-red-600"
              onClick={() => confirm(`Anulo porosinë ${o.orderNumber}? Artikujt rikthehen te „Për t'u porositur”.`) && post(`/api/material-orders/${o.id}`, { status: "CANCELLED" }, "cancel", "PATCH")}>
              <XCircle className="w-4 h-4" /> Anulo porosinë
            </button>
          )}
        </div>
      )}
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}

      {!!o.dispatches?.length && (
        <div className="border-t border-slate-100 dark:border-slate-700 pt-3 space-y-1">
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wide">Dërgimet te furnitori</p>
          {o.dispatches.map(d => {
            const parts = [d.smsStatus && (d.smsStatus === "SENT" ? "SMS ✓" : `SMS ✗ (${d.smsError ?? "dështoi"})`), d.emailStatus && (d.emailStatus === "SENT" ? "Email ✓" : `Email ✗ (${d.emailError ?? "dështoi"})`)].filter(Boolean);
            return <p key={d.id} className="text-xs text-slate-600 dark:text-slate-300">{fmtD(d.createdAt)} {new Date(d.createdAt).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" })}{d.sentByName ? ` · ${d.sentByName}` : ""} · {parts.join(" · ")}</p>;
          })}
        </div>
      )}
      {o.notes && <p className="text-xs text-slate-500 italic">{o.notes}</p>}

      {resend && supplier && (
        <OrderPreviewModal lines={resendLines} supplier={supplier} channels={{ sms: !!supplier.phone, email: !!supplier.email }}
          orderId={o.id} onClose={() => setResend(false)} onSent={reload} />
      )}
    </section>
  );
}
