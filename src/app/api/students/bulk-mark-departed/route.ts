import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { recordStudentEvent } from "@/lib/studentHistory";

interface Entry {
  id: number;
  leaveReason?: string | null;
  destinationSchool?: string | null;
}

// Zbaton "Ngjit Listë" te "Largime/Transfere" — për çdo nxënës EKZISTUES të
// konfirmuar (aktiv), e shënon të larguar: status INACTIVE + inactiveDate =
// tani, njësoj si bën modali "+ Shto Largim" për një nxënës të vetëm (shih
// PATCH /api/students/[id]).
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const entries: Entry[] = Array.isArray(body.entries) ? body.entries : [];
  if (entries.length === 0) return NextResponse.json({ message: "Asnjë nxënës i zgjedhur." }, { status: 400 });

  const results = await prisma.$transaction(
    entries.map(e => prisma.student.update({
      where: { id: e.id },
      data: {
        status: "INACTIVE",
        inactiveDate: new Date(),
        leaveReason: e.leaveReason || null,
        destinationSchool: e.destinationSchool || null,
        hideFromDeparted: false,
      },
    }))
  );

  await logAction(session, "UPDATE", "Student", null, `Shënoi ${results.length} nxënës të larguar përmes "Ngjit Listë"`);
  await recordStudentEvent(session, entries.map(e => ({
    studentId: e.id, type: "CREGJISTRIM" as const, title: "Çregjistruar (larguar)",
    description: [e.leaveReason, e.destinationSchool && `Shkolla: ${e.destinationSchool}`].filter(Boolean).join(" · ") || null,
  })));

  return NextResponse.json({ ok: true, count: results.length });
}
