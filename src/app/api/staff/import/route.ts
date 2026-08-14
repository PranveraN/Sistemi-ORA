import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

type StaffInput = {
  emri: string;
  telefoni?: string | null;
  lenda?: string | null;
  nrPersonal?: string | null;
  nrLlogarise?: string | null;
  banka?: string | null;
  totalBruto?: number | null;
  kontrata?: string | null;
  kodi?: string | null;
  tipi?: string | null;
  status?: string;
};

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string })?.role;
  if (role !== "ADMIN") return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const body = await req.json();
  const staff: StaffInput[] = Array.isArray(body) ? body : body.staff;

  if (!Array.isArray(staff) || staff.length === 0) {
    return NextResponse.json({ error: "Lista e stafit është bosh ose e pavlefshme." }, { status: 400 });
  }

  const data = staff.map((s) => ({
    emri:        s.emri        || "",
    telefoni:    s.telefoni    || null,
    lenda:       s.lenda       || null,
    nrPersonal:  s.nrPersonal  || null,
    nrLlogarise: s.nrLlogarise || null,
    banka:       s.banka       || null,
    totalBruto:  s.totalBruto  != null ? parseFloat(String(s.totalBruto)) : null,
    kontrata:    s.kontrata    || null,
    kodi:        s.kodi        || null,
    tipi:        s.tipi        || null,
    status:      s.status      || "ACTIVE",
  }));

  const before = await prisma.staff.count();
  await prisma.staff.deleteMany();
  const result = await prisma.staff.createMany({ data });

  await logAction(session, "DELETE", "Staff", null, `Fshiu gjithë stafin (${before} rreshta) dhe importoi ${result.count} rreshta të rinj nga skedari`);

  return NextResponse.json({ imported: result.count });
}
