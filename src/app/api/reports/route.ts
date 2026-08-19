import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDateRange, getAcademicMonths, type YearType } from "@/lib/academicYear";
import { aggregatePaymentTotals } from "@/lib/paymentAggregate";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type     = searchParams.get("type") || "monthly";
  const year     = parseInt(searchParams.get("year") || String(new Date().getFullYear()));
  const yearType = (searchParams.get("yearType") || "calendar") as YearType;

  const { start, end, label } = getDateRange(year, yearType);

  const months = yearType === "academic"
    ? getAcademicMonths(year)
    : Array.from({ length: 12 }, (_, i) => ({
        calMonth: i + 1,
        calYear:  year,
        label: ["Janar","Shkurt","Mars","Prill","Maj","Qershor","Korrik","Gusht","Shtator","Tetor","Nëntor","Dhjetor"][i],
      }));

  if (type === "monthly") {
    const data = [];
    for (const m of months) {
      const firstDay = new Date(m.calYear, m.calMonth - 1, 1);
      const lastDay  = new Date(m.calYear, m.calMonth, 0, 23, 59, 59);

      const result = await prisma.payment.aggregate({
        where: {
          paidDate: { gte: firstDay, lte: lastDay },
          status: { in: ["PAID", "PARTIAL"] },
        },
        _sum: { paidAmount: true },
        _count: true,
      });

      data.push({
        month: m.calMonth,
        year:  m.calYear,
        label: m.label,
        total: result._sum.paidAmount || 0,
        count: result._count,
      });
    }
    return NextResponse.json({ type: "monthly", year, yearType, label, data });
  }

  if (type === "byClass") {
    const classes = await prisma.class.findMany({
      include: {
        students: {
          include: {
            payments: {
              where: {
                year,
                status: { in: ["PAID", "PARTIAL"] },
              },
            },
          },
        },
      },
    });

    const data = classes.map(cls => ({
      className: cls.name,
      level: cls.level,
      studentCount: cls.students.length,
      totalRevenue: cls.students.reduce((sum, s) => {
        return sum + s.payments.reduce((ps, p) => ps + p.paidAmount, 0);
      }, 0),
    }));

    return NextResponse.json({ type: "byClass", year, data });
  }

  if (type === "debts") {
    const shkollimi = await prisma.paymentCategory.findFirst({
      where: { name: { contains: "Shkollim" } },
    });
    const basePrice = shkollimi?.defaultAmount ?? 0;

    const allActive = await prisma.student.findMany({
      where: { status: "ACTIVE" },
      include: {
        class: { select: { name: true } },
        // Kufizuar vetëm te kategoria "Shkollimi" — "finalPrice" më poshtë
        // është çmimi i Shkollimit, prandaj "Paguar"/"Borxhi" duhet të
        // krahasohen vetëm me pagesat e Shkollimit, jo me gjithë kategoritë
        // bashkë (Ushqimi, Eshkollori, etj), të cilat kanë çmimet e tyre të
        // veçanta dhe s'duhen përzier këtu.
        payments: {
          where: { paidDate: { gte: start, lte: end }, ...(shkollimi ? { categoryId: shkollimi.id } : {}) },
          include: { category: { select: { name: true } } },
        },
      },
      orderBy: { lastName: "asc" },
    });

    const result = allActive
      .map(s => {
        // Njësoj si te /api/students dhe /api/reports/families — nëse ka plan
        // real, "Çmimi Final" merret prej tij, jo prej përllogaritjes sintetike.
        // `aggregatePaymentTotals` (jo mbledhje e thjeshtë e `finalAmount`/
        // `balance`) trajton saktë Këste Fleksibël (FLEX_HEADER + FLEX_PAY_N) —
        // mbledhja e drejtpërdrejtë e `.balance` do të tregonte GJITHMONË
        // borxhin e PLOTË (2000€), sepse `balance` i header-it vetë s'ndryshon
        // kurrë ndërsa pagesat regjistrohen si rekorde krejt të veçanta.
        const agg = aggregatePaymentTotals(s.payments);
        const finalPrice = s.payments.length > 0 ? agg.finalAmount : Math.round(basePrice * (1 - (s.discountPct ?? 0) / 100));
        const totalPaid  = agg.paidAmount;

        // Nëse nuk ka asnjë pagesë, borxhi = çmimi i plotë
        const totalDebt = s.payments.length === 0
          ? finalPrice
          : agg.balance;

        const paymentsWithDebt = s.payments.filter(p => p.balance > 0);

        return {
          id:        s.id,
          name:      `${s.lastName} ${s.firstName}`,
          class:     s.class?.name || "—",
          totalDebt,
          totalPaid,
          finalPrice,
          noPay:     s.payments.length === 0,
          payments:  paymentsWithDebt,
        };
      })
      .filter(s => s.totalDebt > 0)
      .sort((a, b) => b.totalDebt - a.totalDebt);

    return NextResponse.json({ type: "debts", data: result });
  }

  if (type === "invoices") {
    const invoices = await prisma.invoice.findMany({
      where: {
        type: "INVOICE",
        createdAt: { gte: start, lte: end },
      },
      include: {
        student: {
          select: {
            firstName: true,
            lastName: true,
            class: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const data = invoices.map(inv => ({
      id:          inv.id,
      number:      inv.number,
      studentName: `${inv.student.lastName} ${inv.student.firstName}`,
      className:   inv.student.class?.name || "—",
      total:       inv.total,
      status:      inv.status,
      date:        inv.createdAt.toISOString(),
      paidDate:    inv.paidDate?.toISOString() ?? null,
    }));

    const totalAmount  = data.reduce((s, d) => s + d.total, 0);
    const paidAmount   = data.filter(d => d.status === "PAID").reduce((s, d) => s + d.total, 0);
    const pendingAmount = data.filter(d => d.status !== "PAID" && d.status !== "CANCELLED").reduce((s, d) => s + d.total, 0);

    return NextResponse.json({ type: "invoices", year, label, data, totalAmount, paidAmount, pendingAmount });
  }

  return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
}
