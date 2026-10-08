"use client";

import { ACTION_LABEL, TABLE_LABEL, fmtDateTime, fmtValue } from "./labels";

// Lista e ndryshimeve të një rekordi (nga gjurma e auditimit).
export interface HistoryEntry {
  id: number; at: string; table: string; recordId: number | null; action: string;
  userName: string | null; ip: string | null; reason: string | null; source: string;
  changes: { field: string; label: string; from: unknown; to: unknown }[];
}

const ACTION_CLASS: Record<string, string> = {
  CREATE: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  UPDATE: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  DELETE: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

export default function HistoryList({ entries }: { entries: HistoryEntry[] }) {
  if (entries.length === 0) return <p className="text-sm text-slate-500">S&apos;ka ndryshime të regjistruara në gjurmë për këtë rekord.</p>;
  return (
    <ol className="space-y-3">
      {entries.map(e => (
        <li key={e.id} className="rounded-xl border border-slate-200 dark:border-slate-700 p-3">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded ${ACTION_CLASS[e.action] ?? ""}`}>{ACTION_LABEL[e.action] ?? e.action}</span>
            <span className="font-medium text-slate-800 dark:text-slate-100">{TABLE_LABEL[e.table] ?? e.table} #{e.recordId ?? "—"}</span>
            <span className="text-slate-500">· {fmtDateTime(e.at)}</span>
            <span className="text-slate-500">· {e.userName ?? (e.source === "DB" ? "jashtë aplikacionit / sistemi" : "përdorues i panjohur")}</span>
            {e.ip && <span className="text-xs text-slate-400">({e.ip})</span>}
          </div>
          {e.reason && <p className="text-xs text-amber-800 dark:text-amber-300 mt-1">Arsyeja: {e.reason}</p>}
          {e.changes.length > 0 && (
            <div className="overflow-x-auto mt-2">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-slate-500"><th className="py-1 pr-3 font-medium">Fusha</th>{e.action !== "CREATE" && <th className="py-1 pr-3 font-medium">Para</th>}{e.action !== "DELETE" && <th className="py-1 font-medium">Pas</th>}</tr>
                </thead>
                <tbody>
                  {e.changes.map(c => (
                    <tr key={c.field} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="py-1 pr-3 text-slate-600 dark:text-slate-300">{c.label}</td>
                      {e.action !== "CREATE" && <td className="py-1 pr-3 text-red-700 dark:text-red-400 break-all">{fmtValue(c.field, c.from)}</td>}
                      {e.action !== "DELETE" && <td className="py-1 text-green-700 dark:text-green-400 break-all">{fmtValue(c.field, c.to)}</td>}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </li>
      ))}
    </ol>
  );
}
