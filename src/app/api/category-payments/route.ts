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
};

function aggregateStatus(payments: PrismaPayment[]): string {
  if (!payments.length) return "PENDING";
  if (payments.length === 1) return payments[0].status;
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

  const category = await prisma.paymentCategory.findFirst({
    where: { name: { equals: categoryName } },
  });
  if (!category) return NextResponse.json({ error: "Kategoria nuk u gjet" }, { status: 404 });

  const where: Record<string, unknown> = { status: "ACTIVE" };
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

  const students = await prisma.student.findMany({
    where,
    include: {
      class: { select: { id: true, name: true } },
      payments: {
        where: paymentFilter,
        orderBy: { createdAt: "asc" },
        take: takeLimit,
      },
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });

  const statuses = students.map(s => aggregateStatus(s.payments as PrismaPayment[]));

  const totalRevenue = students.reduce(
    (sum, s) => sum + s.payments.reduce((ps, p) => ps + p.paidAmount, 0), 0
  );
  const totalDebt = students.reduce((sum, s) => {
    const agg = aggregatePayment(s.payments as PrismaPayment[]);
    if (agg) return sum + (agg.balance || 0);
    // Nxënës pa asnjë pagesë — borxhi është çmimi i pritshëm
    const expectedPrice = Math.round(category.defaultAmount * (1 - (s.discountPct ?? 0) / 100));
    return sum + expectedPrice;
  }, 0);

  // For installments display: return up to 2 (K1/K2); for aggregated view return all
  return NextResponse.json({
    category,
    students: students.map((s) => ({
      id:           s.id,
      firstName:    s.firstName,
      lastName:     s.lastName,
      parentPhone:  s.parentPhone,
      class:        s.class,
      discountPct:  s.discountPct,
      payment:      aggregatePayment(s.payments as PrismaPayment[]),
      installments: isNarrow ? s.payments.slice(0, 2) : [],
    })),
    stats: {
      total:    students.length,
      paid:     statuses.filter(st => st === "PAID").length,
      partial:  statuses.filter(st => st === "PARTIAL").length,
      overdue:  statuses.filter(st => st === "OVERDUE").length,
      pending:  statuses.filter(st => st === "PENDING").length,
      totalRevenue,
      totalDebt,
    },
  });
}
