import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const isManagement = role === "ADMIN" || role === "FINANCE";

  const subjects = await prisma.subject.findMany({
    where: { organizationId: orgId, ...(isManagement ? {} : { active: true }) },
    include: { _count: { select: { requests: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json(subjects);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "FINANCE") {
    return NextResponse.json({ error: "Vetëm adminët ose financat mund të menaxhojnë lëndët" }, { status: 403 });
  }

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const body = await req.json();
  const name = String(body.name ?? "").trim();
  if (!name) return NextResponse.json({ error: "Emri mungon" }, { status: 400 });

  const existing = await prisma.subject.findFirst({
    where: { organizationId: orgId, name: { equals: name } },
  });
  if (existing) return NextResponse.json({ error: "Kjo lëndë ekziston tashmë" }, { status: 409 });

  const subject = await prisma.subject.create({
    data: { name, organizationId: orgId },
  });

  return NextResponse.json(subject, { status: 201 });
}
