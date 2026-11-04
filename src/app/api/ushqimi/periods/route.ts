import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { sessionHasModule } from "@/lib/specialCarePermissions";

// Ditët e Kalkulatorit të Çmimeve (Ushqimi) për çdo vit shkollor: ditë pune,
// Klasa e parë dhe "Zbritje e paparashikueshme", sipas periudhës. Ruhen te
// Setting me çelësin "ushqimiPeriods:{viti}" (viti fillestar akademik).

// `muaj` (opsionale): ditët e mësimit për secilin nga dy muajt e periudhës, për çdo
// kolonë — p.sh. days [22, 20]. Kur të dy muajt janë plotësuar, totali i periudhës
// = shuma e tyre (Shtator/Tetor = 22 + 20 = 42); përndryshe mbetet vlera e vjetër.
type DayCol = "days" | "klasaDays" | "zbritjeDays";
type Muaj = Record<DayCol, (number | null)[]>;
interface PeriodIn { name: string; days: number; klasaDays: number; zbritjeDays: number; muaj?: Muaj }
const key = (year: number) => `ushqimiPeriods:${year}`;
const COLS: DayCol[] = ["days", "klasaDays", "zbritjeDays"];

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
  const nn = (v: unknown) => (v === null || v === undefined || v === "" ? null : n(v));
  const pair = (v: unknown) => (Array.isArray(v) ? [nn(v[0]), nn(v[1])] : [null, null]);
  const periods: PeriodIn[] = raw.map(p => {
    const o = p as Record<string, unknown>;
    const out: PeriodIn = { name: String(o.name ?? ""), days: n(o.days), klasaDays: n(o.klasaDays), zbritjeDays: n(o.zbritjeDays) };
    if (o.muaj && typeof o.muaj === "object") {
      const m = o.muaj as Record<string, unknown>;
      const muaj = { days: pair(m.days), klasaDays: pair(m.klasaDays), zbritjeDays: pair(m.zbritjeDays) };
      for (const c of COLS) {
        const [a, b] = muaj[c];
        if (a !== null && b !== null) out[c] = a + b;
      }
      out.muaj = muaj;
    }
    return out;
  });
  const value = JSON.stringify(periods);
  await prisma.setting.upsert({ where: { key: key(year) }, update: { value }, create: { key: key(year), value } });
  const ndarja = (p: PeriodIn) => (p.muaj?.days[0] != null && p.muaj?.days[1] != null ? ` (${p.muaj.days[0]}+${p.muaj.days[1]})` : "");
  await logAction(session, "UPDATE", "UshqimiPeriods", year,
    `Ushqimi ${year}–${year + 1}: ditët u ruajtën — ${periods.map(p => `${p.name} ${p.days}${ndarja(p)}/${p.klasaDays}/${p.zbritjeDays}`).join("; ")}`);
  return NextResponse.json({ year, periods });
}
