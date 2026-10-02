"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Header from "@/components/layout/Header";
import Link from "next/link";
import {
  ArrowRightLeft, UserPlus, Users, Search, Clock, ChevronRight, BarChart3,
} from "lucide-react";
import YearPicker from "@/components/dashboard/YearPicker";
import NewStudentsCard, { type NewStudentRow } from "@/components/dashboard/NewStudentsCard";
import DepartedStudentsCard, { type DepartedStudentRow } from "@/components/dashboard/DepartedStudentsCard";
import GradeOneCard from "@/components/dashboard/GradeOneCard";
import GradeNineLeaversCard, { type GradeNineLeaverRow } from "@/components/dashboard/GradeNineLeaversCard";
import ClassChangesCard, { type ClassChangeRow } from "@/components/dashboard/ClassChangesCard";
import { isGrade1 } from "@/lib/school-cycles";
import { ACADEMIC_YEARS, CALENDAR_YEARS, DEFAULT_ACADEMIC_YEAR, type YearType } from "@/lib/academicYear";

// Vetëm nxjerrim fushat që na duhen këtu nga /api/dashboard — e njëjta API si
// Dashboard-i, pa krijuar endpoint të dytë për të njëjtat të dhëna.
interface MovementsData {
  period: { year: number; yearType: YearType; label: string };
  activeStudents: number;
  newStudents: { count: number; students: NewStudentRow[] };
  departedStudents: { count: number; students: DepartedStudentRow[] };
}

export default function LevizjetPage() {
  const [yearType, setYearType] = useState<YearType>("academic");
  const [year, setYear] = useState(DEFAULT_ACADEMIC_YEAR);
  const [data, setData] = useState<MovementsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [grade9, setGrade9] = useState<{ count: number; entries: GradeNineLeaverRow[] }>({ count: 0, entries: [] });
  const [classChanges, setClassChanges] = useState<{ count: number; entries: ClassChangeRow[] }>({ count: 0, entries: [] });

  // Filtrim i thjeshtë — vetëm në pamje (client-side), periudha/viti vazhdon
  // ta kontrollojë selektori sipër (njësoj si Dashboard-i).
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "new" | "departed">("all");

  const years = yearType === "academic" ? ACADEMIC_YEARS : CALENDAR_YEARS;

  function switchYearType(yt: YearType) {
    setYearType(yt);
    const yrs = yt === "academic" ? ACADEMIC_YEARS : CALENDAR_YEARS;
    if (!yrs.includes(year)) setYear(yrs[yrs.length - 2] ?? yrs[0]);
  }

  const fetchData = useCallback(async () => {
    setLoading(true);
    const r = await fetch(`/api/dashboard?year=${year}&yearType=${yearType}`);
    const d = await r.json();
    setData(d);
    setLoading(false);
  }, [year, yearType]);

  const fetchGrade9 = useCallback(async () => {
    const r = await fetch(`/api/movements/grade9-leavers?year=${year}&yearType=${yearType}`);
    if (r.ok) setGrade9(await r.json());
  }, [year, yearType]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useEffect(() => { fetchGrade9(); }, [fetchGrade9]);

  // Ndërrimet e klasës (nga historiku i nxënësit)
  useEffect(() => {
    fetch(`/api/movements/class-changes?year=${year}&yearType=${yearType}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d) setClassChanges(d); })
      .catch(() => {});
  }, [year, yearType]);

  const classes = useMemo(() => {
    if (!data) return [];
    const set = new Set<string>();
    for (const s of data.newStudents.students) if (s.className) set.add(s.className);
    for (const s of data.departedStudents.students) if (s.className) set.add(s.className);
    return Array.from(set).sort();
  }, [data]);

  // Klasa e Parë del VETËM te karta e vet ("Klasa e Parë — Ardhje") dhe si
  // rresht i veçantë te "Bilanci i Detajuar" — këtu përjashtohet krejtësisht,
  // që të mos numërohet dy herë.
  const filteredNew = useMemo(() => {
    if (!data) return { count: 0, students: [] };
    const q = search.trim().toLowerCase();
    const students = data.newStudents.students.filter(s =>
      !isGrade1(s.className) &&
      (!q || `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)) &&
      (!classFilter || s.className === classFilter)
    );
    return { count: students.length, students };
  }, [data, search, classFilter]);

  // E pavarur nga filtrat e sipërm (kërkim/klasë) — gjithmonë "sa nga Nxënës
  // të Rinj janë Klasa e Parë", për tërë periudhën e zgjedhur.
  const gradeOne = useMemo(() => {
    if (!data) return { count: 0, students: [] };
    const students = data.newStudents.students.filter(s => isGrade1(s.className));
    return { count: students.length, students };
  }, [data]);

  const filteredDeparted = useMemo(() => {
    if (!data) return { count: 0, students: [] };
    const q = search.trim().toLowerCase();
    const students = data.departedStudents.students.filter(s =>
      (!q || `${s.firstName} ${s.lastName}`.toLowerCase().includes(q)) &&
      (!classFilter || s.className === classFilter)
    );
    return { count: students.length, students };
  }, [data, search, classFilter]);

  const filtersActive = search.trim() !== "" || classFilter !== "";

  if (loading && !data) return (
    <>
      <Header title="Lëvizjet e Nxënësve" />
      <div className="p-6 flex items-center justify-center h-96">
        <div className="flex flex-col items-center gap-3 text-slate-400">
          <svg className="animate-spin" width="32" height="32" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          <p className="text-sm">Duke ngarkuar...</p>
        </div>
      </div>
    </>
  );

  if (!data) return null;

  // Largimet përfshijnë edhe Klasën e 9 (të diplomuar) — jo vetëm nxënësit e
  // shënuar manualisht si "të larguar" nga klasat e tjera, përndryshe numri
  // këtu s'përputhej me "Totalin e Largimeve" te Bilanci i Detajuar më poshtë.
  const totalDeparted = data.departedStudents.count + grade9.count;
  const net = data.newStudents.count - totalDeparted;
  // Nxënës në fillim = aktualë − (regjistrime − largime) të kësaj periudhe —
  // vetëm identiteti aritmetik i kërkuar nga stafi, pa fushë/model të ri.
  const startCount = data.activeStudents - net;

  return (
    <>
      <Header title="Lëvizjet e Nxënësve" />
      <div className="p-4 sm:p-6 space-y-5 animate-fade-in">

        {/* Breadcrumb + periudha */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 text-sm text-slate-400">
            <Link href="/dashboard" className="hover:text-primary-600 hover:underline">Ballina</Link>
            <ChevronRight className="w-3.5 h-3.5" />
            <span className="text-slate-600 dark:text-slate-300 font-medium">Lëvizjet e Nxënësve</span>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center rounded-xl overflow-hidden border border-slate-200 dark:border-slate-600 text-sm font-medium">
              {([["calendar", "📅 Kalendarik"], ["academic", "🎓 Akademik"]] as [YearType, string][]).map(([yt, lbl]) => (
                <button key={yt} onClick={() => switchYearType(yt)}
                  className={`px-4 py-2 transition-colors ${yearType === yt ? "bg-primary-600 text-white" : "bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700"}`}>
                  {lbl}
                </button>
              ))}
            </div>
            <YearPicker years={years} year={year} yearType={yearType} onSelect={setYear} />
            {loading && <Clock className="w-4 h-4 text-slate-300 animate-spin" />}
          </div>
        </div>

        <div>
          <h1 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-primary-500" /> Lëvizjet e Nxënësve
          </h1>
          <p className="text-sm text-slate-400 mt-0.5">Regjistrime të reja, largime dhe transfere — {data.period.label}</p>
        </div>

        {/* Përmbledhje — vetëm nga të dhënat ekzistuese */}
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          <SummaryCard
            icon={UserPlus} color="blue" label="Regjistrime të Reja" value={data.newStudents.count}
            hint={`+${data.newStudents.count} këtë ${yearType === "academic" ? "vit shkollor" : "vit"}`}
            active={typeFilter === "new"} onClick={() => setTypeFilter(v => v === "new" ? "all" : "new")}
          />
          <SummaryCard
            icon={UserPlus} rotate color="red" label="Largime / Transfere" value={totalDeparted}
            hint={`-${totalDeparted} këtë ${yearType === "academic" ? "vit shkollor" : "vit"}`}
            active={typeFilter === "departed"} onClick={() => setTypeFilter(v => v === "departed" ? "all" : "departed")}
          />
          <SummaryCard
            icon={ArrowRightLeft} color={net >= 0 ? "green" : "amber"} label="Bilanci Neto"
            value={`${net > 0 ? "+" : ""}${net}`} hint="Ndryshimi i nxënësve"
          />
          <SummaryCard icon={Users} color="slate" label="Nxënës Aktivë" value={data.activeStudents} hint="Aktualisht në shkollë" />
        </div>

        {/* Filtrim i thjeshtë */}
        <div className="card p-3 flex flex-wrap items-center gap-2">
          <select
            className="form-input text-sm py-2 w-auto"
            value={classFilter}
            onChange={e => setClassFilter(e.target.value)}
            disabled={classes.length === 0}
          >
            <option value="">Klasa — të gjitha</option>
            {classes.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select
            className="form-input text-sm py-2 w-auto"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value as typeof typeFilter)}
          >
            <option value="all">Lloji i lëvizjes — të gjitha</option>
            <option value="new">Vetëm regjistrime</option>
            <option value="departed">Vetëm largime</option>
          </select>
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-300" />
            <input
              className="form-input pl-9 text-sm py-2"
              placeholder="Kërko nxënësin sipas emrit..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          {(filtersActive || typeFilter !== "all") && (
            <button
              onClick={() => { setSearch(""); setClassFilter(""); setTypeFilter("all"); }}
              className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 shrink-0"
            >
              Pastro filtrat
            </button>
          )}
        </div>

        {/* Listat — dy seksionet ekzistuese, të pandryshuara në logjikë */}
        <div className={`grid grid-cols-1 gap-4 ${typeFilter === "all" ? "lg:grid-cols-2" : ""}`}>
          {(typeFilter === "all" || typeFilter === "new") && (
            <NewStudentsCard
              data={filteredNew}
              activeStudents={data.activeStudents}
              period={data.period.label}
              onChanged={fetchData}
              emptyMessage={filtersActive ? "Asnjë përputhje me filtrat e zgjedhur." : undefined}
            />
          )}
          {(typeFilter === "all" || typeFilter === "departed") && (
            <DepartedStudentsCard
              data={filteredDeparted}
              period={data.period.label}
              onChanged={fetchData}
              emptyMessage={filtersActive ? "Asnjë përputhje me filtrat e zgjedhur." : undefined}
            />
          )}
        </div>

        {/* Detaje shtesë — Klasa e Parë (ardhje) dhe Klasa e 9 (shkuarje, listë manuale) */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <GradeOneCard data={gradeOne} period={data.period.label} onChanged={fetchData} />
          <GradeNineLeaversCard data={grade9} period={data.period.label} year={year} yearType={yearType} onChanged={fetchGrade9} />
        </div>

        {/* Ndërrime klase — zhvendosje mes klasave dhe kalimet e vitit */}
        <ClassChangesCard data={classChanges} period={data.period.label} />

        {/* Bilanci i detajuar — ndan ardhjet/largimet sipas kategorisë */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary-500" />
            <h2 className="section-title">Bilanci i Detajuar — {data.period.label}</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <p className="text-xs font-bold text-green-600 dark:text-green-400 uppercase tracking-wide mb-2">Ardhje</p>
              <div className="space-y-1.5">
                <BilanciRow label="Klasa e Parë" value={gradeOne.count} />
                <BilanciRow label="Nxënës të rinj nga klasat tjera" value={data.newStudents.count - gradeOne.count} />
                <BilanciRow label="Totali i Ardhjeve" value={data.newStudents.count} bold />
              </div>
            </div>
            <div>
              <p className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wide mb-2">Largime</p>
              <div className="space-y-1.5">
                <BilanciRow label="Klasa e 9 (të diplomuar)" value={grade9.count} />
                <BilanciRow label="Nxënës që kanë shkuar nga klasat tjera" value={data.departedStudents.count} />
                <BilanciRow label="Totali i Largimeve" value={totalDeparted} bold />
              </div>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <span className="text-sm font-semibold text-slate-700 dark:text-slate-200">Bilanci Neto (Ardhje − Largime)</span>
            <span className={`text-lg font-bold ${net >= 0 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
              {net > 0 ? "+" : ""}{net}
            </span>
          </div>
        </div>

        {/* Bilanci i nxënësve — vetëm identitet aritmetik nga të dhënat reale */}
        <div className="card p-5">
          <div className="flex items-center gap-2 mb-4">
            <BarChart3 className="w-4 h-4 text-primary-500" />
            <div>
              <h2 className="section-title">Bilanci i Nxënësve — {data.period.label}</h2>
              <p className="text-xs text-slate-400 mt-0.5">Verifikim aritmetik: sa nxënës kishte shkolla në fillim të periudhës dhe sa ka tani, bazuar te regjistrimet dhe largimet e sipërme.</p>
            </div>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-stretch gap-4 sm:gap-0 sm:divide-x divide-slate-100 dark:divide-slate-700">
            <BilanciCell label="Nxënës në Fillim" value={startCount} />
            <BilanciCell label="+ Regjistrime" value={data.newStudents.count} valueClass="text-green-600 dark:text-green-400" />
            <BilanciCell label="− Largime" value={totalDeparted} valueClass="text-red-600 dark:text-red-400" />
            <BilanciCell label="= Nxënës Aktualë" value={data.activeStudents} bold />
            <div className="flex-1 flex items-center sm:pl-5">
              <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${net >= 0 ? "bg-green-50 dark:bg-green-900/20" : "bg-amber-50 dark:bg-amber-900/20"}`}>
                <ArrowRightLeft className={`w-4 h-4 shrink-0 ${net >= 0 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`} />
                <div>
                  <p className={`text-sm font-bold leading-tight ${net >= 0 ? "text-green-600 dark:text-green-400" : "text-amber-600 dark:text-amber-400"}`}>
                    {net > 0 ? "+" : ""}{net} Ndryshimi Neto
                  </p>
                  <p className="text-[11px] text-slate-400">krahasuar me fillimin e {yearType === "academic" ? "vitit shkollor" : "vitit"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

function SummaryCard({ icon: Icon, color, label, value, hint, rotate, active, onClick }: {
  icon: typeof UserPlus;
  color: "blue" | "red" | "green" | "amber" | "slate";
  label: string;
  value: number | string;
  hint?: string;
  rotate?: boolean;
  active?: boolean;
  onClick?: () => void;
}) {
  const palette: Record<string, { bg: string; text: string }> = {
    blue:  { bg: "bg-blue-50 dark:bg-blue-900/30",   text: "text-blue-600 dark:text-blue-400" },
    red:   { bg: "bg-red-50 dark:bg-red-900/30",     text: "text-red-500 dark:text-red-400" },
    green: { bg: "bg-green-50 dark:bg-green-900/30", text: "text-green-600 dark:text-green-400" },
    amber: { bg: "bg-amber-50 dark:bg-amber-900/30", text: "text-amber-600 dark:text-amber-400" },
    slate: { bg: "bg-slate-100 dark:bg-slate-700",   text: "text-slate-500 dark:text-slate-300" },
  };
  const p = palette[color];
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={onClick}
      className={`card p-4 flex items-center gap-3 text-left w-full disabled:cursor-default ${
        onClick ? "cursor-pointer hover:ring-2 hover:ring-primary-200 dark:hover:ring-primary-800 transition-all" : ""
      } ${active ? "ring-2 ring-primary-300 dark:ring-primary-700" : ""}`}
    >
      <div className={`w-10 h-10 rounded-xl ${p.bg} flex items-center justify-center shrink-0`}>
        <Icon className={`w-5 h-5 ${p.text} ${rotate ? "rotate-180" : ""}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className={`text-xl font-bold leading-tight ${color === "green" || color === "amber" ? p.text : "text-slate-900 dark:text-white"}`}>{value}</p>
        <p className="text-xs text-slate-400 truncate">{label}</p>
        {hint && <p className="text-[11px] text-slate-400 mt-0.5 truncate">{hint}</p>}
      </div>
    </button>
  );
}

function BilanciCell({ label, value, valueClass, bold }: { label: string; value: number; valueClass?: string; bold?: boolean }) {
  return (
    <div className="flex-1 sm:px-5 first:sm:pl-0">
      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
      <p className={`font-bold ${bold ? "text-xl" : "text-lg"} ${valueClass ?? "text-slate-800 dark:text-white"}`}>{value}</p>
    </div>
  );
}

function BilanciRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <div className={`flex items-center justify-between text-sm ${bold ? "pt-1.5 border-t border-slate-100 dark:border-slate-700 font-bold text-slate-800 dark:text-white" : "text-slate-500 dark:text-slate-400"}`}>
      <span>{label}</span>
      <span className={bold ? "" : "font-semibold text-slate-700 dark:text-slate-200"}>{value}</span>
    </div>
  );
}
