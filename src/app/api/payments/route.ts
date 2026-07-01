import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function generateReceiptNumber(orgId: number): Promise<string> {
  const year = new Date().getFullYear();
  const last = await prisma.payment.findFirst({
    where: { organizationId: orgId, receiptNumber: { startsWith: `DEP-${year}-` } },
    orderBy: { receiptNumber: "desc" },
  });
  const lastSeq = last ? parseInt(last.receiptNumber!.split("-").pop() || "0") : 0;
  return `DEP-${year}-${String(lastSeq + 1).padStart(4, "0")}`;
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const status = searchParams.get("status") || "";
  const studentId = searchParams.get("studentId") || "";
  const month = searchParams.get("month") || "";
  const year = searchParams.get("year") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  const where: Record<string, unknown> = { organizationId: orgId };
  if (status) where.status = status;
  if (studentId) where.studentId = parseInt(studentId);
  if (month) where.month = parseInt(month);
  if (year) where.year = parseInt(year);
  if (search) {
    where.student = {
      OR: [
        { firstName: { contains: search } },
        { lastName: { contains: search } },
      ],
    };
  }

  const [payments, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      include: {
        student: { select: { id: true, firstName: true, lastName: true } },
        category: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);

  return NextResponse.json({ payments, total, page, limit });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const body = await req.json();

  const amount = parseFloat(body.amount);
  const discount = parseFloat(body.discount || 0);
  const scholarship = parseFloat(body.scholarship || 0);

  let discountAmount = discount;
  if (body.discountType === "percentage") {
    discountAmount = (amount * discount) / 100;
  }

  const finalAmount = Math.max(0, amount - discountAmount - scholarship);
  const paidAmount = parseFloat(body.paidAmount || 0);
  const balance = Math.max(0, finalAmount - paidAmount);

  let status = "PENDING";
  if (paidAmount >= finalAmount) status = "PAID";
  else if (paidAmount > 0) status = "PARTIAL";
  else if (new Date(body.dueDate) < new Date()) status = "OVERDUE";

  try {
    const receiptNumber = paidAmount > 0 ? await generateReceiptNumber(orgId) : undefined;

    const payment = await prisma.payment.create({
      data: {
        studentId: parseInt(body.studentId),
        categoryId: parseInt(body.categoryId),
        organizationId: orgId,
        amount,
        discount,
        discountType: body.discountType || null,
        scholarship,
        finalAmount,
        dueDate: new Date(body.dueDate),
        paidDate: paidAmount > 0 ? (body.paidDate ? new Date(body.paidDate) : new Date()) : null,
        paidAmount,
        balance,
        method: body.method || null,
        status,
        description: body.description || null,
        month: body.month ? parseInt(body.month) : null,
        year: body.year ? parseInt(body.year) : new Date().getFullYear(),
        receiptNumber,
      },
    });

    const userId = parseInt((session?.user as { id?: string } | undefined)?.id ?? "0");
    if (userId > 0) {
      await prisma.auditLog.create({
        data: {
          userId,
          action: "CREATE",
          entity: "Payment",
          entityId: payment.id,
          details: `Shtoi pagesë ${finalAmount} lekë për nxënësin ${body.studentId}`,
        },
      });
    }

    return NextResponse.json(payment, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Gabim i brendshëm";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
