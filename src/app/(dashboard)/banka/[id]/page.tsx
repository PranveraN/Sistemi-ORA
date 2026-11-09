"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Header from "@/components/layout/Header";
import { Loader2, CheckCircle2, AlertTriangle, RotateCcw, Wand2, Trash2, Undo2, Combine } from "lucide-react";
import { eur, dmy, STATUSI_EK, ProgressBar, readingProgress, PjesetTable, LevizjetTable, type Zer, type Levizje } from "@/components/banka/shared";

interface Ek {
  id: number; llogaria: string | null; periudhaNga: string | null; periudhaDeri: string | null; emriSkedarit: string | null;
  gjendjaFillestare: number | null; gjendjaPerfundimtare: number | null; totalDebi: number | null; totalKredi: number | null;
  nrDebi: number | null; nrKredi: number | null; statusi: string; faqetGati: number; faqetGjithsej: number; gabimi: string | null;
  ngarkuarNga: string | null; importuarAt: string | null; importuarNga: string | null; nePunim: boolean; levizjet: Levizje[]; perseritur: number; pjeset: string | null;
  mbivendosjet: { id: number; periudhaNga: string | null; periudhaDeri: string | null; statusi: string; emriSkedarit: string | null; teNjejte: number }[];
}

export default function EkstraktPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [ek, setEk] = useState<Ek | null>(null);
  const [zerat, setZerat] = useState<Zer[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [others, setOthers] = useState<{ id: number; llogaria: string | null; periudhaNga: string | null; periudhaDeri: string | null; statusi: string }[]>([]);
  const [meId, setMeId] = useState("");

  const load = useCallback(async () => {
    const [a, b] = await Promise.all([fetch(`/api/banka/ekstrakte/${id}`), fetch("/api/banka/zerat")]);
    if (a.ok) setEk(await a.json());
    if (b.ok) setZerat(await b.json());
    const c = await fetch("/api/banka/ekstrakte");
    if (c.ok) setOthers(await c.json());
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

  async function bashko() {
    const o = others.find(x => String(x.id) === meId);
    if (!o || !confirm(`Ta bashkoj me ekstraktin ${dmy(o.periudhaNga)} – ${dmy(o.periudhaDeri)}? Bëhen një rresht; asnjë rresht banke s'humbet.`)) return;
    setBusy("BASHKO");
    const r = await fetch(`/api/banka/ekstrakte/${id}/veprim`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ veprimi: "BASHKO", meId: o.id }) });
    const d = await r.json().catch(() => ({}));
    setBusy(null);
    if (!r.ok) { alert(d.error || "Bashkimi dështoi."); return; }
    setMeId("");
    if (String(d.id) !== String(id)) router.push(`/banka/${d.id}`); else load();
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
          {(ek.mbivendosjet?.length > 0 || ek.perseritur > 0 || ek.levizjet.some(r => r.statusi === "DYFISHT")) && (
            <div className="mt-3 rounded-lg p-3 bg-amber-50 dark:bg-amber-900/20 text-sm text-amber-800 dark:text-amber-200 space-y-1">
              <p className="font-semibold flex items-center gap-1.5"><AlertTriangle className="w-4 h-4" /> Mbivendosje datash me ekstrakte të tjera</p>
              {ek.mbivendosjet?.map(o => (
                <p key={o.id}>
                  <a href={`/banka/${o.id}`} className="underline">Ekstrakti {dmy(o.periudhaNga)} – {dmy(o.periudhaDeri)}</a> ({STATUSI_EK[o.statusi]?.t ?? o.statusi}{o.emriSkedarit ? `, ${o.emriSkedarit}` : ""})
                  {" "}mbulon edhe disa nga këto data — <b>{o.teNjejte}</b> rreshta janë të njëjtë.
                  {o.statusi === "IMPORTUAR" ? " Ata s'importohen sërish (shënohen “dyfisht”)." : " Importo vetëm njërin: kur importohet i dyti, rreshtat e përbashkët shënohen “dyfisht” dhe s'futen."}
                </p>
              ))}
              {ek.levizjet.some(r => r.statusi === "DYFISHT") && <p><b>{ek.levizjet.filter(r => r.statusi === "DYFISHT").length}</b> rreshta janë tashmë të importuar nga një ekstrakt tjetër — mbeten jashtë bilancit (filtri &quot;Dyfisht&quot;).</p>}
              {ek.perseritur > 0 && <p><b>{ek.perseritur}</b> rreshta ishin në dy pjesë (PDF) njëherësh — u mbajtën vetëm një herë.</p>}
            </div>
          )}
          {ek.statusi === "DRAFT" && others.some(o => o.id !== ek.id && o.statusi === "DRAFT" && o.llogaria === ek.llogaria) && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-slate-500">I njëjti vit është ngarkuar në dy herë? Bashkoje në një rresht:</span>
              <select value={meId} onChange={e => setMeId(e.target.value)} className="form-input w-auto py-1.5 text-sm">
                <option value="">Zgjidh ekstraktin…</option>
                {others.filter(o => o.id !== ek.id && o.statusi === "DRAFT" && o.llogaria === ek.llogaria).map(o => (
                  <option key={o.id} value={o.id}>{dmy(o.periudhaNga)} – {dmy(o.periudhaDeri)}</option>
                ))}
              </select>
              <button onClick={bashko} disabled={!meId || !!busy} className="btn-secondary py-1.5 text-sm">
                {busy === "BASHKO" ? <Loader2 className="w-4 h-4 animate-spin" /> : <Combine className="w-4 h-4" />} Bashko
              </button>
            </div>
          )}
          {ek.pjeset && (() => { try { const p = JSON.parse(ek.pjeset); return p.pjeset?.length > 1 || p.mungojne?.length > 0; } catch { return false; } })() && (
            <div className="mt-3 rounded-lg p-3 bg-slate-50 dark:bg-slate-800/60">
              <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">Skedarët e këtij ekstrakti</p>
              <PjesetTable json={ek.pjeset} />
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
