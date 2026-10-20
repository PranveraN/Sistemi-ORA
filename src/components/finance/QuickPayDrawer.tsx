"use client";

import { useMemo, useRef, useState } from "react";
import { X, Loader2, CheckCircle, AlertTriangle, Printer, Send, Pencil, ArrowLeft } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import {
  buildQuickPay, debtOf, installmentLabel, nextInstallmentDue, planKind, realInstallments,
  type QpInstallment, type QpPlanKind,
} from "@/lib/quickPayPlan";

// Paneli anësor "Regjistro pagesë" — shuma, metoda, data → konfirmim → ruajtje.
// Ruajtja = të njëjtat thirrje që bën redaktuesi ekzistues (PUT/POST /api/payments),
// njëra pas tjetrës; butoni çaktivizohet menjëherë (pa pagesa të dyfishta).

export interface QuickPayStudent {
  id: number;
  firstName: string;
  lastName: string;
  parentName: string | null;
  className: string | null;
  discountPct: number;
  installments: QpInstallment[];
}

export const PLAN_LABEL: Record<QpPlanKind, string> = {
  NONE: "Pa plan", SINGLE: "Një pagesë", TWO: "Dy këste", MONTHLY: "Çdo muaj", FLEX: "Me këste", TIMI: "TIMI Invest", LEGACY_FLEX: "Me këste",
};

const today = () => new Date().toISOString().slice(0, 10);
const round2 = (n: number) => Math.round(n * 100) / 100;

export default function QuickPayDrawer({ student, categoryId, defaultAmount, schoolYearStart, allowNoPlan, onClose, onSaved, onOpenEditor, onPrintReceipt, onSendSms }: {
  student: QuickPayStudent;
  categoryId: number;
  defaultAmount: number;
  schoolYearStart: number;
  allowNoPlan: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onOpenEditor: () => void;
  onPrintReceipt: (paymentId: number) => void;
  onSendSms: () => void;
}) {
  const kind = planKind(student.installments);
  const rows = realInstallments(student.installments);
  const noPlan = kind === "NONE" && allowNoPlan && defaultAmount > 0
    ? { grossAmount: defaultAmount, discountPct: student.discountPct ?? 0, dueDate: `${schoolYearStart > 0 ? schoolYearStart : new Date().getFullYear()}-09-15` }
    : undefined;
  const total = kind === "NONE"
    ? (noPlan ? round2(noPlan.grossAmount * (1 - noPlan.discountPct / 100)) : 0)
    : kind === "FLEX" ? student.installments.find(p => p.description === "FLEX_HEADER")!.finalAmount
    : round2(rows.reduce((s, p) => s + p.finalAmount, 0));
  const paid = round2(student.installments.reduce((s, p) => s + p.paidAmount, 0));
  const debt = kind === "NONE" ? total : debtOf(student.installments, kind);
  const nextDue = kind === "NONE" ? total : nextInstallmentDue(student.installments);

  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [date, setDate] = useState(today());
  const [note, setNote] = useState("");
  const [step, setStep] = useState<"form" | "confirm" | "done">("form");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [lastId, setLastId] = useState<number | null>(null);
  const savingRef = useRef(false);

  const amt = parseFloat(amount.replace(",", ".")) || 0;
  const plan = useMemo(() => buildQuickPay({
    studentId: student.id, categoryId, installments: student.installments, amount: amt, method, date,
    note: note.trim() || null, noPlan,
  }), [student, categoryId, amt, method, date, note, noPlan]);
  const blocked = kind === "TIMI" || kind === "LEGACY_FLEX" || (kind === "NONE" && !noPlan);
  const over = amt > debt + 0.001;
  const methodLabel = method === "BANK" ? "Bankë" : "Cash";
  const name = `${student.firstName} ${student.lastName}`;

  async function confirm() {
    if (savingRef.current || plan.error || !plan.ops.length) return;
    savingRef.current = true;
    setSaving(true);
    setError("");
    let done = 0;
    let last: number | null = null;
    try {
      for (const op of plan.ops) {
        const res = op.kind === "PUT"
          ? await fetch(`/api/payments/${op.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ studentId: student.id, categoryId, ...op.payload }) })
          : await fetch("/api/payments", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(op.payload) });
        if (!res.ok) {
          const d = await res.json().catch(() => ({}));
          throw new Error(`${op.label}: ${d.error || "gabim serveri"}`);
        }
        const d = await res.json().catch(() => ({}));
        last = op.kind === "PUT" ? op.id : (d.id ?? null);
        done++;
      }
      setLastId(last);
      setStep("done");
    } catch (e) {
      setError(`${(e as Error).message}.${done > 0 ? ` ${done} nga ${plan.ops.length} pjesë u ruajtën — kontrollo historikun para se të provosh përsëri.` : " Asgjë s'u ruajt."}`);
      setStep("form");
    } finally {
      setSaving(false);
      savingRef.current = false;
      await onSaved();
    }
  }

  const statusChip = (p: QpInstallment) => {
    const overdue = p.paidAmount < p.finalAmount - 0.001 && new Date(p.dueDate) < new Date();
    if (p.paidAmount >= p.finalAmount - 0.001) return "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300";
    if (p.paidAmount > 0) return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300";
    if (overdue) return "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300";
    return "bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300";
  };

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/30 min-[1100px]:bg-transparent min-[1100px]:pointer-events-none" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-50 h-full w-full sm:w-[420px] bg-white dark:bg-slate-900 shadow-2xl border-l border-slate-200 dark:border-slate-700 flex flex-col animate-fade-in" role="dialog" aria-label="Regjistro pagesë">
        <div className="flex items-start justify-between gap-2 p-5 border-b border-slate-100 dark:border-slate-800">
          <div className="min-w-0">
            <p className="text-xs text-slate-400">Regjistro pagesë</p>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white truncate">{name}{student.className ? ` · ${student.className}` : ""}</h2>
            <p className="text-xs text-slate-500 truncate">{student.parentName ? `Prindi: ${student.parentName} · ` : ""}{PLAN_LABEL[kind]}</p>
          </div>
          <button onClick={onClose} aria-label="Mbyll" className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"><X className="w-4 h-4" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-xl bg-slate-50 dark:bg-slate-800 p-2"><p className="text-[11px] text-slate-400">Shuma</p><p className="font-bold text-slate-800 dark:text-slate-100 text-sm">{formatCurrency(total)}</p></div>
            <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-2"><p className="text-[11px] text-slate-400">Paguar</p><p className="font-bold text-green-600 text-sm">{formatCurrency(paid)}</p></div>
            <div className="rounded-xl bg-red-50 dark:bg-red-900/20 p-2"><p className="text-[11px] text-slate-400">Borxh</p><p className="font-bold text-red-600 text-sm">{formatCurrency(debt)}</p></div>
          </div>

          {blocked ? (
            <div className="rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 text-sm p-3 space-y-2">
              <p>{kind === "TIMI" ? "Ky nxënës paguan përmes TIMI Invest — pagesa regjistrohet te dritarja TIMI (shuma nga banka)." : kind === "NONE" ? "Ky nxënës s'ka ende plan pagese për këtë periudhë." : "Ky plan fleksibël i vjetër ndryshohet vetëm te redaktuesi."}</p>
              <button onClick={onOpenEditor} className="btn-primary text-sm"><Pencil className="w-4 h-4" /> {kind === "NONE" ? "Krijo planin" : "Hap redaktuesin"}</button>
            </div>
          ) : step === "done" ? (
            <div className="space-y-3">
              <div className="rounded-xl bg-green-50 dark:bg-green-900/20 p-4 text-center">
                <CheckCircle className="w-8 h-8 text-green-600 mx-auto" />
                <p className="font-semibold text-green-700 dark:text-green-300 mt-1">Pagesa u regjistrua</p>
                <p className="text-xs text-slate-500">{formatCurrency(amt)} · {methodLabel} · {name}</p>
              </div>
              <div className="flex gap-2">
                {lastId && <button onClick={() => onPrintReceipt(lastId)} className="btn-secondary flex-1 justify-center text-sm"><Printer className="w-4 h-4" /> Printo dëshminë</button>}
                <button onClick={onSendSms} className="btn-secondary flex-1 justify-center text-sm"><Send className="w-4 h-4" /> Dërgo SMS prindit</button>
              </div>
              <button onClick={onClose} className="btn-primary w-full justify-center">Mbyll</button>
            </div>
          ) : step === "confirm" ? (
            <div className="space-y-3">
              <div className="rounded-xl border-2 border-amber-300 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-700 p-4 text-sm text-amber-900 dark:text-amber-200 space-y-2">
                <p>Po regjistroni <b>{formatCurrency(amt)}</b> me <b>{methodLabel}</b> për <b>{name}</b>, më {formatDate(date)}.</p>
                <ul className="text-xs space-y-0.5">
                  {plan.ops.map((o, i) => <li key={i}>• {o.label}: +{formatCurrency(o.add)}</li>)}
                </ul>
                <p>Borxhi mbetet: <b>{formatCurrency(plan.debtAfter)}</b></p>
                {plan.methodChanges.length > 0 && (
                  <p className="text-xs">⚠ {plan.methodChanges.join(", ")} kishte pagesë të mëparshme me metodë tjetër — rreshti do të shënohet {methodLabel}.</p>
                )}
              </div>
              <div className="flex gap-2">
                <button onClick={() => setStep("form")} disabled={saving} className="btn-secondary flex-1 justify-center"><ArrowLeft className="w-4 h-4" /> Kthehu</button>
                <button onClick={confirm} disabled={saving} className="flex-1 justify-center inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-green-600 hover:bg-green-700 disabled:opacity-60 text-white font-semibold text-sm">
                  {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Duke ruajtur…</> : <><CheckCircle className="w-4 h-4" /> Konfirmo pagesën</>}
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="form-label">Shuma që paguhet (€)</label>
                <input type="number" inputMode="decimal" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
                  className="form-input text-2xl font-bold py-3" placeholder="0,00" autoFocus />
                <div className="flex flex-wrap gap-2 mt-2">
                  {nextDue > 0 && nextDue < debt && (
                    <button type="button" onClick={() => setAmount(String(nextDue))} className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs hover:border-primary-400">Kësti i radhës · {formatCurrency(nextDue)}</button>
                  )}
                  {debt > 0 && (
                    <button type="button" onClick={() => setAmount(String(debt))} className="px-2.5 py-1 rounded-lg border border-slate-200 dark:border-slate-700 text-xs hover:border-primary-400">Gjithë borxhi · {formatCurrency(debt)}</button>
                  )}
                </div>
              </div>
              <div>
                <label className="form-label">Metoda</label>
                <div className="grid grid-cols-2 gap-2">
                  {([["CASH", "Cash"], ["BANK", "Bankë"]] as const).map(([k, l]) => (
                    <button key={k} type="button" onClick={() => setMethod(k)}
                      className={`py-2.5 rounded-xl border-2 text-sm font-semibold transition-colors ${method === k ? "border-primary-500 bg-primary-50 text-primary-700 dark:bg-primary-900/30 dark:text-primary-300" : "border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 hover:border-slate-300"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><label className="form-label">Data</label><input type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input" /></div>
                <div><label className="form-label">Shënim</label><input value={note} onChange={e => setNote(e.target.value)} className="form-input" placeholder="opsional" disabled={kind !== "NONE"} title={kind !== "NONE" ? "Shënimi i planit ndryshohet te \"Modifiko këstet\"" : undefined} /></div>
              </div>
              <div className={`rounded-xl px-3 py-2 flex justify-between text-sm ${over ? "bg-red-50 dark:bg-red-900/20" : "bg-slate-50 dark:bg-slate-800"}`}>
                <span className="text-slate-500">Borxhi pas pagesës</span>
                <b className={over ? "text-red-600" : "text-green-600"}>{formatCurrency(Math.max(0, round2(debt - amt)))}</b>
              </div>
              {amount !== "" && plan.error && (
                <p className="text-sm text-red-600 flex items-start gap-1.5"><AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {plan.error}</p>
              )}
              {error && <p className="text-sm text-red-600">{error}</p>}
              <button type="button" onClick={() => setStep("confirm")} disabled={!!plan.error || !plan.ops.length}
                className="btn-primary w-full justify-center py-3 disabled:opacity-50">Vazhdo te konfirmimi</button>
            </div>
          )}

          {rows.length > 0 && (
            <div className="pt-2 border-t border-slate-100 dark:border-slate-800">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Historiku</p>
              <ul className="space-y-1.5 text-xs">
                {rows.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-2">
                    <span className={`px-1.5 py-0.5 rounded font-semibold ${statusChip(p)}`}>{installmentLabel(p, i, kind)}</span>
                    <span className="flex-1 text-slate-600 dark:text-slate-300">
                      {p.paidAmount > 0 ? `${formatCurrency(p.paidAmount)} / ${formatCurrency(p.finalAmount)}` : formatCurrency(p.finalAmount)}
                    </span>
                    <span className="text-slate-400">
                      {p.paidDate && p.paidAmount > 0 ? `${formatDate(p.paidDate)}${p.method ? ` · ${p.method === "BANK" ? "Bankë" : p.method === "CASH" ? "Cash" : p.method}` : ""}` : `afati ${formatDate(p.dueDate)}`}
                    </span>
                  </li>
                ))}
              </ul>
              <button onClick={onOpenEditor} className="mt-3 text-xs text-primary-600 hover:underline flex items-center gap-1"><Pencil className="w-3 h-3" /> Modifiko këstet</button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
