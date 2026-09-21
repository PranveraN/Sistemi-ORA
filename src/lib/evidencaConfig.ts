// Evidenca e regjistrimit — vlerësimi pedagogjik + pyetësori shëndetësor/
// logjistik. Shkalla e notimit (RATING) është fikse, sipas formularit të
// pedagogisë; kategoritë/pikat vetë janë të konfigurueshme (EvidencaCategory/
// EvidencaItem, shih prisma/schema.prisma).

export const RATING_SCALE = [
  { value: "5", label: "Shkëlqyeshëm" },
  { value: "4", label: "Shumë mirë" },
  { value: "3", label: "Mirë" },
  { value: "2", label: "Mjaftueshëm" },
] as const;

export const EVIDENCA_ITEM_TYPES = ["RATING", "YES_NO", "CHOICE", "TEXT", "TEXTAREA"] as const;
export type EvidencaItemType = (typeof EVIDENCA_ITEM_TYPES)[number];

export const EVIDENCA_ITEM_TYPE_LABELS: Record<EvidencaItemType, string> = {
  RATING: "Notë (5/4/3/2)",
  YES_NO: "Po / Jo",
  CHOICE: "Zgjedhje (opsione)",
  TEXT: "Tekst i shkurtër",
  TEXTAREA: "Tekst i gjatë",
};

export function specifyKey(itemId: number): string {
  return `${itemId}__specify`;
}
