import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const invoices = await prisma.timiInvestInvoice.findMany({
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(invoices);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const date = body.date ? new Date(body.date) : new Date();
  const month = date.getMonth() + 1;
  const year  = date.getFullYear();

  const last = await prisma.timiInvestInvoice.findFirst({
    where: { month, year },
    orderBy: { seq: "desc" },
  });
  const seq    = last ? last.seq + 1 : 1;
  const number = `SHM${String(seq).padStart(2, "0")}/${String(month).padStart(2, "0")}-${year}`;

  const totalAmount = parseFloat(body.totalAmount) || 0;
  const timiDiscPct = parseFloat(body.timiDiscPct) || 5;
  const timiDiscAmt = Math.round(totalAmount * timiDiscPct) / 100;
  const finalAmount = Math.round((totalAmount - timiDiscAmt) * 100) / 100;

  const invoice = await prisma.timiInvestInvoice.create({
    data: {
      number,
      seq,
      month,
      year,
      parentName:  body.parentName || "",
      date,
      items:       JSON.stringify(body.items || []),
      timiStudentIds: Array.isArray(body.timiStudentIds) ? JSON.stringify(body.timiStudentIds) : null,
      totalAmount,
      timiDiscPct,
      timiDiscAmt,
      finalAmount,
      notes:       body.notes      || null,
      schoolYear:  body.schoolYear || null,
    },
  });

  // Sinkronizo discountPct dhe lidh TI studentët me Student records
  if (Array.isArray(body.timiStudentIds) && body.timiStudentIds.length > 0) {
    const shkollimi = await prisma.paymentCategory.findFirst({ where: { name: "Shkollimi" } });
    const globalPrice = shkollimi?.defaultAmount || 2000;

    for (const timiId of body.timiStudentIds) {
      const rows = await prisma.$queryRawUnsafe<{ studentId: number | null; firstName: string; lastName: string; regularPrice: number; discountPct: number; manualDiscAmt: number }[]>(
        `SELECT studentId, firstName, lastName, regularPrice, discountPct, manualDiscAmt FROM TimiInvestStudent WHERE id=?`, Number(timiId)
      );
      if (!rows[0]) continue;

      let { studentId, firstName, lastName, regularPrice, discountPct, manualDiscAmt } = rows[0];

      // Nëse nuk ka lidhje direkte, provo ta gjesh nxënësin sipas emrit+mbiemrit
      if (!studentId) {
        const matches = await prisma.$queryRawUnsafe<{ id: number }[]>(
          `SELECT id FROM Student WHERE LOWER(TRIM(firstName)) = LOWER(TRIM(?)) AND LOWER(TRIM(lastName)) = LOWER(TRIM(?)) AND status = 'ACTIVE' LIMIT 1`,
          firstName, lastName
        );
        if (matches[0]) {
          studentId = Number(matches[0].id);
          // Krijo lidhjen e drejtpërdrejtë TI → Student
          await prisma.$executeRawUnsafe(
            `UPDATE TimiInvestStudent SET studentId = ? WHERE id = ?`,
            studentId, Number(timiId)
          );
        }
      }

      if (!studentId) continue;

      const effectivePrice = Math.max(0, regularPrice * (1 - discountPct / 100) - (manualDiscAmt || 0));
      const newDiscountPct = Math.max(0, Math.round((1 - effectivePrice / globalPrice) * 10000) / 100);

      await prisma.student.update({
        where: { id: Number(studentId) },
        data: { discountPct: newDiscountPct },
      });
    }
  }

  return NextResponse.json(invoice, { status: 201 });
}
