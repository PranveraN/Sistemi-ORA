import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { countForReview } from "@/lib/materialRequestText";

// Numra të lehtë (jo lista të plota) — përdoret nga kujtuesi global (popup) që
// pyet periodikisht (çdo 5/10 min) pavarësisht faqes ku ndodhet stafi, ndaj
// duhet i lirë të mos rëndojë me kalimin e kohës kur grumbullohen kërkesat.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const role = (session.user as { role?: string }).role;
  if (role !== "ADMIN" && role !== "SUPERADMIN" && role !== "FINANCE") {
    return NextResponse.json({ pending: 0, approvedUnsent: 0, forReview: 0 });
  }

  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const [pending, approvedUnsent, review] = await Promise.all([
    prisma.materialRequest.count({ where: { organizationId: orgId, status: { in: ["SUBMITTED", "UNDER_REVIEW"] } } }),
    prisma.materialRequest.count({ where: { organizationId: orgId, status: { in: ["APPROVED", "PARTIALLY_APPROVED"] }, sentAt: null } }),
    countForReview(orgId),
  ]);

  // forReview: artikuj të rinj / pjesë teksti që presin rishikim te Katalogu
  return NextResponse.json({ pending, approvedUnsent, forReview: review.total });
}
