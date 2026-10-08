"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import ExportExcelButton from "@/components/ui/ExportExcelButton";
import { formatCurrency } from "@/lib/utils";
import { Vault, Loader2, CheckCircle2, AlertTriangle, Info, ShieldCheck, Lock } from "lucide-react";

// Mbyllja ditore e arkës (Faza 2 e auditimit). Gjendja sipas sistemit llogaritet
// në server: shuma e numëruar e mbylljes së kaluar + lëvizjet cash sipas datës
// reale (pagesat, të hyrat tjera, shpenzimet, dorëzimet, investimet).

type Kind = "PAGESA" | "HYRA" | "SHPENZIM" | "SHPENZIM_VJETER" | "DOREZIM" | "INVESTIM";
interface Preview {
  date: string;
  kind: "OPENING" | "DAILY";
  previous: { id: number; date: string; countedCents: number } | null;
  openingCents: number; inCents: number; outCents: number; lateCents: number; systemCents: number;
  byKind: Record<Kind, { inCents: number; outCents: number; count: number }>;
  late: { table: string; recordId: number | null; day: string; cents: number; kind: Kind; at: string; userName: string | null }[];
  noMethodPayments: number;
}
interface Closing {
  id: number; date: string; kind: string; systemCents: number; countedCents: number; diffCents: number;
  openingCents: number; inCents: number; outCents: number; lateCents: number;
  note: string | null; countedById: number | null; countedByName: string | null;
  verifiedByName: string | null; verifiedAt: string | null; verifyNote: string | null; createdAt: string;
}
interface Data {
  today: string; date: string; preview: Preview; closings: Closing[]; lastClosedDay: string | null;
  scope: { categoryIds: number[]; categoryNames: string[] };
}

const eur = (cents: number) => formatCurrency(cents / 100);
const ROWS: { kind: Kind; label: string; sign: 1 | -1 }[] = [
  { kind: "PAGESA", label: "Pagesa cash të nxënësve", sign: 1 },
  { kind: "HYRA", label: "Të hyra tjera cash", sign: 1 },
  { kind: "SHPENZIM", label: "Shpenzime të paguara nga arka", sign: -1 },
  { kind: "SHPENZIM_VJETER", label: "Shpenzime (skeda e vjetër)", sign: -1 },
  { kind: "DOREZIM", label: "Dorëzime parash", sign: -1 },
  { kind: "INVESTIM", label: "Investime nga arka", sign: -1 },
];
const fmtDay = (d: string) => d.split("-").reverse().join(".");

export default function ArkaPage() {
  const { data: session } = useSession();
  const me = parseInt((session?.user as { id?: string } | undefined)?.id ?? "") || null;
  const isSuperAdmin = (session?.user as { role?: string } | undefined)?.role === "SUPERADMIN";

  const [date, setDate] = useState("");
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [counted, setCounted] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [categories, setCategories] = useState<{ id: number; name: string }[]>([]);
  const [scopeIds, setScopeIds] = useState<number[]>([]);
  const [scopeMsg, setScopeMsg] = useState("");

  const load = useCallback(async (d: string) => {
    setLoading(true); setError("");
    try {
      const r = await fetch(`/api/arka/mbyllja${d ? `?date=${d}` : ""}`);
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Gabim");
      setData(j);
      setScopeIds(j.scope.categoryIds);
      if (!d) setDate(j.date);
    } catch (e) {
      setError(e instanceof Error ? e.message : "S'u ngarkua.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(""); }, [load]);
  useEffect(() => {
    if (isSuperAdmin) fetch("/api/categories").then(r => r.json()).then(setCategories).catch(() => {});
  }, [isSuperAdmin]);

  const p = data?.preview;
  const alreadyClosed = !!data?.lastClosedDay && !!date && date <= data.lastClosedDay;
  const countedNum = parseFloat(counted.replace(",", "."));
  const countedCents = Number.isFinite(countedNum) ? Math.round(countedNum * 100) : null;
  const diff = p && countedCents != null && p.kind === "DAILY" ? countedCents - p.systemCents : null;

  async function closeDay() {
    if (!p || countedCents == null || countedCents < 0) { setSaveError("Shkruani shumën e numëruar."); return; }
    const text = p.kind === "OPENING"
      ? `Hap arkën më ${fmtDay(date)} me gjendje fillestare ${eur(countedCents)}?`
      : `Mbyll arkën e ${fmtDay(date)}?\n\nSipas sistemit: ${eur(p.systemCents)}\nNumëruar: ${eur(countedCents)}\nDiferenca: ${eur(diff ?? 0)}\n\nÇdo ndryshim i mëvonshëm në paratë e kësaj dite do të shënohet si gjetje auditimi.`;
    if (!confirm(text)) return;
    setSaving(true); setSaveError("");
    try {
      const r = await fetch("/api/arka/mbyllja", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, counted: countedCents / 100, note }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `Gabim ${r.status}`);
      setCounted(""); setNote("");
      await load(date);
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : "Mbyllja dështoi.");
    } finally {
      setSaving(false);
    }
  }

  async function verify(c: Closing) {
    const v = window.prompt(`Verifiko mbylljen e ${fmtDay(c.date)} (numëroi ${c.countedByName ?? "—"}, ${eur(c.countedCents)}).\n\nShënim (opsional):`, "");
    if (v === null) return;
    const r = await fetch(`/api/arka/mbyllja/${c.id}/verifiko`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ note: v }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { alert(j.error || "Verifikimi dështoi."); return; }
    load(date);
  }

  async function saveScope() {
    setScopeMsg("");
    const r = await fetch("/api/arka/scope", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ categoryIds: scopeIds }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setScopeMsg(j.error || "Gabim"); return; }
    setScopeMsg("U ruajt.");
    load(date);
  }

  const columns = [
    { header: "Data", value: (c: Closing) => fmtDay(c.date) },
    { header: "Lloji", value: (c: Closing) => (c.kind === "OPENING" ? "Hapja" : "Mbyllje") },
    { header: "Nga dita e kaluar (€)", value: (c: Closing) => c.openingCents / 100 },
    { header: "Hyrje (€)", value: (c: Closing) => c.inCents / 100 },
    { header: "Dalje (€)", value: (c: Closing) => c.outCents / 100 },
    { header: "Sipas sistemit (€)", value: (c: Closing) => c.systemCents / 100 },
    { header: "Numëruar (€)", value: (c: Closing) => c.countedCents / 100 },
    { header: "Diferenca (€)", value: (c: Closing) => c.diffCents / 100 },
    { header: "Numëroi", value: (c: Closing) => c.countedByName ?? "" },
    { header: "Verifikoi", value: (c: Closing) => c.verifiedByName ?? "" },
    { header: "Shënim", value: (c: Closing) => [c.note, c.verifyNote].filter(Boolean).join(" · "), width: 30 },
  ];

  return (
    <>
      <Header title="Mbyllja e Arkës" />
      <div className="p-4 sm:p-6 space-y-5 animate-fade-in max-w-6xl">
        <div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Vault className="w-5 h-5 text-primary-500" /> Mbyllja ditore e arkës
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Arka përfshin: <b>{data?.scope.categoryNames.join(", ") || "—"}</b>
            {data?.lastClosedDay && <> · Mbyllja e fundit: <b>{fmtDay(data.lastClosedDay)}</b></>}
          </p>
        </div>

        {error && <p role="alert" className="text-red-600">{error}</p>}

        <section className="card p-4 sm:p-5 space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label htmlFor="arka-date" className="form-label">Dita</label>
              <input id="arka-date" type="date" className="form-input w-44" value={date} max={data?.today}
                onChange={e => { setDate(e.target.value); if (e.target.value) load(e.target.value); }} />
            </div>
            {loading && <Loader2 className="w-5 h-5 animate-spin text-primary-400 mb-2" aria-label="Duke ngarkuar" />}
          </div>

          {p && alreadyClosed && (
            <p className="flex items-center gap-2 text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/60 px-4 py-2.5">
              <Lock className="w-4 h-4 text-slate-500" aria-hidden /> Kjo ditë është e mbyllur. Zgjidhni një ditë pas {fmtDay(data!.lastClosedDay!)}.
            </p>
          )}

          {p && !alreadyClosed && p.kind === "OPENING" && (
            <div className="rounded-xl border border-blue-200 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-sm text-blue-900 dark:text-blue-200 space-y-1">
              <p className="font-semibold flex items-center gap-2"><Info className="w-4 h-4" aria-hidden /> Hapja e arkës — gjendja fillestare</p>
              <p>Kjo është mbyllja e parë. Numëroni paratë që janë tani në arkë dhe shkruani shumën. Nga kjo pikë, sistemi llogarit çdo ditë sa duhet të jenë në arkë.</p>
            </div>
          )}

          {p && !alreadyClosed && p.kind === "DAILY" && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm min-w-[480px]">
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                  <tr><td className="py-2">Numëruar në mbylljen e {fmtDay(p.previous!.date)}</td><td className="py-2 text-right font-semibold">{eur(p.openingCents)}</td></tr>
                  {ROWS.map(r => {
                    const k = p.byKind[r.kind];
                    const net = k.inCents - k.outCents;
                    if (k.count === 0) return null;
                    return (
                      <tr key={r.kind}>
                        <td className="py-2">{r.label} <span className="text-xs text-slate-400">({k.count})</span></td>
                        <td className={`py-2 text-right font-semibold ${net < 0 ? "text-red-700 dark:text-red-400" : "text-green-700 dark:text-green-400"}`}>{net >= 0 ? "+" : "−"}{eur(Math.abs(net))}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-slate-50 dark:bg-slate-800/60">
                    <td className="py-2.5 px-2 font-bold">Duhet të jenë në arkë (sipas sistemit)</td>
                    <td className="py-2.5 px-2 text-right text-lg font-extrabold">{eur(p.systemCents)}</td>
                  </tr>
                </tbody>
              </table>
              {p.late.length > 0 && (
                <div className="mt-3 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-4 py-3 text-sm text-amber-900 dark:text-amber-200">
                  <p className="font-semibold flex items-center gap-2"><AlertTriangle className="w-4 h-4" aria-hidden /> Regjistrime të vonuara për ditë të mbyllura ({p.late.length}) — neto {eur(p.lateCents)}</p>
                  <ul className="mt-1 space-y-0.5">
                    {p.late.slice(0, 20).map((l, i) => (
                      <li key={i}>{fmtDay(l.day)} · {ROWS.find(r => r.kind === l.kind)?.label ?? l.kind} #{l.recordId ?? "—"} · {l.cents >= 0 ? "+" : "−"}{eur(Math.abs(l.cents))} · regjistruar nga {l.userName ?? "—"}</li>
                    ))}
                  </ul>
                </div>
              )}
              {p.noMethodPayments > 0 && (
                <p className="mt-3 text-sm text-amber-800 dark:text-amber-300 flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" aria-hidden /> {p.noMethodPayments} pagesa pa metodë në këtë periudhë — s'hyjnë në arkë derisa t&apos;u caktohet metoda.
                </p>
              )}
            </div>
          )}

          {p && !alreadyClosed && (
            <div className="grid sm:grid-cols-3 gap-3 items-end">
              <div>
                <label htmlFor="arka-counted" className="form-label">{p.kind === "OPENING" ? "Gjendja fillestare e numëruar (€)" : "Shuma e numëruar (€)"}</label>
                <input id="arka-counted" inputMode="decimal" className="form-input" value={counted} onChange={e => setCounted(e.target.value)} placeholder="0,00" />
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="arka-note" className="form-label">Shënim (opsional)</label>
                <input id="arka-note" className="form-input" value={note} onChange={e => setNote(e.target.value)} maxLength={1000} />
              </div>
              {diff != null && (
                <p className={`sm:col-span-3 text-sm font-semibold ${diff === 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>
                  {diff === 0 ? "Arka përputhet." : diff < 0 ? `Mungojnë ${eur(-diff)}` : `Tepër ${eur(diff)}`}
                  {diff !== 0 && <span className="font-normal text-slate-500"> — do të krijohet gjetje auditimi.</span>}
                </p>
              )}
              {saveError && <p role="alert" className="sm:col-span-3 text-sm text-red-600">{saveError}</p>}
              <div className="sm:col-span-3 flex justify-end">
                <button type="button" onClick={closeDay} disabled={saving || countedCents == null} className="btn-primary">
                  {saving && <Loader2 className="w-4 h-4 animate-spin" />} {p.kind === "OPENING" ? "Hap arkën" : `Mbyll ditën ${fmtDay(date)}`}
                </button>
              </div>
            </div>
          )}
        </section>

        <section className="card overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-2 p-4 border-b border-slate-100 dark:border-slate-700">
            <h2 className="font-bold text-slate-900 dark:text-white">Mbylljet</h2>
            <ExportExcelButton<Closing> fileName="Mbylljet-e-arkes" rows={data?.closings ?? []} columns={columns} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[860px]">
              <thead>
                <tr className="text-left text-xs uppercase text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60">
                  <th className="px-4 py-2.5">Data</th><th className="px-4 py-2.5 text-right">Sipas sistemit</th><th className="px-4 py-2.5 text-right">Numëruar</th>
                  <th className="px-4 py-2.5 text-right">Diferenca</th><th className="px-4 py-2.5">Numëroi</th><th className="px-4 py-2.5">Verifikoi</th><th className="px-4 py-2.5">Shënim</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                {(data?.closings ?? []).length === 0 && <tr><td colSpan={7} className="px-4 py-8 text-center text-slate-500">Ende s&apos;ka asnjë mbyllje.</td></tr>}
                {(data?.closings ?? []).map(c => (
                  <tr key={c.id}>
                    <td className="px-4 py-2.5 whitespace-nowrap">{fmtDay(c.date)}{c.kind === "OPENING" && <span className="ml-1.5 text-[11px] px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300">Hapja</span>}</td>
                    <td className="px-4 py-2.5 text-right">{eur(c.systemCents)}</td>
                    <td className="px-4 py-2.5 text-right font-semibold">{eur(c.countedCents)}</td>
                    <td className={`px-4 py-2.5 text-right font-bold ${c.diffCents === 0 ? "text-green-700 dark:text-green-400" : "text-red-700 dark:text-red-400"}`}>{c.diffCents === 0 ? "0,00 €" : `${c.diffCents > 0 ? "+" : "−"}${eur(Math.abs(c.diffCents))}`}</td>
                    <td className="px-4 py-2.5">{c.countedByName ?? "—"}</td>
                    <td className="px-4 py-2.5">
                      {c.verifiedAt
                        ? <span className="inline-flex items-center gap-1 text-green-700 dark:text-green-400"><CheckCircle2 className="w-4 h-4" aria-hidden />{c.verifiedByName ?? "—"}</span>
                        : c.countedById !== me
                          ? <button type="button" onClick={() => verify(c)} className="btn-secondary text-xs py-1"><ShieldCheck className="w-3.5 h-3.5" /> Verifiko</button>
                          : <span className="text-xs text-amber-700 dark:text-amber-400">Pret verifikimin nga dikush tjetër</span>}
                    </td>
                    <td className="px-4 py-2.5 text-xs text-slate-500">{[c.note, c.verifyNote].filter(Boolean).join(" · ") || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        {isSuperAdmin && categories.length > 0 && (
          <section className="card p-4 space-y-3">
            <h2 className="font-bold text-slate-900 dark:text-white">Cilat pagesa hyjnë në këtë arkë (vetëm Super Admin)</h2>
            <p className="text-sm text-slate-500">Parazgjedhje: vetëm Shkollimi (si te &quot;Numëro arkën&quot;). Shpenzimet, të hyrat tjera dhe investimet llogariten kur përfshihet Shkollimi.</p>
            <div className="flex flex-wrap gap-2">
              {categories.map(c => (
                <label key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-3 py-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={scopeIds.includes(c.id)}
                    onChange={() => setScopeIds(s => (s.includes(c.id) ? s.filter(x => x !== c.id) : [...s, c.id]))} />
                  {c.name}
                </label>
              ))}
            </div>
            <div className="flex items-center gap-3">
              <button type="button" onClick={saveScope} className="btn-secondary text-sm">Ruaj</button>
              {scopeMsg && <span className="text-sm text-slate-600 dark:text-slate-300">{scopeMsg}</span>}
            </div>
          </section>
        )}
      </div>
    </>
  );
}
