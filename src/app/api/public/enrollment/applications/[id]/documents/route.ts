import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findApplicationByToken } from "@/lib/enrollmentApplication";
import { saveApplicationDocument, deleteApplicationDocument, extensionForMimeType } from "@/lib/application-storage";
import { DOC_TYPES, type DocType } from "@/lib/enrollmentDocs";

const MAX_SIZE = 10 * 1024 * 1024; // 10MB

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const applicationId = parseInt(id);

  const form = await req.formData();
  const token = form.get("resumeToken") as string | null;
  const docType = form.get("docType") as string | null;
  const file = form.get("file") as File | null;

  const app = await findApplicationByToken(applicationId, token);
  if (!app) return NextResponse.json({ message: "Aplikimi nuk u gjet." }, { status: 403 });
  if (app.status !== "DRAFT") return NextResponse.json({ message: "Aplikimi tashmë është dorëzuar." }, { status: 409 });

  const docConfig = DOC_TYPES.find(d => d.type === docType);
  if (!docConfig) return NextResponse.json({ message: "Lloj dokumenti i panjohur." }, { status: 400 });
  if (!file) return NextResponse.json({ message: "Skedari mungon." }, { status: 400 });
  if (!extensionForMimeType(file.type)) return NextResponse.json({ message: "Vetëm PDF, JPEG, PNG ose WebP lejohen." }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ message: "Skedari s'duhet të kalojë 10MB." }, { status: 400 });

  // Për llojet me "një vend të vetëm" (jo OTHER), ngarkimi i ri zëvendëson të
  // mëparshmin — prindi "e zëvendëson" thjesht duke ngarkuar sërish.
  if (!docConfig.multiple) {
    const existing = await prisma.applicationDocument.findFirst({ where: { applicationId, docType: docConfig.type } });
    if (existing) {
      await deleteApplicationDocument(applicationId, existing.fileName);
      await prisma.applicationDocument.delete({ where: { id: existing.id } });
    }
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const { fileName } = await saveApplicationDocument(applicationId, buffer, file.type);

  const doc = await prisma.applicationDocument.create({
    data: {
      applicationId,
      docType: docType as DocType,
      fileName,
      originalName: file.name,
      contentType: file.type,
      size: file.size,
    },
    select: { id: true, docType: true, originalName: true, contentType: true, size: true },
  });

  return NextResponse.json(doc);
}
