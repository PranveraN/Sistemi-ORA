import type { Session } from "next-auth";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { currentAcademicYear } from "@/lib/classYears";
import { getOraConfig, NEVER_ALLOWED_ROLES, type OraConfig } from "./config";
import type { OraContext } from "./types";

// Kush mund ta përdorë Orën dhe me cilin kontekst lejesh.

export type OraAccess =
  | { ok: true; ctx: OraContext; config: OraConfig }
  | { ok: false; status: number; error: string };

export async function oraAccess(session: Session | null): Promise<OraAccess> {
  if (!session?.user) return { ok: false, status: 401, error: "Unauthorized" };
  const u = session.user as { id?: string; role?: string; organizationId?: number };
  const role = u.role ?? "";
  const config = await getOraConfig();
  if (NEVER_ALLOWED_ROLES.includes(role) || (role !== "SUPERADMIN" && !config.roles.includes(role))) {
    return { ok: false, status: 403, error: "Roli yt s'ka qasje te Ora." };
  }
  if (!config.enabled) return { ok: false, status: 503, error: "Ora është e çaktivizuar nga administrata." };
  const orgId = u.organizationId ?? 1;
  return {
    ok: true, config,
    ctx: {
      orgId,
      userId: parseInt(u.id ?? "") || null,
      role,
      hasModule: (k: string) => sessionHasModule(session, k),
      year: await currentAcademicYear(orgId),
    },
  };
}

/** Pyetjet e sotme të përdoruesit (për kufirin ditor). */
export async function questionsToday(userId: number | null): Promise<number> {
  if (!userId) return 0;
  const start = new Date(); start.setHours(0, 0, 0, 0);
  return prisma.oraQuery.count({ where: { userId, createdAt: { gte: start }, status: { not: "DENIED" } } });
}

/** Fshin regjistrat më të vjetër se periudha e ruajtjes. */
export async function purgeOldQueries(retentionDays: number): Promise<void> {
  const cutoff = new Date(Date.now() - retentionDays * 86400000);
  await prisma.oraQuery.deleteMany({ where: { createdAt: { lt: cutoff } } }).catch(() => {});
}
