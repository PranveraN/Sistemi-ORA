import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { expensePeriodWhere, expensePeriodWhereByDate } from "@/lib/expensePeriod";
import type { YearType } from "@/lib/academicYear";

// "Dorëzimet" — pasqyrë VETËM PËR SHIKIM e të gjitha dorëzimeve të regjistruara te
// skedat "Dorëzim parash" të kategorive (Shkollimi, Ushqimi, Eshkollori…). Çdo
// kategori përdor të njëjtin filtër periudhe si skeda e vet, që shumat të përputhen.
// Përfshin edhe rreshtat e librit të vjetër (faqja e dikurshme "Dorëzimet"), nëse ka.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "dorezimet")) return NextResponse.json({ error: "Nuk ke leje" }, { status: 403 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const sp = req.nextUrl.searchParams;
  const categoryId = parseInt(sp.get("categoryId") || "") || 0;
  const month = parseInt(sp.get("month") || "0") || 0;
  const year = parseInt(sp.get("year") || "0") || 0;
  const yearType = (sp.get("yearType") === "calendar" ? "calendar" : "academic") as YearType;

  const categories = await prisma.paymentCategory.findMany({
    where: { organizationId: orgId, ...(categoryId ? { id: categoryId } : {}) },
    select: { id: true, name: true },
  });

  const rows = (await Promise.all(categories.map(async c => {
    const period = (c.name === "Shkollimi" ? expensePeriodWhereByDate : expensePeriodWhere)(month, year, yearType);
    const list = await prisma.expense.findMany({ where: { categoryId: c.id, type: "HANDOVER", ...period }, orderBy: { date: "desc" } });
    return list.map(h => ({
      id: h.id, source: "TAB" as const, date: h.date.toISOString(), categoryId: c.id, categoryName: c.name,
      amount: h.amount, recipient: h.recipient, description: h.description, method: h.method, reference: h.reference,
    }));
  }))).flat();

  // Libri i vjetër (s'përdoret më për regjistrim; s'llogaritet në arkë) — shfaqet veç, për mos t'u humbur
  const range = year > 0
    ? month > 0 ? { gte: new Date(year, month - 1, 1), lt: new Date(year, month, 1) }
      : yearType === "academic" ? { gte: new Date(year, 8, 1), lt: new Date(year + 1, 8, 1) } : { gte: new Date(year, 0, 1), lt: new Date(year + 1, 0, 1) }
    : undefined;
  const legacy = await prisma.paymentHandover.findMany({
    where: { organizationId: orgId, ...(categoryId ? { categoryId } : {}), ...(range ? { handoverAt: range } : {}) },
    include: { category: { select: { name: true } } },
    orderBy: { handoverAt: "desc" },
  });

  rows.sort((a, b) => b.date.localeCompare(a.date));
  return NextResponse.json({
    rows,
    legacy: legacy.map(h => ({
      id: h.id, source: "OLD" as const, date: h.handoverAt.toISOString(), categoryId: h.categoryId, categoryName: h.category?.name ?? "Të përgjithshme",
      amount: h.amount, recipient: h.recipient, description: h.description, method: h.method, reference: h.reference,
    })),
  });
}
