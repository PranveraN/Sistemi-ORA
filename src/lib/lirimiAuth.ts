// Kontrolli i qasjes për modulin e lirimit (server). Kufizimi kryesor i rolit
// Kujdestare bëhet te middleware.ts; këtu çdo API e verifikon PËRSËRI rolin dhe klasën.
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";

export const ROLE_KUJDESTARE = "KUJDESTARE";

type U = { id?: string; role?: string; name?: string | null; organizationId?: number };

/** Kujdestarja e kyçur + klasa e saj, ose null (s'është kujdestare / s'ka klasë). */
export async function kujdestarja() {
  const session = await auth();
  const u = session?.user as U | undefined;
  if (!u || u.role !== ROLE_KUJDESTARE) return null;
  const userId = parseInt(u.id ?? "0");
  const kk = await prisma.kujdestareKlasa.findUnique({ where: { userId } });
  if (!kk) return null;
  const klasa = await prisma.class.findUnique({ where: { id: kk.classId }, select: { id: true, name: true } });
  return { userId, emri: u.name ?? "", classId: kk.classId, klasa: klasa?.name ?? "", orgId: u.organizationId ?? 1 };
}

/** Administrata (moduli "Lirimet"): Super Admin, ose roli me lejen e modulit. */
export async function adminLirimi() {
  const session = await auth();
  const u = session?.user as U | undefined;
  if (!u || !sessionHasModule(session, "lirimet")) return null;
  return { userId: parseInt(u.id ?? "0"), emri: u.name ?? "", orgId: u.organizationId ?? 1 };
}
