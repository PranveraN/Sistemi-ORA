"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import * as XLSX from "xlsx";
import { formatCurrency, formatDate } from "@/lib/utils";
import { currentSchoolYearStart } from "@/lib/academicYear";
import { Download, Printer, MessageSquare, Loader2, FileSpreadsheet } from "lucide-react";

// Moduli TIMI INVEST → Raportet & eksportet (Faza 4). VETËM LEXIM — të dhënat vijnë nga e njëjta
// llogaritje si Pasqyra. SMS-të hapen te moduli ekzistues i SMS-ve (?students=&text=), pa e ndryshuar.

interface R {
  tiId: number; studentId: number; emri: string; klasa: string | null; prindi: string; statusi: string;
  cmimiCents: number; ngaTimiCents: number; meDoreCents: number; paguarCents: number; mbetetCents: number; faza: string;
  fundit: { data: string; cents: number; burimi: string } | null; profatura: { numri: string; data: string; dite: number } | null; vemendje: string[];
}
interface T { id: number; data: string; shumaCents: number; brutoCents: number; komisionCents: number; referenca: string | null; prindi: string | null; statusi: string; stornuar: boolean; femijet: { studentId: number; emri: string; cents: number }[] }
const FAZA: Record<string, string> = { PROFATURE: "Profaturë", NE_PROCES: "Në proces", KRYER: "E kryer", PEZULLUAR: "Pezulluar", ANULUAR: "Anuluar" };
const e = (c: number) => Math.round(c) / 100;
const eur = (c: number) => formatCurrency(c / 100);
const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const sot = () => new Date().toISOString().slice(0, 10);
function shkarko(rows: Record<string, unknown>[], sheet: string, file: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  ws["!cols"] = Object.keys(rows[0] ?? {}).map(k => ({ wch: Math.max(10, Math.min(45, k.length + 6)) }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, sheet); XLSX.writeFile(wb, file);
}
const esc = (s: string) => s.replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

export default function RaportetPage() {
  const [viti, setViti] = useState(currentSchoolYearStart());
  const [rows, setRows] = useState<R[] | null>(null);
  const [tr, setTr] = useState<T[]>([]);
  const [prindi, setPrindi] = useState("");

  useEffect(() => {
    setRows(null);
    fetch(`/api/timi-invest/pasqyra?viti=${viti}`).then(r => r.json()).then(d => setRows((d.rreshtat ?? []).filter((x: R) => x.statusi === "ACTIVE")));
    fetch(`/api/timi-invest/transferet?viti=${viti}`).then(r => r.json()).then(d => setTr((d.transferet ?? []).filter((t: T) => t.statusi === "RUAJTUR" && !t.stornuar)));
  }, [viti]);

  const all = rows ?? [];
  const pritet = all.filter(r => r.mbetetCents > 0 && (r.faza === "PROFATURE" || r.faza === "NE_PROCES"));
  const prof30 = all.filter(r => r.vemendje.includes("PROFATURE_30"));
  const prinderit = useMemo(() => [...new Set(all.map(r => r.prindi).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [all]);
  const vlt = `${viti}–${String(viti + 1).slice(2)}`;

  function listaPerTimi() {
    shkarko(pritet.map(r => ({
      "Fëmija": r.emri, "Klasa": r.klasa ?? "", "Prindi": r.prindi, "Çmimi TIMI (€)": e(r.cmimiCents), "Paguar (€)": e(r.paguarCents), "Mbetet (€)": e(r.mbetetCents),
      "Faza": FAZA[r.faza] ?? r.faza, "Profatura e fundit": r.profatura ? `${r.profatura.numri} (${formatDate(r.profatura.data)})` : "",
      "Pagesa e fundit": r.fundit ? `${formatDate(r.fundit.data)} · ${e(r.fundit.cents)} €` : "",
    })), "Pritet nga TIMI", `TIMI-pritet-te-paguhet-${vlt}-${sot()}.xlsx`);
  }
  function profaturatHapura() {
    shkarko(prof30.map(r => ({ "Fëmija": r.emri, "Klasa": r.klasa ?? "", "Prindi": r.prindi, "Profatura": r.profatura?.numri ?? "", "Data": r.profatura ? formatDate(r.profatura.data) : "", "Ditë": r.profatura?.dite ?? "", "Çmimi (€)": e(r.cmimiCents) })),
      "Profatura > 30 ditë", `TIMI-profatura-te-hapura-${sot()}.xlsx`);
  }
  function transferet() {
    shkarko(tr.map(t => ({ "Data": formatDate(t.data), "Prindi": t.prindi ?? "", "Referenca": t.referenca ?? "", "Në bankë (€)": e(t.shumaCents), "Për fëmijët (€)": e(t.brutoCents), "Komisioni (€)": e(t.komisionCents), "Fëmijët": t.femijet.map(f => `${f.emri} ${e(f.cents)} €`).join("; ") })),
      "Transferet", `TIMI-transferet-${vlt}-${sot()}.xlsx`);
  }
  async function historiku() {
    const d = await fetch("/api/timi-invest/historiku?limit=1000").then(r => r.json());
    shkarko((d.rows ?? []).map((h: { createdAt: string; userName: string | null; action: string; emri: string | null; field: string | null; oldValue: string | null; newValue: string | null; reason: string | null }) => ({
      "Kur": new Date(h.createdAt).toLocaleString("sq-AL"), "Kush": h.userName ?? "", "Veprimi": h.action, "Fëmija": h.emri ?? "", "Fusha": h.field ?? "", "Para": h.oldValue ?? "", "Pas": h.newValue ?? "", "Arsyeja": h.reason ?? "",
    })), "Historiku", `TIMI-historiku-${sot()}.xlsx`);
  }

  // Gjendja për familjen — faqe për printim / ruajtje si PDF
  function gjendjaFamiljes() {
    const fem = all.filter(r => norm(r.prindi) === norm(prindi));
    if (!fem.length) return;
    const ids = new Set(fem.map(f => f.studentId));
    const pag = tr.filter(t => t.femijet.some(f => ids.has(f.studentId)));
    const sum = (k: "cmimiCents" | "paguarCents" | "mbetetCents") => fem.reduce((a, r) => a + r[k], 0);
    const html = `<!doctype html><html lang="sq"><head><meta charset="utf-8"><title>Gjendja — ${esc(prindi)}</title>
<style>body{font-family:Arial,sans-serif;color:#1e293b;margin:32px;font-size:13px}h1{font-size:18px;margin:0}h2{font-size:14px;margin:22px 0 6px}.s{color:#64748b;font-size:11px}
table{width:100%;border-collapse:collapse;margin-top:6px}th,td{border-bottom:1px solid #e2e8f0;padding:6px 4px;text-align:left}th{background:#f1f5f9;font-size:11px}.r{text-align:right}.t td{font-weight:bold;border-top:2px solid #94a3b8}
.k{color:#b45309;font-weight:bold;letter-spacing:1px;font-size:11px}@media print{body{margin:12mm}}</style></head><body>
<div class="k">AKADEMIA ORA · TIMI INVEST</div><h1>Gjendja e pagesave — ${esc(prindi)}</h1><div class="s">Viti shkollor ${vlt} · data ${formatDate(sot())}</div>
<h2>Fëmijët</h2><table><tr><th>Fëmija</th><th>Klasa</th><th class="r">Çmimi</th><th class="r">Paguar</th><th class="r">Mbetet</th><th>Faza</th></tr>
${fem.map(r => `<tr><td>${esc(r.emri)}</td><td>${esc(r.klasa ?? "")}</td><td class="r">${eur(r.cmimiCents)}</td><td class="r">${eur(r.paguarCents)}</td><td class="r">${eur(r.mbetetCents)}</td><td>${FAZA[r.faza] ?? r.faza}</td></tr>`).join("")}
<tr class="t"><td colspan="2">Gjithsej</td><td class="r">${eur(sum("cmimiCents"))}</td><td class="r">${eur(sum("paguarCents"))}</td><td class="r">${eur(sum("mbetetCents"))}</td><td></td></tr></table>
<h2>Pagesat nga TIMI</h2>${pag.length ? `<table><tr><th>Data</th><th>Referenca</th><th>Fëmijët</th><th class="r">Për fëmijët</th></tr>
${pag.map(t => `<tr><td>${formatDate(t.data)}</td><td>${esc(t.referenca ?? "—")}</td><td>${esc(t.femijet.filter(f => ids.has(f.studentId)).map(f => `${f.emri} ${eur(f.cents)}`).join(", "))}</td><td class="r">${eur(t.femijet.filter(f => ids.has(f.studentId)).reduce((a, f) => a + f.cents, 0))}</td></tr>`).join("")}</table>`
      : `<p class="s">S'ka pagesa të regjistruara përmes "Pagesat nga TIMI"${fem.some(f => f.meDoreCents > 0) ? " — pagesat e shënuara me dorë janë përfshirë te \"Paguar\" më lart" : ""}.</p>`}
<p class="s" style="margin-top:28px">Shumat "Paguar" përfshijnë të gjitha pagesat e shkollimit për ${vlt}. Dokument informues i gjeneruar nga Sistemi Ora.</p>
<script>window.onload=()=>window.print()</script></body></html>`;
    const w = window.open("", "_blank");
    if (!w) { alert("Lejoni dritaret e reja (pop-up) për këtë faqe."); return; }
    w.document.write(html); w.document.close();
  }

  function sms(list: R[], text: string) {
    const ids = [...new Set(list.map(r => r.studentId))];
    if (!ids.length) return;
    window.location.href = `/sms?students=${ids.join(",")}&text=${encodeURIComponent(text)}`;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="page-title">Raportet & eksportet</h1>
          <p className="text-xs text-slate-500">Të gjitha shifrat vijnë nga e njëjta llogaritje si Pasqyra. Asgjë s&apos;ndryshohet.</p>
        </div>
        <select value={viti} onChange={ev => setViti(Number(ev.target.value))} className="form-input !w-auto">
          {[currentSchoolYearStart() - 1, currentSchoolYearStart(), currentSchoolYearStart() + 1].map(y => <option key={y} value={y}>{y}–{String(y + 1).slice(2)}</option>)}
        </select>
      </div>
      {!rows ? <div className="card p-10 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-slate-400" /></div> : (
        <div className="grid md:grid-cols-2 gap-4">
          <Kartë t="Lista për TIMI — kush pritet të paguhet" p={`${pritet.length} fëmijë · mbetet ${eur(pritet.reduce((a, r) => a + r.mbetetCents, 0))} (Profaturë + Në proces)`}>
            <button onClick={listaPerTimi} disabled={!pritet.length} className="btn-primary"><Download className="w-4 h-4" />Excel</button>
          </Kartë>
          <Kartë t="Gjendja për familjen (PDF)" p={'Faqe për printim ose "Ruaj si PDF" për një prind: fëmijët, çmimet, pagesat nga TIMI, mbetja.'}>
            <select className="form-input" value={prindi} onChange={ev => setPrindi(ev.target.value)}>
              <option value="">Zgjidhni prindin…</option>
              {prinderit.map(p => <option key={p} value={p}>{p}</option>)}
            </select>
            <button onClick={gjendjaFamiljes} disabled={!prindi} className="btn-primary"><Printer className="w-4 h-4" />Printo / PDF</button>
          </Kartë>
          <Kartë t="Profaturat e hapura > 30 ditë" p={`${prof30.length} fëmijë me profaturë mbi 30 ditë pa asnjë pagesë.`}>
            <button onClick={profaturatHapura} disabled={!prof30.length} className="btn-primary"><Download className="w-4 h-4" />Excel</button>
            {prof30.length > 0 && <div className="text-xs text-slate-500 max-h-28 overflow-y-auto w-full">{prof30.map(r => <div key={r.tiId}>{r.emri} · {r.profatura?.numri} · {r.profatura?.dite} ditë</div>)}</div>}
          </Kartë>
          <Kartë t="Transferet nga TIMI" p={`${tr.length} transfere të ruajtura · ${eur(tr.reduce((a, t) => a + t.shumaCents, 0))} në bankë · komisioni ${eur(tr.reduce((a, t) => a + t.komisionCents, 0))}`}>
            <button onClick={transferet} disabled={!tr.length} className="btn-primary"><FileSpreadsheet className="w-4 h-4" />Excel</button>
          </Kartë>
          <Kartë t="Historiku i ndryshimeve (auditimi)" p="Kush, kur, çka ndryshoi dhe pse — çmimet, fazat, stornot, bashkimet, mbylljet e muajve.">
            <button onClick={historiku} className="btn-primary"><Download className="w-4 h-4" />Excel</button>
            <Link href="/timi-invest/historiku" className="btn-secondary">Shiko</Link>
          </Kartë>
          <Kartë t="Njoftime SMS (përmes modulit të SMS-ve)" p="Hap modulin e SMS-ve me prindërit e zgjedhur dhe një tekst të gatshëm — e kontrolloni dhe e dërgoni atje.">
            <button disabled={!prof30.length} onClick={() => sms(prof30, "I nderuar prind, profatura e TIMI Invest për shkollimin është ende e hapur. Ju lutemi kontaktoni TIMI Invest për përfundimin e procedurës. Faleminderit, Akademia Ora")} className="btn-secondary"><MessageSquare className="w-4 h-4" />Profaturat e hapura ({prof30.length})</button>
            <button disabled={!pritet.length} onClick={() => sms(pritet, "I nderuar prind, ju njoftojmë për gjendjen e pagesave të shkollimit përmes TIMI Invest. Për detaje kontaktoni administratën. Faleminderit, Akademia Ora")} className="btn-secondary"><MessageSquare className="w-4 h-4" />Me mbetje ({pritet.length})</button>
          </Kartë>
        </div>
      )}
    </div>
  );
}

function Kartë({ t, p, children }: { t: string; p: string; children: React.ReactNode }) {
  return (
    <div className="card p-4 space-y-3">
      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">{t}</h2>
        <p className="text-xs text-slate-500">{p}</p>
      </div>
      <div className="flex flex-wrap gap-2 items-start">{children}</div>
    </div>
  );
}
