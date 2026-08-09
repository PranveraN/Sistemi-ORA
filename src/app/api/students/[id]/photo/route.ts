import { NextRequest, NextResponse } from "next/server";
import fs from "fs/promises";
import { auth } from "@/lib/auth";
import { findStudentPhoto, saveStudentPhoto, deleteStudentPhoto } from "@/lib/photo-storage";

const ALLOWED_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png":  "png",
  "image/webp": "webp",
};
const MAX_SIZE = 5 * 1024 * 1024; // 5MB

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const photo = await findStudentPhoto(parseInt(id));
  if (!photo) return NextResponse.json({ error: "Nuk ka foto" }, { status: 404 });

  const buf = await fs.readFile(photo.path);
  return new NextResponse(buf, {
    headers: { "Content-Type": photo.contentType, "Cache-Control": "private, max-age=300" },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const studentId = parseInt(id);

  const form = await req.formData();
  const file = form.get("file") as File | null;
  if (!file) return NextResponse.json({ error: "Skedari mungon" }, { status: 400 });

  const ext = ALLOWED_TYPES[file.type];
  if (!ext) return NextResponse.json({ error: "Vetëm foto JPEG, PNG ose WebP lejohen" }, { status: 400 });
  if (file.size > MAX_SIZE) return NextResponse.json({ error: "Foto s'duhet të kalojë 5MB" }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  await saveStudentPhoto(studentId, buffer, ext);

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await deleteStudentPhoto(parseInt(id));
  return NextResponse.json({ ok: true });
}
