import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditSpecialCare } from "@/lib/specialCarePermissions";
import { normalizeReview } from "@/lib/pia";

// Ndrysho / fshi një vlerësim të PIA-s.
const allowed = (s: unknown) => canEditSpecialCare(((s as { user?: { role?: string } })?.user?.role) ?? "");

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!allowed(session)) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const id = parseInt((await params).id);
  const body = await req.json().catch(() => ({}));
  const date = body.date ? new Date(body.date) : null;
  if (date && isNaN(date.getTime())) return NextResponse.json({ error: "Data s'është e vlefshme" }, { status: 400 });
  const ex = await prisma.piaReview.findUnique({ where: { id }, select: { id: true } });
  if (!ex) return NextResponse.json({ error: "Vlerësimi nuk u gjet" }, { status: 404 });
  await prisma.piaReview.update({
    where: { id },
    data: { ...(date ? { date } : {}), data: JSON.stringify(normalizeReview(body.data)), updatedByName: (session.user as { name?: string | null }).name ?? null },
  });
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!allowed(session)) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const id = parseInt((await params).id);
  const ex = await prisma.piaReview.findUnique({ where: { id }, select: { id: true } });
  if (!ex) return NextResponse.json({ error: "Vlerësimi nuk u gjet" }, { status: 404 });
  await prisma.piaReview.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
