import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { currentSchoolYearStart } from "@/lib/academicYear";
import { pasqyraTimi } from "@/lib/timiModule";

// Moduli TIMI INVEST → Pasqyra. VETËM LEXIM (GET) — s'ndryshon asgjë.
// Shifrat bazë = permbledhjaTimi (si skeda "Pagesat nga TIMI"); shih src/lib/timiModule.ts.
const ALLOWED_ROLES = ["ADMIN", "SUPERADMIN", "FINANCE", "AUDITOR"];

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const u = session.user as { role?: string; organizationId?: number };
  if (!ALLOWED_ROLES.includes(u.role ?? "")) return NextResponse.json({ error: "Nuk ke leje për këtë veprim" }, { status: 403 });
  const viti = parseInt(req.nextUrl.searchParams.get("viti") ?? "") || currentSchoolYearStart();
  return NextResponse.json(await pasqyraTimi(prisma, u.organizationId ?? 1, viti));
}
