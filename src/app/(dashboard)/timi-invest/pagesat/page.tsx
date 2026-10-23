"use client";

import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatCurrency, formatDate } from "@/lib/utils";
import { reasonHeaders } from "@/lib/auditReason";
import { currentSchoolYearStart } from "@/lib/academicYear";
import { Loader2, Plus, Ban, Undo2, FileText, Pencil, Trash2, History } from "lucide-react";

// Moduli TIMI INVEST → Pagesat nga TIMI (Faza 3): transferet (të ruajtura, të stornuara, draftet)
// me Storno/Rikthe për krejt transferin, dhe pagesat historike "me dorë" (VETËM LEXIM, nga
// të dhënat ekzistuese — s'krijohet asnjë rresht, s'numërohen dy herë).

interface T {
  id: number; data: string; shumaCents: number; brutoCents: number; komisionCents: number; referenca: string | null; prindi: string | null; banka: string | null;
  dokumenti: string | null; dokumentiEmri: string | null; statusi: string; stornuar: boolean; stornuarAt: string | null; stornuarNga: string | null; stornoArsye: string | null;
  mundRikthim: boolean; rikthyerAt: string | null; createdByName: string | null; femijet: { studentId: number; emri: string; cents: number }[];
}
interface R { tiId: number; emri: string; klasa: string | null; prindi: string; meDoreCents: number; statusi: string }
const eur = (c: number) => formatCurrency(c / 100);

export default function Page() {
  return <Suspense fallback={<div className="card p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>}><Pagesat /></Suspense>;
}

function Pagesat() {
  const sp = useSearchParams();
  const [viti, setViti] = useState(currentSchoolYearStart());
  const [list, setList] = useState<T[] | null>(null);
  const [hist, setHist] = useState<R[]>([]);
  const [filter, setFilter] = useState<"RUAJTUR" | "DRAFT" | "STORNUAR" | "ALL">("RUAJTUR");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    const [a, b] = await Promise.all([fetch(`/api/timi-invest/transferet?viti=${viti}`), fetch(`/api/timi-invest/pasqyra?viti=${viti}`)]);
    const ja = await a.json().catch(() => ({})), jb = await b.json().catch(() => ({}));
    if (!a.ok) { setErr(ja.error || "Gabim"); return; }
    setList(ja.transferet);
    setHist((jb.rreshtat ?? []).filter((r: R) => r.meDoreCents > 0 && r.statusi === "ACTIVE"));
  }, [viti]);
  useEffect(() => { setList(null); load(); }, [load]);

  const all = list ?? [];
  const ruajtur = all.filter(t => t.statusi === "RUAJTUR" && !t.stornuar);
  const drafte = all.filter(t => t.statusi === "DRAFT" && !t.stornuar);
  const stornuar = all.filter(t => t.statusi === "RUAJTUR" && t.stornuar);
  const shown = filter === "RUAJTUR" ? ruajtur : filter === "DRAFT" ? drafte : filter === "STORNUAR" ? stornuar : all.filter(t => !(t.statusi === "DRAFT" && t.stornuar));
  const sum = (l: T[], k: "shumaCents" | "brutoCents" | "komisionCents") => l.reduce((a, t) => a + t[k], 0);

  // Historike: sipas prindit (vetëm lexim)
  const histFam = useMemo(() => {
    const m = new Map<string, R[]>();
    for (const r of hist) { const k = r.prindi || r.emri; m.set(k, [...(m.get(k) ?? []), r]); }
    return [...m.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [hist]);

  async function storno(t: T) {
    const fem = t.femijet.map(f => f.emri).join(", ");
    const isDraft = t.statusi === "DRAFT";
    const a = window.prompt(isDraft
      ? `Fshi draftin ${eur(t.shumaCents)} (${formatDate(t.data)})? Drafti s'ka prekur asnjë pagesë.\n\nShkruani arsyen:`
      : `Storno krejt transferin ${eur(t.shumaCents)} (${formatDate(t.data)}, ${t.referenca ?? "pa ref."})?\nFëmijët: ${fem}\nMuajt dhe komisioni kthehen mbrapsht; transferi mbetet në listë si "i stornuar" dhe mund të rikthehet.\n\nShkruani arsyen (e detyrueshme):`);
    if (a === null) return;
    if (a.trim().length < 3) { alert("Arsyeja duhet të ketë të paktën 3 shenja."); return; }
    setBusy(true);
    const r = await fetch(`/api/timi-invest/pagesat/${t.id}`, { method: "DELETE", headers: reasonHeaders(a.trim()) });
    setBusy(false);
    if (!r.ok) { alert((await r.json().catch(() => ({}))).error || "Veprimi dështoi."); return; }
    load();
  }
  async function rikthe(t: T) {
    const a = window.prompt(`Rikthe transferin ${eur(t.shumaCents)} (${formatDate(t.data)})?\nMuajt, komisioni dhe fazat kthehen saktësisht si para stornos.\n\nShkruani arsyen (e detyrueshme):`);
    if (a === null) return;
    if (a.trim().length < 3) { alert("Arsyeja duhet të ketë të paktën 3 shenja."); return; }
    setBusy(true);
    const r = await fetch(`/api/timi-invest/pagesat/${t.id}/rikthe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ arsye: a.trim() }) });
    setBusy(false);
    if (!r.ok) { alert((await r.json().catch(() => ({}))).error || "Rikthimi dështoi."); return; }
    load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Pagesat nga TIMI</h1>
          <p className="text-xs text-slate-500">Çdo rresht = një transfer bankar nga TIMI, i ndarë te fëmijët.</p>
        </div>
        <div className="flex gap-2">
          <select value={viti} onChange={e => setViti(Number(e.target.value))} className="form-input !w-auto">
            {[currentSchoolYearStart() - 1, currentSchoolYearStart(), currentSchoolYearStart() + 1].map(y => <option key={y} value={y}>{y}–{String(y + 1).slice(2)}</option>)}
          </select>
          <Link href="/timi-invest/pagesat/e-re" className="btn-primary !bg-amber-500 hover:!bg-amber-600"><Plus className="w-4 h-4" />Regjistro pagesë nga TIMI</Link>
        </div>
      </div>

      {sp.get("ruajtur") && <div className="card p-3 text-sm bg-emerald-50 dark:bg-emerald-900/20 text-emerald-800 dark:text-emerald-200 border-emerald-200">✓ Pagesa u ruajt (#{sp.get("ruajtur")}). Muajt e fëmijëve dhe komisioni u përditësuan.</div>}
      {err && <div className="card p-3 text-sm text-red-600">{err}</div>}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Kart l="Transfere të ruajtura" v={String(ruajtur.length)} s={`${eur(sum(ruajtur, "shumaCents"))} në bankë`} />
        <Kart l="Për fëmijët" v={eur(sum(ruajtur, "brutoCents"))} tone="text-emerald-700 dark:text-emerald-400" s={`komisioni ${eur(sum(ruajtur, "komisionCents"))}`} />
        <Kart l="Drafte" v={String(drafte.length)} s="s'prekin asnjë pagesë" />
        <Kart l="Të stornuara" v={String(stornuar.length)} s={`${eur(sum(stornuar, "shumaCents"))} (s'numërohen)`} />
      </div>

      <div className="card overflow-hidden">
        <div className="px-4 py-2.5 flex flex-wrap gap-2 border-b border-slate-100 dark:border-slate-700">
          {([["RUAJTUR", `Të ruajtura ${ruajtur.length}`], ["DRAFT", `Drafte ${drafte.length}`], ["STORNUAR", `Të stornuara ${stornuar.length}`], ["ALL", "Të gjitha"]] as const).map(([k, l]) => (
            <button key={k} onClick={() => setFilter(k)} className={`px-3 py-1 rounded-full text-xs font-semibold border ${filter === k ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900" : "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300"}`}>{l}</button>
          ))}
        </div>
        {!list ? <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div> : shown.length === 0 ? (
          <p className="p-6 text-sm text-center text-slate-400">S&apos;ka asgjë këtu.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60">
                <tr>
                  <th className="px-3 py-2 text-left">Data</th><th className="px-3 py-2 text-left">Prindi · fëmijët</th><th className="px-3 py-2 text-left">Referenca</th>
                  <th className="px-3 py-2 text-right">Në bankë</th><th className="px-3 py-2 text-right">Për fëmijët</th><th className="px-3 py-2 text-right">Komisioni</th>
                  <th className="px-3 py-2 text-left">Statusi</th><th className="px-3 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {shown.map(t => (
                  <tr key={t.id} className={t.stornuar ? "text-slate-400" : ""}>
                    <td className={`px-3 py-2 whitespace-nowrap ${t.stornuar ? "line-through" : ""}`}>{formatDate(t.data)}{t.banka && <span className="block text-[11px] text-slate-400">{t.banka}</span>}</td>
                    <td className="px-3 py-2">
                      <span className="font-medium">{t.prindi || "—"}</span>
                      <span className="block text-xs text-slate-500">{t.statusi === "DRAFT" ? "draft — fëmijët s'janë caktuar ende përfundimisht" : t.femijet.map(f => `${f.emri} ${eur(f.cents)}`).join(" · ")}</span>
                    </td>
                    <td className="px-3 py-2 text-xs">
                      {t.referenca ?? "—"}
                      {t.dokumenti && <a href={`/api/timi-invest/dokumente/${t.dokumenti}`} target="_blank" className="block text-primary-600 hover:underline inline-flex items-center gap-1"><FileText className="w-3 h-3" />{t.dokumentiEmri ?? "dokumenti"}</a>}
                    </td>
                    <td className={`px-3 py-2 text-right tabular-nums ${t.stornuar ? "line-through" : ""}`}>{eur(t.shumaCents)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums ${t.stornuar ? "line-through" : "text-emerald-700 dark:text-emerald-400"}`}>{eur(t.brutoCents)}</td>
                    <td className={`px-3 py-2 text-right tabular-nums text-xs ${t.stornuar ? "line-through" : ""}`}>{eur(t.komisionCents)}</td>
                    <td className="px-3 py-2 text-xs">
                      {t.statusi === "DRAFT" ? <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">Draft</span>
                        : t.stornuar ? <span title={t.stornoArsye ?? ""}><span className="badge bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">Stornuar</span><span className="block mt-0.5">{t.stornuarNga ?? ""}{t.stornuarAt ? ` · ${formatDate(t.stornuarAt)}` : ""}</span>{t.stornoArsye && <span className="block italic">“{t.stornoArsye}”</span>}</span>
                        : <span><span className="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{t.rikthyerAt ? "Rikthyer" : "Ruajtur"}</span><span className="block mt-0.5 text-slate-400">{t.createdByName ?? ""}</span></span>}
                    </td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      {t.statusi === "DRAFT" && !t.stornuar && <>
                        <Link href={`/timi-invest/pagesat/e-re?draft=${t.id}`} className="btn-secondary !py-1 !px-2 !text-xs inline-flex"><Pencil className="w-3.5 h-3.5" />Vazhdo</Link>{" "}
                        <button disabled={busy} onClick={() => storno(t)} className="btn-secondary !py-1 !px-2 !text-xs inline-flex"><Trash2 className="w-3.5 h-3.5" />Fshi</button>
                      </>}
                      {t.statusi === "RUAJTUR" && !t.stornuar && <button disabled={busy} onClick={() => storno(t)} className="btn-secondary !py-1 !px-2 !text-xs inline-flex"><Ban className="w-3.5 h-3.5" />Storno</button>}
                      {t.stornuar && t.mundRikthim && <button disabled={busy} onClick={() => rikthe(t)} className="btn-secondary !py-1 !px-2 !text-xs inline-flex"><Undo2 className="w-3.5 h-3.5" />Rikthe</button>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Historike — VETËM LEXIM */}
      {histFam.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700">
            <h2 className="font-semibold flex items-center gap-2"><History className="w-4 h-4 text-blue-500" />Pagesa historike (me dorë) — vetëm lexim</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Muaj TIMI të shënuar me dorë (bankë) para formularit &quot;Pagesat nga TIMI&quot; (p.sh. qershor–gusht). Janë tashmë te muajt dhe te &quot;Paguar gjithsej&quot; — këtu vetëm shfaqen, s&apos;numërohen dy herë dhe s&apos;krijojnë asgjë. Komisioni i tyre është te shpenzimet mujore.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60">
                <tr><th className="px-3 py-2 text-left">Prindi</th><th className="px-3 py-2 text-left">Fëmijët</th><th className="px-3 py-2 text-right">TIMI me dorë</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {histFam.map(([p, rr]) => (
                  <tr key={p}>
                    <td className="px-3 py-2 font-medium">{p}</td>
                    <td className="px-3 py-2 text-xs">{rr.map(r => <Link key={r.tiId} href={`/timi-invest/femijet/${r.tiId}`} className="mr-2 text-primary-600 hover:underline">{r.emri} ({eur(r.meDoreCents)})</Link>)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{eur(rr.reduce((a, r) => a + r.meDoreCents, 0))}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50 dark:bg-slate-800/60 font-semibold">
                <tr><td className="px-3 py-2" colSpan={2}>Gjithsej ({hist.length} fëmijë)</td><td className="px-3 py-2 text-right tabular-nums">{eur(hist.reduce((a, r) => a + r.meDoreCents, 0))}</td></tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Kart({ l, v, s, tone }: { l: string; v: string; s?: string; tone?: string }) {
  return (
    <div className="card p-4">
      <p className="text-xs text-slate-500">{l}</p>
      <p className={`text-2xl font-bold ${tone ?? "text-slate-900 dark:text-white"}`}>{v}</p>
      {s && <p className="text-[11px] text-slate-400">{s}</p>}
    </div>
  );
}
