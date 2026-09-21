import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { deleteDocumentFile } from "@/lib/document-storage";
import { logAction } from "@/lib/audit";

// S'ka fshirje e butë — janë dokumente informative (katalogë, broshura),
// jo regjistra me integritet historik si aplikimet e regjistrimit.
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "SECRETARY") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }

  const { id } = await params;
  const doc = await prisma.schoolDocument.findUnique({ where: { id: parseInt(id) } });
  if (!doc) return NextResponse.json({ error: "Nuk u gjet" }, { status: 404 });

  await deleteDocumentFile(doc.fileName);
  await prisma.schoolDocument.delete({ where: { id: doc.id } });

  await logAction(session, "DELETE", "SchoolDocument", doc.id, `Fshiu dokumentin "${doc.title}"`);

  return NextResponse.json({ ok: true });
}
