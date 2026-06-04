import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const records: Record<string, string>[] = body.records;
  const month: number = body.month;
  const year: number  = body.year;

  if (!records?.length) {
    return NextResponse.json({ error: "Asnjë rekord nuk u dërgua" }, { status: 400 });
  }

  // Fetch all students with their class for matching
  const allStudents = await prisma.student.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true, class: { select: { name: true } } },
  });

  // Fetch or find the Ushqimi category
  const category = await prisma.paymentCategory.findFirst({
    where: { name: "Ushqimi" },
  });
  if (!category) {
    return NextResponse.json({ error: "Kategoria Ushqimi nuk u gjet" }, { status: 404 });
  }

  const dueDate = new Date(year, month - 1, 5);

  const results = { created: 0, updated: 0, skipped: 0, errors: [] as string[] };

  for (const row of records) {
    const firstName = String(row.firstName || "").trim();
    const lastName  = String(row.lastName  || "").trim();
    const klasa     = String(row.klasa     || "").trim();
    const amount    = parseFloat(row.amount    || "0");
    const paidAmount= parseFloat(row.paidAmount|| "0");
    const method    = String(row.method || "CASH").toUpperCase();
    const plan      = String(row.plan   || "").trim();

    if (!firstName && !lastName) { results.skipped++; continue; }

    // Match student: first try firstName + lastName + class, then just firstName + lastName
    const fn = firstName.toLowerCase();
    const ln = lastName.toLowerCase();
    let student = allStudents.find(s =>
      s.firstName.toLowerCase() === fn &&
      s.lastName.toLowerCase() === ln &&
      (klasa ? s.class?.name.toLowerCase() === klasa.toLowerCase() : true)
    );
    // Fallback without class if not found
    if (!student && klasa) {
      student = allStudents.find(s =>
        s.firstName.toLowerCase() === fn &&
        s.lastName.toLowerCase() === ln
      );
    }

    if (!student) {
      results.errors.push(`Nuk u gjet: ${firstName} ${lastName}${klasa ? ` (${klasa})` : ""}`);
      continue;
    }

    // Check if already has a payment for this month/year
    const existing = await prisma.payment.findFirst({
      where: { studentId: student.id, categoryId: category.id, month, year },
    });

    const balance = Math.max(0, amount - paidAmount);
    const status  = paidAmount >= amount && amount > 0 ? "PAID"
                  : paidAmount > 0 ? "PARTIAL"
                  : dueDate < new Date() ? "OVERDUE"
                  : "PENDING";

    const data = {
      studentId:    student.id,
      categoryId:   category.id,
      amount,
      discount:     0,
      discountType: null,
      scholarship:  0,
      finalAmount:  amount,
      dueDate,
      paidDate:     paidAmount > 0 ? new Date() : null,
      paidAmount,
      balance,
      method:       method || null,
      status,
      description:  plan || null,
      month,
      year,
    };

    if (existing) {
      await prisma.payment.update({ where: { id: existing.id }, data });
      results.updated++;
    } else {
      await prisma.payment.create({ data });
      results.created++;
    }
  }

  return NextResponse.json(results);
}
