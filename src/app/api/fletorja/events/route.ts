import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year  = searchParams.get("year");
  const month = searchParams.get("month"); // 0-indexed

  const where: Record<string, unknown> = {};
  if (year && month !== null) {
    const y = parseInt(year);
    const m = parseInt(month);
    const start = new Date(y, m, 1);
    const end   = new Date(y, m + 1, 1);
    where.date = { gte: start, lt: end };
  }

  const events = await prisma.adminEvent.findMany({
    where,
    orderBy: { date: "asc" },
  });

  return NextResponse.json(events);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const event = await prisma.adminEvent.create({
    data: {
      title:       body.title       || "Event",
      description: body.description || null,
      date:        new Date(body.date),
      endDate:     body.endDate     ? new Date(body.endDate) : null,
      type:        body.type        || "GENERAL",
      color:       body.color       || "blue",
      allDay:      body.allDay      ?? true,
    },
  });

  return NextResponse.json(event, { status: 201 });
}
