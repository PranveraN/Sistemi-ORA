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
  const student = await prisma.timiInvestStudent.create({
    data: {
      firstName:    body.firstName    || "",
      lastName:     body.lastName     || "",
      parentName:   body.parentName   || "",
      parentPhone:  body.parentPhone  || "",
      regularPrice:  parseFloat(body.regularPrice)  || 0,
      discountPct:   parseFloat(body.discountPct)   || 0,
      manualDiscAmt: parseFloat(body.manualDiscAmt) || 0,
      notes:        body.notes || null,
      active:       true,
    },
  });
  return NextResponse.json(student, { status: 201 });
}
