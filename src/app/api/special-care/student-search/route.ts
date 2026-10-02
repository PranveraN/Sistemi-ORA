import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { canViewSpecialCare } from "@/lib/specialCarePermissions";

// Kërkim nxënësish për formularin e kujdesit të veçantë — VETËM emri dhe
// klasa (asnjë e dhënë financiare), për rolet me leje (p.sh. Pedagogia).
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!canViewSpecialCare((session.user as { role?: string }).role)) return NextResponse.json({ error: "Nuk ke leje" }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const q = (req.nextUrl.searchParams.get("q") || "").trim();
  if (q.length < 2) return NextResponse.json({ rows: [] });
  const parts = q.split(/\s+/);
  const rows = await prisma.student.findMany({
    where: {
      organizationId: orgId, status: "ACTIVE",
      OR: [
        { firstName: { contains: q } }, { lastName: { contains: q } },
        ...(parts.length >= 2 ? [{ AND: [{ firstName: { contains: parts[0] } }, { lastName: { contains: parts.slice(1).join(" ") } }] }] : []),
      ],
    },
    select: { id: true, firstName: true, lastName: true, class: { select: { name: true } } },
    take: 10,
    orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
  });
  return NextResponse.json({ rows: rows.map(r => ({ id: r.id, firstName: r.firstName, lastName: r.lastName, className: r.class?.name ?? null })) });
}
