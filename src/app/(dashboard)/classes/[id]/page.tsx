"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import * as XLSX from "xlsx";
import Header from "@/components/layout/Header";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  ChevronLeft, UserRound, MessageSquare, Printer, Download, ArrowRightLeft, Eye, FileSignature, X, Loader2, Info,
} from "lucide-react";
import { STATUS_COLORS } from "@/lib/smsStatus";
import { STUDENT_PAY_STATUSES, type StudentPayStatus } from "@/lib/studentTableStatus";
import { useModuleAccess } from "@/lib/useModuleAccess";
import { CapacityBar, type OverviewClass } from "@/components/classes/ClassCard";
import { SpecialCareCard, useSpecialCare } from "@/components/classes/SpecialCarePanel";
import StudentHistoryPanel from "@/components/students/StudentHistoryPanel";

interface Row {
  id: number; firstName: string; lastName: string; personalNumber: string | null; status: string;
  parentName: string | null; phone: string | null; discountPct: number; kontrata: string | null;
  paid: number; finalPrice: number; originalPrice: number; balance: number; payStatus: StudentPayStatus;
  lastEvent: { type: string; title: string; at: string | null } | null;
}
interface BasicStudent { id: number; firstName: string; lastName: string; personalNumber: string | null }

const PAY_LABEL = Object.fromEntries(STUDENT_PAY_STATUSES.map(s => [s.key, s.label])) as Record<StudentPayStatus, string>;
const collator = new Intl.Collator("sq", { numeric: true, sensitivity: "base" });

// Faqja e një klase — lista e nxënësve me statusin e pagesës (i njëjti burim
// si faqja Nxënësit: /api/students/table), përmbledhja financiare, SMS/print/
// eksport, zhvendosja e nxënësve dhe kujdesi i veçantë (vetëm me leje).
export default function ClassDetailPage() {
  const { id } = useParams<{ id: string }>();
  const classId = parseInt(id);
  const sp = useSearchParams();
  const router = useRouter();
  const { canAccess } = useModuleAccess();
  const financeAllowed = canAccess("/students");

  const [cls, setCls] = useState<OverviewClass | null>(null);
  const [allClasses, setAllClasses] = useState<OverviewClass[]>([]);
  const [year, setYear] = useState(parseInt(sp.get("y") || "") || 0);
  const [currentYear, setCurrentYear] = useState(0);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [basic, setBasic] = useState<BasicStudent[] | null>(null);
  const [error, setError] = useState("");
  const [moveFor, setMoveFor] = useState<{ id: number; name: string } | null>(null);
  const [historyFor, setHistoryFor] = useState<number | null>(null);

  const loadClass = useCallback(async () => {
    const res = await fetch("/api/classes/overview");
    const d = await res.json().catch(() => ({}));
    if (!res.ok) { setError(d.error || "Ngarkimi dështoi."); return; }
    setCurrentYear(d.year);
    if (!year) setYear(d.year);
    setAllClasses(d.classes ?? []);
    const c = (d.classes ?? []).find((x: OverviewClass) => x.id === classId);
    if (!c) setError("Klasa nuk u gjet.");
    setCls(c ?? null);
  }, [classId, year]);

  const loadStudents = useCallback(async () => {
    if (!year) return;
    if (financeAllowed) {
      const res = await fetch(`/api/students/table?classId=${classId}&status=ACTIVE&year=${year}&yearType=academic&limit=500&sort=name`);
      const d = await res.json().catch(() => ({}));
      if (res.ok) { setRows(d.rows ?? []); return; }
    }
    // Pa modulin "Nxënësit" (p.sh. Pedagogia): vetëm emrat, pa të dhëna financiare
    const res = await fetch(`/api/students?classId=${classId}&status=ACTIVE&limit=500`);
    const d = await res.json().catch(() => ({}));
    setBasic(((d.students ?? []) as BasicStudent[]).sort((a, b) => collator.compare(a.firstName, b.firstName)));
  }, [classId, year, financeAllowed]);

  useEffect(() => { loadClass(); }, [loadClass]);
  useEffect(() => { loadStudents(); }, [loadStudents]);

  const care = useSpecialCare(year || currentYear || 2026, classId);
  const studentCount = rows?.length ?? basic?.length ?? cls?.students ?? 0;

  const summary = useMemo(() => {
    const r = rows ?? [];
    const by = (s: StudentPayStatus) => r.filter(x => x.payStatus === s).length;
    return {
      paid: by("PAID"), partial: by("PARTIAL"), unpaid: by("UNPAID"), ti: by("TIMI_INVEST"),
      totalPaid: r.reduce((s, x) => s + x.paid, 0),
      totalDebt: r.reduce((s, x) => s + x.balance, 0),
    };
  }, [rows]);

  function exportExcel() {
    const list = rows ?? [];
    const data = list.length
      ? list.map((r, i) => ({
          "#": i + 1, "Emri": r.firstName, "Mbiemri": r.lastName, "Nr. Personal": r.personalNumber ?? "",
          "Prindi": r.parentName ?? "", "Telefoni": r.phone ?? "",
          "Çmimi Final (€)": r.finalPrice, "Paguar (€)": r.paid, "Borxhi (€)": r.balance,
          "Statusi i pagesës": PAY_LABEL[r.payStatus], "Kontrata": r.kontrata ?? "",
        }))
      : (basic ?? []).map((s, i) => ({ "#": i + 1, "Emri": s.firstName, "Mbiemri": s.lastName, "Nr. Personal": s.personalNumber ?? "" }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Klasa ${cls?.name ?? ""}`.slice(0, 31));
    XLSX.writeFile(wb, `Klasa-${cls?.name ?? classId}-${new Date().toISOString().slice(0, 10)}.xlsx`);
  }

  function printList() {
    const names = rows
      ? rows.map(r => ({ name: `${r.firstName} ${r.lastName}`, parent: r.parentName ?? "", phone: r.phone ?? "" }))
      : (basic ?? []).map(s => ({ name: `${s.firstName} ${s.lastName}`, parent: "", phone: "" }));
    const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Klasa ${esc(cls?.name ?? "")}</title>
      <style>body{font-family:system-ui,sans-serif;padding:24px}h1{font-size:20px;margin:0}p{color:#555;margin:4px 0 16px}
      table{width:100%;border-collapse:collapse;font-size:13px}th,td{border:1px solid #ccc;padding:6px 8px;text-align:left}th{background:#f1f5f9}</style>
      </head><body><h1>Klasa ${esc(cls?.name ?? "")}</h1><p>${esc(cls?.teacher ? `Mësuesi/ja: ${cls.teacher} · ` : "")}Viti ${year}–${year + 1} · ${names.length} nxënës</p>
      <table><thead><tr><th>#</th><th>Nxënësi</th><th>Prindi</th><th>Telefoni</th></tr></thead><tbody>
      ${names.map((n, i) => `<tr><td>${i + 1}</td><td>${esc(n.name)}</td><td>${esc(n.parent)}</td><td>${esc(n.phone)}</td></tr>`).join("")}
      </tbody></table></body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 300);
  }

  const canMove = canAccess("/students");

  return (
    <>
      <Header title={cls ? `Klasa ${cls.name}` : "Klasa"} />
      <div className="p-4 sm:p-6 space-y-4 animate-fade-in">
        <Link href={`/classes${year ? `?y=${year}` : ""}`} className="text-sm text-slate-500 hover:text-primary-600 inline-flex items-center gap-1">
          <ChevronLeft className="w-4 h-4" /> Të gjitha klasat
        </Link>
        {error && <p className="text-sm text-red-500">{error}</p>}

        {cls && (
          <div className="card p-5 flex flex-wrap items-start justify-between gap-4">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h1 className="text-3xl font-bold text-slate-900 dark:text-white">{cls.name}</h1>
                {!cls.active && <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-700 text-slate-500">Joaktive</span>}
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 flex items-center gap-1.5">
                <UserRound className="w-4 h-4 text-slate-400" /> {cls.teacher || <span className="text-orange-600">Pa mësues</span>}
                <span className="text-slate-300">·</span> Viti {year}–{year + 1}
              </p>
              <div className="w-64 pt-1"><CapacityBar students={studentCount} cap={cls.effectiveCapacity} /></div>
            </div>
            <div className="flex flex-wrap gap-2">
              {canAccess("/sms") && (
                <button onClick={() => router.push(`/sms?classes=${classId}`)} className="btn-primary"><MessageSquare className="w-4 h-4" /> Dërgo SMS klasës</button>
              )}
              <button onClick={printList} className="btn-secondary"><Printer className="w-4 h-4" /> Printo listën</button>
              <button onClick={exportExcel} className="btn-secondary"><Download className="w-4 h-4" /> Eksporto Excel</button>
            </div>
          </div>
        )}

        {year && currentYear && year !== currentYear ? (
          <p className="text-xs text-slate-500 flex items-center gap-1.5"><Info className="w-3.5 h-3.5" /> Lista aktuale e nxënësve; pagesat për vitin {year}–{year + 1}.</p>
        ) : null}

        {/* Përmbledhja financiare e klasës */}
        {rows && (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-3">
            {([["PAID", "Paguar plotësisht", summary.paid], ["PARTIAL", "Pjesërisht", summary.partial], ["UNPAID", "Pa paguar", summary.unpaid], ["TIMI_INVEST", "Timi Invest", summary.ti]] as const).map(([k, l, v]) => (
              <Link key={k} href={`/students?cl=${classId}&debt=${k}&y=${year}`} className="card p-3 sm:p-4 hover:ring-2 hover:ring-primary-100">
                <p className="flex items-center gap-1.5 text-xs text-slate-500"><span className={`w-2 h-2 rounded-full ${STATUS_COLORS[k].dot}`} /> {l}</p>
                <p className="text-lg font-bold text-slate-900 dark:text-white">{v}</p>
              </Link>
            ))}
          </div>
        )}
        {rows && (
          <p className="text-xs text-slate-500">Paguar gjithsej: <b>{formatCurrency(summary.totalPaid)}</b> · Borxh gjithsej: <b className="text-red-600">{formatCurrency(summary.totalDebt)}</b></p>
        )}

        <div className={`grid gap-4 ${care.allowed && care.data ? "lg:grid-cols-[1fr_340px]" : ""}`}>
          <div className="card overflow-hidden min-w-0">
            <div className="overflow-x-auto">
              {rows ? (
                <table className="w-full">
                  <thead className="bg-slate-50 dark:bg-slate-800/50">
                    <tr>
                      <th className="table-header">Nxënësi</th>
                      <th className="table-header">Prindi</th>
                      <th className="table-header">Pagesa e shkollimit</th>
                      <th className="table-header">Borxhi</th>
                      <th className="table-header">Kontrata</th>
                      <th className="table-header">Historiku</th>
                      <th className="table-header text-right">Veprime</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                    {rows.length === 0 && <tr><td colSpan={7} className="table-cell text-center py-10 text-slate-400">Asnjë nxënës aktiv në këtë klasë.</td></tr>}
                    {rows.map(r => {
                      const pct = r.finalPrice > 0 ? Math.min(100, Math.round((r.paid / r.finalPrice) * 100)) : 0;
                      return (
                        <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                          <td className="table-cell">
                            <Link href={`/students/${r.id}`} className="font-semibold text-slate-900 dark:text-white hover:text-primary-600">{r.firstName} {r.lastName}</Link>
                            {r.personalNumber && <p className="text-xs text-slate-400">{r.personalNumber}</p>}
                          </td>
                          <td className="table-cell">
                            <p className="text-sm">{r.parentName || "—"}</p>
                            {r.phone && <p className="text-xs text-slate-400">{r.phone}</p>}
                          </td>
                          <td className="table-cell min-w-[160px]">
                            <div className="flex items-center gap-1.5 text-sm" title={`Çmimi origjinal: ${formatCurrency(r.originalPrice)}`}>
                              {formatCurrency(r.paid)} / <b>{formatCurrency(r.finalPrice)}</b>
                              {r.discountPct > 0 && <span className="text-[10px] font-bold bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 px-1.5 py-0.5 rounded-full">-{r.discountPct}%</span>}
                            </div>
                            <div className="mt-1 h-1.5 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
                              <div className={`h-full rounded-full ${pct >= 100 ? "bg-green-500" : "bg-primary-500"}`} style={{ width: `${pct}%` }} />
                            </div>
                          </td>
                          <td className="table-cell">
                            {r.balance > 0.005 ? <p className="text-sm font-semibold text-red-600">{formatCurrency(r.balance)}</p> : <p className="text-sm text-slate-300">—</p>}
                            <span className={`inline-block mt-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded border ${STATUS_COLORS[r.payStatus]?.chip ?? ""}`}>{PAY_LABEL[r.payStatus]}</span>
                          </td>
                          <td className="table-cell">
                            {canAccess("/sekretaria") ? (
                              <Link href={`/sekretaria/kontratat-nxenesve?studentId=${r.id}`} className="inline-flex items-center gap-1 text-xs font-medium text-blue-600"><FileSignature className="w-3.5 h-3.5" /> Kontratë</Link>
                            ) : <span className="text-xs text-slate-400">{r.kontrata || "—"}</span>}
                          </td>
                          <td className="table-cell">
                            <button onClick={() => setHistoryFor(r.id)} className="text-left text-xs px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 max-w-[170px]"
                              aria-label={`Historiku i ${r.firstName} ${r.lastName}`} title="Hap historikun">
                              {r.lastEvent ? <><span className="block truncate font-medium">{r.lastEvent.title}</span>{r.lastEvent.at && <span className="text-slate-400">{formatDate(r.lastEvent.at)}</span>}</> : <span className="text-slate-400">Shiko historikun</span>}
                            </button>
                          </td>
                          <td className="table-cell">
                            <div className="flex items-center justify-end gap-1">
                              <Link href={`/students/${r.id}`} title="Shiko profilin" aria-label="Shiko profilin" className="p-1.5 rounded-lg text-slate-400 hover:text-primary-600 hover:bg-primary-50"><Eye className="w-4 h-4" /></Link>
                              {canMove && (
                                <button onClick={() => setMoveFor({ id: r.id, name: `${r.firstName} ${r.lastName}` })} title="Zhvendos në klasë tjetër" aria-label="Zhvendos në klasë tjetër"
                                  className="p-1.5 rounded-lg text-slate-400 hover:text-orange-600 hover:bg-orange-50"><ArrowRightLeft className="w-4 h-4" /></button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              ) : basic ? (
                <ul className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {basic.length === 0 && <li className="p-6 text-center text-slate-400 text-sm">Asnjë nxënës aktiv në këtë klasë.</li>}
                  {basic.map((s, i) => (
                    <li key={s.id} className="px-4 py-2.5 text-sm flex gap-3"><span className="text-slate-400 w-6">{i + 1}.</span>{s.firstName} {s.lastName}</li>
                  ))}
                </ul>
              ) : (
                <p className="p-8 text-center text-sm text-slate-400">Duke ngarkuar...</p>
              )}
            </div>
          </div>

          {care.allowed && care.data && (
            <aside className="lg:sticky lg:top-4 lg:self-start">
              <SpecialCareCard data={care.data} onChanged={care.reload} title="Kujdes i veçantë në këtë klasë" />
            </aside>
          )}
        </div>
      </div>

      {moveFor && (
        <MoveStudentModal student={moveFor} currentClassId={classId}
          classes={allClasses.filter(c => c.active && c.id !== classId)}
          onClose={() => setMoveFor(null)}
          onMoved={() => { setMoveFor(null); loadStudents(); loadClass(); }} />
      )}
      {historyFor !== null && <StudentHistoryPanel studentId={historyFor} onClose={() => setHistoryFor(null)} />}
    </>
  );
}

function MoveStudentModal({ student, classes, onClose, onMoved }: {
  student: { id: number; name: string }; currentClassId: number; classes: OverviewClass[]; onClose: () => void; onMoved: () => void;
}) {
  const [target, setTarget] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const targetCls = classes.find(c => c.id === Number(target));
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!targetCls) return;
    if (!confirm(`Zhvendos ${student.name} në klasën ${targetCls.name}?`)) return;
    setBusy(true); setError("");
    try {
      const res = await fetch(`/api/students/${student.id}/move-class`, {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ classId: targetCls.id }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) { setError(d.error || "Zhvendosja dështoi."); return; }
      onMoved();
    } catch { setError("Gabim rrjeti — provo përsëri."); }
    finally { setBusy(false); }
  }
  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <form onSubmit={submit} onClick={e => e.stopPropagation()} className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold">Zhvendos {student.name}</h3>
          <button type="button" onClick={onClose} aria-label="Mbyll" className="p-1 rounded text-slate-400"><X className="w-4 h-4" /></button>
        </div>
        <select value={target} onChange={e => setTarget(e.target.value)} className="form-input" required>
          <option value="">Zgjidh klasën e re...</option>
          {[...classes].sort((a, b) => collator.compare(a.name, b.name)).map(c => (
            <option key={c.id} value={c.id}>{c.name} ({c.students}/{c.effectiveCapacity})</option>
          ))}
        </select>
        {targetCls && targetCls.students >= targetCls.effectiveCapacity && (
          <p className="text-xs text-orange-600">Kujdes: klasa {targetCls.name} është plot ose mbi kapacitet.</p>
        )}
        <p className="text-xs text-slate-400">Regjistrohet te historiku i nxënësit dhe te &quot;Lëvizjet&quot; (ndërrime klase). Pagesat s&apos;preken.</p>
        {error && <p className="text-sm text-red-500">{error}</p>}
        <div className="flex justify-end gap-2">
          <button type="button" onClick={onClose} className="btn-secondary">Anulo</button>
          <button type="submit" disabled={busy || !target} className="btn-primary">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Zhvendos</button>
        </div>
      </form>
    </div>
  );
}
