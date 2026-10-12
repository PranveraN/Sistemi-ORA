import type { YearType } from "./academicYear";

// Ndërton filtrin muaj/vit për Expense (Shpenzime/Dorëzime, fusha janë numra
// të thjeshtë month/year, jo datë reale) — përdoret nga çdo vend që lexon
// këtë model (skeda "Shpenzime"/"Dorëzim Parash", "Pasqyra e Arkës",
// Dashboard-i), që numri të dalë GJITHMONË i njëjtë dhe i saktë, edhe për
// "Të gjitha muajt + Vit Akademik" (kapërcen dy vite kalendarike: Shtator–
// Dhjetor të `year`, Janar–Gusht të `year + 1`).
/**
 * Pamja "vit shkollor" (të gjithë muajt): rreshti me "Për vitin shkollor" (`academicYear`)
 * i takon atij viti, pavarësisht datës — p.sh. dorëzimi i gushtit me paratë e pagesave
 * të hershme të 2026–27. Pa të, vlen rregulli i datës/muajit. Muajt e veçantë ndjekin
 * gjithmonë datën reale.
 */
function withAcademicYear(year: number, byDate: Record<string, unknown>): Record<string, unknown> {
  return { OR: [{ academicYear: year }, { AND: [{ academicYear: null }, byDate] }] };
}

export function expensePeriodWhere(month: number, year: number, yearType: YearType): Record<string, unknown> {
  if (month > 0) {
    const where: Record<string, unknown> = { month };
    if (year > 0) where.year = year;
    return where;
  }
  if (year > 0) {
    if (yearType === "academic") {
      // `month: null` përfshihet gjithashtu — rreshta të vjetër, regjistruar
      // përpara se muaji/viti të rrjedhin gjithmonë nga vetë data (shih POST
      // /api/expenses), mund të kenë muaj bosh; "Të gjitha muajt" duhet t'i
      // përfshijë ende, jo t'i lërë përgjithmonë të padukshëm.
      return withAcademicYear(year, { OR: [
        { month: { gte: 9 }, year },
        { month: { lte: 8 }, year: year + 1 },
        { month: null, year },
        { month: null, year: year + 1 },
      ] });
    }
    return { year };
  }
  return {};
}

/**
 * Si expensePeriodWhere, por rreshtat pa muaj (month = null, të importuar dikur)
 * vendosen në periudhë sipas DATËS së tyre reale — jo sipas vitit të shkruar.
 * Me versionin e mësipërm, një dorëzim i janarit 2026 pa muaj numërohej
 * njëkohësisht te 2025–2026 DHE te 2026–2027 (dy herë). Përdoret për Shkollimin;
 * Ushqimi vazhdon me filtrin e vjetër (s'preket).
 */
export function expensePeriodWhereByDate(month: number, year: number, yearType: YearType): Record<string, unknown> {
  if (month > 0 && year > 0) {
    return { OR: [{ month, year }, { month: null, date: { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) } }] };
  }
  if (month > 0) return { month };
  if (year > 0) {
    if (yearType === "academic") {
      return withAcademicYear(year, { OR: [
        { month: { gte: 9 }, year },
        { month: { lte: 8 }, year: year + 1 },
        { month: null, date: { gte: new Date(year, 8, 1), lt: new Date(year + 1, 8, 1) } },
      ] });
    }
    return { OR: [{ month: { not: null }, year }, { month: null, date: { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) } }] };
  }
  return {};
}
