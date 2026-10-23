"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { Loader2 } from "lucide-react";

// Moduli TIMI INVEST → Historiku (Faza 2): kush, kur, çka ndryshoi dhe pse. Vetëm lexim.
interface Row { id: number; createdAt: string; userName: string | null; action: string; entity: string; entityId: number; tiId: number | null; field: string | null; oldValue: string | null; newValue: string | null; reason: string | null; emri: string | null }

const VEPRIMI: Record<string, { label: string; cls: string }> = {
  UPDATE: { label: "Ndryshim", cls: "bg-violet-50 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300" },
  STORNO: { label: "Storno", cls: "bg-red-50 text-red-700 dark:bg-red-900/30 dark:text-red-300" },
  RIKTHE: { label: "Rikthim", cls: "bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" },
  CREATE: { label: "Shtim", cls: "bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300" },
  DELETE: { label: "Fshirje", cls: "bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300" },
};
const FUSHA: Record<string, string> = {
  regularPrice: "Çmimi i plotë", discountPct: "Zbritja %", manualDiscAmt: "Zbritja manuale €", stage: "Faza", notes: "Shënimet",
  parentName: "Prindi", parentPhone: "Telefoni", firstName: "Emri", lastName: "Mbiemri", active: "Aktiv", studentId: "Lidhja me nxënësin", pagesa: "Pagesa", lidhja: "Lidhja TIMI",
};
const FAZA: Record<string, string> = { PROFATURE: "Profaturë", NE_PROCES: "Në proces", KRYER: "E kryer", PEZULLUAR: "Pezulluar", ANULUAR: "Anuluar" };
const shfaq = (f: string | null, v: string | null) => v == null ? "—" : f === "stage" ? (FAZA[v] ?? v) : f === "regularPrice" || f === "manualDiscAmt" ? formatCurrency(Number(v)) : f === "discountPct" ? `${v}%` : v.length > 80 ? v.slice(0, 80) + "…" : v;

export default function TimiHistorikuPage() {
  const [rows, setRows] = useState<Row[] | null>(null);
  const [action, setAction] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    setRows(null);
    fetch(`/api/timi-invest/historiku${action ? `?action=${action}` : ""}`)
      .then(async r => { const d = await r.json(); if (!r.ok) throw new Error(d.error || "Gabim"); setRows(d.rows); })
      .catch(e => setError(e.message));
  }, [action]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Historiku i ndryshimeve</h1>
          <p className="text-xs text-slate-500">Çdo ndryshim te TIMI: çmimet, zbritjet, fazat, stornot dhe rikthimet — me arsyen. Nis me Fazën 2.</p>
        </div>
        <select value={action} onChange={e => setAction(e.target.value)} className="form-input !w-auto">
          <option value="">Të gjitha veprimet</option>
          {Object.entries(VEPRIMI).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
        </select>
      </div>
      {error && <div className="card p-4 text-sm text-red-600">{error}</div>}
      <div className="card overflow-hidden">
        {!rows ? <div className="p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div> : rows.length === 0 ? (
          <p className="p-6 text-sm text-slate-400 text-center">Asnjë ndryshim i regjistruar ende.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500 bg-slate-50 dark:bg-slate-800/60">
                <tr><th className="px-3 py-2 text-left">Kur</th><th className="px-3 py-2 text-left">Kush</th><th className="px-3 py-2 text-left">Veprimi</th><th className="px-3 py-2 text-left">Fëmija</th><th className="px-3 py-2 text-left">Çka</th><th className="px-3 py-2 text-left">Arsyeja</th></tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/60">
                {rows.map(r => (
                  <tr key={r.id}>
                    <td className="px-3 py-2 whitespace-nowrap text-xs text-slate-500">{new Date(r.createdAt).toLocaleString("sq-AL")}</td>
                    <td className="px-3 py-2">{r.userName ?? "—"}</td>
                    <td className="px-3 py-2"><span className={`badge ${VEPRIMI[r.action]?.cls ?? ""}`}>{VEPRIMI[r.action]?.label ?? r.action}</span></td>
                    <td className="px-3 py-2">{r.tiId ? <Link href={`/timi-invest/femijet/${r.tiId}`} className="text-primary-600 hover:underline">{r.emri ?? `#${r.tiId}`}</Link> : r.emri ?? "—"}</td>
                    <td className="px-3 py-2">
                      <b>{FUSHA[r.field ?? ""] ?? r.field ?? ""}</b>{" "}
                      {r.action === "UPDATE" ? <>{shfaq(r.field, r.oldValue)} → {shfaq(r.field, r.newValue)}</> : r.action === "STORNO" ? r.oldValue : r.action === "RIKTHE" ? r.newValue : ""}
                    </td>
                    <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.reason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
