import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { findApplicationByToken } from "@/lib/enrollmentApplication";
import { deleteApplicationDocument } from "@/lib/application-storage";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string; docId: string }> }) {
  const { id, docId } = await params;
  const applicationId = parseInt(id);
  const { searchParams } = new URL(req.url);
  const token = searchParams.get("token");

  const app = await findApplicationByToken(applicationId, token);
  if (!app) return NextResponse.json({ message: "Aplikimi nuk u gjet." }, { status: 403 });
  if (app.status !== "DRAFT") return NextResponse.json({ message: "Aplikimi tashmë është dorëzuar." }, { status: 409 });

  const doc = await prisma.applicationDocument.findFirst({ where: { id: parseInt(docId), applicationId } });
  if (!doc) return NextResponse.json({ message: "Dokumenti nuk u gjet." }, { status: 404 });

  await deleteApplicationDocument(applicationId, doc.fileName);
  await prisma.applicationDocument.delete({ where: { id: doc.id } });

  return NextResponse.json({ ok: true });
}
