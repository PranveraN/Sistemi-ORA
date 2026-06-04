import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const done = searchParams.get("done");
  const type = searchParams.get("type") || "";

  const where: Record<string, unknown> = {};
  if (done !== null) where.done = done === "true";
  if (type) where.type = type;

  const reminders = await prisma.adminReminder.findMany({
    where,
    orderBy: { dueDate: "asc" },
  });

  return NextResponse.json(reminders);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const reminder = await prisma.adminReminder.create({
    data: {
      title:       body.title       || "Kujtesë",
      type:        body.type        || "GENERAL",
      dueDate:     new Date(body.dueDate),
      description: body.description || null,
      done:        false,
    },
  });

  return NextResponse.json(reminder, { status: 201 });
}
