export interface ClassLite {
  id: number;
  name: string;
  level: string;
}

export function parseGrade(level: string): number | null {
  const m = level.match(/(\d+)/);
  return m ? parseInt(m[1], 10) : null;
}

export function parseSection(name: string): string | null {
  const m = name.match(/^\d+([A-Za-z])$/);
  return m ? m[1].toUpperCase() : null;
}

export type ProposedOutcome = "PROMOTED" | "GRADUATED" | "MANUAL";

/** Propozon klasën e ardhshme për një klasë të dhënë, sipas rregullit grade+1 + i njëjti seksion. */
export function proposeNextClass(
  currentClass: ClassLite | null,
  allClasses: ClassLite[]
): { outcome: ProposedOutcome; targetClassId: number | null; targetClassName: string | null } {
  if (!currentClass) return { outcome: "MANUAL", targetClassId: null, targetClassName: null };

  const grade = parseGrade(currentClass.level);
  const section = parseSection(currentClass.name);
  if (grade === null || section === null) {
    return { outcome: "MANUAL", targetClassId: null, targetClassName: null };
  }

  const targetName = `${grade + 1}${section}`;
  const target = allClasses.find(c => c.name.toUpperCase() === targetName);
  if (!target) {
    return { outcome: "GRADUATED", targetClassId: null, targetClassName: null };
  }
  return { outcome: "PROMOTED", targetClassId: target.id, targetClassName: target.name };
}
