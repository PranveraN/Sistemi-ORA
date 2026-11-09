"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import Header from "@/components/layout/Header";
import { Loader2, CheckCircle2, AlertTriangle, Wand2, Undo2, FileText } from "lucide-react";
import { eur, dmy, STATUSI_EK, MuajtChips, LevizjetTable, type MuajStatus, type Zer, type Levizje } from "@/components/banka/shared";

// Viti kalendarik "i hapur" i një llogarie: të gjitha ngarkimet bashkë, muajt, vazhdimësia
// ("Mungon: data – data") dhe importi i rreshtave të rinj.

interface Ngarkim {
  id: number; emriSkedarit: string | null; statusi: string; periudhaNga: string | null; periudhaDeri: string | null;
  ngaVit: string; deriVit: string; rreshta: number; importuar: number; createdAt: string;
}
interface Viti {
  llogaria: string; viti: number; nga: string | null; deri: string | null; fillestare: number | null; perfundimtare: number | null;
  rreshta: number; kredi: number; debi: number; paZe: number; paImportuar: number; importuar: number;
  muajt: MuajStatus[]; mungojne: { nga: string; deri: string; diferenca: number; pas: string; para: string }[];
  ngarkimet: Ngarkim[]; levizjet: Levizje[];
}

export default function VitiPage() {
  const { llogaria, viti } = useParams<{ llogaria: string; viti: string }>();
  const [d, setD] = useState<Viti | null>(null);
  const [zerat, setZerat] = useState<Zer[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([fetch(`/api/banka/vitet/${llogaria}/${viti}`), fetch("/api/banka/zerat")]);
    if (a.ok) setD(await a.json()); else setErr((await a.json().catch(() => ({}))).error || "Viti s'u gjet.");
    if (b.ok) setZerat(await b.json());
  }, [llogaria, viti]);
  useEffect(() => { load(); }, [load]);

  async function veprim(veprimi: string, pyetja?: string) {
    if (pyetja && !confirm(pyetja)) return;
    setBusy(veprimi);
    const r = await fetch(`/api/banka/vitet/${llogaria}/${viti}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ veprimi }) });
    const res = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { alert(res.error || "Veprimi dështoi."); return; }
    if (veprimi === "IMPORTO") alert(`${res.importuar} rreshta u importuan në bilanc.${res.dyfisht ? ` ${res.dyfisht} ishin tashmë të importuar nga një ngarkim tjetër (dyfisht).` : ""}`);
    if (veprimi === "RIKLASIFIKO") alert(`${res.ndryshuar} rreshta morën zë të ri sipas rregullave.`);
    load();
  }

  if (!d) return <div><Header title={`Banka – ${viti}`} backHref="/banka" /><div className="p-10 text-center text-slate-400 text-sm">{err ?? "Duke ngarkuar…"}</div></div>;

  const kontrolli = d.fillestare != null && d.perfundimtare != null && d.fillestare + d.kredi - d.debi === d.perfundimtare && d.mungojne.length === 0;

  return (
    <div>
      <Header title={`Banka – ${d.viti}`} backHref="/banka" />
      <div className="p-4 sm:p-6 space-y-4">
        <div className="card p-5 space-y-4">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-[260px]">
              <h2 className="text-2xl font-extrabold text-slate-900 dark:text-white">{d.viti}</h2>
              <p className="text-sm text-slate-500">Llogaria {d.llogaria} · rreshtat {dmy(d.nga)} – {dmy(d.deri)} · {d.ngarkimet.length} ngarkim{d.ngarkimet.length === 1 ? "" : "e"}</p>
              <div className="mt-2"><MuajtChips muajt={d.muajt} /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {d.paImportuar > 0 && (
                <button onClick={() => veprim("IMPORTO", `Të importoj ${d.paImportuar} rreshtat e rinj të ${d.viti}? Hyjnë në bilanc${d.paZe ? ` (${d.paZe} pa zë — mund t'i klasifikosh edhe më vonë)` : ""}.`)} disabled={!!busy} className="btn-primary">
                  {busy === "IMPORTO" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Importo {d.paImportuar} rreshta
                </button>
              )}
              <button onClick={() => veprim("RIKLASIFIKO")} disabled={!!busy} className="btn-secondary" title="Zbaton rregullat te rreshtat që s'i ke zgjedhur me dorë">
                {busy === "RIKLASIFIKO" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Rizbato rregullat
              </button>
              {d.importuar > 0 && (
                <button onClick={() => veprim("KTHE_NE_DRAFT", `Ta nxjerr gjithë ${d.viti} nga bilanci (${d.importuar} rreshta)? Asgjë s'fshihet.`)} disabled={!!busy} className="btn-secondary">
                  <Undo2 className="w-4 h-4" /> Kthe në draft
                </button>
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
            <Box t="Gjendja në fillim" v={eur(d.fillestare)} />
            <Box t={`Hyrje`} v={eur(d.kredi)} c="text-emerald-700" />
            <Box t={`Dalje`} v={eur(d.debi)} c="text-rose-700" />
            <Box t="Gjendja në fund" v={eur(d.perfundimtare)} />
            <div className={`rounded-lg p-3 ${kontrolli ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-rose-50 dark:bg-rose-900/20"}`}>
              <p className="text-xs text-slate-500">Vazhdimësia me bankën</p>
              <p className={`font-bold flex items-center gap-1 ${kontrolli ? "text-emerald-700" : "text-rose-700"}`}>
                {kontrolli ? <><CheckCircle2 className="w-4 h-4" /> Pa boshllëqe</> : <><AlertTriangle className="w-4 h-4" /> Mungojnë data</>}
              </p>
            </div>
          </div>

          {d.mungojne.length > 0 && (
            <div className="rounded-lg p-3 bg-rose-50 dark:bg-rose-900/20 text-sm text-rose-700 dark:text-rose-300 space-y-1">
              {d.mungojne.map((m, i) => (
                <p key={i}><b>⚠ Mungon {dmy(m.nga)} – {dmy(m.deri)}</b> — mes &quot;{m.pas}&quot; dhe &quot;{m.para}&quot; (diferenca e gjendjes {eur(m.diferenca)}). Ngarko ekstraktin e bankës për këto data.</p>
              ))}
            </div>
          )}

          <div>
            <p className="text-xs font-semibold text-slate-600 dark:text-slate-300 mb-1">Ngarkimet që kanë rreshta në {d.viti}</p>
            <table className="w-full text-xs">
              <thead><tr className="text-left text-slate-500"><th className="pr-3 font-semibold">Skedari</th><th className="pr-3 font-semibold">Rreshtat në {d.viti}</th><th className="pr-3 font-semibold text-right">Rreshta</th><th className="pr-3 font-semibold text-right">Në bilanc</th><th /></tr></thead>
              <tbody>
                {d.ngarkimet.map(n => (
                  <tr key={n.id} className="border-t border-slate-100 dark:border-slate-700/50">
                    <td className="pr-3 py-1 font-medium"><FileText className="w-3 h-3 inline mr-1 text-slate-400" />{n.emriSkedarit}</td>
                    <td className="pr-3 py-1 whitespace-nowrap">{dmy(n.ngaVit)} – {dmy(n.deriVit)}</td>
                    <td className="pr-3 py-1 text-right">{n.rreshta}</td>
                    <td className="pr-3 py-1 text-right">{n.importuar === n.rreshta ? <span className="text-emerald-700">✓ të gjithë</span> : n.importuar ? `${n.importuar} nga ${n.rreshta}` : <span className="text-amber-600">jo ende</span>}</td>
                    <td className="py-1 text-right"><Link href={`/banka/${n.id}`} className="underline text-slate-500 hover:text-primary-600">{STATUSI_EK[n.statusi]?.t ?? n.statusi} · hap</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <LevizjetTable rows={d.levizjet} zerat={zerat} onChanged={load} />
      </div>
    </div>
  );
}

function Box({ t, v, c }: { t: string; v: string; c?: string }) {
  return <div className="rounded-lg p-3 bg-slate-50 dark:bg-slate-800/60"><p className="text-xs text-slate-500">{t}</p><p className={`font-bold ${c ?? "text-slate-900 dark:text-white"}`}>{v}</p></div>;
}
