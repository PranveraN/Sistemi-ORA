import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { MAX_UNIFORM_PHOTO_SIZE, deleteUniformPhoto, isSafeUniformPhoto, readUniformPhoto, saveUniformPhoto } from "@/lib/uniform-photo-storage";

// Foto e produktit të uniformës: GET (shfaq), POST (ngarko/zëvendëso), DELETE (hiq).
// Ruhet vetëm emri i skedarit te fusha ekzistuese UniProduct.photo.

async function productOf(params: Promise<{ id: string }>) {
  const id = parseInt((await params).id);
  return id ? prisma.uniProduct.findUnique({ where: { id }, select: { id: true, name: true, photo: true } }) : null;
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = await productOf(params);
  if (!p || !isSafeUniformPhoto(p.photo)) return NextResponse.json({ error: "S'ka foto" }, { status: 404 });
  const file = await readUniformPhoto(p.photo);
  if (!file) return NextResponse.json({ error: "S'ka foto" }, { status: 404 });
  return new NextResponse(new Uint8Array(file.buffer), {
    headers: { "Content-Type": file.contentType, "Cache-Control": "private, max-age=86400", "X-Content-Type-Options": "nosniff" },
  });
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = await productOf(params);
  if (!p) return NextResponse.json({ error: "Produkti nuk u gjet" }, { status: 404 });
  const form = await req.formData();
  const file = form.get("file");
  if (!file || typeof file === "string") return NextResponse.json({ error: "Zgjidh një foto" }, { status: 400 });
  if (file.size > MAX_UNIFORM_PHOTO_SIZE) return NextResponse.json({ error: "Fotoja s'duhet të kalojë 5 MB" }, { status: 400 });
  let name: string;
  try {
    name = await saveUniformPhoto(p.id, Buffer.from(await file.arrayBuffer()), file.type);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
  await prisma.uniProduct.update({ where: { id: p.id }, data: { photo: name } });
  await deleteUniformPhoto(p.photo);
  await logAction(session, "UPDATE", "UniProduct", p.id, `Ngarkoi foton e produktit ${p.name}`);
  return NextResponse.json({ photo: name });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const p = await productOf(params);
  if (!p) return NextResponse.json({ error: "Produkti nuk u gjet" }, { status: 404 });
  await prisma.uniProduct.update({ where: { id: p.id }, data: { photo: null } });
  await deleteUniformPhoto(p.photo);
  await logAction(session, "UPDATE", "UniProduct", p.id, `Hoqi foton e produktit ${p.name}`);
  return NextResponse.json({ ok: true });
}
