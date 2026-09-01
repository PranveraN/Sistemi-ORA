"use client";

import { useState, useEffect } from "react";
import {
  X, Plus, Trash2, Printer, BookOpen, ShoppingBag,
  MapPin, Package, Monitor, History, ArrowLeft, Save, Pencil, Loader2,
} from "lucide-react";
import { formatCurrency } from "@/lib/utils";

interface Child { id: string; name: string; klasa: string; sibDiscPct: number; manualDisc: number; }

interface ServiceSnap {
  shkollimi:  { active: boolean; basePrice: number };
  ushqimi:    { active: boolean; pricePerDay: number; days: number };
  transporti: { active: boolean; locationIdx: number; pricePerMonth: number; months: number };
  uniforma:   { active: boolean; pricePerChild: number };
  platforma:  { active: boolean; pricePerChild: number };
}

interface OfferRecord {
  id: string;
  date: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  children: Child[];
  services: ServiceSnap;
  grandTotal: number;
}

const DISC = [0, 10, 15, 20];
interface Location { label: string; price: number }
const DEFAULT_LOCATIONS: Location[] = [
  { label: "Prishtinë",    price: 65 },
  { label: "Fushë Kosovë", price: 55 },
  { label: "Lipjan",       price: 55 },
  { label: "Graçanicë",    price: 55 },
  { label: "Drenas",       price: 65 },
  { label: "Podujevo",     price: 70 },
  { label: "Tjetër",       price: 0  },
];

const LS_KEY = "akademia_oferta_history";
function uid() { return Math.random().toString(36).slice(2, 9); }
function childOrdinal(i: number) {
  const ord = ["parë", "dytë", "tretë", "katërt", "pestë"];
  return i < ord.length ? `i ${ord[i]}` : `i ${i + 1}-të`;
}
function sibPct(idx: number) { return DISC[Math.min(idx, DISC.length - 1)]; }
function loadHistory(): OfferRecord[] {
  try { return JSON.parse(localStorage.getItem(LS_KEY) || "[]"); } catch { return []; }
}
function saveHistory(h: OfferRecord[]) {
  localStorage.setItem(LS_KEY, JSON.stringify(h));
}

export default function OfertaModal({
  onClose,
  initialView = "form",
}: {
  onClose: () => void;
  initialView?: "form" | "history";
}) {
  const [view, setView] = useState<"form" | "history">(initialView);
  const [history, setHistory] = useState<OfferRecord[]>([]);

  useEffect(() => { setHistory(loadHistory()); }, []);

  // Çmimet e vendbanimeve për Transportin — parazgjedhje të ngurta si fallback,
  // por të ruajtura/rimarra nga Cilësimet që stafi t'i mund t'i përditësojë pa prekur kodin.
  const [locations, setLocations] = useState<Location[]>(DEFAULT_LOCATIONS);
  const [editingLocations, setEditingLocations] = useState(false);
  const [locDraft, setLocDraft] = useState<Location[]>(DEFAULT_LOCATIONS);
  const [savingLocations, setSavingLocations] = useState(false);

  useEffect(() => {
    fetch("/api/settings").then(r => r.json()).then(s => {
      if (!s.transportLocations) return;
      try {
        const parsed = JSON.parse(s.transportLocations);
        if (Array.isArray(parsed) && parsed.length) setLocations(parsed);
      } catch { /* mbetet parazgjedhja */ }
    });
  }, []);

  function openLocationEditor() {
    setLocDraft(locations.map(l => ({ ...l })));
    setEditingLocations(true);
  }
  function updateLocDraft(i: number, field: "label" | "price", value: string) {
    setLocDraft(d => d.map((l, idx) => idx === i ? { ...l, [field]: field === "price" ? (parseFloat(value) || 0) : value } : l));
  }
  function addLocDraftRow() { setLocDraft(d => [...d, { label: "", price: 0 }]); }
  function removeLocDraftRow(i: number) { setLocDraft(d => d.filter((_, idx) => idx !== i)); }

  async function saveLocations() {
    const cleaned = locDraft.filter(l => l.label.trim()).map(l => ({ label: l.label.trim(), price: l.price }));
    if (!cleaned.length) return;
    setSavingLocations(true);
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ transportLocations: JSON.stringify(cleaned) }),
    });
    setLocations(cleaned);
    setTransporti(v => ({ ...v, locationIdx: Math.min(v.locationIdx, cleaned.length - 1) }));
    setSavingLocations(false);
    setEditingLocations(false);
  }

  const [parentName,  setParentName]  = useState("");
  const [parentPhone, setParentPhone] = useState("");
  const [parentEmail, setParentEmail] = useState("");
  const [children, setChildren] = useState<Child[]>([{ id: uid(), name: "", klasa: "", sibDiscPct: 0, manualDisc: 0 }]);

  const [shkollimi,  setShkollimi]  = useState({ active: true,  basePrice: 2000 });
  const [ushqimi,    setUshqimi]    = useState({ active: false, pricePerDay: 4,  days: 40 });
  const [transporti, setTransporti] = useState({ active: false, locationIdx: 0,  pricePerMonth: 65, months: 10 });
  const [uniforma,   setUniforma]   = useState({ active: false, pricePerChild: 70 });
  const [platforma,  setPlatforma]  = useState({ active: false, pricePerChild: 20 });

  const addChild = () => setChildren(c => [...c, { id: uid(), name: "", klasa: "", sibDiscPct: sibPct(c.length), manualDisc: 0 }]);
  const removeChild = (id: string) => setChildren(c => c.filter(x => x.id !== id));
  const updateChild = (id: string, f: keyof Child, v: string | number) =>
    setChildren(c => c.map(x => x.id === id ? { ...x, [f]: v } : x));

  /* ── calculations ── */
  const shkolSibDisc = (_idx: number, ch: Child) =>
    shkollimi.active ? shkollimi.basePrice * ch.sibDiscPct / 100 : 0;
  const shkol = (_idx: number, ch: Child) => {
    const afterSib = shkollimi.active ? shkollimi.basePrice * (1 - ch.sibDiscPct / 100) : 0;
    return Math.max(0, afterSib - (ch.manualDisc || 0));
  };
  const ushq  = () => ushqimi.active    ? ushqimi.pricePerDay * ushqimi.days           : 0;
  const trans = () => transporti.active ? transporti.pricePerMonth * transporti.months : 0;
  const uni   = () => uniforma.active   ? uniforma.pricePerChild                       : 0;
  const plat  = () => platforma.active  ? platforma.pricePerChild                      : 0;
  const childTotal = (_idx: number, ch: Child) => shkol(0, ch) + ushq() + trans() + uni() + plat();
  const grand = children.reduce((s, ch, i) => s + childTotal(i, ch), 0);
  const totalDiscount = children.reduce((s, ch, i) => s + shkolSibDisc(i, ch) + (ch.manualDisc || 0), 0);

  /* ── save ── */
  function saveOffer(): OfferRecord {
    const rec: OfferRecord = {
      id: uid(),
      date: new Date().toISOString(),
      parentName, parentPhone, parentEmail, children,
      services: {
        shkollimi:  { active: shkollimi.active,  basePrice: shkollimi.basePrice },
        ushqimi:    { active: ushqimi.active,    pricePerDay: ushqimi.pricePerDay, days: ushqimi.days },
        transporti: { active: transporti.active, locationIdx: transporti.locationIdx, pricePerMonth: transporti.pricePerMonth, months: transporti.months },
        uniforma:   { active: uniforma.active,   pricePerChild: uniforma.pricePerChild },
        platforma:  { active: platforma.active,  pricePerChild: platforma.pricePerChild },
      },
      grandTotal: grand,
    };
    const updated = [rec, ...loadHistory()];
    saveHistory(updated);
    setHistory(updated);
    return rec;
  }

  function deleteRecord(id: string) {
    const updated = history.filter(r => r.id !== id);
    saveHistory(updated);
    setHistory(updated);
  }

  /* ── print ── */
  function buildHTML(pName: string, pPhone: string, pEmail: string, kids: Child[], svc: ServiceSnap) {
    const S = svc;
    const _sibDisc = (ch: Child) => S.shkollimi.active ? S.shkollimi.basePrice * ch.sibDiscPct / 100 : 0;
    const _shkol   = (_i: number, ch: Child) => {
      const afterSib = S.shkollimi.active ? S.shkollimi.basePrice * (1 - ch.sibDiscPct / 100) : 0;
      return Math.max(0, afterSib - (ch.manualDisc || 0));
    };
    const _ushq  = () => S.ushqimi.active    ? S.ushqimi.pricePerDay * S.ushqimi.days             : 0;
    const _trans = () => S.transporti.active ? S.transporti.pricePerMonth * S.transporti.months   : 0;
    const _uni   = () => S.uniforma.active   ? S.uniforma.pricePerChild                           : 0;
    const _plat  = () => S.platforma.active  ? S.platforma.pricePerChild                          : 0;
    const _tot   = (i: number, ch: Child) => _shkol(i, ch) + _ushq() + _trans() + _uni() + _plat();
    const _grand  = kids.reduce((s, ch, i) => s + _tot(i, ch), 0);
    const _totDsc = kids.reduce((s, ch) => s + _sibDisc(ch) + (ch.manualDisc || 0), 0);
    const today = new Date().toLocaleDateString("sq-AL", { dateStyle: "long" });
    const loc = locations[S.transporti.locationIdx]?.label ?? "";

    const childBlocks = kids.map((ch, i) => {
      const sp = ch.sibDiscPct;
      const sd = _sibDisc(ch);
      const md = ch.manualDisc || 0;
      const totalDiscAmt = sd + md;

      let discCell = "&mdash;";
      if (totalDiscAmt > 0) {
        const parts = [];
        if (sd > 0) parts.push(`&minus;${formatCurrency(sd)} (f&euml;mija ${childOrdinal(i)}, ${sp}%)`);
        if (md > 0) parts.push(`&minus;${formatCurrency(md)} (manuale)`);
        discCell = parts.join("<br/>");
      }

      const rows = [
        S.shkollimi.active && `
          <tr>
            <td>Shkollimi</td>
            <td class="r">${formatCurrency(S.shkollimi.basePrice)}</td>
            <td class="r red">${discCell}</td>
            <td class="r b">${formatCurrency(_shkol(i, ch))}</td>
          </tr>`,
        S.ushqimi.active && `
          <tr>
            <td>Ushqimi <small>${S.ushqimi.pricePerDay}&euro;/dit&euml; &times; ${S.ushqimi.days} dit&euml;</small></td>
            <td class="r">${formatCurrency(_ushq())}</td><td class="r">&mdash;</td>
            <td class="r b">${formatCurrency(_ushq())}</td>
          </tr>`,
        S.transporti.active && `
          <tr>
            <td>Transporti <small>${loc} &mdash; ${S.transporti.pricePerMonth}&euro;/muaj &times; ${S.transporti.months} muaj</small></td>
            <td class="r">${formatCurrency(_trans())}</td><td class="r">&mdash;</td>
            <td class="r b">${formatCurrency(_trans())}</td>
          </tr>`,
        S.uniforma.active && `
          <tr>
            <td>Uniforma</td>
            <td class="r">${formatCurrency(_uni())}</td><td class="r">&mdash;</td>
            <td class="r b">${formatCurrency(_uni())}</td>
          </tr>`,
        S.platforma.active && `
          <tr>
            <td>Platforma Digjitale</td>
            <td class="r">${formatCurrency(_plat())}</td><td class="r">&mdash;</td>
            <td class="r b">${formatCurrency(_plat())}</td>
          </tr>`,
      ].filter(Boolean).join("");

      return `
        <div class="child-block">
          <div class="child-hdr">
            <span class="idx">${i + 1}</span>
            <strong>${ch.name || `F&euml;mija ${i + 1}`}</strong>
            ${ch.klasa ? `<span class="badge blue">${ch.klasa}</span>` : ""}
            ${sp > 0 ? `<span class="badge green">F&euml;mija ${childOrdinal(i)} &mdash; &minus;${sp}%</span>` : ""}
            ${md > 0 ? `<span class="badge orange">&minus;${formatCurrency(md)} manuale</span>` : ""}
          </div>
          <table>
            <thead>
              <tr><th>Sh&euml;rbimi</th><th class="r">&#199;mimi baz&euml;</th><th class="r">Zbritja</th><th class="r">Totali</th></tr>
            </thead>
            <tbody>${rows}</tbody>
            <tfoot>
              <tr class="foot-row">
                <td colspan="3"><strong>TOTALI &mdash; ${ch.name || `F&euml;mija ${i + 1}`}</strong></td>
                <td class="r b">${formatCurrency(_tot(i, ch))}</td>
              </tr>
            </tfoot>
          </table>
        </div>`;
    }).join("");

    return `<!DOCTYPE html><html lang="sq"><head><meta charset="UTF-8"/>
<title>Ofert&euml; &mdash; Akademia Ora</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Segoe UI',Arial,sans-serif;font-size:13px;color:#0f172a;padding:36px;max-width:820px;margin:0 auto}
.hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:28px;padding-bottom:16px;border-bottom:2px solid #e2e8f0}
.hdr-left h1{font-size:22px;font-weight:800;color:#1d4ed8;margin-bottom:2px}
.hdr-left p{color:#64748b;font-size:11px}
.hdr-right{text-align:right;font-size:11px;color:#64748b}
.hdr-right strong{display:block;font-size:13px;color:#0f172a}
.sec{margin-bottom:22px}
.sec-lbl{font-size:9px;font-weight:700;text-transform:uppercase;letter-spacing:.12em;color:#94a3b8;border-bottom:1px solid #f1f5f9;padding-bottom:5px;margin-bottom:12px}
.parent-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
.fld .l{font-size:9px;color:#94a3b8;margin-bottom:3px;text-transform:uppercase;letter-spacing:.05em}
.fld .v{font-weight:600;font-size:13px}
.child-block{margin-bottom:16px;border:1px solid #e2e8f0;border-radius:10px;overflow:hidden}
.child-hdr{background:#f8fafc;padding:10px 14px;font-size:13px;display:flex;align-items:center;gap:8px;border-bottom:1px solid #e2e8f0}
.idx{width:22px;height:22px;background:#1d4ed8;color:#fff;border-radius:50%;font-size:11px;font-weight:700;display:flex;align-items:center;justify-content:center;flex-shrink:0}
.badge{font-size:10px;padding:2px 8px;border-radius:9999px;font-weight:600}
.badge.blue{background:#dbeafe;color:#1d4ed8}
.badge.green{background:#dcfce7;color:#16a34a}
.badge.orange{background:#ffedd5;color:#c2410c}
table{width:100%;border-collapse:collapse}
th{background:#1e40af;color:#fff;text-align:left;padding:8px 12px;font-size:10px;font-weight:600;letter-spacing:.05em}
th.r{text-align:right}
td{padding:8px 12px;border-bottom:1px solid #f8fafc;font-size:12px;color:#334155}
td.r{text-align:right}
td.red{color:#dc2626;font-weight:500;line-height:1.6}
td.b{font-weight:700;color:#0f172a}
small{color:#94a3b8;font-size:10px;margin-left:4px}
.foot-row td{background:#eff6ff;font-weight:700;border-top:2px solid #bfdbfe;padding:9px 12px;color:#1e40af}
.grand-box{background:#1e40af;color:#fff;padding:18px 22px;border-radius:10px;display:flex;justify-content:space-between;align-items:center;margin-top:10px}
.grand-box .lbl{font-size:12px;opacity:.8}
.grand-box .amt{font-size:26px;font-weight:800}
.savings{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:10px 16px;display:flex;justify-content:space-between;margin-top:10px;font-size:12px;color:#15803d}
.sigs{display:flex;justify-content:space-between;margin-top:48px;padding-top:8px}
.sig{text-align:center}
.sig .line{border-bottom:1px solid #94a3b8;width:180px;margin:0 auto;margin-top:48px}
.sig .nm{font-size:10px;color:#64748b;margin-top:6px}
.ftr{margin-top:24px;border-top:1px solid #e2e8f0;padding-top:10px;display:flex;justify-content:space-between;font-size:10px;color:#94a3b8}
@media print{body{padding:20px}}
</style></head><body>
<div class="hdr">
  <div class="hdr-left">
    <h1>Akademia Ora</h1>
    <p>Ofert&euml; &amp; Parafatur&euml;</p>
  </div>
  <div class="hdr-right">
    <strong>${today}</strong>
    Sistemi Shkollor
  </div>
</div>
<div class="sec">
  <div class="sec-lbl">T&euml; dh&euml;nat e prindit</div>
  <div class="parent-grid">
    <div class="fld"><div class="l">Emri dhe Mbiemri</div><div class="v">${pName || "&mdash;"}</div></div>
    <div class="fld"><div class="l">Numri i Telefonit</div><div class="v">${pPhone || "&mdash;"}</div></div>
    <div class="fld"><div class="l">Email</div><div class="v">${pEmail || "&mdash;"}</div></div>
  </div>
</div>
<div class="sec">
  <div class="sec-lbl">Detajet e ofert&euml;s &mdash; ${kids.length} f&euml;mij&euml;</div>
  ${childBlocks}
</div>
<div class="grand-box">
  <span class="lbl">TOTALI I PLOT&Euml; &mdash; ${kids.length} f&euml;mij&euml;</span>
  <span class="amt">${formatCurrency(_grand)}</span>
</div>
${_totDsc > 0 ? `<div class="savings"><span>Kursim total nga t&euml; gjitha zbritjet</span><strong>&minus; ${formatCurrency(_totDsc)}</strong></div>` : ""}
<div class="sigs">
  <div class="sig"><div class="line"></div><p class="nm">Akademia Ora</p></div>
  <div class="sig"><div class="line"></div><p class="nm">Prindi / Klienti</p></div>
</div>
<div class="ftr"><span>Akademia Ora &mdash; Sistemi Shkollor</span><span>+383 46 50 50 56</span></div>
</body></html>`;
  }

  function printOffer(
    pName = parentName, pPhone = parentPhone, pEmail = parentEmail,
    kids = children,
    svc: ServiceSnap = { shkollimi, ushqimi, transporti, uniforma, platforma }
  ) {
    const win = window.open("", "_blank", "width=870,height=980");
    if (!win) return;
    win.document.write(buildHTML(pName, pPhone, pEmail, kids, svc));
    win.document.close();
    setTimeout(() => { win.focus(); win.print(); }, 400);
  }

  function handleSaveAndPrint() { saveOffer(); printOffer(); }

  /* ══════ HISTORY VIEW ══════ */
  if (view === "history") {
    return (
      <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
        <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col" onClick={e => e.stopPropagation()}>
          <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
            <button onClick={() => setView("form")} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <ArrowLeft className="w-4 h-4 text-slate-500" />
            </button>
            <div className="flex-1">
              <h2 className="text-base font-semibold text-slate-900 dark:text-white">Historiku i Ofertave</h2>
              {history.length > 0 && <p className="text-xs text-slate-400">{history.length} oferta të ruajtura</p>}
            </div>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="overflow-y-auto flex-1">
            {history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
                  <History className="w-6 h-6 text-slate-300 dark:text-slate-600" />
                </div>
                <p className="text-sm font-medium text-slate-500 dark:text-slate-400">Nuk ka oferta të ruajtura</p>
                <p className="text-xs text-slate-400 mt-1">Krijoni një ofertë dhe ruajeni për ta gjetur këtu</p>
                <button onClick={() => setView("form")} className="btn-primary mt-4 text-xs">
                  <Plus className="w-3.5 h-3.5" /> Krijo Ofertë të Re
                </button>
              </div>
            ) : (
              <table className="w-full">
                <thead className="bg-slate-50 dark:bg-slate-800/50 sticky top-0">
                  <tr>
                    <th className="table-header">Prindi</th>
                    <th className="table-header">Fëmijët</th>
                    <th className="table-header">Data</th>
                    <th className="table-header text-right">Totali</th>
                    <th className="table-header"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                  {history.map(r => (
                    <tr key={r.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30 transition-colors">
                      <td className="table-cell">
                        <p className="font-medium text-slate-900 dark:text-white text-sm">{r.parentName || "—"}</p>
                        {r.parentPhone && <p className="text-xs text-slate-400">{r.parentPhone}</p>}
                      </td>
                      <td className="table-cell">
                        <div className="flex flex-wrap gap-1">
                          {r.children.map((ch, i) => (
                            <span key={ch.id} className="badge bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300">
                              {ch.name || `F${i + 1}`}{ch.klasa ? ` · ${ch.klasa}` : ""}
                            </span>
                          ))}
                        </div>
                      </td>
                      <td className="table-cell text-slate-400 text-xs whitespace-nowrap">
                        {new Date(r.date).toLocaleDateString("sq-AL", { day: "2-digit", month: "short", year: "numeric" })}
                      </td>
                      <td className="table-cell text-right font-bold text-slate-900 dark:text-white whitespace-nowrap">
                        {formatCurrency(r.grandTotal)}
                      </td>
                      <td className="table-cell">
                        <div className="flex items-center gap-1 justify-end">
                          <button onClick={() => printOffer(r.parentName, r.parentPhone, r.parentEmail, r.children, r.services)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-500 transition-colors" title="Printo">
                            <Printer className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => deleteRecord(r.id)}
                            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-300 hover:text-red-400 transition-colors" title="Fshi">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    );
  }

  /* ══════ FORM VIEW ══════ */
  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[95vh] flex flex-col" onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 dark:border-slate-700 flex-shrink-0">
          <div>
            <p className="text-[10px] font-semibold tracking-widest text-slate-400 uppercase">Akademia Ora</p>
            <h2 className="text-lg font-bold text-slate-900 dark:text-white mt-0.5">Ofertë &amp; Parafaturë</h2>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setView("history")}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-300 transition-colors text-xs font-medium">
              <History className="w-3.5 h-3.5" />
              Historiku
              {history.length > 0 && (
                <span className="bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 text-[10px] font-bold px-1.5 py-0.5 rounded-full leading-none">
                  {history.length}
                </span>
              )}
            </button>
            <button onClick={onClose} className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto flex-1 p-6 space-y-6">

          {/* 1 · Prindi */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Të dhënat e prindit</p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="form-label">Emri dhe Mbiemri <span className="text-red-500">*</span></label>
                <input className="form-input" placeholder="p.sh. Arben Krasniqi" value={parentName} onChange={e => setParentName(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Numri i Telefonit <span className="text-red-500">*</span></label>
                <input className="form-input" placeholder="+383 4X XXX XXX" value={parentPhone} onChange={e => setParentPhone(e.target.value)} />
              </div>
              <div>
                <label className="form-label">Email <span className="text-slate-300 dark:text-slate-600">(opsional)</span></label>
                <input className="form-input" placeholder="email@domain.com" value={parentEmail} onChange={e => setParentEmail(e.target.value)} />
              </div>
            </div>
          </section>

          {/* 2 · Fëmijët */}
          <section>
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">Fëmijët</p>
              <button onClick={addChild} className="flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 px-2.5 py-1 rounded-lg hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Shto Fëmijë
              </button>
            </div>
            <div className="space-y-2">
              {children.map((ch, i) => {
                const dp = ch.sibDiscPct;
                return (
                  <div key={ch.id} className="flex items-center gap-2">
                    <span className="w-5 text-xs font-bold text-slate-400 text-right flex-shrink-0">{i + 1}</span>
                    <input className="form-input flex-1" placeholder="Emri i fëmijës" value={ch.name} onChange={e => updateChild(ch.id, "name", e.target.value)} />
                    <input className="form-input w-24" placeholder="Klasa" value={ch.klasa} onChange={e => updateChild(ch.id, "klasa", e.target.value)} />
                    {dp > 0
                      ? <span className="badge bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 border border-green-200 dark:border-green-800 whitespace-nowrap flex-shrink-0">−{dp}%</span>
                      : <span className="text-[10px] text-slate-300 dark:text-slate-600 w-10 text-center flex-shrink-0">F1</span>
                    }
                    {children.length > 1 && (
                      <button onClick={() => removeChild(ch.id)} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-red-50 dark:hover:bg-red-900/30 text-slate-300 hover:text-red-400 transition-colors flex-shrink-0">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
              {children.length > 1 && (
                <p className="text-[11px] text-slate-400 pl-7 pt-0.5">
                  Zbritja sipas radhës: F2 −10% · F3 −15% · F4+ −20% (vetëm shkollimi)
                </p>
              )}
            </div>
          </section>

          {/* 3 · Shërbimet */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Shërbimet</p>
            <div className="space-y-2">

              {/* Shkollimi */}
              <div className={`border rounded-xl transition-colors ${shkollimi.active ? "border-primary-200 dark:border-primary-800 bg-primary-50/30 dark:bg-primary-900/10" : "border-slate-200 dark:border-slate-700"}`}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${shkollimi.active ? "bg-primary-100 dark:bg-primary-900/40" : "bg-slate-100 dark:bg-slate-800"}`}>
                      <BookOpen className={`w-3.5 h-3.5 ${shkollimi.active ? "text-primary-600 dark:text-primary-400" : "text-slate-400"}`} />
                    </div>
                    <span className="font-medium text-sm text-slate-800 dark:text-slate-100">Shkollimi</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-xs text-slate-400">Aktiv</span>
                    <input type="checkbox" checked={shkollimi.active} onChange={e => setShkollimi(v => ({ ...v, active: e.target.checked }))} className="rounded accent-primary-600" />
                  </label>
                </div>

                {shkollimi.active && (
                  <div className="px-4 pb-4 pt-1 space-y-3 border-t border-primary-100 dark:border-primary-900/30">
                    <div>
                      <label className="form-label text-xs">Çmimi bazë / vit (€)</label>
                      <input type="number" className="form-input w-32" value={shkollimi.basePrice}
                        onChange={e => setShkollimi(v => ({ ...v, basePrice: parseFloat(e.target.value) || 0 }))} />
                    </div>

                    {/* Per-child rows */}
                    <div className="space-y-1">
                      {/* Column headers */}
                      <div className="grid grid-cols-[1fr_80px_100px_80px_70px] gap-2 px-2 mb-1">
                        <span className="text-[10px] text-slate-400">Fëmija</span>
                        <span className="text-[10px] text-slate-400 text-right">Çmimi</span>
                        <span className="text-[10px] text-slate-400 text-right">Zb. sipas radhës</span>
                        <span className="text-[10px] text-slate-400 text-center">Zb. manuale</span>
                        <span className="text-[10px] text-slate-400 text-right">Totali</span>
                      </div>
                      {children.map((ch, i) => {
                        const sd = shkolSibDisc(i, ch);
                        const md = ch.manualDisc || 0;
                        return (
                          <div key={ch.id} className="grid grid-cols-[1fr_80px_100px_80px_70px] items-center gap-2 px-2 py-1.5 rounded-lg bg-white dark:bg-slate-800/60">
                            <span className="text-xs text-slate-700 dark:text-slate-200 truncate font-medium">
                              {ch.name || `Fëmija ${i + 1}`}
                            </span>
                            <span className="text-xs text-slate-400 text-right">{formatCurrency(shkollimi.basePrice)}</span>
                            {/* Editable sibling discount % */}
                            <div className="flex items-center gap-0.5 justify-end">
                              {sd > 0 && <span className="text-red-400 text-[10px]">−{formatCurrency(sd)}</span>}
                              <div className="flex items-center border border-slate-200 dark:border-slate-600 rounded-md overflow-hidden ml-1">
                                <input
                                  type="number"
                                  min={0}
                                  max={100}
                                  className="w-10 px-1 py-0.5 text-xs bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500 text-right"
                                  value={ch.sibDiscPct}
                                  onChange={e => updateChild(ch.id, "sibDiscPct", parseFloat(e.target.value) || 0)}
                                />
                                <span className="text-[10px] text-slate-400 pr-1">%</span>
                              </div>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <span className="text-slate-300 text-xs">−</span>
                              <input
                                type="number"
                                min={0}
                                className="w-full px-1.5 py-0.5 text-xs border border-slate-200 dark:border-slate-600 rounded-md bg-white dark:bg-slate-700 text-slate-700 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-primary-500 placeholder-slate-300"
                                placeholder="0 €"
                                value={md || ""}
                                onChange={e => updateChild(ch.id, "manualDisc", parseFloat(e.target.value) || 0)}
                              />
                            </div>
                            <span className="text-sm font-bold text-slate-800 dark:text-slate-100 text-right">
                              {formatCurrency(shkol(i, ch))}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Ushqimi */}
              <div className={`border rounded-xl transition-colors ${ushqimi.active ? "border-orange-200 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-900/10" : "border-slate-200 dark:border-slate-700"}`}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${ushqimi.active ? "bg-orange-100 dark:bg-orange-900/40" : "bg-slate-100 dark:bg-slate-800"}`}>
                      <ShoppingBag className={`w-3.5 h-3.5 ${ushqimi.active ? "text-orange-600 dark:text-orange-400" : "text-slate-400"}`} />
                    </div>
                    <span className="font-medium text-sm text-slate-800 dark:text-slate-100">Ushqimi</span>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-xs text-slate-400">Aktiv</span>
                    <input type="checkbox" checked={ushqimi.active} onChange={e => setUshqimi(v => ({ ...v, active: e.target.checked }))} className="rounded accent-orange-500" />
                  </label>
                </div>
                {ushqimi.active && (
                  <div className="px-4 pb-4 pt-1 border-t border-orange-100 dark:border-orange-900/30 space-y-2">
                    <div className="flex items-end gap-3 flex-wrap">
                      <div>
                        <label className="form-label text-xs">Çmimi / ditë (€)</label>
                        <input type="number" className="form-input w-24" value={ushqimi.pricePerDay} onChange={e => setUshqimi(v => ({ ...v, pricePerDay: parseFloat(e.target.value) || 0 }))} />
                      </div>
                      <div>
                        <label className="form-label text-xs">Ditë</label>
                        <input type="number" className="form-input w-24" value={ushqimi.days} onChange={e => setUshqimi(v => ({ ...v, days: parseInt(e.target.value) || 0 }))} />
                      </div>
                    </div>
                    <p className="text-xs text-slate-400">
                      {ushqimi.pricePerDay}€ × {ushqimi.days} ditë = <strong className="text-orange-600 dark:text-orange-400">{formatCurrency(ushq())}</strong> / fëmijë
                    </p>
                  </div>
                )}
              </div>

              {/* Transporti */}
              <div className={`border rounded-xl transition-colors ${transporti.active ? "border-purple-200 dark:border-purple-800 bg-purple-50/30 dark:bg-purple-900/10" : "border-slate-200 dark:border-slate-700"}`}>
                <div className="flex items-center justify-between px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${transporti.active ? "bg-purple-100 dark:bg-purple-900/40" : "bg-slate-100 dark:bg-slate-800"}`}>
                      <MapPin className={`w-3.5 h-3.5 ${transporti.active ? "text-purple-600 dark:text-purple-400" : "text-slate-400"}`} />
                    </div>
                    <span className="font-medium text-sm text-slate-800 dark:text-slate-100">Transporti</span>
                    <button type="button" onClick={openLocationEditor}
                      className="p-1 rounded hover:bg-purple-100 dark:hover:bg-purple-900/30 text-slate-400 hover:text-purple-600 dark:hover:text-purple-400"
                      title="Edito çmimet e vendbanimeve">
                      <Pencil className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <span className="text-xs text-slate-400">Aktiv</span>
                    <input type="checkbox" checked={transporti.active} onChange={e => setTransporti(v => ({ ...v, active: e.target.checked }))} className="rounded accent-purple-600" />
                  </label>
                </div>
                {transporti.active && (
                  <div className="px-4 pb-4 pt-1 border-t border-purple-100 dark:border-purple-900/30 space-y-2">
                    <div className="flex items-end gap-3 flex-wrap">
                      <div>
                        <label className="form-label text-xs">Vendbanimi</label>
                        <select className="form-input" value={transporti.locationIdx}
                          onChange={e => {
                            const idx = parseInt(e.target.value);
                            setTransporti(v => ({ ...v, locationIdx: idx, pricePerMonth: locations[idx].price }));
                          }}>
                          {locations.map((l, i) => <option key={l.label} value={i}>{l.label}{l.price > 0 ? ` — ${l.price}€` : ""}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="form-label text-xs">Çmimi / muaj (€)</label>
                        <input type="number" className="form-input w-24" value={transporti.pricePerMonth} onChange={e => setTransporti(v => ({ ...v, pricePerMonth: parseFloat(e.target.value) || 0 }))} />
                      </div>
                      <div>
                        <label className="form-label text-xs">Muaj</label>
                        <input type="number" className="form-input w-20" value={transporti.months} onChange={e => setTransporti(v => ({ ...v, months: parseInt(e.target.value) || 0 }))} />
                      </div>
                    </div>
                    <p className="text-xs text-slate-400">
                      {transporti.pricePerMonth}€ × {transporti.months} muaj = <strong className="text-purple-600 dark:text-purple-400">{formatCurrency(trans())}</strong> / fëmijë
                    </p>
                  </div>
                )}
              </div>

              {/* Uniforma + Platforma */}
              <div className="grid grid-cols-2 gap-2">
                <div className={`border rounded-xl transition-colors ${uniforma.active ? "border-green-200 dark:border-green-800 bg-green-50/30 dark:bg-green-900/10" : "border-slate-200 dark:border-slate-700"}`}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${uniforma.active ? "bg-green-100 dark:bg-green-900/40" : "bg-slate-100 dark:bg-slate-800"}`}>
                        <Package className={`w-3.5 h-3.5 ${uniforma.active ? "text-green-600 dark:text-green-400" : "text-slate-400"}`} />
                      </div>
                      <span className="font-medium text-sm text-slate-800 dark:text-slate-100">Uniforma</span>
                    </div>
                    <input type="checkbox" checked={uniforma.active} onChange={e => setUniforma(v => ({ ...v, active: e.target.checked }))} className="rounded accent-green-600" />
                  </div>
                  {uniforma.active && (
                    <div className="px-4 pb-3 pt-1 border-t border-green-100 dark:border-green-900/30">
                      <label className="form-label text-xs">Çmimi / fëmijë (€)</label>
                      <input type="number" className="form-input" value={uniforma.pricePerChild} onChange={e => setUniforma(v => ({ ...v, pricePerChild: parseFloat(e.target.value) || 0 }))} />
                    </div>
                  )}
                </div>
                <div className={`border rounded-xl transition-colors ${platforma.active ? "border-sky-200 dark:border-sky-800 bg-sky-50/30 dark:bg-sky-900/10" : "border-slate-200 dark:border-slate-700"}`}>
                  <div className="flex items-center justify-between px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${platforma.active ? "bg-sky-100 dark:bg-sky-900/40" : "bg-slate-100 dark:bg-slate-800"}`}>
                        <Monitor className={`w-3.5 h-3.5 ${platforma.active ? "text-sky-600 dark:text-sky-400" : "text-slate-400"}`} />
                      </div>
                      <span className="font-medium text-sm text-slate-800 dark:text-slate-100">Platforma</span>
                    </div>
                    <input type="checkbox" checked={platforma.active} onChange={e => setPlatforma(v => ({ ...v, active: e.target.checked }))} className="rounded accent-sky-600" />
                  </div>
                  {platforma.active && (
                    <div className="px-4 pb-3 pt-1 border-t border-sky-100 dark:border-sky-900/30">
                      <label className="form-label text-xs">Çmimi / fëmijë (€)</label>
                      <input type="number" className="form-input" value={platforma.pricePerChild} onChange={e => setPlatforma(v => ({ ...v, pricePerChild: parseFloat(e.target.value) || 0 }))} />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </section>

          {/* 4 · Totali */}
          <section>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-3">Totali i detajuar</p>
            <div className="space-y-2">
              {children.map((ch, i) => {
                const dp = ch.sibDiscPct;
                const sd = shkolSibDisc(i, ch);
                const md = ch.manualDisc || 0;
                const totalSchoolDisc = sd + md;

                const rows = [
                  shkollimi.active && {
                    label: "Shkollimi",
                    base: shkollimi.basePrice,
                    disc: totalSchoolDisc,
                    discNote: [
                      sd > 0 ? `fëmija ${childOrdinal(i)} −${dp}%` : "",
                      md > 0 ? `manuale −${formatCurrency(md)}` : "",
                    ].filter(Boolean).join(" · "),
                    final: shkol(i, ch),
                  },
                  ushqimi.active   && { label: `Ushqimi (${ushqimi.pricePerDay}€ × ${ushqimi.days} ditë)`, base: ushq(), disc: 0, discNote: "", final: ushq() },
                  transporti.active && { label: `Transporti (${transporti.pricePerMonth}€ × ${transporti.months} muaj)`, base: trans(), disc: 0, discNote: "", final: trans() },
                  uniforma.active  && { label: "Uniforma", base: uni(), disc: 0, discNote: "", final: uni() },
                  platforma.active && { label: "Platforma Digjitale", base: plat(), disc: 0, discNote: "", final: plat() },
                ].filter(Boolean) as { label: string; base: number; disc: number; discNote: string; final: number }[];

                if (rows.length === 0) return null;

                return (
                  <div key={ch.id} className="border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-2 px-4 py-2.5 bg-slate-50 dark:bg-slate-800/60">
                      <span className="w-5 h-5 rounded-full bg-primary-600 text-white text-[10px] font-bold flex items-center justify-center flex-shrink-0">{i + 1}</span>
                      <span className="font-semibold text-sm text-slate-800 dark:text-slate-100">{ch.name || `Fëmija ${i + 1}`}</span>
                      {ch.klasa && <span className="badge bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">{ch.klasa}</span>}
                      {dp > 0 && <span className="badge bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300">Fëmija {childOrdinal(i)} −{dp}%</span>}
                      {md > 0 && <span className="badge bg-orange-50 dark:bg-orange-900/30 text-orange-700 dark:text-orange-300">−{formatCurrency(md)} manuale</span>}
                    </div>
                    <div className="divide-y divide-slate-100 dark:divide-slate-700/50">
                      {rows.map(r => (
                        <div key={r.label} className="grid grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-4 py-2 text-xs">
                          <span className="text-slate-500 dark:text-slate-400 truncate">
                            {r.label}
                            {r.discNote && <span className="text-slate-300 dark:text-slate-600 ml-1">({r.discNote})</span>}
                          </span>
                          <span className="text-slate-400">{formatCurrency(r.base)}</span>
                          <span className={r.disc > 0 ? "text-red-500 font-medium" : "text-slate-200 dark:text-slate-700"}>
                            {r.disc > 0 ? `−${formatCurrency(r.disc)}` : "—"}
                          </span>
                          <span className="font-bold text-slate-800 dark:text-slate-100 text-right min-w-[52px]">{formatCurrency(r.final)}</span>
                        </div>
                      ))}
                      <div className="flex justify-between items-center px-4 py-2.5 bg-slate-50 dark:bg-slate-800/40">
                        <span className="text-sm font-semibold text-slate-600 dark:text-slate-300">Totali</span>
                        <span className="text-base font-black text-primary-600 dark:text-primary-400">{formatCurrency(childTotal(i, ch))}</span>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Grand total */}
              <div className="rounded-xl overflow-hidden border border-primary-200 dark:border-primary-800">
                <div className="flex justify-between items-center px-5 py-4 bg-primary-600 dark:bg-primary-700">
                  <span className="font-semibold text-white text-sm">TOTALI I PLOTË — {children.length} fëmijë</span>
                  <span className="text-2xl font-black text-white">{formatCurrency(grand)}</span>
                </div>
                {totalDiscount > 0 && (
                  <div className="flex justify-between items-center px-5 py-2.5 bg-green-50 dark:bg-green-900/20">
                    <span className="text-xs text-green-700 dark:text-green-400">Kursim total nga të gjitha zbritjet</span>
                    <span className="text-sm font-bold text-green-700 dark:text-green-400">−{formatCurrency(totalDiscount)}</span>
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-6 py-4 border-t border-slate-200 dark:border-slate-700 flex-shrink-0 bg-slate-50 dark:bg-slate-800/30 rounded-b-2xl">
          <button onClick={onClose} className="btn-secondary">Anulo</button>
          <div className="flex-1" />
          <button onClick={() => { saveOffer(); }} className="btn-ghost">
            <Save className="w-4 h-4" /> Ruaj
          </button>
          <button onClick={handleSaveAndPrint} className="btn-primary">
            <Printer className="w-4 h-4" /> Ruaj &amp; Printo
          </button>
        </div>
      </div>

      {editingLocations && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setEditingLocations(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-md animate-fade-in" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between p-5 border-b border-slate-100 dark:border-slate-700">
              <h3 className="font-bold text-slate-900 dark:text-white">Çmimet e Vendbanimeve — Transporti</h3>
              <button onClick={() => setEditingLocations(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-2 overflow-y-auto max-h-[60vh]">
              {locDraft.map((l, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input type="text" value={l.label} onChange={e => updateLocDraft(i, "label", e.target.value)}
                    className="form-input flex-1" placeholder="Vendbanimi" />
                  <input type="number" value={l.price} onChange={e => updateLocDraft(i, "price", e.target.value)}
                    className="form-input w-24" placeholder="€/muaj" min="0" step="0.01" />
                  <span className="text-xs text-slate-400 w-6">€</span>
                  <button type="button" onClick={() => removeLocDraftRow(i)} className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/20 text-slate-400 hover:text-red-600">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
              <button type="button" onClick={addLocDraftRow} className="btn-secondary text-sm w-full justify-center">
                <Plus className="w-4 h-4" /> Shto Vendbanim
              </button>
            </div>
            <div className="flex justify-end gap-2 p-5 pt-0">
              <button onClick={() => setEditingLocations(false)} className="btn-secondary">Anulo</button>
              <button onClick={saveLocations} disabled={savingLocations} className="btn-primary">
                {savingLocations ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Ruaj
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
