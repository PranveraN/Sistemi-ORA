import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DEFAULT_ACADEMIC_YEAR } from "@/lib/academicYear";
import { runCashDiagnosis } from "@/lib/cashDiagnosis";

// Diagnostikimi i arkës së Shkollimit (vetëm lexim) — vetëm Super Admin. ?year=2026
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { role?: string; organizationId?: number };
  if (u.role !== "SUPERADMIN") return NextResponse.json({ error: "Vetëm Super Admin" }, { status: 403 });
  const year = parseInt(req.nextUrl.searchParams.get("year") || "") || DEFAULT_ACADEMIC_YEAR;
  const d = await runCashDiagnosis(u.organizationId ?? 1, year);
  if (!d) return NextResponse.json({ error: "Kategoria 'Shkollimi' s'ekziston." }, { status: 404 });
  return NextResponse.json(d);
}
