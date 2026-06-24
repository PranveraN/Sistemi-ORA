import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "25");
  const offset = (page - 1) * limit;

  const searchFilter = search
    ? `AND (s.firstName || ' ' || s.lastName LIKE '%${search.replace(/'/g, "''")}%' OR i.number LIKE '%${search.replace(/'/g, "''")}%')`
    : "";

  const rows = await prisma.$queryRawUnsafe<{
    id: number; number: string; type: string; status: string; total: number;
    createdAt: string; studentName: string; className: string | null;
  }[]>(`
    SELECT i.id, i.number, i.type, i.status, i.total, i.createdAt,
           s.firstName || ' ' || s.lastName AS studentName,
           c.name AS className
    FROM Invoice i
    JOIN Student s ON s.id = i.studentId
    LEFT JOIN Class c ON c.id = s.classId
    WHERE 1=1 ${searchFilter}
    ORDER BY i.createdAt DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const [countRow] = await prisma.$queryRawUnsafe<{ total: bigint | number }[]>(`
    SELECT COUNT(*) as total
    FROM Invoice i
    JOIN Student s ON s.id = i.studentId
    WHERE 1=1 ${searchFilter}
  `);

  return NextResponse.json({ invoices: rows, total: Number(countRow.total), page, limit });
}
