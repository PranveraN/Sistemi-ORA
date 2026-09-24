import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getDateRange, getAcademicMonths, DEFAULT_ACADEMIC_YEAR, type YearType } from "@/lib/academicYear";
import { aggregatePaymentTotals } from "@/lib/paymentAggregate";

interface Row { studentId: number; name: string; phone: string; amount: number; type?: "FULL" | "PARTIAL" }

// Listat e emrave pas kutive "Pasqyrë Shkollimi" te Dashboard (Pritet/Paguar/
// Borxh/Përmes TIMI Invest) — E NJËJTA bazë llogaritjeje si /api/dashboard
// (tuitionAccrualWhere, TI-KRYER e përjashtuar nga Pritet/Paguar/Borxh, vetëm
// shumat e KONFIRMUARA si "Paguar"), që totalet e listave të përputhen
// gjithmonë me totalet e shfaqura sipër tyre.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const { searchParams } = new URL(req.url);
  const year     = parseInt(searchParams.get("year") || String(DEFAULT_ACADEMIC_YEAR));
  const yearType = (searchParams.get("yearType") || "academic") as YearType;
  const { start, end } = getDateRange(year, yearType);
  const months = yearType === "academic"
    ? getAcademicMonths(year)
    : Array.from({ length: 12 }, (_, i) => ({ calMonth: i + 1, calYear: year }));

  const shkollimiCategory = await prisma.paymentCategory.findFirst({ where: { name: "Shkollimi", organizationId: orgId } });
  if (!shkollimiCategory) {
    return NextResponse.json({ expected: [], paid: [], debt: [], timiInvest: [] });
  }

  const tuitionWhere = yearType === "academic"
    ? { organizationId: orgId, categoryId: shkollimiCategory.id, OR: months.map(m => ({ month: m.calMonth, year: m.calYear })) }
    : { organizationId: orgId, categoryId: shkollimiCategory.id, dueDate: { gte: start, lte: end } };

  const [tuitionRows, timiInvestLinks] = await Promise.all([
    prisma.payment.findMany({
      where: tuitionWhere,
      select: { studentId: true, finalAmount: true, paidAmount: true, confirmed: true, description: true },
    }),
    prisma.timiInvestStudent.findMany({
      where: { active: true, stage: "KRYER", studentId: { not: null } },
      select: { studentId: true, regularPrice: true, discountPct: true, manualDiscAmt: true },
    }),
  ]);

  const timiKryerIds = new Set(timiInvestLinks.map(t => t.studentId as number));

  const byStudent = new Map<number, { finalAmount: number; paidAmount: number; confirmed: boolean; description: string | null }[]>();
  for (const p of tuitionRows) {
    const arr = byStudent.get(p.studentId) ?? [];
    arr.push(p);
    byStudent.set(p.studentId, arr);
  }

  const neededIds = Array.from(new Set([...byStudent.keys(), ...timiKryerIds]));
  const students = await prisma.student.findMany({
    where: { id: { in: neededIds } },
    select: { id: true, firstName: true, lastName: true, parentPhone: true, fatherPhone: true, motherPhone: true },
  });
  const studentMap = new Map(students.map(s => [s.id, s]));

  const expected: Row[] = [], paid: Row[] = [], debt: Row[] = [];
  for (const [studentId, rows] of byStudent) {
    if (timiKryerIds.has(studentId)) continue; // shih dashboard/route.ts — të njëjtin përjashtim
    const s = studentMap.get(studentId);
    if (!s) continue;
    const name = `${s.firstName} ${s.lastName}`;
    const phone = s.parentPhone || s.fatherPhone || s.motherPhone || "";
    const { finalAmount, balance } = aggregatePaymentTotals(rows);
    const confirmedPaid = rows.filter(r => r.confirmed).reduce((sum, r) => sum + r.paidAmount, 0);

    expected.push({ studentId, name, phone, amount: Math.round(finalAmount * 100) / 100 });
    if (confirmedPaid > 0) {
      paid.push({ studentId, name, phone, amount: Math.round(confirmedPaid * 100) / 100, type: balance <= 0 ? "FULL" : "PARTIAL" });
    }
    if (balance > 0) {
      debt.push({ studentId, name, phone, amount: Math.round(balance * 100) / 100 });
    }
  }

  const timiInvest: Row[] = timiInvestLinks.map(t => {
    const discAmt = t.regularPrice * (t.discountPct / 100);
    const amount = Math.max(0, t.regularPrice - discAmt - (t.manualDiscAmt || 0));
    const s = t.studentId ? studentMap.get(t.studentId) : undefined;
    return {
      studentId: t.studentId as number,
      name: s ? `${s.firstName} ${s.lastName}` : "—",
      phone: s ? (s.parentPhone || s.fatherPhone || s.motherPhone || "") : "",
      amount: Math.round(amount * 100) / 100,
    };
  });

  const byAmountDesc = (a: Row, b: Row) => b.amount - a.amount;
  return NextResponse.json({
    expected: expected.sort(byAmountDesc),
    paid: paid.sort(byAmountDesc),
    debt: debt.sort(byAmountDesc),
    timiInvest: timiInvest.sort(byAmountDesc),
  });
}
