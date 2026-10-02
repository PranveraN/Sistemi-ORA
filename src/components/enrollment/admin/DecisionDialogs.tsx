"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { X, Loader2, CheckCircle2, Users, AlertTriangle, ExternalLink } from "lucide-react";
import { seatsInfo } from "./DecisionButtons";

interface SeatRow { id: number; name: string; grade: number | null; capacity: number; students: number; free: number }
interface Preview {
  status: string;
  evidencaLabel: string;
  canApprove: boolean;
  desiredGrade: number | null;
  classes: SeatRow[];
  family: { familyId: string | null; siblings: { id: number; name: string; className: string | null }[] };
  parentPhone: string | null;
  parentName: string | null;
  smsTemplate: string;
}

const REJECT_REASONS = [
  { key: "NO_SEATS", label: "Nuk ka vende të lira" },
  { key: "DOCUMENTS", label: "Dokumente të paplotësuara" },
  { key: "AGE", label: "Mosha nuk përputhet me klasën" },
  { key: "WITHDRAWN", label: "Prindi e tërhoqi aplikimin" },
  { key: "DUPLICATE", label: "Aplikim i dyfishtë" },
  { key: "OTHER", label: "Tjetër" },
];

const REJECT_SMS = "I nderuar prind, ju njoftojmë se aplikimi për {emri} nuk u pranua këtë herë. Për më shumë informata kontaktoni shkollën. Akademia Ora";

function Shell({ title, onClose, busy, children }: { title: string; onClose: () => void; busy?: boolean; children: React.ReactNode }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && !busy) onClose(); };
    window.addEventListener("keydown", esc);
    return () => window.removeEventListener("keydown", esc);
  }, [busy, onClose]);
  return (
    <div className="fixed inset-0 z-[60] bg-black/40 flex items-center justify-center p-4" onClick={() => !busy && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={title} onClick={e => e.stopPropagation()}
        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
          <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
          <button onClick={onClose} disabled={busy} aria-label="Mbyll" className="p-1 rounded text-slate-400 hover:text-slate-700"><X className="w-4 h-4" /></button>
        </div>
        <div className="p-5 space-y-4">{children}</div>
      </div>
    </div>
  );
}

/* ───────────────────────────── Prano ───────────────────────────── */

export function ApproveDialog({ app, onClose, onDone }: {
  app: { id: number; firstName: string; lastName: string };
  onClose: () => void;
  onDone: () => void;
}) {
  const [preview, setPreview] = useState<Preview | null>(null);
  const [classId, setClassId] = useState("");
  const [sendSms, setSendSms] = useState(true);
  const [smsText, setSmsText] = useState("");
  const [confirmOver, setConfirmOver] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ studentId: number; className: string; sms: { ok: boolean; error?: string } | null } | null>(null);

  useEffect(() => {
    fetch(`/api/enrollment/applications/${app.id}/approve`).then(async r => {
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.error || "Ngarkimi dështoi."); return; }
      setPreview(d);
      setSmsText(d.smsTemplate);
      // Paralelja e propozuar: e klasës së kërkuar me më shumë vende të lira
      const same = (d.classes as SeatRow[]).filter(c => c.grade === d.desiredGrade).sort((a, b) => b.free - a.free);
      if (same[0]) setClassId(String(same[0].id));
    }).catch(() => setError("Gabim rrjeti — provo përsëri."));
  }, [app.id]);

  const options = useMemo(() => {
    if (!preview) return [];
    const same = preview.classes.filter(c => c.grade === preview.desiredGrade);
    const others = preview.classes.filter(c => c.grade !== preview.desiredGrade);
    return [...same, ...others];
  }, [preview]);
  const chosen = options.find(c => String(c.id) === classId);
  const over = !!chosen && chosen.free <= 0;

  async function submit() {
    if (!chosen) return;
    if (over && !confirmOver) { setError(`Klasa ${chosen.name} është plot (${chosen.students}/${chosen.capacity}). Konfirmo pranimin mbi kapacitet.`); return; }
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/enrollment/applications/${app.id}/approve`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ classId: chosen.id, force: over && confirmOver, sendSms, smsText }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.message || d.error || "Pranimi dështoi."); return; }
      setResult(d);
      onDone();
    } catch { setError("Gabim rrjeti — kontrollo listën para se ta provosh përsëri."); }
    finally { setBusy(false); }
  }

  if (result) {
    return (
      <Shell title="Aplikimi u pranua" onClose={onClose}>
        <div className="text-center space-y-3">
          <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
          <p className="text-sm">{app.firstName} {app.lastName} u regjistrua në klasën <b>{result.className}</b>.</p>
          {result.sms && (
            <p className={`text-xs ${result.sms.ok ? "text-green-600" : "text-orange-600"}`}>
              {result.sms.ok ? "SMS-i i konfirmimit u dërgua te prindi." : `SMS-i s'u dërgua: ${result.sms.error ?? ""}`}
            </p>
          )}
          <div className="flex justify-center gap-2">
            <Link href={`/students/${result.studentId}`} className="btn-primary"><ExternalLink className="w-4 h-4" /> Profili i nxënësit</Link>
            <button onClick={onClose} className="btn-secondary">Mbyll</button>
          </div>
        </div>
      </Shell>
    );
  }

  return (
    <Shell title={`Prano: ${app.firstName} ${app.lastName}`} onClose={onClose} busy={busy}>
      {!preview && !error && <p className="text-sm text-slate-400 flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Duke ngarkuar...</p>}
      {preview && !preview.canApprove && (
        <p className="text-sm text-orange-600 flex items-start gap-1.5"><AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          Evidenca: {preview.evidencaLabel}. Për këtë klasë evidenca duhet plotësuar para pranimit.</p>
      )}
      {preview && preview.canApprove && (
        <>
          <div>
            <label className="form-label">Klasa (paralelja) {preview.desiredGrade != null && <span className="text-slate-400 font-normal">· kërkuar: Klasa {preview.desiredGrade}</span>}</label>
            <select value={classId} onChange={e => { setClassId(e.target.value); setConfirmOver(false); }} className="form-input">
              <option value="">Zgjidh paralelen...</option>
              {options.map(c => <option key={c.id} value={c.id}>{c.name} — {seatsInfo(c.free).text}</option>)}
            </select>
            {chosen && <p className={`text-xs mt-1 ${seatsInfo(chosen.free).className}`}>{chosen.students}/{chosen.capacity} nxënës · {seatsInfo(chosen.free).text}</p>}
          </div>
          {over && (
            <label className="flex items-start gap-2 text-sm text-orange-700 bg-orange-50 dark:bg-orange-900/20 rounded-lg p-3">
              <input type="checkbox" checked={confirmOver} onChange={e => setConfirmOver(e.target.checked)} className="mt-0.5" />
              Klasa {chosen!.name} ka {chosen!.students}/{chosen!.capacity} nxënës. E pranoj gjithsesi, mbi kapacitet.
            </label>
          )}
          <div className="rounded-lg bg-slate-50 dark:bg-slate-800/60 p-3 text-sm">
            <p className="font-medium flex items-center gap-1.5"><Users className="w-4 h-4 text-slate-400" /> Familja</p>
            {preview.family.siblings.length ? (
              <p className="text-slate-600 dark:text-slate-300 mt-1">
                Lidhet me familjen ekzistuese: {preview.family.siblings.map(s => `${s.name}${s.className ? ` (${s.className})` : ""}`).join(", ")}
              </p>
            ) : (
              <p className="text-slate-500 mt-1">S&apos;u gjet familje ekzistuese — krijohet familje e re (sipas telefonit të prindit).</p>
            )}
          </div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={sendSms} onChange={e => setSendSms(e.target.checked)} disabled={!preview.parentPhone} />
              Dërgo SMS konfirmimi te prindi {preview.parentPhone ? <span className="text-slate-400">({preview.parentPhone})</span> : <span className="text-slate-400">(pa numër)</span>}
            </label>
            {sendSms && preview.parentPhone && (
              <textarea value={smsText} onChange={e => setSmsText(e.target.value)} className="form-input min-h-[80px] text-sm" aria-label="Teksti i SMS-it" />
            )}
            {sendSms && <p className="text-[11px] text-slate-400">{"{emri}"} dhe {"{klasa}"} zëvendësohen automatikisht.</p>}
          </div>
        </>
      )}
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} disabled={busy} className="btn-secondary">Anulo</button>
        {preview?.canApprove && (
          <button onClick={submit} disabled={busy || !chosen || (over && !confirmOver)}
            className={over ? "px-4 py-2 rounded-xl text-sm font-semibold bg-orange-500 text-white hover:bg-orange-600 disabled:opacity-50 inline-flex items-center gap-1.5" : "btn-primary"}>
            {busy && <Loader2 className="w-4 h-4 animate-spin" />} {over ? "Prano gjithsesi" : "Prano"}
          </button>
        )}
      </div>
    </Shell>
  );
}

/* ───────────────────────────── Refuzo ───────────────────────────── */

export function RejectDialog({ app, onClose, onDone }: {
  app: { id: number; firstName: string; lastName: string; parentPhone?: string | null };
  onClose: () => void;
  onDone: () => void;
}) {
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [sendSms, setSendSms] = useState(false);
  const [smsText, setSmsText] = useState(REJECT_SMS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit() {
    if (!reason) { setError("Zgjidh arsyen e refuzimit."); return; }
    if (reason === "OTHER" && !note.trim()) { setError("Për \"Tjetër\" shkruaj arsyen."); return; }
    setBusy(true); setError("");
    try {
      const r = await fetch(`/api/enrollment/applications/${app.id}/reject`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejectReason: reason, reviewNote: note.trim() || null, sendSms, smsText }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) { setError(d.message || d.error || "Refuzimi dështoi."); return; }
      if (d.sms && !d.sms.ok) alert(`Aplikimi u refuzua, por SMS-i s'u dërgua: ${d.sms.error ?? ""}`);
      onDone();
      onClose();
    } catch { setError("Gabim rrjeti — provo përsëri."); }
    finally { setBusy(false); }
  }

  return (
    <Shell title={`Refuzo: ${app.firstName} ${app.lastName}`} onClose={onClose} busy={busy}>
      <div>
        <label className="form-label">Arsyeja <span className="text-red-500">*</span></label>
        <select value={reason} onChange={e => setReason(e.target.value)} className="form-input">
          <option value="">Zgjidh arsyen...</option>
          {REJECT_REASONS.map(r => <option key={r.key} value={r.key}>{r.label}</option>)}
        </select>
      </div>
      <div>
        <label className="form-label">Shënim {reason === "OTHER" ? <span className="text-red-500">*</span> : <span className="text-slate-400 font-normal">(opsional)</span>}</label>
        <textarea value={note} onChange={e => setNote(e.target.value)} className="form-input min-h-[70px]" maxLength={1000} />
      </div>
      <div className="space-y-2">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={sendSms} onChange={e => setSendSms(e.target.checked)} disabled={!app.parentPhone} />
          Njofto prindin me SMS {app.parentPhone ? <span className="text-slate-400">({app.parentPhone})</span> : <span className="text-slate-400">(pa numër)</span>}
        </label>
        {sendSms && <textarea value={smsText} onChange={e => setSmsText(e.target.value)} className="form-input min-h-[80px] text-sm" aria-label="Teksti i SMS-it" />}
      </div>
      {error && <p className="text-sm text-red-500">{error}</p>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} disabled={busy} className="btn-secondary">Anulo</button>
        <button onClick={submit} disabled={busy} className="px-4 py-2 rounded-xl text-sm font-semibold bg-red-600 text-white hover:bg-red-700 disabled:opacity-50 inline-flex items-center gap-1.5">
          {busy && <Loader2 className="w-4 h-4 animate-spin" />} Refuzo
        </button>
      </div>
    </Shell>
  );
}
