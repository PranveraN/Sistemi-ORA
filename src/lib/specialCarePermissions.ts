// Lejet për të dhënat e NDJESHME të "Kujdesit të veçantë" — e vetmja vend ku
// përcaktohen. Përdoret si nga API (kontrolli real) ashtu edhe nga ndërfaqja
// (vetëm për të mos shfaqur elemente; s'është mbrojtje në vetvete).
//
// Drejtoria: Super Admin, Admin, Pedagogia (shikim dhe ndryshim). Financa/Sekretaria s'i shohin. Mësuesit e klasave dhe asistentët
// s'kanë ende llogari në panelin e stafit — qasja e tyre mund të shtohet më
// vonë përmes portalit të mësuesve.

export const SPECIAL_CARE_VIEW_ROLES = ["SUPERADMIN", "ADMIN", "PEDAGOGIA"];
export const SPECIAL_CARE_EDIT_ROLES = ["SUPERADMIN", "ADMIN", "PEDAGOGIA"];

export function canViewSpecialCare(role: string | null | undefined): boolean {
  return !!role && SPECIAL_CARE_VIEW_ROLES.includes(role);
}

export function canEditSpecialCare(role: string | null | undefined): boolean {
  return !!role && SPECIAL_CARE_EDIT_ROLES.includes(role);
}

/** A është rekordi aktiv në vitin akademik të dhënë (Shtator → Gusht)? */
export function activeInAcademicYear(
  r: { startDate: Date | string | null; endDate: Date | string | null },
  academicYear: number,
): boolean {
  const yStart = new Date(academicYear, 8, 1);
  const yEnd = new Date(academicYear + 1, 7, 31, 23, 59, 59);
  const s = r.startDate ? new Date(r.startDate) : null;
  const e = r.endDate ? new Date(r.endDate) : null;
  return (!s || s <= yEnd) && (!e || e >= yStart);
}

/** A e ka sesioni lejen e një moduli (si middleware/Sidebar)? Super Admin: gjithmonë. */
export function sessionHasModule(session: unknown, moduleKey: string): boolean {
  const u = (session as { user?: { role?: string; allowedModules?: string[] } } | null)?.user;
  if (!u) return false;
  if (u.role === "SUPERADMIN") return true;
  return Array.isArray(u.allowedModules) && u.allowedModules.includes(moduleKey);
}
