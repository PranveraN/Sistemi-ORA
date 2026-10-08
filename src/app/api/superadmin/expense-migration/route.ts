import { NextRequest, NextResponse } from "next/server";
import { guardClosedDay } from "@/lib/audit/routeGuard";
import { auth } from "@/lib/auth";
import { migrationPreview, runMigration } from "@/lib/expenseMigration";

// Faza 2 — migrimi i shpenzimeve të Shkollimit. GET = pamja paraprake (vetëm lexim);
// POST = ekzekutimi (backup automatik para çdo shkrimi). Vetëm Super Admin.
async function superAdmin() {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const u = session.user as { id?: string; role?: string; name?: string | null };
  if (u.role !== "SUPERADMIN") return { error: NextResponse.json({ error: "Vetëm Super Admin" }, { status: 403 }) };
  return { user: { id: parseInt(u.id ?? "0"), name: u.name ?? null } };
}

export async function GET() {
  const s = await superAdmin();
  if (s.error) return s.error;
  return NextResponse.json(await migrationPreview());
}

async function POST_handler(req: NextRequest) {
  const s = await superAdmin();
  if (s.error) return s.error;
  const body = await req.json().catch(() => ({}));
  if (body.confirm !== "MIGRO") return NextResponse.json({ error: "Konfirmimi mungon." }, { status: 400 });
  const linkDuplicates: Record<number, number> = {};
  for (const [k, v] of Object.entries(body.linkDuplicates ?? {})) { const a = parseInt(k), b = parseInt(String(v)); if (a && b) linkDuplicates[a] = b; }
  const foodCategoryIds = Array.isArray(body.foodCategoryIds) ? body.foodCategoryIds.map((x: unknown) => parseInt(String(x))).filter(Boolean) : [];
  try {
    return NextResponse.json(await runMigration({ linkDuplicates, foodCategoryIds, user: s.user! }));
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Migrimi dështoi — asgjë s'u ndryshua." }, { status: 500 });
  }
}

// Refuzimi për ditë të mbyllur të arkës → 409 me mesazh (Faza 2 e auditimit)
export const POST = guardClosedDay(POST_handler);
