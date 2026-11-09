// Vitet shkollore të regjistruara (Cilësimet → Vitet Shkollore) — rregullat e përbashkëta
// për API-në, skriptet dhe ndërfaqen. Datat ruhen si mesnatë UTC e ditës.

/** Datat e parazgjedhura të vitit shkollor që fillon në `start`: 01.09.start – 31.08.start+1. */
export function defaultSchoolYearDates(start: number): { startDate: Date; endDate: Date } {
  return { startDate: new Date(Date.UTC(start, 8, 1)), endDate: new Date(Date.UTC(start + 1, 7, 31)) };
}

/** "2024-2025" → 2024 (ose null nëse etiketa s'është në formatin YYYY-YYYY). */
export function labelStartYear(label: string): number | null {
  const m = /^(\d{4})-(\d{4})$/.exec(label.trim());
  return m && +m[2] === +m[1] + 1 ? +m[1] : null;
}

/** "YYYY-MM-DD" → Date (UTC mesnatë) ose null. */
export function parseDay(v: unknown): Date | null {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(v)) return null;
  const d = new Date(`${v.slice(0, 10)}T00:00:00Z`);
  return isNaN(d.getTime()) ? null : d;
}

interface YearSpan { id?: number; label: string; startDate: Date | null; endDate: Date | null }

/**
 * Kontrollon datat e një viti: fillimi para mbarimit dhe asnjë mbivendosje me vitet e tjera.
 * Kthen mesazhin e gabimit (shqip) ose null nëse janë në rregull.
 */
export function validateYearDates(y: YearSpan, others: YearSpan[]): string | null {
  if (!y.startDate || !y.endDate) return "Data e fillimit dhe e mbarimit janë të detyrueshme.";
  if (y.startDate >= y.endDate) return "Data e fillimit duhet të jetë para datës së mbarimit.";
  const clash = others.find(o => o.id !== y.id && o.startDate && o.endDate && o.startDate <= y.endDate! && y.startDate! <= o.endDate);
  return clash ? `Datat mbivendosen me vitin "${clash.label}".` : null;
}
