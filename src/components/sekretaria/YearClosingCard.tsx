"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Loader2 } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { SekretariaSummary } from "@/lib/sekretariaSummary";
import { SEK_MODULES } from "./modules";

type YC = SekretariaSummary["yearClosing"];

// Mbyllja e Vitit: progresi + hapat. Hapat 1–2 shënohen me dorë (ruhen me datë
// dhe përdorues); 3–5 llogariten nga të dhënat. Kalimi bëhet me asistentin e
// Klasave ("Kalo në vitin e ri"), i cili hap edhe vitin e ri në të njëjtin hap.
export default function YearClosingCard({ yc, canWrite, canClasses, onChanged }: {
  yc: YC; canWrite: boolean; canClasses: boolean; onChanged: () => void;
}) {
  const mod = SEK_MODULES.vitiShkollor;
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const done = yc.steps.filter(s => s.done).length;
  const nextIdx = yc.steps.findIndex(s => !s.done);
  const next = nextIdx >= 0 ? yc.steps[nextIdx] : null;

  async function toggle(stepKey: string, value: boolean) {
    setBusy(stepKey); setError("");
    try {
      const r = await fetch("/api/sekretaria/year-closing", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ yearLabel: yc.yearLabel, stepKey, done: value }),
      });
      if (!r.ok) { const d = await r.json().catch(() => ({})); setError(d.error || "Ruajtja dështoi."); return; }
      onChanged();
    } catch { setError("Gabim rrjeti — provo përsëri."); }
    finally { setBusy(null); }
  }

  return (
    <div className="card p-5 grid gap-5 md:grid-cols-[1fr_1.2fr]">
      <div className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <div className={`w-11 h-11 rounded-xl ${mod.bg} flex items-center justify-center shrink-0`}><mod.icon className={`w-5 h-5 ${mod.color}`} /></div>
          <div>
            <p className="font-semibold text-slate-800 dark:text-white">Mbyllja e Vitit {yc.yearLabel}</p>
            <p className="text-xs text-slate-400 mt-0.5">Notat, borxhet, viti i ri dhe kalimi i nxënësve në klasën e radhës.</p>
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1"><span>Progresi</span><span>{done} / {yc.steps.length} hapa</span></div>
          <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-700 overflow-hidden">
            <div className="h-full rounded-full bg-indigo-500 transition-all" style={{ width: `${(done / yc.steps.length) * 100}%` }} />
          </div>
        </div>
        {next ? (
          next.mode === "MANUAL" ? (
            <button onClick={() => toggle(next.key, true)} disabled={!canWrite || busy !== null} className="btn-primary text-sm self-start">
              {busy === next.key && <Loader2 className="w-4 h-4 animate-spin" />} Shëno të kryer hapin {nextIdx + 1} →
            </button>
          ) : canClasses ? (
            <Link href="/classes?wizard=1" className="btn-primary text-sm self-start">Vazhdo me hapin {nextIdx + 1} →</Link>
          ) : (
            <p className="text-xs text-slate-500">Hapi {nextIdx + 1} bëhet te moduli Klasat (s&apos;ke qasje).</p>
          )
        ) : (
          <p className="text-sm font-medium text-green-600 dark:text-green-400">✓ Mbyllja e vitit {yc.yearLabel} u krye. Viti {yc.nextLabel} është i hapur.</p>
        )}
        {error && <p className="text-xs text-red-500">{error}</p>}
        <Link href={mod.href} className="text-xs text-slate-400 hover:text-primary-600">Hap modulin Mbyllja e Vitit →</Link>
      </div>

      <ol className="space-y-2">
        {yc.steps.map((s, i) => (
          <li key={s.key} className="flex items-start gap-3">
            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${s.done ? "bg-green-500 text-white" : "bg-slate-100 dark:bg-slate-700 text-slate-500"}`}>
              {s.done ? <Check className="w-3.5 h-3.5" /> : i + 1}
            </span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm ${s.done ? "line-through text-slate-400" : "text-slate-700 dark:text-slate-200"}`}>{s.label}</p>
              <p className="text-[11px] text-slate-400">
                {s.mode === "MANUAL" ? "Shënohet me dorë" : "Nga të dhënat"}
                {s.done && s.doneAt && ` · ${formatDate(s.doneAt)}${s.doneBy ? ` · ${s.doneBy}` : ""}`}
                {s.key === "DEBTS" && yc.debtCount !== null && ` · ${yc.debtCount} nxënës me borxh shkollimi`}
                {(s.key === "PROMOTE" || s.key === "OPEN") && !s.done && " · me asistentin e Klasave"}
              </p>
            </div>
            {s.mode === "MANUAL" && (
              <label className="flex items-center gap-1 text-[11px] text-slate-500 shrink-0 cursor-pointer">
                <input type="checkbox" checked={s.done} disabled={!canWrite || busy !== null} onChange={e => toggle(s.key, e.target.checked)} aria-label={`${s.label} — i kryer`} />
                {busy === s.key ? <Loader2 className="w-3 h-3 animate-spin" /> : "Kryer"}
              </label>
            )}
          </li>
        ))}
      </ol>
    </div>
  );
}
