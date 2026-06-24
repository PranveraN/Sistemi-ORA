import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const type = searchParams.get("type") || "";
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "30");
  const offset = (page - 1) * limit;

  const typeFilter = type ? `AND type = '${type.replace(/'/g, "''")}'` : "";
  const searchFilter = search
    ? `AND (studentName LIKE '%${search.replace(/'/g, "''")}%' OR className LIKE '%${search.replace(/'/g, "''")}%')`
    : "";

  const rows = await prisma.$queryRawUnsafe<{
    id: number; type: string; studentId: number | null; studentName: string;
    className: string | null; generatedBy: string | null; createdAt: string;
  }[]>(`
    SELECT id, type, studentId, studentName, className, generatedBy, createdAt
    FROM DocArchive
    WHERE 1=1 ${typeFilter} ${searchFilter}
    ORDER BY createdAt DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  const [countRow] = await prisma.$queryRawUnsafe<{ total: bigint | number }[]>(`
    SELECT COUNT(*) as total FROM DocArchive WHERE 1=1 ${typeFilter} ${searchFilter}
  `);

  const safeRows = rows.map(r => ({
    ...r,
    id: Number(r.id),
    studentId: r.studentId != null ? Number(r.studentId) : null,
  }));

  return NextResponse.json({ docs: safeRows, total: Number(countRow.total), page, limit });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { type, studentId, studentName, className, data, generatedBy } = body;

  if (!type || !studentName) {
    return NextResponse.json({ error: "type dhe studentName janë të detyrueshme" }, { status: 400 });
  }

  const dataJson = typeof data === "string" ? data : JSON.stringify(data);
  const sid = studentId ? parseInt(String(studentId)) : null;

  const [row] = await prisma.$queryRawUnsafe<{ id: bigint | number }[]>(`
    INSERT INTO DocArchive (type, studentId, studentName, className, data, generatedBy, createdAt)
    VALUES (
      '${type.replace(/'/g, "''")}',
      ${sid === null ? "NULL" : sid},
      '${studentName.replace(/'/g, "''")}',
      ${className ? `'${className.replace(/'/g, "''")}'` : "NULL"},
      '${dataJson.replace(/'/g, "''")}',
      ${generatedBy ? `'${generatedBy.replace(/'/g, "''")}'` : "NULL"},
      datetime('now')
    )
    RETURNING id
  `);

  return NextResponse.json({ id: Number(row.id) }, { status: 201 });
}
