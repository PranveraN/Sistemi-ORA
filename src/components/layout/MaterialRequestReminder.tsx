"use client";

import { useEffect, useRef, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { Package, Send, X } from "lucide-react";

const PENDING_INTERVAL_MS = 5 * 60 * 1000;   // kërkesa të reja, pa aprovim/refuzim ende
const UNSENT_INTERVAL_MS  = 10 * 60 * 1000;  // aprovuara, por ende s'janë dërguar te FurnitoriOra

// Kujtues global (popup) për stafin ADMIN/FINANCE — vazhdon të rishfaqet
// periodikisht derisa kërkesa të vendoset (aprovohet/refuzohet) ose të
// dërgohet te FurnitoriOra, jo vetëm një herë. Montohet në layout-in e
// dashboard-it, ndaj punon pavarësisht faqes ku ndodhet stafi.
export default function MaterialRequestReminder() {
  const { data: session } = useSession();
  const role = (session?.user as { role?: string } | undefined)?.role;
  const isManagement = role === "ADMIN" || role === "FINANCE";

  const [pending, setPending] = useState(0);
  const [approvedUnsent, setApprovedUnsent] = useState(0);
  const [showPending, setShowPending] = useState(false);
  const [showUnsent, setShowUnsent] = useState(false);

  const pendingTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const unsentTimer  = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!isManagement) return;

    async function checkCounts() {
      try {
        const res = await fetch("/api/material-requests/reminder-counts");
        if (!res.ok) return;
        const d = await res.json();
        setPending(d.pending ?? 0);
        setApprovedUnsent(d.approvedUnsent ?? 0);
        if ((d.pending ?? 0) > 0) setShowPending(true);
        if ((d.approvedUnsent ?? 0) > 0) setShowUnsent(true);
      } catch {
        // heshtazi — thjesht s'rifreskohet këtë herë, provohet përsëri në ciklin tjetër
      }
    }

    checkCounts();
    pendingTimer.current = setInterval(checkCounts, PENDING_INTERVAL_MS);
    unsentTimer.current  = setInterval(checkCounts, UNSENT_INTERVAL_MS);

    return () => {
      if (pendingTimer.current) clearInterval(pendingTimer.current);
      if (unsentTimer.current) clearInterval(unsentTimer.current);
    };
  }, [isManagement]);

  if (!isManagement) return null;

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-3 w-80 max-w-[calc(100vw-2.5rem)]">
      {showPending && pending > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-amber-200 dark:border-amber-800 rounded-2xl shadow-2xl p-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
              <Package className="w-4.5 h-4.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-slate-800 dark:text-white">Kërkesë e Re</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {pending} {pending === 1 ? "kërkesë" : "kërkesa"} për material në pritje
              </p>
            </div>
            <button onClick={() => setShowPending(false)} className="text-slate-300 hover:text-slate-500 dark:hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <Link
            href="/kerkesat"
            onClick={() => setShowPending(false)}
            className="mt-3 inline-flex items-center justify-center w-full btn-primary text-sm"
          >
            Shiko Kërkesat
          </Link>
        </div>
      )}

      {showUnsent && approvedUnsent > 0 && (
        <div className="bg-white dark:bg-slate-800 border border-blue-200 dark:border-blue-800 rounded-2xl shadow-2xl p-4 animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
              <Send className="w-4.5 h-4.5 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-semibold text-sm text-slate-800 dark:text-white">S&apos;janë dërguar ende</p>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                {approvedUnsent} {approvedUnsent === 1 ? "kërkesë e aprovuar" : "kërkesa të aprovuara"} presin të dërgohen te FurnitoriOra
              </p>
            </div>
            <button onClick={() => setShowUnsent(false)} className="text-slate-300 hover:text-slate-500 dark:hover:text-slate-300">
              <X className="w-4 h-4" />
            </button>
          </div>
          <Link
            href="/kerkesat"
            onClick={() => setShowUnsent(false)}
            className="mt-3 inline-flex items-center justify-center w-full btn-primary text-sm"
          >
            Shiko dhe Dërgo
          </Link>
        </div>
      )}
    </div>
  );
}
