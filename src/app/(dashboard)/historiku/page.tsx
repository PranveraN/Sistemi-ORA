"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import { formatDateTime } from "@/lib/utils";
import { History, Loader2, ChevronLeft, ChevronRight, X } from "lucide-react";

interface LogEntry {
  id: number;
  action: string;
  entity: string;
  entityId: number | null;
  details: string | null;
  createdAt: string;
  user: { id: number; name: string } | null;
}

const ACTION_LABELS: Record<string, string> = {
  CREATE: "Krijoi",
  UPDATE: "Ndryshoi",
  DELETE: "Fshiu",
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  UPDATE: "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  DELETE: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-400",
};

const ENTITY_LABELS: Record<string, string> = {
  Student: "Nxënës",
  Payment: "Pagesë",
  Invoice: "Faturë",
  Class: "Klasë",
  Staff: "Staf",
  User: "Përdorues",
  Expense: "Shpenzim",
  Shpenzim: "Shpenzim",
  StudentPromotion: "Promovim nxënësish",
};

export default function HistorikuPage() {
  const [logs, setLogs]   = useState<LogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [users, setUsers] = useState<{ id: number; name: string }[]>([]);
  const [entities, setEntities] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [userId, setUserId] = useState("");
  const [entity, setEntity] = useState("");
  const [action, setAction] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [page, setPage] = useState(1);
  const limit = 30;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ page: String(page), limit: String(limit) });
    if (userId) params.set("userId", userId);
    if (entity) params.set("entity", entity);
    if (action) params.set("action", action);
    if (from)   params.set("from", from);
    if (to)     params.set("to", to);
    const res = await fetch(`/api/audit-log?${params}`);
    if (res.status === 403) { setError("Vetëm adminët mund ta shohin historikun."); setLoading(false); return; }
    if (res.ok) {
      const d = await res.json();
      setLogs(d.logs);
      setTotal(d.total);
      setUsers(d.users);
      setEntities(d.entities);
    }
    setLoading(false);
  }, [userId, entity, action, from, to, page]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);
  useEffect(() => { setPage(1); }, [userId, entity, action, from, to]);

  const hasFilters = userId || entity || action || from || to;
  const totalPages = Math.max(1, Math.ceil(total / limit));

  return (
    <>
      <Header title="Historiku" />
      <div className="p-6 space-y-4 animate-fade-in">

        <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
          <History className="w-5 h-5" />
          <p className="text-sm">Çdo krijim, ndryshim ose fshirje e bërë nga përdoruesit e sistemit.</p>
        </div>

        {/* Filters */}
        <div className="card p-4 flex flex-wrap items-center gap-3">
          <select value={userId} onChange={e => setUserId(e.target.value)} className="form-input w-44">
            <option value="">Të gjithë përdoruesit</option>
            {users.map(u => <option key={u.id} value={String(u.id)}>{u.name}</option>)}
          </select>
          <select value={entity} onChange={e => setEntity(e.target.value)} className="form-input w-44">
            <option value="">Të gjitha modulet</option>
            {entities.map(e => <option key={e} value={e}>{ENTITY_LABELS[e] || e}</option>)}
          </select>
          <select value={action} onChange={e => setAction(e.target.value)} className="form-input w-40">
            <option value="">Të gjitha veprimet</option>
            <option value="CREATE">Krijoi</option>
            <option value="UPDATE">Ndryshoi</option>
            <option value="DELETE">Fshiu</option>
          </select>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="form-input w-40" title="Nga data" />
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className="form-input w-40" title="Deri më datë" />
          {hasFilters && (
            <button
              onClick={() => { setUserId(""); setEntity(""); setAction(""); setFrom(""); setTo(""); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 hover:bg-slate-200 transition-colors"
            >
              <X className="w-3 h-3" /> Pastro filtrat
            </button>
          )}
          <span className="text-sm text-slate-400 ml-auto">{total} veprime</span>
        </div>

        {/* Table */}
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/50">
                <tr>
                  <th className="table-header">Kush</th>
                  <th className="table-header">Veprimi</th>
                  <th className="table-header">Moduli</th>
                  <th className="table-header">Detajet</th>
                  <th className="table-header">Kur</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {loading ? (
                  <tr><td colSpan={5} className="py-16 text-center"><Loader2 className="w-6 h-6 animate-spin text-primary-400 mx-auto" /></td></tr>
                ) : error ? (
                  <tr><td colSpan={5} className="py-16 text-center text-red-500 text-sm">{error}</td></tr>
                ) : logs.length === 0 ? (
                  <tr><td colSpan={5} className="py-16 text-center text-slate-400 text-sm">Asnjë veprim nuk u gjet.</td></tr>
                ) : logs.map(log => (
                  <tr key={log.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                    <td className="table-cell font-semibold text-slate-900 dark:text-white">
                      {log.user?.name || "—"}
                    </td>
                    <td className="table-cell">
                      <span className={`badge ${ACTION_COLORS[log.action] || "bg-slate-100 text-slate-600"}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                    </td>
                    <td className="table-cell text-slate-600 dark:text-slate-300">
                      {ENTITY_LABELS[log.entity] || log.entity}
                    </td>
                    <td className="table-cell text-slate-500 dark:text-slate-400 text-sm max-w-md">
                      {log.details || "—"}
                    </td>
                    <td className="table-cell text-slate-400 text-xs whitespace-nowrap">
                      {formatDateTime(log.createdAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-100 dark:border-slate-700">
              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="btn-secondary text-sm disabled:opacity-40"
              >
                <ChevronLeft className="w-4 h-4" /> Mëparshme
              </button>
              <span className="text-sm text-slate-400">Faqja {page} / {totalPages}</span>
              <button
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="btn-secondary text-sm disabled:opacity-40"
              >
                Tjetra <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
