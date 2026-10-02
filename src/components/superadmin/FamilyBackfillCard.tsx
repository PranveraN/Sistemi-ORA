"use client";

import { useState } from "react";

interface Preview {
  studentsWithoutFamily: number;
  familiesToCreate: number;
  multiChild: number;
  withoutPhone: number;
  conflicts: { phone: string; students: string[] }[];
  suggestions: { key: string; parentNames: string[]; groups: { students: string[]; phones: string }[] }[];
}

// Lidhja fillestare e familjeve — pamje paraprake, pastaj ekzekutim. Bashkimet
// sipas emrit dalin TË PAZGJEDHURA: bëhen vetëm ato që zgjidhni ju.
export default function FamilyBackfillCard() {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState("");
  const [error, setError] = useState("");

  async function load() {
    setLoading(true); setError(""); setResult("");
    try {
      const r = await fetch("/api/superadmin/family-backfill");
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Ngarkimi dështoi."); return; }
      setPreview(d); setAccepted(new Set());
    } catch { setError("Gabim rrjeti — provo përsëri."); }
    finally { setLoading(false); }
  }

  async function run() {
    if (!preview) return;
    if (!confirm(`Të krijohen familjet për ${preview.studentsWithoutFamily} nxënës, me ${accepted.size} bashkime sipas emrit?`)) return;
    setLoading(true); setError("");
    try {
      const r = await fetch("/api/superadmin/family-backfill", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accept: [...accepted] }) });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Ekzekutimi dështoi."); return; }
      setResult(`U krijuan ${d.created} familje (${d.merged} bashkime sipas emrit).`);
      setPreview(null);
    } catch { setError("Gabim rrjeti — provo përsëri."); }
    finally { setLoading(false); }
  }

  const toggle = (k: string) => setAccepted(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n; });

  return (
    <div className="mt-8 bg-white/[0.03] border border-white/[0.07] rounded-2xl p-6">
      <h2 className="font-semibold text-sm mb-1 flex items-center gap-2">
        <span className="w-6 h-6 rounded-lg bg-violet-500/20 flex items-center justify-center text-xs">👪</span>
        Lidh nxënësit me familjet
      </h2>
      <p className="text-gray-500 text-xs mb-4">
        Krijon familjet për nxënësit pa familje, sipas telefonit të prindit (numri lidh vetëm kur përputhet edhe mbiemri ose prindi).
        Bashkimet sipas emrit bëhen vetëm për rastet që zgjidhni. Mund të përsëritet pa dyfishim.
      </p>
      {preview && (
        <div className="mb-4 space-y-3 text-sm">
          <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
            <p>Nxënës pa familje: <b>{preview.studentsWithoutFamily}</b> → familje: <b>{preview.familiesToCreate}</b> (me 2+ fëmijë aktivë: {preview.multiChild})</p>
            <p className="text-gray-500 text-xs">Pa asnjë telefon: {preview.withoutPhone} — secili mbetet familje më vete, përveç kur e bashkoni më poshtë.</p>
          </div>
          {preview.conflicts.length > 0 && (
            <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs">
              <p className="text-amber-300 font-medium mb-1">Numra që lidhnin familje të ndryshme — mbahen të ndara (korrigjoni numrin te nxënësi):</p>
              {preview.conflicts.map(c => <p key={c.phone} className="text-gray-400">• {c.phone}: {c.students.join(" · ")}</p>)}
            </div>
          )}
          {preview.suggestions.length > 0 && (
            <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06] space-y-2">
              <p className="text-xs text-gray-400">Bashkime të sugjeruara sipas emrit të prindit — zgjidhni vetëm ato që janë e njëjta familje:</p>
              {preview.suggestions.map(s => (
                <label key={s.key} className="flex items-start gap-2 text-xs cursor-pointer">
                  <input type="checkbox" className="mt-0.5" checked={accepted.has(s.key)} onChange={() => toggle(s.key)} />
                  <span>
                    <span className="text-gray-200 font-medium">{s.parentNames.join(" / ")}</span>
                    {s.groups.map((g, i) => <span key={i} className="block text-gray-400">• {g.students.join(" + ")} <span className="text-gray-600">({g.phones})</span></span>)}
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}
      {result && <p className="mb-4 text-emerald-400 text-sm">✓ {result}</p>}
      {error && <p className="mb-4 text-red-400 text-sm">{error}</p>}
      <div className="flex gap-2">
        <button onClick={load} disabled={loading} className="px-4 py-2 rounded-xl text-sm bg-white/5 hover:bg-white/10 border border-white/10 disabled:opacity-50">
          {loading && !preview ? "Duke llogaritur..." : "Shiko çfarë do të krijohet"}
        </button>
        {preview && preview.studentsWithoutFamily > 0 && (
          <button onClick={run} disabled={loading} className="px-4 py-2 rounded-xl text-sm font-medium bg-gradient-to-r from-violet-600 to-purple-600 disabled:opacity-50">
            {loading ? "Duke ekzekutuar..." : `Ekzekuto (${accepted.size} bashkime)`}
          </button>
        )}
      </div>
    </div>
  );
}
