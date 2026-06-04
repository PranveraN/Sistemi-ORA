import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const task = await prisma.adminTask.update({
    where: { id: parseInt(id) },
    data: {
      title:       body.title       !== undefined ? body.title                      : undefined,
      description: body.description !== undefined ? body.description                : undefined,
      priority:    body.priority    !== undefined ? body.priority                   : undefined,
      dueDate:     body.dueDate     !== undefined ? (body.dueDate ? new Date(body.dueDate) : null) : undefined,
      assignedTo:  body.assignedTo  !== undefined ? body.assignedTo                : undefined,
      status:      body.status      !== undefined ? body.status                    : undefined,
    },
  });
  return NextResponse.json(task);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.adminTask.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
