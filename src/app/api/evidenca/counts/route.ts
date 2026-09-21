import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

// Numri i evidencave + data e fundit për një grup nxënësish — për ta shfaqur
// si status te rreshtat e listës te /evidenca, pa e ngarkuar çdo rresht
// veç e veç me thirrje të ndara.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const idsParam = req.nextUrl.searchParams.get("ids") || "";
  const studentIds = idsParam.split(",").map(s => parseInt(s)).filter(n => !isNaN(n));
  if (studentIds.length === 0) return NextResponse.json({});

  const records = await prisma.studentEvidenca.findMany({
    where: { studentId: { in: studentIds } },
    select: { studentId: true, createdAt: true },
    orderBy: { createdAt: "desc" },
  });

  const result: Record<number, { count: number; lastDate: string }> = {};
  for (const r of records) {
    if (!result[r.studentId]) result[r.studentId] = { count: 0, lastDate: r.createdAt.toISOString() };
    result[r.studentId].count += 1;
  }

  return NextResponse.json(result);
}
