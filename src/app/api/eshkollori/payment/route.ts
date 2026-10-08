import { NextRequest, NextResponse } from "next/server";
import { guardClosedDay } from "@/lib/audit/routeGuard";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { recordPaymentEvent } from "@/lib/studentHistory";
import { activeExemption, yearFee } from "@/lib/feeLedger";
import {
  requireEshkollori, getCategory, defaultFee, ensureYearRow, syncYearRow, baseOf, logChange, paymentStatus, round,
  OLD_DEBT, OLD_DEBT_CLOSED, yearLabel,
} from "@/lib/eshkollori";

async function receiptNumber(orgId: number): Promise<string> {
  const y = new Date().getFullYear();
  const last = await prisma.payment.findFirst({ where: { organizationId: orgId, receiptNumber: { startsWith: `DEP-${y}-` } }, orderBy: { receiptNumber: "desc" } });
  const seq = last ? parseInt(last.receiptNumber!.split("-").pop() || "0") : 0;
  return `DEP-${y}-${String(seq + 1).padStart(4, "0")}`;
}

// "+ Pagesë" (viti aktual) ose "Regjistro pagesë" te borxhi i vjetër (debtId).
// Metoda (Cash/Bankë) ruhet për arkën; s'shfaqet te tabela.
async function POST_handler(req: NextRequest) {
  const session = await auth();
  const a = requireEshkollori(session, true);
  if (a instanceof NextResponse) return a;
  const body = await req.json().catch(() => ({}));
  const studentId = parseInt(String(body.studentId)) || 0;
  const year = parseInt(String(body.year)) || 0;
  const amount = round(parseFloat(String(body.amount ?? "").replace(",", ".")) || 0);
  const method = body.method === "CASH" || body.method === "BANK" ? body.method : null;
  const paidDate = body.date ? new Date(body.date) : new Date();
  if (!studentId || amount <= 0) return NextResponse.json({ error: "Shkruani shumën e pagesës." }, { status: 400 });
  if (!method) return NextResponse.json({ error: "Zgjidhni mënyrën e pagesës (Cash ose Bankë)." }, { status: 400 });

  const cat = await getCategory(a.orgId);
  if (!cat) return NextResponse.json({ error: "Kategoria e Eshkollorit s'ekziston." }, { status: 404 });
  const student = await prisma.student.findFirst({ where: { id: studentId, organizationId: a.orgId }, select: { firstName: true, lastName: true } });
  if (!student) return NextResponse.json({ error: "Nxënësi nuk u gjet." }, { status: 404 });

  const debtId = body.debtId ? parseInt(String(body.debtId)) : null;
  try {
    const result = await prisma.$transaction(async (tx) => {
      let row;
      if (debtId) {
        row = await tx.payment.findFirst({ where: { id: debtId, studentId, categoryId: cat.id, description: OLD_DEBT, status: { notIn: OLD_DEBT_CLOSED } } });
        if (!row) throw new Error("Borxhi i vjetër s'u gjet.");
        if (amount > row.balance + 0.004) throw new Error(`Shuma kalon borxhin e mbetur (${row.balance.toFixed(2)} €).`);
      } else {
        if (!year) throw new Error("Viti mungon.");
        const def = await defaultFee(cat.id, cat.defaultAmount, year);
        row = await ensureYearRow(tx, a.orgId, cat.id, studentId, year, def);
        const exs = await tx.feeExemption.findMany({ where: { studentId, categoryId: cat.id, cancelledAt: null }, orderBy: { createdAt: "asc" } });
        const ex = activeExemption(exs, year);
        if (ex) row = await syncYearRow(tx, row.id, baseOf(row), ex);
        const { expected } = yearFee(baseOf(row), ex);
        if (expected <= 0) throw new Error("Nxënësi s'ka detyrim për këtë vit.");
        if (amount > Math.max(0, expected - row.paidAmount) + 0.004) throw new Error(`Shuma kalon borxhin e këtij viti (${Math.max(0, expected - row.paidAmount).toFixed(2)} €).`);
      }
      const paidAfter = round(row.paidAmount + amount);
      const updated = await tx.payment.update({
        where: { id: row.id },
        data: {
          paidAmount: paidAfter,
          balance: round(Math.max(0, row.finalAmount - paidAfter)),
          status: paymentStatus(row.finalAmount, paidAfter),
          method, paidDate,
          receiptNumber: row.receiptNumber ?? await receiptNumber(a.orgId),
        },
      });
      await logChange(tx, a, {
        studentId, categoryId: cat.id, year: debtId ? row.year : year, action: "PAYMENT",
        oldValue: row.paidAmount, newValue: paidAfter, refId: row.id,
        detail: `${amount.toFixed(2)} € (${method === "CASH" ? "Cash" : "Bankë"})${debtId ? ` për borxhin e vjetër ${row.year ? yearLabel(row.year) : ""}` : ""}`,
      });
      return { before: row.paidAmount, updated };
    });
    await recordPaymentEvent(session, {
      studentId, categoryName: cat.name, paidBefore: result.before, paidAfter: result.updated.paidAmount,
      paidDate, method, paymentId: result.updated.id, description: debtId ? "Borxh i vjetër" : null,
    }).catch(() => {});
    await logAction(session, "UPDATE", "Payment", result.updated.id,
      `Eshkollori: pagesë ${amount.toFixed(2)} € nga ${student.firstName} ${student.lastName}${debtId ? " (borxh i vjetër)" : ""}`);
    return NextResponse.json(result.updated, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : "Gabim" }, { status: 400 });
  }
}

// Refuzimi për ditë të mbyllur të arkës → 409 me mesazh (Faza 2 e auditimit)
export const POST = guardClosedDay(POST_handler);
