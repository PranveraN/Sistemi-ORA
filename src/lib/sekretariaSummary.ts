import { prisma } from "@/lib/prisma";
import { computeStudentFinanceRows } from "@/lib/studentFinanceRows";
import {
  DOC_TYPES, FLETEKALIM_TYPES, VERTETIM_TYPES, LIBRI_AME_REQUIRED, YEAR_CLOSING_STEPS, reprintHref,
  isAssistant, isTeacher, isStaffContractSigned, missingLibriAmeFields,
  STUDENT_CONTRACT_SIGNED, STUDENT_CONTRACT_PENDING, type YearStepKey,
} from "@/lib/sekretariaConstants";

// Përmbledhja e panelit të Sekretarisë — VETËM LEXIM. Çdo numër llogaritet nga
// e njëjta fushë/tabelë që përdor moduli përkatës (shih sekretariaConstants.ts).
// Ruhet në cache 60 sekonda për organizatë; lejet filtrohen te route-i.

export interface YearStep {
  key: YearStepKey; label: string; mode: "MANUAL" | "AUTO";
  done: boolean; doneAt: string | null; doneBy: string | null;
}

export interface SekretariaSummary {
  generatedAt: string;
  yearLabel: string;
  studentContracts: { total: number; signed: number; pending: number; activeStudents: number };
  staffContracts: { active: number; expiringSoon: number; expired: number; unsigned: number; withoutEndDate: number; thresholdDays: number };
  certificates: { thisMonth: number; thisYear: number; templates: number };
  transfers: { today: number; thisWeek: number; thisYear: number };
  libriAme: { registered: number; noAmza: number; incomplete: number; activeStudents: number; requiredFields: string[] };
  staff: { total: number; teachers: number; assistants: number; others: number };
  yearClosing: { yearLabel: string; nextLabel: string; steps: YearStep[]; debtCount: number | null; completed: boolean };
  recentDocuments: { id: number; type: string; label: string; person: string; className: string | null; createdAt: string; href: string }[];
}

const CACHE_MS = 60_000;
const cache = new Map<number, { at: number; data: SekretariaSummary }>();

export function invalidateSekretariaSummary(orgId: number) {
  cache.delete(orgId);
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());

function nextLabelOf(label: string): string {
  const m = label.match(/(\d{4})/);
  if (!m) return label;
  const y = parseInt(m[1]) + 1;
  return `${y}-${y + 1}`;
}

/** Viti që po mbyllet: viti aktiv — ose, menjëherë pas kalimit (≤ 120 ditë), viti nga i cili u kalua. */
async function resolveClosingYear(orgId: number) {
  const active = await prisma.schoolYear.findFirst({ where: { organizationId: orgId, active: true }, select: { id: true, label: true } });
  const lastRun = await prisma.promotionRun.findFirst({
    where: { toYear: { organizationId: orgId } },
    orderBy: { createdAt: "desc" },
    select: { fromYearId: true, toYearId: true, createdAt: true },
  });
  if (active && lastRun && lastRun.toYearId === active.id && lastRun.fromYearId && Date.now() - lastRun.createdAt.getTime() < 120 * 86400000) {
    const from = await prisma.schoolYear.findUnique({ where: { id: lastRun.fromYearId }, select: { label: true } });
    if (from) return { label: from.label, activeLabel: active.label };
  }
  const label = active?.label ?? await fallbackYearLabel();
  return { label, activeLabel: label };
}

/** Kur s'ka ende vit shkollor në bazë — i njëjti rregull si /api/school-years (pa krijuar asgjë). */
async function fallbackYearLabel(): Promise<string> {
  const row = await prisma.setting.findUnique({ where: { key: "schoolYear" } });
  const m = row?.value.trim().match(/^(\d{4})[/-](\d{4})$/);
  if (m) return `${m[1]}-${m[2]}`;
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() + 1 >= 8 ? `${y}-${y + 1}` : `${y - 1}-${y}`; // gushti = fillim i vitit të ri
}

export async function getSekretariaSummary(orgId: number, opts: { includeDebts: boolean }): Promise<SekretariaSummary> {
  const hit = cache.get(orgId);
  if (hit && Date.now() - hit.at < CACHE_MS && (hit.data.yearClosing.debtCount !== null || !opts.includeDebts)) return hit.data;

  const now = new Date();
  const today = startOfDay(now);
  const weekStart = new Date(today); weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7)); // e hënë
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

  const closing = await resolveClosingYear(orgId);
  const yearLabel = closing.activeLabel;
  const startYear = parseInt(yearLabel.match(/(\d{4})/)?.[1] ?? String(now.getMonth() >= 7 ? now.getFullYear() : now.getFullYear() - 1));
  const academicStart = new Date(startYear, 8, 1); // 1 shtator

  const thresholdRow = await prisma.setting.findUnique({ where: { key: "staffContractExpiryDays" } });
  const thresholdDays = Math.min(365, Math.max(1, parseInt(thresholdRow?.value ?? "") || 30));
  const soonLimit = new Date(today); soonLimit.setDate(today.getDate() + thresholdDays);

  const activeWhere = { organizationId: orgId, status: "ACTIVE" };
  const [students, staff, docCounts, recent] = await Promise.all([
    prisma.student.findMany({
      where: activeWhere,
      select: {
        kontrata: true, diaryNumber: true, birthDate: true, personalNumber: true, fatherName: true, motherName: true, address: true,
        libriAme: { select: { id: true } },
      },
    }),
    prisma.staff.findMany({
      where: { status: "ACTIVE" },
      select: { lenda: true, tipi: true, kontrata: true, contractEndDate: true },
    }),
    prisma.docArchive.findMany({
      where: { type: { in: [...FLETEKALIM_TYPES, ...VERTETIM_TYPES] }, createdAt: { gte: new Date(Math.min(academicStart.getTime(), monthStart.getTime())) } },
      select: { type: true, createdAt: true },
    }),
    prisma.docArchive.findMany({
      orderBy: { createdAt: "desc" }, take: 5,
      select: { id: true, type: true, studentId: true, staffId: true, studentName: true, className: true, createdAt: true },
    }),
  ]);

  // ── Kontratat e nxënësve (fusha "Kontrata" e nxënësit) ──
  const signed = students.filter(s => s.kontrata === STUDENT_CONTRACT_SIGNED).length;
  const pending = students.filter(s => s.kontrata === STUDENT_CONTRACT_PENDING).length;

  // ── Kontratat e stafit ──
  const expired = staff.filter(s => s.contractEndDate && s.contractEndDate < today).length;
  const expiringSoon = staff.filter(s => s.contractEndDate && s.contractEndDate >= today && s.contractEndDate <= soonLimit).length;
  const activeContracts = staff.filter(s => isStaffContractSigned(s.kontrata) && !(s.contractEndDate && s.contractEndDate < today)).length;

  // ── Dokumentet e arkivit ──
  const fl = docCounts.filter(d => FLETEKALIM_TYPES.includes(d.type));
  const vt = docCounts.filter(d => VERTETIM_TYPES.includes(d.type));

  // ── Mbyllja e vitit ──
  const nextLabel = nextLabelOf(closing.label);
  const [nextYear, checks] = await Promise.all([
    prisma.schoolYear.findFirst({ where: { organizationId: orgId, label: nextLabel }, select: { id: true, active: true } }),
    prisma.yearClosingCheck.findMany({ where: { organizationId: orgId, yearLabel: closing.label } }),
  ]);
  const promoted = nextYear ? await prisma.promotionRun.findFirst({ where: { toYearId: nextYear.id }, orderBy: { createdAt: "desc" }, select: { createdAt: true, user: { select: { name: true } } } }) : null;
  const checkByKey = new Map(checks.map(c => [c.stepKey, c]));
  const steps: YearStep[] = YEAR_CLOSING_STEPS.map(s => {
    if (s.mode === "MANUAL") {
      const c = checkByKey.get(s.key);
      return { key: s.key, label: s.label, mode: s.mode, done: !!c, doneAt: c?.doneAt.toISOString() ?? null, doneBy: c?.doneByName ?? null };
    }
    const done = s.key === "NEW_YEAR" ? !!nextYear : s.key === "PROMOTE" ? !!promoted : !!nextYear?.active;
    const at = s.key === "PROMOTE" || s.key === "OPEN" ? promoted?.createdAt.toISOString() ?? null : null;
    return { key: s.key, label: s.label, mode: s.mode, done, doneAt: done ? at : null, doneBy: done && at ? promoted?.user.name ?? null : null };
  });

  // Borxhi i shkollimit — i njëjti llogaritës si faqja Nxënësit (vetëm numri i nxënësve)
  let debtCount: number | null = null;
  if (opts.includeDebts) {
    const { rows } = await computeStudentFinanceRows(activeWhere, { year: startYear, yearType: "academic" });
    debtCount = rows.filter((r: { balance: number }) => r.balance > 0.005).length;
  }

  const data: SekretariaSummary = {
    generatedAt: now.toISOString(),
    yearLabel,
    studentContracts: { total: signed + pending, signed, pending, activeStudents: students.length },
    staffContracts: {
      active: activeContracts, expiringSoon, expired, thresholdDays,
      unsigned: staff.filter(s => (s.kontrata ?? "").trim().toLowerCase() === "nuk e ka kthy").length,
      withoutEndDate: staff.filter(s => isStaffContractSigned(s.kontrata) && !s.contractEndDate).length,
    },
    certificates: {
      thisMonth: vt.filter(d => d.createdAt >= monthStart).length,
      thisYear: vt.filter(d => d.createdAt >= academicStart).length,
      templates: VERTETIM_TYPES.length,
    },
    transfers: {
      today: fl.filter(d => d.createdAt >= today).length,
      thisWeek: fl.filter(d => d.createdAt >= weekStart).length,
      thisYear: fl.filter(d => d.createdAt >= academicStart).length,
    },
    libriAme: {
      registered: students.filter(s => s.libriAme).length,
      noAmza: students.filter(s => !s.diaryNumber?.trim()).length,
      incomplete: students.filter(s => missingLibriAmeFields(s).length > 0).length,
      activeStudents: students.length,
      requiredFields: LIBRI_AME_REQUIRED.map(f => f.label),
    },
    staff: {
      total: staff.length,
      teachers: staff.filter(isTeacher).length,
      assistants: staff.filter(isAssistant).length,
      others: staff.filter(s => !isTeacher(s) && !isAssistant(s)).length,
    },
    yearClosing: { yearLabel: closing.label, nextLabel, steps, debtCount, completed: steps.every(s => s.done) },
    recentDocuments: recent.map(d => ({
      id: d.id, type: d.type, label: DOC_TYPES[d.type]?.label ?? d.type, person: d.studentName, className: d.className,
      createdAt: d.createdAt.toISOString(), href: reprintHref(d),
    })),
  };
  cache.set(orgId, { at: Date.now(), data });
  return data;
}
