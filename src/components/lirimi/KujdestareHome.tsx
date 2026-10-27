"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShieldAlert, ChevronRight, Users, DoorOpen } from "lucide-react";
import { ARSYET, STATUSET, fmtDay, sotDay, type KerkeseRow } from "./shared";

type Nxenes = { id: number; emri: string; mbiemri: string; prindi: string | null; telefoni: string | null };

export default function KujdestareHome({ paQasje }: { paQasje: boolean }) {
  const [tab, setTab] = useState<"kerkesat" | "nxenesit">("kerkesat");
  const [kerkesat, setKerkesat] = useState<KerkeseRow[] | null>(null);
  const [nxenesit, setNxenesit] = useState<Nxenes[] | null>(null);
  const [klasa, setKlasa] = useState("");

  useEffect(() => {
    fetch("/api/kujdestare/kerkesat").then(r => r.json()).then(d => { setKerkesat(d.kerkesat ?? []); setKlasa(d.klasa ?? ""); }).catch(() => setKerkesat([]));
    fetch("/api/kujdestare/nxenesit").then(r => r.json()).then(d => setNxenesit(d.nxenesit ?? [])).catch(() => setNxenesit([]));
  }, []);

  const pritje = (kerkesat ?? []).filter(k => k.statusi === "NE_PRITJE").length;
  const tabCls = (t: string) => `px-3 py-2 text-sm font-medium border-b-2 ${tab === t ? "border-primary-600 text-primary-700" : "border-transparent text-slate-500 hover:text-slate-800"}`;

  return (
    <div className="space-y-4">
      {paQasje && (
        <div role="alert" className="p-3 rounded-xl bg-red-50 border border-red-200 text-sm text-red-700 flex items-center gap-2">
          <ShieldAlert className="w-4 h-4" /> Nuk keni qasje në atë faqe.
        </div>
      )}
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Klasa {klasa}</h1>

      <div role="tablist" className="flex gap-1 border-b border-slate-200 dark:border-slate-700">
        <button role="tab" aria-selected={tab === "kerkesat"} onClick={() => setTab("kerkesat")} className={tabCls("kerkesat")}>
          <DoorOpen className="w-4 h-4 inline mr-1" /> Kërkesat për lirim {pritje > 0 && <span className="ml-1 px-1.5 rounded-full bg-amber-500 text-white text-xs">{pritje}</span>}
        </button>
        <button role="tab" aria-selected={tab === "nxenesit"} onClick={() => setTab("nxenesit")} className={tabCls("nxenesit")}>
          <Users className="w-4 h-4 inline mr-1" /> Nxënësit
        </button>
      </div>

      {tab === "kerkesat" && (
        <div className="card divide-y divide-slate-100 dark:divide-slate-700">
          {kerkesat === null ? <p className="p-5 text-sm text-slate-500">Duke ngarkuar…</p>
            : kerkesat.length === 0 ? <p className="p-5 text-sm text-slate-500">Nuk ka kërkesa për lirim.</p>
            : kerkesat.map(k => (
              <Link key={k.id} href={`/kujdestare/kerkesa/${k.id}`} className="flex items-center justify-between gap-3 p-4 hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <div className="min-w-0">
                  <p className="font-medium text-slate-900 dark:text-white">{k.emri}</p>
                  <p className="text-sm text-slate-500">
                    {k.data === sotDay() ? "Sot" : fmtDay(k.data)} në {k.ora} · {ARSYET[k.arsyeja] ?? k.arsyeja} · merr: {k.marresEmri}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUSET[k.statusi]?.cls ?? ""}`}>{STATUSET[k.statusi]?.label ?? k.statusi}</span>
                  <ChevronRight className="w-4 h-4 text-slate-400" />
                </div>
              </Link>
            ))}
        </div>
      )}

      {tab === "nxenesit" && (
        <div className="card overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 text-left text-xs uppercase text-slate-500">
              <tr><th className="px-4 py-2">Emri</th><th className="px-4 py-2">Mbiemri</th><th className="px-4 py-2">Prindi</th><th className="px-4 py-2">Telefoni i prindit</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {nxenesit === null ? <tr><td colSpan={4} className="px-4 py-5 text-slate-500">Duke ngarkuar…</td></tr>
                : nxenesit.map(n => (
                  <tr key={n.id}>
                    <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{n.emri}</td>
                    <td className="px-4 py-2">{n.mbiemri}</td>
                    <td className="px-4 py-2 text-slate-600 dark:text-slate-300">{n.prindi ?? "—"}</td>
                    <td className="px-4 py-2">{n.telefoni ? <a href={`tel:${n.telefoni}`} className="text-primary-700 hover:underline">{n.telefoni}</a> : "—"}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
