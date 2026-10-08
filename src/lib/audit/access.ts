import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";

// Qasja te moduli "Auditimi" (Faza 4): Super Admin dhe roli Auditor. Rregullat dhe
// pragjet i ndryshon vetëm Super Admin; Auditori i sheh dhe menaxhon gjetjet.

export interface AuditUser { id: number | null; name: string | null; role: string; orgId: number; canManageRules: boolean }

export async function requireAuditAccess(opts: { manageRules?: boolean } = {}): Promise<{ user: AuditUser; session: unknown } | { error: NextResponse }> {
  const session = await auth();
  if (!session) return { error: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  const u = session.user as { id?: string; name?: string | null; role?: string; organizationId?: number };
  const role = u.role ?? "";
  if (role !== "SUPERADMIN" && role !== "AUDITOR") return { error: NextResponse.json({ error: "Vetëm Auditori dhe Super Admin." }, { status: 403 }) };
  if (opts.manageRules && role !== "SUPERADMIN") return { error: NextResponse.json({ error: "Vetëm Super Admin mund t'i ndryshojë rregullat." }, { status: 403 }) };
  return {
    session,
    user: { id: parseInt(u.id ?? "") || null, name: u.name ?? null, role, orgId: u.organizationId ?? 1, canManageRules: role === "SUPERADMIN" },
  };
}

export const FINDING_STATUSES = ["E_RE", "NE_SHQYRTIM", "E_JUSTIFIKUAR", "E_KORRIGJUAR"] as const;
export const SEVERITIES = ["KRITIKE", "E_LARTE", "MESATARE", "E_ULET"] as const;
export const SEVERITY_ORDER: Record<string, number> = { KRITIKE: 0, E_LARTE: 1, MESATARE: 2, E_ULET: 3 };
