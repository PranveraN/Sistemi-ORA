"use client";

import { useEffect, useState } from "react";
import { ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine, Cell, LabelList } from "recharts";
import { eur } from "@/components/banka/shared";

// Grafikonët e Bankës. Ngjyrat: slot 1 (blu) / slot 2 (portokalli) të paletës së validuar
// (CVD ΔE 24.7 light, kontrast ≥ 3:1); rezultati përdor çiftin divergjent blu ↔ kuq.
// Pamja e errët ka hapat e vet (jo kthim automatik).

const PAL = {
  light: { s1: "#2a78d6", s2: "#eb6834", neg: "#e34948", grid: "#e7e6e2", axis: "#52514e" },
  dark:  { s1: "#3987e5", s2: "#d95926", neg: "#e66767", grid: "#383835", axis: "#c3c2b7" },
};
const MUAJ = ["Jan", "Shk", "Mar", "Pri", "Maj", "Qer", "Kor", "Gus", "Sht", "Tet", "Nën", "Dhj"];
const k = (c: number) => { const v = c / 100; return Math.abs(v) >= 1000 ? `${Math.round(v / 1000)}k` : `${Math.round(v)}`; };

interface Data {
  viti: number; vitet: number[]; gjitha: boolean; paKlasifikuara: number; importuarGjithsej: number; rreshtaGjithsej: number;
  muajt: { muaji: number; kredi: number; debi: number; teHyrat: number; shpenzimet: number; rezultati: number; gjendja: number | null }[];
  shpenzimeZerat: { emri: string; shuma: number }[];
  vitetData: { viti: number; kredi: number; debi: number; teHyrat: number; shpenzimet: number; rezultati: number }[];
}

function useDark() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    const el = document.documentElement;
    const upd = () => setDark(el.classList.contains("dark"));
    upd();
    const o = new MutationObserver(upd);
    o.observe(el, { attributes: true, attributeFilter: ["class"] });
    return () => o.disconnect();
  }, []);
  return dark;
}

function TipBox({ active, payload, label }: { active?: boolean; payload?: { name: string; value: number; color: string }[]; label?: string | number }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-800 px-3 py-2 text-xs shadow-md">
      <p className="font-semibold text-slate-800 dark:text-slate-100 mb-1">{label}</p>
      {payload.map(p => (
        <p key={p.name} className="flex items-center gap-1.5 text-slate-600 dark:text-slate-300">
          <span className="inline-block w-2.5 h-2.5 rounded-sm" style={{ background: p.color }} />{p.name}: <b className="text-slate-900 dark:text-white">{eur(p.value)}</b>
        </p>
      ))}
    </div>
  );
}

function Card({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) {
  return (
    <div className="card p-4">
      <h3 className="font-bold text-slate-900 dark:text-white text-sm">{title}</h3>
      {sub && <p className="text-xs text-slate-500 mb-2">{sub}</p>}
      {children}
    </div>
  );
}

export default function Grafikone() {
  const dark = useDark();
  const c = dark ? PAL.dark : PAL.light;
  const [viti, setViti] = useState<string>("");
  const [gjitha, setGjitha] = useState<boolean | null>(null);
  const [d, setD] = useState<Data | null>(null);
  const [tabela, setTabela] = useState(false);

  useEffect(() => {
    const q = new URLSearchParams({ ...(viti ? { viti } : {}), gjitha: gjitha === false ? "0" : "1" });
    fetch(`/api/banka/grafikone?${q}`).then(r => r.ok ? r.json() : null).then((x: Data | null) => {
      if (!x) return;
      // Pa asnjë rresht të importuar: shfaq të dhënat paraprake
      if (gjitha === null) setGjitha(x.importuarGjithsej === 0 ? true : false);
      setD(x);
    });
  }, [viti, gjitha]);

  if (!d) return <div className="py-10 text-center text-sm text-slate-400">Duke ngarkuar…</div>;
  if (!d.rreshtaGjithsej) return <div className="card py-10 text-center text-sm text-slate-400">S&apos;ka ende të dhëna banke — ngarko një ekstrakt.</div>;

  const muajt = d.muajt.map(m => ({ ...m, emri: MUAJ[m.muaji - 1] }));
  const top = d.shpenzimeZerat.slice(0, 8);
  const tjera = d.shpenzimeZerat.slice(8).reduce((s, z) => s + z.shuma, 0);
  const zerat = tjera > 0 ? [...top, { emri: "Të tjera", shuma: tjera }] : top;
  const axis = { stroke: c.axis, fontSize: 11, tickLine: false, axisLine: false } as const;
  const sumY = (k2: "teHyrat" | "shpenzimet" | "rezultati") => muajt.reduce((s, m) => s + m[k2], 0);

  return (
    <div className="space-y-4">
      <div className="card p-3 flex flex-wrap items-center gap-3">
        <select value={viti || d.viti} onChange={e => setViti(e.target.value)} className="form-input w-auto py-1.5 text-sm">
          {[...d.vitet].reverse().map(y => <option key={y} value={y}>{y}</option>)}
        </select>
        <div className="flex rounded-lg border border-slate-200 dark:border-slate-600 overflow-hidden text-sm">
          <button onClick={() => setGjitha(false)} className={`px-3 py-1.5 ${gjitha === false ? "bg-primary-600 text-white" : "text-slate-600 dark:text-slate-300"}`}>Vetëm të importuarat</button>
          <button onClick={() => setGjitha(true)} className={`px-3 py-1.5 ${gjitha ? "bg-primary-600 text-white" : "text-slate-600 dark:text-slate-300"}`}>Edhe të paimportuarat</button>
        </div>
        <button onClick={() => setTabela(t => !t)} className="text-xs text-slate-500 underline ml-auto">{tabela ? "Fshih tabelën" : "Shfaq si tabelë"}</button>
        {d.gjitha && <p className="w-full text-xs text-amber-700 dark:text-amber-300">Shifra paraprake — përfshijnë edhe rreshtat që s&apos;janë importuar ende.</p>}
        {d.paKlasifikuara > 0 && <p className="w-full text-xs text-slate-500">{d.paKlasifikuara} rreshta të {d.viti} janë pa zë — s&apos;hyjnë te të hyrat/shpenzimet derisa t&apos;i klasifikosh.</p>}
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[["Të hyrat", sumY("teHyrat"), "text-emerald-700 dark:text-emerald-400"], ["Shpenzimet", sumY("shpenzimet"), "text-rose-700 dark:text-rose-400"],
          ["Rezultati", sumY("rezultati"), sumY("rezultati") >= 0 ? "text-emerald-700 dark:text-emerald-400" : "text-rose-700 dark:text-rose-400"],
          ["Gjendja në fund", [...muajt].reverse().find(m => m.gjendja !== null)?.gjendja ?? 0, "text-slate-900 dark:text-white"]].map(([t, v, cl]) => (
          <div key={t as string} className="card p-4"><p className="text-xs text-slate-500">{t as string} {d.viti}</p><p className={`text-xl font-bold ${cl}`}>{eur(v as number)}</p></div>
        ))}
      </div>

      {tabela && (
        <div className="card overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/60"><tr>{["Muaji", "Hyrje në bankë", "Dalje nga banka", "Të hyrat", "Shpenzimet", "Rezultati", "Gjendja"].map(h => <th key={h} className="table-header text-right first:text-left">{h}</th>)}</tr></thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
              {muajt.map(m => (
                <tr key={m.muaji}>{[m.emri, eur(m.kredi), eur(m.debi), eur(m.teHyrat), eur(m.shpenzimet), eur(m.rezultati), m.gjendja === null ? "—" : eur(m.gjendja)].map((v, i) => <td key={i} className={`table-cell py-1.5 ${i ? "text-right" : ""}`}>{v}</td>)}</tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Card title={`Hyrje dhe dalje në bankë — ${d.viti}`} sub="Të gjitha lëvizjet e llogarisë sipas muajve (pavarësisht zërit)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={muajt} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="emri" {...axis} />
              <YAxis tickFormatter={k} {...axis} width={40} />
              <Tooltip content={<TipBox />} cursor={{ fill: c.grid, opacity: 0.4 }} />
              <Legend wrapperStyle={{ fontSize: 12, color: c.axis }} iconType="square" />
              <Bar dataKey="kredi" name="Hyrje" fill={c.s1} radius={[4, 4, 0, 0]} maxBarSize={18} />
              <Bar dataKey="debi" name="Dalje" fill={c.s2} radius={[4, 4, 0, 0]} maxBarSize={18} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title={`Rezultati i muajit — ${d.viti}`} sub="Të hyrat − shpenzimet (sipas zërave). Blu = fitim, e kuqe = humbje.">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={muajt} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="emri" {...axis} />
              <YAxis tickFormatter={k} {...axis} width={40} />
              <ReferenceLine y={0} stroke={c.axis} strokeOpacity={0.6} />
              <Tooltip content={<TipBox />} cursor={{ fill: c.grid, opacity: 0.4 }} />
              <Bar dataKey="rezultati" name="Rezultati" radius={[4, 4, 4, 4]} maxBarSize={22}>
                {muajt.map(m => <Cell key={m.muaji} fill={m.rezultati >= 0 ? c.s1 : c.neg} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title={`Gjendja e llogarisë — ${d.viti}`} sub="Paratë në llogari në fund të çdo muaji">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={muajt} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={c.grid} />
              <XAxis dataKey="emri" {...axis} />
              <YAxis tickFormatter={k} {...axis} width={40} />
              <Tooltip content={<TipBox />} cursor={{ stroke: c.axis, strokeDasharray: "3 3" }} />
              <Line type="monotone" dataKey="gjendja" name="Gjendja" stroke={c.s1} strokeWidth={2} dot={{ r: 4, strokeWidth: 2, fill: dark ? "#1e293b" : "#fff" }} connectNulls={false} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title={`Shpenzimet sipas zërit — ${d.viti}`} sub={zerat.length ? "Zërat me llojin \"Shpenzim\", nga më i madhi" : "S'ka ende shpenzime të klasifikuara për këtë vit"}>
          <ResponsiveContainer width="100%" height={Math.max(160, zerat.length * 30 + 20)}>
            <BarChart data={zerat} layout="vertical" margin={{ top: 4, right: 56, left: 4, bottom: 4 }}>
              <XAxis type="number" hide />
              <YAxis type="category" dataKey="emri" {...axis} width={150} />
              <Tooltip content={<TipBox />} cursor={{ fill: c.grid, opacity: 0.4 }} />
              <Bar dataKey="shuma" name="Shpenzimet" fill={c.s1} radius={[0, 4, 4, 0]} maxBarSize={18}>
                <LabelList dataKey="shuma" position="right" formatter={(v: number) => eur(v)} style={{ fontSize: 11, fill: c.axis }} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card title="Krahasimi i viteve" sub="Të hyrat dhe shpenzimet (sipas zërave) për çdo vit kalendarik">
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={d.vitetData} barGap={2} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid vertical={false} stroke={c.grid} />
            <XAxis dataKey="viti" {...axis} />
            <YAxis tickFormatter={k} {...axis} width={44} />
            <Tooltip content={<TipBox />} cursor={{ fill: c.grid, opacity: 0.4 }} />
            <Legend wrapperStyle={{ fontSize: 12, color: c.axis }} iconType="square" />
            <Bar dataKey="teHyrat" name="Të hyrat" fill={c.s1} radius={[4, 4, 0, 0]} maxBarSize={28} />
            <Bar dataKey="shpenzimet" name="Shpenzimet" fill={c.s2} radius={[4, 4, 0, 0]} maxBarSize={28} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
