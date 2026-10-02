import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { saveDocument, readDocument, MAX_DOCUMENT_SIZE } from "@/lib/document-storage";

// Dokumentet e familjes — ngarkim (POST multipart) dhe shkarkim (GET ?docId=).
// Ruhen me të njëjtin mekanizëm si dokumentet e shkollës (emër i rastësishëm në disk).

async function guard(familyId: number) {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  if (!sessionHasModule(session, "families")) return { error: NextResponse.json({ error: "Nuk ke leje." }, { status: 403 }) };
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const fam = await prisma.family.findFirst({ where: { id: familyId, organizationId: orgId }, select: { id: true } });
  if (!fam) return { error: NextResponse.json({ error: "Familja nuk u gjet" }, { status: 404 }) };
  return { session, fam };
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(parseInt(id) || 0);
  if ("error" in g) return g.error;
  const docId = parseInt(req.nextUrl.searchParams.get("docId") || "");
  if (!Number.isFinite(docId)) return NextResponse.json({ error: "Dokumenti nuk u gjet" }, { status: 404 });
  const doc = await prisma.familyDocument.findFirst({ where: { id: docId, familyId: g.fam.id } });
  if (!doc) return NextResponse.json({ error: "Dokumenti nuk u gjet" }, { status: 404 });
  const buf = await readDocument(doc.fileName);
  if (!buf) return NextResponse.json({ error: "Skedari mungon në disk" }, { status: 404 });
  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": doc.contentType,
      "Content-Disposition": `inline; filename*=UTF-8''${encodeURIComponent(doc.originalName)}`,
      "Cache-Control": "private, max-age=300",
    },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const g = await guard(parseInt(id) || 0);
  if ("error" in g) return g.error;
  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Zgjidh skedarin." }, { status: 400 });
  if (file.size > MAX_DOCUMENT_SIZE) return NextResponse.json({ error: "Skedari s'duhet të kalojë 50MB." }, { status: 400 });
  let fileName: string;
  try {
    fileName = await saveDocument(Buffer.from(await file.arrayBuffer()), file.type, file.name);
  } catch {
    return NextResponse.json({ error: "Lejohen vetëm foto, PDF ose Word." }, { status: 400 });
  }
  const studentId = parseInt(String(form.get("studentId") ?? "")) || null;
  const doc = await prisma.familyDocument.create({
    data: {
      familyId: g.fam.id, studentId, title: String(form.get("title") ?? "").trim().slice(0, 120) || null,
      fileName, originalName: file.name.slice(0, 200), contentType: file.type || "application/octet-stream", size: file.size,
      uploadedById: parseInt((g.session.user as { id?: string }).id ?? "0") || null,
    },
  });
  return NextResponse.json({ id: doc.id }, { status: 201 });
}
