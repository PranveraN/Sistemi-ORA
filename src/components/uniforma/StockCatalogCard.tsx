"use client";

import { useRef, useState } from "react";
import { Shirt, Trash2, Loader2, Minus, Plus } from "lucide-react";
import { formatCurrency } from "@/lib/utils";
import { needsAttention, type ProductRow } from "@/lib/uniStockCalc";

// Karta e një produkti te Katalogu i stokut: foto, totali, statusi, numrat.
// Në mënyrën e porosisë çdo numër merr − / sasia / + (vetëm draft, stoku s'ndryshon).

const MAX_PHOTO = 5 * 1024 * 1024;
const PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp"];

export default function StockCatalogCard({ row, orderMode, qty, onQty, onPhotoChanged }: {
  row: ProductRow;
  orderMode: boolean;
  qty: (size: string) => number;
  onQty: (size: string, v: number) => void;
  onPhotoChanged: () => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);

  const kritik = row.sizes.filter(s => s.status === "NEN_PRAG").length;
  const mbaruar = row.sizes.filter(s => s.status === "MBARUAR").length;
  const paHyrje = row.sizes.every(s => s.status === "PA_HYRJE");
  const shown = orderMode ? row.sizes : row.sizes.filter(s => s.status !== "PA_HYRJE");
  const photoUrl = row.photo ? `/api/uniforms/products/${row.productId}/photo?v=${encodeURIComponent(row.photo)}` : null;

  async function upload(f: File) {
    if (!PHOTO_TYPES.includes(f.type)) { alert("Lejohen vetëm foto JPG, PNG ose WebP."); return; }
    if (f.size > MAX_PHOTO) { alert("Fotoja s'duhet të kalojë 5 MB."); return; }
    const url = URL.createObjectURL(f);
    setPreview(url);
    setBusy(true);
    const fd = new FormData();
    fd.append("file", f);
    const r = await fetch(`/api/uniforms/products/${row.productId}/photo`, { method: "POST", body: fd });
    setBusy(false);
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "Ngarkimi dështoi."); setPreview(null); URL.revokeObjectURL(url); return; }
    onPhotoChanged();
    setTimeout(() => { setPreview(null); URL.revokeObjectURL(url); }, 1500);
  }

  async function removePhoto() {
    if (!confirm(`Hiq foton e "${row.name}"?`)) return;
    setBusy(true);
    const r = await fetch(`/api/uniforms/products/${row.productId}/photo`, { method: "DELETE" });
    setBusy(false);
    if (!r.ok) { alert("Heqja dështoi."); return; }
    onPhotoChanged();
  }

  const tile = (status: string) =>
    status === "MBARUAR" ? "bg-red-50 border-red-300 dark:bg-red-900/20 dark:border-red-800"
    : status === "NEN_PRAG" ? "bg-orange-50 border-orange-300 dark:bg-orange-900/20 dark:border-orange-800"
    : status === "PA_HYRJE" ? "bg-white border-dashed border-slate-200 dark:bg-slate-900 dark:border-slate-700"
    : "bg-slate-50 border-slate-200 dark:bg-slate-800 dark:border-slate-700";
  const num = (status: string) =>
    status === "MBARUAR" ? "text-red-600" : status === "NEN_PRAG" ? "text-orange-600" : status === "PA_HYRJE" ? "text-slate-300" : "text-slate-800 dark:text-slate-100";

  return (
    <div className={`card p-3 space-y-3 border-2 ${kritik + mbaruar > 0 ? "border-orange-200 dark:border-orange-900/60" : "border-transparent"}`}>
      <div className="flex gap-3">
        <div className="relative w-24 h-24 shrink-0 group">
          {preview || photoUrl ? (
            <>
              <img src={preview ?? photoUrl!} alt={row.name} loading="lazy" className="w-24 h-24 rounded-xl object-cover bg-slate-100 dark:bg-slate-800" />
              <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
                className="absolute inset-0 rounded-xl bg-black/0 group-hover:bg-black/45 text-white text-[11px] font-semibold opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
                Ndrysho foton
              </button>
              {!preview && (
                <button type="button" onClick={removePhoto} disabled={busy} title="Hiq foton"
                  className="absolute -top-1.5 -right-1.5 p-1 rounded-full bg-white dark:bg-slate-800 shadow text-red-500 opacity-0 group-hover:opacity-100 transition">
                  <Trash2 className="w-3 h-3" />
                </button>
              )}
            </>
          ) : (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={busy}
              className="w-24 h-24 rounded-xl border-2 border-dashed border-violet-200 dark:border-violet-800 text-violet-500 hover:bg-violet-50 dark:hover:bg-violet-900/20 flex flex-col items-center justify-center gap-1 text-[11px]">
              <Shirt className="w-5 h-5" /> Ngarko foto
            </button>
          )}
          {busy && <div className="absolute inset-0 rounded-xl bg-white/60 dark:bg-slate-900/60 flex items-center justify-center"><Loader2 className="w-5 h-5 animate-spin text-primary-500" /></div>}
          <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f); }} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="font-bold text-slate-900 dark:text-white leading-tight">{row.name}</p>
          {(row.sellPrice ?? 0) > 0 && <p className="text-xs text-slate-400 mt-0.5">Çmimi: {formatCurrency(row.sellPrice!)}</p>}
          <div className="flex items-baseline gap-1.5 mt-1.5 flex-wrap">
            <span className="text-2xl font-bold text-slate-900 dark:text-white">{row.stok}</span>
            <span className="text-xs text-slate-400">copë</span>
            {paHyrje ? <span className="badge text-[10px] bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300">Pa hyrje</span> : (
              <>
                {kritik > 0 && <span className="badge text-[10px] bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">Kritik ({kritik})</span>}
                {mbaruar > 0 && <span className="badge text-[10px] bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300">Mbaruar ({mbaruar})</span>}
                {kritik + mbaruar === 0 && <span className="badge text-[10px] bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300">Në rregull</span>}
              </>
            )}
          </div>
        </div>
      </div>

      {paHyrje && !orderMode ? (
        <p className="text-xs text-slate-400">Ende pa hyrje. Shtoni numrat me &quot;+ Hyrje stoku&quot;.</p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {shown.map(s => {
            const q = qty(s.size);
            return (
              <div key={s.size} className={`${orderMode ? "w-[86px]" : "w-[62px]"} rounded-lg border text-center py-1 ${tile(s.status)}`} title={needsAttention(s.status) ? `nr. ${s.size}: ${s.stok} copë` : undefined}>
                <p className="text-[10px] text-slate-400 leading-tight">nr. {s.size}</p>
                <p className={`text-sm font-bold leading-tight ${num(s.status)}`}>{s.status === "PA_HYRJE" ? "—" : s.stok}</p>
                {orderMode && (
                  <div className="mt-1 flex items-center justify-between px-0.5">
                    <button type="button" onClick={() => onQty(s.size, Math.max(0, q - 1))} aria-label={`Pakëso nr. ${s.size}`}
                      className="w-7 h-7 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center"><Minus className="w-3 h-3" /></button>
                    {editing === s.size ? (
                      <input autoFocus inputMode="numeric" defaultValue={q || ""} onBlur={e => { onQty(s.size, Math.max(0, parseInt(e.target.value) || 0)); setEditing(null); }}
                        onKeyDown={e => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }}
                        className="w-7 text-center text-xs font-bold bg-white dark:bg-slate-800 border border-primary-300 rounded" />
                    ) : (
                      <button type="button" onClick={() => setEditing(s.size)} className={`w-7 text-xs font-bold ${q > 0 ? "text-primary-600" : "text-slate-400"}`}>{q}</button>
                    )}
                    <button type="button" onClick={() => onQty(s.size, q + 1)} aria-label={`Shto nr. ${s.size}`}
                      className="w-7 h-7 rounded bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 flex items-center justify-center"><Plus className="w-3 h-3" /></button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
