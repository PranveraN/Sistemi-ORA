"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { SEV_LABEL, SEV_CLASS, SEVERITIES, MODULE_LABEL, RUN_STATUS, RUN_TRIGGER, fmtDateTime } from "./labels";

// "Rregullat dhe ekzekutimet": lista e rregullave (aktiv/rëndësia — vetëm Super
// Admin i ndryshon), pragjet (X ditë, kufiri i zbritjes …) dhe ekzekutimet e fundit.

interface Rule { code: string; name: string; description: string; module: string; severity: string; active: boolean; open: number }
interface Run { id: number; trigger: string; status: string; startedAt: string; finishedAt: string | null; findingsNew: number; findingsSeen: number; error: string | null; userName: string | null; ruleStats: string | null }
type Config = Record<string, number>;

const CONFIG_FIELDS: { key: string; label: string; unit: string }[] = [
  { key: "backdateDays", label: "Pagesë e regjistruar me vonesë (R03) — më shumë se", unit: "ditë" },
  { key: "maxDiscountPct", label: "Kufiri i zbritjes (R04)", unit: "%" },
  { key: "duplicateWindowDays", label: "Dyfishim i mundshëm (R05) — brenda", unit: "ditë" },
  { key: "undeliveredCashDays", label: "Cash i padorëzuar (R11) — pas", unit: "ditë" },
  { key: "undeliveredMinEuro", label: "Cash i padorëzuar (R11) — shuma minimale", unit: "€" },
  { key: "futureToleranceDays", label: "Data në të ardhmen (R12) — toleranca", unit: "ditë" },
  { key: "lookbackDays", label: "Sa larg pas kontrollohen regjistrimet", unit: "ditë" },
];

export default function RulesTab() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [config, setConfig] = useState<Config>({});
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const r = await fetch("/api/auditimi/rregullat");
    const j = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) { setMsg(j.error || "S'u ngarkua."); return; }
    setRules(j.rules); setRuns(j.runs); setConfig(j.config); setCanManage(j.canManageRules);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function updateRule(code: string, data: { active?: boolean; severity?: string }) {
    const r = await fetch("/api/auditimi/rregullat", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code, ...data }) });
    if (!r.ok) { const j = await r.json().catch(() => ({})); alert(j.error || "Gabim"); return; }
    load();
  }

  async function saveConfig() {
    setMsg("");
    const r = await fetch("/api/auditimi/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(config) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) { setMsg(j.error || "Gabim"); return; }
    setConfig(j); setMsg("Pragjet u ruajtën. Vlejnë nga ekzekutimi i radhës.");
  }

  if (loading && rules.length === 0) return <Loader2 className="w-5 h-5 animate-spin text-primary-400" aria-label="Duke ngarkuar" />;
  return (
    <div className="space-y-5">
      <section className="card overflow-hidden">
        <h3 className="font-semibold text-slate-900 dark:text-white p-4 border-b border-slate-100 dark:border-slate-700">Rregullat</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50 dark:bg-slate-800/60">
                <th className="px-4 py-2">Kodi</th><th className="px-4 py-2">Rregulli</th><th className="px-4 py-2">Moduli</th>
                <th className="px-4 py-2">Rëndësia</th><th className="px-4 py-2 text-right">Të hapura</th><th className="px-4 py-2">Aktiv</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {rules.map(r => (
                <tr key={r.code} className={r.active ? "" : "opacity-60"}>
                  <td className="px-4 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-4 py-2"><p className="font-medium text-slate-800 dark:text-slate-100">{r.name}</p><p className="text-xs text-slate-500">{r.description}</p></td>
                  <td className="px-4 py-2">{MODULE_LABEL[r.module] ?? r.module}</td>
                  <td className="px-4 py-2">
                    {canManage
                      ? <select aria-label={`Rëndësia e ${r.code}`} className="form-input py-1 text-xs w-32" value={r.severity} onChange={e => updateRule(r.code, { severity: e.target.value })}>
                          {SEVERITIES.map(s => <option key={s} value={s}>{SEV_LABEL[s]}</option>)}
                        </select>
                      : <span className={`text-[11px] px-1.5 py-0.5 rounded font-semibold ${SEV_CLASS[r.severity]}`}>{SEV_LABEL[r.severity]}</span>}
                  </td>
                  <td className="px-4 py-2 text-right font-semibold">{r.open}</td>
                  <td className="px-4 py-2">
                    {canManage
                      ? <label className="inline-flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={r.active} onChange={e => updateRule(r.code, { active: e.target.checked })} /> {r.active ? "Po" : "Jo"}</label>
                      : (r.active ? "Po" : "Jo")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card p-4 space-y-3">
        <h3 className="font-semibold text-slate-900 dark:text-white">Pragjet {canManage ? "" : "(vetëm Super Admin i ndryshon)"}</h3>
        <div className="grid sm:grid-cols-2 gap-3">
          {CONFIG_FIELDS.map(f => (
            <div key={f.key}>
              <label htmlFor={`cfg-${f.key}`} className="form-label">{f.label} ({f.unit})</label>
              <input id={`cfg-${f.key}`} inputMode="numeric" className="form-input" disabled={!canManage}
                value={config[f.key] ?? ""} onChange={e => setConfig(c => ({ ...c, [f.key]: Number(e.target.value.replace(",", ".")) }))} />
            </div>
          ))}
        </div>
        {canManage && <div className="flex items-center gap-3"><button type="button" onClick={saveConfig} className="btn-primary">Ruaj pragjet</button>{msg && <span className="text-sm text-slate-600 dark:text-slate-300">{msg}</span>}</div>}
      </section>

      <section className="card overflow-hidden">
        <h3 className="font-semibold text-slate-900 dark:text-white p-4 border-b border-slate-100 dark:border-slate-700">Ekzekutimet e fundit</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[680px]">
            <thead>
              <tr className="text-left text-xs uppercase text-slate-500 bg-slate-50 dark:bg-slate-800/60">
                <th className="px-4 py-2">Nisur</th><th className="px-4 py-2">Si</th><th className="px-4 py-2">Statusi</th>
                <th className="px-4 py-2 text-right">Të reja</th><th className="px-4 py-2 text-right">Gjithsej</th><th className="px-4 py-2">Kohëzgjatja</th><th className="px-4 py-2">Shënim</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
              {runs.length === 0 && <tr><td colSpan={7} className="px-4 py-6 text-center text-slate-500">Ende s&apos;ka ekzekutime.</td></tr>}
              {runs.map(r => (
                <tr key={r.id}>
                  <td className="px-4 py-2 whitespace-nowrap">{fmtDateTime(r.startedAt)}</td>
                  <td className="px-4 py-2">{RUN_TRIGGER[r.trigger] ?? r.trigger}{r.userName ? ` · ${r.userName}` : ""}</td>
                  <td className={`px-4 py-2 font-medium ${r.status === "OK" ? "text-green-700 dark:text-green-400" : r.status === "RUNNING" ? "text-blue-700" : "text-red-700 dark:text-red-400"}`}>{RUN_STATUS[r.status] ?? r.status}</td>
                  <td className="px-4 py-2 text-right">{r.findingsNew}</td>
                  <td className="px-4 py-2 text-right">{r.findingsSeen}</td>
                  <td className="px-4 py-2">{r.finishedAt ? `${((new Date(r.finishedAt).getTime() - new Date(r.startedAt).getTime()) / 1000).toFixed(1)} s` : "—"}</td>
                  <td className="px-4 py-2 text-xs text-red-700 dark:text-red-400">{r.error ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
