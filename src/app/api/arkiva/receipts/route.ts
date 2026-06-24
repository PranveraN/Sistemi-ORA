import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "25");
  const offset = (page - 1) * limit;

  const searchFilter = search
    ? `AND (s.firstName || ' ' || s.lastName LIKE '%${search.replace(/'/g, "''")}%' OR p.receiptNumber LIKE '%${search.replace(/'/g, "''")}%')`
    : "";

  const rows = await prisma.$queryRawUnsafe<{
    id: number; receiptNumber: string; amount: number; paidDate: string | null;
    method: string | null; studentName: string; categoryName: string;
  }[]>(`
    SELECT p.id, p.receiptNumber, p.finalAmount AS amount, p.paidDate, p.method,
           s.firstName || ' ' || s.lastName AS studentName,
           pc.name AS categoryName
    FROM Payment p
    JOIN Student s ON s.id = p.studentId
    JOIN PaymentCategory pc ON pc.id = p.categoryId
    WHERE p.receiptNumber IS NOT NULL ${searchFilter}
    ORDER BY p.paidDate DESC, p.createdAt DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const [countRow] = await prisma.$queryRawUnsafe<{ total: bigint | number }[]>(`
    SELECT COUNT(*) as total
    FROM Payment p
    JOIN Student s ON s.id = p.studentId
    WHERE p.receiptNumber IS NOT NULL ${searchFilter}
  `);

  return NextResponse.json({ receipts: rows, total: Number(countRow.total), page, limit });
}
