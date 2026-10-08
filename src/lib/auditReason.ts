// Arsyeja e fshirjes së një rekordi financiar — e detyrueshme (shih
// FINANCIAL_DELETE_PATTERNS te src/middleware.ts). Dërgohet me header-in
// X-Audit-Reason dhe ruhet te gjurma e auditimit (FinAuditLog).

/** Pyet për arsyen; kthen null nëse anulohet ose është shumë e shkurtër. Zëvendëson confirm(). */
export function askDeleteReason(question: string): string | null {
  const r = window.prompt(`${question}\n\nShkruani arsyen e fshirjes (e detyrueshme — ruhet në gjurmën e auditimit):`);
  if (r === null) return null;
  const t = r.trim();
  if (t.length < 3) {
    alert("Fshirja u anulua: arsyeja duhet të ketë të paktën 3 shenja.");
    return null;
  }
  return t;
}

/** Header-at për fetch(…, { method: "DELETE", headers: reasonHeaders(arsyeja) }). */
export function reasonHeaders(reason: string): Record<string, string> {
  return { "X-Audit-Reason": encodeURIComponent(reason.slice(0, 500)) };
}
