import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { requireEshkollori, syncYearRow, baseOf, logChange, yearRowWhere } from "@/lib/eshkollori";

// Anulon një lirim (me arsye). S'fshihet — mbetet në histori me kush/kur/pse.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const a = requireEshkollori(session, true);
  if (a instanceof NextResponse) return a;
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const reason = String(body.reason ?? "").trim();
  const year = parseInt(String(body.year)) || 0;
  if (!reason) return NextResponse.json({ error: "Shkruani arsyen.", field: "reason" }, { status: 400 });

  const ex = await prisma.feeExemption.findFirst({ where: { id: parseInt(id) || 0, organizationId: a.orgId, cancelledAt: null } });
  if (!ex) return NextResponse.json({ error: "Lirimi nuk u gjet." }, { status: 404 });

  await prisma.$transaction(async (tx) => {
    await tx.feeExemption.update({ where: { id: ex.id }, data: { cancelledAt: new Date(), cancelledById: a.userId, cancelledByName: a.userName, cancelReason: reason } });
    const y = year || ex.fromYear;
    const row = await tx.payment.findFirst({ where: yearRowWhere(ex.categoryId, y, ex.studentId), orderBy: { id: "asc" } });
    if (row) await syncYearRow(tx, row.id, baseOf(row), null);
    await logChange(tx, a, { studentId: ex.studentId, categoryId: ex.categoryId, year: y, action: "EXEMPT_CANCEL", reason, refId: ex.id });
  });
  await logAction(session, "UPDATE", "FeeExemption", ex.id, `Eshkollori: anuloi lirimin e nxënësit #${ex.studentId} — ${reason}`);
  return NextResponse.json({ ok: true });
}
