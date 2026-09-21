// Vlerësimi i mësuesve për një nxënës — etiketë fikse nga një listë e vogël,
// jo yje/numra, siç kërkoi stafi (më domethënëse për dikë që lexon më vonë).
export const STUDENT_RATINGS = [
  "I Shkëlqyer",
  "Mirë",
  "Mesatar",
  "Ka Vështirësi",
  "Për t'u Ndjekur",
] as const;

export type StudentRating = typeof STUDENT_RATINGS[number];

export const STUDENT_RATING_COLORS: Record<string, string> = {
  "I Shkëlqyer":     "bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400",
  "Mirë":            "bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400",
  "Mesatar":         "bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300",
  "Ka Vështirësi":   "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400",
  "Për t'u Ndjekur": "bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400",
};
