import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

  const all = await prisma.shpenzim.findMany({
    where: {
      data: {
        gte: new Date(year, 0, 1),
        lte: new Date(year, 11, 31, 23, 59, 59),
      },
    },
    include: { kategori: true },
    orderBy: { data: "asc" },
  });

  const katMap = new Map<number, { id: number; emri: string; ngjyra: string | null; ikona: string | null }>();
  const pivot  = new Map<number, Record<number, number>>();

  for (const r of all) {
    const kid = r.kategoriId;
    if (!katMap.has(kid)) {
      katMap.set(kid, { id: kid, emri: r.kategori.emri, ngjyra: r.kategori.ngjyra, ikona: r.kategori.ikona });
      pivot.set(kid, {});
    }
    const month = new Date(r.data).getMonth() + 1;
    pivot.get(kid)![month] = (pivot.get(kid)![month] ?? 0) + r.shuma;
  }

  const kategorite = Array.from(katMap.values())
    .sort((a, b) => a.emri.localeCompare(b.emri, "sq"))
    .map(k => {
      const muajt = pivot.get(k.id) ?? {};
      const total = Object.values(muajt).reduce((s, v) => s + v, 0);
      return { ...k, muajt, total };
    })
    .filter(k => k.total > 0);

  const totalPerMuaj: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    totalPerMuaj[m] = kategorite.reduce((s, k) => s + (k.muajt[m] ?? 0), 0);
  }
  const totalVjetor = kategorite.reduce((s, k) => s + k.total, 0);

  return NextResponse.json({ kategorite, totalPerMuaj, totalVjetor, year });
}
