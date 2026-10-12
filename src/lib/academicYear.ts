export type YearType = "calendar" | "academic";

/**
 * Viti shkollor aktual për DOKUMENTET (vërtetime, kontrata, bexhe): nga gushti →
 * viti i ri (si te /api/school-years), janar–korrik → viti i kaluar. Llogaritet
 * nga data — kurrë i shkruar me dorë (defekt: vërtetimet dilnin "2025/2026" në tetor 2026).
 */
export function currentSchoolYearStart(d: Date = new Date()): number {
  const [y, m] = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Belgrade", year: "numeric", month: "2-digit" }).format(d).split("-").map(Number);
  return m >= 8 ? y : y - 1;
}
/** "2026/2027" (ose me ndarës tjetër, p.sh. "-" → "2026-2027"). */
export const schoolYearText = (start: number = currentSchoolYearStart(), sep = "/") => `${start}${sep}${start + 1}`;

export interface DateRange {
  start: Date;
  end:   Date;
  label: string;
}

/** Merr rangun e datave sipas llojit të vitit */
export function getDateRange(year: number, yearType: YearType): DateRange {
  if (yearType === "academic") {
    return {
      start: new Date(year, 8, 1),                    // 1 Shtator
      end:   new Date(year + 1, 7, 31, 23, 59, 59),   // 31 Gusht i vitit tjetër
      label: `${year}–${year + 1}`,
    };
  }
  return {
    start: new Date(year, 0, 1),
    end:   new Date(year, 11, 31, 23, 59, 59),
    label: String(year),
  };
}

/** 12 muajt e vitit akademik (Shtator → Gusht) me muajin kalendarik dhe vitin */
export function getAcademicMonths(startYear: number): { calMonth: number; calYear: number; label: string }[] {
  const months = [];
  for (let i = 0; i < 12; i++) {
    const calMonth = ((8 + i) % 12) + 1;  // 9,10,11,12,1,2,...,8
    const calYear  = i < 4 ? startYear : startYear + 1;
    const names = ["Janar","Shkurt","Mars","Prill","Maj","Qershor","Korrik","Gusht","Shtator","Tetor","Nëntor","Dhjetor"];
    months.push({ calMonth, calYear, label: `${names[calMonth - 1]} ${calYear}` });
  }
  return months;
}

/** Vitet akademike të disponueshme — që nga 2017, për të mbuluar edhe të dhëna historike */
// Nga 2017 deri te viti i ardhshëm — rritet vetë çdo vit (më parë listë fikse deri 2027).
export const ACADEMIC_YEARS = Array.from({ length: currentSchoolYearStart() + 2 - 2017 }, (_, i) => 2017 + i);
/** Vitet kalendarike */
export const CALENDAR_YEARS = Array.from({ length: new Date().getFullYear() + 2 - 2017 }, (_, i) => 2017 + i);

/**
 * Viti akademik i parazgjedhur kur hapet faqja e pagesave — fiksuar manualisht,
 * NUK llogaritet nga data e sotme. Përditësohet vetëm dorazi (p.sh. në fillim
 * të vitit shkollor tjetër), përndryshe faqja do të "hidhej" vetvetiu te viti
 * tjetër çdo Gusht, duke fshehur pagesat e vitit aktual pa asnjë ndryshim manual.
 */
export const DEFAULT_ACADEMIC_YEAR = 2026;
