"use client";

import { useEffect, useRef, useState } from "react";
import { X, Loader2, Info } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";
import { EXEMPTION_REASONS } from "@/lib/feeLedger";
import type { EsStudent } from "./types";

// Dritaret e faqes Eshkollori → Të hyra. Çdo veprim që ndryshon shumë/borxh
// kërkon arsye; serveri e kontrollon sërish dhe e ruan në histori.

const yl = (y: number | null) => (y ? `${y}–${y + 1}` : "—");

export function Modal({ title, subtitle, onClose, children, footer, width = "max-w-md", busy }: {
  title: string; subtitle?: string; onClose: () => void; children: React.ReactNode; footer: React.ReactNode; width?: string; busy?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { ref.current?.querySelector<HTMLElement>("input,select,textarea,button")?.focus(); }, []);
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4"
      onMouseDown={e => { if (e.target === e.currentTarget && !busy) onClose(); }}
      onKeyDown={e => { if (e.key === "Escape" && !busy) onClose(); }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="es-modal-title"
        className={`w-full ${width} max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-slate-800 shadow-2xl animate-fade-in`}>
        <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4 border-b border-slate-100 dark:border-slate-700">
          <div>
            <h2 id="es-modal-title" className="text-lg font-bold text-slate-900 dark:text-white">{title}</h2>
            {subtitle && <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} disabled={busy} aria-label="Mbyll" className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"><X className="w-5 h-5" /></button>
        </div>
        <div className="overflow-y-auto px-5 py-4 space-y-4">{children}</div>
        <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 px-5 py-4 border-t border-slate-100 dark:border-slate-700">{footer}</div>
      </div>
    </div>
  );
}

function Err({ msg }: { msg?: string }) {
  return msg ? <p role="alert" className="text-sm text-red-600 dark:text-red-400">{msg}</p> : null;
}

async function post(url: string, body: unknown, method = "POST"): Promise<{ ok: boolean; error?: string; field?: string }> {
  try {
    const r = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const d = await r.json().catch(() => ({}));
    return r.ok ? { ok: true } : { ok: false, error: d.error || "Ruajtja dështoi.", field: d.field };
  } catch {
    return { ok: false, error: "Gabim rrjeti — provo përsëri." };
  }
}

const parseAmt = (v: string) => parseFloat(v.replace(/\s|€/g, "").replace(",", "."));

/* ── "+ Pagesë" / "Regjistro pagesë" ───────────────────────────────── */
export function PaymentModal({ student, students, year, debtId, onClose, onSaved }: {
  student: EsStudent | null; students: EsStudent[]; year: number; debtId?: number; onClose: () => void; onSaved: () => void;
}) {
  const [picked, setPicked] = useState<EsStudent | null>(student);
  const [query, setQuery] = useState("");
  const s = picked;
  const targets = s ? [
    ...(s.debt > 0 ? [{ key: "Y", label: `Viti ${yl(year)} — borxhi ${formatCurrency(s.debt)}`, max: s.debt, debtId: undefined as number | undefined }] : []),
    ...s.oldDebts.map(o => ({ key: `D${o.id}`, label: `Borxhi i vjetër ${yl(o.year)} — ${formatCurrency(o.amount)}`, max: o.amount, debtId: o.id })),
  ] : [];
  const [target, setTarget] = useState(debtId ? `D${debtId}` : "Y");
  const t = targets.find(x => x.key === target) ?? targets[0];
  const [amount, setAmount] = useState("");
  const [method, setMethod] = useState("");
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => { if (t) setAmount(String(t.max).replace(".", ",")); }, [t?.key]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!s || !t) return;
    const amt = parseAmt(amount);
    if (!(amt > 0)) { setError("Shkruani shumën e pagesës."); return; }
    if (!method) { setError("Zgjidhni mënyrën e pagesës (Cash ose Bankë)."); return; }
    setBusy(true); setError("");
    const r = await post("/api/eshkollori/payment", { studentId: s.id, year, amount: amt, method, date, debtId: t.debtId });
    setBusy(false);
    if (r.ok) { onSaved(); onClose(); } else setError(r.error!);
  }

  const matches = query.trim()
    ? students.filter(x => `${x.name} ${x.parent ?? ""}`.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [];

  return (
    <Modal title={s ? `Regjistro pagesë – ${s.name}` : "Regjistro pagesë"} subtitle={s ? [s.className, s.parent && `prindi: ${s.parent}`].filter(Boolean).join(" · ") : undefined}
      onClose={onClose} busy={busy}
      footer={<>
        <button type="button" onClick={onClose} disabled={busy} className="btn-secondary justify-center">Anulo</button>
        <button type="button" onClick={save} disabled={busy || !s || !t} className="btn-primary justify-center">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Regjistro pagesën</button>
      </>}>
      {!s ? (
        <div>
          <label htmlFor="es-pick" className="form-label">Nxënësi</label>
          <input id="es-pick" value={query} onChange={e => setQuery(e.target.value)} className="form-input" placeholder="Kërko nxënësin ose prindin…" autoComplete="off" />
          <ul className="mt-2 divide-y divide-slate-100 dark:divide-slate-700">
            {matches.map(m => (
              <li key={m.id}>
                <button type="button" onClick={() => { setPicked(m); setTarget(m.debt > 0 ? "Y" : m.oldDebts[0] ? `D${m.oldDebts[0].id}` : "Y"); }}
                  className="w-full text-left px-2 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-700 rounded-lg">
                  <b className="text-slate-900 dark:text-white">{m.name}</b> <span className="text-slate-500">{m.className} · borxhi {formatCurrency(m.debt + m.oldDebt)}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : !targets.length ? (
        <p className="text-sm text-slate-600 dark:text-slate-300">{s.name} s&apos;ka asnjë borxh për t&apos;u paguar.</p>
      ) : (
        <>
          {targets.length > 1 && (
            <div>
              <label htmlFor="es-target" className="form-label">Për</label>
              <select id="es-target" value={t?.key} onChange={e => setTarget(e.target.value)} className="form-input">
                {targets.map(x => <option key={x.key} value={x.key}>{x.label}</option>)}
              </select>
            </div>
          )}
          {targets.length === 1 && <p className="text-sm text-slate-600 dark:text-slate-300">{t?.label}</p>}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="es-amt" className="form-label">Shuma (€)</label>
              <input id="es-amt" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className="form-input" />
            </div>
            <div>
              <label htmlFor="es-date" className="form-label">Data</label>
              <input id="es-date" type="date" value={date} onChange={e => setDate(e.target.value)} className="form-input" />
            </div>
          </div>
          <fieldset>
            <legend className="form-label">Mënyra</legend>
            <div className="grid grid-cols-2 gap-2">
              {[["CASH", "Cash"], ["BANK", "Bankë"]].map(([v, l]) => (
                <label key={v} className={`flex items-center gap-2 rounded-xl border-2 px-3 py-2.5 text-sm font-semibold cursor-pointer ${method === v ? "border-primary-500 bg-primary-50 dark:bg-primary-900/20" : "border-slate-200 dark:border-slate-700"}`}>
                  <input type="radio" name="es-method" value={v} checked={method === v} onChange={() => setMethod(v)} className="accent-primary-600" /> {l}
                </label>
              ))}
            </div>
          </fieldset>
        </>
      )}
      <Err msg={error} />
    </Modal>
  );
}

/* ── "Ndrysho shumën" (laps) ───────────────────────────────────────── */
export function AmountModal({ student, year, defaultAmount, onClose, onSaved }: {
  student: EsStudent; year: number; defaultAmount: number; onClose: () => void; onSaved: () => void;
}) {
  const [amount, setAmount] = useState(String(student.base).replace(".", ","));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ msg: string; field?: string } | null>(null);

  async function save() {
    const amt = parseAmt(amount);
    if (!Number.isFinite(amt) || amt < 0) { setError({ msg: "Shkruani shumën e re.", field: "amount" }); return; }
    if (!reason.trim()) { setError({ msg: "Shkruani arsyen.", field: "reason" }); return; }
    setBusy(true); setError(null);
    const r = await post("/api/eshkollori/amount", { studentId: student.id, year, amount: amt, reason: reason.trim() });
    setBusy(false);
    if (r.ok) { onSaved(); onClose(); } else setError({ msg: r.error!, field: r.field });
  }

  return (
    <Modal title={`Ndrysho shumën – ${student.name}`} subtitle={`${student.className ?? ""} · ${yl(year)} · shuma standarde ${formatCurrency(defaultAmount)}`} onClose={onClose} busy={busy}
      footer={<>
        <button type="button" onClick={onClose} disabled={busy} className="btn-secondary justify-center">Anulo</button>
        <button type="button" onClick={save} disabled={busy} className="btn-primary justify-center">{busy && <Loader2 className="w-4 h-4 animate-spin" />} Ruaj shumën</button>
      </>}>
      <div>
        <label htmlFor="es-new" className="form-label">Shuma e re (€)</label>
        <input id="es-new" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} aria-invalid={error?.field === "amount"}
          className={`form-input ${error?.field === "amount" ? "border-red-500" : ""}`} />
        <p className="text-xs text-slate-500 mt-1">Vlen vetëm për këtë nxënës, për {yl(year)}.</p>
      </div>
      <div>
        <label htmlFor="es-reason" className="form-label">Arsyeja (e detyrueshme)</label>
        <textarea id="es-reason" value={reason} onChange={e => setReason(e.target.value)} rows={3} aria-invalid={error?.field === "reason"}
          className={`form-input ${error?.field === "reason" ? "border-red-500" : ""}`} placeholder="P.sh. marrëveshje me familjen, regjistruar në mes të vitit…" />
      </div>
      <Err msg={error?.msg} />
    </Modal>
  );
}

/* ── "Liro nga pagesa" ─────────────────────────────────────────────── */
export function ExemptModal({ student, year, onClose, onSaved }: {
  student: EsStudent; year: number; onClose: () => void; onSaved: () => void;
}) {
  const [type, setType] = useState<"FULL" | "PARTIAL">("FULL");
  const [percent, setPercent] = useState("50");
  const [reason, setReason] = useState("SOCIAL");
  const [reasonText, setReasonText] = useState("");
  const [period, setPeriod] = useState<"YEAR" | "OPEN">("YEAR");
  const [cancelReason, setCancelReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ msg: string; field?: string } | null>(null);
  const cur = student.exemption;

  async function save() {
    if (type === "PARTIAL" && !(parseAmt(percent) > 0 && parseAmt(percent) < 100)) { setError({ msg: "Shkruani përqindjen (1–99).", field: "percent" }); return; }
    if (reason === "OTHER" && !reasonText.trim()) { setError({ msg: "Shkruani arsyen.", field: "reasonText" }); return; }
    setBusy(true); setError(null);
    const r = await post("/api/eshkollori/exemption", { studentId: student.id, year, type, percent: parseAmt(percent), reason, reasonText, period });
    setBusy(false);
    if (r.ok) { onSaved(); onClose(); } else setError({ msg: r.error!, field: r.field });
  }

  async function cancel() {
    if (!cur) return;
    if (!cancelReason.trim()) { setError({ msg: "Shkruani arsyen e anulimit.", field: "cancel" }); return; }
    setBusy(true); setError(null);
    const r = await post(`/api/eshkollori/exemption/${cur.id}/cancel`, { reason: cancelReason.trim(), year });
    setBusy(false);
    if (r.ok) { onSaved(); onClose(); } else setError({ msg: r.error!, field: "cancel" });
  }

  const radio = (on: boolean) => `flex items-start gap-2.5 rounded-xl border-2 p-3 cursor-pointer ${on ? "border-teal-600 bg-teal-50 dark:bg-teal-900/20" : "border-slate-200 dark:border-slate-700"}`;
  return (
    <Modal title="Liro nga pagesa" subtitle={[student.name, student.className, student.parent && `prindi: ${student.parent}`].filter(Boolean).join(" · ")} onClose={onClose} busy={busy}
      footer={<>
        <button type="button" onClick={onClose} disabled={busy} className="btn-secondary justify-center">Anulo</button>
        <button type="button" onClick={save} disabled={busy} className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold disabled:opacity-60">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Liro nga pagesa
        </button>
      </>}>
      {cur && (
        <div className="rounded-xl border border-teal-200 dark:border-teal-900 bg-teal-50/60 dark:bg-teal-950/30 p-3 space-y-2 text-sm">
          <p className="text-teal-900 dark:text-teal-200">
            Aktualisht: <b>{cur.type === "FULL" ? "Falas plotësisht" : `Zbritje ${cur.percent}%`}</b> · {EXEMPTION_REASONS.find(r => r.value === cur.reason)?.label}{cur.reasonText ? `: ${cur.reasonText}` : ""}
            {cur.createdByName && <> · nga {cur.createdByName}, {formatDate(cur.createdAt)}</>}
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input value={cancelReason} onChange={e => setCancelReason(e.target.value)} aria-label="Arsyeja e anulimit" placeholder="Arsyeja e anulimit…" className="form-input text-sm flex-1" />
            <button type="button" onClick={cancel} disabled={busy} className="btn-secondary text-sm justify-center">Anulo lirimin</button>
          </div>
        </div>
      )}
      <fieldset className="space-y-2">
        <legend className="form-label">Lloji</legend>
        <label className={radio(type === "FULL")}>
          <input type="radio" name="es-type" checked={type === "FULL"} onChange={() => setType("FULL")} className="mt-1 accent-teal-700" />
          <span><b className="text-sm text-slate-900 dark:text-white">Falas plotësisht</b><span className="block text-xs text-slate-500">Nuk paguan asgjë këtë vit</span></span>
        </label>
        <label className={`${radio(type === "PARTIAL")} items-center`}>
          <input type="radio" name="es-type" checked={type === "PARTIAL"} onChange={() => setType("PARTIAL")} className="accent-teal-700" />
          <b className="text-sm text-slate-900 dark:text-white flex-1">Zbritje e pjesshme</b>
          <input inputMode="decimal" value={percent} onChange={e => { setPercent(e.target.value); setType("PARTIAL"); }} aria-label="Përqindja e zbritjes"
            className={`form-input w-16 text-right py-1 ${error?.field === "percent" ? "border-red-500" : ""}`} />
          <span className="text-sm text-slate-600">%</span>
        </label>
      </fieldset>
      <div>
        <label htmlFor="es-ex-reason" className="form-label">Arsyeja</label>
        <select id="es-ex-reason" value={reason} onChange={e => setReason(e.target.value)} className="form-input">
          {EXEMPTION_REASONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
        </select>
        {reason === "OTHER" && (
          <input value={reasonText} onChange={e => setReasonText(e.target.value)} aria-label="Shkruani arsyen" placeholder="Shkruani arsyen…"
            className={`form-input mt-2 ${error?.field === "reasonText" ? "border-red-500" : ""}`} />
        )}
        <p className="text-xs text-slate-500 mt-1">{EXEMPTION_REASONS.map(r => r.label).join(" · ")}</p>
      </div>
      <fieldset>
        <legend className="form-label">Periudha</legend>
        <div className="flex flex-wrap gap-2">
          {([["YEAR", `Vetëm ${yl(year)}`], ["OPEN", "Deri sa ta ndryshoj"]] as const).map(([v, l]) => (
            <button key={v} type="button" aria-pressed={period === v} onClick={() => setPeriod(v)}
              className={`px-3 py-2 rounded-lg text-sm font-semibold border ${period === v ? "bg-slate-900 text-white border-slate-900 dark:bg-white dark:text-slate-900" : "border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-200"}`}>{l}</button>
          ))}
        </div>
      </fieldset>
      <p className="flex gap-2 rounded-xl bg-teal-50 dark:bg-teal-950/30 text-teal-900 dark:text-teal-200 text-xs p-3">
        <Info className="w-4 h-4 shrink-0" aria-hidden />
        Nxënësi kalon te grupi Falas, nuk llogaritet në borxhe dhe shuma e liruar shfaqet te „Të liruar (falas)”. Ruhet kush e liroi dhe kur.
      </p>
      <Err msg={error?.msg} />
    </Modal>
  );
}

/* ── Borxhi i vjetër: Ndrysho / Fale / Fshi ────────────────────────── */
export type DebtAction = "EDIT" | "FORGIVE" | "VOID";

export function OldDebtModal({ student, initial, onClose, onSaved }: {
  student: EsStudent; initial: DebtAction; onClose: () => void; onSaved: () => void;
}) {
  const [action, setAction] = useState<DebtAction>(initial);
  const single = student.oldDebts.length === 1;
  const [which, setWhich] = useState<string>(single ? String(student.oldDebts[0].id) : "ALL");
  const chosen = which === "ALL" ? student.oldDebts : student.oldDebts.filter(o => String(o.id) === which);
  const sum = chosen.reduce((s, o) => s + o.amount, 0);
  const [amount, setAmount] = useState(single ? String(student.oldDebts[0].total).replace(".", ",") : "");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ msg: string; field?: string } | null>(null);

  useEffect(() => { if (chosen.length === 1) setAmount(String(chosen[0].total).replace(".", ",")); }, [which]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (action === "EDIT" && chosen.length !== 1) { setError({ msg: "Zgjidhni një vit për ta ndryshuar.", field: "year" }); return; }
    if (action === "EDIT" && !(parseAmt(amount) > 0)) { setError({ msg: "Shkruani shumën e re.", field: "amount" }); return; }
    if (!reason.trim()) { setError({ msg: "Shkruani arsyen.", field: "reason" }); return; }
    if (action === "VOID" && !confirm(`Fshi borxhin e vjetër të ${student.name} (${formatCurrency(sum)})? Përdore vetëm kur borxhi nuk ka ekzistuar kurrë.`)) return;
    setBusy(true); setError(null);
    const r = await post("/api/eshkollori/old-debt", { studentId: student.id, debtIds: chosen.map(o => o.id), action, amount: parseAmt(amount), reason: reason.trim() }, "PATCH");
    setBusy(false);
    if (r.ok) { onSaved(); onClose(); } else setError({ msg: r.error!, field: r.field });
  }

  const label = action === "EDIT" ? "Ndrysho shumën" : action === "FORGIVE" ? `Fale borxhin (${formatCurrency(sum)})` : "Fshi borxhin";
  const opt = (v: DebtAction, title: string, desc: string) => (
    <label className={`flex items-start gap-2.5 rounded-xl border-2 p-3 cursor-pointer ${action === v ? (v === "VOID" ? "border-red-500 bg-red-50/60 dark:bg-red-950/20" : "border-primary-500 bg-primary-50 dark:bg-primary-900/20") : "border-slate-200 dark:border-slate-700"}`}>
      <input type="radio" name="es-debt-action" checked={action === v} onChange={() => setAction(v)} className="mt-1 accent-primary-600" />
      <span><b className="text-sm text-slate-900 dark:text-white">{title}</b><span className="block text-xs text-slate-500">{desc}</span></span>
    </label>
  );
  return (
    <Modal title={`Borxhi i vjetër – ${student.name}`} subtitle={`${student.className ?? ""} · Gjithsej ${formatCurrency(student.oldDebt)}`} onClose={onClose} busy={busy}
      footer={<>
        <button type="button" onClick={onClose} disabled={busy} className="btn-secondary justify-center">Anulo</button>
        <button type="button" onClick={save} disabled={busy}
          className={`inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl text-white text-sm font-semibold disabled:opacity-60 ${action === "VOID" ? "bg-red-600 hover:bg-red-700" : "bg-primary-600 hover:bg-primary-700"}`}>
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} {label}
        </button>
      </>}>
      {!single && (
        <div>
          <label htmlFor="es-debt-year" className="form-label">Për vitin</label>
          <select id="es-debt-year" value={which} onChange={e => setWhich(e.target.value)} className={`form-input ${error?.field === "year" ? "border-red-500" : ""}`}>
            <option value="ALL">Të gjitha vitet ({formatCurrency(student.oldDebt)})</option>
            {student.oldDebts.map(o => <option key={o.id} value={o.id}>{yl(o.year)}: {formatCurrency(o.amount)}</option>)}
          </select>
        </div>
      )}
      <fieldset className="space-y-2">
        <legend className="form-label">Çka dëshiron të bësh?</legend>
        {opt("EDIT", "Ndrysho shumën", "Shuma e regjistruar është e pasaktë")}
        {opt("FORGIVE", "Fale borxhin", "Borxhi ishte real, por e fal shkolla. Mbetet në histori si „i falur”.")}
        {opt("VOID", "Fshi – ishte gabim", "Borxhi nuk ka ekzistuar kurrë (p.sh. import i gabuar).")}
      </fieldset>
      {action === "EDIT" && (
        <div>
          <label htmlFor="es-debt-amt" className="form-label">Shuma e re (€)</label>
          <input id="es-debt-amt" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} disabled={chosen.length !== 1}
            className={`form-input ${error?.field === "amount" ? "border-red-500" : ""}`} />
          {chosen.length !== 1 && <p className="text-xs text-slate-500 mt-1">Zgjidhni një vit për ta ndryshuar shumën.</p>}
        </div>
      )}
      <div>
        <label htmlFor="es-debt-reason" className="form-label">Arsyeja <span className="font-normal text-slate-500">(e detyrueshme)</span></label>
        <textarea id="es-debt-reason" value={reason} onChange={e => setReason(e.target.value)} rows={3}
          className={`form-input ${error?.field === "reason" ? "border-red-500" : ""}`} placeholder="P.sh. vendim i drejtorisë, familja në vështirësi…" />
      </div>
      <Err msg={error?.msg} />
    </Modal>
  );
}

/* ── "Shto / ndrysho borxhin e vjetër" ─────────────────────────────── */
export function OldDebtAddModal({ student, year, onClose, onSaved }: {
  student: EsStudent; year: number; onClose: () => void; onSaved: () => void;
}) {
  const years = Array.from({ length: 6 }, (_, i) => year - 1 - i);
  const [y, setY] = useState(years[0]);
  const existing = student.oldDebts.find(o => o.year === y);
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ msg: string; field?: string } | null>(null);
  useEffect(() => { setAmount(existing ? String(existing.total).replace(".", ",") : ""); }, [y]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save() {
    if (!(parseAmt(amount) > 0)) { setError({ msg: "Shkruani shumën.", field: "amount" }); return; }
    if (!reason.trim()) { setError({ msg: "Shkruani arsyen.", field: "reason" }); return; }
    setBusy(true); setError(null);
    const r = await post("/api/eshkollori/old-debt", { studentId: student.id, year: y, amount: parseAmt(amount), reason: reason.trim() });
    setBusy(false);
    if (r.ok) { onSaved(); onClose(); } else setError({ msg: r.error!, field: r.field });
  }

  return (
    <Modal title={`Borxhi i vjetër – ${student.name}`} subtitle={`${student.className ?? ""} · Gjithsej ${formatCurrency(student.oldDebt)}`} onClose={onClose} busy={busy}
      footer={<>
        <button type="button" onClick={onClose} disabled={busy} className="btn-secondary justify-center">Anulo</button>
        <button type="button" onClick={save} disabled={busy} className="btn-primary justify-center">{busy && <Loader2 className="w-4 h-4 animate-spin" />} {existing ? "Ndrysho borxhin" : "Shto borxhin"}</button>
      </>}>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="es-od-year" className="form-label">Viti</label>
          <select id="es-od-year" value={y} onChange={e => setY(parseInt(e.target.value))} className="form-input">
            {years.map(v => <option key={v} value={v}>{yl(v)}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="es-od-amt" className="form-label">Shuma (€)</label>
          <input id="es-od-amt" inputMode="decimal" value={amount} onChange={e => setAmount(e.target.value)} className={`form-input ${error?.field === "amount" ? "border-red-500" : ""}`} />
        </div>
      </div>
      {existing && <p className="text-xs text-slate-500">Ky vit ka tashmë borxh {formatCurrency(existing.total)} — do të ndryshohet.</p>}
      <div>
        <label htmlFor="es-od-reason" className="form-label">Arsyeja (e detyrueshme)</label>
        <textarea id="es-od-reason" value={reason} onChange={e => setReason(e.target.value)} rows={2} className={`form-input ${error?.field === "reason" ? "border-red-500" : ""}`} />
      </div>
      <Err msg={error?.msg} />
    </Modal>
  );
}

/* ── Historiku ─────────────────────────────────────────────────────── */
interface HistoryData {
  log: { id: number; action: string; year: number | null; oldValue: number | null; newValue: number | null; reason: string | null; detail: string | null; userName: string | null; createdAt: string }[];
  oldDebts: { id: number; year: number | null; finalAmount: number; paidAmount: number; balance: number; status: string; note: string | null }[];
}
const ACTION_LABEL: Record<string, string> = {
  PAYMENT: "Pagesë", AMOUNT: "Ndryshim shume", EXEMPT: "Lirim nga pagesa", EXEMPT_CANCEL: "Anulim lirimi",
  OLD_DEBT_ADD: "Borxh i vjetër i shtuar", OLD_DEBT_EDIT: "Borxh i vjetër i ndryshuar", OLD_DEBT_FORGIVE: "Borxh i vjetër i falur", OLD_DEBT_VOID: "Borxh i vjetër i fshirë (gabim)",
};
const DEBT_STATUS: Record<string, string> = { FORGIVEN: "i falur", VOID: "i fshirë (gabim)", PAID: "i paguar" };

export function HistoryModal({ student, onClose }: { student: EsStudent; onClose: () => void }) {
  const [data, setData] = useState<HistoryData | null>(null);
  useEffect(() => {
    fetch(`/api/eshkollori/history?studentId=${student.id}`).then(r => (r.ok ? r.json() : null)).then(setData).catch(() => {});
  }, [student.id]);
  return (
    <Modal title={`Historiku – ${student.name}`} subtitle={student.className ?? undefined} onClose={onClose} width="max-w-2xl"
      footer={<button type="button" onClick={onClose} className="btn-primary justify-center">Mbyll</button>}>
      {!data ? <p className="text-sm text-slate-400">Duke ngarkuar…</p> : (
        <>
          {data.oldDebts.length > 0 && (
            <section>
              <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Borxhi i vjetër</h3>
              <ul className="text-sm divide-y divide-slate-100 dark:divide-slate-700">
                {data.oldDebts.map(o => (
                  <li key={o.id} className="py-1.5 flex justify-between gap-3">
                    <span className="text-slate-700 dark:text-slate-200">{yl(o.year)} · {formatCurrency(o.finalAmount)}{o.paidAmount > 0 && ` · paguar ${formatCurrency(o.paidAmount)}`}</span>
                    <span className={`font-semibold ${o.status === "FORGIVEN" ? "text-teal-700" : o.status === "VOID" ? "text-slate-500 line-through" : o.balance > 0 ? "text-orange-700" : "text-green-700"}`}>
                      {DEBT_STATUS[o.status] ?? (o.balance > 0 ? "aktiv" : "i paguar")}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
          <section>
            <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500 mb-1.5">Veprimet</h3>
            {data.log.length === 0 ? <p className="text-sm text-slate-500">Asnjë veprim i regjistruar ende.</p> : (
              <ul className="text-sm divide-y divide-slate-100 dark:divide-slate-700">
                {data.log.map(l => (
                  <li key={l.id} className="py-2">
                    <p className="flex flex-wrap justify-between gap-x-3">
                      <b className="text-slate-900 dark:text-white">{ACTION_LABEL[l.action] ?? l.action}{l.year ? ` · ${yl(l.year)}` : ""}</b>
                      <span className="text-xs text-slate-500">{formatDate(l.createdAt)} {new Date(l.createdAt).toLocaleTimeString("sq-AL", { hour: "2-digit", minute: "2-digit" })}{l.userName ? ` · ${l.userName}` : ""}</span>
                    </p>
                    <p className="text-slate-600 dark:text-slate-300">
                      {l.detail ?? (l.oldValue !== null || l.newValue !== null ? `${l.oldValue !== null ? formatCurrency(l.oldValue) : "—"} → ${l.newValue !== null ? formatCurrency(l.newValue) : "—"}` : "")}
                      {l.reason && <span className="text-slate-500"> · Arsyeja: {l.reason}</span>}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </Modal>
  );
}
