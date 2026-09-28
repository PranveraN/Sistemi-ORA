import type { YearType } from "./academicYear";

// Ndërton filtrin muaj/vit për Expense (Shpenzime/Dorëzime, fusha janë numra
// të thjeshtë month/year, jo datë reale) — përdoret nga çdo vend që lexon
// këtë model (skeda "Shpenzime"/"Dorëzim Parash", "Pasqyra e Arkës",
// Dashboard-i), që numri të dalë GJITHMONË i njëjtë dhe i saktë, edhe për
// "Të gjitha muajt + Vit Akademik" (kapërcen dy vite kalendarike: Shtator–
// Dhjetor të `year`, Janar–Gusht të `year + 1`).
export function expensePeriodWhere(month: number, year: number, yearType: YearType): Record<string, unknown> {
  if (month > 0) {
    const where: Record<string, unknown> = { month };
    if (year > 0) where.year = year;
    return where;
  }
  if (year > 0) {
    if (yearType === "academic") {
      return { OR: [{ month: { gte: 9 }, year }, { month: { lte: 8 }, year: year + 1 }] };
    }
    return { year };
  }
  return {};
}
