"use client";

import { useState } from "react";
import { createRoot } from "react-dom/client";
import { Printer, X } from "lucide-react";

// Vula dhe nënshkrimi në dokumentet e printuara: përdoruesi zgjedh para printimit
// (dy tick-a, parazgjedhje: të dyja). Dokumentet nuk ndryshojnë — kur një tick hiqet,
// HTML-ja e printimit merr një <style> që i fsheh fotot e vulës/nënshkrimit sipas emrit.

export interface PrintBranding { stamp: boolean; sign: boolean }

const KEY = "print.vulaNenshkrimi";
const DEFAULT: PrintBranding = { stamp: true, sign: true };

const STAMP_IMGS = ["/vula-cu.png", "/vula-cl.png"];
const SIGN_IMGS = ["/Nenshkrimi.png", "/nenshkrimi-fature.png"];

export function loadPrintBranding(): PrintBranding {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) || "null");
    if (v && typeof v.stamp === "boolean" && typeof v.sign === "boolean") return v;
  } catch { /* localStorage i padisponueshëm */ }
  return DEFAULT;
}

export function savePrintBranding(b: PrintBranding) {
  try { localStorage.setItem(KEY, JSON.stringify(b)); } catch { /* s'ka rëndësi */ }
}

/** Shton në HTML-në e printimit rregullat që fshehin vulën dhe/ose nënshkrimin. */
export function applyPrintBranding(html: string, b: PrintBranding): string {
  const hide = [...(b.stamp ? [] : STAMP_IMGS), ...(b.sign ? [] : SIGN_IMGS)];
  if (!hide.length) return html;
  const style = `<style>${hide.map(src => `img[src*="${src}"]`).join(",")}{display:none !important;}</style>`;
  const i = html.search(/<\/head>/i);
  return i >= 0 ? html.slice(0, i) + style + html.slice(i) : style + html;
}

/** Dy tick-at (vula, nënshkrimi) — përdoren te dritarja e printimit dhe te email-i. */
export function PrintBrandingFields({ value, onChange }: { value: PrintBranding; onChange: (b: PrintBranding) => void }) {
  const row = "flex items-center gap-2.5 text-sm text-slate-700 dark:text-slate-200 cursor-pointer";
  return (
    <div className="space-y-2">
      <label className={row}>
        <input type="checkbox" className="w-4 h-4 accent-violet-700" checked={value.stamp} onChange={e => onChange({ ...value, stamp: e.target.checked })} />
        Me vulë
      </label>
      <label className={row}>
        <input type="checkbox" className="w-4 h-4 accent-violet-700" checked={value.sign} onChange={e => onChange({ ...value, sign: e.target.checked })} />
        Me nënshkrim
      </label>
    </div>
  );
}

function PrintBrandingDialog({ onDone }: { onDone: (b: PrintBranding | null) => void }) {
  const [b, setB] = useState<PrintBranding>(loadPrintBranding);
  return (
    <div className="fixed inset-0 z-[100] bg-black/50 flex items-center justify-center p-4" onMouseDown={e => { if (e.target === e.currentTarget) onDone(null); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="pb-title" className="w-full max-w-xs rounded-2xl bg-white dark:bg-slate-800 shadow-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 id="pb-title" className="font-semibold text-slate-900 dark:text-white flex items-center gap-2">
            <Printer className="w-4 h-4 text-primary-700" /> Printo dokumentin
          </h3>
          <button type="button" onClick={() => onDone(null)} aria-label="Mbyll" className="p-1 text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
        </div>
        <PrintBrandingFields value={b} onChange={setB} />
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={() => onDone(null)} className="btn-secondary flex-1 justify-center">Anulo</button>
          <button type="button" autoFocus onClick={() => { savePrintBranding(b); onDone(b); }} className="btn-primary flex-1 justify-center">
            <Printer className="w-4 h-4" /> Printo
          </button>
        </div>
      </div>
    </div>
  );
}

/** Pyet para printimit: me vulë / me nënshkrim. `null` = u anulua. */
export function askPrintBranding(): Promise<PrintBranding | null> {
  return new Promise(resolve => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    const done = (b: PrintBranding | null) => {
      root.unmount();
      host.remove();
      resolve(b);
    };
    root.render(<PrintBrandingDialog onDone={done} />);
  });
}
