"use client";

import { useState } from "react";
import Header from "@/components/layout/Header";
import { Receipt, Plus, FileText, BarChart3, ChevronDown } from "lucide-react";

type Tab = "krijo" | "lista" | "raport";

const TABS: { key: Tab; label: string; icon: React.ReactNode }[] = [
  { key: "krijo",  label: "Krijo Faturë",   icon: <Plus       className="w-4 h-4" /> },
  { key: "lista",  label: "Lista Faturave",  icon: <FileText   className="w-4 h-4" /> },
  { key: "raport", label: "Raport ATK",      icon: <BarChart3  className="w-4 h-4" /> },
];

const VAT_RATES = [
  { value: 18, label: "18% — Standarde" },
  { value: 8,  label: "8% — E reduktuar" },
  { value: 0,  label: "0% — E përjashtuar" },
];

export default function FaturatRregulltaPage() {
  const [tab, setTab] = useState<Tab>("krijo");

  return (
    <>
      <Header title="Faturat e Rregullta" backHref="/dashboard" />
      <div className="p-6 space-y-5 animate-fade-in">

        {/* Tab bar */}
        <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 rounded-xl p-1 w-fit">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                tab === t.key
                  ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm"
                  : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          ))}
        </div>

        {/* ── KRIJO TAB ── */}
        {tab === "krijo" && <KrijoFature />}

        {/* ── LISTA TAB ── */}
        {tab === "lista" && (
          <div className="card p-16 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 bg-emerald-50 dark:bg-emerald-900/30 rounded-2xl flex items-center justify-center">
              <FileText className="w-7 h-7 text-emerald-500" />
            </div>
            <p className="font-semibold text-slate-700 dark:text-slate-200">Lista e Faturave</p>
            <p className="text-sm text-slate-400">Historiku i faturave të rregullta do të shfaqet këtu</p>
            <p className="text-xs text-slate-300 dark:text-slate-600 mt-2">— Në zhvillim —</p>
          </div>
        )}

        {/* ── RAPORT TAB ── */}
        {tab === "raport" && (
          <div className="card p-16 flex flex-col items-center text-center gap-3">
            <div className="w-14 h-14 bg-blue-50 dark:bg-blue-900/30 rounded-2xl flex items-center justify-center">
              <BarChart3 className="w-7 h-7 text-blue-500" />
            </div>
            <p className="font-semibold text-slate-700 dark:text-slate-200">Raport ATK</p>
            <p className="text-sm text-slate-400">Raporti periodik për deklarim në ATK do të jetë këtu</p>
            <p className="text-xs text-slate-300 dark:text-slate-600 mt-2">— Në zhvillim —</p>
          </div>
        )}

      </div>
    </>
  );
}

/* ── Krijo Faturë form ─────────────────────────────────── */

interface InvoiceItem {
  id: number;
  description: string;
  quantity: string;
  unitPrice: string;
}

function KrijoFature() {
  const today = new Date().toISOString().split("T")[0];

  // Header fields
  const [invoiceNo, setInvoiceNo]   = useState(`FR-${new Date().getFullYear()}-001`);
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate]       = useState(today);
  const [vatRate, setVatRate]       = useState(18);

  // Buyer info
  const [buyerName,    setBuyerName]    = useState("");
  const [buyerAddress, setBuyerAddress] = useState("");
  const [buyerNRB,     setBuyerNRB]     = useState(""); // Numri i Regjistrimit të Biznesit
  const [buyerNRF,     setBuyerNRF]     = useState(""); // Numri i Referencës Fiskale

  // Items
  const [items, setItems] = useState<InvoiceItem[]>([
    { id: 1, description: "", quantity: "1", unitPrice: "" },
  ]);

  const [showSeller, setShowSeller] = useState(false);

  function addItem() {
    setItems(prev => [...prev, { id: Date.now(), description: "", quantity: "1", unitPrice: "" }]);
  }

  function removeItem(id: number) {
    if (items.length === 1) return;
    setItems(prev => prev.filter(i => i.id !== id));
  }

  function updateItem(id: number, field: keyof InvoiceItem, value: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, [field]: value } : i));
  }

  const subtotal = items.reduce((sum, item) => {
    const qty   = parseFloat(item.quantity  || "0");
    const price = parseFloat(item.unitPrice || "0");
    return sum + qty * price;
  }, 0);

  const vatAmount = subtotal * vatRate / 100;
  const total     = subtotal + vatAmount;

  function handlePrint() {
    const content = document.getElementById("fatura-content")?.innerHTML;
    if (!content) return;
    const w = window.open("", "_blank", "width=900,height=700");
    if (!w) return;
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>Faturë ${invoiceNo}</title>
<style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { font-family: Arial, sans-serif; font-size: 10pt; color: #000; background: #fff; }
  @page { size: A4; margin: 15mm; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #ccc; padding: 6px 8px; font-size: 10pt; }
  .no-border td, .no-border th { border: none; }
  .header-table td { border: none; vertical-align: top; }
</style></head><body>${content}</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-5">

      {/* Left: form */}
      <div className="xl:col-span-2 space-y-4">

        {/* Invoice meta */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4 flex items-center gap-2">
            <Receipt className="w-4 h-4 text-emerald-500" />
            Të dhënat e faturës
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <label className="form-label">Nr. Faturës</label>
              <input value={invoiceNo} onChange={e => setInvoiceNo(e.target.value)}
                className="form-input font-mono" placeholder="FR-2026-001" />
            </div>
            <div>
              <label className="form-label">Data e Faturës</label>
              <input type="date" value={invoiceDate} onChange={e => setInvoiceDate(e.target.value)}
                className="form-input" />
            </div>
            <div>
              <label className="form-label">Data e Skadimit</label>
              <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                className="form-input" />
            </div>
            <div className="sm:col-span-2">
              <label className="form-label">TVSH (Norma e tatimit)</label>
              <div className="flex gap-2">
                {VAT_RATES.map(r => (
                  <button key={r.value}
                    onClick={() => setVatRate(r.value)}
                    className={`flex-1 py-2 rounded-xl border-2 text-sm font-medium transition-all ${
                      vatRate === r.value
                        ? "border-emerald-500 bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300"
                        : "border-slate-200 dark:border-slate-600 text-slate-500 hover:border-emerald-200"
                    }`}>
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Buyer info */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Blerësi / Klienti</h3>
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="form-label">Emri / Kompania</label>
              <input value={buyerName} onChange={e => setBuyerName(e.target.value)}
                className="form-input" placeholder="Emri i blerësit ose kompanisë" />
            </div>
            <div className="col-span-2">
              <label className="form-label">Adresa</label>
              <input value={buyerAddress} onChange={e => setBuyerAddress(e.target.value)}
                className="form-input" placeholder="Adresa e plotë" />
            </div>
            <div>
              <label className="form-label">NRB (Nr. Regjistrim Biznesi)</label>
              <input value={buyerNRB} onChange={e => setBuyerNRB(e.target.value)}
                className="form-input font-mono" placeholder="XXXXXXXXXX" />
            </div>
            <div>
              <label className="form-label">NRF (Nr. Referencës Fiskale)</label>
              <input value={buyerNRF} onChange={e => setBuyerNRF(e.target.value)}
                className="form-input font-mono" placeholder="XXXXXXXXXX" />
            </div>
          </div>
        </div>

        {/* Items */}
        <div className="card p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 mb-4">Artikujt / Shërbimet</h3>
          <div className="space-y-2">
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-slate-400 px-1">
              <div className="col-span-6">Përshkrimi</div>
              <div className="col-span-2 text-right">Sasia</div>
              <div className="col-span-3 text-right">Çmimi (€)</div>
              <div className="col-span-1"></div>
            </div>
            {items.map(item => {
              const total = parseFloat(item.quantity || "0") * parseFloat(item.unitPrice || "0");
              return (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-6">
                    <input value={item.description}
                      onChange={e => updateItem(item.id, "description", e.target.value)}
                      className="form-input text-sm" placeholder="Përshkrim shërbimi..." />
                  </div>
                  <div className="col-span-2">
                    <input type="number" value={item.quantity}
                      onChange={e => updateItem(item.id, "quantity", e.target.value)}
                      className="form-input text-sm text-right" min="0" step="0.5" />
                  </div>
                  <div className="col-span-3">
                    <input type="number" value={item.unitPrice}
                      onChange={e => updateItem(item.id, "unitPrice", e.target.value)}
                      className="form-input text-sm text-right" min="0" step="0.01"
                      placeholder="0.00" />
                  </div>
                  <div className="col-span-1 flex items-center justify-end">
                    <button onClick={() => removeItem(item.id)}
                      className="text-slate-300 hover:text-red-400 transition-colors text-lg leading-none">
                      ×
                    </button>
                  </div>
                  {total > 0 && (
                    <div className="col-span-12 text-right text-xs text-slate-400 pr-7">
                      Totali: <span className="font-semibold text-slate-600 dark:text-slate-300">{total.toFixed(2)} €</span>
                    </div>
                  )}
                </div>
              );
            })}
            <button onClick={addItem}
              className="w-full py-2 rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-700 text-slate-400 hover:border-emerald-300 hover:text-emerald-500 transition-colors text-sm flex items-center justify-center gap-2">
              <Plus className="w-4 h-4" /> Shto artikull
            </button>
          </div>
        </div>

        {/* Seller info (collapsible) */}
        <div className="card overflow-hidden">
          <button onClick={() => setShowSeller(v => !v)}
            className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors text-sm font-medium text-slate-600 dark:text-slate-300">
            Të dhënat e shitësit (Akademia Ora)
            <ChevronDown className={`w-4 h-4 transition-transform ${showSeller ? "rotate-180" : ""}`} />
          </button>
          {showSeller && (
            <div className="border-t border-slate-100 dark:border-slate-700 px-5 py-4">
              <div className="grid grid-cols-2 gap-3 text-xs text-slate-500 dark:text-slate-400">
                <div><p className="font-medium text-slate-700 dark:text-slate-200">SHFMU Akademia Ora</p>
                <p>Rr. Lekë Matrënga, Përroi i njelmët, nr. 23</p>
                <p>Prishtinë, Kosovë</p></div>
                <div><p>NRB: <span className="font-mono">810988880</span></p>
                <p>NRF: <span className="font-mono">601171820</span></p>
                <p>BKT: <span className="font-mono">1971897927031291</span></p></div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right: preview + summary */}
      <div className="space-y-4">
        {/* Totals */}
        <div className="card p-5 space-y-3">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200">Përmbledhja</h3>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-500">
              <span>Nëntotali (pa TVSH)</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">{subtotal.toFixed(2)} €</span>
            </div>
            <div className="flex justify-between text-slate-500">
              <span>TVSH {vatRate}%</span>
              <span className="font-medium text-slate-700 dark:text-slate-200">{vatAmount.toFixed(2)} €</span>
            </div>
            <div className="border-t border-slate-100 dark:border-slate-700 pt-2 flex justify-between font-bold text-base">
              <span className="text-slate-700 dark:text-slate-200">TOTALI</span>
              <span className="text-emerald-600 dark:text-emerald-400">{total.toFixed(2)} €</span>
            </div>
          </div>

          <button
            onClick={handlePrint}
            disabled={!buyerName || subtotal === 0}
            className="w-full btn-primary justify-center disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Receipt className="w-4 h-4" />
            Gjenero &amp; Printo Faturën
          </button>
          <p className="text-xs text-slate-400 text-center">
            Plotëso blerësin dhe të paktën një artikull
          </p>
        </div>

        {/* Info */}
        <div className="card p-4 space-y-2 text-xs text-slate-500 dark:text-slate-400">
          <p className="font-semibold text-slate-600 dark:text-slate-300 text-sm">Shënime</p>
          <p>• Faturat gjenerohen sipas kërkesave të ATK-së</p>
          <p>• TVSH 18% aplikohet për shumicën e shërbimeve</p>
          <p>• R-Kosovës numri duhet shtuar manualisht nëse keni fiskal</p>
          <p>• Mbaj kopje fizike dhe digjitale</p>
        </div>
      </div>

      {/* Hidden print area */}
      <div id="fatura-content" className="hidden">
        <PrintableFature
          invoiceNo={invoiceNo}
          invoiceDate={invoiceDate}
          dueDate={dueDate}
          vatRate={vatRate}
          buyerName={buyerName}
          buyerAddress={buyerAddress}
          buyerNRB={buyerNRB}
          buyerNRF={buyerNRF}
          items={items}
          subtotal={subtotal}
          vatAmount={vatAmount}
          total={total}
        />
      </div>
    </div>
  );
}

/* ── Printable invoice ─────────────────────────────────── */
function PrintableFature({ invoiceNo, invoiceDate, dueDate, vatRate, buyerName, buyerAddress, buyerNRB, buyerNRF, items, subtotal, vatAmount, total }: {
  invoiceNo: string; invoiceDate: string; dueDate: string; vatRate: number;
  buyerName: string; buyerAddress: string; buyerNRB: string; buyerNRF: string;
  items: InvoiceItem[]; subtotal: number; vatAmount: number; total: number;
}) {
  const fmt = (iso: string) => {
    if (!iso) return "";
    const [y, m, d] = iso.split("-");
    return `${d}.${m}.${y}`;
  };

  return (
    <div style={{ fontFamily: "Arial, sans-serif", fontSize: "10pt", color: "#000", maxWidth: "800px", margin: "0 auto" }}>
      {/* Header */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "20px" }}>
        <tbody>
          <tr>
            <td style={{ border: "none", verticalAlign: "top", width: "50%" }}>
              <div style={{ fontSize: "16pt", fontWeight: "bold", color: "#1a472a" }}>SHFMU Akademia Ora</div>
              <div style={{ marginTop: "4px", fontSize: "9pt", color: "#555" }}>
                <div>Rr. Lekë Matrënga, Përroi i njelmët, nr. 23</div>
                <div>Prishtinë, Kosovë</div>
                <div>NRB: 810988880 | NRF: 601171820</div>
                <div>BKT: 1971897927031291</div>
              </div>
            </td>
            <td style={{ border: "none", verticalAlign: "top", textAlign: "right", width: "50%" }}>
              <div style={{ fontSize: "20pt", fontWeight: "bold", color: "#1a472a" }}>FATURË</div>
              <div style={{ fontSize: "12pt", fontWeight: "bold", color: "#333", marginTop: "4px" }}>Nr. {invoiceNo}</div>
              <div style={{ fontSize: "9pt", color: "#666", marginTop: "8px" }}>
                <div>Data: <strong>{fmt(invoiceDate)}</strong></div>
                <div>Skadon: <strong>{fmt(dueDate)}</strong></div>
                <div style={{ marginTop: "4px" }}>TVSH: <strong>{vatRate}%</strong></div>
              </div>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Divider */}
      <div style={{ borderTop: "2px solid #1a472a", marginBottom: "16px" }} />

      {/* Buyer */}
      <div style={{ marginBottom: "16px", padding: "10px", background: "#f9f9f9", border: "1px solid #ddd", borderRadius: "4px" }}>
        <div style={{ fontSize: "9pt", color: "#888", marginBottom: "4px" }}>FATURA PËR:</div>
        <div style={{ fontWeight: "bold", fontSize: "11pt" }}>{buyerName || "—"}</div>
        {buyerAddress && <div style={{ fontSize: "9pt", color: "#555", marginTop: "2px" }}>{buyerAddress}</div>}
        {(buyerNRB || buyerNRF) && (
          <div style={{ fontSize: "9pt", color: "#555", marginTop: "2px" }}>
            {buyerNRB && `NRB: ${buyerNRB}`}{buyerNRB && buyerNRF && " | "}{buyerNRF && `NRF: ${buyerNRF}`}
          </div>
        )}
      </div>

      {/* Items table */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px" }}>
        <thead>
          <tr style={{ background: "#1a472a", color: "#fff" }}>
            <th style={{ border: "1px solid #1a472a", padding: "7px 10px", textAlign: "left", fontSize: "9pt" }}>#</th>
            <th style={{ border: "1px solid #1a472a", padding: "7px 10px", textAlign: "left", fontSize: "9pt" }}>Përshkrimi</th>
            <th style={{ border: "1px solid #1a472a", padding: "7px 10px", textAlign: "center", fontSize: "9pt" }}>Sasia</th>
            <th style={{ border: "1px solid #1a472a", padding: "7px 10px", textAlign: "right", fontSize: "9pt" }}>Çmimi (€)</th>
            <th style={{ border: "1px solid #1a472a", padding: "7px 10px", textAlign: "right", fontSize: "9pt" }}>Totali (€)</th>
          </tr>
        </thead>
        <tbody>
          {items.filter(i => i.description || parseFloat(i.unitPrice || "0") > 0).map((item, idx) => {
            const qty   = parseFloat(item.quantity  || "0");
            const price = parseFloat(item.unitPrice || "0");
            const rowTotal = qty * price;
            return (
              <tr key={item.id} style={{ background: idx % 2 === 0 ? "#fff" : "#f5f9f5" }}>
                <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: "9pt" }}>{idx + 1}</td>
                <td style={{ border: "1px solid #ccc", padding: "6px 10px", fontSize: "9pt" }}>{item.description}</td>
                <td style={{ border: "1px solid #ccc", padding: "6px 10px", textAlign: "center", fontSize: "9pt" }}>{qty}</td>
                <td style={{ border: "1px solid #ccc", padding: "6px 10px", textAlign: "right", fontSize: "9pt" }}>{price.toFixed(2)}</td>
                <td style={{ border: "1px solid #ccc", padding: "6px 10px", textAlign: "right", fontSize: "9pt", fontWeight: "bold" }}>{rowTotal.toFixed(2)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>

      {/* Totals */}
      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "24px" }}>
        <tbody>
          <tr>
            <td style={{ border: "none", width: "55%" }} />
            <td style={{ border: "none", width: "45%" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  <tr>
                    <td style={{ border: "1px solid #ccc", padding: "5px 10px", fontSize: "9pt" }}>Nëntotali (pa TVSH)</td>
                    <td style={{ border: "1px solid #ccc", padding: "5px 10px", textAlign: "right", fontSize: "9pt" }}>{subtotal.toFixed(2)} €</td>
                  </tr>
                  <tr>
                    <td style={{ border: "1px solid #ccc", padding: "5px 10px", fontSize: "9pt" }}>TVSH {vatRate}%</td>
                    <td style={{ border: "1px solid #ccc", padding: "5px 10px", textAlign: "right", fontSize: "9pt" }}>{vatAmount.toFixed(2)} €</td>
                  </tr>
                  <tr style={{ background: "#1a472a", color: "#fff" }}>
                    <td style={{ border: "1px solid #1a472a", padding: "7px 10px", fontWeight: "bold", fontSize: "10pt" }}>TOTALI</td>
                    <td style={{ border: "1px solid #1a472a", padding: "7px 10px", textAlign: "right", fontWeight: "bold", fontSize: "10pt" }}>{total.toFixed(2)} €</td>
                  </tr>
                </tbody>
              </table>
            </td>
          </tr>
        </tbody>
      </table>

      {/* Footer */}
      <div style={{ borderTop: "1px solid #ccc", paddingTop: "12px", fontSize: "8.5pt", color: "#666" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div>
            <div style={{ fontWeight: "bold", marginBottom: "2px" }}>Mënyra e pagesës:</div>
            <div>Transfertë bankare — BKT: 1971897927031291</div>
            <div>Referencë: {invoiceNo}</div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontWeight: "bold", marginBottom: "2px" }}>Nënshkrimi i shitësit:</div>
            <div style={{ borderBottom: "1px solid #000", width: "160px", marginTop: "24px", display: "inline-block" }} />
          </div>
        </div>
        <div style={{ marginTop: "10px", textAlign: "center", fontSize: "8pt", color: "#aaa" }}>
          Faturë e lëshuar nga SHFMU Akademia Ora • Prishtinë, Kosovë
        </div>
      </div>
    </div>
  );
}
