import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma } from "./prisma";
import { DEFAULT_CLASS_CAPACITY } from "./classCapacity";
import { getGradeNumber } from "./school-cycles";

// Rregullat e Regjistrimeve — VENDI I VETËM: rregulli i evidencës, vonesa,
// kapaciteti, dyfishimet dhe historiku i statuseve.
//
// Rrjedha: PENDING ("Për shqyrtim") → EVIDENCA → APPROVED | REJECTED
//
// Gjendja e evidencës:
//   • IN_PROGRESS / DONE — fakte, RUHEN te aplikimi (rregulli s'i prek).
//   • REQUIRED / NOT_REQUIRED — për aplikimet e PA-pranuara LLOGARITEN çdo herë
//     nga rregulli aktual (evidencaState = null), ndaj ndryshimi i rregullit vlen
//     menjëherë për to. Në pranim gjendja ngrihet (ruhet) përgjithmonë.

export type EvidencaState = "REQUIRED" | "IN_PROGRESS" | "DONE" | "NOT_REQUIRED";

export const EVIDENCA_STATE_LABELS: Record<EvidencaState, string> = {
  REQUIRED: "E detyrueshme",
  IN_PROGRESS: "Në plotësim",
  DONE: "E plotësuar ✓",
  NOT_REQUIRED: "Nuk kërkohet",
};

export const REJECT_REASONS: { key: string; label: string }[] = [
  { key: "NO_SEATS",    label: "Nuk ka vende të lira" },
  { key: "DOCUMENTS",   label: "Dokumente të paplotësuara" },
  { key: "AGE",         label: "Mosha nuk përputhet me klasën" },
  { key: "WITHDRAWN",   label: "Prindi e tërhoqi aplikimin" },
  { key: "DUPLICATE",   label: "Aplikim i dyfishtë" },
  { key: "OTHER",       label: "Tjetër" },
];

export const ENROLLMENT_SETTING_KEYS = {
  evidencaGrade1: "enrollmentEvidencaGrade1",
  evidencaOther: "enrollmentEvidencaOtherGrades",
  delayDays: "enrollmentDelayDays",
  open: "enrollmentOpen",
} as const;

export interface EnrollmentRules {
  evidencaGrade1: boolean;
  evidencaOtherGrades: boolean;
  delayDays: number;
  enrollmentOpen: boolean;
}

export async function getEnrollmentRules(db: Pick<PrismaClient, "setting"> = prisma): Promise<EnrollmentRules> {
  const rows = await db.setting.findMany({ where: { key: { in: Object.values(ENROLLMENT_SETTING_KEYS) } } });
  const v = (k: string) => rows.find(r => r.key === k)?.value;
  const days = parseInt(v(ENROLLMENT_SETTING_KEYS.delayDays) ?? "");
  return {
    evidencaGrade1: (v(ENROLLMENT_SETTING_KEYS.evidencaGrade1) ?? "true") !== "false",
    evidencaOtherGrades: (v(ENROLLMENT_SETTING_KEYS.evidencaOther) ?? "false") === "true",
    delayDays: Number.isFinite(days) && days > 0 ? days : 10,
    enrollmentOpen: (v(ENROLLMENT_SETTING_KEYS.open) ?? "true") !== "false",
  };
}

export function evidencaRequired(grade: number | null | undefined, rules: EnrollmentRules): boolean {
  return grade === 1 ? rules.evidencaGrade1 : rules.evidencaOtherGrades;
}

/** Gjendja efektive e evidencës për një aplikim. */
export function effectiveEvidencaState(
  app: { evidencaState: string | null; desiredGrade: number | null },
  rules: EnrollmentRules,
): EvidencaState {
  if (app.evidencaState === "IN_PROGRESS" || app.evidencaState === "DONE") return app.evidencaState;
  if (app.evidencaState === "REQUIRED" || app.evidencaState === "NOT_REQUIRED") return app.evidencaState; // e ngrirë në pranim
  return evidencaRequired(app.desiredGrade, rules) ? "REQUIRED" : "NOT_REQUIRED";
}

/** A lejohet pranimi sipas evidencës? (kontrolli real bëhet këtu, në backend) */
export function evidencaAllowsApproval(state: EvidencaState): boolean {
  return state === "DONE" || state === "NOT_REQUIRED";
}

/* ─────────────── Kapaciteti (i njëjti rregull si moduli Klasat) ─────────────── */

export interface ClassSeat {
  id: number; name: string; grade: number | null; active: boolean;
  capacity: number; students: number; free: number;
}

/** Vendet e lira për çdo klasë — kapaciteti (25 kur s'është vendosur) − nxënësit aktivë. */
export async function getClassSeats(orgId: number, db: Pick<PrismaClient, "class" | "student"> = prisma): Promise<ClassSeat[]> {
  const [classes, counts] = await Promise.all([
    db.class.findMany({ where: { organizationId: orgId }, select: { id: true, name: true, capacity: true, active: true } }),
    db.student.groupBy({ by: ["classId"], where: { organizationId: orgId, status: "ACTIVE", classId: { not: null } }, _count: { _all: true } }),
  ]);
  const byClass = new Map(counts.map(c => [c.classId as number, c._count._all]));
  return classes.map(c => {
    const capacity = c.capacity ?? DEFAULT_CLASS_CAPACITY;
    const students = byClass.get(c.id) ?? 0;
    return { id: c.id, name: c.name, grade: getGradeNumber(c.name), active: c.active, capacity, students, free: capacity - students };
  });
}

/** Vendet e lira për një nivel (shuma e paraleleve aktive). */
export function gradeSeats(seats: ClassSeat[], grade: number | null): { free: number; capacity: number; classes: ClassSeat[] } | null {
  if (grade == null) return null;
  const classes = seats.filter(s => s.active && s.grade === grade);
  if (!classes.length) return null;
  return { free: classes.reduce((s, c) => s + c.free, 0), capacity: classes.reduce((s, c) => s + c.capacity, 0), classes };
}

/* ─────────────── Historiku i statuseve ─────────────── */

type Tx = Pick<PrismaClient, "applicationStatusHistory"> | Prisma.TransactionClient;

export async function recordApplicationStatus(
  db: Tx, session: unknown,
  applicationId: number, fromStatus: string | null, toStatus: string, note?: string | null,
): Promise<void> {
  const u = (session as { user?: { id?: string; name?: string | null } } | null)?.user;
  const userId = parseInt(u?.id ?? "0");
  await db.applicationStatusHistory.create({
    data: { applicationId, fromStatus, toStatus, userId: userId > 0 ? userId : null, userName: u?.name ?? null, note: note ?? null },
  });
}

/* ─────────────── Dyfishimet ─────────────── */

const norm = (s: string | null | undefined) =>
  (s ?? "").toLowerCase().replace(/ë/g, "e").replace(/ç/g, "c").replace(/\s+/g, " ").trim();
const dayKey = (d: Date | null | undefined) => (d ? new Date(d).toISOString().slice(0, 10) : "");

export interface DuplicateInfo {
  duplicateOf: { id: number; referenceNumber: string | null; status: string } | null;
  existingStudent: { id: number; name: string; className: string | null } | null;
}

/** Për një listë aplikimesh: a ka aplikim tjetër për të njëjtin fëmijë, ose nxënës aktiv? */
export async function findDuplicates(
  orgId: number,
  apps: { id: number; firstName: string; lastName: string; birthDate: Date | null; personalNumber: string | null }[],
): Promise<Map<number, DuplicateInfo>> {
  const out = new Map<number, DuplicateInfo>();
  if (!apps.length) return out;
  const [others, students] = await Promise.all([
    prisma.enrollmentApplication.findMany({
      where: { organizationId: orgId, status: { not: "DRAFT" } },
      select: { id: true, firstName: true, lastName: true, birthDate: true, personalNumber: true, referenceNumber: true, status: true, createdStudentId: true },
    }),
    prisma.student.findMany({
      where: { organizationId: orgId, status: "ACTIVE" },
      select: { id: true, firstName: true, lastName: true, birthDate: true, personalNumber: true, class: { select: { name: true } } },
    }),
  ]);
  const keyOf = (x: { firstName: string; lastName: string; birthDate: Date | null }) =>
    x.birthDate ? `${norm(x.firstName)}|${norm(x.lastName)}|${dayKey(x.birthDate)}` : "";
  for (const a of apps) {
    const k = keyOf(a);
    const pn = norm(a.personalNumber);
    const dup = others.find(o => o.id !== a.id && ((k && keyOf(o) === k) || (pn && norm(o.personalNumber) === pn)));
    // Nxënësi i krijuar nga VETË ky aplikim s'llogaritet si "tashmë nxënës"
    const self = others.find(o => o.id === a.id);
    const st = students.find(s => s.id !== self?.createdStudentId && ((k && keyOf(s) === k) || (pn && norm(s.personalNumber) === pn)));
    out.set(a.id, {
      duplicateOf: dup ? { id: dup.id, referenceNumber: dup.referenceNumber, status: dup.status } : null,
      existingStudent: st ? { id: st.id, name: `${st.firstName} ${st.lastName}`, className: st.class?.name ?? null } : null,
    });
  }
  return out;
}

/* ─────────────── Familja ekzistuese ─────────────── */

const phoneKey = (raw: string | null | undefined) => {
  let d = (raw ?? "").replace(/[^\d]/g, "");
  if (d.startsWith("00")) d = d.slice(2);
  if (d.startsWith("0")) d = `383${d.slice(1)}`;
  return d.length >= 8 ? d : "";
};

export interface FamilyMatch {
  familyId: string | null;
  siblings: { id: number; name: string; className: string | null }[];
}

/**
 * Familjet në sistem s'janë rekord më vete — grupohen sipas telefonit të
 * prindit (shih /api/families). Gjen nxënësit me të njëjtin telefon prindi
 * DHE të njëjtin mbiemër ose emër prindi (telefoni vetëm s'mjafton — numra
 * të gabuar/të përsëritur s'duhet të bashkojnë familje të ndryshme).
 */
export async function findFamilyMatch(orgId: number, app: {
  lastName: string; motherName: string | null; fatherName: string | null;
  motherPhone: string | null; fatherPhone: string | null; guardianOtherPhone: string | null;
}): Promise<FamilyMatch> {
  const phones = new Set([app.motherPhone, app.fatherPhone, app.guardianOtherPhone].map(phoneKey).filter(Boolean));
  if (!phones.size) return { familyId: null, siblings: [] };
  const candidates = await prisma.student.findMany({
    where: { organizationId: orgId },
    select: { id: true, firstName: true, lastName: true, familyId: true, status: true, parentPhone: true, fatherPhone: true, motherPhone: true, fatherName: true, motherName: true, parentName: true, class: { select: { name: true } } },
  });
  const names = new Set([app.lastName, app.motherName, app.fatherName].map(norm).filter(Boolean));
  const siblings = candidates.filter(s =>
    [s.parentPhone, s.fatherPhone, s.motherPhone].some(p => phones.has(phoneKey(p))) &&
    [s.lastName, s.fatherName, s.motherName, s.parentName].some(n => names.has(norm(n))));
  const familyId = siblings.find(s => s.familyId)?.familyId ?? null;
  return {
    familyId,
    siblings: siblings
      .sort((a, b) => Number(b.status === "ACTIVE") - Number(a.status === "ACTIVE"))
      .map(s => ({ id: s.id, name: `${s.firstName} ${s.lastName}`, className: s.class?.name ?? null })),
  };
}

/**
 * Formulari publik përdoret edhe nga stafi ("Shto aplikim me dorë", në zyrë):
 * kur thirret nga dikush i kyçur me modulin "Regjistrimet", aplikimi shënohet
 * OFFICE dhe lejohet edhe kur regjistrimet publike janë mbyllur.
 */
export async function getOfficeSession(): Promise<{ session: unknown } | null> {
  try {
    const { auth } = await import("./auth");
    const { sessionHasModule } = await import("./specialCarePermissions");
    const session = await auth();
    return session && sessionHasModule(session, "regjistrimet") ? { session } : null;
  } catch {
    return null;
  }
}

/** Mosha në vite të plota. */
export function ageYears(birth: Date | null, today = new Date()): number | null {
  if (!birth) return null;
  const b = new Date(birth);
  let a = today.getFullYear() - b.getFullYear();
  if (today.getMonth() < b.getMonth() || (today.getMonth() === b.getMonth() && today.getDate() < b.getDate())) a--;
  return a;
}
