import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";

// Heq nxënës nga karta/lista "Largime/Transfere" — VETËM nga ky raport, statusi
// INACTIVE i nxënësit NUK ndryshon (asgjë tjetër s'ndryshon). Pranon 1 ose
// shumë id-ë njëherësh — njësoj si hide-from-new/route.ts.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const ids: number[] = Array.isArray(body.ids) ? body.ids.map(Number).filter((n: number) => !isNaN(n)) : [];
  if (ids.length === 0) return NextResponse.json({ message: "Asnjë nxënës i zgjedhur." }, { status: 400 });

  const result = await prisma.student.updateMany({
    where: { id: { in: ids } },
    data: { hideFromDeparted: true },
  });

  await logAction(session, "UPDATE", "Student", null, `Hoqi ${result.count} nxënës nga karta "Largime/Transfere" (statusi Joaktiv NUK ndryshoi)`);

  return NextResponse.json({ ok: true, count: result.count });
}
