import type { Prisma, PrismaClient } from "@prisma/client";

// Pagesat e shpenzimeve/faturave — RREGULLI I VETËM, i përdorur kudo (Shkollimi →
// Shpenzime, Pasqyra/arka, Bilanci, Financat, diagnostikimi, auditimi):
//   • fatura pa pagesa pjesë-pjesë (mePagesa = false):
//       e paguar   → e gjithë shuma, në datën dhe me metodën e faturës
//       e papaguar → borxh te furnitori (e gjithë shuma)
//   • fatura me pagesa pjesë-pjesë (mePagesa = true):
//       llogariten VETËM pagesat (ShpenzimPagese), secila në datën dhe me metodën e vet;
//       borxhi = shuma e faturës − pagesat
// Faturat e vjetra s'kanë pagesa pjesore → rezultati i tyre mbetet i njëjtë si më parë.

type Db = Pick<PrismaClient, "shpenzim" | "shpenzimPagese">;
const r2 = (v: number) => Math.round(v * 100) / 100;

export interface PaidPortion {
  shpenzimId: number;
  shuma: number;            // euro
  data: Date;
  metoda: string | null;
  lloji: string;
  kategoriId: number;
  kategoriEmri: string | null;
  fusha: string | null;
  pershkrim: string | null;
  emriBiznesit: string | null;
  marres: string | null;
  fromPayment: boolean;     // true = pagesë pjesore; false = fatura e paguar e tëra
}

/** Pjesët e paguara me datë brenda `range` (ose të gjitha, nëse null). `where` filtron faturat. */
export async function loadPaidPortions(db: Db, range: Prisma.DateTimeFilter | null, where: Prisma.ShpenzimWhereInput = {}): Promise<PaidPortion[]> {
  const kat = { select: { id: true, emri: true, fusha: true } } as const;
  const [whole, pagesat] = await Promise.all([
    db.shpenzim.findMany({
      where: { ...where, deletedAt: null, paguar: true, mePagesa: false, ...(range ? { data: range } : {}) },
      include: { kategori: kat },
    }),
    db.shpenzimPagese.findMany({
      where: { ...(range ? { data: range } : {}), shpenzim: { ...where, deletedAt: null } },
      include: { shpenzim: { include: { kategori: kat } } },
    }),
  ]);
  return [
    ...whole.map(s => ({
      shpenzimId: s.id, shuma: s.shuma, data: s.data, metoda: s.metoda, lloji: s.lloji, kategoriId: s.kategoriId,
      kategoriEmri: s.kategori?.emri ?? null, fusha: s.kategori?.fusha ?? null, pershkrim: s.pershkrim, emriBiznesit: s.emriBiznesit, marres: s.marres, fromPayment: false,
    })),
    ...pagesat.map(p => ({
      shpenzimId: p.shpenzimId, shuma: p.shumaCents / 100, data: p.data, metoda: p.metoda, lloji: p.shpenzim.lloji, kategoriId: p.shpenzim.kategoriId,
      kategoriEmri: p.shpenzim.kategori?.emri ?? null, fusha: p.shpenzim.kategori?.fusha ?? null, pershkrim: p.shpenzim.pershkrim, emriBiznesit: p.shpenzim.emriBiznesit, marres: p.shpenzim.marres, fromPayment: true,
    })),
  ];
}

/** Shuma e paguar (euro) e çdo fature, nga pagesat e saj pjesore. */
export async function paidSumsByShpenzim(db: Db, ids: number[]): Promise<Map<number, number>> {
  if (ids.length === 0) return new Map();
  const g = await db.shpenzimPagese.groupBy({ by: ["shpenzimId"], where: { shpenzimId: { in: ids } }, _sum: { shumaCents: true } });
  return new Map(g.map(x => [x.shpenzimId, (x._sum.shumaCents ?? 0) / 100]));
}

/** Borxhi i mbetur te furnitori për një faturë (euro). */
export function remainingOf(s: { shuma: number; paguar: boolean; mePagesa: boolean }, paidSum: number): number {
  if (s.mePagesa) return Math.max(0, r2(s.shuma - paidSum));
  return s.paguar ? 0 : s.shuma;
}

/** Statusi i faturës për shfaqje. */
export function paymentStatus(s: { shuma: number; paguar: boolean; mePagesa: boolean }, paidSum: number): "E_PAGUAR" | "PJESERISHT" | "E_PAPAGUAR" {
  if (!s.mePagesa) return s.paguar ? "E_PAGUAR" : "E_PAPAGUAR";
  if (paidSum <= 0) return "E_PAPAGUAR";
  return remainingOf(s, paidSum) <= 0 ? "E_PAGUAR" : "PJESERISHT";
}
