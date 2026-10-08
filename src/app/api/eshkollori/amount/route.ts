import { NextRequest, NextResponse } from "next/server";
import { guardClosedDay } from "@/lib/audit/routeGuard";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { activeExemption } from "@/lib/feeLedger";
import { requireEshkollori, getCategory, defaultFee, ensureYearRow, syncYearRow, baseOf, logChange, round, yearLabel } from "@/lib/eshkollori";

// "Ndrysho shumën" e vitit për një nxënës — vetëm ai nxënës; arsyeja e detyrueshme.
async function POST_handler(req: NextRequest) {
  const session = await auth();
  const a = requireEshkollori(session, true);
  if (a instanceof NextResponse) return a;
  const body = await req.json().catch(() => ({}));
  const studentId = parseInt(String(body.studentId)) || 0;
  const year = parseInt(String(body.year)) || 0;
  const amount = round(parseFloat(String(body.amount ?? "").replace(",", ".")));
  const reason = String(body.reason ?? "").trim();
  if (!studentId || !year) return NextResponse.json({ error: "Të dhëna të mangëta." }, { status: 400 });
  if (!Number.isFinite(amount) || amount < 0) return NextResponse.json({ error: "Shkruani shumën e re.", field: "amount" }, { status: 400 });
  if (!reason) return NextResponse.json({ error: "Shkruani arsyen.", field: "reason" }, { status: 400 });

  const cat = await getCategory(a.orgId);
  if (!cat) return NextResponse.json({ error: "Kategoria e Eshkollorit s'ekziston." }, { status: 404 });
  const student = await prisma.student.findFirst({ where: { id: studentId, organizationId: a.orgId }, select: { firstName: true, lastName: true } });
  if (!student) return NextResponse.json({ error: "Nxënësi nuk u gjet." }, { status: 404 });

  const def = await defaultFee(cat.id, cat.defaultAmount, year);
  const res = await prisma.$transaction(async (tx) => {
    const row = await ensureYearRow(tx, a.orgId, cat.id, studentId, year, def);
    const before = baseOf(row);
    const exs = await tx.feeExemption.findMany({ where: { studentId, categoryId: cat.id, cancelledAt: null }, orderBy: { createdAt: "asc" } });
    const updated = await syncYearRow(tx, row.id, amount, activeExemption(exs, year));
    await logChange(tx, a, { studentId, categoryId: cat.id, year, action: "AMOUNT", oldValue: before, newValue: amount, reason, refId: row.id });
    return { before, updated };
  });
  await logAction(session, "UPDATE", "Payment", res.updated.id,
    `Eshkollori ${yearLabel(year)}: ndryshoi shumën e ${student.firstName} ${student.lastName} nga ${res.before.toFixed(2)} € në ${amount.toFixed(2)} € — ${reason}`);
  return NextResponse.json(res.updated);
}

// Refuzimi për ditë të mbyllur të arkës → 409 me mesazh (Faza 2 e auditimit)
export const POST = guardClosedDay(POST_handler);
