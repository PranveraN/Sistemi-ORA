"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ShoppingCart, Sparkles, CalendarClock, Minus, Plus, Smartphone, Mail, CheckCircle2 } from "lucide-react";
import { normalizeSearch } from "@/lib/utils";
import type { PendingItem } from "./types";
import OrderPreviewModal, { type OrderLine, type SupplierInfo } from "./OrderPreviewModal";

// "Për t'u porositur" — artikujt e kërkesave të aprovuara që ende s'janë
// porositur, të bashkuar sipas artikullit; dërgimi te FurnitoriOra me SMS
// dhe/ose email. Vetëm administrata (edhe serveri e kontrollon).

interface Group extends OrderLine {
  total: number;
  people: { name: string; qty: number }[];
  className: string | null;
  dateNeeded: string | null;
}

/** I njëjti artikull katalogu (ose i njëjti emër i normalizuar), me të njëjtën ngjyrë dhe njësi = një rresht. */
function groupItems(items: PendingItem[]): Group[] {
  const map = new Map<string, Group>();
  for (const it of items) {
    const name = it.materialName ?? "Artikull";
    const base = it.materialId && !it.isCustom ? `m${it.materialId}` : `c${normalizeSearch(name)}`;
    const key = `${base}|${it.color ?? ""}|${it.unit}`;
    let g = map.get(key);
    if (!g) {
      g = {
        key, name: it.color ? `${name} (${it.color})` : name, quantity: 0, unit: it.unit,
        materialId: it.isCustom ? null : it.materialId, customItemName: it.isCustom ? name : null, color: it.color,
        requestItemIds: [], total: 0, people: [], className: it.className ?? null, dateNeeded: it.dateNeeded ?? null,
      };
      map.set(key, g);
    }
    g.total += it.remaining;
    g.requestItemIds.push(it.requestItemId);
    const p = g.people.find(x => x.name === it.teacherName);
    if (p) p.qty += it.remaining; else g.people.push({ name: it.teacherName, qty: it.remaining });
    if (it.dateNeeded && (!g.dateNeeded || it.dateNeeded < g.dateNeeded)) g.dateNeeded = it.dateNeeded;
  }
  for (const g of map.values()) g.quantity = g.total;
  // Më urgjentet sipër (afati më i afërt), pastaj sipas emrit
  return [...map.values()].sort((a, b) =>
    (a.dateNeeded ?? "9999").localeCompare(b.dateNeeded ?? "9999") || a.name.localeCompare(b.name, "sq"));
}

function deadline(dateNeeded: string | null, leadDays: number): { text: string; cls: string } | null {
  if (!dateNeeded) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const d = new Date(dateNeeded); d.setHours(0, 0, 0, 0);
  const days = Math.round((d.getTime() - today.getTime()) / 86400000);
  if (days < 0) return { text: "Afati kaloi", cls: "text-red-700 dark:text-red-400" };
  if (days === 0) return { text: "Nevojitet sot", cls: "text-orange-700 dark:text-orange-400" };
  return { text: `Nevojitet për ${days} ditë`, cls: days <= Math.max(leadDays, 3) ? "text-orange-700 dark:text-orange-400" : "text-slate-500 dark:text-slate-400" };
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
  const [unselected, setUnselected] = useState<Set<string>>(new Set()); // parazgjedhja: të gjitha të zgjedhura
  const [qty, setQty] = useState<Record<string, number>>({});
  const [supplier, setSupplier] = useState<SupplierInfo | null>(null);
  const [supplierError, setSupplierError] = useState(false);
  const [useSms, setUseSms] = useState(true);
  const [useEmail, setUseEmail] = useState(true);
  const [preview, setPreview] = useState<OrderLine[] | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    fetch("/api/material-orders/supplier")
      .then(r => (r.ok ? r.json() : Promise.reject()))
      .then((d: SupplierInfo) => { setSupplier(d); setUseSms(!!d.phone); setUseEmail(!!d.email); })
      .catch(() => setSupplierError(true));
  }, []);

  // Sasitë e ndryshuara mbeten vetëm për rreshtat që ekzistojnë ende
  const lineQty = (g: Group) => qty[g.key] ?? g.total;
  const selected = groups.filter(g => !unselected.has(g.key));
  const allSelected = groups.length > 0 && selected.length === groups.length;
  const hasSms = !!supplier?.phone, hasEmail = !!supplier?.email;
  const smsOn = useSms && hasSms, emailOn = useEmail && hasEmail;
  const canOpen = canAct && selected.length > 0 && (smsOn || emailOn);

  function toggle(key: string) {
    setUnselected(s => { const n = new Set(s); if (n.has(key)) n.delete(key); else n.add(key); return n; });
  }
  function toggleAll() {
    setUnselected(allSelected ? new Set(groups.map(g => g.key)) : new Set());
  }
  function step(g: Group, d: number) {
    setQty(q => ({ ...q, [g.key]: Math.max(1, lineQty(g) + d) }));
  }
  function openPreview() {
    setNotice("");
    setPreview(selected.map(g => ({ ...g, quantity: lineQty(g) })));
  }

  return (
    <div className="space-y-4">
      <section className="card overflow-hidden" aria-labelledby="oq-title">
        <div className="flex items-center justify-between gap-2 px-4 py-3.5 border-b border-slate-100 dark:border-slate-700">
          <h3 id="oq-title" className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingCart className="w-[18px] h-[18px] text-primary-600" aria-hidden /> Për t&apos;u porositur
            <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-primary-100 text-primary-700 dark:bg-primary-900/40 dark:text-primary-300">{groups.length} artikuj</span>
          </h3>
          {groups.length > 0 && (
            <label className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200 cursor-pointer whitespace-nowrap">
              <input type="checkbox" checked={allSelected} onChange={toggleAll} className="w-4 h-4 accent-primary-600" /> Zgjidh të gjitha
            </label>
          )}
        </div>

        {notice && (
          <p role="status" className="flex items-start gap-2 mx-4 mt-3 rounded-lg bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 px-3 py-2 text-sm text-green-800 dark:text-green-300">
            <CheckCircle2 className="w-4 h-4 mt-0.5 shrink-0" aria-hidden /> {notice}
          </p>
        )}

        {groups.length === 0 ? (
          <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400 text-center">Asnjë artikull për t&apos;u porositur. Kur aprovon një kërkesë, artikujt shfaqen këtu.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-slate-700 max-h-[420px] overflow-y-auto">
            {groups.map(g => {
              const on = !unselected.has(g.key);
              const dl = deadline(g.dateNeeded, leadDays);
              const who = g.people.length > 1
                ? g.people.map(p => `${p.name} ${p.qty}`).join(" · ")
                : [g.people[0]?.name, g.className].filter(Boolean).join(" · ");
              return (
                <li key={g.key} className={`flex items-center gap-3 px-4 py-3 ${on ? "" : "opacity-60"}`}>
                  <input type="checkbox" checked={on} onChange={() => toggle(g.key)} aria-label={`Zgjidh ${g.name}`} className="w-4 h-4 shrink-0 accent-primary-600" />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-sm text-slate-900 dark:text-white break-words">{g.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      {who}
                      {dl && <> · <span className={`font-semibold ${dl.cls}`}>{dl.text}</span></>}
                    </p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button type="button" onClick={() => step(g, -1)} disabled={lineQty(g) <= 1} aria-label={`Zvogëlo sasinë e ${g.name}`}
                      className="w-7 h-7 rounded-md border border-slate-300 dark:border-slate-600 flex items-center justify-center text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 disabled:opacity-40"><Minus className="w-3.5 h-3.5" /></button>
                    <span className="min-w-[2.2rem] text-center text-sm font-bold text-slate-900 dark:text-white">
                      {lineQty(g)}{g.unit && g.unit !== "copë" ? <span className="block text-[10px] font-normal text-slate-500 leading-none">{g.unit}</span> : null}
                    </span>
                    <button type="button" onClick={() => step(g, 1)} aria-label={`Rrit sasinë e ${g.name}`}
                      className="w-7 h-7 rounded-md border border-slate-300 dark:border-slate-600 flex items-center justify-center text-primary-700 dark:text-primary-300 hover:bg-slate-50 dark:hover:bg-slate-700"><Plus className="w-3.5 h-3.5" /></button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {groups.length > 0 && (
          <div className="p-4 space-y-3 border-t border-slate-100 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/20">
            {/* Furnitori — nga Cilësimet */}
            <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-3.5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs text-slate-500 dark:text-slate-400">Furnitori</p>
                <Link href="/settings" className="text-xs font-bold text-primary-700 dark:text-primary-300 hover:underline">Ndrysho</Link>
              </div>
              {supplierError ? (
                <p className="text-sm text-red-600 dark:text-red-400 mt-1">Të dhënat e furnitorit s&apos;u ngarkuan.</p>
              ) : !supplier ? (
                <p className="text-sm text-slate-400 mt-1">Duke ngarkuar…</p>
              ) : (
                <>
                  <p className="font-bold text-slate-900 dark:text-white">{supplier.name}</p>
                  {hasEmail
                    ? <p className="text-sm text-slate-600 dark:text-slate-300 break-all">{supplier.email}</p>
                    : <Link href="/settings" className="block text-sm text-primary-700 dark:text-primary-300 hover:underline">Shto email-in e furnitorit te Cilësimet</Link>}
                  {hasSms
                    ? <p className="text-sm text-slate-600 dark:text-slate-300">{supplier.phone}</p>
                    : <Link href="/settings" className="block text-sm text-primary-700 dark:text-primary-300 hover:underline">Shto telefonin e furnitorit te Cilësimet</Link>}
                </>
              )}
            </div>

            <fieldset>
              <legend className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-1.5">Dërgo me:</legend>
              <div className="grid grid-cols-2 gap-2">
                <ChannelCard icon={<Smartphone className="w-4 h-4" aria-hidden />} label="SMS" checked={smsOn} disabled={!hasSms} onChange={setUseSms} />
                <ChannelCard icon={<Mail className="w-4 h-4" aria-hidden />} label="Email" checked={emailOn} disabled={!hasEmail} onChange={setUseEmail} />
              </div>
              {supplier && !smsOn && !emailOn && (hasSms || hasEmail) && <p className="text-xs text-red-600 dark:text-red-400 mt-1.5">Zgjidhni të paktën njërën: SMS ose Email.</p>}
            </fieldset>

            <button type="button" onClick={openPreview} disabled={!canOpen}
              className="w-full h-12 rounded-xl bg-primary-600 hover:bg-primary-700 text-white font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-primary-500">
              Shiko dhe dërgo porosinë ({selected.length} {selected.length === 1 ? "artikull" : "artikuj"})
            </button>
            {!canAct && <p className="text-xs text-slate-500 text-center">Roli juaj ka vetëm qasje shikimi.</p>}
          </div>
        )}
      </section>

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

      {preview && supplier && (
        <OrderPreviewModal
          lines={preview}
          supplier={supplier}
          channels={{ sms: smsOn, email: emailOn }}
          onClose={() => setPreview(null)}
          onSent={() => {
            setUnselected(new Set()); setQty({});
            setNotice(`Porosia u dërgua te ${supplier.name}. Shiko te "Porositë".`);
            onOrdered();
          }}
        />
      )}
    </div>
  );
}

function ChannelCard({ icon, label, checked, disabled, onChange }: {
  icon: React.ReactNode; label: string; checked: boolean; disabled: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <label className={`flex items-center gap-2.5 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold transition-colors ${
      disabled ? "border-slate-200 dark:border-slate-700 text-slate-400 cursor-not-allowed"
        : checked ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20 text-slate-900 dark:text-white cursor-pointer"
        : "border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 cursor-pointer hover:border-primary-200"}`}>
      <input type="checkbox" checked={checked} disabled={disabled} onChange={e => onChange(e.target.checked)} className="w-4 h-4 accent-primary-600" />
      {icon} {label}
    </label>
  );
}
