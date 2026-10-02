import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { previewFamilyBackfill, runFamilyBackfill } from "@/lib/familyBackfill";
import { logAction } from "@/lib/audit";

// Lidhja fillestare e familjeve (vetëm Super Admin).
//   GET  → VETËM LEXIM: sa familje krijohen, konfliktet, sugjerimet sipas emrit
//   POST { accept: [keys] } → krijon familjet; bashkon VETËM sugjerimet e zgjedhura
// Prek vetëm nxënësit pa familje — mund të përsëritet pa dyfishim.

async function superAdmin() {
  const session = await auth();
  return session && (session.user as { role?: string }).role === "SUPERADMIN" ? session : null;
}

export async function GET() {
  const session = await superAdmin();
  if (!session) return NextResponse.json({ error: "Vetëm Super Admin" }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  return NextResponse.json(await previewFamilyBackfill(orgId));
}

export async function POST(req: NextRequest) {
  const session = await superAdmin();
  if (!session) return NextResponse.json({ error: "Vetëm Super Admin" }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const body = await req.json().catch(() => ({}));
  const accept = Array.isArray(body.accept) ? body.accept.map(String) : [];
  const r = await runFamilyBackfill(orgId, accept);
  await logAction(session, "CREATE", "Family", null, `Lidhja fillestare e familjeve: ${r.created} familje, ${r.merged} bashkime sipas emrit të konfirmuara`);
  return NextResponse.json(r);
}
