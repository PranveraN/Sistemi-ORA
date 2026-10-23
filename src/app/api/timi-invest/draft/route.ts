import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { ruajDraftTimi, TimiError, TIMI_KOMISION_PCT } from "@/lib/timiPagesat";
import { SAFE_TIMI_DOC } from "@/lib/timi-doc-storage";

// Ruaj si draft (magjistari, Faza 3) — s'prek asnjë muaj, s'krijon komision, s'numërohet askund.
// POST { draftId?, data, shuma, komisionPct?, vitiShkollor, referenca?, prindi?, shenim?, banka?, dokumenti?, dokumentiEmri?, draftData }
const ALLOWED_ROLES = ["ADMIN", "SUPERADMIN", "FINANCE"];

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { id?: string; name?: string | null; role?: string; organizationId?: number };
  if (!ALLOWED_ROLES.includes(u.role ?? "")) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const b = await req.json().catch(() => ({}));
  const cents = (v: unknown) => Math.round((typeof v === "number" ? v : parseFloat(String(v ?? "").replace(",", "."))) * 100) || 0;
  try {
    const d = await ruajDraftTimi(prisma, u.organizationId ?? 1, { id: parseInt(u.id ?? "") || null, name: u.name ?? null }, {
      draftId: Number.isInteger(b.draftId) ? b.draftId : null,
      data: String(b.data ?? ""), shumaCents: cents(b.shuma),
      komisionPct: Number.isFinite(Number(b.komisionPct)) && b.komisionPct !== null ? Number(b.komisionPct) : TIMI_KOMISION_PCT,
      vitiShkollor: parseInt(b.vitiShkollor),
      referenca: typeof b.referenca === "string" ? b.referenca.slice(0, 100) : null,
      prindi: typeof b.prindi === "string" ? b.prindi.slice(0, 150) : null,
      shenim: typeof b.shenim === "string" ? b.shenim.slice(0, 500) : null,
      banka: typeof b.banka === "string" ? b.banka.slice(0, 100) : null,
      dokumenti: typeof b.dokumenti === "string" && SAFE_TIMI_DOC.test(b.dokumenti) ? b.dokumenti : null,
      dokumentiEmri: typeof b.dokumentiEmri === "string" ? b.dokumentiEmri.slice(0, 200) : null,
      femijet: [], draftData: b.draftData ?? null,
    });
    return NextResponse.json({ id: d.id });
  } catch (e) {
    if (e instanceof TimiError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }
}
