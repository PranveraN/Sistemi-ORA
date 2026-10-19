import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/** Numri i radhës i dëshmisë: DEP-{viti}-{sekuenca}. */
export async function nextReceiptNumber(orgId?: number): Promise<string> {
  const year = new Date().getFullYear();
  const last = await prisma.payment.findFirst({
    where: { ...(orgId ? { organizationId: orgId } : {}), receiptNumber: { startsWith: `DEP-${year}-` } },
    orderBy: { receiptNumber: "desc" },
    select: { receiptNumber: true },
  });
  const lastSeq = last ? parseInt(last.receiptNumber!.split("-").pop() || "0") : 0;
  return `DEP-${year}-${String(lastSeq + 1).padStart(4, "0")}`;
}

const isReceiptClash = (e: unknown) =>
  e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002" &&
  JSON.stringify(e.meta?.target ?? "").includes("receiptNumber");

/**
 * Shkruan pagesën me një numër dëshmie të ri. Kur disa pagesa ruhen njëkohësisht
 * (p.sh. 12 muajt e TIMI-t), dy prej tyre mund të lexojnë të njëjtin "numër të
 * fundit" — e dyta dështonte me 500. Tani merr numrin tjetër dhe provon përsëri.
 */
export async function withReceiptNumber<T>(orgId: number | undefined, write: (receiptNumber: string) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await write(await nextReceiptNumber(orgId));
    } catch (e) {
      if (!isReceiptClash(e) || attempt >= 20) throw e;
    }
  }
}
