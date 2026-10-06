"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { Loader2 } from "lucide-react";
import { STATUS_UI, REQUEST_FLOW, formatDuration, type StatusKey } from "@/lib/materialStatusUi";
import { formatCurrency } from "@/lib/utils";
import { StatCard, fmtD } from "./ui";
import type { ModuleData } from "./types";

// Materialet → Analitika: periudha, kartelat, statuset (shirit i ndarë),
// kërkesat sipas muajit (Sht → Qer), materialet dhe mësimdhënëset kryesore.

interface Analytics {
  period: "month" | "year" | "custom"; from: string; to: string; schoolYear: string;
  requests: number; items: number; quantity: number;
  decisionMs: number | null; deliveryMs: number | null; spend: number | null;
  statusCounts: Record<StatusKey, number>;
  monthly: { label: string; count: number }[];
  topMaterials: { name: string; unit: string; quantity: number; requests: number }[];
  topTeachers: { id: number; name: string; count: number }[];
}
type Period = "month" | "year" | "custom";
const PERIODS: { key: Period; label: string }[] = [{ key: "month", label: "Ky muaj" }, { key: "year", label: "Ky vit shkollor" }, { key: "custom", label: "Periudhë tjetër" }];
const STATUS_ORDER: StatusKey[] = [...REQUEST_FLOW, "REJECTED"];

export default function AnalyticsTab({ data }: { data: ModuleData }) {
  const { setExporter } = data;
  const [period, setPeriod] = useState<Period>("month");
  const today = new Date().toISOString().slice(0, 10);
  const [from, setFrom] = useState(today.slice(0, 8) + "01");
  const [to, setTo] = useState(today);
  const [a, setA] = useState<Analytics | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const qs = new URLSearchParams({ period });
    if (period === "custom") { qs.set("from", from); qs.set("to", to); }
    setLoading(true); setError("");
    fetch(`/api/material-requests/analytics?${qs}`)
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Analitika s'u ngarkua."); setA(d); })
      .catch(e => setError(e instanceof Error ? e.message : "Analitika s'u ngarkua."))
      .finally(() => setLoading(false));
  }, [period, from, to]);

  const periodWord = period === "month" ? "këtë muaj" : period === "year" ? "këtë vit shkollor" : "në periudhë";

  useEffect(() => {
    if (!a) { setExporter(null); return; }
    setExporter(() => {
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([
        ["Periudha", `${fmtD(a.from)} – ${fmtD(a.to)}`],
        ["Kërkesa", a.requests], ["Artikuj", a.items], ["Sasia", a.quantity],
        ["Koha deri në vendim", formatDuration(a.decisionMs) ?? "—"], ["Koha deri në dorëzim", formatDuration(a.deliveryMs) ?? "—"],
        ["Shpenzimi (€)", a.spend ?? "—"], [],
        ["Statusi", "Kërkesa"], ...STATUS_ORDER.map(k => [STATUS_UI[k].label, a.statusCounts[k] ?? 0]),
      ]), "Përmbledhje");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Materiali", "Sasia", "Njësia", "Kërkesa"], ...a.topMaterials.map(m => [m.name, m.quantity, m.unit, m.requests])]), "Materialet");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([["Mësimdhënësi", "Kërkesa"], ...a.topTeachers.map(t => [t.name, t.count])]), "Mësimdhënësit");
      XLSX.writeFile(wb, `Analitika-Materiale-${fmtD(new Date()).replace(/\//g, "-")}.xlsx`);
    });
    return () => setExporter(null);
  }, [a, setExporter]);

  const total = a ? STATUS_ORDER.reduce((s, k) => s + (a.statusCounts[k] ?? 0), 0) : 0;
  const maxMonth = a ? Math.max(1, ...a.monthly.map(m => m.count)) : 1;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2.5">
        <div className="inline-flex gap-1 rounded-[10px] border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1" role="group" aria-label="Periudha">
          {PERIODS.map(p => (
            <button key={p.key} type="button" aria-pressed={period === p.key} onClick={() => setPeriod(p.key)}
              className={`px-3 py-1.5 rounded-[7px] text-[13px] ${period === p.key ? "bg-slate-900 text-white font-bold dark:bg-white dark:text-slate-900" : "text-slate-600 dark:text-slate-300 font-semibold"}`}>{p.label}</button>
          ))}
        </div>
        {period === "custom" && (
          <div className="flex items-center gap-2 text-sm">
            <label className="sr-only" htmlFor="an-from">Nga</label>
            <input id="an-from" type="date" value={from} max={to} onChange={e => setFrom(e.target.value)} className="form-input w-auto text-sm" />
            <span className="text-slate-500">–</span>
            <label className="sr-only" htmlFor="an-to">Deri</label>
            <input id="an-to" type="date" value={to} min={from} onChange={e => setTo(e.target.value)} className="form-input w-auto text-sm" />
          </div>
        )}
        {loading && <Loader2 className="w-4 h-4 animate-spin text-slate-400" aria-label="Duke ngarkuar" />}
      </div>

      {error ? <div className="card p-8 text-center text-sm text-red-600">{error}</div>
        : !a ? <div className="card p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary-400" /></div>
        : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              <StatCard label={`Kërkesa ${periodWord}`} value={a.requests} sub={`${a.items} artikuj · ${a.quantity} copë`} />
              <StatCard label="Koha deri në vendim" value={formatDuration(a.decisionMs) ?? "—"} sub="mesatarisht, nga dërgimi te aprovimi" />
              <StatCard label="Koha deri në dorëzim" value={formatDuration(a.deliveryMs) ?? "—"} sub="mesatarisht, nga dërgimi te dorëzimi" />
              <StatCard label="Shpenzimi" value={a.spend !== null ? formatCurrency(a.spend) : "—"} sub={a.spend !== null ? "nga porositë me çmim" : "Shto çmimet te porositë që të llogaritet"} />
            </div>

            {a.requests === 0 ? (
              <div className="card p-10 text-center text-sm text-slate-500">Nuk ka të dhëna për këtë periudhë.</div>
            ) : (
              <section className="card p-5 space-y-3" aria-labelledby="an-status">
                <h2 id="an-status" className="text-[15px] font-extrabold text-slate-900 dark:text-white">Kërkesat sipas statusit</h2>
                <div className="flex h-3.5 rounded-full overflow-hidden bg-slate-200 dark:bg-slate-700" role="img"
                  aria-label={STATUS_ORDER.map(k => `${STATUS_UI[k].label} ${a.statusCounts[k] ?? 0}`).join(", ")}>
                  {STATUS_ORDER.map(k => (a.statusCounts[k] ?? 0) > 0 && <span key={k} className={STATUS_UI[k].dot} style={{ width: `${((a.statusCounts[k] ?? 0) / total) * 100}%` }} />)}
                </div>
                <div className="flex flex-wrap gap-x-5 gap-y-2">
                  {STATUS_ORDER.map(k => (
                    <Link key={k} href={`/materialet/kerkesat?s=${k}`} className="flex items-center gap-2 text-[13px] text-slate-700 dark:text-slate-200 hover:underline">
                      <span className={`w-2.5 h-2.5 rounded-[3px] ${STATUS_UI[k].dot}`} aria-hidden />{STATUS_UI[k].label}<b>{a.statusCounts[k] ?? 0}</b>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            <div className="grid gap-4 grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3">
              <section className="card p-5 space-y-3" aria-labelledby="an-month">
                <h2 id="an-month" className="text-[15px] font-extrabold text-slate-900 dark:text-white">Kërkesat sipas muajit <span className="font-semibold text-slate-500 text-[13px]">{a.schoolYear}</span></h2>
                <div className="flex gap-1.5 items-end h-[170px]">
                  {a.monthly.map(m => (
                    <div key={m.label} className="flex-1 flex flex-col items-center justify-end gap-1.5 h-full">
                      <span className="text-xs font-bold text-slate-900 dark:text-white">{m.count || ""}</span>
                      <div className={`w-3/5 rounded-t-md ${m.count ? "bg-primary-600" : "bg-slate-200 dark:bg-slate-700"}`}
                        style={{ height: m.count ? `${Math.max(6, (m.count / maxMonth) * 120)}px` : "2px" }} />
                      <span className="text-xs text-slate-500 dark:text-slate-400">{m.label}</span>
                    </div>
                  ))}
                </div>
              </section>
              <section className="card p-5" aria-labelledby="an-mat">
                <h2 id="an-mat" className="text-[15px] font-extrabold text-slate-900 dark:text-white mb-2">Materialet më të kërkuara</h2>
                {a.topMaterials.length === 0 ? <p className="text-sm text-slate-500 py-2">Nuk ka të dhëna për këtë periudhë.</p>
                  : a.topMaterials.map((m, i) => (
                    <Link key={`${m.name}|${m.unit}`} href={`/materialet/kerkesat?q=${encodeURIComponent(m.name)}`}
                      className="flex justify-between gap-3 py-2.5 border-t border-slate-100 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-100 hover:text-primary-700">
                      <span><span className="inline-block w-6 text-slate-500">{i + 1}.</span>{m.name}</span><b className="whitespace-nowrap">{m.quantity} {m.unit}</b>
                    </Link>
                  ))}
              </section>
              <section className="card p-5" aria-labelledby="an-tea">
                <h2 id="an-tea" className="text-[15px] font-extrabold text-slate-900 dark:text-white mb-2">Mësimdhënëset me më shumë kërkesa</h2>
                {a.topTeachers.length === 0 ? <p className="text-sm text-slate-500 py-2">Nuk ka të dhëna për këtë periudhë.</p>
                  : a.topTeachers.map((t, i) => (
                    <Link key={t.id} href={`/materialet/mesimdhenesit/${t.id}`}
                      className="flex justify-between gap-3 py-2.5 border-t border-slate-100 dark:border-slate-700 text-sm text-slate-800 dark:text-slate-100 hover:text-primary-700">
                      <span><span className="inline-block w-6 text-slate-500">{i + 1}.</span>{t.name}</span><b>{t.count} {t.count === 1 ? "kërkesë" : "kërkesa"}</b>
                    </Link>
                  ))}
              </section>
            </div>
          </>
        )}
    </div>
  );
}
