import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Numra të lehtë (jo lista të plota) — përdoret nga kujtuesi global (popup) që
// pyet periodikisht (çdo 5/10 min) pavarësisht faqes ku ndodhet stafi, ndaj
// duhet i lirë të mos rëndojë me kalimin e kohës kur grumbullohen kërkesat.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "FINANCE") {
    return NextResponse.json({ pending: 0, approvedUnsent: 0 });
  }

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const [pending, approvedUnsent] = await Promise.all([
    prisma.materialRequest.count({ where: { organizationId: orgId, status: "PENDING" } }),
    prisma.materialRequest.count({ where: { organizationId: orgId, status: "APPROVED", sentAt: null } }),
  ]);

  return NextResponse.json({ pending, approvedUnsent });
}
