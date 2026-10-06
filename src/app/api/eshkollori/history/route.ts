import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { requireEshkollori, getCategory, OLD_DEBT } from "@/lib/eshkollori";

// "Shiko historikun e pagesave": pagesat, ndryshimet e shumës, lirimet dhe
// borxhi i vjetër (edhe ai i falur / i fshirë) i një nxënësi.
export async function GET(req: NextRequest) {
  const a = requireEshkollori(await auth());
  if (a instanceof NextResponse) return a;
  const studentId = parseInt(req.nextUrl.searchParams.get("studentId") || "") || 0;
  const cat = await getCategory(a.orgId);
  if (!cat || !studentId) return NextResponse.json({ error: "Të dhëna të mangëta." }, { status: 400 });
  const [log, oldDebts, exemptions] = await Promise.all([
    prisma.feeChangeLog.findMany({ where: { studentId, categoryId: cat.id, organizationId: a.orgId }, orderBy: { createdAt: "desc" }, take: 200 }),
    prisma.payment.findMany({
      where: { studentId, categoryId: cat.id, description: OLD_DEBT, student: { organizationId: a.orgId } },
      select: { id: true, year: true, finalAmount: true, paidAmount: true, balance: true, status: true, note: true },
      orderBy: { year: "asc" },
    }),
    prisma.feeExemption.findMany({ where: { studentId, categoryId: cat.id, organizationId: a.orgId }, orderBy: { createdAt: "desc" } }),
  ]);
  return NextResponse.json({ log, oldDebts, exemptions });
}
