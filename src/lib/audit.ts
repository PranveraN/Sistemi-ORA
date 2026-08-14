import { prisma } from "./prisma";

// Best-effort activity logging — used across every mutating API route so
// admins can see who did what, when (see /historiku). Never throws: a
// logging failure must not break the real action that triggered it.
export async function logAction(
  session: unknown,
  action: "CREATE" | "UPDATE" | "DELETE",
  entity: string,
  entityId: number | null,
  details: string
): Promise<void> {
  const userId = parseInt((session as { user?: { id?: string } } | null)?.user?.id ?? "0");
  if (userId <= 0) return;
  try {
    await prisma.auditLog.create({ data: { userId, action, entity, entityId, details } });
  } catch {
    // swallow — audit logging must never break the caller's real action
  }
}
