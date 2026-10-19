"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Printer, Save, Plus, Pencil, Trash2, Loader2, X } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { DEFAULT_ACADEMIC_YEAR } from "@/lib/academicYear";
import {
  PAVARESIA, NIVELI, ASISTENTJA, ORGANIZIMI, DOKUMENTET, MBESHTETJA, INSTRUMENTET, PERSHTATJET, VENDIMI, PERIUDHAT,
  emptyPia, emptyReview, type PiaData, type PiaReviewData,
} from "@/lib/pia";
import { buildPiaPrintHtml, type PiaStudent } from "@/lib/piaPrint";

interface Review { id: number; date: string; updatedByName: string | null; data: PiaReviewData }
interface Resp {
  canEdit: boolean; year: number; years: number[];
  student: PiaStudent;
  pia: { id: number; updatedAt: string; updatedByName: string | null; data: PiaData; reviews: Review[] } | null;
}

const today = () => new Date().toISOString().slice(0, 10);
const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v]);

function Checks({ options, value, onChange, disabled }: { options: readonly string[]; value: string[]; onChange: (v: string[]) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {options.map(o => (
        <label key={o} className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300">
          <input type="checkbox" disabled={disabled} checked={value.includes(o)} onChange={() => onChange(toggle(value, o))} className="rounded accent-primary-600" /> {o}
        </label>
      ))}
    </div>
  );
}

function Radios({ options, value, onChange, disabled, name }: { options: readonly { key: string; label: string }[] | readonly string[]; value: string; onChange: (v: string) => void; disabled?: boolean; name: string }) {
  const opts = (options as readonly (string | { key: string; label: string })[]).map(o => (typeof o === "string" ? { key: o, label: o } : o));
  return (
    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
      {opts.map(o => (
        <label key={o.key} className="flex items-center gap-1.5 text-sm text-slate-700 dark:text-slate-300" title={o.label}>
          <input type="radio" name={name} disabled={disabled} checked={value === o.key} onChange={() => onChange(o.key)}
            onClick={() => { if (value === o.key) onChange(""); }} className="accent-primary-600" />
          {o.key === o.label ? o.key : <><b>{o.key}</b><span className="text-xs text-slate-400 hidden sm:inline">{o.label}</span></>}
        </label>
      ))}
    </div>
  );
}

const Section = ({ n, title, children, hint }: { n: string; title: string; hint?: string; children: React.ReactNode }) => (
  <div className="card p-5 space-y-3">
    <h2 className="font-bold text-slate-800 dark:text-white"><span className="text-amber-500 mr-2">{n}</span>{title}</h2>
    {hint && <p className="text-xs text-slate-400 italic -mt-1">{hint}</p>}
    {children}
  </div>
);

export default function PiaPage() {
  return <Suspense fallback={null}><PiaInner /></Suspense>;
}

function PiaInner() {
  const params = useParams<{ studentId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const year = parseInt(search.get("year") || "") || DEFAULT_ACADEMIC_YEAR;
  const [resp, setResp] = useState<Resp | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<PiaData>(emptyPia());
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");
  const [editing, setEditing] = useState<{ id: number | null; date: string; data: PiaReviewData } | null>(null);

  const load = useCallback(async () => {
    const r = await fetch(`/api/pia/${params.studentId}?year=${year}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || "S'u lexua plani."); return; }
    setResp(d); setForm(d.pia?.data ?? emptyPia()); setDirty(false); setError("");
  }, [params.studentId, year]);
  useEffect(() => { load(); }, [load]);

  const set = <K extends keyof PiaData>(k: K, v: PiaData[K]) => { setForm(f => ({ ...f, [k]: v })); setDirty(true); };
  const ro = !resp?.canEdit;

  async function save() {
    setSaving(true); setMsg("");
    const r = await fetch(`/api/pia/${params.studentId}?year=${year}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ data: form }) });
    const d = await r.json().catch(() => ({}));
    setSaving(false);
    if (!r.ok) { setMsg(d.error || "Ruajtja dështoi."); return; }
    setMsg("U ruajt."); await load();
  }

  async function saveReview() {
    if (!editing) return;
    const url = editing.id ? `/api/pia/reviews/${editing.id}` : `/api/pia/${params.studentId}/reviews?year=${year}`;
    const r = await fetch(url, { method: editing.id ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date: editing.date, data: editing.data }) });
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { alert(d.error || "Ruajtja dështoi."); return; }
    setEditing(null); await load();
  }

  async function deleteReview(rv: Review) {
    if (!confirm(`Fshi vlerësimin e ${formatDate(rv.date)}?`)) return;
    const r = await fetch(`/api/pia/reviews/${rv.id}`, { method: "DELETE" });
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "Fshirja dështoi."); return; }
    await load();
  }

  function print(reviewId?: number) {
    if (!resp) return;
    const reviews = resp.pia?.reviews ?? [];
    const rv = reviewId ? reviews.find(r => r.id === reviewId) : reviews[reviews.length - 1];
    const w = window.open("", "_blank");
    if (!w) { alert("Lejo dritaret pop-up për të printuar."); return; }
    w.document.write(buildPiaPrintHtml(resp.student, year, form, rv ? { date: rv.date, data: rv.data } : null));
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  if (error) return <div className="p-6 text-red-500 text-sm">{error}</div>;
  if (!resp) return <div className="p-6 flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary-500" /></div>;

  const st = resp.student;
  const reviews = resp.pia?.reviews ?? [];
  const yearOpts = [...new Set([DEFAULT_ACADEMIC_YEAR, year, ...resp.years])].sort((a, b) => b - a);
  const parent = st.parentName || st.fatherName || st.motherName || "—";
  const phone = st.parentPhone || st.fatherPhone || st.motherPhone || "";

  return (
    <div className="p-4 lg:p-6 max-w-5xl mx-auto space-y-4 animate-fade-in">
      <div className="flex flex-wrap items-center gap-3">
        <Link href="/classes" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"><ArrowLeft className="w-5 h-5 text-slate-500" /></Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-slate-900 dark:text-white">Plani Individual i Arsimit (PIA)</h1>
          <p className="text-sm text-slate-500">{st.firstName} {st.lastName}{st.className ? ` · ${st.className}` : ""}</p>
        </div>
        <select value={year} onChange={e => router.push(`/classes/pia/${params.studentId}?year=${e.target.value}`)} className="form-input w-36">
          {yearOpts.map(y => <option key={y} value={y}>{y}/{y + 1}</option>)}
        </select>
        <button onClick={() => print()} className="btn-secondary"><Printer className="w-4 h-4" /> Printo</button>
        {!ro && <button onClick={save} disabled={saving} className="btn-primary">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Ruaj</button>}
      </div>
      {(msg || dirty) && <p className={`text-xs ${msg && msg !== "U ruajt." ? "text-red-600" : dirty ? "text-amber-600" : "text-green-600"}`}>{dirty ? "Ka ndryshime të paruajtura." : msg}</p>}
      {!resp.pia && <p className="text-sm rounded-xl bg-blue-50 dark:bg-blue-900/20 text-blue-800 dark:text-blue-300 px-3 py-2">Ky nxënës s&apos;ka ende PIA për {year}/{year + 1}. Plotëso dhe shtyp &quot;Ruaj&quot;.</p>}

      <Section n="01" title="Të dhënat e nxënësit">
        <div className="grid sm:grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <p><span className="text-slate-400">Nxënësi/ja:</span> <b>{st.firstName} {st.lastName}</b></p>
          <p><span className="text-slate-400">Data e lindjes:</span> {st.birthDate ? formatDate(st.birthDate) : "—"}</p>
          <p><span className="text-slate-400">Klasa:</span> {st.className ?? "—"}</p>
          <p><span className="text-slate-400">Prindi / kontakti:</span> {parent}{phone ? ` · ${phone}` : ""}</p>
          {st.assistantName && <p><span className="text-slate-400">Asistentja:</span> {st.assistantName}</p>}
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><label className="label">Lënda/lëndët</label><input disabled={ro} className="input" value={form.lendet} onChange={e => set("lendet", e.target.value)} /></div>
          <div><label className="label">Mësimdhënësi/ja</label><input disabled={ro} className="input" value={form.mesimdhenesi} onChange={e => set("mesimdhenesi", e.target.value)} /></div>
          <div>
            <label className="label">Asistentja</label>
            <div className="flex items-center gap-4 flex-wrap">
              <Radios name="asist" disabled={ro} options={ASISTENTJA} value={form.asistentja} onChange={v => set("asistentja", v)} />
              <span className="flex items-center gap-1 text-sm text-slate-500">Orë/javë <input disabled={ro} className="input w-16 py-1" value={form.oreJave} onChange={e => set("oreJave", e.target.value)} /></span>
            </div>
          </div>
          <div><label className="label">Organizimi</label><Radios name="org" disabled={ro} options={ORGANIZIMI} value={form.organizimi} onChange={v => set("organizimi", v)} /></div>
          <div className="flex gap-2">
            <div className="flex-1"><label className="label">Periudha nga</label><input type="date" disabled={ro} className="input" value={form.nga} onChange={e => set("nga", e.target.value)} /></div>
            <div className="flex-1"><label className="label">Deri</label><input type="date" disabled={ro} className="input" value={form.deri} onChange={e => set("deri", e.target.value)} /></div>
          </div>
          <div><label className="label">Data e rishikimit</label><input type="date" disabled={ro} className="input" value={form.dataRishikimit} onChange={e => set("dataRishikimit", e.target.value)} /></div>
        </div>
        <div>
          <label className="label">Dokumente në dosje</label>
          <div className="flex flex-wrap items-center gap-4">
            <Checks disabled={ro} options={DOKUMENTET} value={form.dokumentet} onChange={v => set("dokumentet", v)} />
            <input disabled={ro} className="input w-56 py-1" placeholder="Tjetër..." value={form.dokumentTjeter} onChange={e => set("dokumentTjeter", e.target.value)} />
          </div>
        </div>
      </Section>

      <Section n="02" title="Gjendja aktuale dhe fushat e punës" hint="Zgjidhni 2–3 fusha prioritare (p.sh. leximi dhe shkrimi, matematika, komunikimi, vëmendja, sjellja, zhvillimi social-emocional, pavarësia). Përshkruani shkurt, bazuar në vëzhgim.">
        <div className="space-y-3">
          {form.fushat.map((f, i) => (
            <div key={i} className="grid sm:grid-cols-[1fr_2fr_2fr] gap-2">
              <input disabled={ro} className="input" placeholder={`Fusha ${i + 1}`} value={f.fusha} onChange={e => set("fushat", form.fushat.map((x, j) => j === i ? { ...x, fusha: e.target.value } : x))} />
              <textarea disabled={ro} rows={2} className="input" placeholder="Çfarë bën tani" value={f.cfareBen} onChange={e => set("fushat", form.fushat.map((x, j) => j === i ? { ...x, cfareBen: e.target.value } : x))} />
              <textarea disabled={ro} rows={2} className="input" placeholder="Vështirësitë / nevojat" value={f.veshtiresite} onChange={e => set("fushat", form.fushat.map((x, j) => j === i ? { ...x, veshtiresite: e.target.value } : x))} />
            </div>
          ))}
          <div><label className="label">Si mëson më mirë / çfarë e motivon</label><textarea disabled={ro} rows={2} className="input" value={form.motivimi} onChange={e => set("motivimi", e.target.value)} /></div>
        </div>
      </Section>

      <Section n="03" title="Rezultatet dhe planifikimi i punës" hint="Formula: “Deri në [afati], nxënësi/ja do të [aftësia e vëzhgueshme] me [kriteri i suksesit].” Rekomandohen 3–4 rezultate për periudhë.">
        <div className="space-y-4">
          {form.rezultatet.map((r, i) => (
            <div key={i} className="grid sm:grid-cols-[40px_1fr] gap-2">
              <p className="font-bold text-slate-700 dark:text-slate-200 pt-2">R{i + 1}</p>
              <div className="space-y-2">
                <textarea disabled={ro} rows={2} className="input" placeholder="Rezultati i synuar (me kriter dhe afat)" value={r.rezultati} onChange={e => set("rezultatet", form.rezultatet.map((x, j) => j === i ? { ...x, rezultati: e.target.value } : x))} />
                <div className="flex flex-wrap gap-x-8 gap-y-2 text-sm">
                  <div className="flex items-center gap-2"><span className="text-slate-400 text-xs">Pavarësia</span><Radios name={`pav${i}`} disabled={ro} options={PAVARESIA} value={r.pavaresia} onChange={v => set("rezultatet", form.rezultatet.map((x, j) => j === i ? { ...x, pavaresia: v } : x))} /></div>
                  <div className="flex items-center gap-2"><span className="text-slate-400 text-xs">Mbështetja</span><Checks disabled={ro} options={MBESHTETJA} value={r.mbeshtetja} onChange={v => set("rezultatet", form.rezultatet.map((x, j) => j === i ? { ...x, mbeshtetja: v } : x))} /></div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section n="04" title="Instrumentet dhe përshtatjet e vlerësimit">
        <div><label className="label">Instrumentet</label><Checks disabled={ro} options={INSTRUMENTET} value={form.instrumentet} onChange={v => set("instrumentet", v)} /></div>
        <div><label className="label">Përshtatjet</label><Checks disabled={ro} options={PERSHTATJET} value={form.pershtatjet} onChange={v => set("pershtatjet", v)} /></div>
        <div><label className="label">Zvogëlimi i mbështetjes — si do ta zvogëlojmë gradualisht ndihmën e asistentes</label><textarea disabled={ro} rows={2} className="input" value={form.zvogelimi} onChange={e => set("zvogelimi", e.target.value)} /></div>
      </Section>

      {/* Ecuria */}
      <div className="card p-5 space-y-3">
        <h2 className="font-bold text-slate-800 dark:text-white">Ecuria e nxënësit</h2>
        {reviews.length === 0 ? <p className="text-sm text-slate-400">Ende s&apos;ka vlerësime. Shtoje të parin më poshtë.</p> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-slate-500 border-b border-slate-200 dark:border-slate-700">
                  <th className="text-left py-2 pr-3">Rezultati</th>
                  {reviews.map(rv => <th key={rv.id} className="py-2 px-2 text-center whitespace-nowrap">{formatDate(rv.date)}{rv.data.periudha ? <span className="block font-normal text-slate-400">{rv.data.periudha}</span> : null}</th>)}
                </tr>
              </thead>
              <tbody>
                {form.rezultatet.map((r, i) => (
                  <tr key={i} className="border-b border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-3 max-w-xs"><b>R{i + 1}</b> <span className="text-slate-500 text-xs line-clamp-1">{r.rezultati || "—"}</span></td>
                    {reviews.map(rv => {
                      const x = rv.data.rezultatet[i];
                      const n = NIVELI.find(v => v.key === x?.niveli);
                      return (
                        <td key={rv.id} className="py-2 px-2 text-center">
                          {n ? <span className={`badge text-xs ${n.cls}`} title={n.label}>{n.key}</span> : <span className="text-slate-300">—</span>}
                          {x?.pavaresia && <span className="block text-[10px] text-slate-400 mt-0.5">{x.pavaresia}</span>}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="text-[11px] text-slate-400 mt-2">{NIVELI.map(n => `${n.key} = ${n.label}`).join(" · ")} · P / MP / MA = pavarësia</p>
          </div>
        )}
      </div>

      {/* 05–06 Vlerësimet */}
      <div className="card p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-bold text-slate-800 dark:text-white"><span className="text-amber-500 mr-2">05–06</span>Vlerësimet, progresi dhe rekomandimet</h2>
          {!ro && resp.pia && !editing && (
            <button onClick={() => setEditing({ id: null, date: today(), data: emptyReview() })} className="btn-primary text-sm"><Plus className="w-4 h-4" /> Shto vlerësim</button>
          )}
        </div>
        {!resp.pia && <p className="text-xs text-slate-400">Ruaje fillimisht planin, pastaj shto vlerësimet.</p>}
        {editing && <ReviewEditor value={editing} rez={form.rezultatet.map(r => r.rezultati)} onChange={setEditing} onCancel={() => setEditing(null)} onSave={saveReview} />}
        <ul className="divide-y divide-slate-100 dark:divide-slate-800">
          {[...reviews].reverse().map(rv => (
            <li key={rv.id} className="py-2.5 flex items-start gap-3 text-sm">
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-slate-800 dark:text-slate-100">{formatDate(rv.date)}{rv.data.periudha ? ` · ${rv.data.periudha}` : ""}</p>
                <p className="text-xs text-slate-500 truncate">{rv.data.progresi || rv.data.rekomandimet || "—"}</p>
                {rv.data.vendimi.length > 0 && <p className="text-xs text-primary-600">{rv.data.vendimi.join(" · ")}</p>}
              </div>
              <button onClick={() => print(rv.id)} title="Printo me këtë vlerësim" className="p-1 rounded text-slate-400 hover:text-primary-600"><Printer className="w-4 h-4" /></button>
              {!ro && <>
                <button onClick={() => setEditing({ id: rv.id, date: rv.date.slice(0, 10), data: rv.data })} title="Ndrysho" className="p-1 rounded text-slate-400 hover:text-primary-600"><Pencil className="w-4 h-4" /></button>
                <button onClick={() => deleteReview(rv)} title="Fshi" className="p-1 rounded text-slate-300 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
              </>}
            </li>
          ))}
        </ul>
      </div>
      {resp.pia?.updatedByName && <p className="text-xs text-slate-400">Ruajtur së fundi nga {resp.pia.updatedByName}, {formatDate(resp.pia.updatedAt)}.</p>}
    </div>
  );
}

function ReviewEditor({ value, rez, onChange, onCancel, onSave }: {
  value: { id: number | null; date: string; data: PiaReviewData }; rez: string[];
  onChange: (v: { id: number | null; date: string; data: PiaReviewData }) => void; onCancel: () => void; onSave: () => void;
}) {
  const d = value.data;
  const setD = (patch: Partial<PiaReviewData>) => onChange({ ...value, data: { ...d, ...patch } });
  const setR = (i: number, patch: Partial<PiaReviewData["rezultatet"][number]>) => setD({ rezultatet: d.rezultatet.map((x, j) => j === i ? { ...x, ...patch } : x) });
  return (
    <div className="rounded-xl border-2 border-primary-200 dark:border-primary-800 p-4 space-y-4">
      <div className="flex items-center justify-between">
        <p className="font-semibold text-slate-800 dark:text-white">{value.id ? "Ndrysho vlerësimin" : "Vlerësim i ri"}</p>
        <button onClick={onCancel} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4 text-slate-400" /></button>
      </div>
      <div className="grid sm:grid-cols-2 gap-3">
        <div><label className="label">Data</label><input type="date" className="input" value={value.date} onChange={e => onChange({ ...value, date: e.target.value })} /></div>
        <div>
          <label className="label">Periudha (opsionale)</label>
          <input className="input" list="pia-periudhat" placeholder="p.sh. Tremujori I, ose lëre bosh" value={d.periudha} onChange={e => setD({ periudha: e.target.value })} />
          <datalist id="pia-periudhat">{PERIUDHAT.map(p => <option key={p} value={p} />)}</datalist>
        </div>
      </div>
      {d.rezultatet.map((r, i) => (
        <div key={i} className="grid sm:grid-cols-[40px_1fr] gap-2">
          <p className="font-bold text-slate-700 dark:text-slate-200 pt-2" title={rez[i]}>R{i + 1}</p>
          <div className="space-y-2">
            {rez[i] && <p className="text-xs text-slate-400 italic">{rez[i]}</p>}
            <textarea rows={2} className="input" placeholder="Çfarë arriti (evidenca)" value={r.evidenca} onChange={e => setR(i, { evidenca: e.target.value })} />
            <div className="flex flex-wrap gap-x-8 gap-y-2">
              <div className="flex items-center gap-2"><span className="text-slate-400 text-xs">Niveli</span><Radios name={`niv${i}`} options={NIVELI} value={r.niveli} onChange={v => setR(i, { niveli: v })} /></div>
              <div className="flex items-center gap-2"><span className="text-slate-400 text-xs">Pavarësia</span><Radios name={`rpav${i}`} options={PAVARESIA} value={r.pavaresia} onChange={v => setR(i, { pavaresia: v })} /></div>
            </div>
            <input className="input" placeholder="Ku ka ende nevojë / çfarë ndryshojmë" value={r.nevojat} onChange={e => setR(i, { nevojat: e.target.value })} />
          </div>
        </div>
      ))}
      <div><label className="label">Progresi kryesor</label><textarea rows={2} className="input" value={d.progresi} onChange={e => setD({ progresi: e.target.value })} /></div>
      <div><label className="label">Rekomandimet për periudhën e ardhshme</label><textarea rows={2} className="input" value={d.rekomandimet} onChange={e => setD({ rekomandimet: e.target.value })} /></div>
      <div><label className="label">Vendimi i ekipit</label><Checks options={VENDIMI} value={d.vendimi} onChange={v => setD({ vendimi: v })} /></div>
      <div className="flex gap-2 justify-end">
        <button onClick={onCancel} className="btn-secondary">Anulo</button>
        <button onClick={onSave} className="btn-primary"><Save className="w-4 h-4" /> Ruaj vlerësimin</button>
      </div>
    </div>
  );
}
