import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveDocument, MAX_DOCUMENT_SIZE } from "@/lib/document-storage";
import { logAction } from "@/lib/audit";

// "Zëvendëso me version të ri": i njëjti dokument (id + linku publik) merr skedarin e ri;
// versioni i vjetër mbetet në disk dhe shënohet te previousFiles.
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { role?: string; organizationId?: number };
  if (!["ADMIN", "SUPERADMIN", "SECRETARY"].includes(u.role ?? "")) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });

  const { id } = await params;
  const doc = await prisma.schoolDocument.findFirst({ where: { id: parseInt(id), organizationId: u.organizationId ?? 1 } });
  if (!doc) return NextResponse.json({ error: "Nuk u gjet" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ message: "Skedari mungon" }, { status: 400 });
  if (file.size > MAX_DOCUMENT_SIZE) return NextResponse.json({ message: "Skedari s'duhet të kalojë 50MB" }, { status: 400 });

  let fileName: string;
  try {
    fileName = await saveDocument(Buffer.from(await file.arrayBuffer()), file.type, file.name);
  } catch {
    return NextResponse.json({ message: "Vetëm PDF, Word (doc/docx) ose foto (JPEG/PNG/WebP) lejohen" }, { status: 400 });
  }
  let prev: unknown[] = [];
  try { prev = doc.previousFiles ? JSON.parse(doc.previousFiles) : []; } catch { prev = []; }
  prev.push({ fileName: doc.fileName, originalFileName: doc.originalFileName, mimeType: doc.mimeType, size: doc.size, at: new Date().toISOString(), version: doc.version });

  const updated = await prisma.schoolDocument.update({
    where: { id: doc.id },
    data: {
      fileName, originalFileName: file.name, mimeType: file.type || doc.mimeType, size: file.size,
      version: doc.version + 1, replacedAt: new Date(), previousFiles: JSON.stringify(prev),
    },
    include: { uploadedBy: { select: { name: true } } },
  });
  await logAction(session, "UPDATE", "SchoolDocument", doc.id, `Zëvendësoi skedarin e "${doc.title}" me versionin ${updated.version} (${file.name})`);
  return NextResponse.json(updated);
}
