import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type PrismaPayment = {
  id: number;
  amount: number;
  finalAmount: number;
  paidAmount: number;
  balance: number;
  status: string;
  method: string | null;
  dueDate: Date;
  paidDate: Date | null;
  discount: number;
  discountType: string | null;
  scholarship: number;
  description: string | null;
  month: number;
  year: number;
};

function aggregateStatus(payments: PrismaPayment[]): string {
  if (!payments.length) return "PENDING";
  const totalFinal = payments.reduce((s, p) => s + p.finalAmount, 0);
  const totalPaid  = payments.reduce((s, p) => s + p.paidAmount,  0);
  if (totalFinal > 0 && totalPaid >= totalFinal) return "PAID";
  if (totalPaid > 0) return "PARTIAL";
  const now = new Date();
  if (payments.some(p => new Date(p.dueDate) < now && p.paidAmount === 0)) return "OVERDUE";
  return "PENDING";
}

function aggregatePayment(payments: PrismaPayment[]): PrismaPayment | null {
  if (!payments.length) return null;
  if (payments.length === 1) return payments[0];
  const totalFinal = payments.reduce((s, p) => s + p.finalAmount, 0);
  const totalPaid  = payments.reduce((s, p) => s + p.paidAmount,  0);
  const balance    = Math.max(0, totalFinal - totalPaid);
  return {
    ...payments[0],
    finalAmount: totalFinal,
    paidAmount:  totalPaid,
    balance,
    status: aggregateStatus(payments),
  };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const categoryName = searchParams.get("category") || "";
  const monthParam   = searchParams.get("month");
  const yearParam    = searchParams.get("year");
  const month  = monthParam  ? parseInt(monthParam)  : null;  // null = all months
  const year   = yearParam   ? parseInt(yearParam)   : null;  // null = all years
  const search  = searchParams.get("search")  || "";
  const classId = searchParams.get("classId") || "";

  let category = await prisma.paymentCategory.findFirst({
    where: { name: { equals: categoryName } },
  });
  if (!category) {
    category = await prisma.paymentCategory.create({
      data: { name: categoryName, type: "one-time", defaultAmount: 0 },
    });
  }

  const where: Record<string, unknown> = { status: { in: ["ACTIVE", "INACTIVE"] } };
  if (search) {
    where.OR = [
      { firstName: { contains: search } },
      { lastName:  { contains: search } },
    ];
  }
  if (classId) where.classId = parseInt(classId);

  // Build payment filter — skip month/year when null (= "Të gjitha")
  const paymentFilter: Record<string, unknown> = { categoryId: category.id };
  if (month && month > 0) paymentFilter.month = month;
  if (year  && year  > 0) paymentFilter.year  = year;

  // When filtering broadly (all months or all years), fetch more records per student
  const isNarrow = (month && month > 0) && (year && year > 0);
  const takeLimit = isNarrow ? 2 : 60;

  const [students, allTiRows, inactiveDates] = await Promise.all([
    prisma.student.findMany({
      where,
      include: {
        class: { select: { id: true, name: true } },
        payments: {
          where: paymentFilter,
          orderBy: { createdAt: "asc" },
          take: takeLimit,
          select: {
            id: true, amount: true, finalAmount: true, paidAmount: true,
            balance: true, status: true, method: true, dueDate: true,
            paidDate: true, discount: true, discountType: true,
            scholarship: true, description: true, receiptNumber: true,
            month: true, year: true,
          },
        },
      },
      orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
    }),
    prisma.$queryRawUnsafe<{ id: number; studentId: number | null; firstName: string; lastName: string; regularPrice: number; discountPct: number; manualDiscAmt: number }[]>(
      `SELECT id, studentId, firstName, lastName, regularPrice, discountPct, manualDiscAmt FROM TimiInvestStudent WHERE active = 1`
    ),
    prisma.$queryRawUnsafe<{ id: number; inactiveDate: string | null }[]>(
      `SELECT id, inactiveDate FROM Student WHERE status = 'INACTIVE'`
    ),
  ]);

  // Build TI lookup maps (by studentId and by name fallback)
  const tiByStudentId = new Map<number, { id: number; regularPrice: number; discountPct: number; manualDiscAmt: number }>();
  const tiByName      = new Map<string, { id: number; regularPrice: number; discountPct: number; manualDiscAmt: number }>();
  for (const ti of allTiRows) {
    const val = { id: Number(ti.id), regularPrice: Number(ti.regularPrice), discountPct: Number(ti.discountPct), manualDiscAmt: Number(ti.manualDiscAmt) };
    if (ti.studentId) {
      tiByStudentId.set(Number(ti.studentId), val);
    } else {
      tiByName.set(`${String(ti.firstName).trim().toLowerCase()}|${String(ti.lastName).trim().toLowerCase()}`, val);
    }
  }

  // Ndaj ACTIVE nga INACTIVE
  const activeStudents   = students.filter(s => s.status === "ACTIVE");
  const inactiveStudents = students.filter(s => s.status === "INACTIVE");

  const statuses = activeStudents.map(s => aggregateStatus(s.payments as PrismaPayment[]));

  const totalRevenue = activeStudents.reduce(
    (sum, s) => sum + s.payments.reduce((ps, p) => ps + p.paidAmount, 0), 0
  );
  const totalDebt = activeStudents.reduce((sum, s) => {
    const agg = aggregatePayment(s.payments as PrismaPayment[]);
    if (agg) return sum + (agg.balance || 0);
    const expectedPrice = Math.round(category.defaultAmount * (1 - (s.discountPct ?? 0) / 100));
    return sum + expectedPrice;
  }, 0);

  // Mapa e inactiveDate nga raw SQL
  const inactiveDateMap = new Map<number, string | null>();
  for (const row of inactiveDates) {
    inactiveDateMap.set(Number(row.id), row.inactiveDate ?? null);
  }

  const mapStudent = (s: typeof students[0]) => {
    const tiDirect = tiByStudentId.get(s.id);
    const tiName   = !tiDirect ? tiByName.get(`${s.firstName.trim().toLowerCase()}|${s.lastName.trim().toLowerCase()}`) : undefined;
    return {
      id:           s.id,
      firstName:    s.firstName,
      lastName:     s.lastName,
      parentPhone:  s.parentPhone,
      class:        s.class,
      discountPct:  s.discountPct,
      status:       s.status,
      inactiveDate: inactiveDateMap.get(s.id) ?? null,
      payment:      aggregatePayment(s.payments as PrismaPayment[]),
      installments: s.payments,
      timiInvest:   tiDirect ?? tiName ?? null,
    };
  };

  return NextResponse.json({
    category,
    students: [
      ...activeStudents.map(mapStudent),
      ...inactiveStudents.map(mapStudent),
    ],
    stats: {
      total:    activeStudents.length,
      paid:     statuses.filter(st => st === "PAID").length,
      partial:  statuses.filter(st => st === "PARTIAL").length,
      overdue:  statuses.filter(st => st === "OVERDUE").length,
      pending:  statuses.filter(st => st === "PENDING").length,
      totalRevenue,
      totalDebt,
    },
  });
}
