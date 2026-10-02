"use client";

import { useState } from "react";

const TYPE_LABELS: Record<string, string> = {
  REGJISTRIM: "Regjistrime",
  PAGESE: "Pagesa",
  SMS: "SMS",
  CREGJISTRIM: "Çregjistrime / diplomime",
  NDRYSHIM_KLASE: "Ndryshime klase (kalimi i vitit)",
  NDRYSHIM_TE_DHENASH: "Editime të vjetra (nga regjistri i aktivitetit)",
};

interface Preview { toCreate: number; byType: Record<string, number>; alreadyDone: number; cutoff: string }

// Rindërtimi i historikut të nxënësve — së pari PAMJE PARAPRAKE (vetëm lexim),
// pastaj ekzekutim vetëm pas konfirmimit. I sigurt për t'u përsëritur.
export default function BackfillHistoryCard() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>("");
  const [error, setError] = useState("");

  async function loadPreview() {
    setLoading(true); setError(""); setResult("");
    try {
      const r = await fetch("/api/superadmin/backfill-history");
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Ngarkimi dështoi."); return; }
      setPreview(d);
    } catch { setError("Gabim rrjeti — provo përsëri."); }
    finally { setLoading(false); }
  }

  async function run() {
    if (!preview || !confirm(`Të krijohen ${preview.toCreate} ngjarje në historikun e nxënësve? (S'ndryshohet asnjë e dhënë tjetër.)`)) return;
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/superadmin/backfill-history", { method: "POST" });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Ekzekutimi dështoi."); return; }
      setResult(`U krijuan ${d.created} ngjarje.`);
      setPreview(null);
    } catch { setError("Gabim rrjeti — provo përsëri."); }
    finally { setLoading(false); }
  }

  return (
    <div className="mt-8 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
      <h2 className="font-semibold text-sm mb-1 flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center text-xs">🕘</span>
        Rindërto historikun e nxënësve
      </h2>
      <p className="text-gray-500 text-xs mb-4">
        Krijon ngjarjet fillestare të historikut nga të dhënat ekzistuese (regjistrime, pagesa, SMS, çregjistrime,
        kalime viti, editime të vjetra). Vetëm shton — s&apos;ndryshon asgjë tjetër. Mund të përsëritet pa dyfishim.
      </p>

      {preview && (
        <div className="mb-4 p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] text-sm space-y-1">
          <p className="font-medium">Do të krijohen {preview.toCreate} ngjarje:</p>
          {Object.entries(preview.byType).map(([k, v]) => (
            <p key={k} className="text-gray-400 text-xs">• {TYPE_LABELS[k] ?? k}: {v}</p>
          ))}
          {preview.alreadyDone > 0 && <p className="text-gray-500 text-xs">({preview.alreadyDone} ekzistojnë tashmë — anashkalohen)</p>}
          <p className="text-gray-600 text-xs">Të dhëna deri më {new Date(preview.cutoff).toLocaleString("sq-AL")}.</p>
        </div>
      )}
      {result && <p className="mb-4 text-emerald-400 text-sm">✓ {result}</p>}
      {error && <p className="mb-4 text-red-400 text-sm">{error}</p>}

      <div className="flex gap-2">
        <button onClick={loadPreview} disabled={loading}
          className="px-4 py-2 rounded-xl text-sm bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50">
          {loading && !preview ? "Duke llogaritur..." : "Shiko çfarë do të krijohet"}
        </button>
        {preview && preview.toCreate > 0 && (
          <button onClick={run} disabled={loading}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-500 hover:to-purple-500 disabled:opacity-50">
            {loading ? "Duke ekzekutuar..." : `Ekzekuto (${preview.toCreate})`}
          </button>
        )}
      </div>
    </div>
  );
}
