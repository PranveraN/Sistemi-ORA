"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Header from "@/components/layout/Header";
import { formatDateTime } from "@/lib/utils";
import { Sparkles, Loader2, Save, PlayCircle, ThumbsDown, HelpCircle, Search, CheckCircle2, XCircle } from "lucide-react";

interface AdminData {
  config: { enabled: boolean; roles: string[]; dailyLimit: number; retentionDays: number; aiFallback: boolean; apiKeyConfigured: boolean; configurableRoles: string[] };
  stats: { month: number; byStatus: Record<string, number>; thumbsUp: number; thumbsDown: number; medianMs: number; costUsd: number };
  unanswered: { id: number; question: string; createdAt: string; role: string | null }[];
  thumbsDown: { id: number; question: string; summary: string | null; createdAt: string }[];
  history: { total: number; page: number; rows: { id: number; question: string; status: string; summary: string | null; durationMs: number | null; rating: number | null; role: string | null; userName: string; createdAt: string; toolsJson: string | null }[] };
}
interface TestReport { cases: { id: string; name: string; pass: boolean; detail: string; skipped?: boolean }[]; passed: number; failed: number; skipped: number; ms: number }

const ROLE_LABEL: Record<string, string> = { ADMIN: "Admin (vetëm shikim)", SECRETARY: "Sekretaria", FINANCE: "Financa", PEDAGOGIA: "Pedagogia" };
const STATUS_LABEL: Record<string, { label: string; cls: string }> = {
  ANSWERED: { label: "Përgjigjur", cls: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" },
  UNANSWERED: { label: "Pa përgjigje", cls: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  CLARIFICATION: { label: "Sqarim", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  ERROR: { label: "Gabim", cls: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
};

// "Ora · Asistenti" — vetëm administratorët. Ora punon me rregulla (falas, pa API).
export default function OraAdminPage() {
  const { data: session } = useSession();
  const isSuper = (session?.user as { role?: string } | undefined)?.role === "SUPERADMIN";
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState("");
  const [form, setForm] = useState<{ enabled: boolean; roles: string[]; dailyLimit: string; retentionDays: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [filters, setFilters] = useState({ status: "", rating: "", q: "", page: 1 });
  const [tests, setTests] = useState<TestReport | null>(null);
  const [testing, setTesting] = useState(false);

  const load = useCallback(async () => {
    const p = new URLSearchParams({ ...(filters.status && { status: filters.status }), ...(filters.rating && { rating: filters.rating }), ...(filters.q && { q: filters.q }), page: String(filters.page) });
    const r = await fetch(`/api/ora/admin?${p}`);
    const d = await r.json().catch(() => ({}));
    if (!r.ok) { setError(d.error || "Ngarkimi dështoi."); return; }
    setData(d); setError("");
    setForm(f => f ?? { enabled: d.config.enabled, roles: d.config.roles.filter((x: string) => x !== "SUPERADMIN"), dailyLimit: String(d.config.dailyLimit), retentionDays: String(d.config.retentionDays) });
  }, [filters]);
  useEffect(() => { const t = setTimeout(load, filters.q ? 300 : 0); return () => clearTimeout(t); }, [load, filters.q]);

  async function save() {
    if (!form) return;
    setSaving(true); setSaved(false);
    const r = await fetch("/api/ora/admin", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: form.enabled, roles: form.roles, dailyLimit: form.dailyLimit, retentionDays: form.retentionDays }) });
    setSaving(false);
    if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "Ruajtja dështoi."); return; }
    setSaved(true); setTimeout(() => setSaved(false), 2500); load();
  }

  async function runTests() {
    setTesting(true); setTests(null);
    const r = await fetch("/api/ora/admin/tests", { method: "POST" });
    const d = await r.json().catch(() => null);
    setTesting(false);
    if (!r.ok || !d) { alert(d?.error || "Testet dështuan të niseshin."); return; }
    setTests(d);
  }

  const s = data?.stats;
  return (
    <>
      <Header title="Ora · Asistenti" />
      <div className="p-4 lg:p-6 space-y-5 max-w-6xl animate-fade-in">
        {error && <p className="text-sm text-red-600">{error}</p>}
        {!data && !error && <p className="text-sm text-slate-400">Duke ngarkuar...</p>}

        {data && form && (
          <>
            {/* ── Konfigurimi ── */}
            <section className="card p-5 space-y-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex items-start gap-3">
                  <span className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/40 text-primary-600 flex items-center justify-center"><Sparkles className="w-5 h-5" /></span>
                  <div>
                    <p className="font-semibold text-slate-800 dark:text-white">Ora</p>
                    <p className="text-xs text-slate-500">Punon me rregulla: falas, pa API, asnjë e dhënë s&apos;del nga serveri. Vetëm lexim, sipas lejeve të përdoruesit.</p>
                  </div>
                </div>
                <label className="flex items-center gap-2 text-sm font-medium cursor-pointer">
                  <input type="checkbox" checked={form.enabled} disabled={!isSuper} onChange={e => setForm({ ...form, enabled: e.target.checked })} className="w-4 h-4" />
                  Ora aktive
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <div>
                  <p className="form-label">Rolet që kanë qasje</p>
                  <p className="text-xs text-slate-400 mb-1">Super Admini ka gjithmonë qasje; mësuesit kurrë.</p>
                  {data.config.configurableRoles.map(r => (
                    <label key={r} className="flex items-center gap-2 text-sm py-0.5">
                      <input type="checkbox" disabled={!isSuper} checked={form.roles.includes(r)} onChange={e => setForm({ ...form, roles: e.target.checked ? [...form.roles, r] : form.roles.filter(x => x !== r) })} />
                      {ROLE_LABEL[r] ?? r}
                    </label>
                  ))}
                </div>
                <div>
                  <label className="form-label" htmlFor="ora-limit">Kufiri ditor i pyetjeve për përdorues</label>
                  <input id="ora-limit" type="number" min={1} disabled={!isSuper} value={form.dailyLimit} onChange={e => setForm({ ...form, dailyLimit: e.target.value })} className="form-input" />
                </div>
                <div>
                  <label className="form-label" htmlFor="ora-ret">Ruajtja e historikut (ditë)</label>
                  <input id="ora-ret" type="number" min={1} disabled={!isSuper} value={form.retentionDays} onChange={e => setForm({ ...form, retentionDays: e.target.value })} className="form-input" />
                  <p className="text-xs text-slate-400 mt-1">Ruhen pyetja dhe përmbledhja — jo përgjigjet e plota.</p>
                </div>
              </div>
              {isSuper ? (
                <button onClick={save} disabled={saving} className="btn-primary text-sm">
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : saved ? <CheckCircle2 className="w-4 h-4" /> : <Save className="w-4 h-4" />} {saved ? "U ruajt" : "Ruaj"}
                </button>
              ) : <p className="text-xs text-slate-400">Vetëm Super Admini mund ta ndryshojë konfigurimin.</p>}
            </section>

            {/* ── Statistikat e muajit ── */}
            {s && (
              <section className="grid gap-3 grid-cols-2 md:grid-cols-6">
                {[
                  ["Pyetje këtë muaj", String(s.month)],
                  ["Përgjigjur", String(s.byStatus.ANSWERED ?? 0)],
                  ["Pa përgjigje", String(s.byStatus.UNANSWERED ?? 0)],
                  ["Sqarim", String(s.byStatus.CLARIFICATION ?? 0)],
                  ["👍 / 👎", `${s.thumbsUp} / ${s.thumbsDown}`],
                  ["Koha (mesatare)", `${s.medianMs} ms`],
                ].map(([l, v]) => (
                  <div key={l} className="card p-3"><p className="text-xs text-slate-500">{l}</p><p className="text-xl font-bold text-slate-800 dark:text-white">{v}</p></div>
                ))}
                <p className="col-span-2 md:col-span-6 text-xs text-slate-400">Kostoja e muajit: {s.costUsd > 0 ? `≈ $${s.costUsd}` : "0 € — Ora punon pa AI"}.</p>
              </section>
            )}

            {/* ── Për përmirësim ── */}
            <section className="grid gap-4 md:grid-cols-2">
              <div className="card p-4">
                <h3 className="font-semibold text-sm flex items-center gap-2 mb-2"><HelpCircle className="w-4 h-4 text-orange-500" /> Pa përgjigje</h3>
                {data.unanswered.length === 0 ? <p className="text-xs text-slate-400">Asnjë.</p> : (
                  <ul className="space-y-1.5 text-sm">{data.unanswered.map(u => <li key={u.id} className="flex justify-between gap-2"><span className="text-slate-700 dark:text-slate-200">{u.question}</span><span className="text-[11px] text-slate-400 shrink-0">{formatDateTime(u.createdAt)}</span></li>)}</ul>
                )}
              </div>
              <div className="card p-4">
                <h3 className="font-semibold text-sm flex items-center gap-2 mb-2"><ThumbsDown className="w-4 h-4 text-red-500" /> Vlerësuar 👎</h3>
                {data.thumbsDown.length === 0 ? <p className="text-xs text-slate-400">Asnjë.</p> : (
                  <ul className="space-y-1.5 text-sm">{data.thumbsDown.map(u => <li key={u.id}><span className="text-slate-700 dark:text-slate-200">{u.question}</span>{u.summary && <span className="block text-[11px] text-slate-400">{u.summary}</span>}</li>)}</ul>
                )}
              </div>
            </section>

            {/* ── Testet e saktësisë ── */}
            <section className="card p-4 space-y-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="font-semibold text-sm">Testet e saktësisë</h3>
                  <p className="text-xs text-slate-500">Krahasojnë çdo përgjigje të Orës me numrin që llogarit sistemi tani (si faqet përkatëse), plus lejet dhe sigurinë.</p>
                </div>
                {isSuper && (
                  <button onClick={runTests} disabled={testing} className="btn-secondary text-sm">
                    {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />} Ekzekuto testet e saktësisë
                  </button>
                )}
              </div>
              {tests && (
                <>
                  <p className={`text-sm font-medium ${tests.failed ? "text-red-600" : "text-green-600"}`}>
                    {tests.passed} kaluan · {tests.failed} dështuan · {tests.skipped} u anashkaluan · {Math.round(tests.ms / 100) / 10} s
                  </p>
                  <ul className="max-h-80 overflow-y-auto text-xs space-y-1">
                    {[...tests.cases].sort((a, b) => Number(a.pass) - Number(b.pass)).map(c => (
                      <li key={c.id} className="flex items-start gap-2">
                        {c.skipped ? <span className="text-slate-400">–</span> : c.pass ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500 shrink-0 mt-0.5" /> : <XCircle className="w-3.5 h-3.5 text-red-500 shrink-0 mt-0.5" />}
                        <span className="text-slate-700 dark:text-slate-200">{c.name}<span className="text-slate-400"> — {c.detail}</span></span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </section>

            {/* ── Historiku ── */}
            <section className="card overflow-hidden">
              <div className="p-3 flex flex-wrap gap-2 border-b border-slate-100 dark:border-slate-700">
                <div className="relative flex-1 min-w-[180px]">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input value={filters.q} onChange={e => setFilters({ ...filters, q: e.target.value, page: 1 })} className="form-input pl-9 text-sm" placeholder="Kërko në pyetje..." aria-label="Kërko në pyetje" />
                </div>
                <select value={filters.status} onChange={e => setFilters({ ...filters, status: e.target.value, page: 1 })} className="form-input w-auto text-sm" aria-label="Statusi">
                  <option value="">Çdo status</option>
                  {Object.entries(STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                </select>
                <select value={filters.rating} onChange={e => setFilters({ ...filters, rating: e.target.value, page: 1 })} className="form-input w-auto text-sm" aria-label="Vlerësimi">
                  <option value="">Çdo vlerësim</option><option value="up">👍</option><option value="down">👎</option>
                </select>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead><tr className="text-left text-xs text-slate-400 border-b border-slate-100 dark:border-slate-700">
                    <th className="px-3 py-2">Data</th><th className="px-3 py-2">Përdoruesi</th><th className="px-3 py-2">Pyetja</th><th className="px-3 py-2">Statusi</th><th className="px-3 py-2">Veglat → rezultati</th><th className="px-3 py-2 text-right">ms</th><th className="px-3 py-2"></th>
                  </tr></thead>
                  <tbody>
                    {data.history.rows.length === 0 && <tr><td colSpan={7} className="px-3 py-6 text-center text-slate-400">Asnjë pyetje ende.</td></tr>}
                    {data.history.rows.map(r => (
                      <tr key={r.id} className="border-b border-slate-50 dark:border-slate-800">
                        <td className="px-3 py-2 text-xs text-slate-500 whitespace-nowrap">{formatDateTime(r.createdAt)}</td>
                        <td className="px-3 py-2 text-xs">{r.userName}<span className="block text-slate-400">{r.role}</span></td>
                        <td className="px-3 py-2 text-slate-800 dark:text-slate-100">{r.question}</td>
                        <td className="px-3 py-2"><span className={`text-[11px] px-2 py-0.5 rounded-full ${STATUS_LABEL[r.status]?.cls ?? ""}`}>{STATUS_LABEL[r.status]?.label ?? r.status}</span></td>
                        <td className="px-3 py-2 text-xs text-slate-500">{r.summary ?? "—"}</td>
                        <td className="px-3 py-2 text-xs text-right text-slate-400">{r.durationMs ?? "—"}</td>
                        <td className="px-3 py-2">{r.rating === 1 ? "👍" : r.rating === -1 ? "👎" : ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {data.history.total > 30 && (
                <div className="p-3 flex items-center justify-between text-xs text-slate-500">
                  <span>{data.history.total} pyetje</span>
                  <div className="flex gap-2">
                    <button disabled={filters.page <= 1} onClick={() => setFilters({ ...filters, page: filters.page - 1 })} className="btn-secondary text-xs">‹ Para</button>
                    <button disabled={filters.page * 30 >= data.history.total} onClick={() => setFilters({ ...filters, page: filters.page + 1 })} className="btn-secondary text-xs">Pas ›</button>
                  </div>
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </>
  );
}
