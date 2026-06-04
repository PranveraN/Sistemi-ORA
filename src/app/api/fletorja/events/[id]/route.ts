import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const event = await prisma.adminEvent.update({
    where: { id: parseInt(id) },
    data: {
      title:       body.title       !== undefined ? body.title                        : undefined,
      description: body.description !== undefined ? body.description                  : undefined,
      date:        body.date        !== undefined ? new Date(body.date)               : undefined,
      endDate:     body.endDate     !== undefined ? (body.endDate ? new Date(body.endDate) : null) : undefined,
      type:        body.type        !== undefined ? body.type                         : undefined,
      color:       body.color       !== undefined ? body.color                        : undefined,
      allDay:      body.allDay      !== undefined ? body.allDay                       : undefined,
    },
  });
  return NextResponse.json(event);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.adminEvent.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
