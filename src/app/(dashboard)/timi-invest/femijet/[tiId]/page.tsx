"use client";

import { use, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency, formatDate } from "@/lib/utils";
import { reasonHeaders } from "@/lib/auditReason";
import { currentSchoolYearStart } from "@/lib/academicYear";
import { ArrowLeft, Loader2, Save, Undo2, Ban, ExternalLink } from "lucide-react";

// Moduli TIMI INVEST → Kartela e fëmijës (Faza 2): marrëveshja (me arsye për çmimin/zbritjen),
// pagesat nga TIMI me Storno/Rikthe, plani i kësteve dhe historiku. Shifrat = si te Pasqyra.

interface Data {
  viti: number;
  link: { id: number; firstName: string; lastName: string; parentName: string; parentPhone: string; regularPrice: number; discountPct: number; manualDiscAmt: number; stage: string; notes: string | null; studentId: number | null; active: boolean; createdAt: string };
  student: { id: number; firstName: string; lastName: string; parentName: string | null; status: string; class: { name: string } | null } | null;
  rresht: { cmimiCents: number; ngaTimiCents: number; meDoreCents: number; paguarCents: number; mbetetCents: number; faza: string } | null;
  pagesat: {
    id: number; data: string; referenca: string | null; prindi: string | null; vitiShkollor: number; shumaCents: number; brutoCents: number; komisionCents: number;
    femijeCents: number; femijeTjere: string[]; stornuar: boolean; stornuarAt: string | null; stornuarNga: string | null; stornoArsye: string | null;
    mundRikthim: boolean; rikthyerAt: string | null; rikthyerNga: string | null; createdByName: string | null;
  }[];
  muajt: { id: number; description: string | null; finalAmount: number; paidAmount: number; dueDate: string; paidDate: string | null; method: string | null; month: number; year: number }[];
  historiku: { id: number; createdAt: string; userName: string | null; action: string; field: string | null; oldValue: string | null; newValue: string | null; reason: string | null }[];
}

const FAZAT: Record<string, { label: string; cls: string }> = {
  PROFATURE: { label: "Profaturë", cls: "bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" },
  NE_PROCES: { label: "Në proces", cls: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  KRYER:     { label: "E kryer", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  PEZULLUAR: { label: "Pezulluar", cls: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
  ANULUAR:   { label: "Anuluar", cls: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
};
const FUSHA: Record<string, string> = {
  regularPrice: "Çmimi i plotë", discountPct: "Zbritja %", manualDiscAmt: "Zbritja manuale €", stage: "Faza", notes: "Shënimet",
  parentName: "Prindi", parentPhone: "Telefoni", firstName: "Emri", lastName: "Mbiemri", active: "Aktiv", studentId: "Lidhja me nxënësin", pagesa: "Pagesa", lidhja: "Lidhja TIMI",
};
const VEPRIMI: Record<string, string> = { UPDATE: "ndryshoi", STORNO: "stornoi", RIKTHE: "riktheu", CREATE: "shtoi", DELETE: "fshiu" };
const MUAJT = ["", "Janar", "Shkurt", "Mars", "Prill", "Maj", "Qershor", "Korrik", "Gusht", "Shtator", "Tetor", "Nëntor", "Dhjetor"];
const eur = (c: number) => formatCurrency(c / 100);
const shfaq = (field: string | null, v: string | null) => v == null ? "—" : field === "stage" ? (FAZAT[v]?.label ?? v) : field === "regularPrice" || field === "manualDiscAmt" ? formatCurrency(Number(v)) : field === "discountPct" ? `${v}%` : v;

export default function KartelaPage({ params }: { params: Promise<{ tiId: string }> }) {
  const { tiId } = use(params);
  const [viti, setViti] = useState(currentSchoolYearStart());
  const [d, setD] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ regularPrice: "", discountPct: "", manualDiscAmt: "", stage: "", notes: "", arsye: "" });

  const load = useCallback(async () => {
    setError("");
    const r = await fetch(`/api/timi-invest/femijet/${tiId}?viti=${viti}`);
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setError(j.error || "Gabim"); return; }
    setD(j);
    setForm({ regularPrice: String(j.link.regularPrice), discountPct: String(j.link.discountPct), manualDiscAmt: String(j.link.manualDiscAmt ?? 0), stage: j.link.stage, notes: j.link.notes ?? "", arsye: "" });
  }, [tiId, viti]);
  useEffect(() => { load(); }, [load]);

  if (error) return <div className="card p-6 text-red-600 text-sm">{error}</div>;
  if (!d) return <div className="card p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div>;

  const l = d.link;
  const emri = d.student ? `${d.student.firstName} ${d.student.lastName}` : `${l.firstName} ${l.lastName}`;
  const num = (v: string) => parseFloat(v.replace(",", ".")) || 0;
  const cmimiRi = Math.max(0, num(form.regularPrice) * (1 - num(form.discountPct) / 100) - num(form.manualDiscAmt));
  const priceChanged = num(form.regularPrice) !== l.regularPrice || num(form.discountPct) !== l.discountPct || num(form.manualDiscAmt) !== (l.manualDiscAmt ?? 0);
  const anyChange = priceChanged || form.stage !== l.stage || form.notes !== (l.notes ?? "");
  const tjera = d.rresht ? Math.max(0, d.rresht.paguarCents - d.rresht.ngaTimiCents - d.rresht.meDoreCents) : 0;

  async function ruaj() {
    if (priceChanged && form.arsye.trim().length < 3) { alert("Ndryshimi i çmimit ose i zbritjes kërkon arsye (të paktën 3 shenja)."); return; }
    setBusy(true);
    const r = await fetch(`/api/timi-invest/students/${l.id}`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ regularPrice: num(form.regularPrice), discountPct: num(form.discountPct), manualDiscAmt: num(form.manualDiscAmt), stage: form.stage, notes: form.notes, reason: form.arsye.trim() || undefined }),
    });
    setBusy(false);
    if (!r.ok) { alert((await r.json().catch(() => ({}))).error || "Ruajtja dështoi."); return; }
    await load();
  }

  async function storno(p: Data["pagesat"][number]) {
    const tjeret = p.femijeTjere.length ? `\n\nKujdes: kjo pagesë është e përbashkët — stornohet edhe për: ${p.femijeTjere.join(", ")}.` : "";
    const a = window.prompt(`Storno pagesën ${formatCurrency(p.shumaCents / 100)} (${formatDate(p.data)}, ${p.referenca ?? "pa ref."})?\nMuajt dhe komisioni kthehen mbrapsht; pagesa mbetet në listë si "e stornuar" dhe mund të rikthehet.${tjeret}\n\nShkruani arsyen (e detyrueshme):`);
    if (a === null) return;
    if (a.trim().length < 3) { alert("Arsyeja duhet të ketë të paktën 3 shenja."); return; }
    setBusy(true);
    const r = await fetch(`/api/timi-invest/pagesat/${p.id}`, { method: "DELETE", headers: reasonHeaders(a.trim()) });
    setBusy(false);
    if (!r.ok) { alert((await r.json().catch(() => ({}))).error || "Stornoja dështoi."); return; }
    await load();
  }

  async function rikthe(p: Data["pagesat"][number]) {
    const a = window.prompt(`Rikthe pagesën ${formatCurrency(p.shumaCents / 100)} (${formatDate(p.data)})?\nMuajt, komisioni dhe fazat kthehen saktësisht si para stornos.\n\nShkruani arsyen (e detyrueshme):`);
    if (a === null) return;
    if (a.trim().length < 3) { alert("Arsyeja duhet të ketë të paktën 3 shenja."); return; }
    setBusy(true);
    const r = await fetch(`/api/timi-invest/pagesat/${p.id}/rikthe`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ arsye: a.trim() }) });
    setBusy(false);
    if (!r.ok) { alert((await r.json().catch(() => ({}))).error || "Rikthimi dështoi."); return; }
    await load();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
        <Link href="/timi-invest" className="inline-flex items-center gap-1 hover:text-primary-600"><ArrowLeft className="w-3.5 h-3.5" />Pasqyra</Link>
        <span>/</span><span className="text-slate-700 dark:text-slate-200 font-medium">{emri}</span>
      </div>

      {/* Koka */}
      <div className="card p-4 flex flex-wrap items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 flex items-center justify-center font-bold">
          {emri.split(" ").map(x => x[0]).slice(0, 2).join("").toUpperCase()}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h1 className="text-lg font-bold text-slate-900 dark:text-white">{emri}</h1>
            <span className={`badge ${FAZAT[l.stage]?.cls ?? ""}`}>{FAZAT[l.stage]?.label ?? l.stage}</span>
            {d.student && d.student.status !== "ACTIVE" && <span className="badge bg-slate-100 text-slate-500">Joaktiv</span>}
          </div>
          <p className="text-xs text-slate-500">Klasa {d.student?.class?.name ?? "—"} · Prindi: {l.parentName || d.student?.parentName || "—"}{l.parentPhone ? ` · ${l.parentPhone}` : ""}</p>
        </div>
        <select value={viti} onChange={e => setViti(Number(e.target.value))} className="form-input !w-auto">
          {[currentSchoolYearStart() - 1, currentSchoolYearStart(), currentSchoolYearStart() + 1].map(y => <option key={y} value={y}>{y}–{String(y + 1).slice(2)}</option>)}
        </select>
        {d.student && <Link href={`/students/${d.student.id}`} className="btn-secondary !py-2"><ExternalLink className="w-4 h-4" />Profili</Link>}
      </div>

      <div className="grid lg:grid-cols-[320px_1fr] gap-4">
        {/* Marrëveshja */}
        <div className="card p-4 space-y-3 h-fit">
          <h2 className="font-semibold text-slate-800 dark:text-slate-100">Marrëveshja me TIMI</h2>
          <div>
            <label className="form-label">Çmimi i plotë (€)</label>
            <input className="form-input" inputMode="decimal" value={form.regularPrice} onChange={e => setForm({ ...form, regularPrice: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="form-label">Zbritja (%)</label>
              <input className="form-input" inputMode="decimal" value={form.discountPct} onChange={e => setForm({ ...form, discountPct: e.target.value })} />
            </div>
            <div>
              <label className="form-label">Zbritja manuale (€)</label>
              <input className="form-input" inputMode="decimal" value={form.manualDiscAmt} onChange={e => setForm({ ...form, manualDiscAmt: e.target.value })} />
            </div>
          </div>
          <p className="text-xs text-slate-500">Çmimi TIMI: <b className="text-slate-800 dark:text-slate-100">{formatCurrency(cmimiRi)}</b></p>
          {priceChanged && (
            <div>
              <label className="form-label">Arsyeja e ndryshimit *</label>
              <input className="form-input" placeholder="p.sh. vëlla/motër, marrëveshje e re…" value={form.arsye} onChange={e => setForm({ ...form, arsye: e.target.value })} />
            </div>
          )}
          <div>
            <label className="form-label">Faza</label>
            <select className="form-input" value={form.stage} onChange={e => setForm({ ...form, stage: e.target.value })}>
              {Object.entries(FAZAT).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
            </select>
          </div>
          <div>
            <label className="form-label">Shënime</label>
            <textarea className="form-input" rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
          {priceChanged && (
            <p className="text-[11px] rounded-lg bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-200 p-2">
              Ndryshimi i çmimit ruhet në historik me arsyen. Muajt ekzistues te Shkollimi nuk preken — përshtaten vetëm kur hapen te &quot;Modifiko këstet&quot;.
            </p>
          )}
          <div className="flex justify-end gap-2">
            <button disabled={!anyChange || busy} onClick={() => setForm({ regularPrice: String(l.regularPrice), discountPct: String(l.discountPct), manualDiscAmt: String(l.manualDiscAmt ?? 0), stage: l.stage, notes: l.notes ?? "", arsye: "" })} className="btn-secondary">Anulo</button>
            <button disabled={!anyChange || busy} onClick={ruaj} className="btn-primary"><Save className="w-4 h-4" />Ruaj</button>
          </div>
        </div>

        <div className="space-y-4 min-w-0">
          {/* Kartat */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <Mini label="Çmimi" value={d.rresht ? eur(d.rresht.cmimiCents) : "—"} />
            <Mini label="Nga TIMI" value={d.rresht ? eur(d.rresht.ngaTimiCents) : "—"} tone="text-emerald-700 dark:text-emerald-400"
              sub={d.rresht && d.rresht.meDoreCents > 0 ? `+ ${eur(d.rresht.meDoreCents)} me dorë` : undefined} />
            <Mini label="Të tjera (prindi etj.)" value={d.rresht ? eur(tjera) : "—"} />
            <Mini label="Mbetet" value={d.rresht ? eur(d.rresht.mbetetCents) : "—"} tone="text-red-700 dark:text-red-400" />
          </div>

          {/* Pagesat nga TIMI */}
          <div className="card overflow-hidden">
            <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-700">
              <h2 className="font-semibold text-slate-800 dark:text-slate-100">Pagesat nga TIMI</h2>
              <span className="text-xs text-slate-500">{d.pagesat.filter(p => !p.stornuar).length} pagesa · {d.pagesat.filter(p => p.stornuar).length} të stornuara</span>
            </div>
            {d.pagesat.length === 0 ? (
              <p className="p-4 text-sm text-slate-400">S&apos;ka pagesa të regjistruara përmes &quot;Pagesat nga TIMI&quot;.{d.rresht && d.rresht.meDoreCents > 0 ? " Muajt janë shënuar me dorë (shih planin poshtë)." : ""}</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60">
                    <tr><th className="px-3 py-2 text-left">Data</th><th className="px-3 py-2 text-left">Referenca</th><th className="px-3 py-2 text-right">Për këtë fëmijë</th><th className="px-3 py-2 text-right">Në bankë (gjithsej)</th><th className="px-3 py-2 text-left">Statusi</th><th className="px-3 py-2" /></tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                    {d.pagesat.map(p => (
                      <tr key={p.id} className={p.stornuar ? "text-slate-400" : ""}>
                        <td className={`px-3 py-2 whitespace-nowrap ${p.stornuar ? "line-through" : ""}`}>{formatDate(p.data)}</td>
                        <td className="px-3 py-2">
                          <span className={p.stornuar ? "line-through" : ""}>{p.referenca ?? "—"}</span>
                          {p.femijeTjere.length > 0 && <span className="block text-[11px] text-slate-400">e përbashkët me {p.femijeTjere.join(", ")}</span>}
                        </td>
                        <td className={`px-3 py-2 text-right tabular-nums ${p.stornuar ? "line-through" : ""}`}>{eur(p.femijeCents)}</td>
                        <td className="px-3 py-2 text-right tabular-nums text-xs text-slate-500">{eur(p.shumaCents)} <span className="text-[10px]">(kom. {eur(p.komisionCents)})</span></td>
                        <td className="px-3 py-2 text-xs">
                          {p.stornuar ? (
                            <span title={p.stornoArsye ?? ""}>
                              <span className="badge bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300">Stornuar</span>
                              <span className="block mt-0.5">{p.stornuarNga ?? ""}{p.stornuarAt ? ` · ${formatDate(p.stornuarAt)}` : ""}</span>
                              {p.stornoArsye && <span className="block italic">“{p.stornoArsye}”</span>}
                            </span>
                          ) : (
                            <span>
                              <span className="badge bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300">{p.rikthyerAt ? "Rikthyer" : "Regjistruar"}</span>
                              <span className="block mt-0.5 text-slate-400">{p.rikthyerAt ? `${p.rikthyerNga ?? ""} · ${formatDate(p.rikthyerAt)}` : p.createdByName ?? ""}</span>
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-right whitespace-nowrap">
                          {!p.stornuar && <button disabled={busy} onClick={() => storno(p)} className="btn-secondary !py-1 !px-2 !text-xs inline-flex"><Ban className="w-3.5 h-3.5" />Storno</button>}
                          {p.stornuar && p.mundRikthim && <button disabled={busy} onClick={() => rikthe(p)} className="btn-secondary !py-1 !px-2 !text-xs inline-flex"><Undo2 className="w-3.5 h-3.5" />Rikthe</button>}
                          {p.stornuar && !p.mundRikthim && <span className="text-[11px] text-slate-400" title="U fshi para versionit me Storno/Rikthe">s&apos;rikthehet</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Plani i kësteve */}
          <div className="card p-4">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Plani i kësteve {d.viti}–{String(d.viti + 1).slice(2)}</h2>
            {d.muajt.length === 0 ? <p className="text-sm text-slate-400">S&apos;ka plan pagese te Shkollimi për këtë vit.</p> : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
                {d.muajt.map(m => {
                  const plot = m.paidAmount >= m.finalAmount - 0.005 && m.finalAmount > 0, pjese = m.paidAmount > 0 && !plot;
                  return (
                    <div key={m.id} className={`rounded-lg border p-2 text-xs ${plot ? "bg-emerald-50 border-emerald-200 dark:bg-emerald-900/20 dark:border-emerald-800" : pjese ? "bg-amber-50 border-amber-200 dark:bg-amber-900/20 dark:border-amber-800" : "border-slate-200 dark:border-slate-700"}`}>
                      <p className="text-slate-500">{MUAJT[m.month] ?? m.description}</p>
                      <p className="font-semibold tabular-nums">{formatCurrency(m.finalAmount)}</p>
                      <p className="text-[10px] text-slate-500">{m.paidAmount > 0 ? `paguar ${formatCurrency(m.paidAmount)}${m.paidDate ? ` · ${formatDate(m.paidDate)}` : ""}` : "pa pagesë"}</p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Historiku */}
          <div className="card p-4">
            <h2 className="font-semibold text-slate-800 dark:text-slate-100 mb-3">Historiku i ndryshimeve</h2>
            {d.historiku.length === 0 ? <p className="text-sm text-slate-400">Asnjë ndryshim i regjistruar ende (historiku nis me Fazën 2).</p> : (
              <ul className="space-y-2">
                {d.historiku.map(h => (
                  <li key={h.id} className="text-sm flex gap-2">
                    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${h.action === "STORNO" ? "bg-red-500" : h.action === "RIKTHE" ? "bg-emerald-500" : "bg-violet-500"}`} />
                    <div>
                      <p><b>{h.userName ?? "—"}</b> {VEPRIMI[h.action] ?? h.action} <b>{FUSHA[h.field ?? ""] ?? h.field ?? ""}</b>
                        {h.action === "UPDATE" && <>: {shfaq(h.field, h.oldValue)} → {shfaq(h.field, h.newValue)}</>}
                        {(h.action === "STORNO" || h.action === "RIKTHE") && h.oldValue && <> {h.action === "STORNO" ? h.oldValue : h.newValue}</>}
                      </p>
                      <p className="text-xs text-slate-500">{new Date(h.createdAt).toLocaleString("sq-AL")}{h.reason ? ` · Arsyeja: ${h.reason}` : ""}</p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Mini({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: string }) {
  return (
    <div className="card p-3">
      <p className="text-xs text-slate-500">{label}</p>
      <p className={`text-lg font-bold ${tone ?? "text-slate-900 dark:text-white"}`}>{value}</p>
      {sub && <p className="text-[11px] text-slate-400">{sub}</p>}
    </div>
  );
}
