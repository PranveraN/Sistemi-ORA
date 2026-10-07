import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ACADEMIC_YEAR } from "@/lib/academicYear";
import { computeShkollimiOverview } from "@/lib/shkollimiOverview";

// Diagnostikim VETËM-LEXIM (Super Admin) për "Ku janë paratë e paguara":
// tregon ku janë regjistruar realisht shpenzimet (Shkollimi → Shpenzime =
// tabela Expense; moduli "Shpenzimet e Përgjithshme" = tabela Shpenzim;
// Investimet = tabela Investim) dhe çfarë llogarit dashboard-i, për vitin ?year=2026.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if ((session.user as { role?: string }).role !== "SUPERADMIN") {
    return NextResponse.json({ error: "Vetëm Super Admin" }, { status: 403 });
  }
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const year = parseInt(req.nextUrl.searchParams.get("year") || "") || DEFAULT_ACADEMIC_YEAR;
  const from = new Date(year, 8, 1), to = new Date(year + 1, 8, 1);
  const r2 = (v: number | null | undefined) => Math.round((v ?? 0) * 100) / 100;

  const categories = await prisma.paymentCategory.findMany({ where: { name: "Shkollimi" }, select: { id: true, organizationId: true } });

  const [expenseGroups, expenseLatest, shpenzimPeriod, shpenzimAll, shpenzimLatest, investimPeriod, overview] = await Promise.all([
    prisma.expense.groupBy({ by: ["categoryId", "type", "method", "year", "month"], _sum: { amount: true }, _count: true }),
    prisma.expense.findMany({ orderBy: { id: "desc" }, take: 15, select: { id: true, categoryId: true, type: true, amount: true, method: true, date: true, month: true, year: true, description: true, recipient: true } }),
    prisma.shpenzim.groupBy({ by: ["metoda", "lloji", "paguar"], where: { deletedAt: null, data: { gte: from, lt: to } }, _sum: { shuma: true }, _count: true }),
    prisma.shpenzim.aggregate({ _sum: { shuma: true }, _count: true, _min: { data: true }, _max: { data: true } }),
    prisma.shpenzim.findMany({ orderBy: { id: "desc" }, take: 10, select: { id: true, data: true, shuma: true, metoda: true, lloji: true, paguar: true, pershkrim: true, kategori: { select: { emri: true } } } }),
    prisma.investim.groupBy({ by: ["metoda"], where: { data: { gte: from, lt: to } }, _sum: { vlera: true }, _count: true }),
    computeShkollimiOverview(orgId, year, "academic"),
  ]);

  const catName = new Map((await prisma.paymentCategory.findMany({ select: { id: true, name: true } })).map(c => [c.id, c.name]));

  return NextResponse.json({
    viti: `${year}–${year + 1}`,
    "1_kategorite_Shkollimi": categories,
    "2_dashboard_llogarit": overview?.cashFlow ?? null,
    "3_Expense_(Shkollimi→Shpenzime/Dorëzim)": expenseGroups
      .map(g => ({ kategoria: catName.get(g.categoryId) ?? `#${g.categoryId}`, categoryId: g.categoryId, lloji: g.type, metoda: g.method, viti: g.year, muaji: g.month, rreshta: g._count, shuma: r2(g._sum.amount) }))
      .sort((a, b) => (b.viti ?? 0) - (a.viti ?? 0) || (b.muaji ?? 0) - (a.muaji ?? 0)),
    "3b_Expense_te_fundit": expenseLatest.map(e => ({ ...e, kategoria: catName.get(e.categoryId) })),
    "4_Shpenzim_(Shpenzimet_e_Përgjithshme)_në_këtë_vit": shpenzimPeriod.map(g => ({ metoda: g.metoda, lloji: g.lloji, paguar: g.paguar, rreshta: g._count, shuma: r2(g._sum.shuma) })),
    "4b_Shpenzim_gjithsej": { rreshta: shpenzimAll._count, shuma: r2(shpenzimAll._sum.shuma), data_e_pare: shpenzimAll._min.data, data_e_fundit: shpenzimAll._max.data },
    "4c_Shpenzim_te_fundit": shpenzimLatest,
    "5_Investime_në_këtë_vit": investimPeriod.map(g => ({ metoda: g.metoda, rreshta: g._count, shuma: r2(g._sum.vlera) })),
  });
}
