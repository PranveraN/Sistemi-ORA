import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Të gjitha shitjet e Uniformës me borxh të mbetur (balance > 0) — përdoret nga
// faqja "Uniforma → Borxhet". UniSale s'ka relacion Prisma te Student (vetëm
// studentId opsional), ndaj klasa/telefoni merren veç e veç, si te profili i nxënësit.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sales = await prisma.uniSale.findMany({
    where: { balance: { gt: 0 } },
    orderBy: { saleDate: "asc" },
    include: { items: { include: { product: { select: { name: true } } } } },
  });

  const studentIds = [...new Set(sales.map(s => s.studentId).filter((id): id is number => id != null))];
  const students = studentIds.length
    ? await prisma.student.findMany({
        where: { id: { in: studentIds } },
        select: {
          id: true, firstName: true, lastName: true, status: true,
          class: { select: { name: true } },
          parentPhone: true, fatherPhone: true, motherPhone: true,
        },
      })
    : [];
  const studentMap = new Map(students.map(s => [s.id, s]));

  const rows = sales.map(s => ({
    id: s.id,
    studentId: s.studentId,
    student: s.studentId ? (studentMap.get(s.studentId) ?? null) : null,
    customerName: s.customerName,
    customerPhone: s.customerPhone,
    totalAmount: s.totalAmount,
    paidAmount: s.paidAmount,
    balance: s.balance,
    status: s.status,
    saleDate: s.saleDate,
    notes: s.notes,
    itemsSummary: s.items.length
      ? s.items.map(i => `${i.product.name}${i.size ? ` (${i.size})` : ""} x${i.quantity}`).join(", ")
      : null,
  }));

  return NextResponse.json({ sales: rows, total: rows.reduce((sum, r) => sum + r.balance, 0) });
}
