// School cycles, derived from the class name's leading grade number
// (classes are named like "1A", "6B" — no schema field needed).
export type Cycle = "ulet" | "larte";

export const CYCLES: { value: Cycle; label: string; min: number; max: number }[] = [
  { value: "ulet",  label: "Cikli i Ulët (1-5)",  min: 1, max: 5 },
  { value: "larte", label: "Cikli i Lartë (6-9)", min: 6, max: 9 },
];

export function getCycle(className: string | null | undefined): Cycle | null {
  if (!className) return null;
  const num = parseInt(className, 10);
  if (isNaN(num)) return null;
  if (num >= 1 && num <= 5) return "ulet";
  if (num >= 6 && num <= 9) return "larte";
  return null;
}
