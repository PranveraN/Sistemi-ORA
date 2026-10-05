import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { logAction } from "@/lib/audit";
import { MANUAL_YEAR_STEPS, YEAR_CLOSING_STEPS, type YearStepKey } from "@/lib/sekretariaConstants";
import { invalidateSekretariaSummary } from "@/lib/sekretariaSummary";

// Mbyllja e Vitit — shënon/heq me dorë hapat që s'llogariten nga të dhënat.
// POST { yearLabel, stepKey, done } — ruan datën dhe përdoruesin.
export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "sekretaria")) return NextResponse.json({ error: "Nuk ke leje për këtë modul." }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const user = session.user as { id?: string; name?: string | null };

  const body = await req.json().catch(() => ({}));
  const stepKey = String(body.stepKey ?? "") as YearStepKey;
  const yearLabel = String(body.yearLabel ?? "").trim();
  if (!MANUAL_YEAR_STEPS.includes(stepKey)) return NextResponse.json({ error: "Ky hap llogaritet automatikisht nga të dhënat." }, { status: 400 });
  if (!/^\d{4}-\d{4}$/.test(yearLabel)) return NextResponse.json({ error: "Viti i pavlefshëm." }, { status: 400 });
  const label = YEAR_CLOSING_STEPS.find(s => s.key === stepKey)!.label;

  if (body.done) {
    await prisma.yearClosingCheck.upsert({
      where: { organizationId_yearLabel_stepKey: { organizationId: orgId, yearLabel, stepKey } },
      update: {},
      create: { organizationId: orgId, yearLabel, stepKey, doneById: parseInt(user.id ?? "") || null, doneByName: user.name ?? null },
    });
    await logAction(session, "UPDATE", "YearClosing", null, `Mbyllja e vitit ${yearLabel}: u shënua i kryer "${label}"`);
  } else {
    await prisma.yearClosingCheck.deleteMany({ where: { organizationId: orgId, yearLabel, stepKey } });
    await logAction(session, "UPDATE", "YearClosing", null, `Mbyllja e vitit ${yearLabel}: u hoq shenja "${label}"`);
  }
  invalidateSekretariaSummary(orgId);
  return NextResponse.json({ ok: true });
}
