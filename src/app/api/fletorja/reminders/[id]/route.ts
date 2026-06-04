import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const reminder = await prisma.adminReminder.update({
    where: { id: parseInt(id) },
    data: {
      title:       body.title       !== undefined ? body.title                        : undefined,
      type:        body.type        !== undefined ? body.type                         : undefined,
      dueDate:     body.dueDate     !== undefined ? new Date(body.dueDate)            : undefined,
      description: body.description !== undefined ? body.description                  : undefined,
      done:        body.done        !== undefined ? body.done                         : undefined,
    },
  });
  return NextResponse.json(reminder);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.adminReminder.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
