"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { Loader2, Merge, Undo2 } from "lucide-react";

// Moduli TIMI INVEST → Dyfishimet (Faza 4). Shikim paraprak: çka mbahet, çka bashkohet.
// Bashkimi = rreshti i dytë çaktivizohet dhe shënohet "bashkuar me" — s'fshihet, mund të kthehet.
// Pagesat janë te nxënësi (jo te lidhja TIMI), ndaj asnjë pagesë s'preket.

interface L { id: number; emri: string; prindi: string; studentId: number | null; stage: string; cmimi: number; regularPrice: number; discountPct: number; notes: string | null; createdAt: string; profaturat: string[] }
interface B { id: number; emri: string; prindi: string; bashkuarMe: number | null; bashkuarAt: string | null }
const FAZA: Record<string, string> = { PROFATURE: "Profaturë", NE_PROCES: "Në proces", KRYER: "E kryer", PEZULLUAR: "Pezulluar", ANULUAR: "Anuluar" };
const rendi = (s: string) => ({ KRYER: 3, NE_PROCES: 2, PROFATURE: 1 } as Record<string, number>)[s] ?? 0;

export default function DyfishimetPage() {
  const [grupet, setGrupet] = useState<L[][] | null>(null);
  const [bashkuar, setBashkuar] = useState<B[]>([]);
  const [mbaj, setMbaj] = useState<Record<number, number>>({});
  const [busy, setBusy] = useState(false);

  const load = useCallback(() => {
    fetch("/api/timi-invest/dyfishime").then(r => r.json()).then(d => {
      setGrupet(d.grupet ?? []); setBashkuar(d.bashkuar ?? []);
      // Propozimi: mbahet ai me fazën më të avancuar, pastaj më i vjetri
      const m: Record<number, number> = {};
      (d.grupet ?? []).forEach((g: L[], i: number) => { m[i] = [...g].sort((a, b) => rendi(b.stage) - rendi(a.stage) || a.id - b.id)[0].id; });
      setMbaj(m);
    });
  }, []);
  useEffect(() => { load(); }, [load]);

  async function bashko(i: number, g: L[]) {
    const keep = g.find(x => x.id === mbaj[i])!;
    const tjeret = g.filter(x => x.id !== keep.id);
    const a = window.prompt(`Mbahet: ${keep.emri} (#${keep.id}, ${FAZA[keep.stage] ?? keep.stage}, ${formatCurrency(keep.cmimi)})\nBashkohet (çaktivizohet, s'fshihet): ${tjeret.map(t => `#${t.id}`).join(", ")}\n\nArsyeja (e detyrueshme):`, "Dyfishim i lidhjes TIMI");
    if (a === null || a.trim().length < 3) return;
    setBusy(true);
    const r = await fetch("/api/timi-invest/dyfishime", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ mbaj: keep.id, bashko: tjeret.map(t => t.id), arsye: a.trim() }) });
    setBusy(false);
    if (!r.ok) { alert((await r.json().catch(() => ({}))).error || "Bashkimi dështoi."); return; }
    load();
  }
  async function ndaj(b: B) {
    const a = window.prompt(`Ktheje ${b.emri} (#${b.id}) si rresht aktiv?\n\nArsyeja:`);
    if (a === null || a.trim().length < 3) return;
    setBusy(true);
    const r = await fetch("/api/timi-invest/dyfishime", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ndaj: b.id, arsye: a.trim() }) });
    setBusy(false);
    if (!r.ok) { alert((await r.json().catch(() => ({}))).error || "Veprimi dështoi."); return; }
    load();
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="page-title">Dyfishimet e lidhjeve TIMI</h1>
        <p className="text-xs text-slate-500">I njëjti nxënës i lidhur dy herë me TIMI. Zgjidhni cili mbetet — tjetri çaktivizohet dhe shënohet &quot;i bashkuar&quot; (s&apos;fshihet, mund të kthehet). Pagesat s&apos;preken: ato janë te nxënësi.</p>
      </div>
      {!grupet ? <div className="card p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>
        : grupet.length === 0 ? <div className="card p-6 text-sm text-center text-emerald-700">✓ S&apos;ka dyfishime.</div>
        : grupet.map((g, i) => (
          <div key={i} className="card overflow-hidden">
            <div className="px-4 py-2.5 flex items-center justify-between border-b border-slate-100 dark:border-slate-700">
              <span className="font-semibold">{g[0].emri} <span className="text-xs text-slate-400 font-normal">· {g.length} lidhje</span></span>
              <button disabled={busy} onClick={() => bashko(i, g)} className="btn-primary !py-1.5 !text-xs"><Merge className="w-3.5 h-3.5" />Bashko</button>
            </div>
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60">
                <tr><th className="px-3 py-2 text-left">Mbahet</th><th className="px-3 py-2 text-left">#</th><th className="px-3 py-2 text-left">Prindi</th><th className="px-3 py-2 text-right">Çmimi</th><th className="px-3 py-2 text-left">Faza</th><th className="px-3 py-2 text-left">Profaturat</th><th className="px-3 py-2 text-left">Krijuar</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {g.map(l => (
                  <tr key={l.id} className={mbaj[i] === l.id ? "bg-emerald-50/60 dark:bg-emerald-900/10" : "text-slate-500"}>
                    <td className="px-3 py-2"><input type="radio" name={`g${i}`} checked={mbaj[i] === l.id} onChange={() => setMbaj({ ...mbaj, [i]: l.id })} /> {mbaj[i] === l.id ? "mbahet" : "bashkohet"}</td>
                    <td className="px-3 py-2"><Link href={`/timi-invest/femijet/${l.id}`} className="text-primary-600 hover:underline">#{l.id}</Link></td>
                    <td className="px-3 py-2">{l.prindi}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatCurrency(l.cmimi)}{l.discountPct ? <span className="text-xs text-slate-400"> (−{l.discountPct}%)</span> : null}</td>
                    <td className="px-3 py-2">{FAZA[l.stage] ?? l.stage}</td>
                    <td className="px-3 py-2 text-xs">{l.profaturat.join(", ") || "—"}</td>
                    <td className="px-3 py-2 text-xs">{formatDate(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {new Set(g.map(l => l.cmimi)).size > 1 && <p className="px-4 py-2 text-xs text-amber-700 dark:text-amber-300 bg-amber-50/60 dark:bg-amber-900/10">Kujdes: çmimet ndryshojnë — mbani rreshtin me çmimin e saktë të marrëveshjes.</p>}
          </div>
        ))}

      {bashkuar.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-2.5 font-semibold border-b border-slate-100 dark:border-slate-700">Të bashkuara më parë</div>
          <table className="w-full text-sm">
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
              {bashkuar.map(b => (
                <tr key={b.id}>
                  <td className="px-3 py-2">{b.emri} <span className="text-xs text-slate-400">#{b.id} · {b.prindi}</span></td>
                  <td className="px-3 py-2 text-xs text-slate-500">bashkuar me <Link href={`/timi-invest/femijet/${b.bashkuarMe}`} className="text-primary-600 hover:underline">#{b.bashkuarMe}</Link>{b.bashkuarAt ? ` · ${formatDate(b.bashkuarAt)}` : ""}</td>
                  <td className="px-3 py-2 text-right"><button disabled={busy} onClick={() => ndaj(b)} className="btn-secondary !py-1 !px-2 !text-xs inline-flex"><Undo2 className="w-3.5 h-3.5" />Ktheje</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
