import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { sessionHasModule } from "@/lib/specialCarePermissions";
import { loadShkollimiExpenses } from "@/lib/shkollimiExpenses";
import type { YearType } from "@/lib/academicYear";

// Shkollimi → skeda "Shpenzime": shpenzimet e modulit "Shpenzimet" për periudhën
// (+ ato të regjistruara më parë direkt te skeda), me ndarjen arkë / bankë / borxh.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!sessionHasModule(session, "shkollimi") && !sessionHasModule(session, "shpenzime")) {
    return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  }
  const sp = req.nextUrl.searchParams;
  const month = parseInt(sp.get("month") || "0") || 0;
  const year = parseInt(sp.get("year") || "0") || 0;
  const yearType = (sp.get("yearType") === "academic" ? "academic" : "calendar") as YearType;
  const cat = await prisma.paymentCategory.findFirst({ where: { name: "Shkollimi" }, select: { id: true } });
  return NextResponse.json(await loadShkollimiExpenses(cat?.id ?? null, month, year, yearType));
}
