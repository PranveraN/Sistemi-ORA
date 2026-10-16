import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

const ROLES = ["ADMIN", "SUPERADMIN", "SECRETARY"];

function who(session: unknown) {
  const u = (session as { user?: { role?: string; name?: string | null; organizationId?: number } }).user;
  return { role: u?.role ?? "", name: u?.name ?? null, orgId: u?.organizationId ?? 1 };
}

// PATCH { pinned?, category?, title?, description?, archived? } — fiksim, kategori, emër, arkivim/rikthim
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role, name, orgId } = who(session);
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });

  const { id } = await params;
  const doc = await prisma.schoolDocument.findFirst({ where: { id: parseInt(id), organizationId: orgId } });
  if (!doc) return NextResponse.json({ error: "Nuk u gjet" }, { status: 404 });

  const b = await req.json().catch(() => ({}));
  const data: Record<string, unknown> = {};
  if (typeof b.pinned === "boolean") data.pinned = b.pinned;
  if ("category" in b) data.category = typeof b.category === "string" && b.category.trim() ? b.category.trim().slice(0, 60) : null;
  if (typeof b.title === "string" && b.title.trim()) data.title = b.title.trim().slice(0, 200);
  if ("description" in b) data.description = typeof b.description === "string" && b.description.trim() ? b.description.trim().slice(0, 1000) : null;
  if (typeof b.archived === "boolean") Object.assign(data, b.archived ? { archivedAt: new Date(), archivedByName: name, pinned: false } : { archivedAt: null, archivedByName: null });

  const updated = await prisma.schoolDocument.update({ where: { id: doc.id }, data, include: { uploadedBy: { select: { name: true } } } });
  const what = b.archived === true ? "Arkivoi" : b.archived === false ? "Riktheu nga arkivi" : "Ndryshoi";
  await logAction(session, "UPDATE", "SchoolDocument", doc.id, `${what} dokumentin "${doc.title}"`);
  return NextResponse.json(updated);
}

// "Fshi" = arkivim — dokumentet dhe skedarët s'fshihen kurrë (2026-10-16)
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { role, name, orgId } = who(session);
  if (!ROLES.includes(role)) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });

  const { id } = await params;
  const doc = await prisma.schoolDocument.findFirst({ where: { id: parseInt(id), organizationId: orgId } });
  if (!doc) return NextResponse.json({ error: "Nuk u gjet" }, { status: 404 });

  await prisma.schoolDocument.update({ where: { id: doc.id }, data: { archivedAt: new Date(), archivedByName: name, pinned: false } });
  await logAction(session, "UPDATE", "SchoolDocument", doc.id, `Arkivoi dokumentin "${doc.title}"`);
  return NextResponse.json({ ok: true, archived: true });
}
