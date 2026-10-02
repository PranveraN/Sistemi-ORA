import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { buildStaffData } from "@/lib/staffFields";

export async function GET(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Të dhëna të ndjeshme të stafit (paga, llogari bankare, kontrata) — vetëm me modulin "Sekretaria"
  if (!sessionHasModule(session, "sekretaria")) return NextResponse.json({ error: "Nuk ke leje për këtë modul." }, { status: 403 });

  const { id } = await params;
  const member = await prisma.staff.findUnique({ where: { id: Number(id) } });
  if (!member) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(member);
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Të dhëna të ndjeshme të stafit (paga, llogari bankare, kontrata) — vetëm me modulin "Sekretaria"
  if (!sessionHasModule(session, "sekretaria")) return NextResponse.json({ error: "Nuk ke leje për këtë modul." }, { status: 403 });

  const { id } = await params;
  const body = await req.json();
  const member = await prisma.staff.update({
    where: { id: Number(id) },
    data: buildStaffData(body),
  });
  return NextResponse.json(member);
}

export async function DELETE(_: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Të dhëna të ndjeshme të stafit (paga, llogari bankare, kontrata) — vetëm me modulin "Sekretaria"
  if (!sessionHasModule(session, "sekretaria")) return NextResponse.json({ error: "Nuk ke leje për këtë modul." }, { status: 403 });

  const { id } = await params;
  await prisma.staff.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
