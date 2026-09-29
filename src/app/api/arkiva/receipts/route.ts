import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function requireAccess() {
  const session = await auth();
  if (!session) return null;
  const role = (session.user as { role?: string })?.role;
  if (!["ADMIN", "SUPERADMIN", "FINANCE", "SECRETARY"].includes(role ?? "")) return null;
  return session;
}

export async function GET(req: NextRequest) {
  const session = await requireAccess();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "25");

  const where: Record<string, unknown> = {
    receiptNumber: { not: null },
    ...(search
      ? {
          OR: [
            { receiptNumber: { contains: search } },
            { student: { firstName: { contains: search } } },
            { student: { lastName: { contains: search } } },
          ],
        }
      : {}),
  };

  const [rows, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      select: {
        id: true, receiptNumber: true, finalAmount: true, paidDate: true, method: true,
        student: { select: { firstName: true, lastName: true } },
        category: { select: { name: true } },
      },
      orderBy: [{ paidDate: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.payment.count({ where }),
  ]);

  const receipts = rows.map(r => ({
    id: r.id, receiptNumber: r.receiptNumber, amount: r.finalAmount, paidDate: r.paidDate, method: r.method,
    studentName: `${r.student.firstName} ${r.student.lastName}`,
    categoryName: r.category.name,
  }));

  return NextResponse.json({ receipts, total, page, limit });
}
