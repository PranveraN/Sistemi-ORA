import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { readDocument } from "@/lib/document-storage";

// Linku publik i një dokumenti të shkollës (katalog, broshurë…) — pa kyçje, me token të
// rastësishëm. Jep gjithmonë versionin e fundit; dokumentet e arkivuara s'hapen më.
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[A-Za-z0-9_-]{10,40}$/.test(token)) return NextResponse.json({ error: "Nuk u gjet" }, { status: 404 });
  const doc = await prisma.schoolDocument.findUnique({ where: { publicToken: token } });
  if (!doc || doc.archivedAt) return NextResponse.json({ error: "Dokumenti nuk është më i disponueshëm." }, { status: 404 });

  const buffer = await readDocument(doc.fileName);
  if (!buffer) return NextResponse.json({ error: "Skedari nuk u gjet" }, { status: 404 });
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Disposition": `inline; filename="${encodeURIComponent(doc.originalFileName)}"`,
      "Cache-Control": "no-cache",
      "X-Robots-Tag": "noindex",
    },
  });
}
