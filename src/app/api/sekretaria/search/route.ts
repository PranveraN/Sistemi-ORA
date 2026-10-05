import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";

// Kërkimi i panelit të Sekretarisë: nxënës (emër, nr. personal) dhe staf (emër).
// Kthen vetëm fushat për listën — asgjë financiare.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "sekretaria")) return NextResponse.json({ error: "Nuk ke leje për këtë modul." }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) return NextResponse.json({ students: [], staff: [] });
  const parts = q.split(/\s+/);
  const nameMatch = parts.length >= 2
    ? [
        { AND: [{ firstName: { contains: parts[0] } }, { lastName: { contains: parts.slice(1).join(" ") } }] },
        { AND: [{ firstName: { contains: parts.slice(0, -1).join(" ") } }, { lastName: { contains: parts[parts.length - 1] } }] },
      ]
    : [];

  const [students, staff] = await Promise.all([
    prisma.student.findMany({
      where: {
        organizationId: orgId,
        OR: [{ firstName: { contains: q } }, { lastName: { contains: q } }, { personalNumber: { contains: q } }, ...nameMatch],
      },
      select: { id: true, firstName: true, lastName: true, personalNumber: true, status: true, class: { select: { name: true } } },
      orderBy: [{ status: "asc" }, { firstName: "asc" }],
      take: 8,
    }),
    prisma.staff.findMany({
      where: { emri: { contains: q } },
      select: { id: true, emri: true, lenda: true, status: true },
      orderBy: { emri: "asc" },
      take: 5,
    }),
  ]);
  return NextResponse.json({ students, staff });
}
