import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canEditSpecialCare, canViewSpecialCare } from "@/lib/specialCarePermissions";
import { readPiaFile } from "@/lib/pia-file-storage";

// Hap / shkarko një evidencë të PIA-s (?download=1), ose fshihe (DELETE — vetëm e fsheh, skedari mbetet).
const roleOf = (s: unknown) => ((s as { user?: { role?: string } })?.user?.role) ?? "";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewSpecialCare(roleOf(session))) return NextResponse.json({ error: "Nuk ke leje për këto të dhëna" }, { status: 403 });
  const rec = await prisma.piaFile.findUnique({ where: { id: parseInt((await params).id) } });
  if (!rec || rec.deletedAt) return NextResponse.json({ error: "Skedari nuk u gjet" }, { status: 404 });
  const file = await readPiaFile(rec.fileName);
  if (!file) return NextResponse.json({ error: "Skedari mungon në server" }, { status: 404 });
  const download = req.nextUrl.searchParams.get("download") === "1";
  const name = encodeURIComponent(rec.originalFileName);
  return new NextResponse(new Uint8Array(file.buffer), {
    headers: {
      "Content-Type": file.contentType,
      "Content-Disposition": `${download ? "attachment" : "inline"}; filename*=UTF-8''${name}`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canEditSpecialCare(roleOf(session))) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const id = parseInt((await params).id);
  const rec = await prisma.piaFile.findUnique({ where: { id }, select: { id: true, deletedAt: true } });
  if (!rec || rec.deletedAt) return NextResponse.json({ error: "Skedari nuk u gjet" }, { status: 404 });
  await prisma.piaFile.update({ where: { id }, data: { deletedAt: new Date(), deletedByName: (session.user as { name?: string | null }).name ?? null } });
  return NextResponse.json({ ok: true });
}
