import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { loadCatalogEntries } from "@/lib/materialRequestText";
import { MATERIAL_SETTING_KEYS, parseAutoCreate, parseLeadDays } from "@/lib/materialConfig";

// Katalogu për formën e mësuesit (përputhja e drejtpërdrejtë ndërsa shkruan),
// bashkë me rregullin e ditëve dhe çelësin AUTO_CREATE_ITEMS — mësuesit s'kanë
// qasje te /api/settings. Vetëm lexim.
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const [entries, settings] = await Promise.all([
    loadCatalogEntries(orgId),
    prisma.setting.findMany({ where: { key: { in: Object.values(MATERIAL_SETTING_KEYS) } } }),
  ]);
  const v = (k: string) => settings.find(s => s.key === k)?.value;
  return NextResponse.json(
    { entries, leadDays: parseLeadDays(v(MATERIAL_SETTING_KEYS.leadDays)), autoCreate: parseAutoCreate(v(MATERIAL_SETTING_KEYS.autoCreateItems)) },
    { headers: { "Cache-Control": "private, max-age=60" } },
  );
}
