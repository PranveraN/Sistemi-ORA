"use client";

import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { Plus, Pencil, MoreHorizontal, Search, Trash2, ChevronDown, Loader2 } from "lucide-react";
import Header from "@/components/layout/Header";
import ExpensesSection from "@/components/finance/ExpensesSection";
import OldDebtImportModal from "@/components/finance/OldDebtImportModal";
import PaymentReceiptModal from "@/components/finance/PaymentReceiptModal";
import { formatCurrency, normalizeSearch } from "@/lib/utils";
import { ACADEMIC_YEARS, DEFAULT_ACADEMIC_YEAR } from "@/lib/academicYear";
import type { EsLedger, EsStudent } from "./types";
import { PaymentModal, AmountModal, ExemptModal, OldDebtModal, OldDebtAddModal, HistoryModal, type DebtAction } from "./EshkolloriModals";

// Eshkollori → "Të hyra": detyrimi vjetor (20 € si parazgjedhje), lirimet dhe
// borxhi i vjetër — veç e veç, kurrë në një shifër të vetme. Vetëm administrata.

type Tab = "income" | "expense" | "handover";
type Group = "all" | "paid" | "unpaid" | "old" | "free";
type Dialog =
  | { kind: "pay"; s: EsStudent | null; debtId?: number }
  | { kind: "amount"; s: EsStudent }
  | { kind: "exempt"; s: EsStudent }
  | { kind: "debt"; s: EsStudent; action: DebtAction }
  | { kind: "debtAdd"; s: EsStudent }
  | { kind: "history"; s: EsStudent }
  | { kind: "receipt"; paymentId: number }
  | { kind: "import" };

const STATUS: Record<string, { label: string; cls: string }> = {
  PAID: { label: "Paguar", cls: "bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300" },
  UNPAID: { label: "Pa paguar", cls: "bg-orange-50 text-orange-800 dark:bg-orange-950/40 dark:text-orange-300" },
  FREE: { label: "Falas", cls: "bg-teal-50 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300" },
};
const yl = (y: number | null) => (y ? `${y}–${y + 1}` : "—");

export default function EshkolloriPage() {
  const [tab, setTab] = useState<Tab>("income");
  const [year, setYear] = useState(DEFAULT_ACADEMIC_YEAR);
  const [data, setData] = useState<EsLedger | null>(null);
  const [loadError, setLoadError] = useState("");
  const [group, setGroup] = useState<Group>("all");
  const [search, setSearch] = useState("");
  const [openDebt, setOpenDebt] = useState<number | null>(null);
  const [menu, setMenu] = useState<number | null>(null);
  const [ioOpen, setIoOpen] = useState(false);
  const [dialog, setDialog] = useState<Dialog | null>(null);

  const load = useCallback(async () => {
    setLoadError("");
    const r = await fetch(`/api/eshkollori?year=${year}`).catch(() => null);
    if (r?.ok) setData(await r.json());
    else setLoadError(r?.status === 403 ? "Nuk ke leje për këtë faqe." : "Të dhënat s'u ngarkuan.");
  }, [year]);
  useEffect(() => { load(); }, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    const q = normalizeSearch(search.trim());
    return data.students.filter(s => {
      if (group === "paid" && s.status !== "PAID") return false;
      if (group === "unpaid" && s.status !== "UNPAID") return false;
      if (group === "free" && s.status !== "FREE") return false;
      if (group === "old" && !(s.oldDebt > 0)) return false;
      if (q && !normalizeSearch(`${s.name} ${s.parent ?? ""}`).includes(q)) return false;
      return true;
    });
  }, [data, group, search]);

  const sum = data?.summary;
  const groups: { key: Group; label: string; n: number; dot: string }[] = sum ? [
    { key: "all", label: "Të gjithë", n: sum.groups.all, dot: "bg-slate-400" },
    { key: "paid", label: "Paguar", n: sum.groups.paid, dot: "bg-green-600" },
    { key: "unpaid", label: "Pa paguar", n: sum.groups.unpaid, dot: "bg-red-600" },
    { key: "old", label: "Me borxh të vjetër", n: sum.groups.old, dot: "bg-orange-500" },
    { key: "free", label: "Falas", n: sum.groups.free, dot: "bg-teal-600" },
  ] : [];

  function exportExcel() {
    if (!data) return;
    const sheet = XLSX.utils.aoa_to_sheet([
      [`Eshkollori — ${data.label}`],
      ["#", "Nxënësi", "Prindi", "Klasa", "Shuma (€)", "Paguar (€)", "Borxhi (€)", "Borxh i vjetër (€)", "Statusi"],
      ...rows.map((s, i) => [i + 1, s.name, s.parent ?? "", s.className ?? "", s.expected, s.paid, s.debt, s.oldDebt, STATUS[s.status].label]),
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Eshkollori");
    XLSX.writeFile(wb, `Eshkollori-${data.label.replace("–", "-")}.xlsx`);
  }

  const done = () => { load(); };

  return (
    <>
      <Header title="Eshkollori" />
      <div className="p-4 sm:p-6 space-y-4 animate-fade-in">
        {/* Koka: skedat + veprimet */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <nav aria-label="Skedat e Eshkollorit" className="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-1 gap-0.5">
            {([["income", "Të hyra"], ["expense", "Shpenzime"], ["handover", "Dorëzim parash"]] as [Tab, string][]).map(([k, l]) => (
              <button key={k} type="button" onClick={() => setTab(k)} aria-pressed={tab === k}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium ${tab === k ? "bg-primary-100 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200" : "text-slate-600 dark:text-slate-300 hover:text-slate-900"}`}>{l}</button>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <select value={year} onChange={e => setYear(parseInt(e.target.value))} aria-label="Viti shkollor" className="form-input w-32 text-sm">
              {ACADEMIC_YEARS.map(y => <option key={y} value={y}>{yl(y)}</option>)}
            </select>
            {tab === "income" && (
              <>
                <div className="relative">
                  <button type="button" onClick={() => setIoOpen(v => !v)} aria-expanded={ioOpen} className="btn-secondary text-sm">
                    Importo / Eksporto <ChevronDown className="w-3.5 h-3.5" />
                  </button>
                  {ioOpen && (
                    <Menu onClose={() => setIoOpen(false)} className="right-0 w-60">
                      <MenuItem onClick={() => { setIoOpen(false); setDialog({ kind: "import" }); }}>Importo borxhin e vjetër (Excel)</MenuItem>
                      <MenuItem onClick={() => { setIoOpen(false); exportExcel(); }}>Eksporto listën (Excel)</MenuItem>
                    </Menu>
                  )}
                </div>
                <button type="button" onClick={() => setDialog({ kind: "pay", s: null })} className="btn-primary text-sm">
                  <Plus className="w-4 h-4" /> Regjistro pagesë
                </button>
              </>
            )}
          </div>
        </div>

        {tab === "expense" && <ExpensesSection categoryId={data?.category.id ?? null} type="EXPENSE" month={0} year={year} yearType="academic" exportable />}
        {tab === "handover" && <ExpensesSection categoryId={data?.category.id ?? null} type="HANDOVER" month={0} year={year} yearType="academic" exportable />}

        {tab === "income" && (
          loadError ? <div className="card p-8 text-center text-sm text-red-600">{loadError}</div>
          : !data || !sum ? <div className="card p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary-400" /></div>
          : (
            <>
              {/* Kartelat — borxhi i vitit dhe ai i vjetër veç e veç */}
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                <Card label="Të hyra" value={sum.income} sub={`${sum.paidCount} nxënës kanë paguar`} tone="text-green-700 dark:text-green-400" />
                <Card label="Borxh i këtij viti" value={sum.yearDebt} sub={`${sum.yearDebtCount} nxënës`} tone="text-red-700 dark:text-red-400" />
                <Card label="Borxh i vjetër" value={sum.oldDebt} sub={`nga vitet e kaluara · ${sum.oldDebtCount} nxënës`} tone="text-orange-700 dark:text-orange-400" />
                <Card label="Të liruar (falas)" value={sum.exempted} sub={`${sum.exemptedCount} nxënës · nuk llogariten si borxh`} tone="text-teal-700 dark:text-teal-400" />
              </div>

              {/* Grupet + kërkimi */}
              <div className="card p-2.5 flex flex-wrap items-center gap-2">
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Grupet">
                  {groups.map(g => (
                    <button key={g.key} type="button" onClick={() => setGroup(g.key)} aria-pressed={group === g.key}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-semibold border ${group === g.key
                        ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900 dark:border-white"
                        : "bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-slate-300"}`}>
                      <span className={`w-2 h-2 rounded-full ${g.dot}`} aria-hidden /> {g.label} <span className={group === g.key ? "opacity-80" : "text-slate-500"}>{g.n}</span>
                    </button>
                  ))}
                </div>
                <div className="relative ml-auto w-full sm:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" aria-hidden />
                  <input value={search} onChange={e => setSearch(e.target.value)} aria-label="Kërko nxënësin ose prindin" placeholder="Kërko nxënësin ose prindin…" className="form-input pl-9 text-sm" />
                </div>
              </div>

              {/* Tabela */}
              <div className="card overflow-x-auto">
                <table className="w-full min-w-[920px] text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-slate-800/60">
                      <th className="px-3 py-2.5 w-10">#</th>
                      <th className="px-3 py-2.5">Nxënësi</th>
                      <th className="px-3 py-2.5">Klasa</th>
                      <th className="px-3 py-2.5">Shuma</th>
                      <th className="px-3 py-2.5">Paguar</th>
                      <th className="px-3 py-2.5">Borxhi</th>
                      <th className="px-3 py-2.5">Borxh i vjetër</th>
                      <th className="px-3 py-2.5">Statusi</th>
                      <th className="px-3 py-2.5 text-right"><span className="sr-only">Veprime</span></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-700">
                    {rows.length === 0 && (
                      <tr><td colSpan={9} className="px-3 py-10 text-center text-slate-500">Asnjë nxënës në këtë grup.</td></tr>
                    )}
                    {rows.map((s, i) => {
                      const st = STATUS[s.status];
                      const expanded = openDebt === s.id;
                      return (
                        <Fragment key={s.id}>
                          <tr className={expanded ? "bg-orange-50/50 dark:bg-orange-950/10" : "hover:bg-slate-50/60 dark:hover:bg-slate-800/40"}>
                            <td className="px-3 py-2.5 text-slate-500">{i + 1}</td>
                            <td className="px-3 py-2.5">
                              <p className="font-bold text-slate-900 dark:text-white">{s.name}</p>
                              {s.parent && <p className="text-xs text-slate-500 dark:text-slate-400">{s.parent}</p>}
                            </td>
                            <td className="px-3 py-2.5">{s.className && <span className="px-2 py-0.5 rounded-md text-xs font-semibold bg-primary-50 text-primary-800 dark:bg-primary-900/40 dark:text-primary-200">{s.className}</span>}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              <span className="font-semibold text-slate-900 dark:text-white">{formatCurrency(s.expected)}</span>
                              <button type="button" onClick={() => setDialog({ kind: "amount", s })} aria-label="Ndrysho shumën" title={s.amountChanged ? "Shuma e ndryshuar për këtë nxënës" : "Ndrysho shumën"}
                                className={`ml-1 p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-700 ${s.amountChanged ? "text-primary-600" : "text-slate-400"}`}><Pencil className="w-3.5 h-3.5" /></button>
                            </td>
                            <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-green-700 dark:text-green-400">{s.status === "FREE" && s.paid === 0 ? "—" : formatCurrency(s.paid)}</td>
                            <td className={`px-3 py-2.5 whitespace-nowrap font-semibold ${s.debt > 0 ? "text-red-700 dark:text-red-400" : "text-slate-400"}`}>{s.status === "FREE" ? "—" : formatCurrency(s.debt)}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">
                              {s.oldDebt > 0 ? (
                                <button type="button" onClick={() => setOpenDebt(expanded ? null : s.id)} aria-expanded={expanded}
                                  className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md border border-orange-300 dark:border-orange-800 bg-orange-50 dark:bg-orange-950/30 text-xs font-bold text-orange-800 dark:text-orange-300 hover:bg-orange-100">
                                  {formatCurrency(s.oldDebt)} <Pencil className="w-3 h-3" aria-hidden />
                                </button>
                              ) : <span className="text-slate-400">—</span>}
                            </td>
                            <td className="px-3 py-2.5"><span className={`px-2 py-0.5 rounded-md text-xs font-bold ${st.cls}`}>{st.label}</span></td>
                            <td className="px-3 py-2.5">
                              <div className="flex items-center justify-end gap-1.5 relative">
                                <button type="button" onClick={() => setDialog({ kind: "pay", s })} disabled={s.debt <= 0 && s.oldDebt <= 0}
                                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary-600 hover:bg-primary-700 text-white text-xs font-bold disabled:opacity-40">
                                  <Plus className="w-3.5 h-3.5" /> Pagesë
                                </button>
                                <button type="button" onClick={() => setMenu(menu === s.id ? null : s.id)} aria-label={`Më shumë veprime për ${s.name}`} aria-expanded={menu === s.id}
                                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-700"><MoreHorizontal className="w-4 h-4" /></button>
                                {menu === s.id && (
                                  <Menu onClose={() => setMenu(null)} className="right-0 top-full mt-1 w-60">
                                    <MenuItem onClick={() => { setMenu(null); setDialog({ kind: "history", s }); }}>Shiko historikun e pagesave</MenuItem>
                                    <MenuItem onClick={() => { setMenu(null); setDialog({ kind: "debtAdd", s }); }}>Shto / ndrysho borxhin e vjetër</MenuItem>
                                    <MenuItem onClick={() => { setMenu(null); setDialog({ kind: "exempt", s }); }} accent>Liro nga pagesa (falas)…</MenuItem>
                                    <MenuItem disabled={!s.rowId} onClick={() => { setMenu(null); if (s.rowId) setDialog({ kind: "receipt", paymentId: s.rowId }); }}>Printo faturën</MenuItem>
                                  </Menu>
                                )}
                              </div>
                            </td>
                          </tr>
                          {expanded && (
                            <tr>
                              <td colSpan={9} className="px-3 pb-3 pt-0">
                                <div className="rounded-xl border border-orange-200 dark:border-orange-900 bg-orange-50/70 dark:bg-orange-950/20 p-3.5 flex flex-wrap items-center gap-3">
                                  <div className="min-w-0 flex-1">
                                    <p className="font-bold text-sm text-slate-900 dark:text-white">Borxhi i vjetër i {s.name}</p>
                                    <p className="text-xs text-slate-600 dark:text-slate-300 mt-0.5 flex flex-wrap gap-x-3">
                                      {s.oldDebts.map(o => <span key={o.id}>{yl(o.year)}: <b>{formatCurrency(o.amount)}</b></span>)}
                                      <span>Gjithsej: <b>{formatCurrency(s.oldDebt)}</b></span>
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <button type="button" onClick={() => setDialog({ kind: "pay", s, debtId: s.oldDebts[0]?.id })} className="btn-primary text-xs">Regjistro pagesë</button>
                                    <button type="button" onClick={() => setDialog({ kind: "debt", s, action: "EDIT" })} className="btn-secondary text-xs">Ndrysho shumën</button>
                                    <button type="button" onClick={() => setDialog({ kind: "debt", s, action: "FORGIVE" })} className="btn-secondary text-xs">Fale borxhin</button>
                                    <button type="button" onClick={() => setDialog({ kind: "debt", s, action: "VOID" })} className="btn-secondary text-xs"><Trash2 className="w-3.5 h-3.5" /> Fshi (gabim)</button>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-slate-500">Shuma standarde për {data.label}: {formatCurrency(data.defaultAmount)} (Cilësimet → Vitet shkollore).</p>
            </>
          )
        )}
      </div>

      {dialog?.kind === "pay" && data && <PaymentModal student={dialog.s} students={data.students} year={year} debtId={dialog.debtId} onClose={() => setDialog(null)} onSaved={done} />}
      {dialog?.kind === "amount" && data && <AmountModal student={dialog.s} year={year} defaultAmount={data.defaultAmount} onClose={() => setDialog(null)} onSaved={done} />}
      {dialog?.kind === "exempt" && <ExemptModal student={dialog.s} year={year} onClose={() => setDialog(null)} onSaved={done} />}
      {dialog?.kind === "debt" && <OldDebtModal student={dialog.s} initial={dialog.action} onClose={() => setDialog(null)} onSaved={() => { setOpenDebt(null); done(); }} />}
      {dialog?.kind === "debtAdd" && <OldDebtAddModal student={dialog.s} year={year} onClose={() => setDialog(null)} onSaved={done} />}
      {dialog?.kind === "history" && <HistoryModal student={dialog.s} onClose={() => setDialog(null)} />}
      {dialog?.kind === "receipt" && <PaymentReceiptModal paymentId={dialog.paymentId} onClose={() => setDialog(null)} />}
      {dialog?.kind === "import" && data && <OldDebtImportModal categoryId={data.category.id} onClose={() => setDialog(null)} onImported={done} />}
    </>
  );
}

function Card({ label, value, sub, tone }: { label: string; value: number; sub: string; tone: string }) {
  return (
    <div className="card p-4">
      <p className="text-sm text-slate-600 dark:text-slate-300">{label}</p>
      <p className={`text-[26px] leading-tight font-extrabold mt-1 ${tone}`}>{formatCurrency(value)}</p>
      <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{sub}</p>
    </div>
  );
}

function Menu({ children, onClose, className }: { children: React.ReactNode; onClose: () => void; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const out = (e: MouseEvent) => { if (ref.current && !ref.current.parentElement?.contains(e.target as Node)) onClose(); };
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("mousedown", out);
    document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", out); document.removeEventListener("keydown", esc); };
  }, [onClose]);
  return (
    <div ref={ref} role="menu" className={`absolute z-30 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 shadow-lg py-1 ${className ?? ""}`}>
      {children}
    </div>
  );
}

function MenuItem({ children, onClick, accent, disabled }: { children: React.ReactNode; onClick: () => void; accent?: boolean; disabled?: boolean }) {
  return (
    <button type="button" role="menuitem" onClick={onClick} disabled={disabled}
      className={`w-full text-left px-3 py-2 text-sm disabled:opacity-40 ${accent ? "text-teal-800 dark:text-teal-300 hover:bg-teal-50 dark:hover:bg-teal-950/30" : "text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
      {children}
    </button>
  );
}
