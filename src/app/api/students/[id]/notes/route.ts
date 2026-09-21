import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Ditar/shënime manuale për nxënësin (shih StudentNote në schema.prisma) —
// vetëm-shtim, s'ka PUT/DELETE me qëllim (thjeshtësia e një ditari).

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const notes = await prisma.studentNote.findMany({
    where: { studentId: parseInt(id) },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(notes);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const content = String(body.content || "").trim();
  if (!content) return NextResponse.json({ error: "Shënimi s'mund të jetë bosh" }, { status: 400 });

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const authorId = parseInt((session.user as { id?: string } | undefined)?.id ?? "0");

  const note = await prisma.studentNote.create({
    data: {
      studentId: parseInt(id),
      content,
      authorId,
      organizationId: orgId,
    },
    include: { author: { select: { name: true } } },
  });

  return NextResponse.json(note, { status: 201 });
}
