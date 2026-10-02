import { prisma } from "./prisma";
import { DEFAULT_ACADEMIC_YEAR } from "./academicYear";
import { DEFAULT_CLASS_CAPACITY } from "./classCapacity";

/** Kapaciteti kur klasa s'e ka të vendosur — i njëjti rregull (25) si kontrolli
 *  i vendeve te aplikimi publik (shih classCapacity.ts). S'shkruhet në databazë. */
export const DEFAULT_CAPACITY = DEFAULT_CLASS_CAPACITY;

/** Viti akademik aktual (nga viti shkollor aktiv, p.sh. "2026-2027" → 2026). */
export async function currentAcademicYear(orgId: number): Promise<number> {
  const active = await prisma.schoolYear.findFirst({ where: { organizationId: orgId, active: true }, select: { label: true } });
  const m = active?.label.match(/(\d{4})/);
  return m ? parseInt(m[1]) : DEFAULT_ACADEMIC_YEAR;
}
