"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { Loader2, CheckCircle2, AlertTriangle, RotateCcw, Wand2, Trash2, Undo2 } from "lucide-react";
import { eur, dmy, STATUSI_EK, ProgressBar, readingProgress, LevizjetTable, type Zer, type Levizje } from "@/components/banka/shared";

interface Ek {
  id: number; llogaria: string | null; periudhaNga: string | null; periudhaDeri: string | null; emriSkedarit: string | null;
  gjendjaFillestare: number | null; gjendjaPerfundimtare: number | null; totalDebi: number | null; totalKredi: number | null;
  nrDebi: number | null; nrKredi: number | null; statusi: string; faqetGati: number; faqetGjithsej: number; gabimi: string | null;
  ngarkuarNga: string | null; importuarAt: string | null; importuarNga: string | null; nePunim: boolean; levizjet: Levizje[];
}

export default function EkstraktPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ek, setEk] = useState<Ek | null>(null);
  const [zerat, setZerat] = useState<Zer[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([fetch(`/api/banka/ekstrakte/${id}`), fetch("/api/banka/zerat")]);
    if (a.ok) setEk(await a.json());
    if (b.ok) setZerat(await b.json());
  }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    if (ek?.statusi !== "NE_PERPUNIM") return;
    const t = setInterval(load, 2000);
    return () => clearInterval(t);
  }, [ek?.statusi, load]);

  async function veprim(veprimi: string, pyetja?: string) {
    if (pyetja && !confirm(pyetja)) return;
    setBusy(veprimi);
    const r = await fetch(`/api/banka/ekstrakte/${id}/veprim`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ veprimi }) });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { alert(d.error || "Veprimi dështoi."); return; }
    if (veprimi === "IMPORTO" && d.dyfishta) alert(`${d.dyfishta} rreshta ishin të importuar më parë dhe u lanë jashtë (dyfisht).`);
    if (veprimi === "RIKLASIFIKO") alert(`${d.ndryshuar} rreshta morën zë të ri sipas rregullave.`);
    load();
  }

  async function fshi() {
    if (!confirm("Ta hedh poshtë këtë draft? Rreshtat e lexuar fshihen; PDF-në mund ta ngarkosh sërish.")) return;
    const r = await fetch(`/api/banka/ekstrakte/${id}`, { method: "DELETE" });
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "Fshirja dështoi."); return; }
    router.push("/banka");
  }

  if (!ek) return <div><Header title="Banka" backHref="/banka" /><div className="p-10 text-center text-slate-400 text-sm">Duke ngarkuar…</div></div>;

  const st = STATUSI_EK[ek.statusi] ?? { t: ek.statusi, c: "" };
  const imported = ek.statusi === "IMPORTUAR";
  const pa = ek.levizjet.filter(r => r.zerId === null && r.statusi !== "DYFISHT").length;
  const kontrolli = ek.gjendjaFillestare != null && ek.gjendjaPerfundimtare != null && ek.totalKredi != null && ek.totalDebi != null
    && ek.gjendjaFillestare + ek.totalKredi - ek.totalDebi === ek.gjendjaPerfundimtare;

  return (
    <div>
      <Header title="Banka – ekstrakti" backHref="/banka" />
      <div className="p-4 sm:p-6 space-y-4">
        <div className="card p-5">
          <div className="flex flex-wrap items-start gap-4">
            <div className="flex-1 min-w-[260px]">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="font-bold text-slate-900 dark:text-white">Llogaria {ek.llogaria ?? "…"}</h2>
                <span className={`badge ${st.c}`}>{st.t}</span>
              </div>
              <p className="text-sm text-slate-500 mt-1">
                {ek.periudhaNga ? `${dmy(ek.periudhaNga)} – ${dmy(ek.periudhaDeri)}` : "Periudha —"} · {ek.emriSkedarit}
                {ek.ngarkuarNga && <> · ngarkuar nga {ek.ngarkuarNga}</>}
                {imported && <> · importuar {dmy(ek.importuarAt)} nga {ek.importuarNga}</>}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ek.statusi === "DRAFT" && (
                <button onClick={() => veprim("IMPORTO", `Ta importoj ekstraktin? ${ek.levizjet.length} rreshta hyjnë në bilanc${pa ? ` (${pa} pa zë — mund t'i klasifikosh edhe më vonë)` : ""}.`)} disabled={!!busy} className="btn-primary">
                  {busy === "IMPORTO" ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Importo
                </button>
              )}
              {(ek.statusi === "DRAFT" || imported) && (
                <button onClick={() => veprim("RIKLASIFIKO")} disabled={!!busy} className="btn-secondary" title="Zbaton rregullat te rreshtat që s'i ke zgjedhur me dorë">
                  {busy === "RIKLASIFIKO" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />} Rizbato rregullat
                </button>
              )}
              {imported && (
                <button onClick={() => veprim("KTHE_NE_DRAFT", "Ta kthej në draft? Rreshtat dalin nga bilanci (asgjë s'fshihet).")} disabled={!!busy} className="btn-secondary">
                  <Undo2 className="w-4 h-4" /> Kthe në draft
                </button>
              )}
              {(ek.statusi === "GABIM" || (ek.statusi === "NE_PERPUNIM" && !ek.nePunim)) && (
                <button onClick={() => veprim("RIFILLO")} disabled={!!busy} className="btn-secondary"><RotateCcw className="w-4 h-4" /> Lexo sërish</button>
              )}
              {!imported && !ek.nePunim && (
                <button onClick={fshi} className="btn-secondary text-rose-600"><Trash2 className="w-4 h-4" /> Hidhe poshtë</button>
              )}
            </div>
          </div>

          {ek.statusi === "NE_PERPUNIM" && (
            <div className="mt-4">
              {(() => { const p = readingProgress(ek.faqetGati, ek.faqetGjithsej); return <ProgressBar pct={p.pct} label={p.label} />; })()}
              <p className="text-xs text-slate-400 mt-2">Mund ta mbyllësh faqen — leximi vazhdon në sfond (rreth 1–3 minuta për 100 faqe).</p>
            </div>
          )}

          {ek.statusi !== "NE_PERPUNIM" && (
            <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <Box t="Gjendja fillestare" v={eur(ek.gjendjaFillestare)} />
              <Box t={`Hyrje (${ek.nrKredi ?? 0})`} v={eur(ek.totalKredi)} c="text-emerald-700" />
              <Box t={`Dalje (${ek.nrDebi ?? 0})`} v={eur(ek.totalDebi)} c="text-rose-700" />
              <Box t="Gjendja përfundimtare" v={eur(ek.gjendjaPerfundimtare)} />
              <div className={`rounded-lg p-3 ${kontrolli && !ek.gabimi ? "bg-emerald-50 dark:bg-emerald-900/20" : "bg-rose-50 dark:bg-rose-900/20"}`}>
                <p className="text-xs text-slate-500">Kontrolli me bankën</p>
                <p className={`font-bold flex items-center gap-1 ${kontrolli && !ek.gabimi ? "text-emerald-700" : "text-rose-700"}`}>
                  {kontrolli && !ek.gabimi ? <><CheckCircle2 className="w-4 h-4" /> Përputhet</> : <><AlertTriangle className="w-4 h-4" /> S&apos;përputhet</>}
                </p>
              </div>
            </div>
          )}
          {ek.gabimi && (
            <pre className="mt-3 text-xs whitespace-pre-wrap bg-rose-50 dark:bg-rose-900/20 text-rose-700 dark:text-rose-300 rounded-lg p-3">{ek.gabimi}</pre>
          )}
        </div>

        {ek.levizjet.length > 0 && <LevizjetTable rows={ek.levizjet} zerat={zerat} onChanged={load} />}
      </div>
    </div>
  );
}

function Box({ t, v, c }: { t: string; v: string; c?: string }) {
  return <div className="rounded-lg p-3 bg-slate-50 dark:bg-slate-800/60"><p className="text-xs text-slate-500">{t}</p><p className={`font-bold ${c ?? "text-slate-900 dark:text-white"}`}>{v}</p></div>;
}
