import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { TIMI_KOMISION_PCT } from "@/lib/timiPagesat";
import { logTimi } from "@/lib/timiAudit";

// Cilësimet e modulit TIMI: komisioni i TIMI-t (Setting "timiKomisionPct"). Vlen vetëm për
// pagesat e ardhshme — pagesat e ruajta e kanë përqindjen e vet. Çdo ndryshim → Historiku.
const READ = ["ADMIN", "SUPERADMIN", "FINANCE", "AUDITOR"];
const WRITE = ["ADMIN", "SUPERADMIN"];
const KEY = "timiKomisionPct";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!READ.includes((session.user as { role?: string }).role ?? "")) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const s = await prisma.setting.findUnique({ where: { key: KEY } });
  return NextResponse.json({ komisionPct: parseFloat(s?.value ?? "") || TIMI_KOMISION_PCT, iRuajtur: !!s, parazgjedhje: TIMI_KOMISION_PCT });
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { id?: string; name?: string | null; role?: string; organizationId?: number };
  if (!WRITE.includes(u.role ?? "")) return NextResponse.json({ error: "Vetëm administratori mund ta ndryshojë komisionin." }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const pct = Number(String(b.komisionPct ?? "").replace(",", "."));
  const arsye = typeof b.arsye === "string" ? b.arsye.trim() : "";
  if (!(pct >= 0 && pct < 20)) return NextResponse.json({ error: "Përqindja duhet të jetë mes 0 dhe 20." }, { status: 400 });
  if (arsye.length < 3) return NextResponse.json({ error: "Shkruani arsyen (të paktën 3 shenja)." }, { status: 400 });
  const ex = await prisma.setting.findUnique({ where: { key: KEY } });
  const vjeter = parseFloat(ex?.value ?? "") || TIMI_KOMISION_PCT;
  await prisma.setting.upsert({ where: { key: KEY }, create: { key: KEY, value: String(pct) }, update: { value: String(pct) } });
  await logTimi(prisma, u.organizationId ?? 1, { id: parseInt(u.id ?? "") || null, name: u.name ?? null }, [
    { action: "UPDATE", entity: "TimiPagese", entityId: 0, field: "komisionPct", oldValue: `${vjeter}%`, newValue: `${pct}%`, reason: arsye },
  ]);
  return NextResponse.json({ ok: true, komisionPct: pct });
}
