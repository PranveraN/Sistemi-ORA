import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Rreshtat e borxhit të vjetër ruhen si Payment normal, të taguar me
// description = "BORXH_VJETER" — kështu shfaqen gjithmonë pranë emrit
// (shih GET /api/category-payments) pavarësisht filtrit të vitit të
// zgjedhur në faqe, dhe shlyhen si çdo pagesë tjetër kur zyra regjistron
// një këst kundrejt tyre.
interface OldDebtRow {
  studentId: number;
  amount: number;
  note?: string;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const { categoryId, year, rows } = body as {
    categoryId: number;
    year: number;
    rows: OldDebtRow[];
  };

  if (!categoryId || !year || !rows?.length) {
    return NextResponse.json({ error: "Të dhëna të mangëta" }, { status: 400 });
  }

  const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

  for (const row of rows) {
    const amount = Number(row.amount) || 0;
    if (!row.studentId || amount <= 0) {
      results.skipped++;
      continue;
    }

    try {
      const existing = await prisma.payment.findFirst({
        where: { studentId: row.studentId, categoryId, description: "BORXH_VJETER" },
      });

      const data = {
        studentId:    row.studentId,
        categoryId,
        amount,
        discount:     0,
        discountType: "fixed",
        scholarship:  0,
        finalAmount:  amount,
        paidAmount:   0,
        balance:      amount,
        method:       null,
        dueDate:      new Date(year, 8, 1), // 1 Shtator i vitit të borxhit
        paidDate:     null,
        status:       "OVERDUE",
        description:  "BORXH_VJETER",
        note:         row.note || "Borxh i vjetër (importuar)",
        month:        null,
        year,
      };

      if (existing) {
        await prisma.payment.update({ where: { id: existing.id }, data });
        results.updated++;
      } else {
        await prisma.payment.create({ data });
        results.created++;
      }
    } catch (err) {
      results.errors.push(`Gabim te student #${row.studentId}: ${String(err)}`);
    }
  }

  return NextResponse.json(results);
}
