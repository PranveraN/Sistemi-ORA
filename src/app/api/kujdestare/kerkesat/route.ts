import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { kujdestarja } from "@/lib/lirimiAuth";

// Kërkesat e lirimit të klasës së kujdestares (në pritje të parat).
export async function GET() {
  const k = await kujdestarja();
  if (!k) return NextResponse.json({ error: "Nuk keni qasje." }, { status: 403 });
  const rows = await prisma.lirimKerkese.findMany({ where: { classId: k.classId }, orderBy: { createdAt: "desc" }, take: 200 });
  const students = await prisma.student.findMany({ where: { id: { in: [...new Set(rows.map(r => r.studentId))] } }, select: { id: true, firstName: true, lastName: true } });
  const emri = (id: number) => { const s = students.find(x => x.id === id); return s ? `${s.firstName} ${s.lastName}` : `#${id}`; };
  const out = rows.map(r => ({ ...r, emri: emri(r.studentId) }))
    .sort((a, b) => Number(b.statusi === "NE_PRITJE") - Number(a.statusi === "NE_PRITJE"));
  return NextResponse.json({ klasa: k.klasa, kerkesat: out });
}
