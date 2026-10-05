"use client";

import { useState } from "react";
import { REQUEST_STATUS_MAP, stageOf, REQUEST_STAGES } from "@/lib/materialConstants";

interface Preview {
  byStatus: { status: string; count: number }[];
  changes: { requestId: number; from: string; to: string; teacher: string }[];
  deliveryUpdates: number;
}

const label = (s: string) => REQUEST_STATUS_MAP[s]?.label ?? s;
const stageLabel = (s: string) => REQUEST_STAGES.find(x => x.key === stageOf(s))?.label ?? s;

// Migrimi i kërkesave të materialeve te statuset e reja — pamje paraprake, pastaj ekzekutim.
export default function MaterialStatusBackfillCard() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError(""); setResult("");
    try {
      const r = await fetch("/api/superadmin/material-status-backfill");
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Ngarkimi dështoi."); return; }
      setPreview(d);
    } catch { setError("Gabim rrjeti — provo përsëri."); }
    finally { setLoading(false); }
  }

  async function run() {
    if (!preview) return;
    if (!confirm(`Të kalojnë ${preview.changes.length} kërkesa te statuset e reja?`)) return;
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/superadmin/material-status-backfill", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Ekzekutimi dështoi."); return; }
      setResult(`U përditësuan ${d.updated} kërkesa.`);
      setPreview(null);
    } catch { setError("Gabim rrjeti — provo përsëri."); }
    finally { setLoading(false); }
  }

  return (
    <div className="mt-8 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
      <h2 className="font-semibold text-sm mb-1 flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center text-xs">📦</span>
        Statuset e reja të kërkesave të materialeve
      </h2>
      <p className="text-gray-500 text-xs mb-4">
        Kërkesat që janë tashmë në ndonjë porosi kalojnë në &quot;Porositur&quot; ose &quot;Dorëzuar&quot;. Të tjerat s&apos;preken;
        &quot;Aprovuar pjesërisht&quot; shfaqet nën &quot;Aprovuara&quot; me etiketën &quot;Pjesërisht&quot;. Mund të përsëritet.
      </p>
      {preview && (
        <div className="mb-4 space-y-3 text-sm">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs space-y-1">
            <p className="text-gray-400 mb-1">Hartëzimi (statusi tani → karta e re):</p>
            {preview.byStatus.length === 0 && <p className="text-gray-500">Asnjë kërkesë ende.</p>}
            {preview.byStatus.map(s => (
              <p key={s.status}>• {label(s.status)}: <b>{s.count}</b> → {stageLabel(s.status)}{s.status === "PARTIALLY_APPROVED" ? " (Pjesërisht)" : ""}</p>
            ))}
          </div>
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-xs space-y-1">
            <p className="text-gray-400 mb-1">Do të ndryshojnë: <b className="text-gray-200">{preview.changes.length}</b> kërkesa</p>
            {preview.changes.map(c => <p key={c.requestId} className="text-gray-400">• #{c.requestId} {c.teacher}: {label(c.from)} → {label(c.to)}</p>)}
          </div>
        </div>
      )}
      {result && <p className="mb-4 text-emerald-400 text-sm">✓ {result}</p>}
      {error && <p className="mb-4 text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button onClick={load} disabled={loading} className="px-4 py-2 rounded-xl text-sm bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50">
          {loading && !preview ? "Duke llogaritur..." : "Shiko çfarë ndryshon"}
        </button>
        {preview && (preview.changes.length > 0 || preview.deliveryUpdates > 0) && (
          <button onClick={run} disabled={loading} className="px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-600 to-purple-600 disabled:opacity-50">
            {loading ? "Duke ekzekutuar..." : `Ekzekuto (${preview.changes.length})`}
          </button>
        )}
      </div>
    </div>
  );
}
