import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { computeAllBoxes } from "@/lib/cashBoxesSummary";

// GET → sa duhet të jenë cash sot në secilën arkë (vetëm lexim)
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "arka")) return NextResponse.json({ error: "Nuk ke leje" }, { status: 403 });
  const orgId = (session.user as { organizationId?: number }).organizationId ?? 1;
  const isSuperAdmin = (session.user as { role?: string }).role === "SUPERADMIN";
  return NextResponse.json(await computeAllBoxes(prisma, orgId, isSuperAdmin));
}
