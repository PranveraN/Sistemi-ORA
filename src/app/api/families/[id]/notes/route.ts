import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";

// Shënime të brendshme për familjen (vetëm stafi me modulin "Familjet").
// POST { text } — shto; DELETE ?noteId= — fshi (vetëm autori ose Super Admin).

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "families")) return NextResponse.json({ error: "Nuk ke leje." }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const { id } = await params;
  const fam = await prisma.family.findFirst({ where: { id: parseInt(id) || 0, organizationId: orgId }, select: { id: true } });
  if (!fam) return NextResponse.json({ error: "Familja nuk u gjet" }, { status: 404 });
  const body = await req.json().catch(() => ({}));
  const text = String(body.text ?? "").trim().slice(0, 2000);
  if (!text) return NextResponse.json({ error: "Shkruaj shënimin." }, { status: 400 });
  const u = session.user as { id?: string; name?: string | null };
  const note = await prisma.familyNote.create({
    data: { familyId: fam.id, text, authorId: parseInt(u.id ?? "0") || null, authorName: u.name ?? null },
  });
  return NextResponse.json({ id: note.id, text: note.text, authorName: note.authorName, createdAt: note.createdAt.toISOString() }, { status: 201 });
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "families")) return NextResponse.json({ error: "Nuk ke leje." }, { status: 403 });
  const { id } = await params;
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const noteId = parseInt(req.nextUrl.searchParams.get("noteId") || "") || 0;
  const note = await prisma.familyNote.findFirst({ where: { id: noteId, familyId: parseInt(id) || 0, family: { organizationId: orgId } } });
  if (!note) return NextResponse.json({ error: "Shënimi nuk u gjet" }, { status: 404 });
  const u = session.user as { id?: string; role?: string };
  if (u.role !== "SUPERADMIN" && note.authorId !== parseInt(u.id ?? "0")) {
    return NextResponse.json({ error: "Vetëm autori mund ta fshijë shënimin." }, { status: 403 });
  }
  await prisma.familyNote.delete({ where: { id: note.id } });
  return NextResponse.json({ ok: true });
}
