"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import QRCode from "qrcode";
import { Copy, Check, QrCode, ExternalLink, FileCheck2 } from "lucide-react";
import { seatsInfo } from "./DecisionButtons";

interface Seat { id: number; name: string; free: number; capacity: number; students: number }
interface Rules { evidencaGrade1: boolean; evidencaOtherGrades: boolean; delayDays: number; enrollmentOpen: boolean }

function Toggle({ on, onChange, disabled, label }: { on: boolean; onChange: () => void; disabled?: boolean; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={onChange} disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 disabled:opacity-50 ${on ? "bg-primary-600" : "bg-slate-300 dark:bg-slate-600"}`}>
      <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${on ? "translate-x-5" : "translate-x-0"}`} />
    </button>
  );
}

// Kolona anësore e Regjistrimeve: vendet e lira (nga moduli Klasat), rregulli
// i evidencës (vetëm Super Admin e ndryshon — kontrolli real te /api/settings)
// dhe formulari publik (link, QR si PNG, hap, "Pranon aplikime").
export default function EnrollmentSidebar({ seats, rules, canEditRules, onChanged }: {
  seats: Seat[]; rules: Rules; canEditRules: boolean; onChanged: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [url, setUrl] = useState("/apliko");
  useEffect(() => { setUrl(`${window.location.origin}/apliko`); }, []);

  async function save(patch: Record<string, string>) {
    setBusy(true);
    try {
      const r = await fetch("/api/settings", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) });
      if (!r.ok) { const d = await r.json().catch(() => ({})); alert(d.error || "Ruajtja dështoi."); return; }
      onChanged();
    } catch { alert("Gabim rrjeti — provo përsëri."); }
    finally { setBusy(false); }
  }

  async function copy() {
    try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 1800); }
    catch { prompt("Kopjo linkun:", url); }
  }

  async function downloadQr() {
    try {
      const dataUrl = await QRCode.toDataURL(url, { width: 768, margin: 2, color: { dark: "#1e1b4b", light: "#ffffff" } });
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "Formulari-i-regjistrimit-QR.png";
      a.click();
    } catch { alert("Gjenerimi i QR kodit dështoi."); }
  }

  return (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:self-start">
      {/* a) Vendet e lira */}
      <div className="card p-4 space-y-3">
        <h3 className="section-title">Vende të lira sipas klasave</h3>
        <div className="grid grid-cols-3 gap-2">
          {seats.map(s => {
            const info = seatsInfo(s.free);
            const tone = s.free <= 0 ? "bg-red-50 border-red-200 dark:bg-red-900/20 dark:border-red-800"
              : s.free <= 2 ? "bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800"
              : "bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800";
            return (
              <div key={s.id} className={`rounded-lg border p-2 ${tone}`} title={`${s.students}/${s.capacity} nxënës`}>
                <p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{s.name}</p>
                <p className={`text-base font-bold ${info.className}`}>{s.free <= 0 ? "Plot" : s.free}</p>
              </div>
            );
          })}
        </div>
        <p className="text-[11px] text-slate-400">Përditësohet automatikisht nga moduli Klasat.</p>
      </div>

      {/* b) Rregulli i evidencës */}
      <div className="card p-4 space-y-3">
        <h3 className="section-title">Rregulli i evidencës</h3>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Klasa 1</p>
            <p className="text-xs text-slate-400">{rules.evidencaGrade1 ? "E detyrueshme para pranimit" : "Opsionale, sipas rastit"}</p>
          </div>
          <Toggle on={rules.evidencaGrade1} disabled={!canEditRules || busy} label="Evidenca e detyrueshme për Klasën 1"
            onChange={() => save({ enrollmentEvidencaGrade1: rules.evidencaGrade1 ? "false" : "true" })} />
        </div>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">Klasat 2–9</p>
            <p className="text-xs text-slate-400">{rules.evidencaOtherGrades ? "E detyrueshme para pranimit" : "Opsionale, sipas rastit"}</p>
          </div>
          <Toggle on={rules.evidencaOtherGrades} disabled={!canEditRules || busy} label="Evidenca e detyrueshme për Klasat 2–9"
            onChange={() => save({ enrollmentEvidencaOtherGrades: rules.evidencaOtherGrades ? "false" : "true" })} />
        </div>
        <p className="text-[11px] text-slate-400">
          Vlen për aplikimet e reja dhe ato ende të papranuara; evidencat e nisura/plotësuara ruhen.
          {!canEditRules && " Vetëm administratorët mund ta ndryshojnë."}
        </p>
        <Link href="/regjistrimet?tab=EVIDENCAT_NXENESVE" className="text-xs text-primary-600 hover:text-primary-700 inline-flex items-center gap-1">
          <FileCheck2 className="w-3.5 h-3.5" /> Evidencat e nxënësve →
        </Link>
      </div>

      {/* c) Formulari publik */}
      <div className="card p-4 space-y-3">
        <h3 className="section-title">Formulari publik</h3>
        <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-600 px-3 py-2">
          <span className="text-xs text-slate-600 dark:text-slate-300 truncate flex-1">{url}</span>
          <button type="button" onClick={copy} className="text-xs font-semibold text-primary-600 inline-flex items-center gap-1" aria-label="Kopjo linkun e formularit">
            {copied ? <><Check className="w-3.5 h-3.5" /> U kopjua</> : <><Copy className="w-3.5 h-3.5" /> Kopjo</>}
          </button>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button type="button" onClick={downloadQr} className="btn-secondary text-xs justify-center"><QrCode className="w-4 h-4" /> Shkarko QR</button>
          <a href="/apliko" target="_blank" rel="noopener noreferrer" className="btn-secondary text-xs justify-center"><ExternalLink className="w-4 h-4" /> Hap formularin</a>
        </div>
        <div className="flex items-center justify-between gap-3 pt-1">
          <div>
            <p className="text-sm font-medium">Pranon aplikime</p>
            <p className="text-xs text-slate-400">{rules.enrollmentOpen ? "Formulari publik është i hapur" : "Mbyllur — prindërit shohin njoftimin"}</p>
          </div>
          <Toggle on={rules.enrollmentOpen} disabled={busy} label="Pranon aplikime"
            onChange={() => {
              if (rules.enrollmentOpen && !confirm("Ta mbyll formularin publik? Prindërit s'do të mund të dërgojnë aplikime të reja.")) return;
              save({ enrollmentOpen: rules.enrollmentOpen ? "false" : "true" });
            }} />
        </div>
      </div>
    </aside>
  );
}
