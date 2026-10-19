"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, Plus, AlertTriangle, ChevronDown, ChevronRight, Pencil, Trash2, X, Settings2, ClipboardCheck } from "lucide-react";
import { formatDate, formatDateTime } from "@/lib/utils";
import { STATUS_LABELS, type ProductRow, type StockStatus } from "@/lib/uniStockCalc";

interface Entry { id: number; productId: number; size: string; quantity: number; date: string; note: string | null; kind: string }
interface LowItem { productId: number; size: string; stock: number; status: StockStatus; name: string }
interface StockData { startedAt: string; rows: ProductRow[]; low: LowItem[]; totalItems: number; entries: Entry[] }

const today = () => new Date().toISOString().slice(0, 10);

const STATUS_CLS: Record<StockStatus, string> = {
  OK: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  NE_PRAG: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  NEN_PRAG: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  MBARUAR: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  PA_HYRJE: "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400",
};

async function send(url: string, method: string, body?: unknown) {
  const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error || "Ruajtja dështoi.");
  }
  return res.json();
}

export default function StokuPage() {
  const [data, setData] = useState<StockData | null>(null);
  const [error, setError] = useState("");
  const [open, setOpen] = useState<Record<number, boolean>>({});
  const [bellOpen, setBellOpen] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  // Forma "Hyrje e re stoku"
  const [date, setDate] = useState(today());
  const [productId, setProductId] = useState<number | "">("");
  const [qty, setQty] = useState<Record<string, string>>({});
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  const [editEntry, setEditEntry] = useState<Entry | null>(null);
  const [settingsFor, setSettingsFor] = useState<ProductRow | null>(null);
  const [countFor, setCountFor] = useState<ProductRow | null>(null);
  const [countPick, setCountPick] = useState(false);

  const load = () =>
    fetch("/api/uniforms/stock")
      .then(async r => { if (!r.ok) throw new Error("Gjendja e stokut s'u lexua."); return r.json(); })
      .then(d => { setData(d); setError(""); })
      .catch(e => setError(e.message));

  useEffect(() => { load(); }, []);

  const rows = data?.rows ?? [];
  const product = rows.find(r => r.productId === productId);
  const formTotal = useMemo(() => Object.values(qty).reduce((s, v) => s + (parseInt(v) > 0 ? parseInt(v) : 0), 0), [qty]);
  const productName = (id: number) => rows.find(r => r.productId === id)?.name ?? `Produkt #${id}`;

  const saveEntry = async () => {
    if (!productId) return;
    setSaving(true);
    try {
      await send("/api/uniforms/stock", "POST", {
        productId, date, note,
        lines: Object.entries(qty).map(([size, quantity]) => ({ size, quantity })),
      });
      setQty({}); setNote("");
      await load();
    } catch (e) { alert((e as Error).message); }
    setSaving(false);
  };

  const deleteEntry = async (e: Entry) => {
    if (!confirm(`Fshi hyrjen: ${productName(e.productId)} nr. ${e.size}, ${e.quantity} copë?`)) return;
    try { await send(`/api/uniforms/stock/${e.id}`, "DELETE"); await load(); } catch (err) { alert((err as Error).message); }
  };

  if (!data) return (
    <div className="p-6 flex justify-center py-20">
      {error ? <p className="text-red-500 text-sm">{error}</p> : <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />}
    </div>
  );

  return (
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Koka */}
      <div className="flex items-center gap-3">
        <Link href="/uniforma" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Stoku i uniformave</h1>
          <p className="text-sm text-slate-400 mt-0.5">Regjistro mallin që hyn — shitjet, borxhet, dorëzimet dhe arka nuk preken</p>
        </div>
        <div className="relative">
          <button onClick={() => setBellOpen(o => !o)} className="relative p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Njoftimet e stokut">
            <Bell className="w-5 h-5 text-slate-600 dark:text-slate-300" />
            {data.low.length > 0 && (
              <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{data.low.length}</span>
            )}
          </button>
          {bellOpen && (
            <div className="absolute right-0 mt-2 w-72 card p-3 z-30 shadow-xl">
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">Stok i ulët</p>
              {data.low.length === 0 ? <p className="text-sm text-green-600">Asnjë numër në ose nën prag.</p> : (
                <ul className="space-y-1 max-h-72 overflow-y-auto">
                  {data.low.map(l => (
                    <li key={`${l.productId}-${l.size}`} className="flex justify-between text-sm gap-2">
                      <span className="text-slate-600 dark:text-slate-300">{l.name}</span>
                      <span className={l.status === "NE_PRAG" ? "text-amber-600 font-semibold" : "text-red-600 font-semibold"}>{l.stock} copë</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
        <button onClick={() => formRef.current?.scrollIntoView({ behavior: "smooth" })} className="btn-primary">
          <Plus className="w-4 h-4" /> Hyrje stoku
        </button>
      </div>

      {data.low.length > 0 && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 px-4 py-3 text-sm text-amber-800 dark:text-amber-300 flex gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>Stok i ulët: {data.low.map(l => `${l.name} (${l.stock} copë)`).join(" · ")}</span>
        </div>
      )}

      <p className="text-xs text-slate-400">
        Stoku i ri nisi nga zero më {formatDateTime(data.startedAt)}. Shitjet e regjistruara para kësaj nuk llogariten te stoku.
      </p>

      {/* Tri kartelat */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="card p-4"><p className="text-sm text-slate-500">Copë në stok</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{data.totalItems}</p></div>
        <div className="card p-4"><p className="text-sm text-slate-500">Produkte</p><p className="text-2xl font-bold text-slate-900 dark:text-white">{rows.length}</p></div>
        <div className="card p-4"><p className="text-sm text-slate-500">Numra nën prag</p><p className={`text-2xl font-bold ${data.low.length ? "text-red-600" : "text-green-600"}`}>{data.low.length}</p></div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[340px_1fr] gap-5 items-start">
        {/* Hyrje e re + hyrjet e fundit */}
        <div className="space-y-5">
          <div ref={formRef} className="card p-4 space-y-3">
            <h2 className="font-semibold text-slate-800 dark:text-white text-sm">Hyrje e re stoku</h2>
            <div>
              <label className="label">Data</label>
              <input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} />
            </div>
            <div>
              <label className="label">Produkti</label>
              <select className="input" value={productId} onChange={e => { setProductId(e.target.value ? parseInt(e.target.value) : ""); setQty({}); }}>
                <option value="">— zgjidh produktin —</option>
                {rows.map(r => <option key={r.productId} value={r.productId}>{r.name}</option>)}
              </select>
            </div>
            {product && (
              <div>
                <label className="label">Sasia sipas numrit</label>
                <table className="w-full text-sm">
                  <thead><tr className="text-xs text-slate-400"><th className="text-left py-1">Numri</th><th className="text-left py-1">Sasia</th><th className="text-right py-1">Stok tani</th></tr></thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {product.sizes.map(s => (
                      <tr key={s.size}>
                        <td className="py-1.5 text-slate-700 dark:text-slate-300">{s.size}</td>
                        <td className="py-1.5">
                          <input type="number" min={0} className="input w-24 py-1" placeholder="0" value={qty[s.size] ?? ""}
                            onChange={e => setQty(q => ({ ...q, [s.size]: e.target.value }))} />
                        </td>
                        <td className="py-1.5 text-right text-slate-400">{s.stok}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot><tr><td className="pt-2 font-semibold">Totali</td><td className="pt-2 font-semibold">{formTotal} copë</td><td /></tr></tfoot>
                </table>
              </div>
            )}
            <div>
              <label className="label">Shënim</label>
              <input className="input" placeholder="Malli nga furnitori" value={note} onChange={e => setNote(e.target.value)} />
            </div>
            <button onClick={saveEntry} disabled={saving || !productId || formTotal === 0} className="btn-ghost w-full justify-center border border-slate-200 dark:border-slate-700">
              {saving ? "Duke ruajtur..." : "Ruaj hyrjen"}
            </button>
          </div>

          <div className="card p-4">
            <h2 className="font-semibold text-slate-800 dark:text-white text-sm mb-3">Hyrjet e fundit</h2>
            {data.entries.length === 0 ? <p className="text-sm text-slate-400">Ende s&apos;ka hyrje.</p> : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800 max-h-[420px] overflow-y-auto">
                {data.entries.map(e => (
                  <li key={e.id} className="py-2 flex items-start gap-2 text-sm">
                    <div className="flex-1 min-w-0">
                      <p className="text-slate-700 dark:text-slate-200">
                        {productName(e.productId)} <span className="text-slate-400">nr.</span> {e.size}:{" "}
                        <b className={e.quantity < 0 ? "text-red-600" : ""}>{e.quantity > 0 && e.kind === "NUMERIM" ? "+" : ""}{e.quantity}</b> copë
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {formatDate(e.date)}{e.kind === "NUMERIM" ? " · Numërim" : ""}{e.note ? ` · ${e.note}` : ""}
                      </p>
                    </div>
                    <button onClick={() => setEditEntry(e)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400" title="Ndrysho"><Pencil className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deleteEntry(e)} className="p-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-400" title="Fshi"><Trash2 className="w-3.5 h-3.5" /></button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Gjendja */}
        <div className="card p-4 overflow-x-auto">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-slate-800 dark:text-white text-sm">Gjendja sipas produktit dhe numrit</h2>
            <button onClick={() => setCountPick(true)} className="btn-ghost border border-slate-200 dark:border-slate-700 text-sm">
              <ClipboardCheck className="w-4 h-4" /> Numërim stoku
            </button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700">
                <th className="text-left py-2 font-semibold">Produkti / Numri</th>
                <th className="text-right py-2 font-semibold">Hyrë</th>
                <th className="text-right py-2 font-semibold">Shitur</th>
                <th className="text-right py-2 font-semibold">Stok</th>
                <th className="text-right py-2 font-semibold">Prag</th>
                <th className="text-left py-2 pl-4 font-semibold">Statusi</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <ProductRows key={r.productId} r={r} open={!!open[r.productId]}
                  toggle={() => setOpen(o => ({ ...o, [r.productId]: !o[r.productId] }))}
                  onSettings={() => setSettingsFor(r)} />
              ))}
            </tbody>
          </table>
          <p className="text-xs text-slate-400 mt-3">&quot;Shitur&quot; lexohet nga shitjet ekzistuese pa i ndryshuar ato. Numrat &quot;Pa hyrje&quot; s&apos;kanë ende asnjë lëvizje.</p>
        </div>
      </div>

      {editEntry && <EditEntryModal entry={editEntry} name={productName(editEntry.productId)} onClose={() => setEditEntry(null)} onSaved={() => { setEditEntry(null); load(); }} />}
      {settingsFor && <SettingsModal row={settingsFor} onClose={() => setSettingsFor(null)} onSaved={() => { setSettingsFor(null); load(); }} />}
      {countPick && (
        <Modal title="Numërim stoku" onClose={() => setCountPick(false)}>
          <p className="text-sm text-slate-500 mb-3">Zgjidh produktin që do ta numërosh:</p>
          <div className="space-y-1">
            {rows.map(r => (
              <button key={r.productId} onClick={() => { setCountPick(false); setCountFor(r); }}
                className="w-full flex justify-between px-3 py-2 rounded-lg hover:bg-slate-50 dark:hover:bg-slate-800 text-sm">
                <span>{r.name}</span><span className="text-slate-400">{r.stok} copë</span>
              </button>
            ))}
          </div>
        </Modal>
      )}
      {countFor && <CountModal row={countFor} onClose={() => setCountFor(null)} onSaved={() => { setCountFor(null); load(); }} />}
    </div>
  );
}

function StatusBadge({ s }: { s: StockStatus }) {
  return <span className={`badge text-xs ${STATUS_CLS[s]}`}>{STATUS_LABELS[s]}</span>;
}

function ProductRows({ r, open, toggle, onSettings }: { r: ProductRow; open: boolean; toggle: () => void; onSettings: () => void }) {
  return (
    <>
      <tr className="border-b border-slate-100 dark:border-slate-800">
        <td className="py-2.5">
          <button onClick={toggle} className="flex items-center gap-1 font-semibold text-slate-800 dark:text-slate-100">
            {open ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />} {r.name}
          </button>
        </td>
        <td className="text-right">{r.hyre}</td>
        <td className="text-right">{r.shitur}</td>
        <td className={`text-right font-bold ${r.stok < 0 ? "text-red-600" : ""}`}>{r.stok}</td>
        <td className="text-right text-slate-400">—</td>
        <td className="pl-4">
          {r.lowCount > 0
            ? <span className={`badge text-xs ${STATUS_CLS.NEN_PRAG}`}>{r.lowCount} {r.lowCount === 1 ? "numër" : "numra"} nën prag</span>
            : <span className={`badge text-xs ${r.hyre || r.shitur ? STATUS_CLS.OK : STATUS_CLS.PA_HYRJE}`}>{r.hyre || r.shitur ? "Në rregull" : "Pa hyrje"}</span>}
        </td>
        <td className="text-right">
          <button onClick={onSettings} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-400" title="Numrat dhe pragu"><Settings2 className="w-4 h-4" /></button>
        </td>
      </tr>
      {open && r.sizes.map(s => (
        <tr key={s.size} className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/30">
          <td className="py-2 pl-8 text-slate-600 dark:text-slate-300">Nr. {s.size}</td>
          <td className="text-right">{s.hyre}</td>
          <td className="text-right">{s.shitur}</td>
          <td className={`text-right ${s.stok <= 0 && s.status !== "PA_HYRJE" ? "text-red-600 font-semibold" : ""}`}>{s.stok}</td>
          <td className="text-right">{s.prag || "—"}</td>
          <td className="pl-4"><StatusBadge s={s.status} /></td>
          <td />
        </tr>
      ))}
    </>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4 text-slate-400" /></button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

function EditEntryModal({ entry, name, onClose, onSaved }: { entry: Entry; name: string; onClose: () => void; onSaved: () => void }) {
  const [size, setSize] = useState(entry.size);
  const [quantity, setQuantity] = useState(String(entry.quantity));
  const [date, setDate] = useState(entry.date.slice(0, 10));
  const [note, setNote] = useState(entry.note ?? "");
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await send(`/api/uniforms/stock/${entry.id}`, "PUT", { size, quantity, date, note }); onSaved(); }
    catch (e) { alert((e as Error).message); setSaving(false); }
  };
  return (
    <Modal title={`Ndrysho hyrjen — ${name}`} onClose={onClose}>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label">Numri</label><input className="input" value={size} onChange={e => setSize(e.target.value)} /></div>
          <div><label className="label">Sasia</label><input type="number" className="input" value={quantity} onChange={e => setQuantity(e.target.value)} /></div>
        </div>
        <div><label className="label">Data</label><input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} /></div>
        <div><label className="label">Shënim</label><input className="input" value={note} onChange={e => setNote(e.target.value)} /></div>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose} className="btn-ghost flex-1">Anulo</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? "..." : "Ruaj"}</button>
        </div>
      </div>
    </Modal>
  );
}

function SettingsModal({ row, onClose, onSaved }: { row: ProductRow; onClose: () => void; onSaved: () => void }) {
  const [sizesText, setSizesText] = useState(row.sizes.map(s => s.size).join(", "));
  const [thr, setThr] = useState<Record<string, string>>(() => Object.fromEntries(row.sizes.map(s => [s.size, s.prag ? String(s.prag) : ""])));
  const [common, setCommon] = useState("");
  const [saving, setSaving] = useState(false);
  const sizes = [...new Set(sizesText.split(",").map(s => s.trim()).filter(Boolean))];
  const save = async () => {
    setSaving(true);
    try { await send("/api/uniforms/stock/settings", "PUT", { productId: row.productId, sizes, thresholds: thr }); onSaved(); }
    catch (e) { alert((e as Error).message); setSaving(false); }
  };
  return (
    <Modal title={`Numrat dhe pragu — ${row.name}`} onClose={onClose}>
      <div className="space-y-4">
        <div>
          <label className="label">Numrat (të ndarë me presje)</label>
          <input className="input" value={sizesText} onChange={e => setSizesText(e.target.value)} />
        </div>
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <label className="label">Prag i përbashkët për të gjithë numrat</label>
            <input type="number" min={0} className="input" placeholder="p.sh. 5" value={common} onChange={e => setCommon(e.target.value)} />
          </div>
          <button onClick={() => setThr(Object.fromEntries(sizes.map(s => [s, common])))} disabled={common === ""} className="btn-ghost border border-slate-200 dark:border-slate-700">Vendose</button>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-slate-400"><th className="text-left py-1">Numri</th><th className="text-left py-1">Pragu minimal</th></tr></thead>
          <tbody>
            {sizes.map(s => (
              <tr key={s}>
                <td className="py-1">{s}</td>
                <td className="py-1"><input type="number" min={0} className="input w-24 py-1" placeholder="0" value={thr[s] ?? ""} onChange={e => setThr(t => ({ ...t, [s]: e.target.value }))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-ghost flex-1">Anulo</button>
          <button onClick={save} disabled={saving || !sizes.length} className="btn-primary flex-1 justify-center">{saving ? "..." : "Ruaj"}</button>
        </div>
      </div>
    </Modal>
  );
}

function CountModal({ row, onClose, onSaved }: { row: ProductRow; onClose: () => void; onSaved: () => void }) {
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [date, setDate] = useState(today());
  const [saving, setSaving] = useState(false);
  const save = async () => {
    setSaving(true);
    try { await send("/api/uniforms/stock/count", "POST", { productId: row.productId, date, counts }); onSaved(); }
    catch (e) { alert((e as Error).message); setSaving(false); }
  };
  return (
    <Modal title={`Numërim stoku — ${row.name}`} onClose={onClose}>
      <div className="space-y-3">
        <p className="text-xs text-slate-500">Shkruaj sa copë ke realisht sot. Sistemi krijon hyrje korrigjuese që stoku të dalë i saktë. Numrat e lënë bosh nuk ndryshojnë. Shitjet, borxhet, dorëzimet dhe arka nuk preken.</p>
        <div><label className="label">Data e numërimit</label><input type="date" className="input" value={date} onChange={e => setDate(e.target.value)} /></div>
        <table className="w-full text-sm">
          <thead><tr className="text-xs text-slate-400"><th className="text-left py-1">Numri</th><th className="text-right py-1">Stok sipas sistemit</th><th className="text-right py-1">Sasia reale</th></tr></thead>
          <tbody>
            {row.sizes.map(s => (
              <tr key={s.size}>
                <td className="py-1">{s.size}</td>
                <td className="py-1 text-right text-slate-500">{s.stok}</td>
                <td className="py-1 text-right"><input type="number" min={0} className="input w-24 py-1 ml-auto" value={counts[s.size] ?? ""} onChange={e => setCounts(c => ({ ...c, [s.size]: e.target.value }))} /></td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex gap-2">
          <button onClick={onClose} className="btn-ghost flex-1">Anulo</button>
          <button onClick={save} disabled={saving} className="btn-primary flex-1 justify-center">{saving ? "..." : "Ruaj numërimin"}</button>
        </div>
      </div>
    </Modal>
  );
}
