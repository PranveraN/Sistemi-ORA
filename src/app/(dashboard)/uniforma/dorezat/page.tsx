"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, Trash2, Printer, ArrowRightLeft, X, ArrowLeft } from "lucide-react";
import { formatCurrency, formatDate } from "@/lib/utils";

interface Handover {
  id: number;
  amount: number;
  description: string | null;
  recipient: string | null;
  method: string;
  reference: string | null;
  handoverAt: string;
}

const METHOD_LABEL: Record<string, string> = { CASH: "Cash", BANK: "Bankë / Transfer", CARD: "Kartë" };

function printHandoverReceipt(h: Handover) {
  const win = window.open("", "_blank", "width=400,height=600");
  if (!win) return;
  win.document.write(`<!DOCTYPE html><html lang="sq"><head><meta charset="UTF-8"/><title>Dëshmi Dorëzimi</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { font-family:'Segoe UI',Arial,sans-serif; font-size:13px; color:#0f172a; padding:32px 24px; max-width:360px; }
h1 { font-size:18px; font-weight:700; }
.sub { color:#64748b; font-size:11px; }
hr { border:none; border-top:1px dashed #cbd5e1; margin:14px 0; }
.row { display:flex; justify-content:space-between; padding:4px 0; }
.label { color:#64748b; }
.amount { font-size:20px; font-weight:700; color:#0f172a; }
.sig-area { display:flex; justify-content:space-between; margin-top:32px; }
.sig-box { text-align:center; }
.sig-line { border-bottom:1px solid #0f172a; width:120px; margin-top:40px; }
</style></head><body>
<div style="text-align:center;margin-bottom:20px">
  <h1>Akademia Ora</h1>
  <p class="sub">Dëshmi Dorëzimi — Uniforma</p>
  <p class="sub">${new Date(h.handoverAt).toLocaleDateString("sq-AL", { dateStyle: "long" })}</p>
</div>
<hr/>
<div class="row"><span class="label">Data:</span><span>${formatDate(h.handoverAt)}</span></div>
${h.recipient ? `<div class="row"><span class="label">Marrësi:</span><span>${h.recipient}</span></div>` : ""}
<div class="row"><span class="label">Mënyra:</span><span>${METHOD_LABEL[h.method] ?? h.method}</span></div>
${h.reference ? `<div class="row"><span class="label">Referenca:</span><span>${h.reference}</span></div>` : ""}
${h.description ? `<div class="row"><span class="label">Shënim:</span><span>${h.description}</span></div>` : ""}
<hr/>
<div style="text-align:center;padding:16px 0">
  <p class="sub" style="margin-bottom:4px">SHUMA E DORËZUAR</p>
  <p class="amount">${formatCurrency(h.amount)}</p>
</div>
<hr/>
<div class="sig-area">
  <div class="sig-box"><div class="sig-line"></div><p class="sub" style="margin-top:6px">Dhënësi</p></div>
  <div class="sig-box"><div class="sig-line"></div><p class="sub" style="margin-top:6px">Marrësi</p></div>
</div>
</body></html>`);
  win.document.close();
  setTimeout(() => { win.focus(); win.print(); }, 300);
}

export default function DorezatPage() {
  const [handovers, setHandovers] = useState<Handover[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState({
    amount: "", description: "", recipient: "", method: "CASH", reference: "",
    handoverAt: new Date().toISOString().split("T")[0],
  });
  const [saving, setSaving] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);

  const load = () => {
    setLoading(true);
    fetch("/api/uniforms/handovers")
      .then(r => r.json())
      .then(setHandovers)
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    setSaving(true);
    await fetch("/api/uniforms/handovers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        amount: parseFloat(form.amount),
        description: form.description.trim() || null,
        recipient: form.recipient.trim() || null,
        method: form.method,
        reference: form.reference.trim() || null,
        handoverAt: form.handoverAt,
      }),
    });
    setSaving(false);
    setShowModal(false);
    setForm({ amount: "", description: "", recipient: "", method: "CASH", reference: "", handoverAt: new Date().toISOString().split("T")[0] });
    load();
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    await fetch(`/api/uniforms/handovers/${deleteId}`, { method: "DELETE" });
    setDeleteId(null);
    load();
  };

  const totalHandedOver = handovers.reduce((s, h) => s + h.amount, 0);

  return (
    <div className="p-6 space-y-6 animate-fade-in">
      <div className="flex items-center gap-3">
        <Link href="/uniforma" className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors">
          <ArrowLeft className="w-5 h-5 text-slate-500" />
        </Link>
        <div className="flex-1 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dorëzimet e Fitimit</h1>
            <p className="text-sm text-slate-400 mt-0.5">Regjistrimi i parave të dorëzuara</p>
          </div>
          <button onClick={() => setShowModal(true)} className="btn-primary">
            <Plus className="w-4 h-4" /> Regjistro Dorëzim
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="card p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-900/30 flex items-center justify-center flex-shrink-0">
          <ArrowRightLeft className="w-6 h-6 text-green-600" />
        </div>
        <div>
          <p className="text-xs text-slate-400">Gjithsej i dorëzuar</p>
          <p className="text-2xl font-bold text-green-600">{formatCurrency(totalHandedOver)}</p>
        </div>
        <div className="ml-auto text-right">
          <p className="text-xs text-slate-400">Rekordet</p>
          <p className="text-lg font-bold text-slate-700 dark:text-slate-200">{handovers.length}</p>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin w-6 h-6 border-2 border-primary-500 border-t-transparent rounded-full" />
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 dark:border-slate-700">
                {["Data", "Shuma", "Mënyra", "Marrësi", "Referenca", "Shënim", ""].map(h => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {handovers.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <ArrowRightLeft className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-400">Nuk ka dorëzime të regjistruara</p>
                  </td>
                </tr>
              )}
              {handovers.map(h => (
                <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 text-slate-500 whitespace-nowrap">
                    {formatDate(h.handoverAt)}
                  </td>
                  <td className="px-4 py-3 font-bold text-green-600">{formatCurrency(h.amount)}</td>
                  <td className="px-4 py-3">
                    <span className="badge bg-slate-100 text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                      {METHOD_LABEL[h.method] ?? h.method}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-slate-600 dark:text-slate-300">{h.recipient ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400 font-mono text-xs">{h.reference ?? "—"}</td>
                  <td className="px-4 py-3 text-slate-400 max-w-[160px] truncate">{h.description ?? "—"}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1">
                      <button onClick={() => printHandoverReceipt(h)}
                        className="p-1.5 rounded hover:bg-blue-50 dark:hover:bg-blue-900/30 text-blue-500 transition-colors"
                        title="Printo dëshmi">
                        <Printer className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteId(h.id)}
                        className="p-1.5 rounded hover:bg-red-50 dark:hover:bg-red-900/30 text-red-400 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-slate-200 dark:border-slate-700">
              <h2 className="font-semibold text-slate-900 dark:text-white">Regjistro Dorëzim</h2>
              <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-slate-100 dark:hover:bg-slate-800">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="label">Shuma (€) *</label>
                  <input className="input" type="number" step="0.01" placeholder="0.00" value={form.amount}
                    onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} />
                </div>
                <div>
                  <label className="label">Data</label>
                  <input className="input" type="date" value={form.handoverAt}
                    onChange={e => setForm(f => ({ ...f, handoverAt: e.target.value }))} />
                </div>
              </div>
              <div>
                <label className="label">Mënyra</label>
                <select className="input" value={form.method} onChange={e => setForm(f => ({ ...f, method: e.target.value }))}>
                  <option value="CASH">Cash</option>
                  <option value="BANK">Bankë / Transfer</option>
                  <option value="CARD">Kartë</option>
                </select>
              </div>
              <div>
                <label className="label">Marrësi</label>
                <input className="input" placeholder="p.sh. Drejtori" value={form.recipient}
                  onChange={e => setForm(f => ({ ...f, recipient: e.target.value }))} />
              </div>
              <div>
                <label className="label">Referenca / Nr. fature</label>
                <input className="input" placeholder="opsional" value={form.reference}
                  onChange={e => setForm(f => ({ ...f, reference: e.target.value }))} />
              </div>
              <div>
                <label className="label">Shënim</label>
                <textarea className="input resize-none" rows={2} placeholder="opsional" value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <button onClick={() => setShowModal(false)} className="btn-ghost flex-1">Anulo</button>
              <button onClick={save} disabled={saving || !form.amount} className="btn-primary flex-1">
                {saving ? "Duke ruajtur..." : "Ruaj"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirm */}
      {deleteId && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Fshi dorëzimin?</h3>
            <p className="text-sm text-slate-400 mb-6">Ky veprim nuk mund të kthehet.</p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteId(null)} className="btn-ghost flex-1">Anulo</button>
              <button onClick={confirmDelete} className="btn-danger flex-1">Fshi</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
