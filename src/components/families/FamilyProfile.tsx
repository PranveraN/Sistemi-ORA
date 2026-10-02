"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  MessageSquare, CreditCard, UserPlus, MoreHorizontal, Phone, Mail, FileText, Upload, Trash2, Loader2,
  History, FileSignature, Eye, Printer, Merge, Pencil, ExternalLink, ArrowLeft, StickyNote, Star,
} from "lucide-react";
import { formatCurrency, formatDate, formatDateTime } from "@/lib/utils";
import { STATUS_COLORS } from "@/lib/smsStatus";
import { useModuleAccess } from "@/lib/useModuleAccess";
import StudentHistoryPanel, { EVENT_META } from "@/components/students/StudentHistoryPanel";
import MergeFamiliesDialog from "./MergeFamiliesDialog";

const PAY_LABEL: Record<string, string> = { PAID: "Paguar", PARTIAL: "Pjesërisht", UNPAID: "Pa paguar", TIMI_INVEST: "Timi Invest" };
const CAT_LABEL: Record<string, string> = { SHKOLLIMI: "Shkollimi", USHQIMI: "Ushqimi", UNIFORMA: "Uniforma", ESHKOLLORI: "eShkollori", LIBRAT: "Librat e anglishtes" };
const CAT_ORDER = ["SHKOLLIMI", "USHQIMI", "UNIFORMA", "ESHKOLLORI", "LIBRAT"];
const ROLE_LABEL: Record<string, string> = { FATHER: "Babai", MOTHER: "Nëna", GUARDIAN: "Kujdestari" };

interface Amount { final: number; paid: number; balance: number; status?: string }
export interface FamilyProfileData {
  id: number; label: string; displayName: string | null; primaryContact: string | null; primaryPhone: string | null;
  year: number; showFinance: boolean;
  totals: { final: number; paid: number; balance: number; byCategory: Record<string, Amount> } | null;
  children: {
    id: number; firstName: string; lastName: string; status: string; classId: number | null; className: string | null;
    kontrata: string | null; discountPct: number;
    tuition: { paid: number; finalPrice: number; originalPrice: number; balance: number; payStatus: string; timiInvest: boolean } | null;
    categories: Record<string, Amount>;
  }[];
  parents: { role: "FATHER" | "MOTHER" | "GUARDIAN"; name: string; phones: string[]; emails: string[] }[];
  activity: { id: number; studentId: number; studentName: string; type: string; title: string; occurredAt: string; userName: string | null }[];
  documents: { id: number; title: string | null; originalName: string; size: number; studentId: number | null; createdAt: string }[];
  contracts: { id: number; studentId: number; studentName: string; title: string; occurredAt: string }[];
  notes: { id: number; text: string; authorName: string | null; createdAt: string }[];
}

export const initialsOf = (label: string) =>
  label.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("") || "F";

export default function FamilyProfile({ familyId, year, onBack, onChanged }: {
  familyId: number; year: number; onBack?: () => void; onChanged: () => void;
}) {
  const router = useRouter();
  const { canAccess } = useModuleAccess();
  const [data, setData] = useState<FamilyProfileData | null>(null);
  const [error, setError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [historyFor, setHistoryFor] = useState<number | null>(null);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const r = await fetch(`/api/families/${familyId}?year=${year}`);
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Ngarkimi dështoi."); setData(null); return; }
      setData(d);
    } catch { setError("Gabim rrjeti — provo përsëri."); }
  }, [familyId, year]);
  useEffect(() => { setData(null); load(); }, [load]);

  async function api(url: string, init: RequestInit, failMsg: string): Promise<boolean> {
    setBusy(true);
    try {
      const r = await fetch(url, init);
      if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || failMsg); return false; }
      return true;
    } catch { alert("Gabim rrjeti — provo përsëri."); return false; }
    finally { setBusy(false); }
  }

  async function setPrimary(role: string) {
    if (!data || data.primaryContact === role) return;
    if (!confirm(`Ta bëj ${ROLE_LABEL[role].toLowerCase()}n kontakt kryesor? SMS-të e familjes do të shkojnë te ky numër (përditësohet "Prindi/Telefoni" te fëmijët).`)) return;
    if (await api(`/api/families/${familyId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ primaryContact: role }) }, "Ndryshimi dështoi.")) { load(); onChanged(); }
  }
  async function addNote() {
    if (!note.trim()) return;
    if (await api(`/api/families/${familyId}/notes`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text: note }) }, "Ruajtja dështoi.")) { setNote(""); load(); }
  }
  async function deleteNote(id: number) {
    if (!confirm("Ta fshij shënimin?")) return;
    if (await api(`/api/families/${familyId}/notes?noteId=${id}`, { method: "DELETE" }, "Fshirja dështoi.")) load();
  }
  async function upload(file: File) {
    const fd = new FormData();
    fd.append("file", file);
    if (await api(`/api/families/${familyId}/documents`, { method: "POST", body: fd }, "Ngarkimi dështoi.")) load();
  }

  function printCard() {
    if (!data) return;
    const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
    const w = window.open("", "_blank");
    if (!w) return;
    const kids = data.children.filter(c => c.status === "ACTIVE");
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Kartela — Familja ${esc(data.label)}</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px;color:#0f172a}h1{font-size:20px;margin:0 0 4px}h2{font-size:14px;margin:18px 0 6px}
      table{width:100%;border-collapse:collapse;font-size:12px}th,td{border:1px solid #cbd5e1;padding:5px 7px;text-align:left}th{background:#f1f5f9}.r{text-align:right}</style></head><body>
      <h1>Familja ${esc(data.label)}</h1><p style="color:#64748b;margin:0">${kids.length} fëmijë në shkollë · Viti ${data.year}–${data.year + 1} · ${new Date().toLocaleDateString("sq-AL")}</p>
      <h2>Prindërit</h2><table><tr><th>Roli</th><th>Emri</th><th>Telefoni</th></tr>
      ${data.parents.map(p => `<tr><td>${ROLE_LABEL[p.role]}${data.primaryContact === p.role ? " (kontakti kryesor)" : ""}</td><td>${esc(p.name)}</td><td>${esc(p.phones.join(", "))}</td></tr>`).join("")}</table>
      <h2>Fëmijët</h2><table><tr><th>Emri</th><th>Klasa</th><th class="r">Paguar</th><th class="r">Çmimi final</th><th class="r">Borxhi</th><th>Statusi</th></tr>
      ${kids.map(c => `<tr><td>${esc(c.firstName)} ${esc(c.lastName)}</td><td>${esc(c.className ?? "—")}</td><td class="r">${c.tuition ? formatCurrency(c.tuition.paid) : "—"}</td><td class="r">${c.tuition ? formatCurrency(c.tuition.finalPrice) : "—"}</td><td class="r">${c.tuition ? formatCurrency(c.tuition.balance) : "—"}</td><td>${c.tuition ? PAY_LABEL[c.tuition.payStatus] : "—"}</td></tr>`).join("")}</table>
      ${data.totals ? `<h2>Përmbledhja (të gjitha kategoritë)</h2><table><tr><th>Kategoria</th><th class="r">Totali</th><th class="r">Paguar</th><th class="r">Borxhi</th></tr>
      ${CAT_ORDER.filter(k => data.totals!.byCategory[k]).map(k => { const v = data.totals!.byCategory[k]; return `<tr><td>${CAT_LABEL[k]}</td><td class="r">${formatCurrency(v.final)}</td><td class="r">${formatCurrency(v.paid)}</td><td class="r">${formatCurrency(v.balance)}</td></tr>`; }).join("")}
      <tr><th>Gjithsej</th><th class="r">${formatCurrency(data.totals.final)}</th><th class="r">${formatCurrency(data.totals.paid)}</th><th class="r">${formatCurrency(data.totals.balance)}</th></tr></table>` : ""}
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  if (error) return <div className="card p-8 text-center text-sm text-red-500">{error}</div>;
  if (!data) return <div className="card p-10 flex justify-center"><Loader2 className="w-5 h-5 animate-spin text-slate-400" /></div>;

  const active = data.children.filter(c => c.status === "ACTIVE");
  const t = data.totals;
  const paidPct = t && t.final > 0 ? Math.min(100, Math.round((t.paid / t.final) * 100)) : 0;
  const smsIds = active.map(c => c.id).join(",");

  return (
    <div className="space-y-4">
      {onBack && (
        <button onClick={onBack} className="lg:hidden text-sm text-slate-500 hover:text-primary-600 inline-flex items-center gap-1"><ArrowLeft className="w-4 h-4" /> Kthehu te lista</button>
      )}

      {/* a) Koka */}
      <div className="card p-4 sm:p-5 flex flex-wrap items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-primary-600 text-white flex items-center justify-center font-bold text-lg shrink-0">{initialsOf(data.label)}</div>
        <div className="flex-1 min-w-[180px]">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">Familja {data.label}</h2>
          <p className="text-sm text-slate-500">{active.length} fëmijë në shkollë · Viti {data.year}–{data.year + 1}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canAccess("/sms") && (
            <button onClick={() => router.push(`/sms?students=${smsIds}&family=1`)} disabled={!active.length} className="btn-primary text-sm">
              <MessageSquare className="w-4 h-4" /> Dërgo SMS
            </button>
          )}
          {canAccess("/payments") && (
            <div className="relative">
              <button onClick={() => setPayOpen(o => !o)} disabled={!active.length} className="btn-secondary text-sm" aria-haspopup="menu" aria-expanded={payOpen}>
                <CreditCard className="w-4 h-4" /> Regjistro pagesë
              </button>
              {payOpen && (
                <div role="menu" className="absolute right-0 top-full mt-1 z-20 w-56 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1">
                  <p className="px-3 py-1.5 text-xs text-slate-400">Për cilin fëmijë?</p>
                  {active.map(c => (
                    <Link key={c.id} role="menuitem" href={`/payments/new?studentId=${c.id}`} className="block px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700">
                      {c.firstName} {c.lastName} {c.className && <span className="text-slate-400">({c.className})</span>}
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
          {canAccess("/students") && (
            <Link href={`/students/new?familyId=${data.id}`} className="btn-secondary text-sm"><UserPlus className="w-4 h-4" /> Shto fëmijë</Link>
          )}
          <div className="relative">
            <button onClick={() => setMenuOpen(o => !o)} className="p-2 rounded-lg border border-slate-200 dark:border-slate-600 text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"
              aria-label="Më shumë veprime" title="Më shumë veprime" aria-haspopup="menu" aria-expanded={menuOpen}>
              <MoreHorizontal className="w-4 h-4" />
            </button>
            {menuOpen && (
              <div role="menu" className="absolute right-0 top-full mt-1 z-20 w-64 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg py-1" onMouseLeave={() => setMenuOpen(false)}>
                <button role="menuitem" onClick={() => { setMenuOpen(false); setEditOpen(true); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><Pencil className="w-4 h-4 text-slate-400" /> Edito familjen</button>
                <button role="menuitem" onClick={() => { setMenuOpen(false); setMergeOpen(true); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><Merge className="w-4 h-4 text-slate-400" /> Bashko me familje tjetër</button>
                <button role="menuitem" onClick={() => { setMenuOpen(false); printCard(); }} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2"><Printer className="w-4 h-4 text-slate-400" /> Printo kartelën</button>
                {data.primaryPhone && (
                  <Link role="menuitem" href={`/families/kerko?phone=${encodeURIComponent(data.primaryPhone)}`} className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 flex items-center gap-2">
                    <ExternalLink className="w-4 h-4 text-slate-400" /> Faturë / Email / Historik i familjes
                  </Link>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* b) Përmbledhja financiare */}
      {t && (
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="card p-4">
            <p className="text-xs text-slate-500">Totali për t&apos;u paguar</p>
            <p className="text-xl font-bold text-slate-900 dark:text-white">{formatCurrency(t.final)}</p>
            <p className="text-[11px] text-slate-400">Të gjitha kategoritë · të gjithë fëmijët</p>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-500">Paguar</p>
            <p className="text-xl font-bold text-green-600">{formatCurrency(t.paid)}</p>
            <div className="mt-2 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden" role="progressbar" aria-valuenow={paidPct} aria-valuemin={0} aria-valuemax={100}>
              <div className={`h-full rounded-full ${paidPct >= 100 ? "bg-green-500" : "bg-primary-500"}`} style={{ width: `${paidPct}%` }} />
            </div>
          </div>
          <div className="card p-4">
            <p className="text-xs text-slate-500">Borxhi i familjes</p>
            <p className={`text-xl font-bold ${t.balance > 0.005 ? "text-red-600" : "text-slate-400"}`}>{formatCurrency(t.balance)}</p>
            <div className="mt-1 space-y-0.5">
              {CAT_ORDER.filter(k => (t.byCategory[k]?.balance ?? 0) > 0.005).map(k => (
                <p key={k} className="text-[11px] text-slate-500 flex justify-between"><span>{CAT_LABEL[k]}</span><span className="text-red-600">{formatCurrency(t.byCategory[k].balance)}</span></p>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4 min-w-0">
          {/* c) Fëmijët */}
          <div className="card p-4 space-y-3">
            <h3 className="section-title">Fëmijët</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {data.children.map(c => {
                const tu = c.tuition;
                const pct = tu && tu.finalPrice > 0 ? Math.min(100, Math.round((tu.paid / tu.finalPrice) * 100)) : 0;
                return (
                  <div key={c.id} className={`rounded-xl border border-slate-200 dark:border-slate-700 p-3 space-y-2 ${c.status !== "ACTIVE" ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-slate-900 dark:text-white">{c.firstName} {c.lastName}</p>
                        <div className="flex flex-wrap gap-1 mt-0.5">
                          {c.className && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">{c.className}</span>}
                          {c.status !== "ACTIVE" && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500">Joaktiv</span>}
                          {tu?.timiInvest && <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">Timi Invest</span>}
                        </div>
                      </div>
                      {tu && <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${STATUS_COLORS[tu.payStatus]?.chip ?? ""}`}>{PAY_LABEL[tu.payStatus]}</span>}
                    </div>
                    {tu && (
                      <div>
                        <p className="text-sm" title={`Çmimi origjinal: ${formatCurrency(tu.originalPrice)}`}>
                          {formatCurrency(tu.paid)} / <b>{formatCurrency(tu.finalPrice)}</b>
                          {c.discountPct > 0 && <span className="ml-1.5 text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 px-1.5 py-0.5 rounded-full">-{c.discountPct}%</span>}
                          {c.discountPct > 0 && <span className="ml-1.5 text-[11px] text-slate-400 line-through">{formatCurrency(tu.originalPrice)}</span>}
                        </p>
                        <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                          <div className={`h-full rounded-full ${pct >= 100 ? "bg-green-500" : "bg-primary-500"}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    )}
                    <div className="flex flex-wrap gap-3 text-xs pt-1">
                      <Link href={`/students/${c.id}`} className="text-primary-600 inline-flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Profili</Link>
                      {canAccess("/sekretaria") && <Link href={`/sekretaria/kontratat-nxenesve?studentId=${c.id}`} className="text-blue-600 inline-flex items-center gap-1"><FileSignature className="w-3.5 h-3.5" /> Kontrata</Link>}
                      <button onClick={() => setHistoryFor(c.id)} className="text-slate-600 dark:text-slate-300 inline-flex items-center gap-1"><History className="w-3.5 h-3.5" /> Historiku</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* e) Aktiviteti i fundit */}
          <div className="card p-4 space-y-3">
            <h3 className="section-title">Aktiviteti i fundit</h3>
            {data.activity.length === 0 ? <p className="text-sm text-slate-400">Asnjë ngjarje e regjistruar.</p> : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                {data.activity.map(a => {
                  const meta = EVENT_META[a.type];
                  const Icon = meta?.icon ?? History;
                  return (
                    <li key={a.id} className="py-2 flex items-start gap-3">
                      <span className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${meta?.color ?? "bg-slate-100 text-slate-500"}`}><Icon className="w-3.5 h-3.5" /></span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-slate-700 dark:text-slate-200"><b>{a.studentName}</b> · {a.title}</p>
                        <p className="text-[11px] text-slate-400">{formatDateTime(a.occurredAt)}{a.userName ? ` · ${a.userName}` : ""}</p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
            {active.length > 0 && (
              <div className="flex flex-wrap gap-2 text-xs">
                <span className="text-slate-400">Shiko të gjitha:</span>
                {active.map(c => <button key={c.id} onClick={() => setHistoryFor(c.id)} className="text-primary-600 hover:underline">{c.firstName}</button>)}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          {/* d) Prindërit */}
          <div className="card p-4 space-y-3">
            <h3 className="section-title">Prindërit</h3>
            {data.parents.length === 0 ? <p className="text-sm text-slate-400">Pa të dhëna prindi.</p> : data.parents.map((p, i) => {
              const isPrimary = data.primaryContact === p.role;
              return (
                <div key={i} className={`rounded-xl border p-3 ${isPrimary ? "border-primary-300 bg-primary-50/40 dark:bg-primary-900/10 dark:border-primary-800" : "border-slate-200 dark:border-slate-700"}`}>
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold">{p.name} <span className="text-xs font-normal text-slate-400">· {ROLE_LABEL[p.role]}</span></p>
                    {isPrimary ? (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-primary-600 text-white inline-flex items-center gap-0.5"><Star className="w-3 h-3" /> Kontakti kryesor</span>
                    ) : p.role !== "GUARDIAN" && p.phones.length > 0 ? (
                      <button onClick={() => setPrimary(p.role)} disabled={busy} className="text-[11px] text-primary-600 hover:underline">Bëje kontakt kryesor</button>
                    ) : null}
                  </div>
                  {p.phones.map(ph => (
                    <a key={ph} href={`tel:${ph.replace(/[^\d+]/g, "")}`} className="mt-1 text-sm text-slate-600 dark:text-slate-300 hover:text-primary-600 flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> {ph}</a>
                  ))}
                  {p.emails.map(em => <a key={em} href={`mailto:${em}`} className="mt-0.5 text-xs text-slate-500 hover:text-primary-600 flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> {em}</a>)}
                </div>
              );
            })}
            <p className="text-[11px] text-slate-400">Kontakti kryesor merr SMS-të e familjes.</p>
          </div>

          {/* f) Dokumentet */}
          <div className="card p-4 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="section-title">Dokumentet</h3>
              <button onClick={() => fileRef.current?.click()} disabled={busy} className="text-xs font-semibold text-primary-600 inline-flex items-center gap-1"><Upload className="w-3.5 h-3.5" /> Ngarko dokument</button>
              <input ref={fileRef} type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx"
                onChange={e => { const f = e.target.files?.[0]; if (f) upload(f); e.target.value = ""; }} />
            </div>
            {data.contracts.length === 0 && data.documents.length === 0 && <p className="text-sm text-slate-400">Asnjë dokument.</p>}
            <ul className="space-y-1.5">
              {data.contracts.map(c => (
                <li key={`c${c.id}`} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-1.5 min-w-0"><FileSignature className="w-4 h-4 text-blue-500 shrink-0" /><span className="truncate">Kontrata — {c.studentName} <span className="text-xs text-slate-400">{formatDate(c.occurredAt)}</span></span></span>
                  {canAccess("/sekretaria") && <Link href={`/sekretaria/kontratat-nxenesve?studentId=${c.studentId}`} className="text-xs text-primary-600 shrink-0">Hap</Link>}
                </li>
              ))}
              {data.documents.map(d => (
                <li key={d.id} className="flex items-center justify-between gap-2 text-sm">
                  <span className="flex items-center gap-1.5 min-w-0"><FileText className="w-4 h-4 text-slate-400 shrink-0" /><span className="truncate">{d.title || d.originalName} <span className="text-xs text-slate-400">{formatDate(d.createdAt)}</span></span></span>
                  <a href={`/api/families/${data.id}/documents?docId=${d.id}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary-600 shrink-0">Hap</a>
                </li>
              ))}
            </ul>
          </div>

          {/* g) Shënime */}
          <div className="card p-4 space-y-3">
            <h3 className="section-title flex items-center gap-1.5"><StickyNote className="w-4 h-4 text-slate-400" /> Shënime</h3>
            <div className="flex gap-2">
              <input value={note} onChange={e => setNote(e.target.value)} onKeyDown={e => { if (e.key === "Enter") addNote(); }}
                className="form-input text-sm" placeholder="Shënim i brendshëm (vetëm për stafin)..." maxLength={2000} />
              <button onClick={addNote} disabled={busy || !note.trim()} className="btn-primary text-sm">Shto</button>
            </div>
            <ul className="space-y-2">
              {data.notes.map(n => (
                <li key={n.id} className="text-sm rounded-lg bg-slate-50 dark:bg-slate-800/60 p-2.5">
                  <p className="text-slate-700 dark:text-slate-200 whitespace-pre-line">{n.text}</p>
                  <div className="flex items-center justify-between mt-1">
                    <p className="text-[11px] text-slate-400">{n.authorName ?? "—"} · {formatDateTime(n.createdAt)}</p>
                    <button onClick={() => deleteNote(n.id)} title="Fshi shënimin" aria-label="Fshi shënimin" className="p-1 text-slate-300 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </li>
              ))}
              {data.notes.length === 0 && <li className="text-sm text-slate-400">Asnjë shënim.</li>}
            </ul>
          </div>
        </div>
      </div>

      {historyFor !== null && <StudentHistoryPanel studentId={historyFor} onClose={() => setHistoryFor(null)} />}
      {mergeOpen && <MergeFamiliesDialog current={data} year={year} onClose={() => setMergeOpen(false)} onMerged={id => { setMergeOpen(false); onChanged(); router.push(`/families/${id}`); }} />}
      {editOpen && (
        <EditFamilyDialog name={data.displayName ?? ""} placeholder={data.label} onClose={() => setEditOpen(false)}
          onSave={async v => { if (await api(`/api/families/${familyId}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ displayName: v }) }, "Ruajtja dështoi.")) { setEditOpen(false); load(); onChanged(); } }} />
      )}
    </div>
  );
}

function EditFamilyDialog({ name, placeholder, onClose, onSave }: { name: string; placeholder: string; onClose: () => void; onSave: (v: string) => void }) {
  const [v, setV] = useState(name);
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form onClick={e => e.stopPropagation()} onSubmit={e => { e.preventDefault(); onSave(v.trim()); }} className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
        <h3 className="font-semibold">Edito familjen</h3>
        <div>
          <label className="form-label">Emri i familjes</label>
          <input autoFocus value={v} onChange={e => setV(e.target.value)} className="form-input" placeholder={placeholder} maxLength={80} />
          <p className="text-[11px] text-slate-400 mt-1">Bosh = merret nga mbiemri i fëmijëve. Prindërit dhe numrat editohen te profili i secilit fëmijë; kontakti kryesor te blloku "Prindërit".</p>
        </div>
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">Anulo</button>
          <button type="submit" className="btn-primary">Ruaj</button>
        </div>
      </form>
    </div>
  );
}
