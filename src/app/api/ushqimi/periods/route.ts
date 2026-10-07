import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sessionHasModule } from "@/lib/specialCarePermissions";

// Ditët e Kalkulatorit të Çmimeve (Ushqimi) për çdo vit shkollor: ditë pune,
// Klasa e parë dhe "Zbritje e paparashikueshme", sipas periudhës. Ruhen te
// Setting me çelësin "ushqimiPeriods:{viti}" (viti fillestar akademik).

interface PeriodIn { name: string; days: number; klasaDays: number; zbritjeDays: number }
const key = (year: number) => `ushqimiPeriods:${year}`;

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "ushqimi")) return NextResponse.json({ error: "Nuk ke leje" }, { status: 403 });
  const year = parseInt(req.nextUrl.searchParams.get("year") || "") || 0;
  if (!year) return NextResponse.json({ periods: null });
  const row = await prisma.setting.findUnique({ where: { key: key(year) } });
  let periods: PeriodIn[] | null = null;
  try { periods = row ? JSON.parse(row.value) : null; } catch { periods = null; }
  return NextResponse.json({ year, periods, savedAt: row?.updatedAt ?? null });
}

export async function PUT(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "ushqimi")) return NextResponse.json({ error: "Nuk ke leje" }, { status: 403 });
  const body = await req.json().catch(() => ({}));
  const year = parseInt(String(body.year)) || 0;
  const raw: unknown[] = Array.isArray(body.periods) ? body.periods : [];
  if (!year || raw.length === 0) return NextResponse.json({ error: "Të dhëna të mangëta." }, { status: 400 });
  const n = (v: unknown) => Math.max(0, Math.min(200, parseInt(String(v)) || 0));
  const periods: PeriodIn[] = raw.map(p => {
    const o = p as Record<string, unknown>;
    return { name: String(o.name ?? ""), days: n(o.days), klasaDays: n(o.klasaDays), zbritjeDays: n(o.zbritjeDays) };
  });
  const value = JSON.stringify(periods);
  await prisma.setting.upsert({ where: { key: key(year) }, update: { value }, create: { key: key(year), value } });
  await logAction(session, "UPDATE", "UshqimiPeriods", year,
    `Ushqimi ${year}–${year + 1}: ditët u ruajtën — ${periods.map(p => `${p.name} ${p.days}/${p.klasaDays}/${p.zbritjeDays}`).join("; ")}`);
  return NextResponse.json({ year, periods });
}
