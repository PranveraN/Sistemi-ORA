import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Lista e nxënësve që kanë të paktën një Evidencë — shfaqet si pamja e
// paracaktuar te skeda "Evidenca" (para se admin/pedagogia të kërkojë
// ndonjë emër specifik), e renditur sipas evidencës më të fundit.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const records = await prisma.studentEvidenca.findMany({
    where: { organizationId: orgId },
    select: {
      studentId: true,
      createdAt: true,
      student: { select: { id: true, firstName: true, lastName: true, class: { select: { name: true, level: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });

  const byStudent = new Map<number, { student: typeof records[number]["student"]; count: number; lastDate: string }>();
  for (const r of records) {
    const existing = byStudent.get(r.studentId);
    if (existing) existing.count += 1;
    else byStudent.set(r.studentId, { student: r.student, count: 1, lastDate: r.createdAt.toISOString() });
  }

  const result = Array.from(byStudent.values()).sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  return NextResponse.json(result);
}
