import type { PrismaClient } from "@prisma/client";

// Kodi i stafit (p.sh. "EM00000456") — i radhës = numri më i madh ekzistues + 1, me të njëjtin
// format ("EM" + 8 shifra). S'mbahet më mend me dorë cili ishte i fundit.
export async function nextStaffCode(db: Pick<PrismaClient, "staff">): Promise<string> {
  const rows = await db.staff.findMany({ where: { kodi: { startsWith: "EM" } }, select: { kodi: true } });
  const max = rows.reduce((m, r) => { const n = parseInt((r.kodi ?? "").replace(/^EM/i, ""), 10); return Number.isFinite(n) && n > m ? n : m; }, 0);
  return `EM${String(max + 1).padStart(8, "0")}`;
}
