export type YearType = "calendar" | "academic";

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

/** Vitet akademike të disponueshme */
export const ACADEMIC_YEARS = [2022, 2023, 2024, 2025, 2026];
/** Vitet kalendarike */
export const CALENDAR_YEARS = [2022, 2023, 2024, 2025, 2026, 2027];

/**
 * Viti akademik i parazgjedhur kur hapet faqja e pagesave — fiksuar manualisht,
 * NUK llogaritet nga data e sotme. Përditësohet vetëm dorazi (p.sh. në fillim
 * të vitit shkollor tjetër), përndryshe faqja do të "hidhej" vetvetiu te viti
 * tjetër çdo Gusht, duke fshehur pagesat e vitit aktual pa asnjë ndryshim manual.
 */
export const DEFAULT_ACADEMIC_YEAR = 2026;
