import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { DEFAULT_ACADEMIC_YEAR, getDateRange, type YearType } from "@/lib/academicYear";
import { computeShkollimiOverview } from "@/lib/shkollimiOverview";
import { toCents, fromCents } from "@/lib/cashFlow";
import { logAction } from "@/lib/audit";

// "Numëro arkën" — historiku (GET) dhe një numërim i ri (POST). Shuma në
// sistem llogaritet këtu, në server, jo nga ajo që dërgon shfletuesi.
function period(req: NextRequest, body?: { year?: unknown; yearType?: unknown }) {
  const q = new URL(req.url).searchParams;
  const year = parseInt(String(body?.year ?? q.get("year") ?? DEFAULT_ACADEMIC_YEAR)) || DEFAULT_ACADEMIC_YEAR;
  const yearType = (String(body?.yearType ?? q.get("yearType") ?? "academic") === "calendar" ? "calendar" : "academic") as YearType;
  return { year, yearType, label: getDateRange(year, yearType).label };
}

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const { label } = period(req);
  const counts = await prisma.cashCount.findMany({
    where: { organizationId: orgId, yearLabel: label },
    orderBy: { createdAt: "desc" },
    take: 20,
  });
  return NextResponse.json(counts);
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;
  const body = await req.json().catch(() => ({}));
  const counted = typeof body.counted === "number" ? body.counted : parseFloat(String(body.counted ?? "").replace(",", "."));
  if (!Number.isFinite(counted) || counted < 0) {
    return NextResponse.json({ error: "Shkruani shumën e numëruar (€)." }, { status: 400 });
  }
  const { year, yearType, label } = period(req, body);
  const overview = await computeShkollimiOverview(orgId, year, yearType);
  if (!overview) return NextResponse.json({ error: "Kategoria 'Shkollimi' s'ekziston ende." }, { status: 404 });

  const countedC = toCents(counted);
  const systemC = toCents(overview.cashFlow.inCashBox);
  const user = session.user as { id?: string; name?: string | null };
  const row = await prisma.cashCount.create({
    data: {
      organizationId: orgId,
      yearLabel: label,
      countedAmount: fromCents(countedC),
      systemAmount: fromCents(systemC),
      difference: fromCents(countedC - systemC),
      userId: parseInt(user.id ?? "") || null,
      userName: user.name ?? null,
    },
  });
  await logAction(session, "CREATE", "CashCount", row.id,
    `Numërim arke ${label}: numëruar ${row.countedAmount.toFixed(2)} €, sistemi ${row.systemAmount.toFixed(2)} €, diferenca ${row.difference.toFixed(2)} €`);
  return NextResponse.json(row, { status: 201 });
}
