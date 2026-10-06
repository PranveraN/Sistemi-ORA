import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { DEFAULT_ACADEMIC_YEAR } from "@/lib/academicYear";
import { loadLedger, requireEshkollori } from "@/lib/eshkollori";

// Eshkollori → "Të hyra": tabela, kartelat dhe grupet për vitin e zgjedhur.
export async function GET(req: NextRequest) {
  const a = requireEshkollori(await auth());
  if (a instanceof NextResponse) return a;
  const year = parseInt(req.nextUrl.searchParams.get("year") || "") || DEFAULT_ACADEMIC_YEAR;
  const data = await loadLedger(a.orgId, year);
  if (!data) return NextResponse.json({ error: "Kategoria e Eshkollorit s'ekziston." }, { status: 404 });
  return NextResponse.json(data);
}
