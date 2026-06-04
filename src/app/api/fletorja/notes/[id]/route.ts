import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const note = await prisma.adminNote.update({
    where: { id: parseInt(id) },
    data: {
      title:    body.title    !== undefined ? body.title    : undefined,
      content:  body.content  !== undefined ? body.content  : undefined,
      color:    body.color    !== undefined ? body.color    : undefined,
      tags:     body.tags     !== undefined ? body.tags     : undefined,
      pinned:   body.pinned   !== undefined ? body.pinned   : undefined,
      archived: body.archived !== undefined ? body.archived : undefined,
    },
  });
  return NextResponse.json(note);
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.adminNote.delete({ where: { id: parseInt(id) } });
  return NextResponse.json({ ok: true });
}
