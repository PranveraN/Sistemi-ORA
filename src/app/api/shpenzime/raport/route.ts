import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type RawRow = {
  kategoriId: number; emri: string; ngjyra: string | null; ikona: string | null;
  id: number; shuma: number; data: string;
};

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

  // Merr të gjitha shpenzimet me kategorinë e tyre
  const all = await prisma.$queryRawUnsafe<RawRow[]>(`
    SELECT s.id, s.shuma, s.data, k.id as kategoriId, k.emri, k.ngjyra, k.ikona
    FROM Shpenzim s
    JOIN ShpenzimKategori k ON s.kategoriId = k.id
  `);

  // Filtro sipas vitit dhe agregoje sipas muajit — format-agnostic
  const filtered = all.filter(r => {
    const d = String(r.data || "");
    // Mbulo formate: "2023-06-15", "2023-06-15T...", "2023/06/15"
    return d.startsWith(String(year)) || d.startsWith(String(year).slice(2));
  });

  // Nderto pivot: kategoriId → { muaj → total }
  const katMap = new Map<number, { id: number; emri: string; ngjyra: string | null; ikona: string | null }>();
  const pivot = new Map<number, Record<number, number>>();

  for (const r of filtered) {
    const kid = Number(r.kategoriId);
    if (!katMap.has(kid)) {
      katMap.set(kid, { id: kid, emri: r.emri, ngjyra: r.ngjyra, ikona: r.ikona });
      pivot.set(kid, {});
    }
    // Ekstrakto muajin nga data (format: YYYY-MM-DD ose YYYY-MM-DDTHH...)
    const d = String(r.data || "");
    const monthStr = d.length >= 7 ? d.slice(5, 7) : null;
    const month = monthStr ? parseInt(monthStr) : null;
    if (!month || month < 1 || month > 12) continue;

    const prev = pivot.get(kid)![month] || 0;
    pivot.get(kid)![month] = prev + Number(r.shuma);
  }

  const kategorite = Array.from(katMap.values())
    .sort((a, b) => a.emri.localeCompare(b.emri, "sq"))
    .map(k => {
      const muajt = pivot.get(k.id) || {};
      const total = Object.values(muajt).reduce((s, v) => s + v, 0);
      return { ...k, muajt, total };
    })
    .filter(k => k.total > 0);

  const totalPerMuaj: Record<number, number> = {};
  for (let m = 1; m <= 12; m++) {
    totalPerMuaj[m] = kategorite.reduce((s, k) => s + (k.muajt[m] || 0), 0);
  }
  const totalVjetor = kategorite.reduce((s, k) => s + k.total, 0);

  return NextResponse.json({ kategorite, totalPerMuaj, totalVjetor, year });
}
