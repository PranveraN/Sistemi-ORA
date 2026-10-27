import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { kujdestarja } from "@/lib/lirimiAuth";

// Nxënësit e klasës së kujdestares — VETËM emri, mbiemri, emri dhe telefoni i prindit.
export async function GET() {
  const k = await kujdestarja();
  if (!k) return NextResponse.json({ error: "Nuk keni qasje." }, { status: 403 });
  const list = await prisma.student.findMany({
    where: { classId: k.classId, status: "ACTIVE" },
    select: { id: true, firstName: true, lastName: true, parentName: true, fatherName: true, motherName: true, parentPhone: true, fatherPhone: true, motherPhone: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }],
  });
  return NextResponse.json({
    klasa: k.klasa,
    nxenesit: list.map(s => ({
      id: s.id,
      emri: s.firstName,
      mbiemri: s.lastName,
      prindi: s.parentName || s.fatherName || s.motherName || null,
      telefoni: s.parentPhone || s.fatherPhone || s.motherPhone || null,
    })),
  });
}
