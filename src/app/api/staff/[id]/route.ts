import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { buildStaffUpdateData } from "@/lib/staffFields";

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
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Të dhëna të pavlefshme." }, { status: 400 });
  }
  // Përditëso vetëm fushat e dërguara — asnjë fushë s'fshihet sepse mungon
  const data = buildStaffUpdateData(body);
  if (!Object.keys(data).length) return NextResponse.json({ error: "Asnjë fushë për të ndryshuar." }, { status: 400 });
  if ("emri" in data && !data.emri?.trim()) return NextResponse.json({ error: "Emri s'mund të jetë bosh." }, { status: 400 });

  const existing = await prisma.staff.findUnique({ where: { id: Number(id) || 0 }, select: { id: true } });
  if (!existing) return NextResponse.json({ error: "Punonjësi nuk u gjet" }, { status: 404 });

  const member = await prisma.staff.update({ where: { id: existing.id }, data });
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
