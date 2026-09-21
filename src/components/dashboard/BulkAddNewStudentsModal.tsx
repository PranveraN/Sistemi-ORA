"use client";

import { useState } from "react";
import { X, Search, Save, CheckCircle2, AlertTriangle, XCircle, Loader2 } from "lucide-react";

interface ParsedLine {
  firstName: string;
  lastName: string;
  klasa: string;
  piket: string;
  origjina: string;
}

interface MatchOption { id: number; firstName: string; lastName: string; className: string | null }
interface MatchResult { index: number; firstName: string; lastName: string; matches: MatchOption[] }

interface RowState {
  parsed: ParsedLine;
  matches: MatchOption[];
  selectedId: number | null; // null = anashkalo (s'u gjet, ose admini e ka hequr)
  applyOrigin: boolean;
}

// Ndan një rresht të ngjitur në fusha — mbështet TAB (kopjim nga Excel/tabela),
// presje, ose hapësira të shumëfishta. Toleron edhe kolonën "Nr." fillestare.
function parseLine(raw: string): ParsedLine | null {
  const line = raw.trim();
  if (!line) return null;
  let parts: string[];
  if (line.includes("\t")) parts = line.split("\t");
  else if (line.includes(",")) parts = line.split(",");
  else if (/\s{2,}/.test(line)) parts = line.split(/\s{2,}/);
  else parts = line.split(/\s+/);
  parts = parts.map(p => p.trim()).filter(p => p !== "");
  if (parts.length >= 5 && /^\d+$/.test(parts[0])) parts = parts.slice(1); // hiq "Nr."
  if (parts.length < 2) return null;
  return { firstName: parts[0], lastName: parts[1], klasa: parts[2] ?? "", piket: parts[3] ?? "", origjina: parts[4] ?? "" };
}

function isDiasporaLooking(origjina: string): boolean {
  // Vetëm një hamendje fillestare për checkbox-in (admini e konfirmon/ndryshon
  // vetë) — qytetet e njohura të Kosovës nuk shënohen si "diasporë" nga fillimi.
  const kosovoTowns = ["prishtin", "vushtrr", "mitrovic", "fushe kosov", "fushë kosov", "barilev", "hajval", "prizren", "gjakov", "peje", "pejë", "ferizaj", "gjilan", "podujev", "drenas", "lipjan"];
  const lower = origjina.toLowerCase();
  return origjina.trim() !== "" && !kosovoTowns.some(t => lower.includes(t));
}

export default function BulkAddNewStudentsModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [text, setText] = useState("");
  const [searching, setSearching] = useState(false);
  const [rows, setRows] = useState<RowState[] | null>(null);
  const [enrollDate, setEnrollDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [applying, setApplying] = useState(false);
  const [result, setResult] = useState<{ count: number } | null>(null);
  const [error, setError] = useState("");

  async function handleSearch() {
    const lines = text.split("\n").map(parseLine).filter((l): l is ParsedLine => l !== null);
    if (lines.length === 0) { setError("Ngjitni së paku një rresht (Emri + Mbiemri)."); return; }
    setError("");
    setSearching(true);
    const r = await fetch("/api/students/match-list", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries: lines.map(l => ({ firstName: l.firstName, lastName: l.lastName })) }),
    });
    const data = await r.json();
    setSearching(false);
    if (!r.ok) { setError(data.message || "Kërkimi dështoi."); return; }

    const results: MatchResult[] = data.results;
    setRows(lines.map((parsed, i) => {
      const matches = results[i]?.matches ?? [];
      return {
        parsed,
        matches,
        selectedId: matches.length === 1 ? matches[0].id : null,
        applyOrigin: isDiasporaLooking(parsed.origjina),
      };
    }));
  }

  function updateRow(i: number, patch: Partial<RowState>) {
    setRows(prev => prev ? prev.map((r, idx) => idx === i ? { ...r, ...patch } : r) : prev);
  }

  const confirmedCount = rows?.filter(r => r.selectedId != null).length ?? 0;

  async function handleApply() {
    if (!rows) return;
    const entries = rows
      .filter(r => r.selectedId != null)
      .map(r => ({
        id: r.selectedId as number,
        enrollDate,
        admissionScore: r.parsed.piket ? Number(r.parsed.piket.replace("%", "").trim()) || null : null,
        originCountry: r.applyOrigin && r.parsed.origjina ? r.parsed.origjina : null,
      }));
    if (entries.length === 0) return;
    setApplying(true);
    setError("");
    const r = await fetch("/api/students/bulk-add-new", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ entries }),
    });
    const data = await r.json();
    setApplying(false);
    if (!r.ok) { setError(data.message || "Dështoi."); return; }
    setResult({ count: data.count });
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[92vh] overflow-y-auto animate-fade-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between p-5 border-b border-slate-100 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-800">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Ngjit Listë — Shfaq si Nxënës të Rinj</h3>
            <p className="text-xs text-slate-400 mt-0.5">Kërkon mes nxënësve ekzistues — asnjë nxënës i ri s'krijohet.</p>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-5 space-y-4">
          {result ? (
            <div className="text-center py-6 space-y-2">
              <CheckCircle2 className="w-10 h-10 text-green-500 mx-auto" />
              <p className="font-semibold text-slate-800 dark:text-white">{result.count} nxënës u shfaqën te "Nxënës të Rinj"</p>
              <button onClick={onSaved} className="btn-primary mx-auto mt-2">Mbyll</button>
            </div>
          ) : !rows ? (
            <>
              <div>
                <label className="form-label">Ngjitni listën (një nxënës për rresht)</label>
                <textarea
                  className="form-input font-mono text-xs"
                  rows={10}
                  placeholder={"Zejd\tBashota\t6/A\t25%\tMitrovicë\nArb\tShahini\t6/A\t27%\tVushtrri\n..."}
                  value={text}
                  onChange={e => setText(e.target.value)}
                />
                <p className="text-[11px] text-slate-400 mt-1">
                  Mund ta ngjitni direkt nga Excel/tabela — Emri, Mbiemri, Klasa, Piket, Origjina (kolonat e fundit opsionale).
                </p>
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <button onClick={handleSearch} disabled={searching || !text.trim()} className="btn-primary w-full justify-center">
                {searching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                {searching ? "Duke kërkuar..." : "Gjej Nxënësit"}
              </button>
            </>
          ) : (
            <>
              <div className="flex items-center justify-between">
                <p className="text-sm text-slate-500">{confirmedCount} nga {rows.length} gati për t'u shfaqur</p>
                <button onClick={() => setRows(null)} className="text-xs text-primary-600 hover:underline">Kthehu te lista</button>
              </div>

              <div className="space-y-2 max-h-[45vh] overflow-y-auto pr-1">
                {rows.map((row, i) => (
                  <div key={i} className={`p-3 rounded-xl border ${row.selectedId != null ? "border-slate-200 dark:border-slate-700" : "border-red-200 dark:border-red-900 bg-red-50/40 dark:bg-red-900/10"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-100">
                        {row.parsed.firstName} {row.parsed.lastName}
                        {row.parsed.klasa && <span className="text-slate-400 font-normal"> · {row.parsed.klasa}</span>}
                      </span>
                      {row.matches.length === 1 && (
                        <span className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400 shrink-0">
                          <CheckCircle2 className="w-3.5 h-3.5" /> U gjet — {row.matches[0].className ?? "pa klasë"}
                        </span>
                      )}
                      {row.matches.length === 0 && (
                        <span className="flex items-center gap-1 text-xs text-red-500 shrink-0">
                          <XCircle className="w-3.5 h-3.5" /> S'u gjet
                        </span>
                      )}
                      {row.matches.length > 1 && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 shrink-0">
                          <AlertTriangle className="w-3.5 h-3.5" /> {row.matches.length} përputhje
                        </span>
                      )}
                    </div>

                    {row.matches.length > 1 && (
                      <select
                        className="form-input text-xs py-1.5 mt-2"
                        value={row.selectedId ?? ""}
                        onChange={e => updateRow(i, { selectedId: e.target.value ? Number(e.target.value) : null })}
                      >
                        <option value="">— Anashkalo —</option>
                        {row.matches.map(m => (
                          <option key={m.id} value={m.id}>{m.firstName} {m.lastName} — {m.className ?? "pa klasë"}</option>
                        ))}
                      </select>
                    )}

                    {row.parsed.origjina && row.selectedId != null && (
                      <label className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 mt-2 cursor-pointer">
                        <input type="checkbox" checked={row.applyOrigin} onChange={e => updateRow(i, { applyOrigin: e.target.checked })} />
                        Vendos "Vendi i Origjinës" = {row.parsed.origjina}
                      </label>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <label className="form-label">Data e Regjistrimit (për të gjithë të konfirmuarit)</label>
                <input type="date" className="form-input" value={enrollDate} onChange={e => setEnrollDate(e.target.value)} />
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}
            </>
          )}
        </div>

        {rows && !result && (
          <div className="flex gap-2 p-5 pt-0">
            <button onClick={onClose} className="btn-secondary"><X className="w-4 h-4" />Anulo</button>
            <button onClick={handleApply} disabled={applying || confirmedCount === 0} className="btn-primary flex-1">
              {applying ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              {applying ? "Duke ruajtur..." : `Konfirmo (${confirmedCount})`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
