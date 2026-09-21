import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

// Heq nxënës nga karta/lista "Nxënës të Rinj" — VETËM nga ky raport, nxënësi
// mbetet ACTIVE në sistem (asgjë tjetër s'ndryshon). Përdoret kur enrollDate
// e dikujt bie gabimisht brenda periudhës (p.sh. nga një import i vjetër),
// jo si regjistrim real i ri. Pranon 1 ose shumë id-ë njëherësh.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const ids: number[] = Array.isArray(body.ids) ? body.ids.map(Number).filter((n: number) => !isNaN(n)) : [];
  if (ids.length === 0) return NextResponse.json({ message: "Asnjë nxënës i zgjedhur." }, { status: 400 });

  const result = await prisma.student.updateMany({
    where: { id: { in: ids } },
    data: { hideFromNewRegistrations: true },
  });

  await logAction(session, "UPDATE", "Student", null, `Hoqi ${result.count} nxënës nga karta "Nxënës të Rinj" (nuk fshiu vetë nxënësit)`);

  return NextResponse.json({ ok: true, count: result.count });
}
