import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Konteksti i përbashkët i API-ve të Bankës. Qasja në modul (dhe leximi-vetëm për
// Auditorin) zbatohet nga middleware-i (/api/banka → moduli "banka").
export async function bankCtx(): Promise<{ orgId: number; userName: string } | NextResponse> {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { organizationId?: number; name?: string | null; email?: string | null };
  return { orgId: u.organizationId ?? 1, userName: u.name || u.email || "—" };
}

export const bad = (error: string, status = 400) => NextResponse.json({ error }, { status });
export const intId = (v: string) => { const n = parseInt(v); return Number.isFinite(n) ? n : null; };
