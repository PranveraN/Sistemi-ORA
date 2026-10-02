import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewSpecialCare } from "@/lib/specialCarePermissions";

// Lista e stafit aktiv për zgjedhjen e asistentit — VETËM emri, pozita dhe
// kontakti (asnjë pagë, llogari bankare apo të dhëna kontrate).
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewSpecialCare((session.user as { role?: string }).role)) {
    return NextResponse.json({ error: "Nuk ke leje" }, { status: 403 });
  }
  const staff = await prisma.staff.findMany({
    where: { status: "ACTIVE" },
    select: { id: true, emri: true, pozita: true, telefoni: true, email: true },
    orderBy: { emri: "asc" },
  });
  return NextResponse.json(staff.map(s => ({ id: s.id, name: s.emri, position: s.pozita, phone: s.telefoni, email: s.email })));
}
