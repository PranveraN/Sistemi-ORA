import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { adminLirimi } from "@/lib/lirimiAuth";

// Lista e kërkesave për administratën / recepsionin — filtra: data, klasa, statusi.
export async function GET(req: NextRequest) {
  const a = await adminLirimi();
  if (!a) return NextResponse.json({ error: "Nuk keni qasje." }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const where: Record<string, unknown> = { organizationId: a.orgId };
  const nga = sp.get("nga"), deri = sp.get("deri");
  if (nga || deri) where.data = { ...(nga ? { gte: nga } : {}), ...(deri ? { lte: deri } : {}) };
  const classId = parseInt(sp.get("classId") ?? "");
  if (classId) where.classId = classId;
  if (sp.get("statusi")) where.statusi = sp.get("statusi");

  const rows = await prisma.lirimKerkese.findMany({ where, orderBy: [{ data: "desc" }, { ora: "asc" }], take: 500 });
  const [students, classes] = await Promise.all([
    prisma.student.findMany({ where: { id: { in: [...new Set(rows.map(r => r.studentId))] } }, select: { id: true, firstName: true, lastName: true } }),
    prisma.class.findMany({ where: { id: { in: [...new Set(rows.map(r => r.classId).filter((x): x is number => !!x))] } }, select: { id: true, name: true } }),
  ]);
  return NextResponse.json(rows.map(r => {
    const s = students.find(x => x.id === r.studentId);
    return { ...r, emri: s ? `${s.firstName} ${s.lastName}` : `#${r.studentId}`, klasa: classes.find(c => c.id === r.classId)?.name ?? "" };
  }));
}
