import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { logAction } from "@/lib/audit";
import { currentSchoolYearStart } from "@/lib/academicYear";
import { krijoTimiPagese, permbledhjaTimi, TimiError, TIMI_KOMISION_PCT } from "@/lib/timiPagesat";

// Pagesat nga TIMI Invest (src/lib/timiPagesat.ts).
// GET ?viti=2026 → fëmijët TIMI (çmimi, sa pagoi TIMI, sa mbetet) + lista e pagesave
// POST { data, shuma, komisionPct?, vitiShkollor, referenca?, prindi?, shenim?, femijet: [{ studentId, shuma }] }

const ALLOWED_ROLES = ["ADMIN", "SUPERADMIN", "FINANCE"];

function who(session: unknown) {
  const u = (session as { user?: { id?: string; name?: string | null; role?: string; organizationId?: number } }).user;
  return { orgId: u?.organizationId ?? 1, role: u?.role ?? "", actor: { id: parseInt(u?.id ?? "") || null, name: u?.name ?? null } };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { orgId, role } = who(session);
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const viti = parseInt(req.nextUrl.searchParams.get("viti") ?? "") || currentSchoolYearStart();
  const setting = await prisma.setting.findUnique({ where: { key: "timiKomisionPct" } });
  return NextResponse.json({ ...(await permbledhjaTimi(prisma, orgId, viti)), komisionPct: parseFloat(setting?.value ?? "") || TIMI_KOMISION_PCT });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { orgId, role, actor } = who(session);
  if (!ALLOWED_ROLES.includes(role)) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const cents = (v: unknown) => Math.round((typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."))) * 100);
  try {
    const p = await krijoTimiPagese(prisma, orgId, actor, {
      data: String(b.data ?? ""),
      shumaCents: cents(b.shuma),
      komisionPct: b.komisionPct != null ? Number(b.komisionPct) : TIMI_KOMISION_PCT,
      vitiShkollor: parseInt(b.vitiShkollor),
      referenca: typeof b.referenca === "string" ? b.referenca.slice(0, 100) : null,
      prindi: typeof b.prindi === "string" ? b.prindi.slice(0, 150) : null,
      shenim: typeof b.shenim === "string" ? b.shenim.slice(0, 500) : null,
      femijet: Array.isArray(b.femijet) ? b.femijet.map((f: { studentId: unknown; shuma: unknown }) => ({ studentId: parseInt(String(f.studentId)), cents: cents(f.shuma) })) : [],
    });
    await logAction(session, "CREATE", "TimiPagese", p.id,
      `Pagesë nga TIMI ${(p.shumaCents / 100).toFixed(2)} € (${p.referenca ?? "pa ref."}) — për fëmijët ${(p.brutoCents / 100).toFixed(2)} €, komisioni ${(p.komisionCents / 100).toFixed(2)} €`);
    return NextResponse.json(p, { status: 201 });
  } catch (e) {
    if (e instanceof TimiError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
