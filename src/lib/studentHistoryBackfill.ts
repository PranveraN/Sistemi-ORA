import { prisma } from "./prisma";
import { fmtEur } from "./studentHistory";

// Rindërtimi i historikut nga të dhënat ekzistuese — shih /api/superadmin/backfill-history.
// Pa auth këtu (thirret vetëm nga ajo rrugë, e mbrojtur për Super Admin).

type Row = {
  studentId: number; type: string; title: string; description: string | null;
  data: string | null; userId: number | null; occurredAt: Date; sourceKey: string;
};

export async function buildBackfillRows(): Promise<{ rows: Row[]; cutoff: Date }> {
  const firstAuto = await prisma.studentHistory.findFirst({
    where: { source: "auto" }, orderBy: { createdAt: "asc" }, select: { createdAt: true },
  });
  const cutoff = firstAuto?.createdAt ?? new Date();
  const before = (d: Date | null | undefined) => !!d && d < cutoff;

  const students = await prisma.student.findMany({
    select: { id: true, enrollDate: true, status: true, inactiveDate: true, leaveReason: true, destinationSchool: true },
  });
  const ids = new Set(students.map(s => s.id));
  const rows: Row[] = [];
  const push = (r: Row) => { if (ids.has(r.studentId)) rows.push(r); };

  // 1. Regjistrimi
  for (const s of students) {
    if (!before(s.enrollDate)) continue;
    push({ studentId: s.id, type: "REGJISTRIM", title: "Regjistruar", description: null, data: null, userId: null, occurredAt: s.enrollDate, sourceKey: `enroll:${s.id}` });
  }

  // 2. Çregjistrimi
  for (const s of students) {
    if (s.status !== "INACTIVE" || !before(s.inactiveDate)) continue;
    const desc = [s.leaveReason, s.destinationSchool && `Shkolla: ${s.destinationSchool}`].filter(Boolean).join(" · ") || null;
    push({ studentId: s.id, type: "CREGJISTRIM", title: "Çregjistruar (joaktiv)", description: desc, data: null, userId: null, occurredAt: s.inactiveDate!, sourceKey: `inactive:${s.id}` });
  }

  // 3. Pagesat (tabela Payment — të gjitha kategoritë)
  const payments = await prisma.payment.findMany({
    where: { paidAmount: { gt: 0 } },
    select: { id: true, studentId: true, paidAmount: true, paidDate: true, method: true, description: true, category: { select: { name: true } } },
  });
  for (const p of payments) {
    if (!before(p.paidDate)) continue;
    push({
      studentId: p.studentId, type: "PAGESE", title: `Pagesë ${fmtEur(p.paidAmount)}`,
      description: [p.category.name, p.description].filter(Boolean).join(" · "),
      data: JSON.stringify({ amount: p.paidAmount, category: p.category.name, method: p.method, paymentId: p.id }),
      userId: null, occurredAt: p.paidDate!, sourceKey: `payment:${p.id}`,
    });
  }

  // 4. Pagesat e Uniformës
  const uniPays = await prisma.uniPayment.findMany({
    select: { id: true, amount: true, method: true, paidAt: true, sale: { select: { studentId: true } } },
  });
  for (const p of uniPays) {
    if (!p.sale.studentId || !before(p.paidAt) || p.amount <= 0) continue;
    push({
      studentId: p.sale.studentId, type: "PAGESE", title: `Pagesë ${fmtEur(p.amount)}`, description: "Uniforma",
      data: JSON.stringify({ amount: p.amount, category: "Uniforma", method: p.method }),
      userId: null, occurredAt: p.paidAt, sourceKey: `unipay:${p.id}`,
    });
  }

  // 5. Pagesat e Librave (moduli i Librave përdor SQL të papërpunuar)
  const bookPays = await prisma.$queryRawUnsafe<{ id: number; amount: number; method: string | null; paidAt: string; studentId: number | null }[]>(
    `SELECT bp.id, bp.amount, bp.method, bp.paidAt, bs.studentId FROM BookPayment bp JOIN BookSale bs ON bs.id = bp.saleId WHERE bs.studentId IS NOT NULL`
  );
  for (const p of bookPays) {
    const when = new Date(typeof p.paidAt === "string" && !p.paidAt.includes("T") ? p.paidAt.replace(" ", "T") + "Z" : p.paidAt);
    if (isNaN(when.getTime()) || !before(when) || Number(p.amount) <= 0) continue;
    push({
      studentId: Number(p.studentId), type: "PAGESE", title: `Pagesë ${fmtEur(Number(p.amount))}`, description: "Librat e anglishtes",
      data: JSON.stringify({ amount: Number(p.amount), category: "Librat e anglishtes", method: p.method }),
      userId: null, occurredAt: when, sourceKey: `bookpay:${Number(p.id)}`,
    });
  }

  // 6. SMS-të e dërguara
  const sms = await prisma.smsMessage.findMany({
    where: { status: "SENT", studentId: { not: null } },
    select: { id: true, studentId: true, message: true, recipientPhone: true, sentById: true, createdAt: true },
  });
  for (const m of sms) {
    if (!before(m.createdAt)) continue;
    push({
      studentId: m.studentId!, type: "SMS", title: "SMS te prindi", description: m.message,
      data: JSON.stringify({ phone: m.recipientPhone }), userId: m.sentById, occurredAt: m.createdAt, sourceKey: `sms:${m.id}`,
    });
  }

  // 7. Kalimet e viteve (StudentYearHistory)
  const years = await prisma.studentYearHistory.findMany({
    select: { id: true, studentId: true, className: true, newClassName: true, outcome: true, createdAt: true, schoolYear: { select: { label: true } } },
  });
  for (const y of years) {
    if (!before(y.createdAt)) continue;
    const label = `Kalimi i vitit (${y.schoolYear.label})`;
    if (y.outcome === "GRADUATED" || y.outcome === "LEFT") {
      push({ studentId: y.studentId, type: "CREGJISTRIM", title: y.outcome === "GRADUATED" ? "Diplomuar" : "Larguar", description: label, data: null, userId: null, occurredAt: y.createdAt, sourceKey: `yearhist:${y.id}` });
    } else {
      const from = y.className ?? "—";
      const to = y.newClassName ?? from;
      push({
        studentId: y.studentId, type: "NDRYSHIM_KLASE",
        title: y.outcome === "REPEATED" ? `Përsërit klasën (${to})` : `Klasa: ${from} → ${to}`,
        description: label, data: JSON.stringify({ from, to, outcome: y.outcome }), userId: null, occurredAt: y.createdAt, sourceKey: `yearhist:${y.id}`,
      });
    }
  }

  // 8. Editimet e vjetra nga regjistri i aktivitetit (AuditLog) — pa vlerat e vjetra
  const audits = await prisma.auditLog.findMany({
    where: { entity: "Student", action: "UPDATE", entityId: { not: null } },
    select: { id: true, entityId: true, details: true, userId: true, createdAt: true },
  });
  for (const a of audits) {
    if (!before(a.createdAt)) continue;
    if ((a.details ?? "").startsWith("Çaktivizoi")) continue; // mbulohet nga çregjistrimi
    push({
      studentId: a.entityId!, type: "NDRYSHIM_TE_DHENASH", title: "Ndryshim të dhënash",
      description: a.details, data: null, userId: a.userId, occurredAt: a.createdAt, sourceKey: `audit:${a.id}`,
    });
  }

  return { rows, cutoff };
}

export async function pendingBackfill() {
  const { rows, cutoff } = await buildBackfillRows();
  const existing = await prisma.studentHistory.findMany({
    where: { source: "backfill", sourceKey: { not: null } }, select: { sourceKey: true },
  });
  const done = new Set(existing.map(e => e.sourceKey));
  const todo = rows.filter(r => !done.has(r.sourceKey));
  const byType: Record<string, number> = {};
  for (const r of todo) byType[r.type] = (byType[r.type] ?? 0) + 1;
  return { todo, byType, alreadyDone: rows.length - todo.length, cutoff };
}

