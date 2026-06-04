import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const data = body.data ? new Date(body.data).toISOString() : undefined;

  await prisma.$executeRawUnsafe(
    `UPDATE Shpenzim SET
      kategoriId = COALESCE(?, kategoriId),
      shuma      = COALESCE(?, shuma),
      pershkrim  = ?,
      marres     = ?,
      data       = COALESCE(?, data),
      metoda     = ?,
      referenca  = ?,
      docType    = COALESCE(?, docType),
      updatedAt  = datetime('now')
     WHERE id = ?`,
    body.kategoriId ? parseInt(body.kategoriId) : null,
    body.shuma ? parseFloat(body.shuma) : null,
    body.pershkrim ?? null, body.marres ?? null,
    data ?? null, body.metoda ?? null, body.referenca ?? null,
    body.docType ?? null,
    parseInt(id)
  );
  return NextResponse.json({ success: true });
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.$executeRawUnsafe(`DELETE FROM Shpenzim WHERE id = ?`, parseInt(id));
  return NextResponse.json({ success: true });
}
