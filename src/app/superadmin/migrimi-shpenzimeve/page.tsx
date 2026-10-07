"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, CheckCircle2, AlertTriangle, Printer } from "lucide-react";

// Faza 2 — migrimi i shpenzimeve të Shkollimit në një libër të vetëm.
// Hapi 1: pamja paraprake (asgjë s'ndryshon). Hapi 2: ekzekutimi, me backup automatik.

const eur = (v: number) => new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
const dmy = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`;

interface Totals { totals: { count: number; total: number; cash: number; bank: number; unpaid: number; ushqimi: number }; months: { month: string; count: number; total: number; cash: number; bank: number; unpaid: number }[] }
interface Arka { viti: string; paguar: number; teHyraTjeraCash: number; shpenzuarNgaArka: number; dorezuar: number; neArke: number }
interface Preview {
  legacy: { id: number; day: string; amount: number; description: string | null; recipient: string | null; method: string | null; reference: string | null; matches: { id: number; description: string | null; category: string | null; certain: boolean }[] }[];
  alreadyMigrated: number;
  categories: { id: number; name: string; fusha: string; count: number; suggestedFood: boolean }[];
  targetCategory: string;
  before: Totals;
  arka: Arka | null;
}
interface Result { created: number; linked: number; relinked: number; fushaChanged: number; legacyCount: number; backup: { filename: string; path: string }; before: Totals; after: Totals; arkaBefore: Arka | null; arkaAfter: Arka | null }

export default function ExpenseMigrationPage() {
  const [p, setP] = useState<Preview | null>(null);
  const [error, setError] = useState("");
  const [links, setLinks] = useState<Record<number, string>>({});
  const [food, setFood] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  async function load() {
    setError("");
    const r = await fetch("/api/superadmin/expense-migration");
    const d = await r.json();
    if (!r.ok) { setError(d.error || "Gabim"); return; }
    setP(d);
    // Parazgjedhje: kategoritë e shënuara tashmë "Ushqimi", ose që duken si ushqim — ju i ndryshoni
    setFood(new Set((d as Preview).categories.filter(c => c.fusha === "USHQIMI" || c.suggestedFood).map(c => c.id)));
    // Dyfishimet "të sigurta" sugjerohen për lidhje; "të mundshmet" mbeten "kopjo" derisa t'i zgjidhni
    const l: Record<number, string> = {};
    for (const row of (d as Preview).legacy) { const c = row.matches.find(m => m.certain); l[row.id] = c ? String(c.id) : ""; }
    setLinks(l);
  }
  useEffect(() => { load(); }, []);

  async function run() {
    if (!p) return;
    const nFood = food.size, nLink = Object.values(links).filter(Boolean).length;
    if (!confirm(`Ekzekuto migrimin?\n\n• ${p.legacy.length - nLink} shpenzime kopjohen te moduli i vetëm\n• ${nLink} dyfishime lidhen me shpenzimin ekzistues\n• ${nFood} kategori shënohen "Ushqimi"\n\nBëhet backup i plotë para çdo ndryshimi. Asgjë s'fshihet.`)) return;
    setBusy(true); setError("");
    try {
      const linkDuplicates: Record<number, number> = {};
      for (const [k, v] of Object.entries(links)) if (v) linkDuplicates[+k] = +v;
      const r = await fetch("/api/superadmin/expense-migration", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "MIGRO", linkDuplicates, foodCategoryIds: [...food] }),
      });
      const d = await r.json();
      if (!r.ok) { setError(d.error || "Migrimi dështoi."); return; }
      setResult(d);
    } finally { setBusy(false); }
  }

  if (error && !p) return <p className="p-8 text-red-600">{error}</p>;
  if (!p) return <p className="p-8 flex items-center gap-2 text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Duke përgatitur pamjen paraprake…</p>;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-8 text-sm text-slate-800 dark:text-slate-100 bg-white dark:bg-slate-900 min-h-screen">
      <header className="flex flex-wrap justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">Migrimi i shpenzimeve të Shkollimit — Faza 2</h1>
          <p className="text-slate-500 mt-1">Shpenzimet e skedës së vjetër bashkohen me modulin &quot;Shpenzimet&quot; (një libër i vetëm). Asgjë s&apos;fshihet; para ekzekutimit bëhet backup i plotë.</p>
        </div>
        <div className="flex gap-2 print:hidden">
          <Link href="/superadmin/auditimi-shpenzimeve" className="btn-secondary text-sm">Auditimi (Faza 1)</Link>
          <button type="button" onClick={() => window.print()} className="btn-secondary text-sm"><Printer className="w-4 h-4" /> Printo / PDF</button>
        </div>
      </header>

      {result ? <ResultView r={result} /> : (
        <>
          <section className="space-y-2">
            <h2 className="text-lg font-bold">1. Shpenzimet e skedës së vjetër që bartën ({p.legacy.length})</h2>
            <p className="text-slate-500">Të migruara më parë: {p.alreadyMigrated}. Të rejat shkojnë te kategoria <b>{p.targetCategory}</b>, me &quot;Paguar&quot; dhe metodën e tyre (bosh → Cash). Kur një rresht ekziston tashmë te moduli, zgjidhni &quot;Lidhe me…&quot; që të mos dyfishohet.</p>
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
              <table className="w-full text-sm">
                <thead><tr className="bg-slate-50 dark:bg-slate-800 text-left text-xs uppercase text-slate-500"><th className="px-3 py-2">ID</th><th className="px-3 py-2">Data</th><th className="px-3 py-2">Përshkrimi</th><th className="px-3 py-2">Metoda</th><th className="px-3 py-2 text-right">Shuma</th><th className="px-3 py-2">Veprimi</th></tr></thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  {p.legacy.length === 0 ? <tr><td colSpan={6} className="px-3 py-4 text-slate-500">S&apos;ka asnjë shpenzim për të bartur — skeda e vjetër është bosh ose e migruar.</td></tr>
                    : p.legacy.map(r => (
                      <tr key={r.id}>
                        <td className="px-3 py-1.5">{r.id}</td><td className="px-3 py-1.5 whitespace-nowrap">{dmy(r.day)}</td>
                        <td className="px-3 py-1.5">{r.description ?? "—"}{r.recipient ? ` · ${r.recipient}` : ""}</td>
                        <td className="px-3 py-1.5">{r.method ?? "pa metodë"}</td><td className="px-3 py-1.5 text-right">{eur(r.amount)}</td>
                        <td className="px-3 py-1.5">
                          <select value={links[r.id] ?? ""} onChange={e => setLinks(l => ({ ...l, [r.id]: e.target.value }))} className="form-input py-1 text-sm" aria-label={`Veprimi për rreshtin ${r.id}`}>
                            <option value="">Kopjo te moduli</option>
                            {r.matches.map(m => <option key={m.id} value={m.id}>Lidhe me #{m.id} ({m.certain ? "dyfishim i sigurt" : "i mundshëm"}: {m.description ?? m.category ?? "—"})</option>)}
                          </select>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold">2. Kategoritë e Ushqimit</h2>
            <p className="text-slate-500">Kategoritë e shënuara këtu mbeten në modul, por <b>nuk zbriten nga arka e Shkollimit</b> (i takojnë Ushqimit). Të shënuarat paraprakisht janë vetëm sugjerim sipas emrit — kontrollojini. Kjo mund të ndryshohet edhe më vonë te Shkollimi → Shpenzime → Kategoritë.</p>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
              {p.categories.map(c => (
                <label key={c.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 cursor-pointer ${food.has(c.id) ? "border-amber-400 bg-amber-50 dark:bg-amber-950/30" : "border-slate-200 dark:border-slate-700"}`}>
                  <input type="checkbox" checked={food.has(c.id)} onChange={() => setFood(s => { const n = new Set(s); if (n.has(c.id)) n.delete(c.id); else n.add(c.id); return n; })} />
                  <span className="flex-1">{c.name} <span className="text-slate-500">({c.count})</span></span>
                  {c.suggestedFood && <span className="text-[11px] text-amber-700">sugjerim</span>}
                </label>
              ))}
            </div>
          </section>

          <section className="space-y-2">
            <h2 className="text-lg font-bold">3. Gjendja para migrimit</h2>
            <TotalsTable t={p.before} />
            {p.arka && <ArkaTable before={p.arka} />}
          </section>

          {error && <p role="alert" className="text-red-600">{error}</p>}
          <div className="flex justify-end print:hidden">
            <button type="button" onClick={run} disabled={busy} className="btn-primary">
              {busy && <Loader2 className="w-4 h-4 animate-spin" />} Bëj backup dhe ekzekuto migrimin
            </button>
          </div>
        </>
      )}
    </div>
  );
}

function ResultView({ r }: { r: Result }) {
  const diff = Math.round((r.before.totals.total - r.after.totals.total) * 100) / 100;
  return (
    <section className="space-y-5">
      <p className="flex items-start gap-2 rounded-xl border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900 p-4 text-green-900 dark:text-green-200">
        <CheckCircle2 className="w-5 h-5 shrink-0" />
        <span>Migrimi përfundoi: <b>{r.created}</b> të kopjuara, <b>{r.linked}</b> dyfishime të lidhura, <b>{r.relinked}</b> të rilidhura, <b>{r.fushaChanged}</b> kategori me fushë të re.<br />
          Backup: <code>{r.backup.path}</code></span>
      </p>
      {diff !== 0 && (
        <p className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 p-4 text-amber-900 dark:text-amber-200">
          <AlertTriangle className="w-5 h-5 shrink-0" /> Totali ndryshoi me {eur(diff)} — duhet të jetë e barabartë me shumën e dyfishimeve që u lidhën (s&apos;numërohen më dy herë).
        </p>
      )}
      <div className="grid lg:grid-cols-2 gap-4">
        <div><h3 className="font-bold mb-1">Para</h3><TotalsTable t={r.before} /></div>
        <div><h3 className="font-bold mb-1">Pas</h3><TotalsTable t={r.after} /></div>
      </div>
      {r.arkaBefore && <ArkaTable before={r.arkaBefore} after={r.arkaAfter} />}
      <p className="text-slate-500">Kthimi i gjendjes së vjetër: ndaloni aplikacionin dhe zëvendësoni databazën me skedarin e backup-it më sipër (shih udhëzimin te raporti).</p>
    </section>
  );
}

function TotalsTable({ t }: { t: Totals }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead><tr className="bg-slate-50 dark:bg-slate-800 text-left text-xs uppercase text-slate-500"><th className="px-3 py-2">Muaji</th><th className="px-3 py-2">Rreshta</th><th className="px-3 py-2">Totali</th><th className="px-3 py-2">Cash</th><th className="px-3 py-2">Bankë</th><th className="px-3 py-2">Pa paguar</th></tr></thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          <tr className="font-bold"><td className="px-3 py-1.5">Gjithsej</td><td className="px-3 py-1.5">{t.totals.count}</td><td className="px-3 py-1.5">{eur(t.totals.total)}</td><td className="px-3 py-1.5">{eur(t.totals.cash)}</td><td className="px-3 py-1.5">{eur(t.totals.bank)}</td><td className="px-3 py-1.5">{eur(t.totals.unpaid)}</td></tr>
          {t.months.map(m => <tr key={m.month}><td className="px-3 py-1.5">{m.month.slice(5)}/{m.month.slice(0, 4)}</td><td className="px-3 py-1.5">{m.count}</td><td className="px-3 py-1.5">{eur(m.total)}</td><td className="px-3 py-1.5">{eur(m.cash)}</td><td className="px-3 py-1.5">{eur(m.bank)}</td><td className="px-3 py-1.5">{eur(m.unpaid)}</td></tr>)}
        </tbody>
      </table>
      <p className="px-3 py-1.5 text-xs text-slate-500">Përfshin edhe kategoritë e Ushqimit ({eur(t.totals.ushqimi)}) që të krahasohet saktë para/pas.</p>
    </div>
  );
}

function ArkaTable({ before, after }: { before: Arka; after?: Arka | null }) {
  const rows: [string, keyof Arka][] = [["Paguar", "paguar"], ["Të hyra tjera cash", "teHyraTjeraCash"], ["Shpenzuar nga arka", "shpenzuarNgaArka"], ["Dorëzuar", "dorezuar"], ["Në arkë", "neArke"]];
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
      <table className="w-full text-sm">
        <thead><tr className="bg-slate-50 dark:bg-slate-800 text-left text-xs uppercase text-slate-500"><th className="px-3 py-2">Arka {before.viti}</th><th className="px-3 py-2">Para</th>{after && <th className="px-3 py-2">Pas</th>}</tr></thead>
        <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
          {rows.map(([l, k]) => <tr key={k}><td className="px-3 py-1.5">{l}</td><td className="px-3 py-1.5">{eur(before[k] as number)}</td>{after && <td className="px-3 py-1.5">{eur(after[k] as number)}</td>}</tr>)}
        </tbody>
      </table>
    </div>
  );
}
