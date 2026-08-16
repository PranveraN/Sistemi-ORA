"use client";

import { useState, useEffect, useCallback } from "react";
import Header from "@/components/layout/Header";
import {
  BookOpen, Search, ChevronLeft, ChevronRight, Save,
  Printer, Loader2, RotateCw, Check, Users,
} from "lucide-react";
import { formatDate } from "@/lib/utils";

/* ─── Shared Types ────────────────────────────────────────── */
interface StudentBasic {
  id: number; firstName: string; lastName: string;
  diaryNumber: string | null;
  class: { name: string; level: string } | null;
}

interface LibriAmeRecord {
  id: number; firstName: string; lastName: string;
  birthDate: string | null; personalNumber: string | null;
  address: string | null; diaryNumber: string | null;
  fatherName: string | null; fatherProf: string | null;
  motherName: string | null; motherProf: string | null;
  class: { name: string; level: string } | null;
  libriAme: {
    vendiLindjes: string | null; shteti: string | null;
    shtetas: string | null; komuna: string | null;
    adresaPrindit: string | null;
    notat: string | null; levizjet: string | null;
    notatFillore: string | null; levizjetFillore: string | null;
  } | null;
}

/* ─── Kl.6-9 Types ────────────────────────────────────────── */
interface YearSum69 {
  viti: string; paralela: string; notaMesatare: string;
  sjellja: string; mungesaArs: string; mungesaPaars: string; kujdestari: string;
}
interface Grades69 {
  lende: { nr: number; emri: string; kl6: string; kl7: string; kl8: string; kl9: string }[];
  vitet: { kl6: YearSum69; kl7: YearSum69; kl8: YearSum69; kl9: YearSum69 };
  zgjedhore: { kl6: string; kl7: string; kl8: string; kl9: string };
}
interface Move69 {
  klasaParaprake: { vitiSh:string;klasa:string;nrKodit:string;drejtimi:string;emriShkolles:string;vendi:string;komuna:string;shteti:string };
  regjistrimi: { data:string;klasa:string;nrProtokollit:string;kodiShkolles:string;leshuar:string;nga:string };
  nderprerja: { data:string;klasa:string;shkak:string;shkolaRe:string;kodiShkRe:string;vendi:string;komuna:string;nrBazes:string;nga:string };
  organizimiProvimeve: string[]; lavdatat: string[]; avancimi: string[]; verejtje: string;
}

/* ─── Kl.1-5 Types ────────────────────────────────────────── */
interface YearSum15 {
  viti:string; paralela:string; notaMesatare:string; sjellja:string;
  nrProtokolit:string; mungesaArs:string; mungesaPaars:string;
  mesuesi:string; dataAfatit:string;
}
interface SubjectF {
  nr: number | null; emri: string; isHeader?: boolean;
  yr1:string; yr2:string; yr3:string; yr4:string; yr5:string;
}
interface Grades15 {
  lende: SubjectF[];
  vitet: { yr1:YearSum15; yr2:YearSum15; yr3:YearSum15; yr4:YearSum15; yr5:YearSum15 };
}
interface Move15 {
  klasaParaprake: { vitiSh:string;klasa:string;sukses:string;emriShkolles:string;nrKodit:string;vendi:string;komuna:string;shteti:string };
  regjistrimi: { data:string;klasa:string;nrProtokolit:string;kodiShkolles:string;leshuar:string;nga:string };
  nderprerja: { data:string;klasa:string;shkak:string;shkolaRe:string;kodiShkRe:string;vendi:string;komuna:string;nrBazes:string };
  levdatat: string; verejtje: string;
  deftese: { nrLA:string;nrProtokolit:string;nrRendor:string;kreuShF:string;me1:string;afati:string;dataPajisjes:string;me2:string;gazeta:string;here2:string;nenshkrim:string };
  sqarim: string;
}

/* ─── Defaults ────────────────────────────────────────────── */
const LENDET_69 = [
  "Gjuhë Shqipe dhe Letërsi","Anglisht","Gjuha e Dytë Ndërkombëtare",
  "Matematikë","Fizikë","Kimi","Biologji","Histori","Gjeografi",
  "Qytetari Demokratike","Edukatë Fizike, Sport dhe Shëndet",
  "Muzikë","Arte Figurative","TIK","Teknikë dhe Teknologji",
  "Edukatë Fetare","Lëndë Zgjedhore 1","Lëndë Zgjedhore 2",
];

function emptyYr69(): YearSum69 {
  return { viti:"",paralela:"",notaMesatare:"",sjellja:"",mungesaArs:"",mungesaPaars:"",kujdestari:"" };
}
function defaultGrades69(): Grades69 {
  return {
    lende: LENDET_69.map((emri,i) => ({ nr:i+1, emri, kl6:"",kl7:"",kl8:"",kl9:"" })),
    vitet: { kl6:emptyYr69(), kl7:emptyYr69(), kl8:emptyYr69(), kl9:emptyYr69() },
    zgjedhore: { kl6:"",kl7:"",kl8:"",kl9:"" },
  };
}
function defaultMove69(): Move69 {
  return {
    klasaParaprake:{vitiSh:"",klasa:"",nrKodit:"",drejtimi:"",emriShkolles:"",vendi:"",komuna:"",shteti:""},
    regjistrimi:{data:"",klasa:"",nrProtokollit:"",kodiShkolles:"",leshuar:"",nga:""},
    nderprerja:{data:"",klasa:"",shkak:"",shkolaRe:"",kodiShkRe:"",vendi:"",komuna:"",nrBazes:"",nga:""},
    organizimiProvimeve:["","","",""],lavdatat:["","","",""],avancimi:["","","",""],verejtje:"",
  };
}

const LENDE_FILLORE_DEFAULT: SubjectF[] = [
  { nr:null, emri:"GJUHËT DHE KOMUNIKIMI", isHeader:true, yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
  { nr:1, emri:"Gjuhë amtare", yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
  { nr:2, emri:"Gjuhë angleze", yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
  { nr:3, emri:"Gjuhë", yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
  { nr:null, emri:"ARTET", isHeader:true, yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
  { nr:4, emri:"Edukatë figurative", yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
  { nr:5, emri:"Edukatë muzikore", yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
  { nr:null, emri:"MATEMATIKË", isHeader:true, yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
  { nr:6, emri:"Matematikë", yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
  { nr:null, emri:"SHKENCAT E NATYRËS", isHeader:true, yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
  { nr:7, emri:"Njeriu dhe natyra", yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
  { nr:null, emri:"SHOQËRIA DHE MJEDISI", isHeader:true, yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
  { nr:8, emri:"Shoqëria dhe mjedisi", yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
  { nr:null, emri:"EDUKATA FIZIKE, SPORTET DHE SHËNDETI", isHeader:true, yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
  { nr:9, emri:"Edukata fizike, sportet dhe shëndeti", yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
  { nr:null, emri:"JETA DHE PUNA", isHeader:true, yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
  { nr:10, emri:"Shkathtësi për jetë", yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
  { nr:null, emri:"MËSIMI ME ZGJEDHJE", isHeader:true, yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
  { nr:11, emri:"", yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
  { nr:12, emri:"", yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
  { nr:13, emri:"", yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
  { nr:14, emri:"", yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
  { nr:null, emri:"PLANI INDIVIDUAL I ARSIMIT (PIA)", isHeader:true, yr1:"",yr2:"",yr3:"",yr4:"",yr5:"" },
];
function emptyYr15(): YearSum15 {
  return { viti:"",paralela:"",notaMesatare:"",sjellja:"",nrProtokolit:"",mungesaArs:"",mungesaPaars:"",mesuesi:"",dataAfatit:"" };
}
function defaultGrades15(): Grades15 {
  return {
    lende: LENDE_FILLORE_DEFAULT.map(l => ({ ...l })),
    vitet: { yr1:emptyYr15(), yr2:emptyYr15(), yr3:emptyYr15(), yr4:emptyYr15(), yr5:emptyYr15() },
  };
}
function defaultMove15(): Move15 {
  return {
    klasaParaprake:{vitiSh:"",klasa:"",sukses:"",emriShkolles:"",nrKodit:"",vendi:"",komuna:"",shteti:""},
    regjistrimi:{data:"",klasa:"",nrProtokolit:"",kodiShkolles:"",leshuar:"",nga:""},
    nderprerja:{data:"",klasa:"",shkak:"",shkolaRe:"",kodiShkRe:"",vendi:"",komuna:"",nrBazes:""},
    levdatat:"",verejtje:"",
    deftese:{nrLA:"",nrProtokolit:"",nrRendor:"",kreuShF:"",me1:"",afati:"",dataPajisjes:"",me2:"",gazeta:"",here2:"",nenshkrim:""},
    sqarim:"",
  };
}

/* ─── Inline field ────────────────────────────────────────── */
function Fld({ value, onChange, className="", placeholder="——", wide=false, center=false }:
  { value:string; onChange:(v:string)=>void; className?:string; placeholder?:string; wide?:boolean; center?:boolean }) {
  return (
    <input
      value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      className={`border-b border-slate-400 bg-transparent outline-none text-xs focus:border-slate-700 dark:focus:border-slate-300 dark:border-slate-500 placeholder:text-slate-300 dark:placeholder:text-slate-600 min-w-0 ${center?"text-center":""} ${wide?"w-full":""} ${className}`}
    />
  );
}

/* ═══════════════════════════════════════════════════════════ */
export default function LibriAmePage() {
  const [students, setStudents] = useState<StudentBasic[]>([]);
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [record, setRecord] = useState<LibriAmeRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isFlipped, setIsFlipped] = useState(false);
  const [bookType, setBookType] = useState<"fillore"|"mesme">("fillore");

  /* shared extra */
  const [extra, setExtra] = useState({ vendiLindjes:"",shteti:"",shtetas:"",komuna:"",adresaPrindit:"" });

  /* Kl.6-9 */
  const [grades69, setGrades69] = useState<Grades69>(defaultGrades69());
  const [move69, setMove69] = useState<Move69>(defaultMove69());

  /* Kl.1-5 */
  const [grades15, setGrades15] = useState<Grades15>(defaultGrades15());
  const [move15, setMove15] = useState<Move15>(defaultMove15());

  /* ── Load students */
  useEffect(() => {
    fetch("/api/students?limit=500")
      .then(r => r.json())
      .then(d => setStudents(Array.isArray(d) ? d : (d.students ?? [])));
  }, []);

  /* ── Fetch record */
  const fetchRecord = useCallback(async (id: number, fallback?: StudentBasic) => {
    setLoading(true);
    try {
      const r = await fetch(`/api/libri-ame/${id}`);
      if (r.ok) {
        const data: LibriAmeRecord = await r.json();
        setRecord(data);
        const la = data.libriAme;
        setExtra({
          vendiLindjes: la?.vendiLindjes || "",
          shteti: la?.shteti || "",
          shtetas: la?.shtetas || "",
          komuna: la?.komuna || "",
          adresaPrindit: la?.adresaPrindit || (data.address || ""),
        });
        setGrades69(la?.notat ? JSON.parse(la.notat) : defaultGrades69());
        setMove69(la?.levizjet ? JSON.parse(la.levizjet) : defaultMove69());
        setGrades15(la?.notatFillore ? JSON.parse(la.notatFillore) : defaultGrades15());
        setMove15(la?.levizjetFillore ? JSON.parse(la.levizjetFillore) : defaultMove15());
      } else {
        buildFallback(id, fallback);
      }
    } catch {
      buildFallback(id, fallback);
    }
    setLoading(false);
  }, []);

  function buildFallback(id: number, fb?: StudentBasic) {
    if (!fb) return;
    setRecord({ id:fb.id, firstName:fb.firstName, lastName:fb.lastName, birthDate:null, personalNumber:null, address:null, diaryNumber:fb.diaryNumber, fatherName:null, fatherProf:null, motherName:null, motherProf:null, class:fb.class, libriAme:null });
    setGrades69(defaultGrades69()); setMove69(defaultMove69());
    setGrades15(defaultGrades15()); setMove15(defaultMove15());
    setExtra({ vendiLindjes:"",shteti:"",shtetas:"",komuna:"",adresaPrindit:"" });
  }

  useEffect(() => {
    if (selectedId) {
      const fb = students.find(s => s.id === selectedId);
      fetchRecord(selectedId, fb);
    } else {
      setRecord(null);
    }
    setIsFlipped(false);
  }, [selectedId, fetchRecord, students]);

  /* ── Save */
  async function handleSave() {
    if (!selectedId) return;
    setSaving(true);
    await fetch(`/api/libri-ame/${selectedId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...extra, notat: grades69, levizjet: move69, notatFillore: grades15, levizjetFillore: move15 }),
    });
    setSaving(false); setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const filtered = students.filter(s =>
    `${s.firstName} ${s.lastName} ${s.diaryNumber||""}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <>
      <Header title="Libri Amë" />
      <div className="p-4 lg:p-6 max-w-7xl mx-auto animate-fade-in print:p-0">

        {/* Top bar */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5 print:hidden">
          {/* Book type toggle */}
          <div className="flex gap-1 p-1 bg-slate-100 dark:bg-slate-800 rounded-xl">
            <button
              onClick={() => { setBookType("fillore"); setIsFlipped(false); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${bookType==="fillore" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
            >
              Kl. 1–5 (Fillore)
            </button>
            <button
              onClick={() => { setBookType("mesme"); setIsFlipped(false); }}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${bookType==="mesme" ? "bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow-sm" : "text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"}`}
            >
              Kl. 6–9 (Mesme e Ulët)
            </button>
          </div>

          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Kërko nxënës..."
              className="form-input pl-9" />
          </div>

          {selectedId && (
            <div className="flex items-center gap-2 ml-auto">
              {saved && <span className="text-sm text-green-600 flex items-center gap-1"><Check className="w-4 h-4" /> Ruajtur</span>}
              <button onClick={() => window.print()} className="btn-secondary text-sm gap-1.5">
                <Printer className="w-4 h-4" /> Printo
              </button>
              <button onClick={handleSave} disabled={saving} className="btn-primary text-sm gap-1.5">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saving ? "Duke ruajtur..." : "Ruaj"}
              </button>
            </div>
          )}
        </div>

        <div className="flex flex-col lg:flex-row gap-5">
          {/* Student list */}
          <div className="w-full lg:w-64 flex-shrink-0 print:hidden">
            <div className="card overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-2">
                <Users className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Nxënësit</span>
                <span className="ml-auto text-xs text-slate-400">{filtered.length}</span>
              </div>
              <div className="overflow-y-auto max-h-[calc(100vh-220px)]">
                {filtered.map(s => (
                  <button key={s.id} onClick={() => setSelectedId(s.id)}
                    className={`w-full text-left px-4 py-2.5 flex items-center gap-2 transition-colors border-b border-slate-50 dark:border-slate-700/50 last:border-0 ${selectedId===s.id ? "bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-400" : "hover:bg-slate-50 dark:hover:bg-slate-800/30 text-slate-700 dark:text-slate-300"}`}>
                    <div className="w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-xs font-bold text-slate-500 dark:text-slate-400 flex-shrink-0">
                      {s.firstName[0]}{s.lastName[0]}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{s.firstName} {s.lastName}</p>
                      <p className="text-[10px] text-slate-400">{s.class?.name||"Pa klasë"}{s.diaryNumber&&<span className="ml-1">· Nr.{s.diaryNumber}</span>}</p>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Main */}
          <div className="flex-1 min-w-0">
            {!selectedId && (
              <div className="flex flex-col items-center justify-center py-24 text-slate-300 dark:text-slate-600">
                <BookOpen className="w-12 h-12 mb-3 opacity-50" />
                <p className="text-sm">Zgjidh një nxënës nga lista</p>
              </div>
            )}
            {selectedId && loading && (
              <div className="flex items-center justify-center py-24 text-slate-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" /> Duke ngarkuar...
              </div>
            )}
            {selectedId && !loading && record && (
              <div>
                {/* Controls */}
                <div className="flex items-center justify-between mb-4 print:hidden">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center text-xs font-bold text-amber-700 dark:text-amber-400">
                      {record.firstName[0]}{record.lastName[0]}
                    </div>
                    <span className="font-semibold text-slate-800 dark:text-white text-sm">{record.firstName} {record.lastName}</span>
                    {record.class && (
                      <span className="text-xs bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400 px-2 py-0.5 rounded-full">{record.class.name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-slate-400">{isFlipped ? "Faqja 2 — Lëvizja" : "Faqja 1 — Të dhënat"}</span>
                    <button onClick={() => setIsFlipped(v => !v)}
                      className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-medium transition-colors">
                      <RotateCw className="w-3.5 h-3.5" />
                      {isFlipped
                        ? <span className="flex items-center gap-0.5"><ChevronLeft className="w-3 h-3"/>Faqja 1</span>
                        : <span className="flex items-center gap-0.5">Faqja 2<ChevronRight className="w-3 h-3"/></span>
                      }
                    </button>
                  </div>
                </div>

                {/* Flip book */}
                <div style={{ perspective:"1400px" }}>
                  <div style={{
                    transformStyle:"preserve-3d",
                    transition:"transform 0.7s cubic-bezier(0.4,0,0.2,1)",
                    transform: isFlipped ? "rotateY(-180deg)" : "rotateY(0deg)",
                    position:"relative",
                    minHeight:"960px",
                  }}>
                    {/* FRONT */}
                    <div style={{ backfaceVisibility:"hidden", WebkitBackfaceVisibility:"hidden" }}
                      className="absolute inset-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-5 overflow-auto">
                      {bookType === "fillore"
                        ? <Page1Fillore record={record} extra={extra} setExtra={setExtra} grades={grades15} setGrades={setGrades15} />
                        : <Page1Mesme record={record} extra={extra} setExtra={setExtra} grades={grades69} setGrades={setGrades69} />
                      }
                    </div>
                    {/* BACK */}
                    <div style={{ backfaceVisibility:"hidden", WebkitBackfaceVisibility:"hidden", transform:"rotateY(180deg)" }}
                      className="absolute inset-0 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg p-5 overflow-auto">
                      {bookType === "fillore"
                        ? <Page2Fillore move={move15} setMove={setMove15} />
                        : <Page2Mesme move={move69} setMove={setMove69} />
                      }
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

/* ══════════════════════════════════════════════════════
   PAGE 1 — KL. 1-5 FILLORE
══════════════════════════════════════════════════════ */
function Page1Fillore({ record, extra, setExtra, grades, setGrades }: {
  record: LibriAmeRecord;
  extra: { vendiLindjes:string;shteti:string;shtetas:string;komuna:string;adresaPrindit:string };
  setExtra: React.Dispatch<React.SetStateAction<typeof extra>>;
  grades: Grades15; setGrades: React.Dispatch<React.SetStateAction<Grades15>>;
}) {
  const bd = record.birthDate ? formatDate(record.birthDate) : "";
  const ex = (k: keyof typeof extra) => extra[k];
  const setEx = (k: keyof typeof extra, v: string) => setExtra(p => ({ ...p, [k]: v }));

  const YRS: (keyof { yr1:string;yr2:string;yr3:string;yr4:string;yr5:string })[] = ["yr1","yr2","yr3","yr4","yr5"];

  function setCell(i: number, yr: typeof YRS[number], v: string) {
    setGrades(g => {
      const lende = [...g.lende];
      lende[i] = { ...lende[i], [yr]: v };
      return { ...g, lende };
    });
  }
  function setEmri(i: number, v: string) {
    setGrades(g => { const l=[...g.lende]; l[i]={...l[i],emri:v}; return {...g,lende:l}; });
  }
  function setYrF(yr: keyof Grades15["vitet"], k: keyof YearSum15, v: string) {
    setGrades(g => ({ ...g, vitet: { ...g.vitet, [yr]: { ...g.vitet[yr], [k]: v } } }));
  }

  return (
    <div className="font-serif text-slate-900 dark:text-slate-100" style={{ fontSize:"11px", lineHeight:1.5 }}>
      <h2 className="text-center font-bold text-sm mb-3 uppercase tracking-wide">Të Dhënat Për Nxënësin</h2>

      {/* Nr + Klasa */}
      <div className="flex justify-between mb-2">
        <div className="flex items-end gap-1">
          <span className="text-[10px]">Nr:</span>
          <Fld value={record.diaryNumber||""} onChange={()=>{}} className="w-16" />
        </div>
        <div className="flex items-end gap-1">
          <span className="text-[10px]">Klasa</span>
          <Fld value={record.class?.name||""} onChange={()=>{}} className="w-10" center />
          <span>/</span>
          <Fld value={""} onChange={()=>{}} className="w-12" />
        </div>
      </div>

      {/* Të dhënat për nxënësin */}
      <div className="border border-slate-300 dark:border-slate-600 rounded p-2 mb-2 space-y-1.5">
        <p className="font-bold text-[10px] text-slate-600 dark:text-slate-400 mb-1">Të dhënat për nxënësin</p>
        <div className="grid grid-cols-3 gap-2">
          <div><Fld value={`${record.firstName} ${record.lastName}`} onChange={()=>{}} wide /><p className="text-[9px] text-slate-400 text-center">(emri dhe mbiemri)</p></div>
          <div><Fld value={bd} onChange={()=>{}} wide center /><p className="text-[9px] text-slate-400 text-center">(data e lindjes)</p></div>
          <div><Fld value={ex("vendiLindjes")} onChange={v=>setEx("vendiLindjes",v)} wide center /><p className="text-[9px] text-slate-400 text-center">(vendi i lindjes)</p></div>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div><Fld value={ex("komuna")} onChange={v=>setEx("komuna",v)} wide center /><p className="text-[9px] text-slate-400 text-center">(komuna)</p></div>
          <div><Fld value={ex("shteti")} onChange={v=>setEx("shteti",v)} wide center /><p className="text-[9px] text-slate-400 text-center">(shteti)</p></div>
          <div><Fld value={ex("shtetas")} onChange={v=>setEx("shtetas",v)} wide center /><p className="text-[9px] text-slate-400 text-center">(shtetas)</p></div>
        </div>
      </div>

      {/* Të dhënat për prindërit */}
      <div className="border border-slate-300 dark:border-slate-600 rounded p-2 mb-3 space-y-1.5">
        <p className="font-bold text-[10px] text-slate-600 dark:text-slate-400 mb-1">Të dhënat për prindërit</p>
        <div className="grid grid-cols-2 gap-2">
          <div><Fld value={`${record.fatherName||""}${record.fatherProf?" — "+record.fatherProf:""}`} onChange={()=>{}} wide center /><p className="text-[9px] text-slate-400 text-center">(emri i babës dhe profesioni)</p></div>
          <div><Fld value={`${record.motherName||""}${record.motherProf?" — "+record.motherProf:""}`} onChange={()=>{}} wide center /><p className="text-[9px] text-slate-400 text-center">(emri i nënës dhe profesioni)</p></div>
        </div>
        <div><Fld value={ex("adresaPrindit")} onChange={v=>setEx("adresaPrindit",v)} wide center /><p className="text-[9px] text-slate-400 text-center">(Adresa e banimit të prindit - kujdestarit)</p></div>
      </div>

      {/* Grades table */}
      <h3 className="text-center font-bold text-xs mb-2 uppercase tracking-wide">Suksesi Sipas Klasave</h3>
      <div className="border border-slate-400 dark:border-slate-500 rounded overflow-hidden">
        <table className="w-full border-collapse" style={{ fontSize:"9px" }}>
          <thead>
            <tr className="border-b border-slate-400 dark:border-slate-500">
              <th colSpan={2} className="border-r border-slate-400 px-1 py-0.5">Viti shkollor</th>
              {YRS.map(yr => (
                <th key={yr} className="border-r border-slate-300 px-1 py-0.5 text-center">
                  <input value={grades.vitet[yr].viti} onChange={e=>setYrF(yr,"viti",e.target.value)}
                    className="w-14 border-b border-slate-400 bg-transparent outline-none text-center" placeholder="__/__" style={{fontSize:"8px"}} />
                </th>
              ))}
            </tr>
            <tr className="border-b border-slate-400 dark:border-slate-500 bg-slate-100 dark:bg-slate-800">
              <th className="border-r border-slate-400 px-1 py-0.5 text-center w-6">Nr.</th>
              <th className="border-r border-slate-400 px-1 py-0.5 font-bold">Klasa</th>
              {YRS.map((yr,i) => (
                <th key={yr} className="border-r border-slate-300 px-1 py-0.5 text-center font-bold">
                  <span>{i+1}/</span>
                  <input value={grades.vitet[yr].paralela} onChange={e=>setYrF(yr,"paralela",e.target.value)}
                    className="w-7 border-b border-slate-400 bg-transparent outline-none text-center" style={{fontSize:"8px"}} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grades.lende.map((row, i) => (
              row.isHeader ? (
                <tr key={i} className="border-b border-slate-300 dark:border-slate-600 bg-slate-200 dark:bg-slate-700">
                  <td colSpan={7} className="px-2 py-0.5 font-bold text-[9px] tracking-wide">{row.emri}</td>
                </tr>
              ) : (
                <tr key={i} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50/50 dark:hover:bg-slate-800/20">
                  <td className="border-r border-slate-300 px-1 py-0.5 text-center font-medium">{row.nr}</td>
                  <td className="border-r border-slate-300 px-1 py-0.5">
                    <input value={row.emri} onChange={e=>setEmri(i,e.target.value)}
                      className="w-full bg-transparent outline-none focus:bg-slate-50 dark:focus:bg-slate-800/30 rounded px-0.5" style={{fontSize:"9px"}} />
                  </td>
                  {YRS.map((yr,yi) => (
                    <td key={yr} className={`px-1 py-0.5 text-center border-r border-slate-200 dark:border-slate-700`}>
                      <input value={row[yr]} onChange={e=>setCell(i,yr,e.target.value)} maxLength={3}
                        className="w-full bg-transparent outline-none text-center focus:bg-amber-50 dark:focus:bg-amber-900/20 rounded" style={{fontSize:"9px"}} />
                    </td>
                  ))}
                </tr>
              )
            ))}

            {/* Summary rows */}
            {([
              { label:"Nota mesatare", field:"notaMesatare" as keyof YearSum15 },
              { label:"Sjellja",       field:"sjellja" as keyof YearSum15 },
              { label:"Nr. i protokollit", field:"nrProtokolit" as keyof YearSum15 },
            ]).map(row => (
              <tr key={row.field} className="border-b border-slate-200 dark:border-slate-700">
                <td colSpan={2} className="border-r border-slate-300 px-1 py-0.5 font-medium" style={{fontSize:"9px"}}>{row.label}</td>
                {YRS.map(yr => (
                  <td key={yr} className="border-r border-slate-200 px-1 py-0.5">
                    <input value={grades.vitet[yr][row.field]} onChange={e=>setYrF(yr,row.field,e.target.value)}
                      className="w-full bg-transparent outline-none text-center focus:bg-amber-50 dark:focus:bg-amber-900/20 rounded" style={{fontSize:"9px"}} />
                  </td>
                ))}
              </tr>
            ))}

            {/* Mungesat */}
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <td className="border-r border-slate-300 px-1 py-0.5 font-medium" style={{fontSize:"9px"}} rowSpan={2}>Mungesat</td>
              <td className="border-r border-slate-300 px-1 py-0.5 text-slate-500" style={{fontSize:"9px"}}>Të arsyeshme</td>
              {YRS.map(yr => (
                <td key={yr} className="border-r border-slate-200 px-1 py-0.5">
                  <input value={grades.vitet[yr].mungesaArs} onChange={e=>setYrF(yr,"mungesaArs",e.target.value)}
                    className="w-full bg-transparent outline-none text-center focus:bg-amber-50 dark:focus:bg-amber-900/20 rounded" style={{fontSize:"9px"}} />
                </td>
              ))}
            </tr>
            <tr className="border-b border-slate-200 dark:border-slate-700">
              <td className="border-r border-slate-300 px-1 py-0.5 text-slate-500" style={{fontSize:"9px"}}>Të paarsyeshme</td>
              {YRS.map(yr => (
                <td key={yr} className="border-r border-slate-200 px-1 py-0.5">
                  <input value={grades.vitet[yr].mungesaPaars} onChange={e=>setYrF(yr,"mungesaPaars",e.target.value)}
                    className="w-full bg-transparent outline-none text-center focus:bg-amber-50 dark:focus:bg-amber-900/20 rounded" style={{fontSize:"9px"}} />
                </td>
              ))}
            </tr>

            {([
              { label:"Mësuesi i klasës", field:"mesuesi" as keyof YearSum15 },
              { label:"Data - afati i mbarimit", field:"dataAfatit" as keyof YearSum15 },
            ]).map(row => (
              <tr key={row.field} className="border-b border-slate-200 dark:border-slate-700">
                <td colSpan={2} className="border-r border-slate-300 px-1 py-0.5 font-medium" style={{fontSize:"9px"}}>{row.label}</td>
                {YRS.map(yr => (
                  <td key={yr} className="border-r border-slate-200 px-1 py-0.5">
                    <input value={grades.vitet[yr][row.field]} onChange={e=>setYrF(yr,row.field,e.target.value)}
                      className="w-full bg-transparent outline-none text-center focus:bg-amber-50 dark:focus:bg-amber-900/20 rounded" style={{fontSize:"9px"}} />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-[9px]">
        <div className="flex items-end gap-1 flex-wrap">
          <span>Nxënësi e kreu shkollën fillore me</span>
          <Fld value="" onChange={()=>{}} className="w-16" placeholder="datë" />
          <span>në afatin</span>
          <Fld value="" onChange={()=>{}} className="w-20" />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   PAGE 2 — KL. 1-5 FILLORE
══════════════════════════════════════════════════════ */
function Page2Fillore({ move, setMove }: { move: Move15; setMove: React.Dispatch<React.SetStateAction<Move15>> }) {
  function setKP(k: keyof Move15["klasaParaprake"], v: string) {
    setMove(m => ({ ...m, klasaParaprake: { ...m.klasaParaprake, [k]: v } }));
  }
  function setReg(k: keyof Move15["regjistrimi"], v: string) {
    setMove(m => ({ ...m, regjistrimi: { ...m.regjistrimi, [k]: v } }));
  }
  function setNd(k: keyof Move15["nderprerja"], v: string) {
    setMove(m => ({ ...m, nderprerja: { ...m.nderprerja, [k]: v } }));
  }
  function setDef(k: keyof Move15["deftese"], v: string) {
    setMove(m => ({ ...m, deftese: { ...m.deftese, [k]: v } }));
  }

  return (
    <div className="font-serif text-slate-900 dark:text-slate-100 space-y-4" style={{ fontSize:"11px", lineHeight:1.6 }}>
      <h2 className="text-center font-bold text-sm tracking-wide">Lëvizja e Nxënësit</h2>

      {/* 1. Klasa paraprake */}
      <div>
        <p className="font-bold text-[11px] mb-1">1. Të dhënat për klasën paraprake</p>
        <div className="space-y-1">
          <div className="flex flex-wrap items-end gap-1">
            <span>Në vitin shkollor,</span>
            <Fld value={move.klasaParaprake.vitiSh} onChange={v=>setKP("vitiSh",v)} className="w-14" placeholder="__/__" />
            <span>nxënësi e ka mbaruar kl.</span>
            <Fld value={move.klasaParaprake.klasa} onChange={v=>setKP("klasa",v)} className="w-8" />
            <span>me sukses të</span>
            <Fld value={move.klasaParaprake.sukses} onChange={v=>setKP("sukses",v)} className="w-24" />
          </div>
          <div className="flex flex-wrap items-end gap-1">
            <span>Në shkollën</span>
            <Fld value={move.klasaParaprake.emriShkolles} onChange={v=>setKP("emriShkolles",v)} className="w-40" />
            <span>nr i kodit</span>
            <Fld value={move.klasaParaprake.nrKodit} onChange={v=>setKP("nrKodit",v)} className="w-14" />
          </div>
          <div className="flex flex-wrap items-end gap-1">
            <span>Vendi</span><Fld value={move.klasaParaprake.vendi} onChange={v=>setKP("vendi",v)} className="w-24" />
            <span>, Komuna</span><Fld value={move.klasaParaprake.komuna} onChange={v=>setKP("komuna",v)} className="w-24" />
            <span>, Shteti</span><Fld value={move.klasaParaprake.shteti} onChange={v=>setKP("shteti",v)} className="w-24" />
          </div>
        </div>
      </div>

      {/* 2. Regjistrimi */}
      <div>
        <p className="font-bold text-[11px] mb-1">2. Regjistrimi në këtë shkollë</p>
        <div className="space-y-1">
          <div className="flex flex-wrap items-end gap-1">
            <span>Më</span><Fld value={move.regjistrimi.data} onChange={v=>setReg("data",v)} className="w-22" />
            <span>nxënësi është regjistruar në klasën</span>
            <Fld value={move.regjistrimi.klasa} onChange={v=>setReg("klasa",v)} className="w-10" />
            <span>të kësaj shkolle në bazë të</span>
          </div>
          <div className="flex flex-wrap items-end gap-1">
            <span>dëftesës më numër të protokolit</span>
            <Fld value={move.regjistrimi.nrProtokolit} onChange={v=>setReg("nrProtokolit",v)} className="w-20" />
            <span>kodi i shkollës</span>
            <Fld value={move.regjistrimi.kodiShkolles} onChange={v=>setReg("kodiShkolles",v)} className="w-20" />
            <span>lëshuar më</span>
          </div>
          <div className="flex flex-wrap items-end gap-1">
            <Fld value={move.regjistrimi.leshuar} onChange={v=>setReg("leshuar",v)} className="w-24" />
            <span>, nga</span>
            <Fld value={move.regjistrimi.nga} onChange={v=>setReg("nga",v)} className="w-36" />
          </div>
        </div>
      </div>

      {/* 3. Ndërprerja */}
      <div>
        <p className="font-bold text-[11px] mb-1">3. Ndërprerja e mësimit</p>
        <div className="space-y-1">
          <div className="flex flex-wrap items-end gap-1">
            <span>Më</span><Fld value={move.nderprerja.data} onChange={v=>setNd("data",v)} className="w-22" />
            <span>nxënësi e ka ndërprerë mësimin në klasën e</span>
            <Fld value={move.nderprerja.klasa} onChange={v=>setNd("klasa",v)} className="w-8" />
            <span>për</span>
          </div>
          <div className="flex flex-wrap items-end gap-1">
            <span>shkak të</span><Fld value={move.nderprerja.shkak} onChange={v=>setNd("shkak",v)} wide className="flex-1" />
            <span>dhe</span>
          </div>
          <div className="flex flex-wrap items-end gap-1">
            <span>është regjistruar në shkollën</span>
            <Fld value={move.nderprerja.shkolaRe} onChange={v=>setNd("shkolaRe",v)} className="w-28" />
            <span>me kodin e shkollës</span>
            <Fld value={move.nderprerja.kodiShkRe} onChange={v=>setNd("kodiShkRe",v)} className="w-14" />
          </div>
          <div className="flex flex-wrap items-end gap-1">
            <span>Vendi</span><Fld value={move.nderprerja.vendi} onChange={v=>setNd("vendi",v)} className="w-20" />
            <span>Komuna</span><Fld value={move.nderprerja.komuna} onChange={v=>setNd("komuna",v)} className="w-20" />
            <span>në bazë të</span><Fld value={move.nderprerja.nrBazes} onChange={v=>setNd("nrBazes",v)} className="w-20" />
            <span>të lëshuar nga kjo shkollë.</span>
          </div>
        </div>
      </div>

      {/* Lëvdatat */}
      <div>
        <p className="font-bold text-[11px] mb-1">Lëvdatat \ Mirënjohjet</p>
        <div className="space-y-1">
          {[0,1,2].map(i => (
            <Fld key={i} value={move.levdatat.split("\n")[i]||""} wide
              onChange={v => setMove(m => { const rows=m.levdatat.split("\n"); rows[i]=v; return {...m,levdatat:rows.join("\n")}; })}
              placeholder="——————————————————————————" />
          ))}
        </div>
      </div>

      {/* Vërejtje */}
      <div>
        <p className="font-bold text-[11px] mb-1">Vërejtje</p>
        <div className="border border-slate-400 dark:border-slate-500 rounded p-2 min-h-[60px]">
          <textarea value={move.verejtje} onChange={e=>setMove(m=>({...m,verejtje:e.target.value}))}
            className="w-full bg-transparent outline-none resize-none text-[10px]" rows={3} placeholder="——" />
        </div>
      </div>

      {/* DËFTESË */}
      <div className="border-t-2 border-slate-400 dark:border-slate-500 pt-3">
        <h3 className="text-center font-bold text-sm tracking-wide uppercase mb-1">Dëftesë</h3>
        <p className="text-center text-[10px] text-slate-500 mb-2">për kryerjen e shkollës fillore</p>
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-end gap-1">
            <span>Numri i LA</span><Fld value={move.deftese.nrLA} onChange={v=>setDef("nrLA",v)} className="w-16" />
            <span>Numri i protokolit</span><Fld value={move.deftese.nrProtokolit} onChange={v=>setDef("nrProtokolit",v)} className="w-16" />
            <span>dhe numri rendor në LA</span><Fld value={move.deftese.nrRendor} onChange={v=>setDef("nrRendor",v)} className="w-16" />
          </div>
          <div className="flex flex-wrap items-end gap-1">
            <span>Kreu ShF</span>
            <Fld value={move.deftese.kreuShF} onChange={v=>setDef("kreuShF",v)} className="w-48" />
            <span>më</span>
            <Fld value={move.deftese.me1} onChange={v=>setDef("me1",v)} className="w-20" />
          </div>
          <div className="flex flex-wrap items-end gap-1">
            <span>Pajisет me dëftesë në afatin e</span>
            <Fld value={move.deftese.afati} onChange={v=>setDef("afati",v)} className="w-20" />
            <span>më</span>
            <Fld value={move.deftese.dataPajisjes} onChange={v=>setDef("dataPajisjes",v)} className="w-20" />
          </div>
          <div className="flex flex-wrap items-end gap-1">
            <span>I. Më</span><Fld value={move.deftese.me2} onChange={v=>setDef("me2",v)} className="w-20" />
            <span>dëftesa është shpallur e pavlefshme në gazetën</span>
            <Fld value={move.deftese.gazeta} onChange={v=>setDef("gazeta",v)} className="w-24" />
          </div>
          <div className="flex flex-wrap items-end gap-1">
            <span>dhe është lëshuar për herë të dytë më</span>
            <Fld value={move.deftese.here2} onChange={v=>setDef("here2",v)} className="w-24" />
            <span>nënshkrimi i marrësit</span>
            <Fld value={move.deftese.nenshkrim} onChange={v=>setDef("nenshkrim",v)} className="w-28" />
          </div>
        </div>
      </div>

      {/* Sqarim */}
      <div>
        <p className="font-bold text-[11px] mb-1">Sqarim</p>
        <div className="space-y-1">
          {[0,1,2].map(i => (
            <Fld key={i} value={move.sqarim.split("\n")[i]||""} wide
              onChange={v => setMove(m => { const rows=m.sqarim.split("\n"); rows[i]=v; return {...m,sqarim:rows.join("\n")}; })}
              placeholder="——" />
          ))}
        </div>
        <div className="mt-3 text-right">
          <p className="text-[10px]">Mësuesi/ja i/e klasës</p>
          <div className="w-32 border-b border-slate-400 ml-auto mt-4" />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   PAGE 1 — KL. 6-9 MESME
══════════════════════════════════════════════════════ */
function Page1Mesme({ record, extra, setExtra, grades, setGrades }: {
  record: LibriAmeRecord;
  extra: { vendiLindjes:string;shteti:string;shtetas:string;komuna:string;adresaPrindit:string };
  setExtra: React.Dispatch<React.SetStateAction<typeof extra>>;
  grades: Grades69; setGrades: React.Dispatch<React.SetStateAction<Grades69>>;
}) {
  const bd = record.birthDate ? formatDate(record.birthDate) : "";
  const ex = (k: keyof typeof extra) => extra[k];
  const setEx = (k: keyof typeof extra, v: string) => setExtra(p => ({ ...p, [k]: v }));
  const YRS: (keyof Grades69["vitet"])[] = ["kl6","kl7","kl8","kl9"];
  const KL = ["6","7","8","9"];

  function setCell(i:number, yr: keyof Grades69["vitet"], v:string) {
    setGrades(g => { const l=[...g.lende]; l[i]={...l[i],[yr]:v}; return {...g,lende:l}; });
  }
  function setEmri(i:number,v:string) {
    setGrades(g => { const l=[...g.lende]; l[i]={...l[i],emri:v}; return {...g,lende:l}; });
  }
  function setYr(yr: keyof Grades69["vitet"], k: keyof YearSum69, v:string) {
    setGrades(g => ({ ...g, vitet: { ...g.vitet, [yr]: { ...g.vitet[yr], [k]: v } } }));
  }
  function setZg(yr: keyof Grades69["zgjedhore"], v:string) {
    setGrades(g => ({ ...g, zgjedhore: { ...g.zgjedhore, [yr]: v } }));
  }

  return (
    <div className="font-serif text-slate-900 dark:text-slate-100" style={{ fontSize:"11px", lineHeight:1.5 }}>
      <h2 className="text-center font-bold text-sm mb-3 tracking-wide">Të dhënat për nxënësin</h2>

      <div className="flex justify-between mb-2">
        <div className="flex items-end gap-1"><span className="text-[10px]">Nr/</span><Fld value={record.diaryNumber||""} onChange={()=>{}} className="w-16" /></div>
        <div className="flex items-end gap-1"><span className="text-[10px]">Klasa</span><Fld value={record.class?.name||""} onChange={()=>{}} className="w-8" center /><span>/</span><Fld value="" onChange={()=>{}} className="w-16" /></div>
      </div>

      <div className="grid grid-cols-3 gap-2 mb-1">
        <div><Fld value={`${record.firstName} ${record.lastName}`} onChange={()=>{}} wide /><p className="text-[9px] text-slate-400 text-center">(emri i mbiemri)</p></div>
        <div><Fld value={bd} onChange={()=>{}} wide center /><p className="text-[9px] text-slate-400 text-center">(data e lindjes)</p></div>
        <div><Fld value={ex("vendiLindjes")} onChange={v=>setEx("vendiLindjes",v)} wide center /><p className="text-[9px] text-slate-400 text-center">(vendi i lindjes)</p></div>
      </div>
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div><Fld value={ex("komuna")} onChange={v=>setEx("komuna",v)} wide center /><p className="text-[9px] text-slate-400 text-center">(komuna)</p></div>
        <div><Fld value={ex("shteti")} onChange={v=>setEx("shteti",v)} wide center /><p className="text-[9px] text-slate-400 text-center">(shteti)</p></div>
        <div><Fld value={ex("shtetas")} onChange={v=>setEx("shtetas",v)} wide center /><p className="text-[9px] text-slate-400 text-center">(shtetas)</p></div>
      </div>

      <h2 className="text-center font-bold text-sm mb-2 border-t border-slate-200 dark:border-slate-600 pt-2">Të dhënat për prindërit</h2>
      <div className="grid grid-cols-2 gap-2 mb-1">
        <div><Fld value={`${record.fatherName||""}${record.fatherProf?" — "+record.fatherProf:""}`} onChange={()=>{}} wide center /><p className="text-[9px] text-slate-400 text-center">(emri i babës dhe profesioni)</p></div>
        <div><Fld value={`${record.motherName||""}${record.motherProf?" — "+record.motherProf:""}`} onChange={()=>{}} wide center /><p className="text-[9px] text-slate-400 text-center">(emri i nënës dhe profesioni)</p></div>
      </div>
      <div className="mb-3"><Fld value={ex("adresaPrindit")} onChange={v=>setEx("adresaPrindit",v)} wide center /><p className="text-[9px] text-slate-400 text-center">(Adresa e banimit të prindit-kujdestarit)</p></div>

      <p className="font-bold text-[11px] mb-2">Suksesi sipas klasave dhe viteve shkollore</p>

      <div className="border border-slate-400 dark:border-slate-500 rounded overflow-hidden">
        <table className="w-full border-collapse" style={{ fontSize:"9px" }}>
          <thead>
            <tr className="border-b border-slate-400 dark:border-slate-500">
              <th rowSpan={3} className="border-r border-slate-400 px-1 py-0.5 text-center w-7">Nr.</th>
              <th rowSpan={3} className="border-r border-slate-400 px-1 py-0.5 w-36">Lënda</th>
              <th colSpan={4} className="border-r border-slate-400 px-1 py-0.5">
                <div className="flex justify-around">
                  {YRS.map(yr => (
                    <input key={yr} value={grades.vitet[yr].viti} onChange={e=>setYr(yr,"viti",e.target.value)}
                      className="w-14 border-b border-slate-400 bg-transparent outline-none text-center" placeholder="__/__" style={{fontSize:"8px"}} />
                  ))}
                </div>
              </th>
              <th rowSpan={3} className="px-1 py-0.5 text-center w-20">Lëndët<br/>Zgjedhore</th>
            </tr>
            <tr className="border-b border-slate-400">
              <th colSpan={4} className="border-r border-slate-400 px-1 py-0.5 text-center font-normal" style={{fontSize:"8px"}}>Klasat dhe paralelet</th>
            </tr>
            <tr className="border-b border-slate-400 bg-slate-50 dark:bg-slate-800/50">
              {YRS.map((yr,i) => (
                <th key={yr} className="border-r border-slate-300 px-1 py-0.5 text-center font-bold">
                  {KL[i]}<input value={grades.vitet[yr].paralela} onChange={e=>setYr(yr,"paralela",e.target.value)}
                    className="w-6 border-b border-slate-400 bg-transparent outline-none text-center" style={{fontSize:"8px"}} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grades.lende.map((lenda,i) => (
              <tr key={i} className="border-b border-slate-200 dark:border-slate-700 hover:bg-slate-50/50">
                <td className="border-r border-slate-300 px-1 py-0.5 text-center font-medium">{lenda.nr}</td>
                <td className="border-r border-slate-300 px-1 py-0.5">
                  <input value={lenda.emri} onChange={e=>setEmri(i,e.target.value)}
                    className="w-full bg-transparent outline-none focus:bg-slate-50 dark:focus:bg-slate-800/30 rounded px-0.5" style={{fontSize:"9px"}} />
                </td>
                {YRS.map(yr => (
                  <td key={yr} className="border-r border-slate-200 px-1 py-0.5 text-center">
                    <input value={lenda[yr]} onChange={e=>setCell(i,yr,e.target.value)} maxLength={3}
                      className="w-full bg-transparent outline-none text-center focus:bg-amber-50 dark:focus:bg-amber-900/20 rounded" style={{fontSize:"9px"}} />
                  </td>
                ))}
                {i === 0 && (
                  <td rowSpan={grades.lende.length} className="border-l border-slate-300 px-1 py-1 align-top">
                    <div className="space-y-1">
                      {YRS.map((yr,yi) => (
                        <div key={yr} className="flex items-center gap-0.5">
                          <span className="text-[8px] text-slate-400">{KL[yi]}.</span>
                          <input value={grades.zgjedhore[yr]} onChange={e=>setZg(yr,e.target.value)}
                            className="flex-1 border-b border-slate-300 bg-transparent outline-none text-[8px]" />
                        </div>
                      ))}
                    </div>
                  </td>
                )}
              </tr>
            ))}

            {(["notaMesatare","sjellja"] as (keyof YearSum69)[]).map(field => (
              <tr key={field} className="border-b border-slate-200">
                <td colSpan={2} className="border-r border-slate-300 px-2 py-0.5 font-medium capitalize">{field==="notaMesatare"?"Nota mesatare":"Sjellja"}</td>
                {YRS.map(yr => (
                  <td key={yr} className="border-r border-slate-200 px-1 py-0.5">
                    <input value={String(grades.vitet[yr][field])} onChange={e=>setYr(yr,field,e.target.value)}
                      className="w-full bg-transparent outline-none text-center focus:bg-amber-50 rounded" style={{fontSize:"9px"}} />
                  </td>
                ))}
                <td />
              </tr>
            ))}

            <tr className="border-b border-slate-200">
              <td colSpan={2} rowSpan={2} className="border-r border-slate-300 px-2 py-0.5 font-medium">Mungesat</td>
              <td className="border-r border-slate-200 px-1 py-0.5 text-[8px] text-slate-500" colSpan={1}>Ars.</td>
              {YRS.map(yr => (<td key={yr} className="border-r border-slate-200 px-1 py-0.5">
                <input value={grades.vitet[yr].mungesaArs} onChange={e=>setYr(yr,"mungesaArs",e.target.value)}
                  className="w-full bg-transparent outline-none text-center focus:bg-amber-50 rounded" style={{fontSize:"9px"}} />
              </td>))}
              <td />
            </tr>
            <tr className="border-b border-slate-200">
              <td className="border-r border-slate-200 px-1 py-0.5 text-[8px] text-slate-500">Paars.</td>
              {YRS.map(yr => (<td key={yr} className="border-r border-slate-200 px-1 py-0.5">
                <input value={grades.vitet[yr].mungesaPaars} onChange={e=>setYr(yr,"mungesaPaars",e.target.value)}
                  className="w-full bg-transparent outline-none text-center focus:bg-amber-50 rounded" style={{fontSize:"9px"}} />
              </td>))}
              <td />
            </tr>
            <tr>
              <td colSpan={2} className="border-r border-slate-300 px-2 py-0.5 font-medium">Kujd. i klasës</td>
              {YRS.map(yr => (<td key={yr} className="border-r border-slate-200 px-1 py-0.5">
                <input value={grades.vitet[yr].kujdestari} onChange={e=>setYr(yr,"kujdestari",e.target.value)}
                  className="w-full bg-transparent outline-none focus:bg-amber-50 rounded" style={{fontSize:"9px"}} />
              </td>))}
              <td />
            </tr>
          </tbody>
        </table>
      </div>

      <div className="mt-2 text-[9px] space-y-1">
        <div className="flex flex-wrap items-end gap-1">
          <span>Nxënësi e kreu - nuk e kreu SHMU, me</span>
          <Fld value="" onChange={()=>{}} className="w-20" />
          <span>në afatin</span>
          <Fld value="" onChange={()=>{}} className="w-24" />
        </div>
        <div className="flex flex-wrap items-end gap-1">
          <span>Nota mesatare</span><Fld value="" onChange={()=>{}} className="w-14" />
          <span className="ml-3">Pikët nga testi kombëtar</span><Fld value="" onChange={()=>{}} className="w-18" />
        </div>
        <div className="flex flex-wrap items-end gap-1">
          <span>Data e lëshimit të dëftesës</span><Fld value="" onChange={()=>{}} className="w-20" />
          <span>numri i protokollit të dëftesës</span><Fld value="" onChange={()=>{}} className="w-24" />
        </div>
        <div className="text-right mt-3">
          <p className="text-[10px]">Kujdestari i klasës</p>
          <div className="w-32 border-b border-slate-400 ml-auto mt-4" />
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════
   PAGE 2 — KL. 6-9 MESME
══════════════════════════════════════════════════════ */
function Page2Mesme({ move, setMove }: { move: Move69; setMove: React.Dispatch<React.SetStateAction<Move69>> }) {
  function setKP(k: keyof Move69["klasaParaprake"], v: string) {
    setMove(m => ({ ...m, klasaParaprake: { ...m.klasaParaprake, [k]: v } }));
  }
  function setReg(k: keyof Move69["regjistrimi"], v: string) {
    setMove(m => ({ ...m, regjistrimi: { ...m.regjistrimi, [k]: v } }));
  }
  function setNd(k: keyof Move69["nderprerja"], v: string) {
    setMove(m => ({ ...m, nderprerja: { ...m.nderprerja, [k]: v } }));
  }
  function setArr(section: "organizimiProvimeve"|"lavdatat"|"avancimi", i: number, v: string) {
    setMove(m => { const a=[...(m[section] as string[])]; a[i]=v; return {...m,[section]:a}; });
  }

  function BoxLines({ lines, section }: { lines: string[]; section: "organizimiProvimeve"|"lavdatat"|"avancimi" }) {
    return (
      <div className="border border-slate-400 dark:border-slate-500 rounded p-2 space-y-1.5">
        {lines.map((l,i) => <Fld key={i} value={l} onChange={v=>setArr(section,i,v)} wide placeholder="———————————————" />)}
      </div>
    );
  }

  return (
    <div className="font-serif text-slate-900 dark:text-slate-100 space-y-4" style={{ fontSize:"11px", lineHeight:1.6 }}>
      <h2 className="text-center font-bold text-sm tracking-wide">Lëvizja e nxënësit</h2>

      <div>
        <p className="font-bold text-[11px] mb-1">1. Shënime për klasën paraprake</p>
        <div className="space-y-1">
          <div className="flex flex-wrap items-end gap-1">
            <span>Në vitin shkollor</span><Fld value={move.klasaParaprake.vitiSh} onChange={v=>setKP("vitiSh",v)} className="w-14" />
            <span>nxënësi e ka mbaruar klasën</span><Fld value={move.klasaParaprake.klasa} onChange={v=>setKP("klasa",v)} className="w-8" />
            <span>me sukses të</span><Fld value="" onChange={()=>{}} className="w-24" />
          </div>
          <div className="flex flex-wrap items-end gap-1">
            <span>në shkollën &ldquo;</span><Fld value={move.klasaParaprake.emriShkolles} onChange={v=>setKP("emriShkolles",v)} className="w-36" />
            <span>&rdquo; nr. i kodit</span><Fld value={move.klasaParaprake.nrKodit} onChange={v=>setKP("nrKodit",v)} className="w-14" />
            <span>, drejtimi</span><Fld value={move.klasaParaprake.drejtimi} onChange={v=>setKP("drejtimi",v)} className="w-20" />
          </div>
          <div className="flex flex-wrap items-end gap-1">
            <span>Vendi</span><Fld value={move.klasaParaprake.vendi} onChange={v=>setKP("vendi",v)} className="w-20" />
            <span>, Komuna</span><Fld value={move.klasaParaprake.komuna} onChange={v=>setKP("komuna",v)} className="w-20" />
            <span>, Shteti</span><Fld value={move.klasaParaprake.shteti} onChange={v=>setKP("shteti",v)} className="w-20" />
          </div>
        </div>
      </div>

      <div>
        <p className="font-bold text-[11px] mb-1">2. Regjistrimi në këtë shkollë</p>
        <div className="space-y-1">
          <div className="flex flex-wrap items-end gap-1">
            <span>Me</span><Fld value={move.regjistrimi.data} onChange={v=>setReg("data",v)} className="w-22" />
            <span>nxënësi është regjistruar në klasën</span><Fld value={move.regjistrimi.klasa} onChange={v=>setReg("klasa",v)} className="w-10" />
            <span>të kësaj shkolle në bazë</span>
          </div>
          <div className="flex flex-wrap items-end gap-1">
            <span>të dëftesës me numër të protokollit</span><Fld value={move.regjistrimi.nrProtokollit} onChange={v=>setReg("nrProtokollit",v)} className="w-20" />
            <span>kodi i shkollës</span><Fld value={move.regjistrimi.kodiShkolles} onChange={v=>setReg("kodiShkolles",v)} className="w-20" />
            <span>lëshuar</span>
          </div>
          <div className="flex flex-wrap items-end gap-1">
            <span>më</span><Fld value={move.regjistrimi.leshuar} onChange={v=>setReg("leshuar",v)} className="w-22" />
            <span>nga</span><Fld value={move.regjistrimi.nga} onChange={v=>setReg("nga",v)} className="w-36" />
          </div>
        </div>
      </div>

      <div>
        <p className="font-bold text-[11px] mb-1">3. Ndërprerja e mesimit</p>
        <div className="space-y-1">
          <div className="flex flex-wrap items-end gap-1">
            <span>Më</span><Fld value={move.nderprerja.data} onChange={v=>setNd("data",v)} className="w-22" />
            <span>nxënësi e ka ndërprerë mësimin në klasën e</span><Fld value={move.nderprerja.klasa} onChange={v=>setNd("klasa",v)} className="w-8" />
            <span>për</span>
          </div>
          <div className="flex flex-wrap items-end gap-1">
            <span>shkak të</span><Fld value={move.nderprerja.shkak} onChange={v=>setNd("shkak",v)} wide className="flex-1" />
          </div>
          <div className="flex flex-wrap items-end gap-1">
            <span>dhe është regjistruar në shkollen</span><Fld value={move.nderprerja.shkolaRe} onChange={v=>setNd("shkolaRe",v)} className="w-28" />
            <span>me kodin e shkollës</span><Fld value={move.nderprerja.kodiShkRe} onChange={v=>setNd("kodiShkRe",v)} className="w-14" />
            <span>vendi</span>
          </div>
          <div className="flex flex-wrap items-end gap-1">
            <Fld value={move.nderprerja.vendi} onChange={v=>setNd("vendi",v)} className="w-20" />
            <span>, komuna</span><Fld value={move.nderprerja.komuna} onChange={v=>setNd("komuna",v)} className="w-20" />
            <span>, në bazë të</span><Fld value={move.nderprerja.nrBazes} onChange={v=>setNd("nrBazes",v)} className="w-20" />
            <span>të lëshuar nga kjo shkollë.</span>
          </div>
        </div>
      </div>

      <div><p className="font-semibold text-[11px] mb-1">Organizimi i provimeve</p><BoxLines lines={move.organizimiProvimeve} section="organizimiProvimeve" /></div>
      <div><p className="font-semibold text-[11px] mb-1">Lavdatat</p><BoxLines lines={move.lavdatat} section="lavdatat" /></div>
      <div><p className="font-semibold text-[11px] mb-1">Avancimi i nxënësit</p><BoxLines lines={move.avancimi} section="avancimi" /></div>
      <div>
        <p className="font-semibold text-[11px] mb-1">Vërejtje</p>
        <div className="border border-slate-400 dark:border-slate-500 rounded p-2 min-h-[60px]">
          <textarea value={move.verejtje} onChange={e=>setMove(m=>({...m,verejtje:e.target.value}))}
            className="w-full bg-transparent outline-none resize-none text-[10px]" rows={3} placeholder="——" />
        </div>
      </div>
      <div className="text-right mt-3">
        <p className="text-[10px]">Kujdestari i klasës</p>
        <div className="w-32 border-b border-slate-400 ml-auto mt-4" />
      </div>
    </div>
  );
}
