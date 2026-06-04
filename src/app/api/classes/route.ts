import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const classes = await prisma.class.findMany({
    include: { _count: { select: { students: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(classes);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const cls = await prisma.class.create({
    data: { name: body.name, level: body.level, teacher: body.teacher || null },
  });

  return NextResponse.json(cls, { status: 201 });
}
