import { prisma } from "./prisma";

// Historiku i nxënësit — VENDI I VETËM QENDROR për shkrimin e ngjarjeve në
// tabelën StudentHistory (paneli "Historiku" te faqja e Nxënësve). Si
// logAction() te audit.ts: s'hedh kurrë gabim — një dështim i regjistrimit
// të historikut s'duhet ta prishë veprimin real që e shkaktoi.

export type StudentEventType =
  | "REGJISTRIM" | "PAGESE" | "KONTRATE" | "SMS"
  | "NDRYSHIM_KLASE" | "ZBRITJE" | "NDRYSHIM_TE_DHENASH" | "CREGJISTRIM" | "KUJDES_I_VECANTE";

export const STUDENT_EVENT_LABELS: Record<StudentEventType, string> = {
  REGJISTRIM: "Regjistrim",
  PAGESE: "Pagesë",
  KONTRATE: "Kontratë",
  SMS: "SMS",
  NDRYSHIM_KLASE: "Ndryshim klase",
  ZBRITJE: "Zbritje",
  NDRYSHIM_TE_DHENASH: "Ndryshim të dhënash",
  CREGJISTRIM: "Çregjistrim",
  KUJDES_I_VECANTE: "Kujdes i veçantë",
};

export interface StudentEventInput {
  studentId: number;
  type: StudentEventType;
  title: string;
  description?: string | null;
  data?: Record<string, unknown> | null;
  occurredAt?: Date;
}

function sessionUserId(session: unknown): number | null {
  const id = parseInt((session as { user?: { id?: string } } | null)?.user?.id ?? "0");
  return id > 0 ? id : null;
}

/** Regjistron një ose disa ngjarje. `session` = sesioni i përdoruesit (ose null). */
export async function recordStudentEvent(session: unknown, events: StudentEventInput | StudentEventInput[]): Promise<void> {
  const list = (Array.isArray(events) ? events : [events]).filter(e => e && e.studentId > 0);
  if (!list.length) return;
  const userId = sessionUserId(session);
  try {
    await prisma.studentHistory.createMany({
      data: list.map(e => ({
        studentId: e.studentId,
        type: e.type,
        title: e.title.slice(0, 200),
        description: e.description ?? null,
        data: e.data ? JSON.stringify(e.data) : null,
        userId,
        occurredAt: e.occurredAt ?? new Date(),
      })),
    });
  } catch (err) {
    console.error("[studentHistory] regjistrimi dështoi:", err);
  }
}

export const fmtEur = (n: number) =>
  `${n.toLocaleString("de-DE", { minimumFractionDigits: n % 1 === 0 ? 0 : 2, maximumFractionDigits: 2 })} €`;

/**
 * Ngjarje "Pagesë" kur shuma e paguar RRITET (krijim ose ndryshim pagese).
 * Thirret me vlerat para/pas — kur s'ka rritje (p.sh. ndryshim afati), s'regjistrohet asgjë.
 */
export async function recordPaymentEvent(session: unknown, p: {
  studentId: number | null | undefined;
  categoryName: string;
  paidBefore: number;
  paidAfter: number;
  paidDate?: Date | string | null;
  method?: string | null;
  paymentId?: number | null;
  description?: string | null;
}): Promise<void> {
  if (!p.studentId) return;
  const delta = Math.round((p.paidAfter - p.paidBefore) * 100) / 100;
  if (delta <= 0.004) return;
  const when = p.paidDate ? new Date(p.paidDate) : new Date();
  await recordStudentEvent(session, {
    studentId: p.studentId,
    type: "PAGESE",
    title: `Pagesë ${fmtEur(delta)}`,
    description: [p.categoryName, p.description].filter(Boolean).join(" · ") || null,
    data: { amount: delta, category: p.categoryName, method: p.method ?? null, paymentId: p.paymentId ?? null, paidTotal: p.paidAfter },
    occurredAt: isNaN(when.getTime()) ? new Date() : when,
  });
}

/** Fushat "kryesore" të nxënësit që gjurmohen si "Ndryshim të dhënash". */
const TRACKED_FIELDS: Record<string, string> = {
  firstName: "Emri", lastName: "Mbiemri", personalNumber: "Nr. personal",
  birthDate: "Datëlindja", parentName: "Prindi", parentPhone: "Telefoni",
  fatherName: "Emri i babait", fatherPhone: "Tel. i babait", fatherEmail: "Email i babait",
  motherName: "Emri i nënës", motherPhone: "Tel. i nënës", motherEmail: "Email i nënës",
  address: "Adresa", guardian: "Kujdestari",
};

type StudentSnapshot = Record<string, unknown> & {
  id: number;
  classId?: number | null;
  discountPct?: number | null;
  kontrata?: string | null;
  status?: string | null;
};

function norm(v: unknown): string {
  if (v == null) return "";
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).trim();
}

/**
 * Krahason gjendjen e nxënësit PARA dhe PAS një ndryshimi dhe regjistron
 * ngjarjet përkatëse: ndryshim klase, zbritje, kontratë, çregjistrim/rikthim
 * dhe ndryshim të dhënash kryesore (me vlerën e vjetër/të re).
 */
export async function recordStudentChanges(
  session: unknown,
  before: StudentSnapshot,
  after: StudentSnapshot,
  classNames?: { before?: string | null; after?: string | null },
): Promise<void> {
  const events: StudentEventInput[] = [];
  const sid = after.id;

  if ("classId" in after && (before.classId ?? null) !== (after.classId ?? null)) {
    const from = classNames?.before ?? "—";
    const to = classNames?.after ?? "—";
    events.push({ studentId: sid, type: "NDRYSHIM_KLASE", title: `Klasa: ${from} → ${to}`, data: { from, to } });
  }
  if ("discountPct" in after && Number(before.discountPct ?? 0) !== Number(after.discountPct ?? 0)) {
    events.push({
      studentId: sid, type: "ZBRITJE",
      title: `Zbritja: ${Number(before.discountPct ?? 0)}% → ${Number(after.discountPct ?? 0)}%`,
      data: { from: before.discountPct ?? 0, to: after.discountPct ?? 0 },
    });
  }
  if ("kontrata" in after && norm(before.kontrata) !== norm(after.kontrata)) {
    events.push({
      studentId: sid, type: "KONTRATE",
      title: `Kontrata: ${norm(after.kontrata) || "—"}`,
      description: norm(before.kontrata) ? `Më parë: ${norm(before.kontrata)}` : null,
      data: { from: before.kontrata ?? null, to: after.kontrata ?? null },
    });
  }
  if ("status" in after && norm(before.status) !== norm(after.status)) {
    if (after.status === "INACTIVE") {
      events.push({ studentId: sid, type: "CREGJISTRIM", title: "Çregjistruar (joaktiv)", description: norm(after.leaveReason) || null });
    } else if (after.status === "ACTIVE") {
      events.push({ studentId: sid, type: "REGJISTRIM", title: "Rikthyer si aktiv" });
    }
  }
  const changes: { field: string; label: string; from: string; to: string }[] = [];
  for (const [field, label] of Object.entries(TRACKED_FIELDS)) {
    if (!(field in after)) continue;
    const a = norm(before[field]);
    const b = norm(after[field]);
    if (a !== b) changes.push({ field, label, from: a, to: b });
  }
  if (changes.length) {
    events.push({
      studentId: sid, type: "NDRYSHIM_TE_DHENASH",
      title: `Ndryshuan: ${changes.map(c => c.label).join(", ")}`,
      description: changes.map(c => `${c.label}: ${c.from || "—"} → ${c.to || "—"}`).join("; "),
      data: { changes },
    });
  }
  await recordStudentEvent(session, events);
}
