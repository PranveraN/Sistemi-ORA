"use client";

import { useState } from "react";
import { Loader2, Search } from "lucide-react";
import HistoryList, { type HistoryEntry } from "./HistoryList";
import { TABLE_LABEL } from "./labels";

// "Historiku i ndryshimeve" — çdo ndryshim i një pagese/fature (ose rekordi tjetër
// financiar) nga gjurma e auditimit: kush, kur, nga cila IP, çka para/pas, arsyeja.
const TABLES = ["Payment", "Invoice", "FamilyReceipt", "Shpenzim", "ShpenzimPagese", "Expense", "Hyra", "Investim", "UniSale", "UniPayment", "BookSale", "BookPayment", "FeeExemption", "Student"];

export default function HistoryTab() {
  const [numri, setNumri] = useState("");
  const [table, setTable] = useState("Payment");
  const [id, setId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<{ table: string; id: number; label: string; history: HistoryEntry[] } | null>(null);

  async function search(byNumber: boolean) {
    setLoading(true); setError(""); setResult(null);
    const q = byNumber ? `numri=${encodeURIComponent(numri.trim())}` : `tabela=${table}&id=${parseInt(id) || 0}`;
    const r = await fetch(`/api/auditimi/historiku?${q}`);
    const j = await r.json().catch(() => ({}));
    setLoading(false);
    if (!r.ok) { setError(j.error || "S'u gjet."); return; }
    setResult(j);
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 dark:text-slate-400">
        Shkruani numrin e dokumentit (p.sh. <b>DEP-2026-0012</b>, <b>FAT-2026-0003</b>, <b>FAM-2026-0002</b>) ose zgjidhni llojin dhe ID-në.
        Shfaqet çdo ndryshim: kush e bëri, kur, çka ishte para dhe pas, dhe arsyeja. Gjurma nis nga dita e aktivizimit të auditimit.
      </p>
      <div className="card p-4 grid sm:grid-cols-2 gap-4">
        <form onSubmit={e => { e.preventDefault(); if (numri.trim()) search(true); }} className="flex items-end gap-2">
          <div className="flex-1">
            <label htmlFor="hist-numri" className="form-label">Numri i dokumentit</label>
            <input id="hist-numri" className="form-input" value={numri} onChange={e => setNumri(e.target.value)} placeholder="DEP-2026-0012" />
          </div>
          <button type="submit" className="btn-secondary" disabled={!numri.trim() || loading}><Search className="w-4 h-4" /> Kërko</button>
        </form>
        <form onSubmit={e => { e.preventDefault(); if (parseInt(id)) search(false); }} className="flex items-end gap-2">
          <div>
            <label htmlFor="hist-tabela" className="form-label">Lloji</label>
            <select id="hist-tabela" className="form-input" value={table} onChange={e => setTable(e.target.value)}>
              {TABLES.map(t => <option key={t} value={t}>{TABLE_LABEL[t] ?? t}</option>)}
            </select>
          </div>
          <div className="w-28">
            <label htmlFor="hist-id" className="form-label">ID</label>
            <input id="hist-id" inputMode="numeric" className="form-input" value={id} onChange={e => setId(e.target.value.replace(/\D/g, ""))} />
          </div>
          <button type="submit" className="btn-secondary" disabled={!parseInt(id) || loading}><Search className="w-4 h-4" /> Shfaq</button>
        </form>
      </div>
      {loading && <Loader2 className="w-5 h-5 animate-spin text-primary-400" aria-label="Duke ngarkuar" />}
      {error && <p role="alert" className="text-red-600 text-sm">{error}</p>}
      {result && (
        <section className="card p-4 space-y-3">
          <h3 className="font-semibold text-slate-900 dark:text-white">{TABLE_LABEL[result.table] ?? result.table} #{result.id}{result.label}</h3>
          <HistoryList entries={result.history} />
        </section>
      )}
    </div>
  );
}
