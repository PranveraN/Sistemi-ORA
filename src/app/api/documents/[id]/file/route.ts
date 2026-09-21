import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readDocument } from "@/lib/document-storage";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const doc = await prisma.schoolDocument.findUnique({ where: { id: parseInt(id) } });
  if (!doc) return NextResponse.json({ error: "Nuk u gjet" }, { status: 404 });

  const buffer = await readDocument(doc.fileName);
  if (!buffer) return NextResponse.json({ error: "Skedari nuk u gjet në disk" }, { status: 404 });

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.originalFileName)}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
