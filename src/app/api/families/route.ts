import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const phone = searchParams.get("phone") || "";
  const name  = searchParams.get("name")  || "";

  if (!phone && !name) {
    return NextResponse.json({ error: "Kërko me numër telefoni ose emër prindi" }, { status: 400 });
  }

  // Gjej të gjithë nxënësit e familjes
  const where = phone
    ? {
        OR: [
          { parentPhone: { contains: phone } },
          { fatherPhone: { contains: phone } },
          { motherPhone: { contains: phone } },
        ],
      }
    : {
        OR: [
          { parentName: { contains: name } },
          { fatherName: { contains: name } },
          { motherName: { contains: name } },
        ],
      };

  const students = await prisma.student.findMany({
    where,
    include: {
      class: { select: { id: true, name: true, level: true } },
      payments: {
        include: { category: { select: { name: true, defaultAmount: true } } },
        orderBy: { createdAt: "desc" },
      },
    },
    orderBy: [{ firstName: "asc" }],
  });

  if (students.length === 0) {
    return NextResponse.json({ students: [], parent: null });
  }

  // Merr kategorinë e shkollimit për çmimin bazë
  const shkollimi = await prisma.paymentCategory.findFirst({
    where: { name: { contains: "Shkollim" } },
  });
  const basePrice = shkollimi?.defaultAmount ?? 2000;

  // Nderto profilin e fëmijëve
  const children = students.map(s => {
    const finalPrice = Math.round(basePrice * (1 - (s.discountPct ?? 0) / 100));
    const totalPaid  = s.payments.reduce((sum, p) => sum + p.paidAmount, 0);
    const debt       = Math.max(0, finalPrice - totalPaid);

    // Pagesat sipas kategorisë
    const byCategory: Record<string, { paid: number; final: number; status: string }> = {};
    for (const p of s.payments) {
      const cat = p.category.name;
      if (!byCategory[cat]) byCategory[cat] = { paid: 0, final: 0, status: p.status };
      byCategory[cat].paid  += p.paidAmount;
      byCategory[cat].final += p.finalAmount;
    }

    return {
      id:             s.id,
      firstName:      s.firstName,
      lastName:       s.lastName,
      personalNumber: s.personalNumber,
      diaryNumber:    s.diaryNumber,
      class:          s.class,
      status:         s.status,
      enrollDate:     s.enrollDate,
      discountPct:    s.discountPct,
      finalPrice,
      totalPaid,
      debt,
      kontrata:       s.kontrata,
      byCategory,
    };
  });

  // Info prindi — merr nga i pari
  const first = students[0];
  const parent = {
    name:        first.fatherName || first.motherName || first.parentName || "—",
    fatherName:  first.fatherName,
    fatherPhone: first.fatherPhone,
    motherName:  first.motherName,
    motherPhone: first.motherPhone,
    parentPhone: first.parentPhone,
    address:     first.address,
  };

  const totalFinalFamily = children.reduce((s, c) => s + c.finalPrice, 0);
  const totalPaidFamily  = children.reduce((s, c) => s + c.totalPaid, 0);
  const totalDebtFamily  = children.reduce((s, c) => s + c.debt, 0);

  return NextResponse.json({
    parent,
    children,
    summary: { totalFinal: totalFinalFamily, totalPaid: totalPaidFamily, totalDebt: totalDebtFamily },
  });
}
