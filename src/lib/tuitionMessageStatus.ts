import { prisma } from "@/lib/prisma";
import { getTuitionMessageStatus, tuitionDueDateFor, type StatusResult, type TuitionStatus } from "@/lib/smsStatus";

// Statusi i shkollimit për mesazhet (Timi Invest / Paguar / Me vonesë /
// Pjesërisht / Pa paguar) për një listë nxënësish — i nxjerrë nga
// /api/sms/audience që faqja e mesazheve dhe asistenti "Ora" të përdorin të
// NJËJTËN llogaritje. Vetëm lexim.

export interface TuitionStudentLite { id: number; firstName: string; lastName: string; discountPct: number | null }

export async function computeTuitionMessageStatuses(students: TuitionStudentLite[], year: number): Promise<{ statuses: Map<number, StatusResult<TuitionStatus>>; tuitionDueDate: Date }> {
  const academicWhere = {
    OR: [
      { month: { gte: 9 }, year },
      { month: { lte: 8 }, year: year + 1 },
    ],
  };
  const category = await prisma.paymentCategory.findFirst({ where: { name: "Shkollimi" } });
  const [payments, setting, tiRows] = await Promise.all([
    prisma.payment.findMany({
      where: {
        categoryId: category?.id ?? -1, // pa kategori "Shkollimi" → asnjë këst
        studentId: { in: students.map(s => s.id) },
        // Borxhi i vjetër i importuar s'hyn në statusin e vitit aktual
        AND: [{ OR: [{ description: null }, { description: { not: "BORXH_VJETER" } }] }],
        ...academicWhere,
      },
      select: { studentId: true, finalAmount: true, paidAmount: true, description: true, dueDate: true },
    }),
    prisma.setting.findUnique({ where: { key: "tuitionDueDate" } }),
    prisma.timiInvestStudent.findMany({
      where: { active: true },
      select: { studentId: true, firstName: true, lastName: true },
    }),
  ]);
  const byStudent = new Map<number, typeof payments>();
  for (const p of payments) {
    if (!byStudent.has(p.studentId)) byStudent.set(p.studentId, []);
    byStudent.get(p.studentId)!.push(p);
  }
  const tuitionDueDate = tuitionDueDateFor(year, setting?.value);
  // E njëjta lidhje TI si /api/category-payments: sipas studentId, ose sipas emrit
  const tiIds = new Set(tiRows.filter(t => t.studentId).map(t => t.studentId as number));
  const tiNames = new Set(tiRows.filter(t => !t.studentId)
    .map(t => `${t.firstName.trim().toLowerCase()}|${t.lastName.trim().toLowerCase()}`));
  const defaultAmount = category?.defaultAmount ?? 0;
  const statuses = new Map<number, StatusResult<TuitionStatus>>();
  for (const s of students) {
    const isTi = tiIds.has(s.id) || tiNames.has(`${s.firstName.trim().toLowerCase()}|${s.lastName.trim().toLowerCase()}`);
    statuses.set(s.id, getTuitionMessageStatus({
      isTimiInvest: isTi,
      installments: byStudent.get(s.id) ?? [],
      expectedAmount: Math.round(defaultAmount * (1 - (s.discountPct ?? 0) / 100)),
      tuitionDueDate,
    }));
  }
  return { statuses, tuitionDueDate };
}
