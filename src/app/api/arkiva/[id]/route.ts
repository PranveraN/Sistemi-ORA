import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [row] = await prisma.$queryRawUnsafe<{
    id: number; type: string; studentId: number | null; studentName: string;
    className: string | null; data: string; generatedBy: string | null; createdAt: string;
  }[]>(`SELECT * FROM DocArchive WHERE id = ${parseInt(id)}`);

  if (!row) return NextResponse.json({ error: "Nuk u gjet" }, { status: 404 });

  return NextResponse.json({ ...row, data: JSON.parse(row.data) });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await prisma.$executeRawUnsafe(`DELETE FROM DocArchive WHERE id = ${parseInt(id)}`);
  return NextResponse.json({ ok: true });
}
