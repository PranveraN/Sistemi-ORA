import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q") || "";

  const where = q
    ? {
        OR: [
          { emriBiznesit: { contains: q } },
          { nrFiskal:     { contains: q } },
        ],
        NOT: { emriBiznesit: null },
      }
    : { NOT: { emriBiznesit: null } };

  const rows = await prisma.shpenzim.findMany({
    where,
    select: { emriBiznesit: true, nrFiskal: true },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  // Unik sipas emrit të biznesit (mbaj nr fiskal nga i fundit)
  const map = new Map<string, { emriBiznesit: string; nrFiskal: string | null }>();
  for (const r of rows) {
    if (!r.emriBiznesit) continue;
    if (!map.has(r.emriBiznesit)) {
      map.set(r.emriBiznesit, { emriBiznesit: r.emriBiznesit, nrFiskal: r.nrFiskal });
    }
  }

  return NextResponse.json([...map.values()].slice(0, 20));
}
