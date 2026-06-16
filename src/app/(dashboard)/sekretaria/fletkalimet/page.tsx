"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Header from "@/components/layout/Header";
import {
  ClipboardCheck, FileText, Star, Search,
  ChevronLeft, ChevronRight, X, Printer,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────── */
interface Student {
  id: number;
  firstName: string;
  lastName: string;
  birthDate: string | null;
  personalNumber: string | null;
  class: { name: string; level: string } | null;
  diaryNumber: string | null;
}

const SUBJECTS = [
  "Gjuhë shqipe",
  "Gjuhë angleze",
  "Matematikë",
  "Biologji",
  "Fizikë",
  "Kimi",
  "Histori",
  "Gjeografi",
  "Edukatë qytetare",
  "Edukatë muzikore",
  "Art figurativ",
  "Teknologji me TIK",
  "Edukatë fizike dhe sportive",
  "Gjuhë gjermane",
];

const GRADE_COLS = ["vi", "vii", "viii", "x"] as const;
type GradeCol = typeof GRADE_COLS[number];
type Grades = Record<string, Record<GradeCol, string>>;

const emptyGrades = (): Grades => {
  const g: Grades = {};
  [...SUBJECTS, "mesimi_zgjedhor", "suksesi", "sjellja", "mungesat_a", "mungesat_pa"].forEach(s => {
    g[s] = { vi: "", vii: "", viii: "", x: "" };
  });
  return g;
};

interface FKData {
  nrProtokolit: string;
  nrProtokolPart2: string;
  data: string;
  emri: string;
  ditelindja: string;
  vendlindja: string;
  nrLibritAme: string;
  nrRendor: string;
  klasa: string;
  vitiShkollor: string;
  grades: Grades;
  // Raport Kthyes
  rNrFletekalimit: string;
  rData: string;
  rKlasa: string;
  rParalela: string;
  rDataHyrjes: string;
  rShkolla: string;
  rQyteti: string;
  rKomuna: string;
  rNrLibritAme: string;
  rKujdestar: string;
}

/* ─── Inline editable field ─────────────────────────────── */
function EF({ value, onChange, placeholder, width, style }: {
  value: string; onChange: (v: string) => void;
  placeholder?: string; width?: string; style?: React.CSSProperties;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        fontFamily: "inherit", fontSize: "inherit",
        background: value ? "transparent" : "#fffde7",
        border: "none", outline: "none", padding: "0 2px",
        borderBottom: "1px solid #999",
        width: width || "auto", minWidth: "30px",
        display: "inline-block",
        ...style,
      }}
    />
  );
}

/* ─── Grade cell ─────────────────────────────────────────── */
function GC({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      maxLength={3}
      style={{
        width: "100%", textAlign: "center", fontFamily: "inherit",
        fontSize: "9pt", background: "transparent",
        border: "none", outline: "none", padding: "1px",
      }}
    />
  );
}

/* ─── Main modal ─────────────────────────────────────────── */
function FletekalimCLModal({ student, onClose }: { student: Student; onClose: () => void }) {
  const today = new Date();
  const todayFmt = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;
  const fmtBirth = (iso: string | null) => {
    if (!iso) return "";
    try {
      const d = new Date(iso);
      return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
    } catch { return ""; }
  };

  const [d, setD] = useState<FKData>({
    nrProtokolit: "",
    nrProtokolPart2: "",
    data: todayFmt,
    emri: `${student.firstName} ${student.lastName}`,
    ditelindja: fmtBirth(student.birthDate),
    vendlindja: "",
    nrLibritAme: "",
    nrRendor: student.diaryNumber || "",
    klasa: student.class ? `${student.class.level} "${student.class.name}"` : "",
    vitiShkollor: `${today.getFullYear() - 1}/${today.getFullYear()}`,
    grades: emptyGrades(),
    rNrFletekalimit: "",
    rData: todayFmt,
    rKlasa: "",
    rParalela: "",
    rDataHyrjes: "",
    rShkolla: "",
    rQyteti: "",
    rKomuna: "",
    rNrLibritAme: "",
    rKujdestar: "",
  });

  const set = (k: keyof FKData) => (v: string) => setD(p => ({ ...p, [k]: v }));
  const setGrade = (subject: string, col: GradeCol, v: string) =>
    setD(p => ({ ...p, grades: { ...p.grades, [subject]: { ...p.grades[subject], [col]: v } } }));

  const backdropRef = useRef(false);

  const handlePrint = () => {
    // Sync React-controlled input values to DOM attributes before innerHTML capture
    ["fk-page1", "fk-page2"].forEach(id => {
      document.getElementById(id)?.querySelectorAll("input").forEach(inp => {
        (inp as HTMLInputElement).setAttribute("value", (inp as HTMLInputElement).value);
      });
    });
    const p1 = document.getElementById("fk-page1")?.innerHTML;
    const p2 = document.getElementById("fk-page2")?.innerHTML;
    if (!p1 || !p2) return;
    const w = window.open("", "_blank", "width=900,height=750");
    if (!w) return;
    const base = window.location.origin;
    w.document.open();
    w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<base href="${base}/">
<title>Fletëkalim — ${student.firstName} ${student.lastName}</title>
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Times New Roman', serif; font-size: 10pt; color: #000; background: #fff; }
  @page { size: A4 portrait; margin: 25mm 22mm 25mm 22mm; }
  input { border: none !important; border-bottom: 1px solid #000 !important; background: transparent !important;
    font-family: inherit; font-size: inherit; padding: 0 1px; outline: none; display: inline; min-width: 0; }
  table { border-collapse: collapse; width: 100%; }
  td, th { border: 1px solid #000; }
  .page { width: 100%; }
</style></head><body>
<div class="page" style="page-break-after:always">${p1}</div>
<div class="page">${p2}</div>
</body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 600);
  };

  /* shared header */
  const DocHeader = () => (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
      <img src="/logo.png" alt="" style={{ height: "55px", width: "auto" }} onError={e => { e.currentTarget.style.display = "none"; }} />
      <div style={{ textAlign: "center", lineHeight: "1.4", fontSize: "8.5pt", color: "#cc0000" }}>
        <div style={{ fontWeight: "bold" }}>Republika e Kosovës</div>
        <div style={{ fontWeight: "bold" }}>Komuna e Prishtinës</div>
        <div style={{ fontWeight: "bold" }}>SHFMU "AKADEMIA ORA"</div>
      </div>
      <img src="/stema.svg" alt="" style={{ height: "55px", width: "auto" }} onError={e => { e.currentTarget.style.display = "none"; }} />
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-start justify-center overflow-y-auto py-4"
      onMouseDown={e => { backdropRef.current = e.target === e.currentTarget; }}
      onClick={e => { if (backdropRef.current && e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-6xl mx-4">
        {/* Toolbar */}
        <div className="flex items-center justify-between px-6 py-3 border-b border-slate-200 dark:border-slate-700 sticky top-0 bg-white dark:bg-slate-900 rounded-t-2xl z-10">
          <h2 className="font-semibold text-slate-800 dark:text-white flex items-center gap-2 text-sm">
            <ClipboardCheck className="w-4 h-4 text-blue-500" />
            Fletëkalim CL — {student.firstName} {student.lastName}
          </h2>
          <div className="flex items-center gap-2">
            <button onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg">
              <Printer className="w-3.5 h-3.5" /> Print
            </button>
            <button onClick={onClose} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
              <X className="w-4 h-4 text-slate-500" />
            </button>
          </div>
        </div>

        {/* Print area */}
        <div className="p-6">
          <div style={{ maxWidth: "760px", margin: "0 auto" }}>
          {/* ══ SIDE 1: FLETËKALIM ══════════════════════════════════ */}
          <div id="fk-page1" style={{ fontFamily: "'Times New Roman', serif", color: "#000" }}>
            <DocHeader />
            <hr style={{ borderColor: "#000", marginBottom: "6px" }} />

            <div style={{ fontSize: "9pt", marginBottom: "2px" }}>
              Nr. Protokolit: <EF value={d.nrProtokolit} onChange={set("nrProtokolit")} width="40px" />
              /<EF value={d.nrProtokolPart2} onChange={set("nrProtokolPart2")} width="40px" />
            </div>
            <div style={{ fontSize: "9pt", marginBottom: "8px" }}>
              Data: <EF value={d.data} onChange={set("data")} placeholder="DD/MM/YYYY" width="90px" />
            </div>

            <p style={{ fontSize: "8.5pt", lineHeight: "1.5", marginBottom: "10px", textAlign: "justify" }}>
              Bazuar në Ligjin nr.04/L-032 për arsimin parauniversitar në Republikën e Kosovës, në Udhëzimin
              Administrativ nr 11/2019 për unifikimin dhe harmonizimin e dokumenteve administrative shkollore
              në arsimin parauniversitar, drejtori i shkollës lëshon këtë:
            </p>

            <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "13pt", marginBottom: "10px", textDecoration: "underline" }}>
              FLETËKALIM
            </div>

            <div style={{ fontSize: "9pt", lineHeight: "1.8" }}>
              <div>
                1. <EF value={d.emri} onChange={set("emri")} placeholder="Emri Mbiemri" width="170px" /> e lindur më{" "}
                <EF value={d.ditelindja} onChange={set("ditelindja")} placeholder="DD/MM/YYYY" width="90px" /> në{" "}
                <EF value={d.vendlindja} onChange={set("vendlindja")} placeholder="Vendlindja" width="120px" />
              </div>
              <div style={{ marginTop: "4px" }}>
                2. Nxënësi/ja në shkollë është evidentuar në librin amë me nr{" "}
                <EF value={d.nrLibritAme} onChange={set("nrLibritAme")} placeholder="nr" width="50px" /> në numrin rendor{" "}
                <EF value={d.nrRendor} onChange={set("nrRendor")} placeholder="nr" width="40px" /> në klasën e{" "}
                <EF value={d.klasa} onChange={set("klasa")} placeholder="klasës" width="80px" /> në vitin shkollor{" "}
                <EF value={d.vitiShkollor} onChange={set("vitiShkollor")} placeholder="2024/2025" width="80px" /> dhe tregoi suksesin si vijon:
              </div>
            </div>

            {/* Grades table */}
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "8.5pt", marginTop: "8px" }}>
              <thead>
                <tr>
                  <th style={{ border: "1px solid #000", padding: "3px", width: "30px", textAlign: "center" }}>NR</th>
                  <th style={{ border: "1px solid #000", padding: "3px" }}>Viti</th>
                  <th style={{ border: "1px solid #000", padding: "3px", width: "60px", textAlign: "center" }}>Klasa VI</th>
                  <th style={{ border: "1px solid #000", padding: "3px", width: "60px", textAlign: "center" }}>Klasa VII</th>
                  <th style={{ border: "1px solid #000", padding: "3px", width: "65px", textAlign: "center" }}>Klasa VIII</th>
                  <th style={{ border: "1px solid #000", padding: "3px", width: "60px", textAlign: "center" }}>Klasa X</th>
                </tr>
              </thead>
              <tbody>
                {SUBJECTS.map((subj, i) => (
                  <tr key={subj}>
                    <td style={{ border: "1px solid #000", textAlign: "center", padding: "1px" }}>{i + 1}</td>
                    <td style={{ border: "1px solid #000", padding: "1px 4px", textDecoration: "underline" }}>{subj}</td>
                    {GRADE_COLS.map(col => (
                      <td key={col} style={{ border: "1px solid #000", padding: "1px", textAlign: "center" }}>
                        <GC value={d.grades[subj][col]} onChange={v => setGrade(subj, col, v)} />
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Mësimi zgjedhor row with rotated label */}
                <tr>
                  <td colSpan={2} style={{ border: "1px solid #000", padding: "1px 4px" }}>
                    <span style={{ fontSize: "8pt", fontStyle: "italic" }}>Mësimi zgjedhor</span>
                  </td>
                  {GRADE_COLS.map(col => (
                    <td key={col} style={{ border: "1px solid #000", padding: "1px", textAlign: "center" }}>
                      <GC value={d.grades["mesimi_zgjedhor"][col]} onChange={v => setGrade("mesimi_zgjedhor", col, v)} />
                    </td>
                  ))}
                </tr>
                {/* Summary rows */}
                {[
                  ["suksesi", "Suksesi i përgjithshëm"],
                  ["sjellja", "Sjellja"],
                  ["mungesat_a", "Mungesat e arsyeshme"],
                  ["mungesat_pa", "Mungesat e paarsyeshme"],
                ].map(([key, label]) => (
                  <tr key={key}>
                    <td colSpan={2} style={{ border: "1px solid #000", padding: "1px 4px", textDecoration: "underline" }}>{label}</td>
                    {GRADE_COLS.map(col => (
                      <td key={col} style={{ border: "1px solid #000", padding: "1px", textAlign: "center" }}>
                        <GC value={d.grades[key][col]} onChange={v => setGrade(key, col, v)} />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Signatures */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "24px", fontSize: "9pt" }}>
              <div>
                <div style={{ fontWeight: "bold", textDecoration: "underline" }}>Kujdestari i klasës</div>
                <div style={{ borderBottom: "1px solid #000", width: "140px", marginTop: "20px" }}></div>
              </div>
              <div>
                <div style={{ fontWeight: "bold", textDecoration: "underline" }}>Drejtori i shkollës</div>
                <div style={{ borderBottom: "1px solid #000", width: "140px", marginTop: "20px" }}></div>
              </div>
            </div>
          </div>

          {/* ══ PAGE BREAK (screen only) ═══════════════════════════ */}
          <div style={{ borderTop: "2px dashed #ccc", margin: "32px 0" }}></div>

          {/* ══ SIDE 2: RAPORT KTHYES ════════════════════════════════ */}
          <div id="fk-page2" style={{ fontFamily: "'Times New Roman', serif", color: "#000" }}>
            <DocHeader />
            <hr style={{ borderColor: "#000", marginBottom: "20px" }} />

            <div style={{ textAlign: "center", fontWeight: "bold", fontSize: "13pt", marginBottom: "24px", textDecoration: "underline" }}>
              RAPORT KTHYES
            </div>

            <div style={{ fontSize: "9.5pt", lineHeight: "2.0" }}>
              <div>
                Nxënësi/ja <EF value={d.emri} onChange={set("emri")} width="160px" /> në bazë të fletëkalimit nr{" "}
                <EF value={d.rNrFletekalimit} onChange={set("rNrFletekalimit")} width="50px" /> të
              </div>
              <div style={{ marginTop: "4px" }}>
                datës <EF value={d.rData} onChange={set("rData")} placeholder="DD/MM/YYYY" width="90px" /> u regjistrua në klasën{" "}
                <EF value={d.rKlasa} onChange={set("rKlasa")} placeholder="VI" width="50px" /> në paralelen{" "}
                <EF value={d.rParalela} onChange={set("rParalela")} placeholder="A" width="40px" /> me
              </div>
              <div style={{ marginTop: "4px" }}>
                datën <EF value={d.rDataHyrjes} onChange={set("rDataHyrjes")} placeholder="DD/MM/YYYY" width="90px" /> në shkollën{" "}
                <EF value={d.rShkolla} onChange={set("rShkolla")} placeholder="Emri i shkollës" width="180px" />, në
              </div>
              <div style={{ marginTop: "4px" }}>
                <EF value={d.rQyteti} onChange={set("rQyteti")} placeholder="Qyteti" width="120px" />, komuna{" "}
                <EF value={d.rKomuna} onChange={set("rKomuna")} placeholder="Komuna" width="120px" />.
              </div>

              <div style={{ marginTop: "20px" }}>
                Nënësi/ja është regjistruar në Librin Amë nr{" "}
                <EF value={d.rNrLibritAme} onChange={set("rNrLibritAme")} placeholder="nr" width="160px" />.
              </div>

              <div style={{ marginTop: "12px" }}>
                Kujdestar klase i/e nxënësit do të jetë{" "}
                <EF value={d.rKujdestar} onChange={set("rKujdestar")} placeholder="Emri i kujdestarit" width="220px" />.
              </div>
            </div>

            {/* Signatures */}
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "60px", fontSize: "9pt" }}>
              <div>
                <div style={{ fontWeight: "bold", textDecoration: "underline" }}>Kujdestari i klasës</div>
                <div style={{ borderBottom: "1px solid #000", width: "140px", marginTop: "20px" }}></div>
              </div>
              <div>
                <div style={{ fontWeight: "bold", textDecoration: "underline" }}>Drejtori i shkollës</div>
                <div style={{ borderBottom: "1px solid #000", width: "140px", marginTop: "20px" }}></div>
              </div>
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Student list view ─────────────────────────────────── */
function StudentList({ docTitle, onSelect, onBack }: {
  docTitle: string;
  onSelect: (s: Student) => void;
  onBack: () => void;
}) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const limit = 25;

  const fetch_ = useCallback(async (q: string) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/students?search=${encodeURIComponent(q)}&status=ACTIVE&limit=200`);
      const data = await r.json();
      setStudents(data.students || []);
    } catch { setStudents([]); }
    setLoading(false);
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetch_(search), 300);
    return () => clearTimeout(t);
  }, [search, fetch_]);

  const totalPages = Math.ceil(students.length / limit);
  const paged = students.slice((page - 1) * limit, page * limit);

  return (
    <>
      <Header title={docTitle} backHref="#" />
      <div className="p-6 animate-fade-in">
        <div className="card p-4 mb-4 flex items-center gap-3">
          <button onClick={onBack} className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg">
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              className="input pl-9 w-full"
              placeholder="Kërko nxënës..."
              value={search}
              onChange={e => { setSearch(e.target.value); setPage(1); }}
            />
          </div>
        </div>

        <div className="card overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-500">#</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Emri</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Klasa</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Ditëlindja</th>
                <th className="text-right px-4 py-3 font-medium text-slate-500">Veprime</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={5} className="text-center py-12 text-slate-400">Duke ngarkuar...</td></tr>
              ) : paged.length === 0 ? (
                <tr><td colSpan={5} className="text-center py-12 text-slate-400">Nuk u gjet nxënës.</td></tr>
              ) : paged.map((s, i) => (
                <tr key={s.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 text-slate-400 text-xs">{(page - 1) * limit + i + 1}</td>
                  <td className="px-4 py-3 font-medium text-slate-800 dark:text-white">
                    {s.firstName} {s.lastName}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {s.class ? `${s.class.level} — ${s.class.name}` : "—"}
                  </td>
                  <td className="px-4 py-3 text-slate-500">
                    {s.birthDate ? new Date(s.birthDate).toLocaleDateString("sq-AL") : "—"}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onSelect(s)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-blue-50 hover:bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400 rounded-lg transition-colors"
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" /> Gjenero
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {totalPages > 1 && (
            <div className="px-4 py-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between">
              <span className="text-xs text-slate-400">{students.length} nxënës</span>
              <div className="flex items-center gap-1">
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="text-xs text-slate-500 px-2">{page}/{totalPages}</span>
                <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                  className="p-1.5 rounded hover:bg-slate-100 dark:hover:bg-slate-700 disabled:opacity-40">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

/* ─── Cards definition ──────────────────────────────────── */
const CARDS = [
  { id: "fletekalim-cl", label: "Fletëkalim CL", desc: "Fletëkalim për cikël të ulët (VI–X)", icon: ClipboardCheck, color: "text-blue-600 dark:text-blue-400", bg: "bg-blue-50 dark:bg-blue-900/30", ring: "hover:ring-blue-300 dark:hover:ring-blue-700", active: true },
  { id: "fletekalim-cu", label: "Fletëkalim CU", desc: "Fletëkalim për cikël të ulët të mesëm", icon: ClipboardCheck, color: "text-indigo-600 dark:text-indigo-400", bg: "bg-indigo-50 dark:bg-indigo-900/30", ring: "", active: false },
  { id: "pasyqre-notave-cl", label: "Pasqyrë e Notave CL", desc: "Pasqyrë e notave — cikël i ulët", icon: FileText, color: "text-teal-600 dark:text-teal-400", bg: "bg-teal-50 dark:bg-teal-900/30", ring: "", active: false },
  { id: "pasyqre-notave-cu", label: "Pasqyrë e Notave CU", desc: "Pasqyrë e notave — cikël i ulët i mesëm", icon: FileText, color: "text-cyan-600 dark:text-cyan-400", bg: "bg-cyan-50 dark:bg-cyan-900/30", ring: "", active: false },
  { id: "vertetim-nota-cl", label: "Vërtetim me Nota CL", desc: "Vërtetim zyrtar me nota — CL", icon: Star, color: "text-violet-600 dark:text-violet-400", bg: "bg-violet-50 dark:bg-violet-900/30", ring: "", active: false },
  { id: "vertetim-nota-cu", label: "Vërtetim me Nota CU", desc: "Vërtetim zyrtar me nota — CU", icon: Star, color: "text-rose-600 dark:text-rose-400", bg: "bg-rose-50 dark:bg-rose-900/30", ring: "", active: false },
];

/* ─── Page ──────────────────────────────────────────────── */
export default function FletkaliметPage() {
  const [activeDoc, setActiveDoc] = useState<string | null>(null);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);

  if (selectedStudent && activeDoc === "fletekalim-cl") {
    return (
      <>
        <Header title="Fletëkalimet" backHref="/sekretaria/fletkalimet" />
        <FletekalimCLModal student={selectedStudent} onClose={() => setSelectedStudent(null)} />
      </>
    );
  }

  if (activeDoc === "fletekalim-cl") {
    return (
      <StudentList
        docTitle="Fletëkalim CL — Zgjidh Nxënësin"
        onSelect={s => setSelectedStudent(s)}
        onBack={() => setActiveDoc(null)}
      />
    );
  }

  return (
    <>
      <Header title="Fletëkalimet" backHref="/sekretaria" />
      <div className="p-6 animate-fade-in">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {CARDS.map(c => (
            c.active ? (
              <button
                key={c.id}
                onClick={() => setActiveDoc(c.id)}
                className={`card p-5 flex items-start gap-4 hover:ring-2 ${c.ring} transition-all group text-left`}
              >
                <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
                  <c.icon className={`w-5 h-5 ${c.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-800 dark:text-white text-sm">{c.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5">{c.desc}</p>
                </div>
              </button>
            ) : (
              <div key={c.id} className="card p-5 flex items-start gap-4 opacity-40 cursor-not-allowed">
                <div className={`w-11 h-11 rounded-xl ${c.bg} flex items-center justify-center flex-shrink-0`}>
                  <c.icon className={`w-5 h-5 ${c.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-slate-500 dark:text-slate-400 text-sm">{c.label}</p>
                  <p className="text-xs text-slate-400 mt-0.5 italic">Template mungon</p>
                </div>
              </div>
            )
          ))}
        </div>
      </div>
    </>
  );
}
