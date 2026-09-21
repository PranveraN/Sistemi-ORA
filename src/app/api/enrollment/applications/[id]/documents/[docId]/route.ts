import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { readApplicationDocument } from "@/lib/application-storage";

// Shikimi/shkarkimi i një dokumenti të aplikimit — vetëm për stafin e kyçur
// (ndryshe nga uploads publike, këtu s'ka nevojë për resumeToken).
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id, docId } = await params;
  const doc = await prisma.applicationDocument.findFirst({ where: { id: parseInt(docId), applicationId: parseInt(id) } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const file = await readApplicationDocument(parseInt(id), doc.fileName);
  if (!file) return NextResponse.json({ error: "Skedari nuk u gjet" }, { status: 404 });

  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `inline; filename="${doc.originalName.replace(/"/g, "")}"`,
      "Cache-Control": "private, max-age=300",
    },
  });
}
