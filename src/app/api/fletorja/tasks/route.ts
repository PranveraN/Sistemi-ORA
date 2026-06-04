import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const status   = searchParams.get("status")   || "";
  const priority = searchParams.get("priority") || "";
  const search   = searchParams.get("search")   || "";

  const where: Record<string, unknown> = {};
  if (status)   where.status   = status;
  if (priority) where.priority = priority;
  if (search)   where.OR = [
    { title: { contains: search } },
    { description: { contains: search } },
    { assignedTo: { contains: search } },
  ];

  const tasks = await prisma.adminTask.findMany({
    where,
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(tasks);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const task = await prisma.adminTask.create({
    data: {
      title:       body.title       || "Pa titull",
      description: body.description || null,
      priority:    body.priority    || "MEDIUM",
      dueDate:     body.dueDate     ? new Date(body.dueDate) : null,
      assignedTo:  body.assignedTo  || null,
      status:      body.status      || "TODO",
    },
  });

  return NextResponse.json(task, { status: 201 });
}
