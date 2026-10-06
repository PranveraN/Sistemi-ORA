import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DEFAULT_ACADEMIC_YEAR, type YearType } from "@/lib/academicYear";
import { computeShkollimiOverview } from "@/lib/shkollimiOverview";

// Pasqyra e plotë financiare e Shkollimit (Dashboard) — llogaritja te src/lib/shkollimiOverview.ts
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const orgId: number = (session.user as { organizationId?: number }).organizationId ?? 1;

  const { searchParams } = new URL(req.url);
  const year     = parseInt(searchParams.get("year") || String(DEFAULT_ACADEMIC_YEAR));
  const yearType = (searchParams.get("yearType") || "academic") as YearType;

  const data = await computeShkollimiOverview(orgId, year, yearType);
  if (!data) return NextResponse.json({ error: "Kategoria 'Shkollimi' s'ekziston ende." }, { status: 404 });
  return NextResponse.json(data);
}
