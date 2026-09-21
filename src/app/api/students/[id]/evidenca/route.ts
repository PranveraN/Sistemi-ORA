import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Historiku i Evidencave (vlerësim pedagogjik + pyetësor shëndetësor/logjistik)
// për një nxënës — shih StudentEvidenca në schema.prisma. Vetëm-shtim, si
// StudentNote — çdo takim regjistrohet si rresht i ri, asnjë s'redaktohet.

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const records = await prisma.studentEvidenca.findMany({
    where: { studentId: parseInt(id) },
    include: { author: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(records);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const answers = body.answers && typeof body.answers === "object" ? body.answers : {};

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const authorId = parseInt((session.user as { id?: string } | undefined)?.id ?? "0");

  const record = await prisma.studentEvidenca.create({
    data: {
      studentId: parseInt(id),
      answers: JSON.stringify(answers),
      authorId,
      organizationId: orgId,
    },
    include: { author: { select: { name: true } } },
  });

  return NextResponse.json(record, { status: 201 });
}
