import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "monthly";
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

  if (type === "monthly") {
    const data = [];
    for (let m = 1; m <= 12; m++) {
      const firstDay = new Date(year, m - 1, 1);
      const lastDay = new Date(year, m, 0, 23, 59, 59);

      const result = await prisma.payment.aggregate({
        where: {
          paidDate: { gte: firstDay, lte: lastDay },
          status: { in: ["PAID", "PARTIAL"] },
        },
        _sum: { paidAmount: true },
        _count: true,
      });

      data.push({
        month: m,
        total: result._sum.paidAmount || 0,
        count: result._count,
      });
    }
    return NextResponse.json({ type: "monthly", year, data });
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
    const studentsWithDebt = await prisma.student.findMany({
      where: {
        status: "ACTIVE",
        payments: {
          some: { balance: { gt: 0 } },
        },
      },
      include: {
        class: { select: { name: true } },
        payments: {
          where: { balance: { gt: 0 } },
          include: { category: { select: { name: true } } },
        },
      },
      orderBy: { lastName: "asc" },
    });

    return NextResponse.json({
      type: "debts",
      data: studentsWithDebt.map(s => ({
        id: s.id,
        name: `${s.lastName} ${s.firstName}`,
        class: s.class?.name || "—",
        totalDebt: s.payments.reduce((sum, p) => sum + p.balance, 0),
        payments: s.payments,
      })),
    });
  }

  return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
}
