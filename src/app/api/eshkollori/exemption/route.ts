import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { EXEMPTION_REASONS, activeExemption } from "@/lib/feeLedger";
import { requireEshkollori, getCategory, syncYearRow, baseOf, logChange, yearRowWhere, yearLabel } from "@/lib/eshkollori";

// "Liro nga pagesa" — falas plotësisht ose zbritje në %, për vitin ose "Deri sa ta ndryshoj".
// Lirimi i mëparshëm aktiv për të njëjtin vit anulohet (mbetet në histori).
export async function POST(req: NextRequest) {
  const session = await auth();
  const a = requireEshkollori(session, true);
  if (a instanceof NextResponse) return a;
  const body = await req.json().catch(() => ({}));
  const studentId = parseInt(String(body.studentId)) || 0;
  const year = parseInt(String(body.year)) || 0;
  const type = body.type === "PARTIAL" ? "PARTIAL" : body.type === "FULL" ? "FULL" : null;
  const percent = type === "PARTIAL" ? parseFloat(String(body.percent ?? "")) : null;
  const reason = String(body.reason ?? "");
  const reasonText = String(body.reasonText ?? "").trim();
  const untilYear = body.period === "OPEN" ? null : year;

  if (!studentId || !year || !type) return NextResponse.json({ error: "Zgjidhni llojin e lirimit.", field: "type" }, { status: 400 });
  if (type === "PARTIAL" && !(percent !== null && percent > 0 && percent < 100)) {
    return NextResponse.json({ error: "Shkruani përqindjen (1–99).", field: "percent" }, { status: 400 });
  }
  if (!EXEMPTION_REASONS.some(r => r.value === reason)) return NextResponse.json({ error: "Zgjidhni arsyen.", field: "reason" }, { status: 400 });
  if (reason === "OTHER" && !reasonText) return NextResponse.json({ error: "Shkruani arsyen.", field: "reasonText" }, { status: 400 });

  const cat = await getCategory(a.orgId);
  if (!cat) return NextResponse.json({ error: "Kategoria e Eshkollorit s'ekziston." }, { status: 404 });
  const student = await prisma.student.findFirst({ where: { id: studentId, organizationId: a.orgId }, select: { firstName: true, lastName: true } });
  if (!student) return NextResponse.json({ error: "Nxënësi nuk u gjet." }, { status: 404 });

  const reasonLabel = reason === "OTHER" ? reasonText : EXEMPTION_REASONS.find(r => r.value === reason)!.label;
  const created = await prisma.$transaction(async (tx) => {
    const existing = await tx.feeExemption.findMany({ where: { studentId, categoryId: cat.id, cancelledAt: null }, orderBy: { createdAt: "asc" } });
    const prev = activeExemption(existing, year);
    if (prev) {
      await tx.feeExemption.update({ where: { id: prev.id }, data: { cancelledAt: new Date(), cancelledById: a.userId, cancelledByName: a.userName, cancelReason: "Zëvendësuar me lirim të ri" } });
    }
    const ex = await tx.feeExemption.create({
      data: {
        organizationId: a.orgId, studentId, categoryId: cat.id, type, percent, reason, reasonText: reason === "OTHER" ? reasonText : null,
        fromYear: year, untilYear, createdById: a.userId, createdByName: a.userName,
      },
    });
    const row = await tx.payment.findFirst({ where: yearRowWhere(cat.id, year, studentId), orderBy: { id: "asc" } });
    if (row) await syncYearRow(tx, row.id, baseOf(row), ex);
    await logChange(tx, a, {
      studentId, categoryId: cat.id, year, action: "EXEMPT", reason: reasonLabel, refId: ex.id,
      detail: `${type === "FULL" ? "Falas plotësisht" : `Zbritje ${percent}%`} · ${untilYear === null ? "deri sa të ndryshohet" : `vetëm ${yearLabel(year)}`}`,
    });
    return ex;
  });
  await logAction(session, "CREATE", "FeeExemption", created.id,
    `Eshkollori: liroi ${student.firstName} ${student.lastName} (${type === "FULL" ? "falas" : `${percent}%`}) — ${reasonLabel}`);
  return NextResponse.json(created, { status: 201 });
}
