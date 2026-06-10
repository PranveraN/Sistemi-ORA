import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const students = await prisma.timiInvestStudent.findMany({
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return NextResponse.json(students);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const now = new Date().toISOString();
  const studentId = body.studentId ? parseInt(body.studentId) : null;
  await prisma.$executeRawUnsafe(
    `INSERT INTO TimiInvestStudent (firstName, lastName, parentName, parentPhone, regularPrice, discountPct, manualDiscAmt, studentId, active, notes, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    body.firstName || "", body.lastName || "", body.parentName || "", body.parentPhone || "",
    parseFloat(body.regularPrice) || 0, parseFloat(body.discountPct) || 0,
    parseFloat(body.manualDiscAmt) || 0, studentId, body.notes || null, now, now
  );
  const [student] = await prisma.$queryRawUnsafe<Record<string, unknown>[]>(
    `SELECT * FROM TimiInvestStudent ORDER BY id DESC LIMIT 1`
  );
  return NextResponse.json(student, { status: 201 });
}
