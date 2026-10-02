import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { buildStaffData } from "@/lib/staffFields";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Të dhëna të ndjeshme të stafit (paga, llogari bankare, kontrata) — vetëm me modulin "Sekretaria"
  if (!sessionHasModule(session, "sekretaria")) return NextResponse.json({ error: "Nuk ke leje për këtë modul." }, { status: 403 });

  const { searchParams } = new URL(req.url);
  const search = searchParams.get("search") || "";
  const tipi = searchParams.get("tipi") || "";
  const status = searchParams.get("status") || "";

  const where: Record<string, unknown> = {};
  if (search) {
    where.OR = [
      { emri: { contains: search } },
      { lenda: { contains: search } },
      { kodi: { contains: search } },
    ];
  }
  if (tipi) where.tipi = tipi;
  if (status) where.status = status;

  const staff = await prisma.staff.findMany({
    where,
    orderBy: [{ tipi: "asc" }, { emri: "asc" }],
  });

  return NextResponse.json(staff);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Të dhëna të ndjeshme të stafit (paga, llogari bankare, kontrata) — vetëm me modulin "Sekretaria"
  if (!sessionHasModule(session, "sekretaria")) return NextResponse.json({ error: "Nuk ke leje për këtë modul." }, { status: 403 });

  const body = await req.json();
  const member = await prisma.staff.create({ data: buildStaffData(body) });
  return NextResponse.json(member, { status: 201 });
}
