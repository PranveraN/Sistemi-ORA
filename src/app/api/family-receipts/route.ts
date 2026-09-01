import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

async function generateDepositReceiptNumber(orgId: number): Promise<string> {
  const year = new Date().getFullYear();
  const last = await prisma.payment.findFirst({
    where: { organizationId: orgId, receiptNumber: { startsWith: `DEP-${year}-` } },
    orderBy: { receiptNumber: "desc" },
  });
  const lastSeq = last ? parseInt(last.receiptNumber!.split("-").pop() || "0") : 0;
  return `DEP-${year}-${String(lastSeq + 1).padStart(4, "0")}`;
}

async function generateFamilyReceiptNumber(orgId: number): Promise<string> {
  const year = new Date().getFullYear();
  const last = await prisma.familyReceipt.findFirst({
    where: { organizationId: orgId, receiptNumber: { startsWith: `FAM-${year}-` } },
    orderBy: { receiptNumber: "desc" },
  });
  const lastSeq = last ? parseInt(last.receiptNumber.split("-").pop() || "0") : 0;
  return `FAM-${year}-${String(lastSeq + 1).padStart(4, "0")}`;
}

export interface FamilyReceiptChildInput {
  studentId: number;
  categoryId: number;
  amount: number;
  discount?: number;
  discountType?: string | null;
  scholarship?: number;
  paidAmount: number;
  method?: string | null;
  dueDate: string;
  paidDate?: string | null;
  month?: number | null;
  year?: number | null;
  description?: string | null;
  note?: string | null;
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const body = await req.json();
  const { parentName, parentPhone, method, children } = body as {
    parentName?: string; parentPhone?: string; method?: string;
    children: FamilyReceiptChildInput[];
  };

  if (!children?.length || children.length < 2) {
    return NextResponse.json({ error: "Duhen të paktën 2 fëmijë për një pagesë të përbashkët" }, { status: 400 });
  }

  const familyReceiptNumber = await generateFamilyReceiptNumber(orgId);
  const familyReceipt = await prisma.familyReceipt.create({
    data: {
      receiptNumber: familyReceiptNumber,
      parentName: parentName || null,
      parentPhone: parentPhone || null,
      method: method || null,
      totalAmount: 0,
      organizationId: orgId,
    },
  });

  const paymentIds: number[] = [];
  let totalAmount = 0;

  // Sekuencial (jo Promise.all) — çdo receiptNumber DEP- gjenerohet nga "gjej max +1",
  // ndaj rreshtat paralelë mund të merrnin gabimisht të njëjtin numër.
  for (const child of children) {
    const amount = parseFloat(String(child.amount)) || 0;
    const discount = parseFloat(String(child.discount || 0)) || 0;
    const scholarship = parseFloat(String(child.scholarship || 0)) || 0;
    let discountAmount = discount;
    if (child.discountType === "percentage") discountAmount = (amount * discount) / 100;
    const finalAmount = Math.max(0, amount - discountAmount - scholarship);
    const paidAmount = parseFloat(String(child.paidAmount || 0)) || 0;
    const balance = Math.max(0, finalAmount - paidAmount);
    const dueDate = new Date(child.dueDate);
    const month = child.month ?? null;
    const year = child.year ?? new Date().getFullYear();

    let status = "PENDING";
    if (paidAmount >= finalAmount) status = "PAID";
    else if (paidAmount > 0) status = "PARTIAL";
    else if (dueDate < new Date()) status = "OVERDUE";

    const existing = await prisma.payment.findFirst({
      where: { studentId: child.studentId, categoryId: child.categoryId, ...(month ? { month, year } : { year }) },
    });

    const data = {
      studentId: child.studentId,
      categoryId: child.categoryId,
      organizationId: orgId,
      amount,
      discount,
      discountType: child.discountType || null,
      scholarship,
      finalAmount,
      dueDate,
      paidDate: paidAmount > 0 ? (child.paidDate ? new Date(child.paidDate) : new Date()) : null,
      paidAmount,
      balance,
      method: method || child.method || null,
      status,
      description: child.description || null,
      note: child.note || null,
      month,
      year,
      familyReceiptId: familyReceipt.id,
    };

    let paymentId: number;
    if (existing) {
      const receiptNumber = paidAmount > 0 && !existing.receiptNumber ? await generateDepositReceiptNumber(orgId) : undefined;
      const updated = await prisma.payment.update({
        where: { id: existing.id },
        data: receiptNumber ? { ...data, receiptNumber } : data,
      });
      paymentId = updated.id;
    } else {
      const receiptNumber = paidAmount > 0 ? await generateDepositReceiptNumber(orgId) : undefined;
      const created = await prisma.payment.create({ data: { ...data, receiptNumber } });
      paymentId = created.id;
    }
    paymentIds.push(paymentId);
    totalAmount += paidAmount;
  }

  await prisma.familyReceipt.update({ where: { id: familyReceipt.id }, data: { totalAmount } });

  await logAction(session, "CREATE", "FamilyReceipt", familyReceipt.id,
    `Regjistroi pagesë të përbashkët familjeje (${familyReceiptNumber}) për ${children.length} fëmijë, gjithsej ${totalAmount.toFixed(2)}€`);

  return NextResponse.json({ id: familyReceipt.id, receiptNumber: familyReceiptNumber, paymentIds, totalAmount }, { status: 201 });
}
