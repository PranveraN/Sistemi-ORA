"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import Header from "@/components/layout/Header";
import { formatCurrency, formatDate } from "@/lib/utils";
import { AlertTriangle, Check, ArrowLeft, Loader2 } from "lucide-react";

interface PaymentRow {
  id: number;
  finalAmount: number;
  paidAmount: number;
  paidDate: string | null;
  method: string | null;
  description: string | null;
  month: number | null;
  year: number | null;
  student: { id: number; firstName: string; lastName: string };
}

// Skeda "Shkollimi → Verifikim" — lista e pagesave të Shkollimit që PRISMA
// i ka shënuar `confirmed: false` (import me shumicë ose nxënës të lidhur me
// TIMI Invest) — rregulli financiar: s'llogariten si "Të Hyra" reale derisa
// dikush t'i shqyrtojë këtu manualisht dhe të klikojë "Konfirmo".
export default function ShkollimiVerifikimPage() {
  const [rows, setRows] = useState<PaymentRow[] | null>(null);
  const [tiStudentIds, setTiStudentIds] = useState<Set<number>>(new Set());
  const [confirmingId, setConfirmingId] = useState<number | null>(null);

  const load = useCallback(async () => {
    const [paymentsRes, tiRes] = await Promise.all([
      fetch("/api/payments?categoryName=Shkollimi&confirmed=false&limit=500"),
      fetch("/api/timi-invest/students"),
    ]);
    const paymentsData = await paymentsRes.json();
    const tiData = await tiRes.json();
    setRows(paymentsData.payments ?? []);
    setTiStudentIds(new Set((tiData as { studentId: number | null }[]).map(t => t.studentId).filter((id): id is number => id != null)));
  }, []);

  useEffect(() => { load(); }, [load]);

  async function confirmPayment(id: number) {
    setConfirmingId(id);
    await fetch(`/api/payments/${id}/confirm`, { method: "PATCH" });
    setConfirmingId(null);
    load();
  }

  return (
    <>
      <Header title="Shkollimi — Verifikim" />
      <div className="p-4 sm:p-6 space-y-5 animate-fade-in max-w-4xl mx-auto">
        <div>
          <Link href="/shkollimi" className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 flex items-center gap-1 mb-2">
            <ArrowLeft className="w-3.5 h-3.5" /> Kthehu te Shkollimi
          </Link>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" /> Pagesa për Verifikim
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">
            Këto pagesa Shkollimi ende s&apos;llogariten si &quot;Të Hyra&quot; reale — vijnë nga import me shumicë ose janë të lidhura me TIMI Invest.
            Verifikojini dhe klikoni &quot;Konfirmo&quot; vetëm pasi të jeni siguruar që paraja është marrë realisht nga shkolla.
          </p>
        </div>

        <div className="card overflow-hidden">
          {rows === null ? (
            <p className="text-center text-slate-400 py-10 text-sm">Duke ngarkuar...</p>
          ) : rows.length === 0 ? (
            <p className="text-center text-slate-400 py-10 text-sm">Asnjë pagesë në pritje të verifikimit — gjithçka është e konfirmuar.</p>
          ) : (
            <div className="divide-y divide-slate-100 dark:divide-slate-700">
              {rows.map(r => (
                <div key={r.id} className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Link href={`/students/${r.student.id}`} className="font-medium text-slate-800 dark:text-slate-100 hover:text-primary-600 dark:hover:text-primary-400">
                        {r.student.firstName} {r.student.lastName}
                      </Link>
                      {tiStudentIds.has(r.student.id) && (
                        <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300">
                          TIMI Invest
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatCurrency(r.paidAmount)} nga {formatCurrency(r.finalAmount)}
                      {r.paidDate && <> · {formatDate(r.paidDate)}</>}
                      {r.method && <> · {r.method}</>}
                      {r.description && <> · {r.description}</>}
                    </p>
                  </div>
                  <button
                    onClick={() => confirmPayment(r.id)}
                    disabled={confirmingId === r.id}
                    className="btn-primary text-sm shrink-0"
                  >
                    {confirmingId === r.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                    Konfirmo
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
