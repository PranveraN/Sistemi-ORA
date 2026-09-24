import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { saveDocument, MAX_DOCUMENT_SIZE } from "@/lib/document-storage";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const category = req.nextUrl.searchParams.get("category");

  const documents = await prisma.schoolDocument.findMany({
    where: { organizationId: orgId, ...(category ? { category } : {}) },
    include: { uploadedBy: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(documents);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "SECRETARY") {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const userId = Number((session.user as { id?: string }).id);

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const title = String(form.get("title") ?? "").trim();
  const description = String(form.get("description") ?? "").trim();
  const category = String(form.get("category") ?? "").trim();

  if (!file) return NextResponse.json({ message: "Skedari mungon" }, { status: 400 });
  if (!title) return NextResponse.json({ message: "Titulli është i domosdoshëm" }, { status: 400 });
  if (file.size > MAX_DOCUMENT_SIZE) return NextResponse.json({ message: "Skedari s'duhet të kalojë 50MB" }, { status: 400 });

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const fileName = await saveDocument(buffer, file.type);

    const doc = await prisma.schoolDocument.create({
      data: {
        organizationId: orgId,
        title, description: description || null, category: category || null,
        fileName, originalFileName: file.name, mimeType: file.type, size: file.size,
        uploadedById: userId,
      },
      include: { uploadedBy: { select: { name: true } } },
    });

    return NextResponse.json(doc, { status: 201 });
  } catch {
    return NextResponse.json({ message: "Vetëm PDF, Word (doc/docx) ose foto (JPEG/PNG/WebP) lejohen" }, { status: 400 });
  }
}
