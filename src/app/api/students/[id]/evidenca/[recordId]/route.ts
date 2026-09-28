import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

async function loadRecord(studentId: number, recordId: number) {
  const record = await prisma.studentEvidenca.findUnique({ where: { id: recordId } });
  if (!record || record.studentId !== studentId) return null;
  return record;
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string; recordId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, recordId } = await params;
  const existing = await loadRecord(parseInt(id), parseInt(recordId));
  if (!existing) return NextResponse.json({ error: "Evidenca s'u gjet" }, { status: 404 });

  const body = await req.json();
  const answers = body.answers && typeof body.answers === "object" ? body.answers : {};

  const record = await prisma.studentEvidenca.update({
    where: { id: existing.id },
    data: { answers: JSON.stringify(answers) },
    include: { author: { select: { name: true } } },
  });

  return NextResponse.json(record);
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string; recordId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, recordId } = await params;
  const existing = await loadRecord(parseInt(id), parseInt(recordId));
  if (!existing) return NextResponse.json({ error: "Evidenca s'u gjet" }, { status: 404 });

  await prisma.studentEvidenca.delete({ where: { id: existing.id } });

  return NextResponse.json({ success: true });
}
