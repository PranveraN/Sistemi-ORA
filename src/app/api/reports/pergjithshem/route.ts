import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { raportiPergjithshem } from "@/lib/raportiPergjithshem";

// Raportet → "Raporti i përgjithshëm" — VETËM LEXIM. Rregullat: src/lib/raportiPergjithshem.ts
// GET ?nga=2026-09&deri=2027-08 (muaj të plotë, përfshirë të dy)
const ROLES = ["ADMIN", "SUPERADMIN", "FINANCE", "AUDITOR"];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!ROLES.includes((session.user as { role?: string }).role ?? "")) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const sp = req.nextUrl.searchParams;
  const m = (v: string | null) => /^(d{4})-(d{2})$/.exec(v ?? "");
  const a = m(sp.get("nga")), b = m(sp.get("deri"));
  if (!a || !b) return NextResponse.json({ error: "Zgjidhni periudhën (muaj nga–deri)." }, { status: 400 });
  const start = new Date(+a[1], +a[2] - 1, 1), end = new Date(+b[1], +b[2], 1);
  if (end <= start) return NextResponse.json({ error: "Periudha e pavlefshme." }, { status: 400 });
  return NextResponse.json(await raportiPergjithshem(prisma, start, end));
}
