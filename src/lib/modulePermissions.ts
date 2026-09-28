import { prisma } from "./prisma";
import { MODULE_KEYS, DEFAULT_ALLOWED, isConfigurableRole } from "./modules";

/**
 * Modulet e lejuara për një (organizatë, rol) — kombinon rreshtat eksplicitë
 * te RoleModulePermission me parazgjedhjet (shih modules.ts) për çdo modul
 * pa rresht ende. SUPERADMIN merr gjithmonë të gjitha (qasje e plotë, s'ka
 * kuptim ta kufizosh); rolet e tjera (p.sh. TEACHER) kthejnë listë bosh —
 * ato drejtohen nga restriksione krejt të veçanta (shih middleware.ts).
 */
export async function getAllowedModules(organizationId: number, role: string): Promise<string[]> {
  if (role === "SUPERADMIN") return MODULE_KEYS;
  if (!isConfigurableRole(role)) return [];

  const rows = await prisma.roleModulePermission.findMany({
    where: { organizationId, role },
    select: { moduleKey: true, allowed: true },
  });
  const overrides = new Map(rows.map(r => [r.moduleKey, r.allowed]));
  const defaults = DEFAULT_ALLOWED[role];

  return MODULE_KEYS.filter(key => overrides.has(key) ? overrides.get(key)! : defaults.includes(key));
}
